import { useEffect, useState } from "react";
import { Search, X, MapPin, Clapperboard, UserRound } from "lucide-react";

const API_URL = "https://rickandmortyapi.com/api/character";

function statusClass(status) {
  if (status === "Alive") return "status alive";
  if (status === "Dead") return "status dead";

  return "status unknown";
}

function App() {
  const [termo, setTermo] = useState("");
  const [personagens, setPersonagens] = useState([]);
  const [status, setStatus] = useState("loading");
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState(null);

  async function buscarPersonagens(nome = "") {
    setStatus("loading");
    setErro("");

    try {
      const nomeTratado = nome.trim();

      const url = nomeTratado
        ? `${API_URL}?name=${encodeURIComponent(nomeTratado)}`
        : API_URL;

      const resposta = await fetch(url);

      if (resposta.status === 404) {
        setPersonagens([]);
        setStatus("empty");
        return;
      }

      if (!resposta.ok) {
        throw new Error(`Erro HTTP: ${resposta.status}`);
      }

      const dados = await resposta.json();

      const resultados = dados.results ?? [];

      setPersonagens(resultados);

      if (resultados.length > 0) {
        setStatus("success");
      } else {
        setStatus("empty");
      }
    } catch (error) {
      console.error("Erro ao buscar personagens:", error);

      setPersonagens([]);
      setErro("Não foi possível consultar a API. Tente novamente.");
      setStatus("error");
    }
  }

  useEffect(() => {
    buscarPersonagens();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    buscarPersonagens(termo);
  }

  function limparBusca() {
    setTermo("");
    setSelecionado(null);
    buscarPersonagens();
  }

  function abrirDetalhes(personagem) {
    setSelecionado(personagem);
  }

  function fecharDetalhes() {
    setSelecionado(null);
  }

  useEffect(() => {
    function fecharComEscape(event) {
      if (event.key === "Escape") {
        fecharDetalhes();
      }
    }

    window.addEventListener("keydown", fecharComEscape);

    return () => {
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, []);

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">React + Vite + REST API</p>

        <h1>Rick and Morty Explorer</h1>

        <p className="subtitle">
          Pesquise um personagem e clique no card para ver mais detalhes.
        </p>

        <form className="search-form" onSubmit={handleSubmit}>
          <Search size={20} aria-hidden="true" />

          <input
            type="text"
            value={termo}
            onChange={(event) => setTermo(event.target.value)}
            placeholder="Ex.: Rick, Morty, Summer..."
            aria-label="Nome do personagem"
          />

          {termo && (
            <button
              className="clear-button"
              type="button"
              onClick={limparBusca}
              aria-label="Limpar busca"
            >
              <X size={18} />
            </button>
          )}

          <button
            className="search-button"
            type="submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </section>

      <section className="content" aria-live="polite">
        {status === "loading" && (
          <div className="state-box">
            <div className="spinner" />

            <p>Buscando personagens...</p>
          </div>
        )}

        {status === "error" && (
          <div className="state-box error-box">
            <h2>Ops!</h2>

            <p>{erro}</p>

            <button type="button" onClick={() => buscarPersonagens(termo)}>
              Tentar novamente
            </button>
          </div>
        )}

        {status === "empty" && (
          <div className="state-box">
            <h2>Nenhum personagem encontrado</h2>

            <p>Tente pesquisar por outro nome.</p>

            <button type="button" onClick={limparBusca}>
              Mostrar todos
            </button>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="results-header">
              <h2>Personagens</h2>

              <span>{personagens.length} resultado(s) nesta página</span>
            </div>

            <div className="grid">
              {personagens.map((personagem) => (
                <button
                  className="character-card"
                  key={personagem.id}
                  type="button"
                  onClick={() => abrirDetalhes(personagem)}
                >
                  <img
                    src={personagem.image}
                    alt={`Imagem de ${personagem.name}`}
                  />

                  <div className="card-body">
                    <div className="card-title-row">
                      <h3>{personagem.name}</h3>

                      <span className={statusClass(personagem.status)}>
                        {personagem.status}
                      </span>
                    </div>

                    <p>
                      {personagem.species}
                      {" · "}
                      {personagem.gender}
                    </p>

                    <span className="details-link">Ver detalhes →</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {selecionado && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={fecharDetalhes}
        >
          <article
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={fecharDetalhes}
              aria-label="Fechar detalhes"
            >
              <X size={22} />
            </button>

            <img
              className="modal-image"
              src={selecionado.image}
              alt={`Imagem de ${selecionado.name}`}
            />

            <div className="modal-content">
              <span className={statusClass(selecionado.status)}>
                {selecionado.status}
              </span>

              <h2 id="modal-title">{selecionado.name}</h2>

              <div className="details-list">
                <div>
                  <UserRound size={19} />

                  <span>
                    <small>Espécie / gênero</small>

                    {selecionado.species}
                    {" · "}
                    {selecionado.gender}
                  </span>
                </div>

                <div>
                  <MapPin size={19} />

                  <span>
                    <small>Origem</small>

                    {selecionado.origin?.name ?? "Desconhecida"}
                  </span>
                </div>

                <div>
                  <MapPin size={19} />

                  <span>
                    <small>Última localização</small>

                    {selecionado.location?.name ?? "Desconhecida"}
                  </span>
                </div>

                <div>
                  <Clapperboard size={19} />

                  <span>
                    <small>Aparições</small>
                    {selecionado.episode?.length ?? 0} episódio(s)
                  </span>
                </div>
              </div>

              {selecionado.type && (
                <p className="type-info">
                  <strong>Tipo:</strong> {selecionado.type}
                </p>
              )}

              <button
                className="modal-action"
                type="button"
                onClick={fecharDetalhes}
              >
                Fechar
              </button>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}

export default App;
