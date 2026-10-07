import { useReducer } from 'react'
import { calcularRota, mensagemDeErro, municipioProximo } from '../api/cliente'
import type { Municipio, Rota } from '../api/cliente'

export type Modo = 'origem' | 'destino'

export const LIMITE_DESTINOS = 20

export interface EstadoPlanejador {
  origem: Municipio | null
  destinos: Municipio[]
  modo: Modo
  rota: Rota | null
  erro: string
  calculando: boolean
}

type Acao =
  | { tipo: 'adicionar'; municipio: Municipio }
  | { tipo: 'remover'; id: number }
  | { tipo: 'mudarModo'; modo: Modo }
  | { tipo: 'limpar' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'calculoIniciado' }
  | { tipo: 'calculoConcluido'; rota: Rota; chave: string }
  | { tipo: 'calculoFalhou'; mensagem: string }

const ESTADO_INICIAL: EstadoPlanejador = {
  origem: null,
  destinos: [],
  modo: 'origem',
  rota: null,
  erro: '',
  calculando: false,
}

// Identifica o conjunto de pontos de um cálculo; se mudar durante a requisição,
// a resposta é descartada para nunca mostrar rota de pontos antigos.
function chaveDosPontos(origem: Municipio | null, destinos: Municipio[]): string {
  return [origem?.id ?? '', ...destinos.map((d) => d.id)].join(',')
}

function adicionar(estado: EstadoPlanejador, municipio: Municipio): EstadoPlanejador {
  if (estado.modo === 'origem') {
    return {
      ...estado,
      origem: municipio,
      destinos: estado.destinos.filter((d) => d.id !== municipio.id),
      modo: 'destino',
      rota: null,
      erro: '',
    }
  }
  if (estado.origem?.id === municipio.id) {
    return { ...estado, erro: 'A origem não pode ser adicionada como destino.' }
  }
  if (estado.destinos.some((d) => d.id === municipio.id)) {
    return { ...estado, erro: `${municipio.nome} (${municipio.uf}) já foi adicionado.` }
  }
  if (estado.destinos.length >= LIMITE_DESTINOS) {
    return { ...estado, erro: `Limite de ${LIMITE_DESTINOS} destinos atingido.` }
  }
  return { ...estado, destinos: [...estado.destinos, municipio], rota: null, erro: '' }
}

// Reducer: cada ação vê o estado mais recente, então cliques concorrentes no
// mapa não se sobrescrevem (com useState + closures o segundo apagaria o primeiro).
function reduzir(estado: EstadoPlanejador, acao: Acao): EstadoPlanejador {
  switch (acao.tipo) {
    case 'adicionar':
      return adicionar(estado, acao.municipio)
    case 'remover':
      return { ...estado, destinos: estado.destinos.filter((d) => d.id !== acao.id), rota: null, erro: '' }
    case 'mudarModo':
      return { ...estado, modo: acao.modo }
    case 'limpar':
      return { ...estado, destinos: [], rota: null, erro: '' }
    case 'erro':
      return { ...estado, erro: acao.mensagem }
    case 'calculoIniciado':
      return { ...estado, calculando: true, erro: '' }
    case 'calculoConcluido':
      if (acao.chave !== chaveDosPontos(estado.origem, estado.destinos)) {
        return { ...estado, calculando: false }
      }
      return { ...estado, calculando: false, rota: acao.rota }
    case 'calculoFalhou':
      return { ...estado, calculando: false, erro: acao.mensagem }
  }
}

export function usePlanejador() {
  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL)

  async function adicionarPorCoordenada(lat: number, lon: number) {
    try {
      const municipio = await municipioProximo(lat, lon)
      despachar({ tipo: 'adicionar', municipio })
    } catch (erro) {
      despachar({ tipo: 'erro', mensagem: mensagemDeErro(erro) })
    }
  }

  async function calcular() {
    const { origem, destinos } = estado
    if (!origem) {
      despachar({ tipo: 'erro', mensagem: 'Escolha a origem antes de calcular.' })
      return
    }
    if (destinos.length === 0) {
      despachar({ tipo: 'erro', mensagem: 'Adicione pelo menos um destino para calcular a rota.' })
      return
    }
    const chave = chaveDosPontos(origem, destinos)
    despachar({ tipo: 'calculoIniciado' })
    try {
      const rota = await calcularRota(origem.id, destinos.map((d) => d.id))
      despachar({ tipo: 'calculoConcluido', rota, chave })
    } catch (erro) {
      despachar({ tipo: 'calculoFalhou', mensagem: mensagemDeErro(erro) })
    }
  }

  return {
    estado,
    adicionar: (municipio: Municipio) => despachar({ tipo: 'adicionar', municipio }),
    adicionarPorCoordenada,
    remover: (id: number) => despachar({ tipo: 'remover', id }),
    mudarModo: (modo: Modo) => despachar({ tipo: 'mudarModo', modo }),
    limpar: () => despachar({ tipo: 'limpar' }),
    mostrarErro: (mensagem: string) => despachar({ tipo: 'erro', mensagem }),
    calcular,
  }
}

export type Planejador = ReturnType<typeof usePlanejador>
