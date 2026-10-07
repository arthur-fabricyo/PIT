"""Cliente do Nominatim (OpenStreetMap) respeitando a política de uso.

Política: https://operations.osmfoundation.org/policies/nominatim/
- no máximo 1 requisição por segundo;
- User-Agent identificando a aplicação;
- resultados repetidos devem vir de cache;
- sem autocomplete (o front só busca ao enviar).
"""

import asyncio
import os
import time
from collections import OrderedDict
from dataclasses import dataclass

import httpx

URL_BUSCA = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "RotasBrasil/1.0 (trabalho academico de Estrutura de Dados II)"
INTERVALO_MINIMO_S = 1.0
TAMANHO_CACHE = 256
TIMEOUT_S = 10.0


@dataclass(frozen=True)
class LugarEncontrado:
    rotulo: str
    lat: float
    lon: float


class NominatimIndisponivel(Exception):
    pass


class ClienteNominatim:
    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=TIMEOUT_S, headers={"User-Agent": USER_AGENT})
        self._trava = asyncio.Lock()
        self._ultima_requisicao = 0.0
        self._cache: OrderedDict[str, list[LugarEncontrado]] = OrderedDict()

    def _do_cache(self, chave: str) -> list[LugarEncontrado] | None:
        if chave in self._cache:
            self._cache.move_to_end(chave)
            return self._cache[chave]
        return None

    async def buscar(self, texto: str) -> list[LugarEncontrado]:
        chave = " ".join(texto.lower().split())
        if (em_cache := self._do_cache(chave)) is not None:
            return em_cache

        async with self._trava:  # serializa as chamadas para respeitar 1 req/s
            if (em_cache := self._do_cache(chave)) is not None:
                return em_cache
            espera = INTERVALO_MINIMO_S - (time.monotonic() - self._ultima_requisicao)
            if espera > 0:
                await asyncio.sleep(espera)
            parametros = {
                "q": texto,
                "format": "jsonv2",
                "countrycodes": "br",
                "limit": 5,
                "accept-language": "pt-BR",
            }
            if email := os.environ.get("NOMINATIM_EMAIL"):
                parametros["email"] = email
            try:
                resposta = await self._http.get(URL_BUSCA, params=parametros)
                resposta.raise_for_status()
                dados = resposta.json()
                lugares = [
                    LugarEncontrado(item["display_name"], float(item["lat"]), float(item["lon"]))
                    for item in dados
                ]
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as erro:
                raise NominatimIndisponivel() from erro
            finally:
                self._ultima_requisicao = time.monotonic()

        self._cache[chave] = lugares
        if len(self._cache) > TAMANHO_CACHE:
            self._cache.popitem(last=False)
        return lugares

    async def fechar(self) -> None:
        await self._http.aclose()
