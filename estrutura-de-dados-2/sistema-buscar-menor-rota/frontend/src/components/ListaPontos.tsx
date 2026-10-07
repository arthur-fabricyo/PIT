import type { Municipio } from '../api/cliente'
import { rotuloMunicipio } from '../formatacao'
import { LIMITE_DESTINOS } from '../hooks/usePlanejador'

interface Props {
  origem: Municipio | null
  destinos: Municipio[]
  aoRemover: (id: number) => void
}

export function ListaPontos({ origem, destinos, aoRemover }: Props) {
  return (
    <>
      <div className="campo">Origem</div>
      {origem ? (
        <div className="destino origem">
          <span>{rotuloMunicipio(origem)}</span>
        </div>
      ) : (
        <span className="hint">Nenhuma origem escolhida.</span>
      )}
      <div className="campo">
        Destinos escolhidos ({destinos.length}/{LIMITE_DESTINOS})
      </div>
      <div className="destinos">
        {destinos.length === 0 ? (
          <span className="hint">Nenhum destino adicionado.</span>
        ) : (
          destinos.map((destino, i) => (
            <div className="destino" key={destino.id}>
              <span>
                {i + 1}. {rotuloMunicipio(destino)}
              </span>
              <button type="button" onClick={() => aoRemover(destino.id)}>
                remover
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}
