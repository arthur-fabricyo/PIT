# Rotas pelas estradas no mapa — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desenhar cada trecho da rota no mapa seguindo as estradas reais, usando geometrias pré-calculadas por aresta do grafo, sem mudar algoritmo nem distâncias.

**Architecture:** Um script de desenvolvimento (`gerar_geometrias.py`) consulta um GraphHopper local uma vez por aresta e grava as polylines codificadas em `backend/data/geometrias_arestas.csv.gz` (versionado). Na execução, `app/geometrias.py` carrega esse arquivo e monta o traçado de cada trecho a partir das arestas do `caminho` do Dijkstra; a API devolve `geometria` em cada trecho e o front desenha esse campo. Sem o arquivo, tudo cai na linha reta de hoje.

**Tech Stack:** Python 3.11+ (FastAPI, `httpx`, biblioteca padrão: `gzip`, `csv`, `sqlite3`), pytest (novo, só desenvolvimento), React + TypeScript + react-leaflet, GraphHopper 11.1 (`.jar`, só para gerar o arquivo), Java 17+.

**Spec:** `docs/superpowers/specs/2026-10-14-rotas-pelas-estradas-design.md`

## Global Constraints

- É **só visualização**: o grafo, o Dijkstra, a escolha da ordem de visita e as distâncias exibidas não mudam.
- A distância por estrada **não** é exibida.
- Em execução não há motor de roteamento, Java nem servidor extra; o GraphHopper não entra no repositório nem no `npm run setup`.
- Aresta sem rota por estrada (ou arquivo ausente) é desenhada em **linha reta**.
- Polyline: algoritmo do Google, **precisão 5**, pares `(lat, lon)`, escrito à mão (sem dependência nova).
- Arquivo: `backend/data/geometrias_arestas.csv.gz`, cabeçalho `origem_id,destino_id,polyline`, ordenado por `(origem_id, destino_id)`, com `origem_id < destino_id` como no banco.
- Simplificação de **~50 m**. Se o arquivo passar muito de **10 MB**, revisar a tolerância antes do commit.
- Coordenadas devolvidas pela API arredondadas para **5 casas decimais**.
- Endereço do GraphHopper: `http://127.0.0.1:8989` (**não** `localhost`: no Windows acrescenta ~2,7 s por requisição).
- pytest só via `backend/requirements-dev.txt`; `requirements.txt` não muda.
- Código, nomes e textos em **português**, seguindo o estilo do código existente (docstrings curtas, comentários só onde explicam um porquê).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Arquivo de geometrias corrompido ou truncado** (gzip quebrado, coluna faltando, polyline vazia): a API tem que subir normalmente e desenhar em linha reta, nunca cair no startup nem dar 500 numa rota. Teste em Task 1.
2. **Banco regenerado com arestas diferentes das do arquivo**: arestas sem geometria viram linha reta e chaves sobrando são ignoradas, sem erro. Teste em Task 1 (aresta faltando) e Task 2 (dicionário vazio na API).
3. **Aresta percorrida no sentido contrário ao gravado** (`a > b`): o traçado tem que ser invertido, senão a linha "pula" de uma ponta à outra. Teste em Task 1.
4. **Geração interrompida no meio** (GraphHopper derrubado por falta de memória, Ctrl+C): rodar de novo continua de onde parou, sem perder o que já foi gerado. Verificação manual em Task 3.
5. **Rota longa** (muitos destinos espalhados pelo Brasil): a resposta não pode ficar pesada a ponto de travar o navegador. Verificação manual do tamanho em Task 4.

---

### Task 1: Módulo `app/geometrias.py` com testes

**Files:**
- Create: `backend/app/geometrias.py`
- Create: `backend/tests/test_geometrias.py`
- Create: `backend/requirements-dev.txt`
- Modify: `.gitignore` (raiz do repositório)
- Modify: `README.md` (seção "Rodando cada parte separadamente")

**Interfaces:**
- Consumes: `app.grafo.Grafo` (atributo `municipios: dict[int, Municipio]`) e `app.grafo.Municipio(id, nome, uf, lat, lon)`.
- Produces:
  - `Ponto = tuple[float, float]` (lat, lon)
  - `Geometrias = dict[tuple[int, int], str]`, com chave `(menor_id, maior_id)` e polyline codificada
  - `CAMINHO_PADRAO: Path` → `backend/data/geometrias_arestas.csv.gz`
  - `codificar(pontos: list[Ponto]) -> str`
  - `decodificar(polyline: str) -> list[Ponto]`
  - `carregar_geometrias(caminho: Path = CAMINHO_PADRAO) -> Geometrias`
  - `geometria_do_caminho(caminho: list[int], geometrias: Geometrias, grafo: Grafo) -> list[Ponto]`

Todos os comandos desta task rodam de dentro de `backend/`. No Windows (Git Bash) o Python é `.venv/Scripts/python.exe`; no Linux/macOS, `.venv/bin/python`.

- [ ] **Step 1: Instalar o pytest e criar `requirements-dev.txt`**

Run:
```bash
.venv/Scripts/python.exe -m pip install --disable-pip-version-check pytest
.venv/Scripts/python.exe -m pip show pytest | grep Version
```

Crie `backend/requirements-dev.txt`, trocando `X.Y.Z` pela versão exata que o comando acima mostrou:
```
# Dependências só de desenvolvimento (testes). Instale com:
#   python -m pip install -r requirements-dev.txt
-r requirements.txt
pytest==X.Y.Z
```

