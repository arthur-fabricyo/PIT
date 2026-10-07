import type { Rota } from '../api/cliente'
import { formatarKm, rotuloMunicipio } from '../formatacao'

const NOME_METODO: Record<Rota['metodo'], string> = {
  forca_bruta: 'força bruta (testou todas as ordens possíveis)',
  heuristica: 'heurística (vizinho mais próximo + 2-opt)',
}

export function ResultadoRota({ rota }: { rota: Rota }) {
  return (
    <div className="result">
      <h2>Rota encontrada</h2>
      <div className="metric">
        <div>
          <span className="hint">Destinos</span>
          <b>{rota.ordem.length - 2}</b>
        </div>
        <div>
          <span className="hint">Distância total</span>
          <b>{formatarKm(rota.distancia_total_km)}</b>
        </div>
      </div>
      <p className="hint">Ordem calculada por {NOME_METODO[rota.metodo]}.</p>
      <ol className="route">
        {rota.trechos.map((trecho, i) => (
          <li key={i}>
            <b>
              {rotuloMunicipio(trecho.de)} → {rotuloMunicipio(trecho.para)}
            </b>{' '}
            — {formatarKm(trecho.distancia_km)}
            <details>
              <summary>{trecho.caminho.length} municípios no caminho</summary>
              {trecho.caminho.map((m) => m.nome).join(' → ')}
            </details>
          </li>
        ))}
      </ol>
      <p className="hint success">A rota retorna automaticamente ao município de origem.</p>
      <p className="hint">Distâncias aproximadas (linha reta entre municípios vizinhos).</p>
    </div>
  )
}
