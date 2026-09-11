# Trabalho MongoDB local

Este pacote sobe um MongoDB local usando Docker e executa os arquivos do trabalho.

## Estrutura

```text
trabalho_mongodb_local/
├── docker-compose.yml
├── dados/
│   └── seed.mongodb.js
└── consultas/
    └── crud.mongodb.js
```

O seed cria 3 coleções:

- `usuarios`
- `livros`
- `emprestimos`

O banco possui mais de 20 documentos no total e inclui:

- arrays;
- objeto aninhado;
- referência entre coleções usando `ObjectId`;
- documentos com campos variados.

## 1. Requisitos

Tenha Docker Desktop ou Docker Engine instalado.

Verifique:

```bash
docker --version
docker compose version
```

## 2. Subir o MongoDB

Dentro da pasta do projeto:

```bash
docker compose up -d
```

Verifique o container:

```bash
docker ps
```

Deve aparecer:

```text
trabalho-mongodb
```

## 3. Criar banco e dados iniciais

Linux/macOS:

```bash
docker exec -i trabalho-mongodb mongosh < dados/seed.mongodb.js
```

PowerShell:

```powershell
Get-Content .\dados\seed.mongodb.js | docker exec -i trabalho-mongodb mongosh
```

CMD:

```cmd
type dados\seed.mongodb.js | docker exec -i trabalho-mongodb mongosh
```

Ao final, deve aparecer algo parecido com:

```text
usuarios: 6
livros: 8
emprestimos: 6
total: 20
```

## 4. Rodar o CRUD

Linux/macOS:

```bash
docker exec -i trabalho-mongodb mongosh < consultas/crud.mongodb.js
```

PowerShell:

```powershell
Get-Content .\consultas\crud.mongodb.js | docker exec -i trabalho-mongodb mongosh
```

CMD:

```cmd
type consultas\crud.mongodb.js | docker exec -i trabalho-mongodb mongosh
```

## 5. Abrir o Mongo Shell

```bash
docker exec -it trabalho-mongodb mongosh
```

Depois:

```javascript
use trabalho_mongodb

show collections

db.livros.find()

db.usuarios.find()

db.emprestimos.find()
```

## 6. Verificar quantidade de documentos

```javascript
db.usuarios.countDocuments()
db.livros.countDocuments()
db.emprestimos.countDocuments()
```

## 7. Testar a consulta principal manualmente

```javascript
db.livros
  .find(
    {
      categoria: "Programação",
      disponivel: true,
      tags: "java"
    },
    {
      _id: 0,
      titulo: 1,
      autor: 1,
      ano: 1,
      tags: 1
    }
  )
  .sort({ ano: -1 })
  .limit(3)
```

## 8. Conectar pelo MongoDB Compass

Use:

```text
mongodb://localhost:27017
```

Depois escolha o banco:

```text
trabalho_mongodb
```

## 9. Resetar tudo

Para apagar o container e também os dados persistidos:

```bash
docker compose down -v
```

Depois execute novamente:

```bash
docker compose up -d
```

e rode o seed outra vez.

## Observação

O arquivo `crud.mongodb.js` insere dois livros extras toda vez que for executado.
Para voltar ao estado inicial, rode novamente `dados/seed.mongodb.js`, que recria as três coleções.
