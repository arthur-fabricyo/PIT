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
