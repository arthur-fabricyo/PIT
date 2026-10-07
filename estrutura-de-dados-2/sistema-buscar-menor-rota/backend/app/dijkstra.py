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
