import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { buscarLocal, mensagemDeErro, sugerirMunicipios } from '../api/cliente'
import type { Municipio, ResultadoBusca } from '../api/cliente'
import { rotuloMunicipio } from '../formatacao'

interface Props {
  aoEscolher: (municipio: Municipio) => void
  aoErro: (mensagem: string) => void
}

const ESPERA_SUGESTAO_MS = 500
const ID_LISTA = 'sugestoes-busca'

// As sugestões enquanto se digita vêm do índice de municípios do nosso backend
// (com debounce). O Nominatim só é consultado ao enviar (Enter/botão): a política
// dele proíbe autocomplete.
export function BuscaLocal({ aoEscolher, aoErro }: Props) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [sugestoes, setSugestoes] = useState<Municipio[]>([])
  const [listaAberta, setListaAberta] = useState(false)
  const [destaque, setDestaque] = useState(-1)

  useEffect(() => {
    const consulta = texto.trim()
    if (consulta.length < 2) return
    const controle = new AbortController()
    const temporizador = setTimeout(() => {
      sugerirMunicipios(consulta, controle.signal)
        .then((lista) => {
          if (controle.signal.aborted) return
          setSugestoes(lista)
          setDestaque(-1)
        })
        .catch(() => {
          // falha de sugestão é silenciosa: o botão Buscar continua mostrando erros
        })
    }, ESPERA_SUGESTAO_MS)
    return () => {
      clearTimeout(temporizador)
      controle.abort()
    }
  }, [texto])

  const visiveis = listaAberta && texto.trim().length >= 2 ? sugestoes : []
  const idDestacado = destaque >= 0 && destaque < visiveis.length ? `sugestao-${visiveis[destaque].id}` : undefined

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setListaAberta(false)
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

  function limparBusca() {
    setResultados(null)
    setSugestoes([])
    setListaAberta(false)
    setDestaque(-1)
    setTexto('')
  }

  function escolher(municipio: Municipio) {
    aoEscolher(municipio)
    limparBusca()
  }

  function aoDigitar(valor: string) {
    setTexto(valor)
    setResultados(null)
    setListaAberta(true)
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    const total = visiveis.length
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      if (sugestoes.length === 0) return
      evento.preventDefault()
      if (!listaAberta) {
        setListaAberta(true)
        return
      }
      const passo = evento.key === 'ArrowDown' ? 1 : -1
      setDestaque((atual) => (atual < 0 && passo < 0 ? total - 1 : (atual + passo + total) % total))
    } else if (evento.key === 'Enter' && idDestacado) {
      evento.preventDefault()
      escolher(visiveis[destaque])
    } else if (evento.key === 'Escape' && total > 0) {
      evento.preventDefault()
      setListaAberta(false)
    }
  }

  return (
    <form onSubmit={aoEnviar}>
      <label htmlFor="busca">Buscar lugar</label>
      <div className="row">
        <input
          id="busca"
          type="search"
          autoComplete="off"
          value={texto}
          placeholder="Ex.: Teresina ou Parnaíba, PI"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={visiveis.length > 0}
          aria-controls={ID_LISTA}
          aria-activedescendant={idDestacado}
          onChange={(evento) => aoDigitar(evento.target.value)}
          onKeyDown={aoTeclar}
          onFocus={() => setListaAberta(true)}
          onBlur={() => setListaAberta(false)}
        />
        <button type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      <ul id={ID_LISTA} className="sugestoes" role="listbox" aria-label="Sugestões de municípios" hidden={visiveis.length === 0}>
        {visiveis.map((municipio, i) => (
          <li
            key={municipio.id}
            id={`sugestao-${municipio.id}`}
            role="option"
            aria-selected={i === destaque}
            className={i === destaque ? 'sugestao destacada' : 'sugestao'}
            onMouseDown={(evento) => {
              evento.preventDefault()
              escolher(municipio)
            }}
          >
            {rotuloMunicipio(municipio)}
          </li>
        ))}
      </ul>
      {resultados &&
        (resultados.length === 0 ? (
          <p className="hint">Nenhum lugar encontrado.</p>
        ) : (
          <ul className="resultados-busca">
            {resultados.map((resultado, i) => (
              <li key={`${resultado.lat},${resultado.lon},${i}`}>
                <button type="button" className="resultado" onClick={() => escolher(resultado.municipio)}>
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
