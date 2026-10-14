# Rotas pelas estradas no mapa — Design

**Data:** 2026-10-14
**Ponto de partida:** o mapa desenha cada trecho como linha reta entre as sedes dos municípios do `caminho` devolvido pelo Dijkstra.

## 1. Objetivo

Desenhar a rota no mapa **seguindo as estradas reais**, rua por rua, em vez de linhas retas de cidade em cidade.

É **só visualização**: o grafo, o Dijkstra, a escolha da ordem de visita e as distâncias exibidas não mudam.

### Decisões tomadas (com o usuário)

| Tema | Decisão |
|---|---|
| Abordagem | **Geometrias pré-calculadas por aresta do grafo.** O grafo é fixo (19.937 arestas), então a geometria de cada aresta pelas estradas é calculada uma vez e versionada no repositório. Em execução não há motor de roteamento, Java nem servidor extra. |
| Motor usado na geração | **GraphHopper** (`.jar`) local, rodado só pelo desenvolvedor ao (re)gerar o arquivo. Não entra no repositório nem no `npm run setup`. |
| Cobertura | Brasil inteiro. Aresta sem rota por estrada (ilha, acesso só por balsa, falha do motor) é desenhada em linha reta. |
| Fidelidade ao algoritmo | O traçado passa pelos mesmos municípios do `caminho`; cada aresta do caminho vira o seu trecho de estrada. |
| Distâncias | Continuam as do grafo (haversine). A distância por estrada **não** é exibida — segue fora de escopo, como na spec de 2026-10-07. |
| Testes | **Muda a decisão anterior** ("sem testes automatizados"): o módulo novo do backend ganha testes com **pytest**, instalado por um `requirements-dev.txt` separado. O restante segue com verificação manual. |

### Alternativas descartadas

- **GraphHopper rodando junto com o app:** exige Java, download de ~0,5–2 GB e preparação no setup, além de ~3 GB de RAM só para o Nordeste (medido no spike). Pesado demais para quem vai avaliar o projeto.
- **API pública (OSRM demo, OpenRouteService):** depende de internet e de terceiros com limite de uso.
- **Mapbox GL JS:** é só biblioteca de desenho; não calcula rota.

### Fora de escopo

- Exibir distância ou tempo por estrada.
- Estilo diferente para arestas que caíram na linha reta.
- Regenerar as geometrias automaticamente quando o grafo mudar (é manual, documentado no README).

## 2. Arquivos

```
backend/
├── app/
│   ├── geometrias.py            ← NOVO: carga, decodificação e montagem do traçado
│   ├── main.py                  ← carrega as geometrias no ciclo de vida; preenche TrechoOut.geometria
│   └── modelos.py               ← TrechoOut ganha `geometria`
├── data/
│   └── geometrias_arestas.csv.gz ← NOVO (versionado): origem_id, destino_id, polyline
├── scripts/
│   └── gerar_geometrias.py      ← NOVO: gera o .csv.gz consultando o GraphHopper local
├── tests/
│   └── test_geometrias.py       ← NOVO
└── requirements-dev.txt         ← NOVO: pytest
frontend/src/
├── api/cliente.ts               ← Trecho ganha `geometria`
└── components/MapaRota.tsx      ← desenha `geometria` em vez de `caminho`
README.md                        ← seção nova: traçado pelas estradas e como regenerar
```

## 3. Geração das geometrias (uma vez, fora do app)

`backend/scripts/gerar_geometrias.py`, executado à mão pelo desenvolvedor com o GraphHopper já no ar:

1. Lê municípios e arestas do `rotas.db`.
2. Para cada aresta `(origem_id, destino_id)`, com `origem_id < destino_id` como no banco, faz `POST /route` com o perfil `car`, de `origem` para `destino`, pedindo a geometria completa sem instruções.
3. Simplifica o traçado com tolerância de **~50 m** (`way_point_max_distance` do GraphHopper) e codifica em **polyline** (algoritmo do Google, precisão 5).
4. Grava `backend/data/geometrias_arestas.csv.gz` com o cabeçalho `origem_id,destino_id,polyline`, ordenado por `(origem_id, destino_id)` para a saída ser determinística.
5. Arestas sem rota ficam fora do arquivo. No fim, o script informa o total de arestas, quantas ficaram sem rota (listando até 20), o tempo gasto e o tamanho do arquivo.

Detalhes:
- Endereço do GraphHopper: `http://127.0.0.1:8989` por padrão, configurável por argumento. Usar `127.0.0.1` e não `localhost`: no Windows, `localhost` acrescentou ~2,7 s por requisição no spike, porque o IPv6 é tentado primeiro.
- Requisições em paralelo moderado (alguns workers) com o `httpx`, que já é dependência.
- Tamanho estimado do arquivo: **~5 MB**. Se passar muito de 10 MB, a tolerância de simplificação é revista antes do commit.

