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
