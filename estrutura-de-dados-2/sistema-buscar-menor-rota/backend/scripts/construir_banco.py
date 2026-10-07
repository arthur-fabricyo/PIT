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
