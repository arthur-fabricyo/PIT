use("trabalho_mongodb");

db.livros.drop();
db.usuarios.drop();
db.emprestimos.drop();

const usuarios = db.usuarios.insertMany([
  {
    nome: "Ana Souza",
    email: "ana@exemplo.com",
    curso: "Sistemas para Internet",
    ativo: true,
    interesses: ["programação", "banco de dados"]
  },
  {
    nome: "Bruno Lima",
    email: "bruno@exemplo.com",
    curso: "Inteligência Artificial",
    ativo: true,
    interesses: ["java", "machine learning"]
  },
  {
    nome: "Carla Mendes",
    email: "carla@exemplo.com",
    curso: "Sistemas para Internet",
    ativo: false,
    interesses: ["frontend", "design"]
  },
  {
    nome: "Diego Alves",
    email: "diego@exemplo.com",
    curso: "Inteligência Artificial",
    ativo: true,
    interesses: ["mongodb", "python"]
  },
  {
    nome: "Elisa Rocha",
    email: "elisa@exemplo.com",
    curso: "Sistemas para Internet",
    ativo: true,
    interesses: ["backend", "java"]
  },
  {
    nome: "Felipe Costa",
    email: "felipe@exemplo.com",
    curso: "Inteligência Artificial",
    ativo: true,
    interesses: ["dados", "sql"]
  }
]);

const livros = db.livros.insertMany([
  {
    titulo: "Clean Code",
    autor: "Robert C. Martin",
    categoria: "Programação",
    ano: 2008,
    disponivel: true,
    quantidade: 3,
    tags: ["programação", "boas práticas", "software"],
    editora: { nome: "Prentice Hall", pais: "EUA" }
  },
  {
    titulo: "Código Limpo em Java",
    autor: "Exemplo Acadêmico",
    categoria: "Programação",
    ano: 2022,
    disponivel: true,
    quantidade: 5,
    tags: ["java", "backend", "programação"],
    editora: { nome: "Editora Tech", pais: "Brasil" }
  },
  {
    titulo: "Banco de Dados",
    autor: "Carlos Silva",
    categoria: "Tecnologia",
    ano: 2024,
    disponivel: false,
    quantidade: 2,
    tags: ["banco de dados", "mongodb", "sql"],
    editora: { nome: "Dados Press", pais: "Brasil" }
  },
  {
    titulo: "MongoDB na Prática",
    autor: "João Pereira",
    categoria: "Tecnologia",
    ano: 2025,
    disponivel: true,
    quantidade: 4,
    tags: ["mongodb", "nosql", "banco de dados"],
    editora: { nome: "Tech Books", pais: "Brasil" }
  },
  {
    titulo: "Spring Boot Essencial",
    autor: "Marina Lopes",
    categoria: "Programação",
    ano: 2024,
    disponivel: true,
    quantidade: 3,
    tags: ["java", "spring", "backend"],
    editora: { nome: "Dev House", pais: "Brasil" }
  },
  {
    titulo: "Python para Dados",
    autor: "Rafael Martins",
    categoria: "Programação",
    ano: 2023,
    disponivel: true,
    quantidade: 6,
    tags: ["python", "dados", "programação"],
    editora: { nome: "Data Books", pais: "Brasil" }
  },
  {
    titulo: "Estruturas de Dados",
    autor: "Paulo Nunes",
    categoria: "Computação",
    ano: 2020,
    disponivel: true,
    quantidade: 2,
    tags: ["algoritmos", "estruturas", "programação"],
    editora: { nome: "Campus Tech", pais: "Brasil" }
  },
  {
    titulo: "Introdução à Inteligência Artificial",
    autor: "Fernanda Reis",
    categoria: "Inteligência Artificial",
    ano: 2025,
    disponivel: true,
    quantidade: 3,
    tags: ["ia", "machine learning", "python"],
    editora: { nome: "AI Press", pais: "Brasil" }
  }
]);

db.emprestimos.insertMany([
  {
    usuarioId: usuarios.insertedIds["0"],
    livroId: livros.insertedIds["0"],
    dataEmprestimo: ISODate("2026-08-20T10:00:00Z"),
    status: "devolvido"
  },
  {
    usuarioId: usuarios.insertedIds["1"],
    livroId: livros.insertedIds["1"],
    dataEmprestimo: ISODate("2026-09-01T12:00:00Z"),
    status: "ativo"
  },
  {
    usuarioId: usuarios.insertedIds["3"],
    livroId: livros.insertedIds["3"],
    dataEmprestimo: ISODate("2026-09-02T15:00:00Z"),
    status: "ativo"
  },
  {
    usuarioId: usuarios.insertedIds["4"],
    livroId: livros.insertedIds["4"],
    dataEmprestimo: ISODate("2026-09-05T09:30:00Z"),
    status: "ativo"
  },
  {
    usuarioId: usuarios.insertedIds["5"],
    livroId: livros.insertedIds["5"],
    dataEmprestimo: ISODate("2026-09-06T14:20:00Z"),
    status: "devolvido"
  },
  {
    usuarioId: usuarios.insertedIds["0"],
    livroId: livros.insertedIds["6"],
    dataEmprestimo: ISODate("2026-09-08T11:10:00Z"),
    status: "ativo"
  }
]);

print("Seed concluído.");
print("usuarios:", db.usuarios.countDocuments());
print("livros:", db.livros.countDocuments());
print("emprestimos:", db.emprestimos.countDocuments());
print("total:", db.usuarios.countDocuments() + db.livros.countDocuments() + db.emprestimos.countDocuments());
