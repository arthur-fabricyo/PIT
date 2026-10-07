# Sistema de Rotas do Brasil — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o "Sistema de Rotas do Piauí" (HTML único) para React + FastAPI, calculando no backend a melhor rota (ordem ótima + Dijkstra) entre quaisquer municípios do Brasil, com um único comando para preparar e rodar tudo.

**Architecture:** Um script Python gera um SQLite com os 5.571 municípios e as arestas do grafo (6 vizinhos mais próximos + árvore geradora mínima via Kruskal/Union-Find). O FastAPI carrega o grafo em memória e expõe busca (proxy do Nominatim), município mais próximo e cálculo de rota. O front React mostra painel + mapa Leaflet. Scripts Node sem dependências (`scripts/setup.mjs`, `scripts/dev.mjs`) preparam venv/dependências/banco e sobem os dois servidores.

**Tech Stack:** Python ≥ 3.11 (stdlib + FastAPI 0.142.2, uvicorn 0.54.0, httpx 0.28.1), SQLite, React 19 + TypeScript 6 + Vite 8 + ESLint 10, Leaflet 1.9.4 + react-leaflet 5.0.0, Node ≥ 20.19.

**Spec:** `estrutura-de-dados-2/docs/superpowers/specs/2026-10-07-rotas-brasil-design.md`

## Global Constraints

- **Sem testes automatizados** (decisão do usuário). Cada tarefa termina com passos de **verificação manual** com comandos e saída esperada; scripts de verificação rodam via heredoc e **não são commitados**.
- Algoritmos (haversine, Union-Find, Kruskal, Dijkstra, força bruta, vizinho mais próximo, 2-opt) **escritos à mão**, só biblioteca padrão do Python. Proibido numpy, networkx, scipy.
- Dependências Python fixadas: `fastapi==0.142.2`, `uvicorn[standard]==0.54.0`, `httpx==0.28.1`.
- Dependências front fixadas: `leaflet@1.9.4`, `react-leaflet@5.0.0`, `@types/leaflet@1.9.22` (dev).
- Node mínimo **20.19**; Python mínimo **3.11**.
- Limite de **20 destinos**; força bruta até **8 destinos**, heurística acima.
- k-NN: **6** arestas por município; **30** candidatos para o Kruskal.
- Rota **sempre volta à origem**.
- Textos de UI, mensagens de erro da API e dos scripts em **português**.
- Distâncias são **linha reta entre municípios vizinhos** e a UI diz isso.
- Nominatim: só busca ao enviar (sem autocomplete), ≤ 1 req/s, `User-Agent` próprio, cache, `countrycodes=br`.
- Servidores presos em `127.0.0.1`. API padrão na porta 8000 (variável `API_PORT`).
- Todos os caminhos são relativos a `estrutura-de-dados-2/` (abreviado como `ED2/`). A raiz do git é a pasta acima (`PIT/`). Branch de trabalho: `feat/rotas-brasil`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Dois cliques rápidos no mapa** antes das respostas chegarem → os dois pontos entram (o primeiro como origem, o segundo como destino); nenhum sobrescreve o outro. *(Task 5, passo de verificação com rede lenta)*
2. **Usuário muda pontos enquanto "Calculando…"** → a rota que chega depois **não** é exibida, porque não corresponde mais aos pontos. *(Task 5)*
3. **Backend parado** (só o front rodando) → painel mostra "Não foi possível falar com o servidor.", e não "Erro 500". *(Task 5)*
4. **Porta 8000 ocupada** ao rodar `npm run dev` → API sobe na 8001 e o proxy do Vite aponta para ela; o front funciona. *(Task 6)*
5. **Ctrl+C no `npm run dev`** (Windows incluso) → nenhum processo `python`/`uvicorn`/`node vite` fica órfão; portas 8000/5173 ficam livres. *(Task 6)*

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `ED2/.gitignore` | ignora venv, banco gerado, caches, node_modules, dist |
| `ED2/package.json` | só scripts `dev` e `setup`, zero dependências |
| `ED2/scripts/lib/log.mjs` | cores, `ok`/`info`/`falha`, `ErroAmbiente`, `tratarErroFatal` |
| `ED2/scripts/lib/processos.mjs` | `executar`, `executarNpm`, `iniciarServico`, `encerrarArvore`, `primeiraPortaLivre` |
| `ED2/scripts/lib/ambiente.mjs` | caminhos, versões mínimas, achar Python, hashes/carimbos |
| `ED2/scripts/setup.mjs` | `prepararAmbiente()` idempotente |
| `ED2/scripts/dev.mjs` | setup + sobe api/web + encerramento |
| `ED2/legado/grafo-de-municipios.html` | HTML original movido |
| `ED2/backend/requirements.txt` | dependências fixadas |
| `ED2/backend/data/municipios.csv`, `estados.csv` | dados IBGE (kelvins, MIT) |
| `ED2/backend/scripts/construir_banco.py` | gera `rotas.db` |
| `ED2/backend/app/__init__.py` | marca pacote |
| `ED2/backend/app/grafo.py` | `Municipio`, `Grafo` |
| `ED2/backend/app/geo.py` | `haversine`, `mais_proximo` |
| `ED2/backend/app/union_find.py` | `UnionFind` |
| `ED2/backend/app/kruskal.py` | `kruskal` |
| `ED2/backend/app/banco.py` | schema, gravação, `carregar_grafo` |
| `ED2/backend/app/dijkstra.py` | `dijkstra`, `reconstruir_caminho` |
| `ED2/backend/app/melhor_rota.py` | `forca_bruta`, `vizinho_mais_proximo`, `dois_opt`, `melhor_ordem` |
| `ED2/backend/app/planejamento.py` | validação do pedido + matriz de distâncias + trechos (`planejar`) |
| `ED2/backend/app/nominatim.py` | `ClienteNominatim` com rate limit e cache |
| `ED2/backend/app/modelos.py` | schemas Pydantic |
| `ED2/backend/app/main.py` | FastAPI e endpoints |
| `ED2/frontend/vite.config.ts` | proxy `/api` → `API_PORT` |
| `ED2/frontend/src/api/cliente.ts` | tipos + chamadas HTTP + `ErroApi` |
| `ED2/frontend/src/formatacao.ts` | `formatarKm`, `rotuloMunicipio` |
| `ED2/frontend/src/hooks/usePlanejador.ts` | estado via `useReducer` |
| `ED2/frontend/src/components/*.tsx` | 7 componentes (spec §6) |
| `ED2/frontend/src/App.tsx`, `main.tsx`, `index.css` | composição, entrada, estilos |
| `ED2/README.md` | documentação |

> **Desvios conscientes da spec** (já refletidos na spec): `planejamento.py` separa a orquestração do cálculo (Dijkstra + ordem + trechos) de `melhor_rota.py`, que fica só com o problema da ordem sobre a matriz; o hook usa `useReducer` em vez de `useState` porque cliques concorrentes no mapa com `useState` + closures perdem pontos (Review Focus 1); total de municípios é **5.571** (o CSV inclui Boa Esperança do Norte/MT, criado em 2023).

---

### Task 1: Limpeza e base do repositório

**Files:**
- Delete: `ED2/vite-project/` (não versionado)
- Move: `ED2/grafo-de-municipios.html` → `ED2/legado/grafo-de-municipios.html`
- Create: `ED2/.gitignore`
- Commit: `ED2/frontend/` (scaffold React + ESLint já criado)

**Interfaces:**
- Consumes: nada.
- Produces: estrutura de pastas base; `.gitignore` usado por todas as tarefas.

- [ ] **Step 1: Apagar o template vanilla e mover o HTML**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
rm -rf vite-project
mkdir -p legado
git mv grafo-de-municipios.html legado/grafo-de-municipios.html
```

- [ ] **Step 2: Criar `ED2/.gitignore`**

```gitignore
node_modules/
dist/
backend/.venv/
backend/data/rotas.db
backend/data/rotas.db.tmp
__pycache__/
*.pyc
```

- [ ] **Step 3: Remover arquivos de demonstração do template React**

```bash
cd frontend
rm -f src/App.css src/assets/hero.png src/assets/react.svg src/assets/vite.svg public/icons.svg
rmdir src/assets
```

E substituir `frontend/src/App.tsx` por um placeholder mínimo (será reescrito na Task 5) para o build continuar passando:

```tsx
export default function App() {
  return <p>Sistema de Rotas do Brasil</p>
}
```

- [ ] **Step 4: Verificar**

Run: `cd frontend && npm run lint && npm run build`
Expected: lint sem saída de erro; build termina com `✓ built in`.

Run: `git -C .. status --short`
Expected: `R  estrutura-de-dados-2/grafo-de-municipios.html -> estrutura-de-dados-2/legado/grafo-de-municipios.html`, `?? estrutura-de-dados-2/.gitignore`, `?? estrutura-de-dados-2/frontend/`; **nenhum** `vite-project`.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
git add .gitignore frontend legado
git commit -m "chore: base React+TS+ESLint, move HTML original para legado/

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dados, geometria, Union-Find, Kruskal e construção do banco

**Files:**
- Create: `ED2/backend/requirements.txt`
- Create: `ED2/backend/data/municipios.csv`, `ED2/backend/data/estados.csv` (download)
- Create: `ED2/backend/app/__init__.py`, `grafo.py`, `geo.py`, `union_find.py`, `kruskal.py`, `banco.py`
- Create: `ED2/backend/scripts/construir_banco.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `app.grafo.Municipio(id: int, nome: str, uf: str, lat: float, lon: float)` — dataclass congelada.
  - `app.grafo.Grafo` com `municipios: dict[int, Municipio]`, `adicionar_municipio(m)`, `adicionar_aresta(a: int, b: int, peso: float)`, `vizinhos(id) -> list[tuple[int, float]]`, `__len__`.
  - `app.geo.haversine(lat1, lon1, lat2, lon2) -> float` (km); `app.geo.mais_proximo(municipios: Iterable[Municipio], lat, lon) -> Municipio`.
  - `app.union_find.UnionFind(elementos)` com `find(x)`, `union(a, b) -> bool`, atributo `componentes: int`.
  - `app.kruskal.kruskal(vertices, arestas: Iterable[tuple[float, int, int]]) -> tuple[list[tuple[float, int, int]], int]`.
  - `app.banco.CAMINHO_PADRAO: Path`, `criar_schema(con)`, `inserir_municipios(con, municipios)`, `inserir_arestas(con, arestas)`, `carregar_grafo(caminho=CAMINHO_PADRAO) -> Grafo`.
  - Arquivo `backend/data/rotas.db`.

- [ ] **Step 1: `backend/requirements.txt`**

```text
fastapi==0.142.2
uvicorn[standard]==0.54.0
httpx==0.28.1
```

- [ ] **Step 2: Baixar os CSVs (commit fixo do repositório kelvins/municipios-brasileiros, licença MIT)**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2/backend"
mkdir -p data
BASE=https://raw.githubusercontent.com/kelvins/municipios-brasileiros/503e2f70bbf1b4b7ec0b1f68b09086ccc38fe861/csv
curl -fsSL -o data/municipios.csv "$BASE/municipios.csv"
curl -fsSL -o data/estados.csv "$BASE/estados.csv"
head -2 data/municipios.csv; head -2 data/estados.csv
```

Expected: cabeçalho `codigo_ibge,nome,latitude,longitude,capital,codigo_uf,siafi_id,ddd,fuso_horario` e `codigo_uf,uf,nome,latitude,longitude,regiao` (este último com BOM invisível).

- [ ] **Step 3: `backend/app/__init__.py`** (arquivo vazio)

- [ ] **Step 4: `backend/app/grafo.py`**

```python
"""Estruturas básicas: município (vértice) e grafo em lista de adjacência."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Municipio:
    id: int  # código IBGE
    nome: str
    uf: str
    lat: float
    lon: float


class Grafo:
    """Grafo não direcionado e ponderado, representado por lista de adjacência."""

    def __init__(self) -> None:
        self.municipios: dict[int, Municipio] = {}
        self._adjacencia: dict[int, list[tuple[int, float]]] = {}

    def adicionar_municipio(self, municipio: Municipio) -> None:
        self.municipios[municipio.id] = municipio
        self._adjacencia.setdefault(municipio.id, [])

    def adicionar_aresta(self, a: int, b: int, peso: float) -> None:
        self._adjacencia[a].append((b, peso))
        self._adjacencia[b].append((a, peso))

    def vizinhos(self, id_municipio: int) -> list[tuple[int, float]]:
        return self._adjacencia[id_municipio]

    def __len__(self) -> int:
        return len(self.municipios)
```

- [ ] **Step 5: `backend/app/geo.py`**

```python
"""Funções geográficas: distância haversine e município mais próximo."""

import math
from collections.abc import Iterable

from .grafo import Municipio

RAIO_TERRA_KM = 6371.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância em km entre dois pontos (graus) sobre a superfície da Terra."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = phi2 - phi1
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * RAIO_TERRA_KM * math.asin(math.sqrt(a))


def mais_proximo(municipios: Iterable[Municipio], lat: float, lon: float) -> Municipio:
    """Varredura linear O(V): devolve o município mais perto do ponto."""
    return min(municipios, key=lambda m: haversine(lat, lon, m.lat, m.lon))
```

- [ ] **Step 6: `backend/app/union_find.py`**

```python
"""Union-Find (conjuntos disjuntos) com união por rank e compressão de caminho."""

from collections.abc import Hashable, Iterable


class UnionFind:
    def __init__(self, elementos: Iterable[Hashable]) -> None:
        self._pai = {e: e for e in elementos}
        self._rank = dict.fromkeys(self._pai, 0)
        self.componentes = len(self._pai)

    def find(self, x: Hashable) -> Hashable:
        raiz = x
        while self._pai[raiz] != raiz:
            raiz = self._pai[raiz]
        # compressão de caminho: todos no caminho passam a apontar para a raiz
        while self._pai[x] != raiz:
            proximo = self._pai[x]
            self._pai[x] = raiz
            x = proximo
        return raiz

    def union(self, a: Hashable, b: Hashable) -> bool:
        """Une os conjuntos de a e b. Retorna False se já estavam juntos."""
        raiz_a, raiz_b = self.find(a), self.find(b)
        if raiz_a == raiz_b:
            return False
        if self._rank[raiz_a] < self._rank[raiz_b]:
            raiz_a, raiz_b = raiz_b, raiz_a
        self._pai[raiz_b] = raiz_a
        if self._rank[raiz_a] == self._rank[raiz_b]:
            self._rank[raiz_a] += 1
        self.componentes -= 1
        return True
```

- [ ] **Step 7: `backend/app/kruskal.py`**

```python
"""Árvore (floresta) geradora mínima pelo algoritmo de Kruskal."""

from collections.abc import Iterable

from .union_find import UnionFind


def kruskal(
    vertices: Iterable[int], arestas: Iterable[tuple[float, int, int]]
) -> tuple[list[tuple[float, int, int]], int]:
    """Recebe arestas (peso, a, b). Retorna (arestas escolhidas, nº de componentes).

    Com 1 componente, as arestas escolhidas formam uma árvore geradora mínima.
    """
    conjuntos = UnionFind(vertices)
    escolhidas = []
    for peso, a, b in sorted(arestas):
        if conjuntos.union(a, b):
            escolhidas.append((peso, a, b))
    return escolhidas, conjuntos.componentes
```

- [ ] **Step 8: `backend/app/banco.py`**

```python
"""Acesso ao SQLite: criação do schema, gravação e carga do grafo."""

import sqlite3
from collections.abc import Iterable
from pathlib import Path

from .grafo import Grafo, Municipio

CAMINHO_PADRAO = Path(__file__).resolve().parent.parent / "data" / "rotas.db"

SCHEMA = """
CREATE TABLE municipios (
  id        INTEGER PRIMARY KEY,
  nome      TEXT    NOT NULL,
  uf        TEXT    NOT NULL,
  latitude  REAL    NOT NULL,
  longitude REAL    NOT NULL
);

