import { Cabecalho } from './components/Cabecalho'
import { MapaRota } from './components/MapaRota'
import { PainelPlanejamento } from './components/PainelPlanejamento'
import { usePlanejador } from './hooks/usePlanejador'

export default function App() {
  const planejador = usePlanejador()
  const { estado } = planejador
  return (
    <>
      <Cabecalho />
      <main>
        <PainelPlanejamento planejador={planejador} />
        <section className="card">
          <h2>Mapa da rota</h2>
          <div className="legend">
            Clique no mapa para adicionar um ponto como <b>{estado.modo}</b>. A rota calculada fica destacada em
            laranja.
          </div>
          <MapaRota
            origem={estado.origem}
            destinos={estado.destinos}
            rota={estado.rota}
            aoClicar={(lat, lon) => void planejador.adicionarPorCoordenada(lat, lon)}
          />
        </section>
      </main>
    </>
  )
}
