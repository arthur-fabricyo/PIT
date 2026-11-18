// Regenera backend/data/geometrias_arestas.csv.gz num comando só (npm run geometrias):
// Java 17+ (baixa um JDK portátil se faltar), GraphHopper, mapa do Brasil, import,
// servidor e gerador. Tudo que é baixado fica em .cache/graphhopper (fora do Git).
// Argumentos extras vão para o gerador: npm run geometrias -- --refazer
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BACKEND, PYTHON_VENV, RAIZ } from './lib/ambiente.mjs'
import { colorir, ErroAmbiente, info, ok, tratarErroFatal } from './lib/log.mjs'
import { encerrarArvore, executar, portaLivre, WINDOWS } from './lib/processos.mjs'
import { prepararAmbiente } from './setup.mjs'

const VERSAO_GRAPHHOPPER = '11.1'
const VERSAO_JDK = 21
const CACHE = path.join(RAIZ, '.cache', 'graphhopper')
const JAR = path.join(CACHE, `graphhopper-web-${VERSAO_GRAPHHOPPER}.jar`)
const MAPA = path.join(CACHE, 'brazil-latest.osm.pbf')
const GRAFO = path.join(CACHE, 'graph-cache') // graph.location do graphhopper.yml (relativo ao cwd)
const CARIMBO_GRAFO = path.join(GRAFO, '.carimbo')
const CONFIG = path.join(BACKEND, 'scripts', 'graphhopper.yml')
const GERADOR = path.join(BACKEND, 'scripts', 'gerar_geometrias.py')
const URL_JAR = `https://github.com/graphhopper/graphhopper/releases/download/${VERSAO_GRAPHHOPPER}/graphhopper-web-${VERSAO_GRAPHHOPPER}.jar`
const URL_MAPA = 'https://download.geofabrik.de/south-america/brazil-latest.osm.pbf'
const PORTA = 8989 // a mesma do graphhopper.yml
const MEMORIA_IMPORT = '-Xmx6g'
const MEMORIA_SERVIDOR = '-Xmx2g'
// linhas do log do GraphHopper que valem mostrar (o resto é ruído: um aviso por via, um log por pedido)
const RELEVANTE = /start creating graph|pass[12] - finished, took|flushed graph|Started Server|ERROR|Exception|OutOfMemory/

const processos = new Set()
let interrompido = false

