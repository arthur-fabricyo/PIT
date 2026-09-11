use("trabalho_mongodb");

// ======================================================
// CREATE - insertMany()
// ======================================================

db.livros.insertMany([
  {
    titulo: "Arquitetura de Software",
    autor: "Autor Teste",
    categoria: "Programação",
    ano: 2026,
    disponivel: true,
    quantidade: 2,
    tags: ["arquitetura", "software", "programação"],
    editora: { nome: "Editora Exemplo", pais: "Brasil" }
  },
  {
    titulo: "APIs REST com Java",
    autor: "Autor Exemplo",
    categoria: "Programação",
    ano: 2026,
    disponivel: true,
    quantidade: 4,
    tags: ["java", "backend", "api"],
    editora: { nome: "Dev Books", pais: "Brasil" }
  }
]);

// ======================================================
// READ - busca com pelo menos 2 condições
// ======================================================

print("READ - 2 condições");
printjson(
  db.livros.find({
    categoria: "Programação",
    disponivel: true
  }).toArray()
);

// ======================================================
// READ - projeção
// ======================================================

print("READ - projeção");
printjson(
  db.livros.find(
    {},
    {
      _id: 0,
      titulo: 1,
      autor: 1,
      categoria: 1
    }
  ).toArray()
);

// ======================================================
// READ - consulta em campo array
// ======================================================

print("READ - array");
printjson(
  db.livros.find({
    tags: "java"
  }).toArray()
);

// ======================================================
// READ - sort() + limit()
// ======================================================

print("READ - sort + limit");
printjson(
  db.livros
    .find(
      {},
      {
        _id: 0,
        titulo: 1,
        ano: 1
      }
    )
    .sort({ ano: -1 })
    .limit(3)
    .toArray()
);

// ======================================================
// CONSULTA MAIS INTERESSANTE
// ======================================================

print("CONSULTA MAIS INTERESSANTE");
printjson(
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
    .toArray()
);

// ======================================================
// UPDATE - $set
// ======================================================

print("UPDATE - $set");
printjson(
  db.livros.updateOne(
    { titulo: "Clean Code" },
    { $set: { disponivel: false } }
  )
);

// ======================================================
// UPDATE - $inc
// ======================================================

print("UPDATE - $inc");
printjson(
  db.livros.updateOne(
    { titulo: "Clean Code" },
    { $inc: { quantidade: 1 } }
  )
);

// ======================================================
// UPDATE - $push
// ======================================================

print("UPDATE - $push");
printjson(
  db.livros.updateOne(
    { titulo: "Clean Code" },
    { $push: { tags: "arquitetura" } }
  )
);

// ======================================================
// DELETE - documento de teste
// ======================================================

db.livros.insertOne({
  titulo: "Livro para excluir",
  autor: "Teste",
  categoria: "Teste",
  disponivel: false,
  quantidade: 1,
  tags: ["teste"]
});

print("ANTES DO DELETE");
printjson(
  db.livros.find({ titulo: "Livro para excluir" }).toArray()
);

print("DELETE");
printjson(
  db.livros.deleteOne({ titulo: "Livro para excluir" })
);

print("DEPOIS DO DELETE");
printjson(
  db.livros.find({ titulo: "Livro para excluir" }).toArray()
);
