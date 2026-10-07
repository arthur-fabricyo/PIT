# Sistema de Rotas do Brasil — Design

**Data:** 2026-10-07
**Disciplina:** Estrutura de Dados II
**Ponto de partida:** `grafo-de-municipios.html` (15 municípios do PI, Dijkstra no navegador, SVG fixo)

## 1. Objetivo

Transformar o "Sistema de Rotas do Piauí" num sistema que calcula a **melhor rota entre municípios de todo o Brasil**:

- Front em **React + TypeScript + ESLint** (Vite), componentizado, com mapa interativo.
- Back em **Python (FastAPI)**: todo cálculo de rota sai do front e passa a ser feito no back.
- Grafo com os **5.570 municípios**, persistido em **SQLite** local.
- Escolha de pontos **dinâmica**: busca por nome via **Nominatim** e clique no mapa.
- O sistema **decide a melhor ordem de visita** e traça a rota no mapa.
- **Um único comando** (`npm run dev`) prepara o ambiente e sobe back + front, em qualquer SO/shell.

### Decisões tomadas (com o usuário)

| Tema | Decisão |
|---|---|
| Arestas do grafo | Gerado por coordenadas: cada município ligado aos **6 vizinhos mais próximos** (k-NN), peso = distância haversine em km (linha reta). Conectividade garantida com **Kruskal + Union-Find**. |
| Algoritmos | Escritos à mão, só biblioteca padrão do Python (sem numpy/networkx). |
| Seleção de pontos | Busca Nominatim ao pressionar Enter (sem autocomplete — proibido pela política) + clique no mapa. Back "encaixa" cada ponto no município mais próximo. |
| Multidestino | Back escolhe a ordem ótima: **força bruta** até 8 destinos, **vizinho mais próximo + 2-opt** acima. Rota **sempre retorna à origem** (como no HTML). |
| Back | FastAPI; grafo lido do SQLite e mantido em memória. |
| Testes | **Sem testes automatizados.** Verificação manual (lint, build, chamadas à API, uso da tela). |
| Execução | `npm run dev` na raiz, sem dependências na raiz, multiplataforma. |

### Fora de escopo

- Distância real por estrada (OSRM/OSM) — distâncias são aproximadas (linha reta entre municípios vizinhos) e a UI diz isso.
- Autenticação, deploy, persistência de rotas calculadas, histórico.
- Autocomplete enquanto digita.

## 2. Estrutura de pastas

```
estrutura-de-dados-2/
├── package.json               ← só scripts: "dev" e "setup" (zero dependências)
├── README.md
├── .gitignore                 ← backend/.venv, backend/data/rotas.db, __pycache__, node_modules, dist
├── scripts/
│   ├── setup.mjs              ← verifica/prepara ambiente (idempotente)
│   ├── dev.mjs                ← chama setup e sobe api + web
│   └── lib/                   ← utilitários compartilhados (achar Python, portas, spawn, encerrar árvore de processos, log colorido)
├── legado/
│   └── grafo-de-municipios.html   ← movido da raiz, referência da versão original
├── docs/superpowers/specs/    ← este documento
├── backend/
│   ├── requirements.txt       ← fastapi, uvicorn[standard], httpx (versões fixadas)
│   ├── data/
│   │   ├── municipios.csv     ← kelvins/municipios-brasileiros (MIT), versionado
│   │   ├── estados.csv        ← idem (tem BOM → ler com utf-8-sig)
│   │   └── rotas.db           ← gerado, fora do git
│   ├── scripts/
│   │   └── construir_banco.py
│   └── app/
│       ├── main.py            ← FastAPI, endpoints, carga do grafo no startup
│       ├── banco.py           ← sqlite3: schema, leitura/gravação
│       ├── modelos.py         ← schemas Pydantic de request/response
│       ├── grafo.py           ← classe Grafo (lista de adjacência)
│       ├── geo.py             ← haversine, município mais próximo
│       ├── union_find.py      ← Union-Find (union by rank + path compression)
│       ├── kruskal.py         ← árvore geradora mínima
│       ├── dijkstra.py        ← Dijkstra com heapq
│       ├── melhor_rota.py     ← força bruta / vizinho mais próximo + 2-opt
│       └── nominatim.py       ← cliente httpx com rate limit e cache
└── frontend/                  ← Vite + React + TS + ESLint (já criado)
```

`vite-project/` (template vanilla criado por engano) é **apagado**.

## 3. Dados e construção do grafo

### Fonte