Acrescente ao fim do `.gitignore` da raiz:
```
.pytest_cache/
backend/data/geometrias_arestas.csv.tmp
```

- [ ] **Step 2: Escrever os testes que falham**

Crie `backend/tests/test_geometrias.py`:
```python
import csv
import gzip

import pytest

from app.geometrias import carregar_geometrias, codificar, decodificar, geometria_do_caminho
from app.grafo import Grafo, Municipio

# Exemplo da documentação do algoritmo de polyline do Google.
EXEMPLO_GOOGLE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
PONTOS_GOOGLE = [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]

ESTRADA_1_2 = [(-5.0, -42.0), (-5.2, -41.5), (-5.0, -41.0)]
ESTRADA_2_3 = [(-5.0, -41.0), (-4.5, -40.9), (-4.0, -41.0)]


@pytest.fixture
def grafo():
    g = Grafo()
    g.adicionar_municipio(Municipio(1, "Alfa", "PI", -5.0, -42.0))
    g.adicionar_municipio(Municipio(2, "Beta", "PI", -5.0, -41.0))
    g.adicionar_municipio(Municipio(3, "Gama", "PI", -4.0, -41.0))
    g.adicionar_municipio(Municipio(4, "Delta", "PI", -4.123456789, -40.987654321))
    return g


def gravar_csv_gz(caminho, linhas):
    with gzip.open(caminho, "wt", encoding="utf-8", newline="") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["origem_id", "destino_id", "polyline"])
        escritor.writerows(linhas)


def test_decodificar_exemplo_do_google():
    assert decodificar(EXEMPLO_GOOGLE) == PONTOS_GOOGLE


def test_codificar_exemplo_do_google():
    assert codificar(PONTOS_GOOGLE) == EXEMPLO_GOOGLE


def test_codificar_e_decodificar_ida_e_volta():
    pontos = [(-5.08921, -42.80165), (-5.08921, -42.80165), (0.0, 0.0), (-33.75, 151.12345)]
    assert decodificar(codificar(pontos)) == pontos


def test_decodificar_vazio():
    assert decodificar("") == []


def test_caminho_no_sentido_gravado(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([1, 2], geometrias, grafo) == ESTRADA_1_2


def test_caminho_no_sentido_inverso(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([2, 1], geometrias, grafo) == ESTRADA_1_2[::-1]


def test_aresta_sem_geometria_vira_linha_reta(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([2, 3], geometrias, grafo) == [(-5.0, -41.0), (-4.0, -41.0)]


def test_sem_geometrias_liga_os_municipios_em_linha_reta(grafo):
    assert geometria_do_caminho([1, 2, 3], {}, grafo) == [(-5.0, -42.0), (-5.0, -41.0), (-4.0, -41.0)]


def test_juncao_entre_arestas_nao_repete_ponto(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2), (2, 3): codificar(ESTRADA_2_3)}
    assert geometria_do_caminho([1, 2, 3], geometrias, grafo) == ESTRADA_1_2 + ESTRADA_2_3[1:]


def test_mistura_estrada_e_linha_reta(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([1, 2, 3], geometrias, grafo) == ESTRADA_1_2 + [(-4.0, -41.0)]


def test_caminho_de_um_municipio(grafo):
    assert geometria_do_caminho([1], {}, grafo) == [(-5.0, -42.0)]


def test_caminho_vazio(grafo):
    assert geometria_do_caminho([], {}, grafo) == []


def test_linha_reta_arredonda_para_5_casas(grafo):
    assert geometria_do_caminho([3, 4], {}, grafo) == [(-4.0, -41.0), (-4.12346, -40.98765)]


def test_carregar_geometrias(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    gravar_csv_gz(arquivo, [[1, 2, codificar(ESTRADA_1_2)], [2, 3, codificar(ESTRADA_2_3)]])
    assert carregar_geometrias(arquivo) == {(1, 2): codificar(ESTRADA_1_2), (2, 3): codificar(ESTRADA_2_3)}


def test_carregar_ignora_linha_sem_polyline(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    gravar_csv_gz(arquivo, [[1, 2, codificar(ESTRADA_1_2)], [2, 3, ""]])
    assert carregar_geometrias(arquivo) == {(1, 2): codificar(ESTRADA_1_2)}


def test_carregar_arquivo_inexistente(tmp_path):
    assert carregar_geometrias(tmp_path / "nao-existe.csv.gz") == {}


def test_carregar_arquivo_corrompido(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    arquivo.write_bytes(b"isto nao e gzip")
    assert carregar_geometrias(arquivo) == {}


def test_carregar_arquivo_truncado(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    gravar_csv_gz(arquivo, [[1, 2, codificar(ESTRADA_1_2)]] * 200)
    arquivo.write_bytes(arquivo.read_bytes()[:-30])
    assert carregar_geometrias(arquivo) == {}


def test_carregar_arquivo_sem_as_colunas_esperadas(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    with gzip.open(arquivo, "wt", encoding="utf-8", newline="") as saida:
        saida.write("a,b\n1,2\n")
    assert carregar_geometrias(arquivo) == {}
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `.venv/Scripts/python.exe -m pytest tests -v`
Expected: erro de coleta `ModuleNotFoundError: No module named 'app.geometrias'`.

- [ ] **Step 4: Implementar `backend/app/geometrias.py`**

```python
"""Traçado das rotas pelas estradas: geometria pré-calculada de cada aresta do grafo.

As geometrias são geradas uma vez por scripts/gerar_geometrias.py (com o GraphHopper)
e guardadas como polylines codificadas (algoritmo do Google, precisão 5). Servem só
para o desenho no mapa: o Dijkstra e as distâncias continuam usando o grafo.
"""

