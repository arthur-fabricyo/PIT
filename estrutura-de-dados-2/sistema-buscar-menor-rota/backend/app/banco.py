"""Acesso ao SQLite: criação do schema, gravação e carga do grafo."""

import sqlite3
from collections.abc import Iterable
from pathlib import Path

from .grafo import Grafo, Municipio

CAMINHO_PADRAO = Path(__file__).resolve().parent.parent / "data" / "rotas.db"

SCHEMA = """
CREATE TABLE municipios (
  id        INTEGER PRIMARY KEY,
  nome      TEXT    NOT NULL,
  uf        TEXT    NOT NULL,
  latitude  REAL    NOT NULL,
  longitude REAL    NOT NULL
);

CREATE TABLE arestas (
  origem_id    INTEGER NOT NULL REFERENCES municipios(id),
  destino_id   INTEGER NOT NULL REFERENCES municipios(id),
  distancia_km REAL    NOT NULL,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('knn', 'mst')),
  PRIMARY KEY (origem_id, destino_id),
  CHECK (origem_id < destino_id)
);
"""


def criar_schema(con: sqlite3.Connection) -> None:
    con.executescript(SCHEMA)


def inserir_municipios(con: sqlite3.Connection, municipios: Iterable[Municipio]) -> None:
    con.executemany(
        "INSERT INTO municipios (id, nome, uf, latitude, longitude) VALUES (?, ?, ?, ?, ?)",
        ((m.id, m.nome, m.uf, m.lat, m.lon) for m in municipios),
    )


def inserir_arestas(
    con: sqlite3.Connection, arestas: Iterable[tuple[int, int, float, str]]
) -> None:
    """Cada aresta é (origem_id, destino_id, distancia_km, tipo) com origem_id < destino_id."""
    con.executemany(
        "INSERT INTO arestas (origem_id, destino_id, distancia_km, tipo) VALUES (?, ?, ?, ?)",
        arestas,
    )


def carregar_grafo(caminho: Path = CAMINHO_PADRAO) -> Grafo:
    if not caminho.exists():
        raise FileNotFoundError(
            f"Banco não encontrado em {caminho}. Gere com: python backend/scripts/construir_banco.py"
        )
    # as_uri() codifica espaços/acentos; mode=ro garante que o servidor não altera o banco
    con = sqlite3.connect(caminho.as_uri() + "?mode=ro", uri=True)
    try:
        grafo = Grafo()
        for id_, nome, uf, lat, lon in con.execute(
            "SELECT id, nome, uf, latitude, longitude FROM municipios"
        ):
            grafo.adicionar_municipio(Municipio(id_, nome, uf, lat, lon))
        for a, b, distancia in con.execute(
            "SELECT origem_id, destino_id, distancia_km FROM arestas"
        ):
            grafo.adicionar_aresta(a, b, distancia)
        return grafo
    finally:
        con.close()