CREATE TABLE arestas (
  origem_id    INTEGER NOT NULL REFERENCES municipios(id),
  destino_id   INTEGER NOT NULL REFERENCES municipios(id),
  distancia_km REAL    NOT NULL,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('knn', 'mst')),
  PRIMARY KEY (origem_id, destino_id),
  CHECK (origem_id < destino_id)
);
"""


def criar_schema(con: sqlite3.Connection) -> None:
    con.executescript(SCHEMA)


def inserir_municipios(con: sqlite3.Connection, municipios: Iterable[Municipio]) -> None:
    con.executemany(
        "INSERT INTO municipios (id, nome, uf, latitude, longitude) VALUES (?, ?, ?, ?, ?)",
        ((m.id, m.nome, m.uf, m.lat, m.lon) for m in municipios),
    )


def inserir_arestas(
    con: sqlite3.Connection, arestas: Iterable[tuple[int, int, float, str]]
) -> None:
    """Cada aresta é (origem_id, destino_id, distancia_km, tipo) com origem_id < destino_id."""
    con.executemany(
        "INSERT INTO arestas (origem_id, destino_id, distancia_km, tipo) VALUES (?, ?, ?, ?)",
        arestas,
    )


def carregar_grafo(caminho: Path = CAMINHO_PADRAO) -> Grafo:
    if not caminho.exists():
        raise FileNotFoundError(
            f"Banco não encontrado em {caminho}. Gere com: python backend/scripts/construir_banco.py"
        )
    # as_uri() codifica espaços/acentos; mode=ro garante que o servidor não altera o banco
    con = sqlite3.connect(caminho.as_uri() + "?mode=ro", uri=True)
    try:
        grafo = Grafo()
        for id_, nome, uf, lat, lon in con.execute(
            "SELECT id, nome, uf, latitude, longitude FROM municipios"
        ):
            grafo.adicionar_municipio(Municipio(id_, nome, uf, lat, lon))
        for a, b, distancia in con.execute(
            "SELECT origem_id, destino_id, distancia_km FROM arestas"
        ):
            grafo.adicionar_aresta(a, b, distancia)
        return grafo
    finally:
        con.close()
```

- [ ] **Step 9: `backend/scripts/construir_banco.py`**

```python
"""Gera backend/data/rotas.db a partir dos CSVs de municípios.

Uso (de qualquer pasta):  python backend/scripts/construir_banco.py
"""

import csv
import heapq
import math
import os
import sqlite3
import sys
import time
from pathlib import Path

RAIZ_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ_BACKEND))

from app.banco import CAMINHO_PADRAO, criar_schema, inserir_arestas, inserir_municipios  # noqa: E402
from app.geo import haversine  # noqa: E402
from app.grafo import Municipio  # noqa: E402
from app.kruskal import kruskal  # noqa: E402

PASTA_DADOS = RAIZ_BACKEND / "data"
K_ARESTAS = 6  # vizinhos que viram arestas do grafo
K_CANDIDATAS = 30  # vizinhos oferecidos ao Kruskal para garantir conectividade


def ler_municipios() -> list[Municipio]:
    with open(PASTA_DADOS / "estados.csv", encoding="utf-8-sig", newline="") as arquivo:
        uf_por_codigo = {int(linha["codigo_uf"]): linha["uf"] for linha in csv.DictReader(arquivo)}
    with open(PASTA_DADOS / "municipios.csv", encoding="utf-8-sig", newline="") as arquivo:
        return [
            Municipio(
                id=int(linha["codigo_ibge"]),
                nome=linha["nome"],
                uf=uf_por_codigo[int(linha["codigo_uf"])],
                lat=float(linha["latitude"]),
                lon=float(linha["longitude"]),
            )
            for linha in csv.DictReader(arquivo)
        ]


def vizinhos_mais_proximos(municipios: list[Municipio], k: int) -> dict[int, list[tuple[float, int]]]:
    """Para cada município, os k mais próximos como (distância_km, id). Força bruta O(n²).

    O laço interno usa a mesma fórmula de geo.haversine sem o asin/sqrt final:
    o termo 'a' cresce junto com a distância, então ordenar por ele dá a mesma ordem.
    Senos e cossenos são pré-calculados para o laço rodar em segundos.
    """
    lats = [math.radians(m.lat) for m in municipios]
    lons = [math.radians(m.lon) for m in municipios]
    cos_lats = [math.cos(x) for x in lats]
    sin = math.sin
    n = len(municipios)
    resultado: dict[int, list[tuple[float, int]]] = {}
    inicio = time.perf_counter()
    for i, origem in enumerate(municipios):
        lat_i, lon_i, cos_i = lats[i], lons[i], cos_lats[i]
        termos = [
            (sin((lats[j] - lat_i) / 2) ** 2 + cos_i * cos_lats[j] * sin((lons[j] - lon_i) / 2) ** 2, j)
            for j in range(n)
            if j != i
        ]
        resultado[origem.id] = [
            (haversine(origem.lat, origem.lon, municipios[j].lat, municipios[j].lon), municipios[j].id)
            for _, j in heapq.nsmallest(k, termos)
        ]
        if (i + 1) % 500 == 0 or i + 1 == n:
            print(f"  vizinhos: {i + 1}/{n} ({time.perf_counter() - inicio:.0f}s)", flush=True)
    return resultado


def par(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def construir(destino: Path = CAMINHO_PADRAO) -> None:
    inicio = time.perf_counter()
    municipios = ler_municipios()
    print(f"{len(municipios)} municípios lidos dos CSVs", flush=True)

    candidatos = vizinhos_mais_proximos(municipios, K_CANDIDATAS)

    arestas: dict[tuple[int, int], tuple[float, str]] = {}
    for origem_id, lista in candidatos.items():
        for distancia, destino_id in lista[:K_ARESTAS]:
            arestas[par(origem_id, destino_id)] = (distancia, "knn")

    candidatas = {
        par(origem_id, destino_id): distancia
        for origem_id, lista in candidatos.items()
        for distancia, destino_id in lista
    }
    arvore, componentes = kruskal(
        (m.id for m in municipios),
        ((distancia, a, b) for (a, b), distancia in candidatas.items()),
    )
    if componentes != 1:
        raise SystemExit(
            f"Erro: mesmo com {K_CANDIDATAS} vizinhos candidatos o grafo ficou com "
            f"{componentes} componentes. Aumente K_CANDIDATAS em construir_banco.py."
        )
    novas_mst = 0
    for distancia, a, b in arvore:
        if (a, b) not in arestas:
            arestas[(a, b)] = (distancia, "mst")
            novas_mst += 1

    destino.parent.mkdir(parents=True, exist_ok=True)
    temporario = destino.with_name(destino.name + ".tmp")
    temporario.unlink(missing_ok=True)
    con = sqlite3.connect(temporario)
    try:
        with con:
            criar_schema(con)
            inserir_municipios(con, municipios)
            inserir_arestas(con, ((a, b, d, tipo) for (a, b), (d, tipo) in arestas.items()))
    finally:
        con.close()
    os.replace(temporario, destino)  # troca atômica: build interrompido não deixa banco pela metade

    print(
        f"Banco gerado em {destino}\n"
        f"  municípios: {len(municipios)}\n"
        f"  arestas knn: {len(arestas) - novas_mst}\n"
        f"  arestas mst (extras para conectar): {novas_mst}\n"
        f"  componentes: {componentes}\n"
        f"  tempo: {time.perf_counter() - inicio:.1f}s"
    )


if __name__ == "__main__":
    construir()
```

- [ ] **Step 10: Gerar o banco (Python do sistema basta — só stdlib)**

Run: `cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2" && python backend/scripts/construir_banco.py`
Expected: `5571 municípios lidos dos CSVs`, progresso de 500 em 500, e no fim `municípios: 5571`, `componentes: 1`, tempo ~15–40 s. Arquivo `backend/data/rotas.db` existe; `backend/data/rotas.db.tmp` não.

- [ ] **Step 11: Verificar dados, acentos e conectividade (não commitar este script)**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2/backend"
python - <<'EOF'
import sqlite3
from app.banco import carregar_grafo
from app.geo import haversine, mais_proximo
con = sqlite3.connect("data/rotas.db")
print(con.execute("SELECT nome, uf FROM municipios WHERE id = 2210003").fetchone())
print(con.execute("SELECT tipo, COUNT(*) FROM arestas GROUP BY tipo").fetchall())
print(con.execute("SELECT COUNT(*) FROM arestas WHERE origem_id >= destino_id").fetchone())
g = carregar_grafo()
print(len(g), min(len(g.vizinhos(i)) for i in g.municipios))
t, p = g.municipios[2211001], g.municipios[2207702]
print(round(haversine(t.lat, t.lon, p.lat, p.lon)))
print(mais_proximo(g.municipios.values(), -5.09, -42.80).nome)
EOF
```

Expected:
- `('São João do Piauí', 'PI')` — acentos corretos.
- lista com `('knn', ...)` e `('mst', ...)` (mst pode ser pequena).
- `(0,)` — nenhuma aresta invertida.
- `5571 6` ou mais (todo município tem ≥ 6 vizinhos).
- `~300`-ish km (Teresina–Parnaíba em linha reta, valor entre 280 e 330).
- `Teresina`.

- [ ] **Step 12: Commit**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
git add backend/requirements.txt backend/data/municipios.csv backend/data/estados.csv backend/app backend/scripts
git status --short   # rotas.db NÃO deve aparecer
git commit -m "feat(backend): dados dos municípios e construção do grafo em SQLite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dijkstra, melhor ordem de visita e planejamento

**Files:**
- Create: `ED2/backend/app/dijkstra.py`, `melhor_rota.py`, `planejamento.py`

**Interfaces:**
- Consumes: `Grafo`, `Municipio` (Task 2).
- Produces:
  - `app.dijkstra.dijkstra(grafo: Grafo, origem: int) -> tuple[dict[int, float], dict[int, int | None]]` (distâncias e anterior; só contém vértices alcançados).
  - `app.dijkstra.reconstruir_caminho(anterior: dict[int, int | None], destino: int) -> list[int]` (vazio se inalcançável).
  - `app.melhor_rota.LIMITE_FORCA_BRUTA = 8`; `custo_ciclo(matriz, ordem) -> float`; `forca_bruta(matriz) -> list[int]`; `vizinho_mais_proximo(matriz) -> list[int]`; `dois_opt(matriz, ordem) -> list[int]`; `melhor_ordem(matriz) -> tuple[list[int], str]` — ordens são índices da matriz começando em 0 (origem), **sem** repetir o 0 no fim; `str` ∈ `"forca_bruta" | "heuristica"`.
  - `app.planejamento.LIMITE_DESTINOS = 20`; `ErroPlanejamento(mensagem: str, status: int = 400)` com atributos `mensagem`, `status`; dataclasses `Trecho(de: int, para: int, distancia_km: float, caminho: list[int])` e `Plano(ordem: list[int], trechos: list[Trecho], distancia_total_km: float, metodo: str)`; `planejar(grafo, origem_id: int, destinos_ids: list[int]) -> Plano` — `Plano.ordem` começa e termina na origem (ids IBGE).

- [ ] **Step 1: `backend/app/dijkstra.py`**

```python
"""Menor caminho a partir de uma origem (Dijkstra com fila de prioridade)."""

import heapq
import math

from .grafo import Grafo


def dijkstra(grafo: Grafo, origem: int) -> tuple[dict[int, float], dict[int, int | None]]:
    """Retorna (distância mínima até cada vértice alcançado, vértice anterior no caminho).

    Usa heapq com "remoção preguiçosa": entradas velhas da fila são ignoradas
    quando o vértice já foi finalizado. Complexidade O((V + E) log V).
    """
    distancia: dict[int, float] = {origem: 0.0}
    anterior: dict[int, int | None] = {origem: None}
    fila: list[tuple[float, int]] = [(0.0, origem)]
    finalizados: set[int] = set()

    while fila:
        dist_atual, atual = heapq.heappop(fila)
        if atual in finalizados:
            continue
        finalizados.add(atual)
        for vizinho, peso in grafo.vizinhos(atual):
            nova = dist_atual + peso
            if nova < distancia.get(vizinho, math.inf):
                distancia[vizinho] = nova
                anterior[vizinho] = atual
                heapq.heappush(fila, (nova, vizinho))

    return distancia, anterior


def reconstruir_caminho(anterior: dict[int, int | None], destino: int) -> list[int]:
    """Caminho da origem do Dijkstra até destino, seguindo 'anterior' de trás para frente."""
    if destino not in anterior:
        return []
    caminho = []
    atual: int | None = destino
    while atual is not None:
        caminho.append(atual)
        atual = anterior[atual]
    caminho.reverse()
    return caminho
```

- [ ] **Step 2: `backend/app/melhor_rota.py`**

```python
"""Ordem de visita que minimiza o ciclo origem → destinos → origem (caixeiro-viajante).

