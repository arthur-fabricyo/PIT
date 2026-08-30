import { useState } from "react";

export default function BuscadorPokemon() {
  const [nome, setNome] = useState("pikachu");
  const [pokemon, setPokemon] = useState(null);

  async function buscar() {
    const url = `https://pokeapi.co/api/v2/pokemon/${nome.toLowerCase()}`;

    const resposta = await fetch(url);
    const dados = await resposta.json();

    setPokemon(dados);
  }

  return (
    <div>
      <input value={nome} onChange={(e) => setNome(e.target.value)} />

      <button onClick={buscar}>Buscar</button>

      {pokemon && (
        <div>
          <h2>{pokemon.name}</h2>
          <img src={pokemon.sprites.front_default} alt={pokemon.name} />
          <p>ID: {pokemon.id}</p>
        </div>
      )}
    </div>
  );
}