`kelvins/municipios-brasileiros` (MIT): `municipios.csv` (`codigo_ibge, nome, latitude, longitude, capital, codigo_uf, ...`, 5.570 linhas) e `estados.csv` (`codigo_uf, uf, nome, ...`). Os dois CSVs são versionados em `backend/data/` — a construção do banco não usa rede.

### Schema SQLite (`backend/data/rotas.db`)

```sql
CREATE TABLE municipios (
  id        INTEGER PRIMARY KEY,   -- código IBGE
  nome      TEXT    NOT NULL,
  uf        TEXT    NOT NULL,      -- sigla, via estados.csv
  latitude  REAL    NOT NULL,
  longitude REAL    NOT NULL
);

CREATE TABLE arestas (
  origem_id    INTEGER NOT NULL REFERENCES municipios(id),
  destino_id   INTEGER NOT NULL REFERENCES municipios(id),
  distancia_km REAL    NOT NULL,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('knn', 'mst')),
  PRIMARY KEY (origem_id, destino_id),
  CHECK (origem_id < destino_id)   -- não direcionada: grava cada par uma vez
);
```

### `construir_banco.py`

1. Lê os CSVs e insere `municipios`.
2. Para cada município, calcula a distância haversine a todos os outros e guarda os **30 mais próximos** (`heapq.nsmallest`). Força bruta O(n²) ≈ 15,5 milhões de distâncias — leva dezenas de segundos, roda uma vez, mostra progresso.
3. Arestas `knn`: os **6** primeiros de cada lista (par normalizado `min,max`, sem duplicata).
4. Arestas `mst`: **Kruskal** sobre as arestas candidatas dos 30 vizinhos, ordenadas por peso, usando **Union-Find**. Arestas da MST que não forem `knn` entram como `mst`.
5. Validação: se o Union-Find terminar com mais de 1 componente, o script falha com mensagem clara (não esperado com 30 candidatos).
6. Grava em transação única, em arquivo temporário renomeado para `rotas.db` no fim (um build interrompido não deixa banco pela metade).
7. Imprime resumo: nº de municípios, nº de arestas por tipo, tempo gasto.

### Carga no servidor

No startup, `main.py` lê as duas tabelas e monta o `Grafo` em memória (`dict[int, list[tuple[int, float]]]` + dicionário de municípios). Dijkstra roda só em memória.

## 4. Algoritmos

| Peça | Implementação | Complexidade |
|---|---|---|
| Haversine | raio 6371 km | O(1) |
| Município mais próximo | varredura linear nos 5.570 | O(V) |
| Union-Find | union by rank + path compression | ~O(α(n)) |
| Kruskal | ordena candidatas + Union-Find | O(E log E) |
| Dijkstra | `heapq`, lazy deletion, retorna `dist` e `anterior` | O((V+E) log V) |
| Matriz de distâncias | 1 Dijkstra por ponto (origem + destinos) | O(P·(V+E) log V) |
| Força bruta (≤ 8 destinos) | `itertools.permutations` com origem fixa; custo inclui volta à origem | O(n!) — 8! = 40.320 |
| Heurística (> 8) | vizinho mais próximo a partir da origem, depois 2-opt até não melhorar (origem fixa) | O(n²) por passada |

Caminhos dos trechos são reconstruídos a partir do `anterior` do Dijkstra do ponto de saída de cada trecho (sem rodar Dijkstra de novo).

## 5. API

Prefixo `/api`. Em desenvolvimento, o Vite faz proxy de `/api` → `http://127.0.0.1:<API_PORT>` (padrão 8000), então não há CORS.

Tipo comum `Municipio`: `{ id, nome, uf, lat, lon }`.

### `GET /api/busca?q=<texto>`

- Back chama Nominatim `/search` com `countrycodes=br`, `format=jsonv2`, `limit=5`.
- `User-Agent` próprio identificando o projeto; parâmetro `email` do Nominatim opcional via variável de ambiente `NOMINATIM_EMAIL`.
- **Rate limit**: no máximo 1 requisição/s ao Nominatim (lock + timestamp no processo).
- **Cache** em memória por texto normalizado (LRU, 256 entradas).
- Resposta: `[{ rotulo, lat, lon, municipio: Municipio }]` — cada resultado já encaixado no município mais próximo.
- `q` vazio ou < 2 caracteres → `400`. Nominatim fora/timeout (10 s) → `502` "Busca indisponível no momento; tente clicar no mapa".

### `GET /api/municipios/proximo?lat=&lon=`

- Retorna o `Municipio` mais próximo. Sem chamada externa.
- lat/lon fora de faixa válida → `422` (validação Pydantic).