import csv
import gzip
import logging
from pathlib import Path

from .grafo import Grafo

CAMINHO_PADRAO = Path(__file__).resolve().parent.parent / "data" / "geometrias_arestas.csv.gz"
CASAS_DECIMAIS = 5
FATOR = 10**CASAS_DECIMAIS

Ponto = tuple[float, float]  # (lat, lon)
Geometrias = dict[tuple[int, int], str]  # (menor_id, maior_id) -> polyline codificada

log = logging.getLogger(__name__)


def _codificar_numero(valor: int) -> str:
    valor = ~(valor << 1) if valor < 0 else valor << 1
    pedacos = []
    while valor >= 0x20:
        pedacos.append(chr((0x20 | (valor & 0x1F)) + 63))
        valor >>= 5
    pedacos.append(chr(valor + 63))
    return "".join(pedacos)


def codificar(pontos: list[Ponto]) -> str:
    """Polyline do Google: cada coordenada vira a diferença para a anterior, em blocos de 5 bits."""
    saida = []
    lat_anterior = lon_anterior = 0
    for lat, lon in pontos:
        lat_int, lon_int = round(lat * FATOR), round(lon * FATOR)
        saida.append(_codificar_numero(lat_int - lat_anterior))
        saida.append(_codificar_numero(lon_int - lon_anterior))
        lat_anterior, lon_anterior = lat_int, lon_int
    return "".join(saida)


def decodificar(polyline: str) -> list[Ponto]:
    pontos = []
    indice = lat = lon = 0
    while indice < len(polyline):
        deltas = []
        for _ in range(2):  # latitude, depois longitude
            resultado = deslocamento = 0
            while True:
                byte = ord(polyline[indice]) - 63
                indice += 1
                resultado |= (byte & 0x1F) << deslocamento
                deslocamento += 5
                if byte < 0x20:
                    break
            deltas.append(~(resultado >> 1) if resultado & 1 else resultado >> 1)
        lat += deltas[0]
        lon += deltas[1]
        pontos.append((lat / FATOR, lon / FATOR))
    return pontos


def carregar_geometrias(caminho: Path = CAMINHO_PADRAO) -> Geometrias:
    """Lê o .csv.gz mantendo as polylines codificadas (decodificar as ~20 mil custaria muita memória)."""
    if not caminho.exists():
        log.warning("Geometrias não encontradas em %s; as rotas serão desenhadas em linha reta.", caminho)
        return {}
    geometrias: Geometrias = {}
    try:
        with gzip.open(caminho, "rt", encoding="utf-8", newline="") as arquivo:
            for linha in csv.DictReader(arquivo):
                if linha["polyline"]:
                    geometrias[(int(linha["origem_id"]), int(linha["destino_id"]))] = linha["polyline"]
    except (OSError, EOFError, csv.Error, KeyError, ValueError) as erro:
        log.warning("Geometrias ilegíveis em %s (%s); as rotas serão desenhadas em linha reta.", caminho, erro)
        return {}
    return geometrias


def _ponto(grafo: Grafo, id_municipio: int) -> Ponto:
    municipio = grafo.municipios[id_municipio]
    return (round(municipio.lat, CASAS_DECIMAIS), round(municipio.lon, CASAS_DECIMAIS))


def geometria_do_caminho(caminho: list[int], geometrias: Geometrias, grafo: Grafo) -> list[Ponto]:
    """Junta o traçado de cada aresta do caminho; aresta sem geometria vira linha reta."""
    if len(caminho) == 1:
        return [_ponto(grafo, caminho[0])]
    pontos: list[Ponto] = []
    for a, b in zip(caminho, caminho[1:]):
        polyline = geometrias.get((min(a, b), max(a, b)))
        if polyline is None:
            trecho = [_ponto(grafo, a), _ponto(grafo, b)]
        else:
            trecho = decodificar(polyline)
            if a > b:  # gravada de min para max; aqui é percorrida ao contrário
                trecho.reverse()
        if pontos and trecho and pontos[-1] == trecho[0]:
            trecho = trecho[1:]
        pontos.extend(trecho)
    return pontos
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `.venv/Scripts/python.exe -m pytest tests -v`
Expected: todos os testes PASS.

- [ ] **Step 6: Documentar como rodar os testes no README**

Em `README.md`, na seção "### Rodando cada parte separadamente", logo depois do bloco de código (antes de "Para **regerar o banco**"), acrescente:

````markdown
Testes do backend (pytest, só para desenvolvimento):

```bash
cd backend
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows (Linux/macOS: .venv/bin/python)
.venv/Scripts/python -m pytest
```
````

- [ ] **Step 7: Commit**

```bash
git add .gitignore README.md backend/requirements-dev.txt backend/app/geometrias.py backend/tests/test_geometrias.py
git commit -m "feat(backend): módulo de geometrias das arestas (polyline) com testes"
```

---

### Task 2: API devolve `geometria` em cada trecho

**Files:**
- Modify: `backend/app/modelos.py` (classe `TrechoOut`)
- Modify: `backend/app/main.py` (imports, `ciclo_de_vida`, `calcular_rota`)
- Create: `backend/tests/test_api_rotas.py`

