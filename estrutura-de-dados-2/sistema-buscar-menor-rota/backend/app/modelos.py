"""Schemas de entrada e saída da API (validação e documentação em /docs)."""

from typing import Literal

from pydantic import BaseModel

from .grafo import Municipio


class MunicipioOut(BaseModel):
    id: int
    nome: str
    uf: str
    lat: float
    lon: float

    @classmethod
    def de(cls, municipio: Municipio) -> "MunicipioOut":
        return cls(
            id=municipio.id, nome=municipio.nome, uf=municipio.uf, lat=municipio.lat, lon=municipio.lon
        )


class ResultadoBusca(BaseModel):
    rotulo: str
    lat: float
    lon: float
    municipio: MunicipioOut


class PedidoRota(BaseModel):
    origem_id: int
    destinos_ids: list[int]


class TrechoOut(BaseModel):
    de: MunicipioOut
    para: MunicipioOut
    distancia_km: float
    caminho: list[MunicipioOut]


class RotaOut(BaseModel):
    distancia_total_km: float
    metodo: Literal["forca_bruta", "heuristica"]
    ordem: list[MunicipioOut]
    trechos: list[TrechoOut]