### `POST /api/rotas`

Request: `{ "origem_id": int, "destinos_ids": [int, ...] }`

Response:
```json
{
  "distancia_total_km": 812.4,
  "metodo": "forca_bruta",
  "ordem": [Municipio, ...],
  "trechos": [
    { "de": Municipio, "para": Municipio, "distancia_km": 120.3, "caminho": [Municipio, ...] }
  ]
}
```

- `ordem` começa e termina na origem; `metodo` ∈ `forca_bruta | heuristica`.
- `caminho` inclui os extremos do trecho.

Erros (`{ "detail": "<mensagem em português>" }`):

| Situação | Status |
|---|---|
| `destinos_ids` vazio | 400 |
| mais de 20 destinos | 400 |
| origem também listada como destino | 400 |
| destinos repetidos | 400 |
| id inexistente | 404 |
| sem caminho entre dois pontos (não esperado — grafo conexo) | 500 com mensagem clara |

## 6. Front

Visual do HTML atual mantido (variáveis de cor, cabeçalho azul, painel de 380px à esquerda, área principal à direita, empilha abaixo de 850px). O SVG vira mapa **Leaflet** (`leaflet`, `react-leaflet`, `@types/leaflet`) com tiles do OpenStreetMap e atribuição obrigatória.

```
src/
├── api/cliente.ts           ← buscarLocal, municipioProximo, calcularRota + tipos
├── hooks/usePlanejador.ts   ← estado: origem, destinos, modo, resultado, erro, carregando
├── components/
│   ├── Cabecalho.tsx
│   ├── PainelPlanejamento.tsx
│   ├── BuscaLocal.tsx       ← input + botão "Buscar" (submit/Enter), lista de resultados
│   ├── SeletorModo.tsx      ← Origem | Destino
│   ├── ListaPontos.tsx      ← origem + destinos, remover
│   ├── ResultadoRota.tsx    ← distância total, método, ordem, trechos
│   └── MapaRota.tsx         ← marcadores, polyline, clique, fitBounds
├── App.tsx
└── index.css                ← CSS portado do HTML + import do CSS do Leaflet
```

### Comportamento

- Modo inicial **Origem**; após definir a origem, troca sozinho para **Destino**. Usuário pode trocar o modo manualmente.
- Ponto escolhido (busca ou clique) aparece como o município encaixado, ex.: "Altos (PI)".
- Regras herdadas do HTML: origem não pode ser destino; município repetido é recusado; mensagens de erro no painel. Escolher como origem um município que já está nos destinos remove-o dos destinos.
- Limite de 20 destinos também validado no front.
- **Calcular rota**: botão desabilitado e com "Calculando…" durante a requisição.
- Resultado: destinos numerados na ordem ótima (marcadores numerados), rota em laranja (`#e67e22`) no mapa, `fitBounds` na rota, texto "distâncias aproximadas (linha reta entre municípios vizinhos)".
- Qualquer mudança em origem/destinos limpa o resultado.
- **Limpar** remove destinos e resultado (mantém origem).
- Mapa inicia centrado no Brasil.
- Erros da API exibem o `detail` do back; falha de rede exibe "Não foi possível falar com o servidor".

Estado só com `useState`/`useCallback` no hook; sem bibliotecas de estado.

## 7. Orquestração: `npm run dev` / `npm run setup`

Raiz: `package.json` com `"dev": "node scripts/dev.mjs"` e `"setup": "node scripts/setup.mjs"`, **sem dependências** — funciona logo após o clone.

### `setup.mjs` (idempotente; `dev.mjs` chama antes de subir)

1. **Node** ≥ 20.19 (exigência do Vite 8). Senão: mensagem com versão encontrada e link de download.
2. **Python** ≥ 3.11 — candidatos em ordem: `$PYTHON`, `py -3` (só Windows), `python3`, `python`. Cada candidato é **executado** (`-c "import sys; print(...)"`) para checar versão — descarta o alias da Microsoft Store. Nenhum válido: instruções por SO.
3. **venv** em `backend/.venv`: cria se ausente; recria se o executável da venv não roda. Falha típica de Debian/Ubuntu (`ensurepip` ausente) → instrução `sudo apt install python3-venv`.
   Python da venv chamado direto (`.venv/Scripts/python.exe` no Windows, `.venv/bin/python` nos demais) — **nunca precisa ativar** a venv.
