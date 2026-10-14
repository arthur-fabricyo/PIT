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