Trabalha só com a matriz de distâncias: matriz[i][j] é a menor distância do
ponto i ao ponto j. O índice 0 é sempre a origem e fica fixo no início.
"""

import itertools
import math

LIMITE_FORCA_BRUTA = 8  # destinos; 8! = 40.320 ordens
EPSILON = 1e-9


def custo_ciclo(matriz: list[list[float]], ordem: list[int]) -> float:
    """Custo de percorrer ordem[0] → ... → ordem[-1] → ordem[0]."""
    return sum(matriz[ordem[i]][ordem[(i + 1) % len(ordem)]] for i in range(len(ordem)))


def forca_bruta(matriz: list[list[float]]) -> list[int]:
    """Testa todas as permutações dos destinos. Ótimo garantido, O(n!)."""
    melhor_ordem: list[int] = []
    melhor_custo = math.inf
    for permutacao in itertools.permutations(range(1, len(matriz))):
        ordem = [0, *permutacao]
        custo = custo_ciclo(matriz, ordem)
        if custo < melhor_custo:
            melhor_ordem, melhor_custo = ordem, custo
    return melhor_ordem


def vizinho_mais_proximo(matriz: list[list[float]]) -> list[int]:
    """Heurística gulosa: a partir da origem, vai sempre ao destino não visitado mais perto."""
    ordem = [0]
    restantes = set(range(1, len(matriz)))
    while restantes:
        distancias_do_ultimo = matriz[ordem[-1]]
        proximo = min(restantes, key=distancias_do_ultimo.__getitem__)
        ordem.append(proximo)
        restantes.remove(proximo)
    return ordem


def dois_opt(matriz: list[list[float]], ordem: list[int]) -> list[int]:
    """Melhoria local: inverte trechos da rota enquanto isso diminuir o custo.

    Trocar as arestas (a,b) e (c,d) por (a,c) e (b,d) equivale a inverter o
    trecho b..c. A origem (posição 0) nunca sai do lugar.
    """
    ordem = list(ordem)
    n = len(ordem)
    melhorou = True
    while melhorou:
        melhorou = False
        for i in range(1, n - 1):
            for j in range(i + 1, n):
                a, b = ordem[i - 1], ordem[i]
                c, d = ordem[j], ordem[(j + 1) % n]
                ganho = matriz[a][c] + matriz[b][d] - matriz[a][b] - matriz[c][d]
                if ganho < -EPSILON:
                    ordem[i : j + 1] = reversed(ordem[i : j + 1])
                    melhorou = True
    return ordem


def melhor_ordem(matriz: list[list[float]]) -> tuple[list[int], str]:
    if len(matriz) - 1 <= LIMITE_FORCA_BRUTA:
        return forca_bruta(matriz), "forca_bruta"
    return dois_opt(matriz, vizinho_mais_proximo(matriz)), "heuristica"
```

- [ ] **Step 3: `backend/app/planejamento.py`**

```python
"""Planeja a rota completa: valida o pedido, monta a matriz e reconstrói os trechos."""

from dataclasses import dataclass

from .dijkstra import dijkstra, reconstruir_caminho
from .grafo import Grafo
from .melhor_rota import melhor_ordem

LIMITE_DESTINOS = 20


class ErroPlanejamento(Exception):
    def __init__(self, mensagem: str, status: int = 400) -> None:
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status


@dataclass
class Trecho:
    de: int
    para: int
    distancia_km: float
    caminho: list[int]


@dataclass
class Plano:
    ordem: list[int]  # ids IBGE; começa e termina na origem
    trechos: list[Trecho]
    distancia_total_km: float
    metodo: str


def _validar(grafo: Grafo, origem_id: int, destinos_ids: list[int]) -> None:
    if not destinos_ids:
        raise ErroPlanejamento("Adicione pelo menos um destino.")
    if len(destinos_ids) > LIMITE_DESTINOS:
        raise ErroPlanejamento(f"No máximo {LIMITE_DESTINOS} destinos por rota.")
    for id_ in (origem_id, *destinos_ids):
        if id_ not in grafo.municipios:
            raise ErroPlanejamento(f"Município não encontrado: {id_}.", 404)
    if origem_id in destinos_ids:
        raise ErroPlanejamento("A origem não pode estar na lista de destinos.")
    if len(set(destinos_ids)) != len(destinos_ids):
        raise ErroPlanejamento("Há destinos repetidos.")


def planejar(grafo: Grafo, origem_id: int, destinos_ids: list[int]) -> Plano:
    _validar(grafo, origem_id, destinos_ids)
    pontos = [origem_id, *destinos_ids]

    # um Dijkstra por ponto; guardamos 'anterior' para reconstruir os caminhos depois
    buscas = [dijkstra(grafo, ponto) for ponto in pontos]
    matriz: list[list[float]] = []
    for i, (distancia, _) in enumerate(buscas):
        linha = []
        for ponto in pontos:
            if ponto not in distancia:
                de, para = grafo.municipios[pontos[i]], grafo.municipios[ponto]
                raise ErroPlanejamento(
                    f"Não existe caminho entre {de.nome} ({de.uf}) e {para.nome} ({para.uf}).", 500
                )
            linha.append(distancia[ponto])
        matriz.append(linha)

    indices, metodo = melhor_ordem(matriz)
    ciclo = [*indices, 0]
    trechos = []
    for i, j in zip(ciclo, ciclo[1:]):
        distancia, anterior = buscas[i]
        trechos.append(
            Trecho(
                de=pontos[i],
                para=pontos[j],
                distancia_km=distancia[pontos[j]],
                caminho=reconstruir_caminho(anterior, pontos[j]),
            )
        )
    return Plano(
        ordem=[pontos[i] for i in ciclo],
        trechos=trechos,
        distancia_total_km=sum(t.distancia_km for t in trechos),
        metodo=metodo,
    )
```

- [ ] **Step 4: Verificar Dijkstra com o grafo do HTML original (valores calculados à mão; não commitar)**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2/backend"
python - <<'EOF'
from app.grafo import Grafo, Municipio
from app.dijkstra import dijkstra, reconstruir_caminho
from app.planejamento import planejar, ErroPlanejamento
arestas = [("Teresina","União",65),("Teresina","José de Freitas",54.1),("Teresina","Altos",42.1),
 ("Teresina","Nazária",31.1),("Teresina","Demerval Lobão",34.7),("União","Lagoa Alegre",33.6),
 ("Lagoa Alegre","José de Freitas",32.0),("José de Freitas","Altos",55.6),
 ("José de Freitas","Cabeceiras do Piauí",48.5),("Cabeceiras do Piauí","Campo Maior",46.2),
 ("Campo Maior","Nossa Senhora de Nazaré",28.4),("Campo Maior","Cocal de Telha",41.0),
 ("Campo Maior","Altos",42.0),("Campo Maior","Coivaras",32.7),("Altos","Coivaras",30.8),
 ("Altos","Alto Longá",46.9),("Altos","Beneditinos",54.2),("Coivaras","Alto Longá",19.6),
 ("Alto Longá","Beneditinos",50.5),("Demerval Lobão","Monsenhor Gil",27.0)]
nomes = sorted({n for a,b,_ in arestas for n in (a,b)})
ids = {n: i for i, n in enumerate(nomes, 1)}
g = Grafo()
for n, i in ids.items(): g.adicionar_municipio(Municipio(i, n, "PI", 0, 0))
for a, b, p in arestas: g.adicionar_aresta(ids[a], ids[b], p)
dist, ant = dijkstra(g, ids["Teresina"])
for destino in ["Campo Maior","Beneditinos","Alto Longá","Monsenhor Gil","Cocal de Telha"]:
    print(destino, round(dist[ids[destino]], 1))
print([nomes[i-1] for i in reconstruir_caminho(ant, ids["Cocal de Telha"])])
g.adicionar_municipio(Municipio(99, "Ilha", "PI", 0, 0))
print(reconstruir_caminho(dijkstra(g, ids["Teresina"])[1], 99))
p = planejar(g, ids["Teresina"], [ids["Cocal de Telha"], ids["Monsenhor Gil"]])
print(round(p.distancia_total_km, 1), p.metodo, p.ordem[0] == p.ordem[-1] == ids["Teresina"])
for args in [(ids["Teresina"], []), (ids["Teresina"], [ids["Teresina"]]), (ids["Teresina"], [1, 1]),
             (ids["Teresina"], [12345]), (ids["Teresina"], [99])]:
    try: planejar(g, *args)
    except ErroPlanejamento as e: print(e.status, e.mensagem)
EOF
```

Expected:
```
Campo Maior 84.1
Beneditinos 96.3
Alto Longá 89.0
Monsenhor Gil 61.7
Cocal de Telha 125.1
['Teresina', 'Altos', 'Campo Maior', 'Cocal de Telha']
[]
373.6 forca_bruta True
400 Adicione pelo menos um destino.
400 A origem não pode estar na lista de destinos.
400 Há destinos repetidos.
404 Município não encontrado: 12345.
500 Não existe caminho entre Teresina (PI) e Ilha (PI).
```
(Os ids seguem a ordem alfabética: o id 1 é "Alto Longá", por isso `[1, 1]` testa destinos repetidos.)

- [ ] **Step 5: Verificar força bruta × heurística (não commitar)**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2/backend"
python - <<'EOF'
import random, math
from app.melhor_rota import forca_bruta, vizinho_mais_proximo, dois_opt, custo_ciclo, melhor_ordem
random.seed(42)
piores = 0
for _ in range(300):
    n = random.randint(2, 9)
    pts = [(random.random()*100, random.random()*100) for _ in range(n)]
    m = [[math.dist(a, b) for b in pts] for a in pts]
    otimo = custo_ciclo(m, forca_bruta(m))
    vmp = vizinho_mais_proximo(m)
    opt = dois_opt(m, vmp)
    assert sorted(opt) == list(range(n)) and opt[0] == 0
    assert custo_ciclo(m, opt) <= custo_ciclo(m, vmp) + 1e-9, "2-opt piorou"
    assert custo_ciclo(m, opt) >= otimo - 1e-9, "heurística melhor que o ótimo = bug"
    piores = max(piores, custo_ciclo(m, opt) / otimo)
print("ok; pior razão heurística/ótimo:", round(piores, 3))
pts = [(random.random()*100, random.random()*100) for _ in range(21)]
m = [[math.dist(a, b) for b in pts] for a in pts]
def recorte(k): return [linha[:k] for linha in m[:k]]
print(melhor_ordem(recorte(9))[1], melhor_ordem(recorte(10))[1], melhor_ordem(m)[1])
EOF
```

Expected: `ok; pior razão heurística/ótimo: 1.0xx` (abaixo de ~1.15) e `forca_bruta heuristica heuristica` (9 pontos = 8 destinos → força bruta; 10 pontos = 9 destinos → heurística).

- [ ] **Step 6: Verificar no grafo real (tempo e coerência; não commitar)**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2/backend"
python - <<'EOF'
import time
from app.banco import carregar_grafo
from app.planejamento import planejar
g = carregar_grafo()
t = time.perf_counter()
p = planejar(g, 2211001, [2207702, 2208007, 2203909])  # Teresina → Parnaíba, Picos, Floriano
print(p.metodo, round(p.distancia_total_km), [g.municipios[i].nome for i in p.ordem], f"{time.perf_counter()-t:.2f}s")
t = time.perf_counter()
p = planejar(g, 4314902, [1302603, 2605459, 3550308])  # Porto Alegre → Manaus, Noronha, SP
print(p.metodo, round(p.distancia_total_km), len(p.trechos[0].caminho), f"{time.perf_counter()-t:.2f}s")
EOF
```

Expected: linha 1 `forca_bruta <~900–1300> ['Teresina', ..., 'Teresina']`, tempo < 1 s. Linha 2 `forca_bruta <~9000–13000> <dezenas> <tempo < 2s>` — Fernando de Noronha alcançável (prova da conectividade).

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
git add backend/app/dijkstra.py backend/app/melhor_rota.py backend/app/planejamento.py
git commit -m "feat(backend): Dijkstra, melhor ordem de visita e planejamento da rota

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: API FastAPI + cliente Nominatim

**Files:**
- Create: `ED2/backend/app/nominatim.py`, `modelos.py`, `main.py`

**Interfaces:**
- Consumes: `carregar_grafo`, `mais_proximo`, `Municipio`, `planejar`, `ErroPlanejamento` (Tasks 2–3).
- Produces: HTTP (contrato exato que o front usa na Task 5):
  - `GET /api/busca?q=` → `200 [{rotulo, lat, lon, municipio: {id, nome, uf, lat, lon}}]`; `400` se `q` < 2 chars; `502` se Nominatim falhar.
  - `GET /api/municipios/proximo?lat=&lon=` → `200 {id, nome, uf, lat, lon}`; `422` fora da faixa.
  - `POST /api/rotas` body `{origem_id, destinos_ids}` → `200 {distancia_total_km, metodo, ordem: Municipio[], trechos: [{de, para, distancia_km, caminho: Municipio[]}]}`; erros `{detail: string}` com 400/404/500.

- [ ] **Step 1: Criar a venv manualmente (a Task 6 automatiza isso depois)**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2/backend"
python -m venv .venv
.venv/Scripts/python.exe -m pip install --disable-pip-version-check -r requirements.txt   # Linux/Mac: .venv/bin/python
```

Expected: `Successfully installed ... fastapi-0.142.2 ... httpx-0.28.1 ... uvicorn-0.54.0`.

- [ ] **Step 2: `backend/app/nominatim.py`**

```python
"""Cliente do Nominatim (OpenStreetMap) respeitando a política de uso.