4. **pip**: `python -m pip install -r requirements.txt` só se o SHA-256 do `requirements.txt` difere do salvo em `backend/.venv/.requirements.sha256`.
5. **npm** do front: `npm install` em `frontend/` só se o SHA-256 do `package-lock.json` difere do salvo em `frontend/node_modules/.package-lock.sha256`. npm chamado via `process.execPath` + `process.env.npm_execpath` quando disponível; senão `npm` (com `shell: true` só no Windows, por causa de `.cmd`).
6. **Banco**: roda `construir_banco.py` se `rotas.db` não existe.
7. Cada etapa imprime `✔`/`✖` com mensagem curta; erro encerra com código ≠ 0 e a dica de solução.

### `dev.mjs`

1. Executa as etapas do setup.
2. Porta da API: testa 8000 em `127.0.0.1` (`net.createServer`); ocupada → próxima livre. Passa `API_PORT` para o processo do Vite (o `vite.config.ts` lê `process.env.API_PORT ?? 8000` no proxy).
3. Sobe, sem shell e com argumentos em array (caminhos com espaço/acento seguros):
   - `[api]`: `<venv-python> -m uvicorn app.main:app --reload --host 127.0.0.1 --port <p>` em `backend/`
   - `[web]`: `node node_modules/vite/bin/vite.js --host 127.0.0.1` em `frontend/` (Vite pula 5173 se ocupada).
4. Env dos filhos: `PYTHONUTF8=1`, `PYTHONIOENCODING=utf-8`, `FORCE_COLOR=1`.
5. Saída de cada linha prefixada com `[api]` (ciano) / `[web]` (magenta); cores desligadas se `NO_COLOR` ou saída não-TTY.
6. Encerramento: `SIGINT`/`SIGTERM` (Ctrl+C) ou um filho saindo → encerra o outro com árvore inteira: Windows `taskkill /pid <pid> /T /F`; Linux/Mac `spawn(..., { detached: true })` + `process.kill(-pid)`. Sai com o código do filho que caiu.

## 8. README (`estrutura-de-dados-2/README.md`)

1. O que é + captura de tela.
2. Pré-requisitos: Node ≥ 20.19, Python ≥ 3.11, Git; como verificar versões; links de download; nota sobre marcar "Add python to PATH" no instalador do Windows.
3. Preparando o ambiente: `git clone` → `npm run dev` (ou `npm run setup` antes); o que cada etapa faz.
4. Rodando: URLs (front, `/docs` da API), rodar só back (`backend/.venv/... -m uvicorn ...`) ou só front (`npm run dev` em `frontend/`), `npm run lint`, variáveis (`PYTHON`, `API_PORT`, `NOMINATIM_EMAIL`).
5. Como funciona: grafo k-NN, Kruskal + Union-Find, Dijkstra com heap, força bruta vs. vizinho mais próximo + 2-opt, tabela de complexidades, limitação "linha reta".
6. Estrutura de pastas.
7. Endpoints com exemplos de request/response.
8. Fontes e créditos: kelvins/municipios-brasileiros (MIT), © contribuidores do OpenStreetMap (ODbL), política de uso do Nominatim e dos tiles OSM.
9. Problemas comuns: tabela "mensagem do script → solução" (Python não encontrado, venv/ensurepip, Node antigo, porta ocupada, Nominatim 502, proxy corporativo para pip/npm).

## 9. Verificação (manual, sem testes automatizados)

- `npm run lint` e `npm run build` no front sem erros.
- `construir_banco.py`: 5.570 municípios, 1 componente.
- `/docs` abre; `POST /api/rotas` com Teresina → [Parnaíba, Picos, Floriano] retorna rota coerente, começando e terminando em Teresina; cada erro da seção 5 retorna o status esperado.
- Comparação de sanidade: com ≤ 8 destinos, `metodo = forca_bruta`; com 9+, `heuristica`.
- Tela: busca por nome, clique no mapa, cálculo, desenho da rota, limpar, mensagens de erro.
- `npm run dev` num clone limpo prepara tudo e sobe os dois; segunda execução pula instalações; Ctrl+C não deixa processo `uvicorn`/`vite` órfão.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Distâncias em linha reta parecem "erradas" ao usuário | Texto explícito na UI e no README |
| Build do banco lento (O(n²) em Python puro) | Roda uma vez; barra de progresso; dezenas de segundos |
| Nominatim bloqueia/limita | Rate limit + cache + User-Agent; clique no mapa continua funcionando |
| Rede corporativa bloqueando pip/npm/tiles | Seção de problemas comuns com variáveis de proxy |
| `uvicorn --reload` deixar processos órfãos no Windows | `taskkill /T` na árvore inteira |