// No Windows usa o curl/tar do próprio sistema: o tar do Git Bash não abre .zip nem entende C:\
const ferramenta = (nome) => (WINDOWS ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', `${nome}.exe`) : nome)

async function baixar(url, destino, descricao) {
  if (existsSync(destino)) {
    ok(`${descricao} (já baixado)`)
    return
  }
  info(`Baixando ${descricao}…`)
  const parcial = `${destino}.parcial` // -C - continua um download interrompido
  const { codigo } = await executar(ferramenta('curl'), ['-L', '--fail', '--progress-bar', '-C', '-', '-o', parcial, url], {
    mostrar: true,
  })
  if (codigo !== 0) {
    throw new ErroAmbiente(
      `Falha ao baixar ${url}`,
      'Verifique a internet (em rede corporativa, defina HTTPS_PROXY=http://servidor:porta) e rode de novo; o download continua de onde parou.',
    )
  }
  renameSync(parcial, destino)
  ok(`${descricao} baixado`)
}

async function versaoJava(java) {
  const { codigo, saida } = await executar(java, ['-version'])
  const achado = codigo === 0 && saida.match(/version "(\d+)(?:\.(\d+))?/)
  if (!achado) return null
  return achado[1] === '1' ? Number(achado[2]) : Number(achado[1]) // "1.8" é o Java 8
}

/** Procura bin/java no JDK portátil (no macOS ele fica em Contents/Home/bin). */
function javaDoCache() {
  const executavel = WINDOWS ? 'java.exe' : 'java'
  const fila = [[path.join(CACHE, 'jdk'), 0]]
  while (fila.length) {
    const [pasta, nivel] = fila.shift()
    if (!existsSync(pasta)) continue
    const candidato = path.join(pasta, 'bin', executavel)
    if (existsSync(candidato)) return candidato
    if (nivel < 3) {
      for (const item of readdirSync(pasta, { withFileTypes: true })) {
        if (item.isDirectory()) fila.push([path.join(pasta, item.name), nivel + 1])
      }
    }
  }
  return null
}

async function baixarJdk() {
  const so = { win32: 'windows', linux: 'linux', darwin: 'mac' }[process.platform]
  const arquitetura = { x64: 'x64', arm64: 'aarch64' }[process.arch]
  if (!so || !arquitetura) {
    throw new ErroAmbiente(
      `Não há JDK automático para ${process.platform}/${process.arch}.`,
      'Instale o Java 17+ e defina JAVA com o caminho do executável.',
    )
  }
  info('Java 17+ não encontrado; usando um JDK portátil (fica só em .cache/graphhopper/jdk).')
  const pacote = path.join(CACHE, WINDOWS ? 'jdk.zip' : 'jdk.tar.gz')
  const url = `https://api.adoptium.net/v3/binary/latest/${VERSAO_JDK}/ga/${so}/${arquitetura}/jdk/hotspot/normal/eclipse`
  await baixar(url, pacote, `JDK ${VERSAO_JDK}`)
  const pasta = path.join(CACHE, 'jdk')
  rmSync(pasta, { recursive: true, force: true })
  mkdirSync(pasta, { recursive: true })
  const { codigo, saida } = await executar(ferramenta('tar'), ['-xf', pacote, '-C', pasta])
  rmSync(pacote, { force: true })
  const java = javaDoCache()
  if (codigo !== 0 || !java || (await versaoJava(java)) === null) {
    throw new ErroAmbiente(
      'Não foi possível extrair o JDK baixado.',
      `${saida.trim().split('\n').slice(-3).join('\n')}\nInstale o Java 17+ e defina JAVA com o caminho do executável.`,
    )
  }
  ok(`JDK ${VERSAO_JDK} portátil pronto`)
  return java
}

async function encontrarJava() {
  for (const java of [process.env.JAVA, javaDoCache(), 'java'].filter(Boolean)) {
    const versao = await versaoJava(java)
    if (versao >= 17) {
      ok(`Java ${versao} (${java})`)
      return java
    }
  }
  return baixarJdk()
}

/** Sobe o GraphHopper mostrando só as linhas de progresso; guarda o fim do log para as mensagens de erro. */
function iniciarGraphHopper(java, memoria, comando) {
  const filho = spawn(java, [memoria, `-Ddw.graphhopper.datareader.file=${MAPA}`, '-jar', JAR, comando, CONFIG], {
    cwd: CACHE,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !WINDOWS, // grupo de processos próprio: permite matar a árvore no Linux/Mac
    windowsHide: true,
  })
  processos.add(filho)
  filho.on('close', () => processos.delete(filho))
  filho.ultimas = []
  const prefixo = colorir('ciano', '[graphhopper]')
  for (const fluxo of [filho.stdout, filho.stderr]) {
    let resto = ''
    fluxo.setEncoding('utf8')
    fluxo.on('data', (pedaco) => {
      const linhas = (resto + pedaco).split(/\r?\n/)
      resto = linhas.pop()
      for (const linha of linhas) {
        filho.ultimas.push(linha)
        if (filho.ultimas.length > 20) filho.ultimas.shift()
        // "INFO  [data] com.graphhopper.Classe: mensagem" -> "mensagem"
        // "bad request" é a aresta sem rota por estrada: esperado, e o gerador já resume no fim
        if (RELEVANTE.test(linha) && !linha.includes('bad request')) console.log(`${prefixo} ${linha.replace(/^[A-Z]+\s+\[[^\]]*\]\s+[\w.$]+:\s*/, '')}`)
      }
    })
  }
  return filho
}

const fimDoLog = (filho) => filho.ultimas.slice(-5).join('\n')

function carimboDoGrafo() {
  const mapa = statSync(MAPA)
  const config = createHash('sha256').update(readFileSync(CONFIG)).digest('hex')
  return `${VERSAO_GRAPHHOPPER} ${mapa.size} ${mapa.mtimeMs} ${config}`
}

async function importarMapa(java) {
  if (existsSync(CARIMBO_GRAFO) && readFileSync(CARIMBO_GRAFO, 'utf8') === carimboDoGrafo()) {
    ok('Grafo do GraphHopper em dia')
    return
  }
  rmSync(GRAFO, { recursive: true, force: true })
  info('Importando o mapa no GraphHopper (só quando o mapa ou o graphhopper.yml mudam; ~13 min e ~4 GB de RAM)…')
  const filho = iniciarGraphHopper(java, MEMORIA_IMPORT, 'import')
  const codigo = await new Promise((resolve) => {
    filho.on('error', () => resolve(-1))
    filho.on('close', (fim) => resolve(fim ?? -1))
  })
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'O import do GraphHopper falhou.',
      `${fimDoLog(filho)}\nSem memória? Feche outros programas (o import usa ~4 GB) e rode de novo.`,
    )
  }
  writeFileSync(CARIMBO_GRAFO, carimboDoGrafo())
  ok('Mapa importado')
}

