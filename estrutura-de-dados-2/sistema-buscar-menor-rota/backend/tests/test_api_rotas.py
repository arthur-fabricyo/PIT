import pytest
from fastapi.testclient import TestClient

from app.banco import CAMINHO_PADRAO
from app.main import app

pytestmark = pytest.mark.skipif(
    not CAMINHO_PADRAO.exists(), reason="rode npm run setup para gerar backend/data/rotas.db"
)

TERESINA, PARNAIBA = 2211001, 2207702
PEDIDO = {"origem_id": TERESINA, "destinos_ids": [PARNAIBA]}


@pytest.fixture
def cliente():
    with TestClient(app) as cliente:
        yield cliente


def test_todo_trecho_tem_geometria(cliente):
    resposta = cliente.post("/api/rotas", json=PEDIDO)
    assert resposta.status_code == 200
    for trecho in resposta.json()["trechos"]:
        assert len(trecho["geometria"]) >= 2
        assert all(len(ponto) == 2 for ponto in trecho["geometria"])


def test_sem_geometrias_desenha_linha_reta_pelos_municipios(cliente):
    cliente.app.state.geometrias = {}
    resposta = cliente.post("/api/rotas", json=PEDIDO)
    assert resposta.status_code == 200
    for trecho in resposta.json()["trechos"]:
        esperado = [[round(m["lat"], 5), round(m["lon"], 5)] for m in trecho["caminho"]]
        assert trecho["geometria"] == esperado