Política: https://operations.osmfoundation.org/policies/nominatim/
- no máximo 1 requisição por segundo;
- User-Agent identificando a aplicação;
- resultados repetidos devem vir de cache;
- sem autocomplete (o front só busca ao enviar).
"""

import asyncio
import os
import time
from collections import OrderedDict
from dataclasses import dataclass

import httpx

URL_BUSCA = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "RotasBrasil/1.0 (trabalho academico de Estrutura de Dados II)"
INTERVALO_MINIMO_S = 1.0
TAMANHO_CACHE = 256
TIMEOUT_S = 10.0


@dataclass(frozen=True)
class LugarEncontrado:
    rotulo: str
    lat: float
    lon: float


class NominatimIndisponivel(Exception):
    pass


class ClienteNominatim:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=TIMEOUT_S, headers={"User-Agent": USER_AGENT})
        self._trava = asyncio.Lock()
        self._ultima_requisicao = 0.0
        self._cache: OrderedDict[str, list[LugarEncontrado]] = OrderedDict()

    def _do_cache(self, chave: str) -> list[LugarEncontrado] | None:
        if chave in self._cache:
            self._cache.move_to_end(chave)
            return self._cache[chave]
        return None

    async def buscar(self, texto: str) -> list[LugarEncontrado]:
        chave = " ".join(texto.lower().split())
        if (em_cache := self._do_cache(chave)) is not None:
            return em_cache

        async with self._trava:  # serializa as chamadas para respeitar 1 req/s
            if (em_cache := self._do_cache(chave)) is not None:
                return em_cache
            espera = INTERVALO_MINIMO_S - (time.monotonic() - self._ultima_requisicao)
            if espera > 0:
                await asyncio.sleep(espera)
            parametros = {
                "q": texto,
                "format": "jsonv2",
                "countrycodes": "br",
                "limit": 5,
                "accept-language": "pt-BR",
            }
            if email := os.environ.get("NOMINATIM_EMAIL"):
                parametros["email"] = email
            try:
                resposta = await self._http.get(URL_BUSCA, params=parametros)
                resposta.raise_for_status()
                dados = resposta.json()
                lugares = [
                    LugarEncontrado(item["display_name"], float(item["lat"]), float(item["lon"]))
                    for item in dados
                ]
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as erro:
                raise NominatimIndisponivel() from erro
            finally:
                self._ultima_requisicao = time.monotonic()

        self._cache[chave] = lugares
        if len(self._cache) > TAMANHO_CACHE:
            self._cache.popitem(last=False)
        return lugares

    async def fechar(self) -> None:
        await self._http.aclose()
```

- [ ] **Step 3: `backend/app/modelos.py`**

```python
"""Schemas de entrada e saída da API (validação e documentação em /docs)."""

from typing import Literal

from pydantic import BaseModel

from .grafo import Municipio


class MunicipioOut(BaseModel):
    id: int
    nome: str
    uf: str
    lat: float
    lon: float

    @classmethod
    def de(cls, municipio: Municipio) -> "MunicipioOut":
        return cls(
            id=municipio.id, nome=municipio.nome, uf=municipio.uf, lat=municipio.lat, lon=municipio.lon
        )


class ResultadoBusca(BaseModel):
    rotulo: str
    lat: float
    lon: float
    municipio: MunicipioOut


class PedidoRota(BaseModel):
    origem_id: int
    destinos_ids: list[int]


class TrechoOut(BaseModel):
    de: MunicipioOut
    para: MunicipioOut
    distancia_km: float
    caminho: list[MunicipioOut]


class RotaOut(BaseModel):
    distancia_total_km: float
    metodo: Literal["forca_bruta", "heuristica"]
    ordem: list[MunicipioOut]
    trechos: list[TrechoOut]
```

- [ ] **Step 4: `backend/app/main.py`**

```python
"""API do Sistema de Rotas do Brasil."""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request

from .banco import carregar_grafo
from .geo import mais_proximo
from .grafo import Grafo
from .modelos import MunicipioOut, PedidoRota, ResultadoBusca, RotaOut, TrechoOut
from .nominatim import ClienteNominatim, NominatimIndisponivel
from .planejamento import ErroPlanejamento, planejar


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    app.state.grafo = carregar_grafo()
    app.state.nominatim = ClienteNominatim()
    yield
    await app.state.nominatim.fechar()


app = FastAPI(
    title="Rotas do Brasil",
    description="Melhor rota entre municípios brasileiros usando grafos (Estrutura de Dados II).",
    lifespan=ciclo_de_vida,
)


def _grafo(request: Request) -> Grafo:
    return request.app.state.grafo


@app.get("/api/busca", response_model=list[ResultadoBusca])
async def buscar(request: Request, q: Annotated[str, Query(max_length=200)]):
    texto = q.strip()
    if len(texto) < 2:
        raise HTTPException(400, "Digite pelo menos 2 caracteres para buscar.")
    try:
        lugares = await request.app.state.nominatim.buscar(texto)
    except NominatimIndisponivel:
        raise HTTPException(502, "Busca indisponível no momento; tente clicar no mapa.") from None
    municipios = _grafo(request).municipios.values()
    return [
        ResultadoBusca(
            rotulo=lugar.rotulo,
            lat=lugar.lat,
            lon=lugar.lon,
            municipio=MunicipioOut.de(mais_proximo(municipios, lugar.lat, lugar.lon)),
        )
        for lugar in lugares
    ]


@app.get("/api/municipios/proximo", response_model=MunicipioOut)
def municipio_proximo(
    request: Request,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
):
    return MunicipioOut.de(mais_proximo(_grafo(request).municipios.values(), lat, lon))


@app.post("/api/rotas", response_model=RotaOut)
def calcular_rota(request: Request, pedido: PedidoRota):
    grafo = _grafo(request)
    try:
        plano = planejar(grafo, pedido.origem_id, pedido.destinos_ids)
    except ErroPlanejamento as erro:
        raise HTTPException(erro.status, erro.mensagem) from None

    def municipio(id_: int) -> MunicipioOut:
        return MunicipioOut.de(grafo.municipios[id_])

    return RotaOut(
        distancia_total_km=plano.distancia_total_km,
        metodo=plano.metodo,
        ordem=[municipio(i) for i in plano.ordem],
        trechos=[
            TrechoOut(
                de=municipio(t.de),
                para=municipio(t.para),
                distancia_km=t.distancia_km,
                caminho=[municipio(i) for i in t.caminho],
            )
            for t in plano.trechos
        ],
    )
```

- [ ] **Step 5: Subir a API para verificação**

Run (em background): `cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
Expected: `Application startup complete.` e `Uvicorn running on http://127.0.0.1:8000`.

- [ ] **Step 6: Verificar endpoints com curl**

```bash
A=http://127.0.0.1:8000
curl -s "$A/api/municipios/proximo?lat=-5.09&lon=-42.80"; echo
curl -s -o /dev/null -w "%{http_code}\n" "$A/api/municipios/proximo?lat=95&lon=0"
curl -s -X POST "$A/api/rotas" -H "Content-Type: application/json" \
  -d '{"origem_id":2211001,"destinos_ids":[2207702,2208007,2203909]}' \
  | python -c "import json,sys; r=json.load(sys.stdin); print(r['metodo'], round(r['distancia_total_km']), [m['nome'] for m in r['ordem']])"
for body in '{"origem_id":2211001,"destinos_ids":[]}' \
            '{"origem_id":2211001,"destinos_ids":[2211001]}' \
            '{"origem_id":2211001,"destinos_ids":[2207702,2207702]}' \
            '{"origem_id":2211001,"destinos_ids":[1]}' \
            "{\"origem_id\":2211001,\"destinos_ids\":[$(seq -s, 2200000 2200020)]}"; do
  curl -s -w "  %{http_code}\n" -X POST "$A/api/rotas" -H "Content-Type: application/json" -d "$body"
done
curl -s "$A/api/busca?q=Parna%C3%ADba" | python -c "import json,sys; r=json.load(sys.stdin); print(len(r), r[0]['municipio']['nome'] if r else '-')"
curl -s "$A/api/busca?q=Parna%C3%ADba" -o /dev/null -w "%{time_total}s (cache)\n"
curl -s -w "  %{http_code}\n" "$A/api/busca?q=a"
curl -s -o /dev/null -w "%{http_code} /docs\n" "$A/docs"
```

Expected:
- `{"id":2211001,"nome":"Teresina","uf":"PI",...}`
- `422`
- `forca_bruta <~900–1300> ['Teresina', ..., 'Teresina']`
- `{"detail":"Adicione pelo menos um destino."}  400`
- `{"detail":"A origem não pode estar na lista de destinos."}  400`
- `{"detail":"Há destinos repetidos."}  400`
- `{"detail":"Município não encontrado: 1."}  404`
- `{"detail":"No máximo 20 destinos por rota."}  400`
- `>=1 Parnaíba`
- tempo da segunda busca bem menor que 0,1 s (cache)
- `{"detail":"Digite pelo menos 2 caracteres para buscar."}  400`
- `200 /docs`

- [ ] **Step 7: Verificar o 502 (Nominatim inalcançável)**

Pare a API, suba de novo com proxy inválido para simular rede fora: `HTTPS_PROXY=http://127.0.0.1:9 .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`, rode `curl -s -w "  %{http_code}\n" "http://127.0.0.1:8000/api/busca?q=Picos"`.
Expected: `{"detail":"Busca indisponível no momento; tente clicar no mapa."}  502`. Depois pare a API.

- [ ] **Step 8: Commit**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
git add backend/app/nominatim.py backend/app/modelos.py backend/app/main.py
git commit -m "feat(backend): API FastAPI com busca Nominatim, município mais próximo e rotas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Front React — cliente da API, estado, componentes e mapa

**Files:**
- Modify: `ED2/frontend/package.json` (deps), `ED2/frontend/vite.config.ts`, `ED2/frontend/index.html`, `ED2/frontend/src/main.tsx`, `ED2/frontend/src/App.tsx`, `ED2/frontend/src/index.css`
- Create: `ED2/frontend/src/api/cliente.ts`, `src/formatacao.ts`, `src/hooks/usePlanejador.ts`, `src/components/Cabecalho.tsx`, `PainelPlanejamento.tsx`, `BuscaLocal.tsx`, `SeletorModo.tsx`, `ListaPontos.tsx`, `ResultadoRota.tsx`, `MapaRota.tsx`

**Interfaces:**
- Consumes: contrato HTTP da Task 4.
- Produces: `vite.config.ts` lê `process.env.API_PORT` (padrão `8000`) — usado pela Task 6.

- [ ] **Step 1: Instalar Leaflet**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2/frontend"
npm install leaflet@1.9.4 react-leaflet@5.0.0
npm install -D @types/leaflet@1.9.22
```

- [ ] **Step 2: `frontend/vite.config.ts`**

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O scripts/dev.mjs define API_PORT quando a 8000 está ocupada.
const portaApi = process.env.API_PORT ?? '8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${portaApi}`,
    },
  },
})
```

- [ ] **Step 3: `frontend/index.html`** — trocar `lang="en"` por `lang="pt-BR"` e `<title>frontend</title>` por `<title>Rotas do Brasil</title>`.

- [ ] **Step 4: `frontend/src/api/cliente.ts`**

```ts
export interface Municipio {
  id: number
  nome: string
  uf: string
  lat: number
  lon: number
}

export interface ResultadoBusca {
  rotulo: string
  lat: number
  lon: number
  municipio: Municipio
}

export interface Trecho {
  de: Municipio
  para: Municipio
  distancia_km: number
  caminho: Municipio[]
}

export interface Rota {
  distancia_total_km: number
  metodo: 'forca_bruta' | 'heuristica'
  ordem: Municipio[]
  trechos: Trecho[]
}

export class ErroApi extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
  }
}

const SEM_SERVIDOR = 'Não foi possível falar com o servidor.'

async function requisitar<T>(url: string, init?: RequestInit): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(url, init)
  } catch {
    throw new ErroApi(SEM_SERVIDOR)
  }
  if (resposta.ok) return (await resposta.json()) as T

  // O FastAPI sempre responde erros em JSON ({ detail }). Corpo que não é JSON
  // vem do proxy do Vite quando o backend está fora do ar.
  let corpo: unknown
  try {
    corpo = await resposta.json()
  } catch {
    throw new ErroApi(SEM_SERVIDOR)
  }
  const detalhe = (corpo as { detail?: unknown } | null)?.detail
  throw new ErroApi(typeof detalhe === 'string' ? detalhe : `Erro ${resposta.status} no servidor.`)
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Erro inesperado.'
}

export function buscarLocal(texto: string): Promise<ResultadoBusca[]> {
  return requisitar(`/api/busca?q=${encodeURIComponent(texto)}`)
}

export function municipioProximo(lat: number, lon: number): Promise<Municipio> {
  return requisitar(`/api/municipios/proximo?lat=${lat}&lon=${lon}`)
}

export function calcularRota(origemId: number, destinosIds: number[]): Promise<Rota> {
  return requisitar('/api/rotas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origem_id: origemId, destinos_ids: destinosIds }),
  })
}
```

- [ ] **Step 5: `frontend/src/formatacao.ts`**

```ts
import type { Municipio } from './api/cliente'

export function formatarKm(km: number): string {
  return `${km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

export function rotuloMunicipio(municipio: Municipio): string {
  return `${municipio.nome} (${municipio.uf})`
}
```

- [ ] **Step 6: `frontend/src/hooks/usePlanejador.ts`**

```ts
import { useReducer } from 'react'
import { calcularRota, mensagemDeErro, municipioProximo } from '../api/cliente'
import type { Municipio, Rota } from '../api/cliente'

export type Modo = 'origem' | 'destino'

export const LIMITE_DESTINOS = 20

export interface EstadoPlanejador {
  origem: Municipio | null
  destinos: Municipio[]
  modo: Modo
  rota: Rota | null
  erro: string
  calculando: boolean
}

type Acao =
  | { tipo: 'adicionar'; municipio: Municipio }
  | { tipo: 'remover'; id: number }
  | { tipo: 'mudarModo'; modo: Modo }
  | { tipo: 'limpar' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'calculoIniciado' }
  | { tipo: 'calculoConcluido'; rota: Rota; chave: string }
  | { tipo: 'calculoFalhou'; mensagem: string }

const ESTADO_INICIAL: EstadoPlanejador = {
  origem: null,
  destinos: [],
  modo: 'origem',
  rota: null,
  erro: '',
  calculando: false,
}

// Identifica o conjunto de pontos de um cálculo; se mudar durante a requisição,
// a resposta é descartada para nunca mostrar rota de pontos antigos.
function chaveDosPontos(origem: Municipio | null, destinos: Municipio[]): string {
  return [origem?.id ?? '', ...destinos.map((d) => d.id)].join(',')
}

function adicionar(estado: EstadoPlanejador, municipio: Municipio): EstadoPlanejador {
  if (estado.modo === 'origem') {
    return {
      ...estado,
      origem: municipio,
      destinos: estado.destinos.filter((d) => d.id !== municipio.id),
      modo: 'destino',
      rota: null,
      erro: '',
    }
  }
  if (estado.origem?.id === municipio.id) {
    return { ...estado, erro: 'A origem não pode ser adicionada como destino.' }
  }
  if (estado.destinos.some((d) => d.id === municipio.id)) {
    return { ...estado, erro: `${municipio.nome} (${municipio.uf}) já foi adicionado.` }
  }
  if (estado.destinos.length >= LIMITE_DESTINOS) {
    return { ...estado, erro: `Limite de ${LIMITE_DESTINOS} destinos atingido.` }
  }
  return { ...estado, destinos: [...estado.destinos, municipio], rota: null, erro: '' }
}

// Reducer: cada ação vê o estado mais recente, então cliques concorrentes no
// mapa não se sobrescrevem (com useState + closures o segundo apagaria o primeiro).
function reduzir(estado: EstadoPlanejador, acao: Acao): EstadoPlanejador {
  switch (acao.tipo) {
    case 'adicionar':
      return adicionar(estado, acao.municipio)
    case 'remover':
      return { ...estado, destinos: estado.destinos.filter((d) => d.id !== acao.id), rota: null, erro: '' }
    case 'mudarModo':
      return { ...estado, modo: acao.modo }
    case 'limpar':
      return { ...estado, destinos: [], rota: null, erro: '' }
    case 'erro':
      return { ...estado, erro: acao.mensagem }
    case 'calculoIniciado':
      return { ...estado, calculando: true, erro: '' }
    case 'calculoConcluido':
      if (acao.chave !== chaveDosPontos(estado.origem, estado.destinos)) {
        return { ...estado, calculando: false }
      }
      return { ...estado, calculando: false, rota: acao.rota }
    case 'calculoFalhou':
      return { ...estado, calculando: false, erro: acao.mensagem }
  }
}

export function usePlanejador() {
  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL)

  async function adicionarPorCoordenada(lat: number, lon: number) {
    try {
      const municipio = await municipioProximo(lat, lon)
      despachar({ tipo: 'adicionar', municipio })
    } catch (erro) {
      despachar({ tipo: 'erro', mensagem: mensagemDeErro(erro) })
    }
  }

  async function calcular() {
    const { origem, destinos } = estado
    if (!origem) {
      despachar({ tipo: 'erro', mensagem: 'Escolha a origem antes de calcular.' })
      return
    }
    if (destinos.length === 0) {
      despachar({ tipo: 'erro', mensagem: 'Adicione pelo menos um destino para calcular a rota.' })
      return
    }
    const chave = chaveDosPontos(origem, destinos)
    despachar({ tipo: 'calculoIniciado' })
    try {
      const rota = await calcularRota(origem.id, destinos.map((d) => d.id))
      despachar({ tipo: 'calculoConcluido', rota, chave })
    } catch (erro) {
      despachar({ tipo: 'calculoFalhou', mensagem: mensagemDeErro(erro) })
    }
  }

  return {
    estado,
    adicionar: (municipio: Municipio) => despachar({ tipo: 'adicionar', municipio }),
    adicionarPorCoordenada,
    remover: (id: number) => despachar({ tipo: 'remover', id }),
    mudarModo: (modo: Modo) => despachar({ tipo: 'mudarModo', modo }),
    limpar: () => despachar({ tipo: 'limpar' }),
    mostrarErro: (mensagem: string) => despachar({ tipo: 'erro', mensagem }),
    calcular,
  }
}

export type Planejador = ReturnType<typeof usePlanejador>
```

- [ ] **Step 7: `frontend/src/components/Cabecalho.tsx`**

```tsx
export function Cabecalho() {
  return (
    <header>
      <h1>Sistema de Rotas do Brasil</h1>
      <p>Busca da melhor rota entre municípios brasileiros usando grafos</p>
    </header>
  )
}
```

- [ ] **Step 8: `frontend/src/components/SeletorModo.tsx`**

```tsx
import type { Modo } from '../hooks/usePlanejador'

interface Props {
  modo: Modo
  aoMudar: (modo: Modo) => void
}

export function SeletorModo({ modo, aoMudar }: Props) {
  return (
    <fieldset className="modo">
      <legend>O próximo ponto será</legend>
      <label>
        <input type="radio" name="modo" checked={modo === 'origem'} onChange={() => aoMudar('origem')} />
        Origem
      </label>
      <label>
        <input type="radio" name="modo" checked={modo === 'destino'} onChange={() => aoMudar('destino')} />
        Destino
      </label>
    </fieldset>
  )
}
```

- [ ] **Step 9: `frontend/src/components/BuscaLocal.tsx`**

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { buscarLocal, mensagemDeErro } from '../api/cliente'
import type { Municipio, ResultadoBusca } from '../api/cliente'
import { rotuloMunicipio } from '../formatacao'

interface Props {
  aoEscolher: (municipio: Municipio) => void
  aoErro: (mensagem: string) => void
}

// Busca só ao enviar (Enter/botão): a política do Nominatim proíbe autocomplete.
export function BuscaLocal({ aoEscolher, aoErro }: Props) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const consulta = texto.trim()
    if (consulta.length < 2) {
      aoErro('Digite pelo menos 2 caracteres para buscar.')
      return
    }
    setBuscando(true)
    try {
      setResultados(await buscarLocal(consulta))
      aoErro('')
    } catch (erro) {
      setResultados(null)
      aoErro(mensagemDeErro(erro))
    } finally {
      setBuscando(false)
    }
  }

  function escolher(resultado: ResultadoBusca) {
    aoEscolher(resultado.municipio)
    setResultados(null)
    setTexto('')
  }

  return (
    <form onSubmit={aoEnviar}>
      <label htmlFor="busca">Buscar lugar</label>
      <div className="row">
        <input
          id="busca"
          type="search"
          value={texto}
          placeholder="Ex.: Parnaíba, PI"
          onChange={(evento) => setTexto(evento.target.value)}
        />
        <button type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {resultados &&
        (resultados.length === 0 ? (
          <p className="hint">Nenhum lugar encontrado.</p>
        ) : (
          <ul className="resultados-busca">
            {resultados.map((resultado, i) => (
              <li key={`${resultado.lat},${resultado.lon},${i}`}>
                <button type="button" className="resultado" onClick={() => escolher(resultado)}>
                  <span>{resultado.rotulo}</span>
                  <small>→ {rotuloMunicipio(resultado.municipio)}</small>
                </button>
              </li>
            ))}
          </ul>
        ))}
      <p className="hint">Ou clique no mapa para escolher um ponto. Cada ponto vira o município mais próximo.</p>
    </form>
  )
}
```

- [ ] **Step 10: `frontend/src/components/ListaPontos.tsx`**

```tsx
import type { Municipio } from '../api/cliente'
import { rotuloMunicipio } from '../formatacao'
import { LIMITE_DESTINOS } from '../hooks/usePlanejador'

interface Props {
  origem: Municipio | null
  destinos: Municipio[]
  aoRemover: (id: number) => void
}

export function ListaPontos({ origem, destinos, aoRemover }: Props) {
  return (
    <>
      <div className="campo">Origem</div>
      {origem ? (
        <div className="destino origem">
          <span>{rotuloMunicipio(origem)}</span>
        </div>
      ) : (
        <span className="hint">Nenhuma origem escolhida.</span>
      )}
      <div className="campo">
        Destinos escolhidos ({destinos.length}/{LIMITE_DESTINOS})
      </div>
      <div className="destinos">
        {destinos.length === 0 ? (
          <span className="hint">Nenhum destino adicionado.</span>
        ) : (
          destinos.map((destino, i) => (
            <div className="destino" key={destino.id}>
              <span>
                {i + 1}. {rotuloMunicipio(destino)}
              </span>
              <button type="button" onClick={() => aoRemover(destino.id)}>
                remover
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 11: `frontend/src/components/ResultadoRota.tsx`**

```tsx
import type { Rota } from '../api/cliente'
import { formatarKm, rotuloMunicipio } from '../formatacao'

const NOME_METODO: Record<Rota['metodo'], string> = {
  forca_bruta: 'força bruta (testou todas as ordens possíveis)',
  heuristica: 'heurística (vizinho mais próximo + 2-opt)',
}

export function ResultadoRota({ rota }: { rota: Rota }) {
  return (
    <div className="result">
      <h2>Rota encontrada</h2>
      <div className="metric">
        <div>
          <span className="hint">Destinos</span>
          <b>{rota.ordem.length - 2}</b>
        </div>
        <div>
          <span className="hint">Distância total</span>
          <b>{formatarKm(rota.distancia_total_km)}</b>
        </div>
      </div>
      <p className="hint">Ordem calculada por {NOME_METODO[rota.metodo]}.</p>
      <ol className="route">
        {rota.trechos.map((trecho, i) => (
          <li key={i}>
            <b>
              {rotuloMunicipio(trecho.de)} → {rotuloMunicipio(trecho.para)}
            </b>{' '}
            — {formatarKm(trecho.distancia_km)}
            <details>
              <summary>{trecho.caminho.length} municípios no caminho</summary>
              {trecho.caminho.map((m) => m.nome).join(' → ')}
            </details>
          </li>
        ))}
      </ol>
      <p className="hint success">A rota retorna automaticamente ao município de origem.</p>
      <p className="hint">Distâncias aproximadas (linha reta entre municípios vizinhos).</p>
    </div>
  )
}
```

- [ ] **Step 12: `frontend/src/components/MapaRota.tsx`**

```tsx
import type { LatLngExpression, LatLngTuple } from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Municipio, Rota } from '../api/cliente'
import { rotuloMunicipio } from '../formatacao'

const CENTRO_BRASIL: LatLngExpression = [-14.235, -51.925]
const COR_ROTA = '#e67e22'
const COR_ORIGEM = '#174a7e'

interface Props {
  origem: Municipio | null
  destinos: Municipio[]
  rota: Rota | null
  aoClicar: (lat: number, lon: number) => void
}

function CliqueNoMapa({ aoClicar }: Pick<Props, 'aoClicar'>) {
  useMapEvents({
    click(evento) {
      const ponto = evento.latlng.wrap() // mantém longitude em [-180, 180]
      aoClicar(ponto.lat, ponto.lng)
    },
  })
  return null
}

function EnquadrarRota({ linha }: { linha: LatLngTuple[] }) {
  const mapa = useMap()
  useEffect(() => {
    if (linha.length > 1) mapa.fitBounds(linha, { padding: [30, 30] })
  }, [mapa, linha])
  return null
}

// CircleMarker (vetorial) evita o problema dos ícones PNG do Leaflet com bundlers.
export function MapaRota({ origem, destinos, rota, aoClicar }: Props) {
  const linha = useMemo<LatLngTuple[]>(
    () => (rota ? rota.trechos.flatMap((t) => t.caminho.map((m): LatLngTuple => [m.lat, m.lon])) : []),
    [rota],
  )
  const posicaoNaRota = useMemo(() => {
    const posicoes = new Map<number, number>()
    rota?.ordem.slice(1, -1).forEach((m, i) => posicoes.set(m.id, i + 1))
    return posicoes
  }, [rota])

  return (
    <MapContainer className="mapa" center={CENTRO_BRASIL} zoom={4}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CliqueNoMapa aoClicar={aoClicar} />
      <EnquadrarRota linha={linha} />
      {linha.length > 1 && <Polyline positions={linha} pathOptions={{ color: COR_ROTA, weight: 5 }} />}
      {destinos.map((destino) => {
        const posicao = posicaoNaRota.get(destino.id)
        return (
          // a key muda com a posição porque as opções do Tooltip não mudam depois de criado
          <CircleMarker
            key={`${destino.id}-${posicao ?? ''}`}
            center={[destino.lat, destino.lon]}
            radius={8}
            bubblingMouseEvents={false}
            pathOptions={{ color: COR_ROTA, fillColor: '#fff3df', fillOpacity: 1, weight: 3 }}
          >
            <Tooltip permanent={posicao !== undefined} direction="top">
              {posicao !== undefined ? `${posicao}. ` : ''}
              {rotuloMunicipio(destino)}
            </Tooltip>
          </CircleMarker>
        )
      })}
      {origem && (
        <CircleMarker
          center={[origem.lat, origem.lon]}
          radius={9}
          bubblingMouseEvents={false}
          pathOptions={{ color: COR_ORIGEM, fillColor: COR_ORIGEM, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top">
            Origem: {rotuloMunicipio(origem)}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
```

- [ ] **Step 13: `frontend/src/components/PainelPlanejamento.tsx`**

```tsx
import type { Planejador } from '../hooks/usePlanejador'
import { BuscaLocal } from './BuscaLocal'
import { ListaPontos } from './ListaPontos'
import { ResultadoRota } from './ResultadoRota'
import { SeletorModo } from './SeletorModo'

export function PainelPlanejamento({ planejador }: { planejador: Planejador }) {
  const { estado } = planejador
  return (
    <section className="card">
      <h2>Planejar rota</h2>
      <SeletorModo modo={estado.modo} aoMudar={planejador.mudarModo} />
      <BuscaLocal aoEscolher={planejador.adicionar} aoErro={planejador.mostrarErro} />
      {estado.erro && <div className="error">{estado.erro}</div>}
      <ListaPontos origem={estado.origem} destinos={estado.destinos} aoRemover={planejador.remover} />
      <button type="button" onClick={() => void planejador.calcular()} disabled={estado.calculando}>
        {estado.calculando ? 'Calculando…' : 'Calcular rota'}
      </button>
      <button type="button" className="secondary" onClick={planejador.limpar}>
        Limpar destinos
      </button>
      {estado.rota && <ResultadoRota rota={estado.rota} />}
    </section>
  )
}
```

- [ ] **Step 14: `frontend/src/App.tsx`**

```tsx
import { Cabecalho } from './components/Cabecalho'
import { MapaRota } from './components/MapaRota'
import { PainelPlanejamento } from './components/PainelPlanejamento'
import { usePlanejador } from './hooks/usePlanejador'

export default function App() {
  const planejador = usePlanejador()
  const { estado } = planejador
  return (
    <>
      <Cabecalho />
      <main>
        <PainelPlanejamento planejador={planejador} />
        <section className="card">
          <h2>Mapa da rota</h2>
          <div className="legend">
            Clique no mapa para adicionar um ponto como <b>{estado.modo}</b>. A rota calculada fica destacada em
            laranja.
          </div>
          <MapaRota
            origem={estado.origem}
            destinos={estado.destinos}
            rota={estado.rota}
            aoClicar={(lat, lon) => void planejador.adicionarPorCoordenada(lat, lon)}
          />
        </section>
      </main>
    </>
  )
}
```

- [ ] **Step 15: `frontend/src/main.tsx`** — adicionar o CSS do Leaflet antes do `index.css`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 16: `frontend/src/index.css`** (substitui todo o conteúdo; portado do HTML original)

```css
:root {
  --blue: #174a7e;
  --blue2: #2468a2;
  --bg: #f4f7fa;
  --card: #fff;
  --text: #17212b;
  --muted: #667788;
  --line: #d8e2ea;
  --ok: #18794e;
  --danger: #b42318;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: var(--bg);
  color: var(--text);
}

header {
  background: var(--blue);
  color: #fff;
  padding: 22px 28px;
}

header h1 {
  margin: 0 0 5px;
  font-size: 24px;
}

header p {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

main {
  max-width: 1200px;
  margin: 22px auto;
  padding: 0 18px;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
  align-items: start;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
  min-width: 0;
}

h2 {
  font-size: 17px;
  margin: 0 0 14px;
  color: var(--blue);
}

label,
.campo {
  display: block;
  font-weight: 700;
  font-size: 13px;
  margin: 12px 0 6px;
}

input[type='search'],
button {
  width: 100%;
  padding: 11px;
  border-radius: 9px;
  border: 1px solid #bccbd7;
  font-size: 14px;
  background: #fff;
}

button {
  border: 0;
  background: var(--blue);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  margin-top: 12px;
}

button:hover {
  background: var(--blue2);
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

button.secondary {
  background: #eaf2f8;
  color: var(--blue);
  border: 1px solid #cbdce9;
}

button.secondary:hover {
  background: #dbe8f2;
}

.row {
  display: grid;
  grid-template-columns: 1fr 92px;
  gap: 8px;
}

.row button {
  margin: 0;
}

.modo {
  display: flex;
  gap: 18px;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 6px 12px 10px;
  margin: 0;
}

.modo legend {
  font-weight: 700;
  font-size: 13px;
  padding: 0 4px;
}

.modo label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-weight: 400;
  font-size: 14px;
  cursor: pointer;
}

.resultados-busca {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resultados-busca button.resultado {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  font-size: 13px;
  font-weight: 400;
  color: var(--text);
  background: #f7fafc;
  border: 1px solid var(--line);
}

.resultados-busca button.resultado:hover {
  background: #eaf2f8;
}

.resultados-busca small {
  color: var(--blue);
  font-weight: 700;
}

.destinos {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.destino {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f7fafc;
  border: 1px solid var(--line);
  padding: 8px 9px;
  border-radius: 8px;
  font-size: 13px;
}

.destino.origem {
  background: #eaf2f8;
  border-color: var(--blue);
}

.destino button {
  width: auto;
  margin: 0;
  padding: 4px 8px;
  background: #fff;
  color: var(--danger);
  border: 1px solid #efc8c4;
}

.hint {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}

.result {
  margin-top: 16px;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.metric {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 10px 0;
}

.metric div {
  background: #f2f7fb;
  padding: 10px;
  border-radius: 9px;
}

.metric b {
  display: block;
  color: var(--blue);
  font-size: 18px;
}

.route {
  font-size: 13px;
  line-height: 1.6;
  background: #f7fafc;
  padding: 10px 10px 10px 28px;
  border-radius: 9px;
  border: 1px solid var(--line);
  margin: 0;
}

.route li + li {
  margin-top: 6px;
}

.route summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 12px;
}

.legend {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}

.mapa {
  height: 610px;
  border-radius: 10px;
  border: 1px solid var(--line);
}

.mapa.leaflet-container {
  cursor: crosshair;
}

.error {
  color: var(--danger);
  font-size: 12px;
  margin-top: 8px;
}

.success {
  color: var(--ok);
}

@media (max-width: 850px) {
  main {
    grid-template-columns: 1fr;
  }

  .mapa {
    height: 500px;
  }
}
```

- [ ] **Step 17: Lint e build**

Run: `cd frontend && npm run lint && npm run build`
Expected: lint sem erros; build `✓ built in ...`.

- [ ] **Step 18: Verificação manual no navegador**

Suba a API (`cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`) e o front (`cd frontend && npm run dev`), abra `http://localhost:5173`:
1. Mapa do Brasil aparece com atribuição do OpenStreetMap; modo começa em **Origem**.
2. Buscar "Teresina" (Enter) → resultados com "→ Teresina (PI)"; clicar → vira origem, modo muda para **Destino**, marcador azul com "Origem: Teresina (PI)".
3. Clicar no mapa perto de Parnaíba, Picos e Floriano → três destinos na lista com nome e UF.
4. Clicar de novo em cima de Picos → erro "Picos (PI) já foi adicionado."
5. **Calcular rota** → "Calculando…" e depois métricas, método "força bruta", trechos com `<details>`, linha laranja no mapa, zoom ajustado, destinos com números permanentes.
6. Remover um destino → resultado some.
7. **Limpar destinos** → destinos e resultado somem, origem fica.
8. Tela estreita (< 850px, DevTools responsivo) → painel e mapa empilhados.

- [ ] **Step 19: Verificar Review Focus 1–3**

1. DevTools → Network → *Slow 3G*. Com modo **Origem**, clique rapidamente em dois pontos distantes do mapa. Expected: depois das respostas, o primeiro vira origem e o segundo aparece como destino (nenhum se perde).
2. Ainda em *Slow 3G*, com origem + 2 destinos, clique **Calcular rota** e, durante "Calculando…", remova um destino. Expected: quando a resposta chega, **nenhum** resultado é exibido e o botão volta a "Calcular rota".
3. Volte a *No throttling*. Pare a API (Ctrl+C no uvicorn), clique no mapa. Expected: erro "Não foi possível falar com o servidor." no painel. Suba a API de novo.

- [ ] **Step 20: Commit**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
git add frontend
git commit -m "feat(frontend): interface React com busca, mapa Leaflet e cálculo via API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Orquestração — `npm run setup` e `npm run dev`

**Files:**
- Create: `ED2/package.json`, `ED2/scripts/lib/log.mjs`, `ED2/scripts/lib/processos.mjs`, `ED2/scripts/lib/ambiente.mjs`, `ED2/scripts/setup.mjs`, `ED2/scripts/dev.mjs`

**Interfaces:**
- Consumes: `backend/requirements.txt`, `backend/scripts/construir_banco.py` (Task 2), `backend/app/main.py` (Task 4), `frontend/vite.config.ts` lendo `API_PORT` (Task 5).
- Produces: `npm run setup`, `npm run dev`; variáveis `PYTHON`, `API_PORT` documentadas no README (Task 7).

- [ ] **Step 1: `ED2/package.json`**

```json
{
  "name": "rotas-brasil",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.19"
  },
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "setup": "node scripts/setup.mjs"
  }
}
```

- [ ] **Step 2: `ED2/scripts/lib/log.mjs`**

```js
const CORES = { ciano: 36, magenta: 35, verde: 32, vermelho: 31, amarelo: 33, cinza: 90 }
const usarCor = !process.env.NO_COLOR && Boolean(process.stdout.isTTY)

export function colorir(cor, texto) {
  return usarCor ? `\x1b[${CORES[cor]}m${texto}\x1b[0m` : texto
}

export function ok(mensagem) {
  console.log(`${colorir('verde', '✔')} ${mensagem}`)
}

export function info(mensagem) {
  console.log(`${colorir('cinza', '•')} ${mensagem}`)
}

export function falha(mensagem, dica) {
  console.error(`${colorir('vermelho', '✖')} ${mensagem}`)
  if (dica) console.error(colorir('amarelo', `  → ${dica.split('\n').join('\n    ')}`))
}

/** Erro esperado do ambiente: mostra mensagem + dica, sem stack trace. */
export class ErroAmbiente extends Error {
  constructor(mensagem, dica) {
    super(mensagem)
    this.dica = dica
  }
}

export function tratarErroFatal(erro) {
  if (erro instanceof ErroAmbiente) falha(erro.message, erro.dica)
  else console.error(erro)
  process.exit(1)
}
```

- [ ] **Step 3: `ED2/scripts/lib/processos.mjs`**

```js
import { spawn } from 'node:child_process'
import net from 'node:net'
import { colorir, ErroAmbiente } from './log.mjs'

export const WINDOWS = process.platform === 'win32'

/**
 * Executa um comando até o fim, sem shell (argumentos em array: espaços e
 * acentos nos caminhos não quebram nada). Nunca rejeita: resolve com
 * { codigo, saida }, onde codigo -1 significa "não foi possível executar".
 */
export function executar(comando, args, { cwd, env, mostrar = false, shell = false } = {}) {
  return new Promise((resolve) => {
    let filho
    try {
      filho = spawn(comando, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: mostrar ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell,
      })
    } catch (erro) {
      resolve({ codigo: -1, saida: String(erro) })
      return
    }
    let saida = ''
    filho.stdout?.on('data', (pedaco) => (saida += pedaco))
    filho.stderr?.on('data', (pedaco) => (saida += pedaco))
    filho.on('error', (erro) => resolve({ codigo: -1, saida: String(erro) }))
    filho.on('close', (codigo) => resolve({ codigo: codigo ?? -1, saida }))
  })
}

/** Roda o npm que está executando este script (npm_execpath); senão, o npm do PATH. */
export function executarNpm(args, cwd) {
  const cli = process.env.npm_execpath
  if (cli && /\.c?js$/.test(cli)) return executar(process.execPath, [cli, ...args], { cwd, mostrar: true })
  // npm.cmd no Windows só roda via shell (restrição do Node desde 2024)
  return executar(WINDOWS ? 'npm.cmd' : 'npm', args, { cwd, mostrar: true, shell: WINDOWS })
}

/** Sobe um processo de longa duração com cada linha de saída prefixada por [nome]. */
export function iniciarServico({ nome, cor, comando, args, cwd, env }) {
  const filho = spawn(comando, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !WINDOWS, // grupo de processos próprio: permite matar a árvore no Linux/Mac
    windowsHide: true,
  })
  const prefixo = colorir(cor, `[${nome}]`)
  for (const [fluxo, destino] of [
    [filho.stdout, process.stdout],
    [filho.stderr, process.stderr],
  ]) {
    let resto = ''
    fluxo.setEncoding('utf8')
    fluxo.on('data', (pedaco) => {
      const linhas = (resto + pedaco).split(/\r?\n/)
      resto = linhas.pop()
      for (const linha of linhas) destino.write(`${prefixo} ${linha}\n`)
    })
    fluxo.on('end', () => {
      if (resto) destino.write(`${prefixo} ${resto}\n`)
    })
  }
  return filho
}

/** Encerra o processo e todos os filhos dele (ex.: o reloader do uvicorn). */
export function encerrarArvore(filho) {
  if (filho.pid === undefined || filho.exitCode !== null || filho.signalCode !== null) return
  if (WINDOWS) {
    spawn('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    try {
      process.kill(-filho.pid, 'SIGTERM')
    } catch {
      // já terminou
    }
  }
}

function portaLivre(porta) {
  return new Promise((resolve) => {
    const servidor = net.createServer()
    servidor.once('error', () => resolve(false))
    servidor.once('listening', () => servidor.close(() => resolve(true)))
    servidor.listen(porta, '127.0.0.1')
  })
}

export async function primeiraPortaLivre(inicial, tentativas = 20) {
  for (let porta = inicial; porta < inicial + tentativas; porta++) {
    if (await portaLivre(porta)) return porta
  }
  throw new ErroAmbiente(
    `Nenhuma porta livre entre ${inicial} e ${inicial + tentativas - 1}.`,
    'Feche os programas que usam essas portas ou defina API_PORT com outra porta inicial.',
  )
}
```

- [ ] **Step 4: `ED2/scripts/lib/ambiente.mjs`**

```js
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ErroAmbiente } from './log.mjs'
import { executar, WINDOWS } from './processos.mjs'

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const BACKEND = path.join(RAIZ, 'backend')
export const FRONTEND = path.join(RAIZ, 'frontend')
export const VENV = path.join(BACKEND, '.venv')
export const PYTHON_VENV = WINDOWS ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python')
export const BANCO = path.join(BACKEND, 'data', 'rotas.db')

export const NODE_MINIMO = [20, 19]
export const PYTHON_MINIMO = [3, 11]

export function versaoAtende(versao, minimo) {
  for (let i = 0; i < minimo.length; i++) {
    if ((versao[i] ?? 0) !== minimo[i]) return (versao[i] ?? 0) > minimo[i]
  }
  return true
}

function hashArquivo(caminho) {
  return createHash('sha256').update(readFileSync(caminho)).digest('hex')
}

/** true se o carimbo guarda o hash atual do arquivo-fonte (nada mudou desde a última instalação). */
export function carimboConfere(fonte, carimbo) {
  return existsSync(carimbo) && readFileSync(carimbo, 'utf8').trim() === hashArquivo(fonte)
}

export function gravarCarimbo(fonte, carimbo) {
  writeFileSync(carimbo, hashArquivo(fonte))
}

const SONDA_VERSAO = 'import sys; print("%d.%d.%d" % sys.version_info[:3])'

/** Executa o Python de verdade para ler a versão (descarta o atalho falso da Microsoft Store). */
export async function versaoPython(comando, argsBase = []) {
  const { codigo, saida } = await executar(comando, [...argsBase, '-c', SONDA_VERSAO])
  if (codigo !== 0) return null
  const achado = saida.match(/^(\d+)\.(\d+)\.(\d+)\s*$/m)
  return achado ? achado.slice(1, 4).map(Number) : null
}

const DICA_PYTHON = {
  win32:
    'Instale em https://www.python.org/downloads/ marcando "Add python.exe to PATH"\n' +
    '(ou: winget install Python.Python.3.13) e abra um terminal novo.',
  darwin: 'Instale com: brew install python@3.13  (ou https://www.python.org/downloads/)',
  linux: 'Instale com: sudo apt install python3 python3-venv  (ou o gerenciador da sua distribuição)',
}

export async function encontrarPython() {
  const candidatos = []
  if (process.env.PYTHON) candidatos.push({ comando: process.env.PYTHON, args: [] })
  if (WINDOWS) candidatos.push({ comando: 'py', args: ['-3'] })
  candidatos.push({ comando: 'python3', args: [] }, { comando: 'python', args: [] })

  const recusados = []
  for (const candidato of candidatos) {
    const versao = await versaoPython(candidato.comando, candidato.args)
    if (!versao) continue
    if (versaoAtende(versao, PYTHON_MINIMO)) return { ...candidato, versao }
    recusados.push(`${[candidato.comando, ...candidato.args].join(' ')} → ${versao.join('.')}`)
  }
  const minimo = PYTHON_MINIMO.join('.')
  throw new ErroAmbiente(
    recusados.length
      ? `Python ${minimo}+ não encontrado (encontrei: ${recusados.join(', ')}).`
      : `Python ${minimo}+ não encontrado.`,
    `${DICA_PYTHON[process.platform] ?? DICA_PYTHON.linux}\n` +
      'Se o Python está instalado fora do PATH, defina a variável PYTHON com o caminho do executável.',
  )
}
```

- [ ] **Step 5: `ED2/scripts/setup.mjs`**

```js
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BACKEND,
  BANCO,
  carimboConfere,
  encontrarPython,
  FRONTEND,
  gravarCarimbo,
  NODE_MINIMO,
  PYTHON_VENV,
  VENV,
  versaoAtende,
  versaoPython,
} from './lib/ambiente.mjs'
import { ErroAmbiente, info, ok, tratarErroFatal } from './lib/log.mjs'
import { executar, executarNpm, WINDOWS } from './lib/processos.mjs'

const AMBIENTE_PYTHON = { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }

function verificarNode() {
  const versao = process.versions.node.split('.').map(Number)
  if (!versaoAtende(versao, NODE_MINIMO)) {
    throw new ErroAmbiente(
      `Node ${NODE_MINIMO.join('.')}+ é necessário (você tem ${process.versions.node}).`,
      'Atualize em https://nodejs.org/ (versão LTS) e abra um terminal novo.',
    )
  }
  ok(`Node ${process.versions.node}`)
}

async function venvFunciona() {
  return existsSync(PYTHON_VENV) && (await versaoPython(PYTHON_VENV)) !== null
}

async function prepararVenv(python) {
  if (await venvFunciona()) {
    ok('Ambiente virtual do Python (backend/.venv)')
    return
  }
  if (existsSync(VENV)) {
    info('backend/.venv está quebrada; recriando…')
    rmSync(VENV, { recursive: true, force: true })
  }
  info('Criando backend/.venv…')
  const { codigo, saida } = await executar(python.comando, [...python.args, '-m', 'venv', VENV])
  if (codigo !== 0 || !(await venvFunciona())) {
    const [maior, menor] = python.versao
    const faltaVenv = /ensurepip|python3-venv|No module named venv/i.test(saida)
    throw new ErroAmbiente(
      'Não foi possível criar o ambiente virtual do Python.',
      faltaVenv
        ? `Instale o módulo venv: sudo apt install python3-venv  (ou python${maior}.${menor}-venv)`
        : saida.trim().split('\n').slice(-5).join('\n'),
    )
  }
  ok('Ambiente virtual do Python criado (backend/.venv)')
}

async function instalarDependenciasPython() {
  const requisitos = path.join(BACKEND, 'requirements.txt')
  const carimbo = path.join(VENV, '.requirements.sha256')
  if (carimboConfere(requisitos, carimbo)) {
    ok('Dependências do Python em dia')
    return
  }
  info('Instalando dependências do Python (pip)…')
  const { codigo } = await executar(
    PYTHON_VENV,
    ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', requisitos],
    { mostrar: true },
  )
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'A instalação das dependências do Python falhou (veja o erro acima).',
      'Sem internet ou atrás de proxy corporativo? Defina HTTPS_PROXY=http://servidor:porta e rode de novo.',
    )
  }
  gravarCarimbo(requisitos, carimbo)
  ok('Dependências do Python instaladas')
}

async function instalarDependenciasFront() {
  const lock = path.join(FRONTEND, 'package-lock.json')
  const carimbo = path.join(FRONTEND, 'node_modules', '.package-lock.sha256')
  if (carimboConfere(lock, carimbo)) {
    ok('Dependências do front em dia')
    return
  }
  info('Instalando dependências do front (npm install)…')
  const { codigo } = await executarNpm(['install', '--no-audit', '--no-fund'], FRONTEND)
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'npm install do front falhou (veja o erro acima).',
      'Atrás de proxy corporativo? Rode: npm config set proxy http://servidor:porta  e tente de novo.',
    )
  }
  gravarCarimbo(lock, carimbo) // depois do install: o npm pode reescrever o lock
  ok('Dependências do front instaladas')
}

async function prepararBanco() {
  if (existsSync(BANCO)) {
    ok('Banco de dados (backend/data/rotas.db)')
    return
  }
  info('Gerando backend/data/rotas.db (só na primeira vez; leva menos de 1 minuto)…')
  const { codigo } = await executar(PYTHON_VENV, [path.join(BACKEND, 'scripts', 'construir_banco.py')], {
    mostrar: true,
    env: AMBIENTE_PYTHON,
  })
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'Falha ao gerar o banco de dados (veja o erro acima).',
      'Confira se backend/data/municipios.csv e backend/data/estados.csv existem.',
    )
  }
  ok('Banco de dados gerado')
}

export async function prepararAmbiente() {
  verificarNode()
  const python = await encontrarPython()
  ok(`Python ${python.versao.join('.')} (${[python.comando, ...python.args].join(' ')})`)
  await prepararVenv(python)
  await instalarDependenciasPython()
  await instalarDependenciasFront()
  await prepararBanco()
}

// Roda só quando chamado direto (npm run setup), não quando importado pelo dev.mjs.
// No Windows a letra do drive pode vir em caixa diferente, então compara sem caixa.
const normalizar = (caminho) => (WINDOWS ? path.resolve(caminho).toLowerCase() : path.resolve(caminho))
if (process.argv[1] && normalizar(process.argv[1]) === normalizar(fileURLToPath(import.meta.url))) {
  prepararAmbiente().then(() => ok('Ambiente pronto. Rode: npm run dev'), tratarErroFatal)
}
```

- [ ] **Step 6: `ED2/scripts/dev.mjs`**

```js
import path from 'node:path'
import { BACKEND, FRONTEND, PYTHON_VENV } from './lib/ambiente.mjs'
import { falha, info, ok, tratarErroFatal } from './lib/log.mjs'
import { encerrarArvore, iniciarServico, primeiraPortaLivre } from './lib/processos.mjs'
import { prepararAmbiente } from './setup.mjs'

async function main() {
  await prepararAmbiente()

  const portaDesejada = Number(process.env.API_PORT) || 8000
  const portaApi = await primeiraPortaLivre(portaDesejada)
  if (portaApi !== portaDesejada) info(`Porta ${portaDesejada} ocupada; a API vai usar a ${portaApi}.`)

  const ambiente = { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', FORCE_COLOR: '1' }
  const api = iniciarServico({
    nome: 'api',
    cor: 'ciano',
    comando: PYTHON_VENV,
    args: ['-m', 'uvicorn', 'app.main:app', '--reload', '--reload-dir', 'app', '--host', '127.0.0.1', '--port', String(portaApi)],
    cwd: BACKEND,
    env: ambiente,
  })
  const web = iniciarServico({
    nome: 'web',
    cor: 'magenta',
    comando: process.execPath,
    args: [path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'],
    cwd: FRONTEND,
    env: { ...ambiente, API_PORT: String(portaApi) },
  })
  ok(`API em http://127.0.0.1:${portaApi}/docs — o endereço do site aparece nas linhas [web]. Ctrl+C encerra tudo.`)

  let encerrando = false
  function encerrar(codigo) {
    if (encerrando) return
    encerrando = true
    encerrarArvore(api)
    encerrarArvore(web)
    setTimeout(() => process.exit(codigo), 500) // dá tempo do taskkill/kill agir
  }

  for (const [nome, filho] of [
    ['api', api],
    ['web', web],
  ]) {
    filho.on('error', (erro) => {
      falha(`Não foi possível iniciar [${nome}]: ${erro.message}`)
      encerrar(1)
    })
    filho.on('exit', (codigo, sinal) => {
      // No Windows o Ctrl+C chega aos filhos ao mesmo tempo que a nós;
      // esperamos um instante para não confundir isso com uma queda.
      setTimeout(() => {
        if (encerrando) return
        falha(`[${nome}] terminou (${sinal ?? `código ${codigo}`}); encerrando o outro serviço.`)
        encerrar(codigo || 1)
      }, 300)
    })
  }
  process.on('SIGINT', () => encerrar(0))
  process.on('SIGTERM', () => encerrar(0))
}

main().catch(tratarErroFatal)
```

- [ ] **Step 7: Verificar `npm run dev` do zero**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
rm -rf backend/.venv backend/data/rotas.db frontend/node_modules
npm run dev
```

Expected (em ordem): `✔ Node 24.x`, `✔ Python 3.13.x (py -3)` (ou `python`), `• Criando backend/.venv…`, saída do pip, `✔ Dependências do Python instaladas`, saída do npm, `✔ Dependências do front instaladas`, progresso do banco, `✔ Banco de dados gerado`, `✔ API em http://127.0.0.1:8000/docs…`, linhas `[api] … Application startup complete.` e `[web] … Local: http://127.0.0.1:5173/`. Abrir o site e calcular uma rota funciona.

- [ ] **Step 8: Verificar segunda execução (idempotência)**

Ctrl+C e rode `npm run dev` de novo. Expected: todas as etapas com `✔ … em dia` / `✔ Banco de dados`, sem pip/npm/banco, servidores em poucos segundos.

- [ ] **Step 9: Verificar Review Focus 4 (porta ocupada)**

Em outro terminal: `python -m http.server 8000 --bind 127.0.0.1`. Rode `npm run dev`. Expected: `• Porta 8000 ocupada; a API vai usar a 8001.`, `[api] … running on http://127.0.0.1:8001`, e no site a busca/cálculo funcionam (proxy do Vite foi para 8001). Encerre tudo e o `http.server`.

- [ ] **Step 10: Verificar Review Focus 5 (Ctrl+C sem órfãos)**

Com `npm run dev` rodando, Ctrl+C. Depois:
- Windows (PowerShell): `Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue` → nenhuma saída; `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*uvicorn*' -or $_.CommandLine -like '*vite.js*' } | Select-Object ProcessId, CommandLine` → nenhuma saída.
- Linux/Mac: `lsof -i :8000 -i :5173` e `pgrep -fl "uvicorn|vite.js"` → nenhuma saída.

- [ ] **Step 11: Verificar mensagens de erro do ambiente**

1. `PYTHON=C:/nao/existe npm run setup` → ainda encontra o Python real pelos outros candidatos (`✔ Python …`).
2. Simular venv quebrada: `rm backend/.venv/Scripts/python.exe` (Linux/Mac: `rm backend/.venv/bin/python`) e `npm run setup` → `• backend/.venv está quebrada; recriando…` e conclui com `✔ Ambiente pronto`.
3. Se o [api] cair (ex.: renomeie temporariamente `backend/app/main.py`, rode `npm run dev`, desfaça): Expected `✖ [api] terminou (código 1); encerrando o outro serviço.` e o processo sai.

- [ ] **Step 12: Commit**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
git add package.json scripts
git commit -m "feat: npm run dev/setup multiplataforma que prepara o ambiente e sobe back e front

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: README

**Files:**
- Create: `ED2/README.md`
- Create: `ED2/docs/tela.png` (captura)
- Modify: `ED2/frontend/README.md` (aponta para o README principal)

**Interfaces:**
- Consumes: comandos e variáveis das Tasks 2–6.
- Produces: documentação final.

- [ ] **Step 1: Captura de tela**

Com `npm run dev` rodando, calcule Teresina → Parnaíba, Picos, Floriano e salve uma captura da página inteira em `ED2/docs/tela.png` (ferramenta de captura do sistema ou DevTools → `Ctrl+Shift+P` → "Capture full size screenshot").

- [ ] **Step 2: `ED2/README.md`**

````markdown
# Sistema de Rotas do Brasil

Calcula a **melhor rota** para visitar vários municípios brasileiros e voltar ao ponto de partida, usando **grafos**. Trabalho da disciplina **Estrutura de Dados II**.

- Escolha os pontos **buscando pelo nome** (Nominatim/OpenStreetMap) ou **clicando no mapa**.
- O backend (Python) encontra a **melhor ordem de visita** e o **menor caminho** entre cada par de cidades, num grafo com os **5.571 municípios** do Brasil.
- O front (React) desenha a rota no mapa.

![Tela do sistema](docs/tela.png)

> A versão original (15 municípios do Piauí, tudo no navegador) está em [`legado/grafo-de-municipios.html`](legado/grafo-de-municipios.html).

---

## Pré-requisitos

| Ferramenta | Versão mínima | Como verificar | Onde baixar |
|---|---|---|---|
| Node.js | 20.19 | `node --version` | https://nodejs.org/ (LTS) |
| Python | 3.11 | `python --version` (Windows: `py --version`) | https://www.python.org/downloads/ |
| Git | qualquer | `git --version` | https://git-scm.com/ |

**Windows:** no instalador do Python, marque **"Add python.exe to PATH"**. Depois de instalar qualquer coisa, abra um terminal novo.
**Linux (Debian/Ubuntu):** além do Python, instale o módulo venv: `sudo apt install python3-venv`.

Internet é necessária na primeira execução (instalar dependências), para a busca por nome e para os mapas.

---

## Preparando o ambiente e rodando

Tudo é feito por **um comando**, na pasta `estrutura-de-dados-2`:

```bash
npm run dev
```

Funciona igual em Windows (PowerShell ou cmd), Linux e macOS. Não é preciso ativar venv nem instalar nada antes além de Node e Python.

Quando aparecer `[web] ... Local: http://127.0.0.1:5173/`, abra esse endereço. Ctrl+C encerra o backend e o front juntos.

| Endereço | O quê |
|---|---|
| http://127.0.0.1:5173 | o sistema |
| http://127.0.0.1:8000/docs | documentação interativa da API |

Para só preparar o ambiente, sem subir os servidores: `npm run setup`.

### O que o `npm run dev` faz por você

1. Confere o **Node** (≥ 20.19).
2. Procura um **Python ≥ 3.11** testando, nesta ordem: variável `PYTHON`, `py -3` (Windows), `python3`, `python`. Cada um é executado de verdade, então o atalho falso da Microsoft Store é ignorado.
3. Cria (ou recria, se quebrada) a **venv** em `backend/.venv`. Ela nunca precisa ser ativada: o script chama o Python dela direto.
4. Roda `pip install -r backend/requirements.txt` **só se** o arquivo mudou desde a última vez.
5. Roda `npm install` em `frontend/` **só se** o `package-lock.json` mudou.
6. Gera o banco `backend/data/rotas.db` **só se** ele não existe (leva uns 20 s).
7. Escolhe a porta da API (8000, ou a próxima livre) e avisa o front.
8. Sobe a API (`[api]`, ciano) e o front (`[web]`, magenta) no mesmo terminal.
9. No Ctrl+C (ou se um dos dois cair), encerra ambos, incluindo os processos filhos.

### Variáveis de ambiente opcionais

| Variável | Para quê |
|---|---|
| `PYTHON` | caminho do Python a usar, se ele não estiver no PATH |
| `API_PORT` | porta inicial da API (padrão 8000) |
| `NOMINATIM_EMAIL` | e-mail de contato enviado ao Nominatim (recomendado pela política de uso) |

Exemplo (PowerShell): `$env:API_PORT = "9000"; npm run dev` · (bash): `API_PORT=9000 npm run dev`

### Rodando cada parte separadamente

```bash
# só o backend (depois de um npm run setup)
cd backend
.venv/Scripts/python -m uvicorn app.main:app --reload --reload-dir app   # Windows
.venv/bin/python -m uvicorn app.main:app --reload --reload-dir app       # Linux/macOS

# só o front
cd frontend
npm run dev
npm run lint     # ESLint
```

Para **regerar o banco** (ex.: depois de mudar `construir_banco.py`), apague `backend/data/rotas.db` e rode `npm run dev`.

---

## Como funciona

### 1. Montagem do grafo (`backend/scripts/construir_banco.py`)

- **Vértices:** os 5.571 municípios (código IBGE, nome, UF, latitude, longitude).
- **Peso das arestas:** distância em km pela **fórmula de haversine** (linha reta sobre a esfera terrestre).
- **Arestas (k-NN):** cada município é ligado aos **6 vizinhos mais próximos**. É uma aproximação da malha de estradas: cidades vizinhas costumam ter ligação direta.
- **Conectividade (Kruskal + Union-Find):** o k-NN sozinho pode deixar "ilhas" de cidades sem ligação com o resto. Para evitar isso, calculamos uma **árvore geradora mínima** com o algoritmo de **Kruskal** sobre os 30 vizinhos mais próximos de cada município. O Kruskal usa **Union-Find** (união por rank + compressão de caminho) para saber se uma aresta une dois grupos diferentes. As arestas da árvore que faltavam entram no grafo (tipo `mst`), garantindo que **todo município alcança todos os outros**.
- Tudo é salvo em **SQLite** (`municipios` e `arestas`). Ao iniciar, a API carrega o grafo em memória como **lista de adjacência**.

### 2. Cálculo da rota (`POST /api/rotas`)

1. Para a origem e para cada destino, roda **Dijkstra** (fila de prioridade com `heapq`), obtendo a menor distância até todos os municípios.
2. Monta uma **matriz de distâncias** só entre os pontos escolhidos.
3. Escolhe a **ordem de visita** (problema do caixeiro-viajante, com volta à origem):
   - até **8 destinos**: **força bruta**, testando todas as ordens (8! = 40.320) — resultado ótimo garantido;
   - de **9 a 20 destinos**: **vizinho mais próximo** (vai sempre à cidade mais perto ainda não visitada) seguido de **2-opt** (inverte trechos da rota enquanto isso encurtar o total).
4. Reconstrói o caminho de cada trecho com o vetor de **anteriores** do Dijkstra.

### Complexidades

| Algoritmo | Complexidade | Onde |
|---|---|---|
| k-NN por força bruta | O(V²) — só na geração do banco | `construir_banco.py` |
| Kruskal + Union-Find | O(E log E) | `app/kruskal.py`, `app/union_find.py` |
| Dijkstra com heap | O((V + E) log V) por ponto | `app/dijkstra.py` |
| Força bruta da ordem | O(n!) | `app/melhor_rota.py` |
| Vizinho mais próximo | O(n²) | `app/melhor_rota.py` |
| 2-opt | O(n²) por passada | `app/melhor_rota.py` |
| Município mais próximo | O(V) | `app/geo.py` |

V = 5.571 municípios, E ≈ 20 mil arestas, n = nº de destinos.

### Limitação importante

As distâncias são **aproximadas**: somam linhas retas entre municípios vizinhos, não quilômetros reais de estrada. A rota mostra uma boa ordem de visita e por quais regiões passar, mas não substitui um GPS.

---

## Estrutura de pastas

```
estrutura-de-dados-2/
├── package.json            scripts "dev" e "setup" (sem dependências)
├── scripts/                orquestração em Node (setup.mjs, dev.mjs, lib/)
├── backend/
│   ├── requirements.txt
│   ├── data/               CSVs dos municípios (+ rotas.db gerado)
│   ├── scripts/construir_banco.py
│   └── app/                API FastAPI e algoritmos
│       ├── main.py         endpoints
│       ├── modelos.py      schemas de entrada/saída
│       ├── banco.py        SQLite
│       ├── grafo.py        Municipio e Grafo (lista de adjacência)
│       ├── geo.py          haversine, município mais próximo
│       ├── union_find.py   Union-Find
│       ├── kruskal.py      árvore geradora mínima
│       ├── dijkstra.py     menor caminho
│       ├── melhor_rota.py  ordem de visita (força bruta / heurística)
│       ├── planejamento.py junta tudo para um pedido de rota
│       └── nominatim.py    busca por nome (com limite de 1 req/s e cache)
├── frontend/               React + TypeScript + Vite + ESLint
│   └── src/
│       ├── api/cliente.ts
│       ├── hooks/usePlanejador.ts
│       └── components/     Cabecalho, PainelPlanejamento, BuscaLocal, SeletorModo,
│                           ListaPontos, ResultadoRota, MapaRota
├── legado/                 versão original em HTML
└── docs/                   especificação, plano e captura de tela
```

---

## API

### `GET /api/busca?q=Parnaíba`

```json
[
  {
    "rotulo": "Parnaíba, Região Geográfica Imediata de Parnaíba, ..., Piauí, Brasil",
    "lat": -2.9055, "lon": -41.7734,
    "municipio": { "id": 2207702, "nome": "Parnaíba", "uf": "PI", "lat": -2.90585, "lon": -41.7754 }
  }
]
```

### `GET /api/municipios/proximo?lat=-5.09&lon=-42.80`

```json
{ "id": 2211001, "nome": "Teresina", "uf": "PI", "lat": -5.09194, "lon": -42.8034 }
```

### `POST /api/rotas`

Pedido:
```json
{ "origem_id": 2211001, "destinos_ids": [2207702, 2208007, 2203909] }
```

Resposta (resumida):
```json
{
  "distancia_total_km": 1043.7,
  "metodo": "forca_bruta",
  "ordem": [ { "nome": "Teresina", ... }, { "nome": "Parnaíba", ... }, ..., { "nome": "Teresina", ... } ],
  "trechos": [
    { "de": { ... }, "para": { ... }, "distancia_km": 312.4, "caminho": [ { ... }, { ... } ] }
  ]
}
```

Erros vêm como `{ "detail": "mensagem" }`:

| Status | Quando |
|---|---|
| 400 | sem destinos, mais de 20 destinos, origem repetida nos destinos, destinos repetidos, busca com menos de 2 letras |
| 404 | código de município inexistente |
| 422 | parâmetros inválidos (ex.: latitude fora de -90..90) |
| 502 | Nominatim fora do ar (a escolha pelo mapa continua funcionando) |

---

## Problemas comuns

| Mensagem / sintoma | Solução |
|---|---|
| `✖ Python 3.11+ não encontrado` | Instale o Python (veja Pré-requisitos) e abra um terminal novo. Se já está instalado fora do PATH, defina `PYTHON` com o caminho do executável. |
| `✖ Node 20.19+ é necessário` | Atualize o Node (LTS) em https://nodejs.org/. |
| `✖ Não foi possível criar o ambiente virtual` + dica de `python3-venv` | Linux: `sudo apt install python3-venv` e rode de novo. |
| `✖ A instalação das dependências do Python falhou` / `npm install do front falhou` | Verifique a internet. Em rede corporativa: `HTTPS_PROXY=http://servidor:porta` para o pip e `npm config set proxy http://servidor:porta` para o npm. |
| `• Porta 8000 ocupada; a API vai usar a 8001` | Não é erro; o front já é avisado da porta nova. |
| Busca mostra "Busca indisponível no momento" | O Nominatim está fora do ar ou limitou as requisições. Espere um pouco ou clique no mapa. |
| "Não foi possível falar com o servidor." na tela | A API não está rodando. Veja as linhas `[api]` no terminal. |
| Mapa cinza, sem imagens | Sem acesso a `tile.openstreetmap.org` (internet ou firewall). |
| Banco parece desatualizado | Apague `backend/data/rotas.db` e rode `npm run dev`. |

---

## Fontes e créditos

- Municípios: [kelvins/municipios-brasileiros](https://github.com/kelvins/municipios-brasileiros) (licença MIT), baseado em dados do IBGE.
- Mapas e busca: © [contribuidores do OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL). Busca via [Nominatim](https://nominatim.org/), respeitando a [política de uso](https://operations.osmfoundation.org/policies/nominatim/) (máx. 1 requisição/s, sem autocomplete, com cache). Tiles conforme a [política de tiles](https://operations.osmfoundation.org/policies/tiles/).
````

- [ ] **Step 3: `ED2/frontend/README.md`** — substituir todo o conteúdo por:

```markdown
# Frontend — Sistema de Rotas do Brasil

React + TypeScript + Vite + ESLint. Veja o [README principal](../README.md) para preparar o ambiente e rodar tudo com `npm run dev` na pasta de cima.

Comandos locais: `npm run dev`, `npm run build`, `npm run lint`.
```

- [ ] **Step 4: Conferir o README contra o sistema real**

- Abra `README.md` num visualizador Markdown (VS Code: `Ctrl+Shift+V`); a imagem aparece, tabelas renderizam.
- Rode `npm run dev` e confira que as mensagens citadas na tabela "Problemas comuns" batem com as do script (`grep -rn "não encontrado\|ocupada\|falhou" scripts`).
- Ajuste no README os valores de exemplo de `POST /api/rotas` (`distancia_total_km`, `distancia_km`) para os números reais retornados pela API.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/062201593/Documents/me/facul/PIT/estrutura-de-dados-2"
git add README.md docs/tela.png frontend/README.md
git commit -m "docs: README com preparação do ambiente, funcionamento e API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação final (spec §9)

**Files:** nenhum (só verificação).

- [ ] **Step 1: Clone limpo**

```bash
TMP="$(mktemp -d)"
git clone --branch feat/rotas-brasil "C:/Users/062201593/Documents/me/facul/PIT" "$TMP/pit"
cd "$TMP/pit/estrutura-de-dados-2" && npm run dev
```

Expected: prepara tudo do zero e sobe os dois servidores (se 8000/5173 estiverem em uso pelo projeto original, pare-o antes).

- [ ] **Step 2: Checklist da spec §9**

- `cd frontend && npm run lint && npm run build` sem erros.
- Banco: `5571` municípios, `componentes: 1`.
- `/docs` abre; Teresina → [Parnaíba, Picos, Floriano] começa e termina em Teresina com `forca_bruta`; 9 destinos → `heuristica`.
- Todos os erros da seção 5 da spec retornam o status esperado (comandos da Task 4, Step 6).
- Tela: busca, clique, cálculo, desenho, limpar, mensagens de erro.
- Segunda execução pula instalações; Ctrl+C sem órfãos.

- [ ] **Step 3: Limpar o clone temporário** — `rm -rf "$TMP"`.
