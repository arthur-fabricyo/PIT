"""API do Sistema de Rotas do Brasil."""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request

from .banco import carregar_grafo
from .geo import mais_proximo
from .grafo import Grafo
from .modelos import MunicipioOut, PedidoRota, ResultadoBusca, RotaOut, TrechoOut
from .nominatim import ClienteNominatim, NominatimIndisponivel
from .planejamento import ErroPlanejamento, planejar


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    app.state.grafo = carregar_grafo()
    app.state.nominatim = ClienteNominatim()
    yield
    await app.state.nominatim.fechar()


app = FastAPI(
    title="Rotas do Brasil",
    description="Melhor rota entre municípios brasileiros usando grafos (Estrutura de Dados II).",
    lifespan=ciclo_de_vida,
)


def _grafo(request: Request) -> Grafo:
    return request.app.state.grafo


@app.get("/api/busca", response_model=list[ResultadoBusca])
async def buscar(request: Request, q: Annotated[str, Query(max_length=200)]):
    texto = q.strip()
    if len(texto) < 2:
        raise HTTPException(400, "Digite pelo menos 2 caracteres para buscar.")
    try:
        lugares = await request.app.state.nominatim.buscar(texto)
    except NominatimIndisponivel:
        raise HTTPException(502, "Busca indisponível no momento; tente clicar no mapa.") from None
    municipios = _grafo(request).municipios.values()
    return [
        ResultadoBusca(
            rotulo=lugar.rotulo,
            lat=lugar.lat,
            lon=lugar.lon,
            municipio=MunicipioOut.de(mais_proximo(municipios, lugar.lat, lugar.lon)),
        )
        for lugar in lugares
    ]


@app.get("/api/municipios/proximo", response_model=MunicipioOut)
def municipio_proximo(
    request: Request,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
):
    return MunicipioOut.de(mais_proximo(_grafo(request).municipios.values(), lat, lon))


@app.post("/api/rotas", response_model=RotaOut)
def calcular_rota(request: Request, pedido: PedidoRota):
    grafo = _grafo(request)
    try:
        plano = planejar(grafo, pedido.origem_id, pedido.destinos_ids)
    except ErroPlanejamento as erro:
        raise HTTPException(erro.status, erro.mensagem) from None

    def municipio(id_: int) -> MunicipioOut:
        return MunicipioOut.de(grafo.municipios[id_])

    return RotaOut(
        distancia_total_km=plano.distancia_total_km,
        metodo=plano.metodo,
        ordem=[municipio(i) for i in plano.ordem],
        trechos=[
            TrechoOut(
                de=municipio(t.de),
                para=municipio(t.para),
                distancia_km=t.distancia_km,
                caminho=[municipio(i) for i in t.caminho],
            )
            for t in plano.trechos
        ],
    )