**Interfaces:**
- Consumes: `carregar_geometrias()` e `geometria_do_caminho(caminho, geometrias, grafo)` da Task 1.
- Produces: `TrechoOut.geometria: list[tuple[float, float]]`, que no JSON vira `"geometria": [[lat, lon], ...]` e está sempre preenchida; `app.state.geometrias: Geometrias`.

Comandos de dentro de `backend/`. Os testes precisam de `backend/data/rotas.db` (gerado pelo `npm run setup`) e são pulados se ele não existir.

- [ ] **Step 1: Escrever os testes que falham**

Crie `backend/tests/test_api_rotas.py`:
```python
import pytest
from fastapi.testclient import TestClient

from app.banco import CAMINHO_PADRAO
from app.main import app

pytestmark = pytest.mark.skipif(
    not CAMINHO_PADRAO.exists(), reason="rode npm run setup para gerar backend/data/rotas.db"
)

TERESINA, PARNAIBA = 2211001, 2207702
PEDIDO = {"origem_id": TERESINA, "destinos_ids": [PARNAIBA]}


@pytest.fixture
def cliente():
    with TestClient(app) as cliente:
        yield cliente


def test_todo_trecho_tem_geometria(cliente):
    resposta = cliente.post("/api/rotas", json=PEDIDO)
    assert resposta.status_code == 200
    for trecho in resposta.json()["trechos"]:
        assert len(trecho["geometria"]) >= 2
        assert all(len(ponto) == 2 for ponto in trecho["geometria"])


def test_sem_geometrias_desenha_linha_reta_pelos_municipios(cliente):
    cliente.app.state.geometrias = {}
    resposta = cliente.post("/api/rotas", json=PEDIDO)
    assert resposta.status_code == 200
    for trecho in resposta.json()["trechos"]:
        esperado = [[round(m["lat"], 5), round(m["lon"], 5)] for m in trecho["caminho"]]
        assert trecho["geometria"] == esperado
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `.venv/Scripts/python.exe -m pytest tests/test_api_rotas.py -v`
Expected: FAIL com `KeyError: 'geometria'`.

- [ ] **Step 3: Acrescentar o campo em `modelos.py`**

Em `backend/app/modelos.py`, a classe `TrechoOut` passa a ser:
```python
class TrechoOut(BaseModel):
    de: MunicipioOut
    para: MunicipioOut
    distancia_km: float
    caminho: list[MunicipioOut]
    geometria: list[tuple[float, float]]  # [lat, lon] pelas estradas; só para o desenho
```

- [ ] **Step 4: Carregar e usar as geometrias em `main.py`**

Em `backend/app/main.py`, acrescente o import (em ordem alfabética, depois de `from .geo import mais_proximo`):
```python
from .geometrias import carregar_geometrias, geometria_do_caminho
```

No `ciclo_de_vida`, logo depois de `app.state.grafo = carregar_grafo()`:
```python
    app.state.geometrias = carregar_geometrias()
```

Em `calcular_rota`, depois de `grafo = _grafo(request)`:
```python
    geometrias = request.app.state.geometrias
```
e no `TrechoOut(...)`, depois de `caminho=[municipio(i) for i in t.caminho],`:
```python
                geometria=geometria_do_caminho(t.caminho, geometrias, grafo),
```

- [ ] **Step 5: Rodar todos os testes**

Run: `.venv/Scripts/python.exe -m pytest -v`
Expected: todos PASS (os da API são pulados só se não houver `rotas.db`).

- [ ] **Step 6: Commit**

```bash
git add backend/app/modelos.py backend/app/main.py backend/tests/test_api_rotas.py
git commit -m "feat(api): trechos da rota trazem a geometria pelas estradas"
```

---

### Task 3: Gerador, configuração do GraphHopper, geração do arquivo e documentação

Esta task roda processos longos e pesados (download de 2,1 GB, import do Brasil, ~20 mil consultas). Deve ser executada **na sessão principal**, não por um subagente, e com Monitor ou `run_in_background` acompanhando os processos.

**Files:**
- Create: `backend/scripts/graphhopper.yml`
- Create: `backend/scripts/gerar_geometrias.py`
- Create: `backend/data/geometrias_arestas.csv.gz` (gerado)
- Modify: `README.md`

**Interfaces:**
- Consumes: `app.banco.CAMINHO_PADRAO`; `app.geometrias.CAMINHO_PADRAO`, `Ponto`, `carregar_geometrias`, `codificar` (Task 1).
- Produces: `backend/data/geometrias_arestas.csv.gz`, lido pela API da Task 2.

**Pasta de trabalho do GraphHopper (fora do repo):** chamada aqui de `$GH`. Nesta máquina use a pasta do spike, que já tem o JDK 21 portátil e o `graphhopper-web-11.1.jar`:
`C:/Users/062201~1/AppData/Local/Temp/claude/C--Users-062201593-Documents-me-facul-PIT-estrutura-de-dados-2/abe706cf-fae5-4c44-b066-ebca9a914386/scratchpad/gh`
Java: `$GH/jdk/jdk-21.0.12.1+1/bin/java`. **Cuidado:** não use `cd pasta && cmd1 & cmd2 &`: o `&` joga o `cd` para um subshell e os downloads caem no repositório (aconteceu no spike). Use caminhos absolutos ou `curl -o "$GH/arquivo"`.

- [ ] **Step 1: Criar `backend/scripts/graphhopper.yml`**

```yaml
# Configuração do GraphHopper usada SÓ para gerar backend/data/geometrias_arestas.csv.gz
# (veja "Regenerando as geometrias" no README). Enxuta para caber o Brasil inteiro na memória:
# sem Contraction Hierarchies (cada aresta é curta, a busca comum basta), sem ruas
# residenciais/de serviço (irrelevantes entre cidades) e com o grafo mapeado do disco.
graphhopper:
  datareader.file: ""  # passe com -Ddw.graphhopper.datareader.file=brazil-latest.osm.pbf
  graph.location: graph-cache
  profiles:
    - name: car
      custom_model_files: [car.json]
  profiles_ch: []
  profiles_lm: []
  graph.encoded_values: car_access, car_average_speed, road_access
  import.osm.ignored_highways: footway,construction,cycleway,path,steps,residential,service,living_street,pedestrian
  prepare.min_network_size: 200
  prepare.subnetworks.threads: 1
  routing.snap_preventions_default: tunnel, bridge, ferry
  routing.non_ch.max_waypoint_distance: 1000000
  routing.max_visited_nodes: 5000000
  graph.dataaccess.default_type: MMAP

