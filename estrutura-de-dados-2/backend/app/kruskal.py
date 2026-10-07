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
