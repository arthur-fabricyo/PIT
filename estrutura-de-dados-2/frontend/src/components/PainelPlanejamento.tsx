import type { Planejador } from '../hooks/usePlanejador'
import { BuscaLocal } from './BuscaLocal'
import { ListaPontos } from './ListaPontos'
import { ResultadoRota } from './ResultadoRota'
import { SeletorModo } from './SeletorModo'

export function PainelPlanejamento({ planejador }: { planejador: Planejador }) {
  const { estado } = planejador
  return (
    <section className="card">
      <h2>Planejar rota</h2>
      <SeletorModo modo={estado.modo} aoMudar={planejador.mudarModo} />
      <BuscaLocal aoEscolher={planejador.adicionar} aoErro={planejador.mostrarErro} />
      {estado.erro && <div className="error">{estado.erro}</div>}
      <ListaPontos origem={estado.origem} destinos={estado.destinos} aoRemover={planejador.remover} />
      <button type="button" onClick={() => void planejador.calcular()} disabled={estado.calculando}>
        {estado.calculando ? 'Calculando…' : 'Calcular rota'}
      </button>
      <button type="button" className="secondary" onClick={planejador.limpar}>
        Limpar destinos
      </button>
      {estado.rota && <ResultadoRota rota={estado.rota} />}
    </section>
  )
}