async function subirServidor(java) {
  if (!(await portaLivre(PORTA))) {
    throw new ErroAmbiente(`A porta ${PORTA} já está em uso.`, 'Ficou outro GraphHopper aberto? Feche-o e rode de novo.')
  }
  info('Subindo o servidor do GraphHopper…')
  const servidor = iniciarGraphHopper(java, MEMORIA_SERVIDOR, 'server')
  for (let tentativa = 0; tentativa < 150; tentativa++) {
    if (!processos.has(servidor)) {
      throw new ErroAmbiente('O servidor do GraphHopper parou antes de responder.', fimDoLog(servidor))
    }
    try {
      if ((await fetch(`http://127.0.0.1:${PORTA}/info`)).ok) {
        ok('Servidor do GraphHopper no ar')
        return servidor
      }
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new ErroAmbiente('O servidor do GraphHopper não respondeu em 5 minutos.', fimDoLog(servidor))
}

async function gerar(args) {
  info(`Gerando as geometrias${args.length ? ` (${args.join(' ')})` : ''}…`)
  const { codigo } = await executar(PYTHON_VENV, [GERADOR, ...args], {
    mostrar: true,
    env: { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  })
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'A geração das geometrias falhou (veja acima).',
      'O progresso fica salvo: rode npm run geometrias de novo para continuar.',
    )
  }
}

function encerrarTudo() {
  for (const filho of processos) encerrarArvore(filho)
}

async function main() {
  // SIGHUP: fechar o terminal (Linux/Mac); SIGBREAK: Ctrl+Break (Windows)
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP', ...(WINDOWS ? ['SIGBREAK'] : [])]) {
    process.on(sinal, () => {
      interrompido = true
      encerrarTudo()
    })
  }
  await prepararAmbiente()
  mkdirSync(CACHE, { recursive: true })
  const java = await encontrarJava()
  await baixar(URL_JAR, JAR, `GraphHopper ${VERSAO_GRAPHHOPPER}`)
  await baixar(URL_MAPA, MAPA, 'mapa do Brasil (OpenStreetMap, ~2,1 GB)')
  await importarMapa(java)
  const servidor = await subirServidor(java)
  try {
    await gerar(process.argv.slice(2))
  } finally {
    encerrarArvore(servidor)
  }
  ok('Geometrias prontas em backend/data/geometrias_arestas.csv.gz. Reinicie o npm run dev para usá-las.')
}

main().catch((erro) => {
  encerrarTudo()
  if (interrompido) {
    erro = new ErroAmbiente('Interrompido.', 'O que já foi feito fica salvo; rode npm run geometrias de novo para continuar.')
  }
  setTimeout(() => tratarErroFatal(erro), 500) // dá tempo do taskkill/kill agir
})