### Configuração do GraphHopper para a geração

Gerar para o Brasil inteiro sem estourar a memória:
- **Sem Contraction Hierarchies** (`profiles_ch: []`): a fase mais pesada do import fica de fora. As consultas usam a busca comum, suficiente porque cada aresta é curta (média de 33 km em linha reta).
- **Ignorar vias irrelevantes entre cidades** em `import.osm.ignored_highways`: além dos padrões do exemplo (footway, construction, cycleway, path, steps), também residential, service, living_street e pedestrian. A sede do município se encaixa na via principal mais próxima.
- **Grafo em disco** (`graph.dataaccess.default_type: MMAP`) em vez da RAM.
- `routing.non_ch.max_waypoint_distance` e `routing.max_visited_nodes` ajustados para não recusar arestas longas (a maior tem 385 km em linha reta).

A RAM, o tempo de import e o tempo total das ~20 mil consultas são **medidos na primeira tarefa da implementação**. Se o Brasil inteiro não couber nesta máquina (15,7 GB, normalmente com pouca memória livre), o plano B é gerar **por região** do Geofabrik e tratar à parte as arestas que cruzam a divisa entre regiões.

O README documenta o passo a passo: baixar um JDK 21 (ou usar um instalado), o `graphhopper-web-<versão>.jar` e o `brazil-latest.osm.pbf` da Geofabrik, subir o servidor com a configuração acima e rodar o script.

## 4. Backend em execução

### `app/geometrias.py`

```python
Geometrias = dict[tuple[int, int], str]  # (menor_id, maior_id) -> polyline codificada

def carregar_geometrias(caminho: Path = CAMINHO_PADRAO) -> Geometrias
def decodificar(polyline: str) -> list[tuple[float, float]]
def geometria_do_caminho(caminho: list[int], geometrias: Geometrias, grafo: Grafo) -> list[tuple[float, float]]
```

- `carregar_geometrias`: lê o `.csv.gz` com `gzip` e `csv` da biblioteca padrão. As polylines ficam **codificadas** na memória (~5 MB); decodificar as 20 mil de uma vez custaria muito mais em objetos Python. Arquivo inexistente devolve `{}` e registra um aviso com `logging`.
- `decodificar`: algoritmo de polyline do Google, escrito à mão e devolvendo `(lat, lon)`.
- `geometria_do_caminho`: para cada par consecutivo `(a, b)` do caminho:
  - busca `(min(a, b), max(a, b))`; se `a > b`, inverte os pontos decodificados;
  - sem geometria, usa `[(a.lat, a.lon), (b.lat, b.lon)]`, a linha reta;
  - concatena os trechos sem repetir o ponto de junção;
  - arredonda as coordenadas para 5 casas decimais.

  Um caminho de um único município (origem igual ao destino, o que `_validar` já impede) devolve só esse ponto.

### Integração

- `main.py`: `ciclo_de_vida` faz `app.state.geometrias = carregar_geometrias()`. `calcular_rota` preenche `geometria=geometria_do_caminho(t.caminho, geometrias, grafo)` em cada `TrechoOut`.
- `modelos.py`: `TrechoOut.geometria: list[tuple[float, float]]`, sempre preenchida. Os campos atuais, incluindo `caminho`, não mudam.
- Sem o arquivo de geometrias, o app funciona normalmente, com todos os trechos em linha reta.

## 5. Frontend

- `api/cliente.ts`: `Trecho` ganha `geometria: [number, number][]`, no formato `[lat, lon]`.
- `MapaRota.tsx`: `linha` passa a ser `rota.trechos.flatMap((t) => t.geometria)`. O enquadramento (`EnquadrarRota`), os marcadores e os tooltips não mudam.

## 6. Verificação

- **pytest** (`backend/tests/test_geometrias.py`):
  - `decodificar` com o exemplo da documentação do Google (`` _p~iF~ps|U_ulLnnqC_mqNvxq`@ `` → `(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)`);
  - `geometria_do_caminho` com aresta no sentido gravado, no sentido inverso, com aresta faltando (linha reta), com dicionário vazio, e sem repetir o ponto de junção;
  - `carregar_geometrias` com um `.csv.gz` temporário e com arquivo inexistente.
- **Gerador:** primeiro uma amostra de ~50 arestas (conferir formato e tempo), depois a geração completa, com o relatório de cobertura e tamanho.
- **Front:** `tsc`, `eslint` e `npm run build` sem erros; no navegador, uma rota real com o traçado seguindo as estradas.
- **API:** `POST /api/rotas` devolve `geometria` em todos os trechos; sem o arquivo, devolve as linhas retas.
