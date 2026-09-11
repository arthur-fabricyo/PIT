use("trabalho_mongodb");

print("=== CRIANDO ÍNDICE ===");

printjson(
  db.livros.createIndex({
    categoria: 1,
    disponivel: 1,
  }),
);

print("=== EXPLAIN ===");

printjson(
  db.livros
    .find({
      categoria: "Programação",
      disponivel: true,
    })
    .explain("executionStats"),
);
