"""Índice de nomes de municípios para autocomplete (listas ordenadas + busca binária)."""

import re
import unicodedata
from bisect import bisect_left
from collections.abc import Iterable

from .grafo import Municipio

_PONTUACAO = re.compile(r"[,\-'.]")


def normalizar(texto: str) -> str:
    """Minúsculas, sem acentos nem pontuação, com espaços colapsados. O(m)."""
    decomposto = unicodedata.normalize("NFD", texto)
    sem_marcas = "".join(c for c in decomposto if not unicodedata.combining(c))
    return " ".join(_PONTUACAO.sub(" ", sem_marcas.casefold()).split())


class IndiceNomes:
    """Busca de municípios por prefixo do nome ou de qualquer palavra do nome."""

    def __init__(self, municipios: Iterable[Municipio]) -> None:
        self._por_id: dict[int, Municipio] = {}
        self._nome_de: dict[int, str] = {}
        self._nomes: list[tuple[str, int]] = []
        self._palavras: list[tuple[str, int]] = []
        for municipio in municipios:
            nome = normalizar(municipio.nome)
            self._por_id[municipio.id] = municipio
            self._nome_de[municipio.id] = nome
            self._nomes.append((nome, municipio.id))
            self._palavras.extend((palavra, municipio.id) for palavra in nome.split())
        self._nomes.sort()
        self._palavras.sort()
        self._ufs = {m.uf for m in self._por_id.values()}

    def buscar(self, texto: str, limite: int = 8) -> list[Municipio]:
        """Até `limite` municípios: nome começa com o texto, depois alguma palavra, depois contém.

        Grupos 1 e 2: busca binária, O(log n + k). Grupo 3: varredura O(n), só se faltar resultado.
        Se o último termo é uma UF ("santa luzia pi"), os resultados do texto inteiro vêm primeiro
        (o usuário pode estar digitando "sao pa") e depois os do texto sem a UF, filtrados por ela.
        """
        tokens = normalizar(texto).split()
        if not tokens:
            return []
        resultado = self._buscar_grupos(" ".join(tokens), None, limite)
        if len(tokens) > 1 and tokens[-1].upper() in self._ufs:
            vistos = {m.id for m in resultado}
            filtrados = self._buscar_grupos(" ".join(tokens[:-1]), tokens[-1].upper(), limite)
            resultado += [m for m in filtrados if m.id not in vistos]
        return resultado[:limite]

    def _buscar_grupos(self, prefixo: str, uf: str | None, limite: int) -> list[Municipio]:
        def aceita(id_: int) -> bool:
            return uf is None or self._por_id[id_].uf == uf

        vistos: set[int] = set()
        resultado: list[Municipio] = []

        def acrescentar(grupo: list[tuple[str, int]]) -> None:
            grupo.sort(key=lambda par: (len(par[0]), par[0], par[1]))
            for _, id_ in grupo:
                if id_ not in vistos:
                    vistos.add(id_)
                    resultado.append(self._por_id[id_])

        for lista in (self._nomes, self._palavras):
            grupo = []
            i = bisect_left(lista, (prefixo,))
            while i < len(lista) and lista[i][0].startswith(prefixo):
                if aceita(lista[i][1]):
                    # a palavra casada só decide o grupo; a ordem usa o nome inteiro
                    grupo.append((self._nome_de[lista[i][1]], lista[i][1]))
                i += 1
            acrescentar(grupo)
            if len(resultado) >= limite:
                return resultado[:limite]

        acrescentar([(n, i) for n, i in self._nomes if prefixo in n and aceita(i)])
        return resultado[:limite]
