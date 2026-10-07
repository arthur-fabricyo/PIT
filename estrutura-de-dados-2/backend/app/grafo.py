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
