export interface Municipio {
  id: number
  nome: string
  uf: string
  lat: number
  lon: number
}

export interface ResultadoBusca {
  rotulo: string
  lat: number
  lon: number
  municipio: Municipio
}

export interface Trecho {
  de: Municipio
  para: Municipio
  distancia_km: number
  caminho: Municipio[]
}

export interface Rota {
  distancia_total_km: number
  metodo: 'forca_bruta' | 'heuristica'
  ordem: Municipio[]
  trechos: Trecho[]
}

export class ErroApi extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroApi'
  }
}

const SEM_SERVIDOR = 'Não foi possível falar com o servidor.'

async function requisitar<T>(url: string, init?: RequestInit): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(url, init)
  } catch {
    throw new ErroApi(SEM_SERVIDOR)
  }
  if (resposta.ok) return (await resposta.json()) as T

  // O FastAPI sempre responde erros em JSON ({ detail }). Corpo que não é JSON
  // vem do proxy do Vite quando o backend está fora do ar.
  let corpo: unknown
  try {
    corpo = await resposta.json()
  } catch {
    throw new ErroApi(SEM_SERVIDOR)
  }
  const detalhe = (corpo as { detail?: unknown } | null)?.detail
  throw new ErroApi(typeof detalhe === 'string' ? detalhe : `Erro ${resposta.status} no servidor.`)
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Erro inesperado.'
}

export function buscarLocal(texto: string): Promise<ResultadoBusca[]> {
  return requisitar(`/api/busca?q=${encodeURIComponent(texto)}`)
}

export function municipioProximo(lat: number, lon: number): Promise<Municipio> {
  return requisitar(`/api/municipios/proximo?lat=${lat}&lon=${lon}`)
}

export function calcularRota(origemId: number, destinosIds: number[]): Promise<Rota> {
  return requisitar('/api/rotas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origem_id: origemId, destinos_ids: destinosIds }),
  })
}
