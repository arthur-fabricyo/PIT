import type { Municipio } from './api/cliente'

export function formatarKm(km: number): string {
  return `${km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

export function rotuloMunicipio(municipio: Municipio): string {
  return `${municipio.nome} (${municipio.uf})`
}