server:
  application_connectors:
    - type: http
      port: 8989
      bind_host: 127.0.0.1
  admin_connectors:
    - type: http
      port: 8990
      bind_host: 127.0.0.1
```

- [ ] **Step 2: Criar `backend/scripts/gerar_geometrias.py`**

```python
"""Gera backend/data/geometrias_arestas.csv.gz: o traçado pelas estradas de cada aresta do grafo.

Precisa de um GraphHopper rodando (veja "Regenerando as geometrias" no README).
Uso (de qualquer pasta):  python backend/scripts/gerar_geometrias.py [--url URL] [--limite N] [--refazer]

Retoma de onde parou: as arestas que já estão no arquivo não são pedidas de novo
(--refazer começa do zero). Arestas sem rota por estrada ficam fora do arquivo e
a API as desenha em linha reta.
"""

import argparse
import csv
import gzip
import io
import sqlite3
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

RAIZ_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ_BACKEND))

from app.banco import CAMINHO_PADRAO as BANCO  # noqa: E402
from app.geometrias import CAMINHO_PADRAO as SAIDA  # noqa: E402
from app.geometrias import Geometrias, Ponto, carregar_geometrias, codificar  # noqa: E402

# 127.0.0.1, não localhost: no Windows o IPv6 é tentado antes e cada pedido fica ~2,7 s mais lento
URL_PADRAO = "http://127.0.0.1:8989"
TOLERANCIA_M = 50  # simplificação do traçado (Douglas-Peucker do GraphHopper), em metros
WORKERS = 4
SALVAR_A_CADA = 1000  # grava o progresso de tempos em tempos para poder retomar


def ler_grafo() -> tuple[dict[int, tuple[str, float, float]], list[tuple[int, int]]]:
    con = sqlite3.connect(BANCO.as_uri() + "?mode=ro", uri=True)
    try:
        municipios = {
            id_: (f"{nome} ({uf})", lat, lon)
            for id_, nome, uf, lat, lon in con.execute(
                "SELECT id, nome, uf, latitude, longitude FROM municipios"
            )
        }
        arestas = con.execute(
            "SELECT origem_id, destino_id FROM arestas ORDER BY origem_id, destino_id"
        ).fetchall()
    finally:
        con.close()
    return municipios, arestas


def pedir_rota(http: httpx.Client, url: str, origem: Ponto, destino: Ponto) -> tuple[list[Ponto] | None, str]:
    """Rota de carro entre dois pontos; devolve (pontos, "") ou (None, motivo)."""
    corpo = {
        "profile": "car",
        "points": [[origem[1], origem[0]], [destino[1], destino[0]]],  # o GraphHopper usa [lon, lat]
        "points_encoded": False,
        "instructions": False,
        "way_point_max_distance": TOLERANCIA_M,
    }
    resposta = http.post(f"{url}/route", json=corpo)
    if resposta.status_code != 200:
        try:
            motivo = resposta.json().get("message", "")
        except ValueError:  # erro sem corpo JSON
            motivo = ""
        return None, motivo or f"HTTP {resposta.status_code}"
    coordenadas = resposta.json()["paths"][0]["points"]["coordinates"]
    if len(coordenadas) < 2:
        return None, "rota vazia"
    return [(lat, lon) for lon, lat in coordenadas], ""


