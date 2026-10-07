import type { LatLngExpression, LatLngTuple } from 'leaflet'
import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Municipio, Rota } from '../api/cliente'
import { rotuloMunicipio } from '../formatacao'

const CENTRO_BRASIL: LatLngExpression = [-14.235, -51.925]
const COR_ROTA = '#e67e22'
const COR_ORIGEM = '#174a7e'

interface Props {
  origem: Municipio | null
  destinos: Municipio[]
  rota: Rota | null
  aoClicar: (lat: number, lon: number) => void
}

function CliqueNoMapa({ aoClicar }: Pick<Props, 'aoClicar'>) {
  useMapEvents({
    click(evento) {
      const ponto = evento.latlng.wrap() // mantém longitude em [-180, 180]
      aoClicar(ponto.lat, ponto.lng)
    },
  })
  return null
}

function EnquadrarRota({ linha }: { linha: LatLngTuple[] }) {
  const mapa = useMap()
  useEffect(() => {
    if (linha.length > 1) mapa.fitBounds(linha, { padding: [30, 30] })
  }, [mapa, linha])
  return null
}

// CircleMarker (vetorial) evita o problema dos ícones PNG do Leaflet com bundlers.
export function MapaRota({ origem, destinos, rota, aoClicar }: Props) {
  const linha = useMemo<LatLngTuple[]>(
    () => (rota ? rota.trechos.flatMap((t) => t.caminho.map((m): LatLngTuple => [m.lat, m.lon])) : []),
    [rota],
  )
  const posicaoNaRota = useMemo(() => {
    const posicoes = new Map<number, number>()
    rota?.ordem.slice(1, -1).forEach((m, i) => posicoes.set(m.id, i + 1))
    return posicoes
  }, [rota])

  return (
    <MapContainer className="mapa" center={CENTRO_BRASIL} zoom={4}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CliqueNoMapa aoClicar={aoClicar} />
      <EnquadrarRota linha={linha} />
      {linha.length > 1 && <Polyline positions={linha} pathOptions={{ color: COR_ROTA, weight: 5 }} />}
      {destinos.map((destino) => {
        const posicao = posicaoNaRota.get(destino.id)
        return (
          // a key muda com a posição porque as opções do Tooltip não mudam depois de criado
          <CircleMarker
            key={`${destino.id}-${posicao ?? ''}`}
            center={[destino.lat, destino.lon]}
            radius={8}
            bubblingMouseEvents={false}
            pathOptions={{ color: COR_ROTA, fillColor: '#fff3df', fillOpacity: 1, weight: 3 }}
          >
            <Tooltip permanent={posicao !== undefined} direction="top">
              {posicao !== undefined ? `${posicao}. ` : ''}
              {rotuloMunicipio(destino)}
            </Tooltip>
          </CircleMarker>
        )
      })}
      {origem && (
        <CircleMarker
          center={[origem.lat, origem.lon]}
          radius={9}
          bubblingMouseEvents={false}
          pathOptions={{ color: COR_ORIGEM, fillColor: COR_ORIGEM, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top">
            Origem: {rotuloMunicipio(origem)}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
