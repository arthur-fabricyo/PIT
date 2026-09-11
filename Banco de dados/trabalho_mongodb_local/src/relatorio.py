from pymongo import MongoClient
import pandas as pd
import os

# URI obtida pela variável de ambiente
mongodb_uri = os.getenv("MONGODB_URI")

if not mongodb_uri:
    raise ValueError("A variável de ambiente MONGODB_URI não foi definida.")

client = MongoClient(mongodb_uri)

# Banco utilizado no projeto
db = client["trabalho_mongodb"]

# Consulta livros que possuem o campo categoria
resultado = list(
    db["livros"].find(
        {"categoria": {"$exists": True}},
        {
            "_id": 0,
            "titulo": 1,
            "categoria": 1,
            "ano": 1,
            "disponivel": 1,
            "quantidade": 1
        }
    )
)

# Converte os documentos em DataFrame
df = pd.DataFrame(resultado)

if df.empty:
    print("Nenhum livro encontrado.")
else:
    print("\n=== TOTAL DE LIVROS CADASTRADOS ===")
    print(len(df))

    print("\n=== LIVROS POR CATEGORIA ===")
    print(df.groupby("categoria").size().sort_values(ascending=False))

    print("\n=== LIVROS DISPONÍVEIS POR CATEGORIA ===")
    disponiveis = df[df["disponivel"] == True]
    print(
        disponiveis.groupby("categoria")
        .size()
        .sort_values(ascending=False)
    )

    print("\n=== QUANTIDADE TOTAL DE EXEMPLARES ===")
    print(df["quantidade"].sum())

    print("\n=== ANO MÉDIO DE PUBLICAÇÃO ===")
    print(round(df["ano"].mean(), 2))

client.close()