def gravar(geometrias: Geometrias) -> None:
    """Grava ordenado e com gzip sem data/nome no cabeçalho, para a saída ser determinística."""
    temporario = SAIDA.with_suffix(".tmp")
    with (
        open(temporario, "wb") as bruto,
        gzip.GzipFile(fileobj=bruto, mode="wb", filename="", mtime=0) as compactado,
        io.TextIOWrapper(compactado, encoding="utf-8", newline="") as texto,
    ):
        escritor = csv.writer(texto)
        escritor.writerow(["origem_id", "destino_id", "polyline"])
        for (a, b), polyline in sorted(geometrias.items()):
            escritor.writerow([a, b, polyline])
    temporario.replace(SAIDA)


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera as geometrias das arestas com o GraphHopper.")
    parser.add_argument("--url", default=URL_PADRAO, help=f"endereço do GraphHopper (padrão: {URL_PADRAO})")
    parser.add_argument("--limite", type=int, help="pede só as N primeiras arestas que faltam (para testar)")
    parser.add_argument("--refazer", action="store_true", help="ignora o arquivo existente e gera tudo de novo")
    args = parser.parse_args()

    try:
        httpx.get(f"{args.url}/info", timeout=5).raise_for_status()
    except httpx.HTTPError as erro:
        sys.exit(f"Erro: GraphHopper não respondeu em {args.url} ({erro}). Suba o servidor antes (veja o README).")

    municipios, arestas = ler_grafo()
    geometrias = {} if args.refazer or not SAIDA.exists() else carregar_geometrias(SAIDA)
    faltando = [aresta for aresta in arestas if aresta not in geometrias]
    if args.limite:
        faltando = faltando[: args.limite]
    print(f"{len(arestas)} arestas no grafo; {len(geometrias)} já no arquivo; pedindo {len(faltando)}.", flush=True)

    def processar(aresta: tuple[int, int]):
        a, b = aresta
        return aresta, pedir_rota(http, args.url, municipios[a][1:], municipios[b][1:])

    sem_rota: list[tuple[int, int, str]] = []
    inicio = time.perf_counter()
    http = httpx.Client(timeout=120)
    pool = ThreadPoolExecutor(WORKERS)
    try:
        for i, ((a, b), (pontos, motivo)) in enumerate(pool.map(processar, faltando), 1):
            if pontos is None:
                sem_rota.append((a, b, motivo))
            else:
                geometrias[(a, b)] = codificar(pontos)
            if i % SALVAR_A_CADA == 0:
                gravar(geometrias)
                print(f"  {i}/{len(faltando)} ({time.perf_counter() - inicio:.0f}s)", flush=True)
    except (httpx.TransportError, KeyboardInterrupt) as erro:
        gravar(geometrias)
        motivo = "Ctrl+C" if isinstance(erro, KeyboardInterrupt) else f"GraphHopper não respondeu: {erro}"
        sys.exit(f"\nInterrompido ({motivo}). O progresso foi salvo; rode de novo para continuar.")
    finally:
        pool.shutdown(wait=True, cancel_futures=True)
        http.close()

    gravar(geometrias)
    print(
        f"Pronto em {time.perf_counter() - inicio:.0f}s: {len(geometrias)}/{len(arestas)} arestas com geometria; "
        f"{len(sem_rota)} sem rota nesta execução; arquivo com {SAIDA.stat().st_size / 1_048_576:.1f} MB."
    )
    for a, b, motivo in sem_rota[:20]:
        print(f"  sem rota: {municipios[a][0]} – {municipios[b][0]}: {motivo}")
    if len(sem_rota) > 20:
        print(f"  … e mais {len(sem_rota) - 20}.")


if __name__ == "__main__":
    main()
```

Run (de `backend/`): `.venv/Scripts/python.exe -m py_compile scripts/gerar_geometrias.py && .venv/Scripts/python.exe scripts/gerar_geometrias.py --url http://127.0.0.1:9 --limite 1`
Expected: sai com `Erro: GraphHopper não respondeu em http://127.0.0.1:9 (...)`, sem criar `data/geometrias_arestas.csv.gz`.

- [ ] **Step 3: Baixar o extrato do Brasil**

Run (em background, ~10 min):
```bash
curl -L -o "$GH/brazil-latest.osm.pbf" https://download.geofabrik.de/south-america/brazil-latest.osm.pbf
```
Expected: arquivo com cerca de 2.094.537.623 bytes (`ls -l "$GH/brazil-latest.osm.pbf"`).

- [ ] **Step 4: Importar o Brasil e medir**

Apague o `graph-cache` do spike (é do Nordeste e com outra configuração) e rode o import em background, dentro de `$GH`, com `inicio=$(date +%s)` antes:
```bash
rm -rf "$GH/graph-cache"
cd "$GH" && "$GH/jdk/jdk-21.0.12.1+1/bin/java" -Xmx6g -Ddw.graphhopper.datareader.file=brazil-latest.osm.pbf -jar graphhopper-web-11.1.jar import "<repo>/backend/scripts/graphhopper.yml" > import.log 2>&1
```
(`<repo>` = caminho absoluto de `sistema-buscar-menor-rota`.)

Acompanhe com um Monitor que registra o pico de memória do processo `java` (como no spike: `Get-Process java | Measure-Object WorkingSet64 -Sum` a cada 10 s) e emite as linhas com `finished|took|Exception|ERROR|OutOfMemory`. Anote **tempo total, pico de RAM e tamanho de `$GH/graph-cache`** (`du -sh`).

Expected: o processo termina com código 0 e o log mostra o fim do import, sem `OutOfMemoryError`.
**Se der `OutOfMemoryError` ou o processo for encerrado por falta de memória:** siga o plano B (Step 7b) em vez dos Steps 5–7.

- [ ] **Step 5: Subir o servidor**

Em background, dentro de `$GH`:
```bash
cd "$GH" && "$GH/jdk/jdk-21.0.12.1+1/bin/java" -Xmx2g -Ddw.graphhopper.datareader.file=brazil-latest.osm.pbf -jar graphhopper-web-11.1.jar server "<repo>/backend/scripts/graphhopper.yml" > servidor.log 2>&1
```
Espere (com `until curl -s http://127.0.0.1:8989/info >/dev/null; do sleep 2; done` em background) até responder.

- [ ] **Step 6: Amostra de 50 arestas**

