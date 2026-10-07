import { spawn } from 'node:child_process'
import net from 'node:net'
import { colorir, ErroAmbiente } from './log.mjs'

export const WINDOWS = process.platform === 'win32'

/**
 * Executa um comando até o fim, sem shell (argumentos em array: espaços e
 * acentos nos caminhos não quebram nada). Nunca rejeita: resolve com
 * { codigo, saida }, onde codigo -1 significa "não foi possível executar".
 */
export function executar(comando, args, { cwd, env, mostrar = false, shell = false } = {}) {
  return new Promise((resolve) => {
    let filho
    try {
      filho = spawn(comando, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: mostrar ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell,
      })
    } catch (erro) {
      resolve({ codigo: -1, saida: String(erro) })
      return
    }
    let saida = ''
    filho.stdout?.on('data', (pedaco) => (saida += pedaco))
    filho.stderr?.on('data', (pedaco) => (saida += pedaco))
    filho.on('error', (erro) => resolve({ codigo: -1, saida: String(erro) }))
    filho.on('close', (codigo) => resolve({ codigo: codigo ?? -1, saida }))
  })
}

/** Roda o npm que está executando este script (npm_execpath); senão, o npm do PATH. */
export function executarNpm(args, cwd) {
  const cli = process.env.npm_execpath
  if (cli && /\.c?js$/.test(cli)) return executar(process.execPath, [cli, ...args], { cwd, mostrar: true })
  // npm.cmd no Windows só roda via shell (restrição do Node desde 2024)
  return executar(WINDOWS ? 'npm.cmd' : 'npm', args, { cwd, mostrar: true, shell: WINDOWS })
}

/** Sobe um processo de longa duração com cada linha de saída prefixada por [nome]. */
export function iniciarServico({ nome, cor, comando, args, cwd, env }) {
  const filho = spawn(comando, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !WINDOWS, // grupo de processos próprio: permite matar a árvore no Linux/Mac
    windowsHide: true,
  })
  const prefixo = colorir(cor, `[${nome}]`)
  for (const [fluxo, destino] of [
    [filho.stdout, process.stdout],
    [filho.stderr, process.stderr],
  ]) {
    let resto = ''
    fluxo.setEncoding('utf8')
    fluxo.on('data', (pedaco) => {
      const linhas = (resto + pedaco).split(/\r?\n/)
      resto = linhas.pop()
      for (const linha of linhas) destino.write(`${prefixo} ${linha}\n`)
    })
    fluxo.on('end', () => {
      if (resto) destino.write(`${prefixo} ${resto}\n`)
    })
  }
  return filho
}

/** Encerra o processo e todos os filhos dele (ex.: o reloader do uvicorn). */
export function encerrarArvore(filho) {
  if (filho.pid === undefined || filho.exitCode !== null || filho.signalCode !== null) return
  if (WINDOWS) {
    spawn('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    try {
      process.kill(-filho.pid, 'SIGTERM')
    } catch {
      // já terminou
    }
  }
}

function portaLivre(porta) {
  return new Promise((resolve) => {
    const servidor = net.createServer()
    servidor.once('error', () => resolve(false))
    servidor.once('listening', () => servidor.close(() => resolve(true)))
    servidor.listen(porta, '127.0.0.1')
  })
}

export async function primeiraPortaLivre(inicial, tentativas = 20) {
  for (let porta = inicial; porta < inicial + tentativas; porta++) {
    if (await portaLivre(porta)) return porta
  }
  throw new ErroAmbiente(
    `Nenhuma porta livre entre ${inicial} e ${inicial + tentativas - 1}.`,
    'Feche os programas que usam essas portas ou defina API_PORT com outra porta inicial.',
  )
}
