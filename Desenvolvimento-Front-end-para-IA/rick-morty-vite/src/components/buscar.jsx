import { useState } from "react";

export function SearchPokemon() {
  const [nome, setNome] = useState("");
  const [pokemon, setPokemon] = useState(null);

  const [status, setStatus] = useState("idle");
  const [erro, setErro] = useState("");

  async function buscar() {
    setStatus("loading");
    setErro("");

    const url = `https://pokeapi.co/api/v2/pokemon/${nome.toLowerCase()}`;

    try {
      const resposta = await fetch(url);

      if (!resposta.ok) {
        throw new Error(`Erro ${resposta.status}`);
      }

      const dados = await resposta.json();

      setPokemon(dados);
      setStatus("success");
    } catch (e) {
      setErro(e.message);
      setStatus("error");
    }
  }

  return (
    <div>
      <h1>Buscar Pokémon</h1>

      <input
        type="text"
        placeholder="Digite um Pokémon"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      <button onClick={buscar}>Buscar</button>

      <hr />

      <h2>Testar estados</h2>

      <button onClick={() => setStatus("idle")}>Testar Idle</button>

      <button onClick={() => setStatus("loading")}>Testar Loading</button>

      <button
        onClick={() => {
          setPokemon({
            name: "pikachu",
            id: 25,
            weight: 60,
            height: 4,
            sprites: {
              front_default:
                "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
            },
          });

          setStatus("success");
        }}
      >
        Testar Success
      </button>

      <button
        onClick={() => {
          setErro("Erro 404 - Pokémon não encontrado");
          setStatus("error");
        }}
      >
        Testar Error
      </button>

      <hr />

      {/* IDLE */}
      {status === "idle" && <p>Digite um Pokémon para começar.</p>}

      {/* LOADING */}
      {status === "loading" && <p>Carregando...</p>}

      {/* SUCCESS */}
      {status === "success" && pokemon && (
        <div>
          <h2>{pokemon.name}</h2>

          <img src={pokemon.sprites.front_default} alt={pokemon.name} />

          <p>ID: {pokemon.id}</p>
          <p>Peso: {pokemon.weight}</p>
          <p>Altura: {pokemon.height}</p>
        </div>
      )}

      {/* ERROR */}
      {status === "error" && <p>Erro: {erro}</p>}
    </div>
  );
}