Run (de `backend/`): `.venv/Scripts/python.exe scripts/gerar_geometrias.py --limite 50`
Expected: `50 arestas pedidas`, quase todas com geometria, poucos segundos no total. Confira:
```bash
.venv/Scripts/python.exe -c "from app.geometrias import carregar_geometrias, decodificar; g = carregar_geometrias(); k = next(iter(g)); print(len(g), k, decodificar(g[k])[:3])"
```
Expected: ~50 entradas; os pontos decodificados ficam perto das coordenadas dos dois municípios da aresta.

Teste a **retomada**: rode `--limite 50` de novo; a mensagem inicial tem que dizer `50 já no arquivo` e pedir as 50 seguintes.

- [ ] **Step 7: Geração completa**

Run (de `backend/`, em background, com Monitor nas linhas de progresso e erros): `.venv/Scripts/python.exe scripts/gerar_geometrias.py`
Expected: termina com `Pronto em …: N/19937 arestas com geometria`, com N perto de 19.937, e o tamanho do arquivo.
- Se o processo for interrompido, basta rodar o mesmo comando de novo: ele continua.
- Se o arquivo passar muito de **10 MB**, mude `TOLERANCIA_M` para `100` e rode com `--refazer`.
- Revise a lista de "sem rota": devem ser ilhas ou casos de balsa. Se houver muitas arestas comuns com `Connection between locations not found` ou `max_visited_nodes`, investigue antes de seguir.

- [ ] **Step 7b (só se o Step 4 falhar por memória): gerar por região**

Para cada região em `norte nordeste centro-oeste sudeste sul`:
1. Baixe `https://download.geofabrik.de/south-america/brazil/<regiao>-latest.osm.pbf` para `$GH`.
2. Pare o servidor anterior, apague `$GH/graph-cache`, importe e suba o servidor como nos Steps 4–5, trocando o `.pbf`.
3. Rode `scripts/gerar_geometrias.py` sem `--refazer`. Ele só pede as arestas que ainda faltam.

As arestas que cruzam a divisa entre regiões falham em todas as passadas e ficam em linha reta. Registre no relatório final quantas foram.

- [ ] **Step 8: Conferir a API com o arquivo real**

Run (de `backend/`): `.venv/Scripts/python.exe -m pytest -v`
Expected: todos PASS. Depois:
```bash
.venv/Scripts/python.exe -c "
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    r = c.post('/api/rotas', json={'origem_id': 2211001, 'destinos_ids': [2304400, 2611606, 2927408]}).json()
    for t in r['trechos']:
        print(t['de']['nome'], '->', t['para']['nome'], len(t['caminho']), 'municípios,', len(t['geometria']), 'pontos')
"
```
Expected: cada trecho com muito mais pontos de geometria do que municípios no caminho.

- [ ] **Step 9: Documentar no README**

Faça estas mudanças em `README.md`, trocando `<tempo>`, `<RAM>` e `<tamanho>` pelos valores medidos nos Steps 4 e 7:

1. Depois da seção "### 3. Autocomplete de municípios (`GET /api/municipios`)" (antes de "### Complexidades"), acrescente:

````markdown
### 4. Traçado pelas estradas (só no mapa)

