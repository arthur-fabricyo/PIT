import type { Modo } from '../hooks/usePlanejador'

interface Props {
  modo: Modo
  aoMudar: (modo: Modo) => void
}

export function SeletorModo({ modo, aoMudar }: Props) {
  return (
    <fieldset className="modo">
      <legend>O próximo ponto será</legend>
      <label>
        <input type="radio" name="modo" checked={modo === 'origem'} onChange={() => aoMudar('origem')} />
        Origem
      </label>
      <label>
        <input type="radio" name="modo" checked={modo === 'destino'} onChange={() => aoMudar('destino')} />
        Destino
      </label>
    </fieldset>
  )
}
