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