O mapa desenha cada trecho seguindo as estradas reais. Como o grafo é fixo, a geometria de cada uma das ~20 mil arestas foi calculada **uma vez** com o [GraphHopper](https://github.com/graphhopper/graphhopper) sobre os dados do OpenStreetMap e guardada em `backend/data/geometrias_arestas.csv.gz` (polylines codificadas, <tamanho>). Ao responder `POST /api/rotas`, o backend (`app/geometrias.py`) junta as geometrias das arestas do caminho de cada trecho, invertendo as que são percorridas no sentido contrário. Aresta sem geometria (ilha, acesso só por balsa ou arquivo ausente) é desenhada em linha reta.

**O traçado é só visual:** o Dijkstra, a ordem de visita e as distâncias continuam usando o grafo.

#### Regenerando as geometrias

Só é preciso se o grafo mudar (por exemplo, depois de alterar `construir_banco.py`). Leva <tempo> e usa cerca de <RAM> de memória. Precisa de **Java 17+**.

```bash
# numa pasta FORA do repositório
curl -LO https://github.com/graphhopper/graphhopper/releases/download/11.1/graphhopper-web-11.1.jar
curl -LO https://download.geofabrik.de/south-america/brazil-latest.osm.pbf     # ~2,1 GB
java -Xmx6g -Ddw.graphhopper.datareader.file=brazil-latest.osm.pbf -jar graphhopper-web-11.1.jar import <repo>/backend/scripts/graphhopper.yml
java -Xmx2g -Ddw.graphhopper.datareader.file=brazil-latest.osm.pbf -jar graphhopper-web-11.1.jar server <repo>/backend/scripts/graphhopper.yml

# em outro terminal, na raiz do repositório (Linux/macOS: backend/.venv/bin/python)
backend/.venv/Scripts/python backend/scripts/gerar_geometrias.py --refazer
```

Se o gerador for interrompido, rode de novo sem `--refazer`: ele continua de onde parou.
````

Se a geração usou o plano B (Step 7b), descreva no README o passo a passo por região em vez do Brasil inteiro.

2. Em "### Limitação importante", troque o parágrafo por:

```markdown
As distâncias são **aproximadas**: somam linhas retas entre municípios vizinhos, não quilômetros reais de estrada. O traçado no mapa segue as estradas, mas os km exibidos continuam sendo os do grafo. A rota mostra uma boa ordem de visita e por quais regiões passar, mas não substitui um GPS.
```

3. Em "## Estrutura de pastas", troque as linhas de `requirements.txt`, `data/` e `scripts/construir_banco.py` por:

```
│   ├── requirements.txt
│   ├── requirements-dev.txt  pytest (só desenvolvimento)
│   ├── data/               CSVs dos municípios, geometrias_arestas.csv.gz (+ rotas.db gerado)
│   ├── scripts/            construir_banco.py, gerar_geometrias.py, graphhopper.yml
│   ├── tests/              testes (pytest)
```

e, na lista de `app/`, depois da linha de `geo.py`:

```
│       ├── geometrias.py   traçado pelas estradas (polylines das arestas)
```

4. Em "### `POST /api/rotas`", no exemplo de resposta, troque a linha do trecho por:

```json
    { "de": { ... }, "para": { ... }, "distancia_km": 281.9, "caminho": [ { ... }, { ... } ],
      "geometria": [ [-5.08921, -42.80165], [-5.08874, -42.80102], ... ] }
```

e acrescente, logo depois do bloco da resposta:

```markdown
`geometria` é o traçado do trecho pelas estradas (`[lat, lon]`), só para o desenho; sem o arquivo de geometrias, ela liga os municípios do `caminho` em linha reta.
```

5. Em "## Problemas comuns", acrescente a linha:

```markdown
| Rota desenhada em linha reta, e o terminal `[api]` avisa "Geometrias não encontradas" ou "ilegíveis" | O arquivo `backend/data/geometrias_arestas.csv.gz` sumiu ou corrompeu. Restaure com `git checkout -- backend/data/geometrias_arestas.csv.gz`. |
```

6. Em "## Fontes e créditos", acrescente:

```markdown
- Traçado das estradas: calculado com o [GraphHopper](https://github.com/graphhopper/graphhopper) (Apache 2.0) sobre dados © [contribuidores do OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL); extrato do Brasil da [Geofabrik](https://download.geofabrik.de/).
```

- [ ] **Step 10: Commit**

```bash
git add backend/scripts/graphhopper.yml backend/scripts/gerar_geometrias.py backend/data/geometrias_arestas.csv.gz README.md
git commit -m "feat: geometrias das arestas pelas estradas geradas com o GraphHopper"
```

---

### Task 4: Front desenha a geometria

**Files:**
- Modify: `frontend/src/api/cliente.ts` (interface `Trecho`)
- Modify: `frontend/src/components/MapaRota.tsx` (`linha`)
- Modify: `frontend/src/components/ResultadoRota.tsx` (texto da dica de distâncias)

**Interfaces:**
- Consumes: `"geometria": [[lat, lon], ...]` em cada trecho de `POST /api/rotas` (Task 2).
- Produces: nada para outras tasks.

Comandos de dentro de `frontend/`.

- [ ] **Step 1: Tipo do trecho**

Em `frontend/src/api/cliente.ts`, a interface `Trecho` passa a ser:
```ts
export interface Trecho {
  de: Municipio
  para: Municipio
  distancia_km: number
  caminho: Municipio[]
  geometria: [number, number][] // [lat, lon] pelas estradas; só para o desenho
}
```

- [ ] **Step 2: Desenhar a geometria**

Em `frontend/src/components/MapaRota.tsx`, troque o `useMemo` de `linha` por:
```tsx
  const linha = useMemo<LatLngTuple[]>(() => (rota ? rota.trechos.flatMap((t) => t.geometria) : []), [rota])
```

- [ ] **Step 3: Ajustar a dica de distâncias**

Em `frontend/src/components/ResultadoRota.tsx`, troque:
```tsx
      <p className="hint">Distâncias aproximadas (linha reta entre municípios vizinhos).</p>
```
por:
```tsx
      <p className="hint">
        O traçado segue as estradas, mas as distâncias são aproximadas (linha reta entre municípios vizinhos).
      </p>
```

- [ ] **Step 4: Lint e build**

Run: `npm run lint && npm run build`
Expected: os dois sem erros.

- [ ] **Step 5: Conferir no navegador**

Na raiz do repositório, rode `npm run dev` em background. No navegador (claude-in-chrome), abra o endereço que aparece nas linhas `[web]`, escolha a origem Teresina e os destinos Fortaleza, Recife e Salvador e calcule a rota.

Expected: a linha laranja segue as estradas (curvas, não segmentos retos entre cidades); os marcadores, tooltips e o enquadramento continuam como antes; o painel mostra os mesmos km de antes da mudança.

Confira o tamanho de uma rota longa com 8 destinos espalhados pelo país:
```bash
curl -s -o /dev/null -w "%{size_download} bytes\n" -X POST http://127.0.0.1:8000/api/rotas -H "Content-Type: application/json" -d '{"origem_id": 4314902, "destinos_ids": [1302603, 2211001, 3550308, 5300108, 2927408, 1501402, 4106902, 5103403]}'
```
(Porto Alegre → Manaus, Teresina, São Paulo, Brasília, Salvador, Belém, Curitiba, Cuiabá; use a porta da API mostrada pelo `npm run dev`.)
Expected: alguns MB no máximo, e a rota desenha no navegador sem travar. Registre o tamanho no relatório final. Se passar de ~5 MB, avise antes de seguir: pode ser preciso simplificar mais.

Pare o `npm run dev` ao terminar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/cliente.ts frontend/src/components/MapaRota.tsx frontend/src/components/ResultadoRota.tsx
git commit -m "feat(frontend): mapa desenha a rota pelas estradas"
```
