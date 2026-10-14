"""Gera backend/data/geometrias_arestas.csv.gz: o traçado pelas estradas de cada aresta do grafo.

Precisa de um GraphHopper rodando (veja "Regenerando as geometrias" no README).
Uso (de qualquer pasta):
  python backend/scripts/gerar_geometrias.py [--url URL] [--limite N] [--refazer] [--workers N]

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
    if resposta.status_code >= 500:  # problema no servidor (ex.: sem memória), não ausência de rota
        resposta.raise_for_status()
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
    parser.add_argument("--workers", type=int, default=WORKERS, help=f"pedidos simultâneos (padrão: {WORKERS})")
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
    pool = ThreadPoolExecutor(args.workers)
    try:
        for i, ((a, b), (pontos, motivo)) in enumerate(pool.map(processar, faltando), 1):
            if pontos is None:
                sem_rota.append((a, b, motivo))
            else:
                geometrias[(a, b)] = codificar(pontos)
            if i % SALVAR_A_CADA == 0:
                gravar(geometrias)
                print(f"  {i}/{len(faltando)} ({time.perf_counter() - inicio:.0f}s)", flush=True)
    except (Exception, KeyboardInterrupt) as erro:  # qualquer falha: salva o que já foi gerado
        gravar(geometrias)
        motivo = "Ctrl+C" if isinstance(erro, KeyboardInterrupt) else f"{type(erro).__name__}: {erro}"
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
