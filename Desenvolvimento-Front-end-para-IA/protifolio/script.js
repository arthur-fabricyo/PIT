const projetos = [
  {
    titulo: "Helpdesk",
    tech: "Java • Spring Boot • React • PostgreSQL",
    descricao:
      "Sistema de atendimento desenvolvido como desafio técnico, com autenticação, gestão de chamados e aplicação publicada em produção.",
    badges: ["Full Stack", "Java"],
    links: [
      { label: "GitHub", url: "https://github.com/ElFabrica/helpdesk" },
      { label: "Demo", url: "https://helpdesk-el-fabrica.vercel.app/" }
    ]
  },
  {
    titulo: "Gestão de Vagas",
    tech: "Spring Boot • JWT • RabbitMQ • Docker",
    descricao:
      "Backend para plataforma de vagas com autenticação JWT, regras de candidatura, processamento assíncrono, upload de currículos e observabilidade.",
    badges: ["Backend", "Mensageria"],
    links: [
      { label: "GitHub", url: "https://github.com/ElFabrica" }
    ]
  },
  {
    titulo: "RAG Chatbot",
    tech: "Next.js • TypeScript • PostgreSQL • IA",
    descricao:
      "Aplicação de perguntas e respostas com recuperação de contexto, banco vetorial e integração com modelos de linguagem.",
    badges: ["IA", "RAG"],
    links: [
      { label: "GitHub", url: "https://github.com/ElFabrica" }
    ]
  },
  {
    titulo: "WalletPay",
    tech: "Java • Spring Boot • PostgreSQL • Redis",
    descricao:
      "Projeto de fintech para estudo de arquitetura backend, autenticação, carteiras, transferências, transações, consistência e automações financeiras.",
    badges: ["Backend", "Fintech"],
    links: [
      { label: "GitHub", url: "https://github.com/ElFabrica" }
    ]
  },
  {
    titulo: "CRM SaaS — experiência em produção",
    tech: "Next.js • React • Node.js • Prisma • PostgreSQL",
    descricao:
      "Experiência no desenvolvimento de produto SaaS multi-tenant com milhares de leads, dashboards, RBAC, feature flags, integrações e automações.",
    badges: ["SaaS", "Produção"],
    links: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/arthur-fabricyo-8b88722b9/" }
    ]
  },
  {
    titulo: "Microservices Lab",
    tech: "Spring Cloud • Eureka • Feign • Docker",
    descricao:
      "Laboratório de microsserviços com service discovery, configuração centralizada, comunicação entre serviços e práticas de sistemas distribuídos.",
    badges: ["Java", "Cloud"],
    links: [
      { label: "GitHub", url: "https://github.com/ElFabrica/java-microsservices" }
    ]
  }
];

function renderizarProjetos() {
  const container = document.getElementById("projects-container");

  if (!container) return;

  container.innerHTML = projetos
    .map(
      (projeto) => `
        <article class="project-card">
          <div>
            <div class="card-header">
              <div>
                <h3>${projeto.titulo}</h3>
                <p class="tech-stack">${projeto.tech}</p>
              </div>

              <div class="badges">
                ${projeto.badges
                  .map((badge) => `<span class="badge">${badge}</span>`)
                  .join("")}
              </div>
            </div>

            <p class="description">${projeto.descricao}</p>
          </div>

          <div class="card-links">
            ${projeto.links
              .map(
                (link) =>
                  `<a class="card-link" href="${link.url}" target="_blank" rel="noreferrer">${link.label} ↗</a>`
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", renderizarProjetos);
