import csv
import gzip

import pytest

from app.geometrias import carregar_geometrias, codificar, decodificar, geometria_do_caminho
from app.grafo import Grafo, Municipio

# Exemplo da documentação do algoritmo de polyline do Google.
EXEMPLO_GOOGLE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
PONTOS_GOOGLE = [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]

ESTRADA_1_2 = [(-5.0, -42.0), (-5.2, -41.5), (-5.0, -41.0)]
ESTRADA_2_3 = [(-5.0, -41.0), (-4.5, -40.9), (-4.0, -41.0)]


@pytest.fixture
def grafo():
    g = Grafo()
    g.adicionar_municipio(Municipio(1, "Alfa", "PI", -5.0, -42.0))
    g.adicionar_municipio(Municipio(2, "Beta", "PI", -5.0, -41.0))
    g.adicionar_municipio(Municipio(3, "Gama", "PI", -4.0, -41.0))
    g.adicionar_municipio(Municipio(4, "Delta", "PI", -4.123456789, -40.987654321))
    return g


def gravar_csv_gz(caminho, linhas):
    with gzip.open(caminho, "wt", encoding="utf-8", newline="") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["origem_id", "destino_id", "polyline"])
        escritor.writerows(linhas)


def test_decodificar_exemplo_do_google():
    assert decodificar(EXEMPLO_GOOGLE) == PONTOS_GOOGLE


def test_codificar_exemplo_do_google():
    assert codificar(PONTOS_GOOGLE) == EXEMPLO_GOOGLE


def test_codificar_e_decodificar_ida_e_volta():
    pontos = [(-5.08921, -42.80165), (-5.08921, -42.80165), (0.0, 0.0), (-33.75, 151.12345)]
    assert decodificar(codificar(pontos)) == pontos


def test_decodificar_vazio():
    assert decodificar("") == []


def test_caminho_no_sentido_gravado(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([1, 2], geometrias, grafo) == ESTRADA_1_2


def test_caminho_no_sentido_inverso(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([2, 1], geometrias, grafo) == ESTRADA_1_2[::-1]


def test_aresta_sem_geometria_vira_linha_reta(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([2, 3], geometrias, grafo) == [(-5.0, -41.0), (-4.0, -41.0)]


def test_sem_geometrias_liga_os_municipios_em_linha_reta(grafo):
    assert geometria_do_caminho([1, 2, 3], {}, grafo) == [(-5.0, -42.0), (-5.0, -41.0), (-4.0, -41.0)]


def test_juncao_entre_arestas_nao_repete_ponto(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2), (2, 3): codificar(ESTRADA_2_3)}
    assert geometria_do_caminho([1, 2, 3], geometrias, grafo) == ESTRADA_1_2 + ESTRADA_2_3[1:]


def test_mistura_estrada_e_linha_reta(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)}
    assert geometria_do_caminho([1, 2, 3], geometrias, grafo) == ESTRADA_1_2 + [(-4.0, -41.0)]


def test_caminho_de_um_municipio(grafo):
    assert geometria_do_caminho([1], {}, grafo) == [(-5.0, -42.0)]


def test_caminho_vazio(grafo):
    assert geometria_do_caminho([], {}, grafo) == []


def test_linha_reta_arredonda_para_5_casas(grafo):
    assert geometria_do_caminho([3, 4], {}, grafo) == [(-4.0, -41.0), (-4.12346, -40.98765)]


def test_carregar_geometrias(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    gravar_csv_gz(arquivo, [[1, 2, codificar(ESTRADA_1_2)], [2, 3, codificar(ESTRADA_2_3)]])
    assert carregar_geometrias(arquivo) == {(1, 2): codificar(ESTRADA_1_2), (2, 3): codificar(ESTRADA_2_3)}


def test_carregar_ignora_linha_sem_polyline(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    gravar_csv_gz(arquivo, [[1, 2, codificar(ESTRADA_1_2)], [2, 3, ""]])
    assert carregar_geometrias(arquivo) == {(1, 2): codificar(ESTRADA_1_2)}


def test_carregar_arquivo_inexistente(tmp_path):
    assert carregar_geometrias(tmp_path / "nao-existe.csv.gz") == {}


def test_carregar_arquivo_corrompido(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    arquivo.write_bytes(b"isto nao e gzip")
    assert carregar_geometrias(arquivo) == {}


def test_carregar_arquivo_truncado(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    gravar_csv_gz(arquivo, [[1, 2, codificar(ESTRADA_1_2)]] * 200)
    arquivo.write_bytes(arquivo.read_bytes()[:-30])
    assert carregar_geometrias(arquivo) == {}


def test_carregar_arquivo_sem_as_colunas_esperadas(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    with gzip.open(arquivo, "wt", encoding="utf-8", newline="") as saida:
        saida.write("a,b\n1,2\n")
    assert carregar_geometrias(arquivo) == {}


def test_carregar_arquivo_com_miolo_corrompido(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    gravar_csv_gz(arquivo, [[i, i + 1, codificar([(-5.0 - i / 1000, -42.0), (-5.2, -41.5 + i / 997)])] for i in range(500)])
    bruto = bytearray(arquivo.read_bytes())
    meio = len(bruto) // 2
    bruto[meio : meio + 8] = b"\xff" * 8
    arquivo.write_bytes(bytes(bruto))
    assert carregar_geometrias(arquivo) == {}


def test_carregar_arquivo_com_linha_curta(tmp_path):
    arquivo = tmp_path / "geo.csv.gz"
    with gzip.open(arquivo, "wt", encoding="utf-8", newline="") as saida:
        saida.write("origem_id,destino_id,polyline\n1\n")
    assert carregar_geometrias(arquivo) == {}


def test_polyline_truncada_vira_linha_reta(grafo):
    geometrias = {(1, 2): codificar(ESTRADA_1_2)[:-1]}
    assert geometria_do_caminho([1, 2], geometrias, grafo) == [(-5.0, -42.0), (-5.0, -41.0)]
