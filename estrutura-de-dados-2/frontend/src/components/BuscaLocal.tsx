import { useState } from 'react'
import type { FormEvent } from 'react'
import { buscarLocal, mensagemDeErro } from '../api/cliente'
import type { Municipio, ResultadoBusca } from '../api/cliente'
import { rotuloMunicipio } from '../formatacao'

interface Props {
  aoEscolher: (municipio: Municipio) => void
  aoErro: (mensagem: string) => void
}

// Busca só ao enviar (Enter/botão): a política do Nominatim proíbe autocomplete.
export function BuscaLocal({ aoEscolher, aoErro }: Props) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const consulta = texto.trim()
    if (consulta.length < 2) {
      aoErro('Digite pelo menos 2 caracteres para buscar.')
      return
    }
    setBuscando(true)
    try {
      setResultados(await buscarLocal(consulta))
      aoErro('')
    } catch (erro) {
      setResultados(null)
      aoErro(mensagemDeErro(erro))
    } finally {
      setBuscando(false)
    }
  }

  function escolher(resultado: ResultadoBusca) {
    aoEscolher(resultado.municipio)
    setResultados(null)
    setTexto('')
  }

  return (
    <form onSubmit={aoEnviar}>
      <label htmlFor="busca">Buscar lugar</label>
      <div className="row">
        <input
          id="busca"
          type="search"
          value={texto}
          placeholder="Ex.: Parnaíba, PI"
          onChange={(evento) => setTexto(evento.target.value)}
        />
        <button type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {resultados &&
        (resultados.length === 0 ? (
          <p className="hint">Nenhum lugar encontrado.</p>
        ) : (
          <ul className="resultados-busca">
            {resultados.map((resultado, i) => (
              <li key={`${resultado.lat},${resultado.lon},${i}`}>
                <button type="button" className="resultado" onClick={() => escolher(resultado)}>
                  <span>{resultado.rotulo}</span>
                  <small>→ {rotuloMunicipio(resultado.municipio)}</small>
                </button>
              </li>
            ))}
          </ul>
        ))}
      <p className="hint">Ou clique no mapa para escolher um ponto. Cada ponto vira o município mais próximo.</p>
    </form>
  )
}
