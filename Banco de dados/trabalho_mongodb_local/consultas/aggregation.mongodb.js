use("trabalho_mongodb");

// ==================================================
// PIPELINE A
// Livros disponíveis agrupados por categoria
// ==================================================

print("=== PIPELINE A ===");

printjson(
  db.livros
    .aggregate([
      {
        $match: {
          disponivel: true,
        },
      },
      {
        $group: {
          _id: "$categoria",
          totalLivros: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          totalLivros: -1,
        },
      },
    ])
    .toArray(),
);

// ==================================================
// PIPELINE B
// Relaciona empréstimos, usuários e livros
// ==================================================

print("=== PIPELINE B ===");

printjson(
  db.emprestimos
    .aggregate([
      {
        $lookup: {
          from: "usuarios",
          localField: "usuarioId",
          foreignField: "_id",
          as: "usuario",
        },
      },
      {
        $unwind: "$usuario",
      },
      {
        $lookup: {
          from: "livros",
          localField: "livroId",
          foreignField: "_id",
          as: "livro",
        },
      },
      {
        $unwind: "$livro",
      },
      {
        $match: {
          status: "ativo",
        },
      },
      {
        $project: {
          _id: 0,
          usuario: "$usuario.nome",
          livro: "$livro.titulo",
          dataEmprestimo: 1,
          status: 1,
        },
      },
    ])
    .toArray(),
);
