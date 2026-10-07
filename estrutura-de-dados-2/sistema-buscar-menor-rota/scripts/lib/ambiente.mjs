import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ErroAmbiente } from './log.mjs'
import { executar, WINDOWS } from './processos.mjs'

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const BACKEND = path.join(RAIZ, 'backend')
export const FRONTEND = path.join(RAIZ, 'frontend')
export const VENV = path.join(BACKEND, '.venv')
export const PYTHON_VENV = WINDOWS ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python')
export const BANCO = path.join(BACKEND, 'data', 'rotas.db')

export const NODE_MINIMO = [20, 19]
export const PYTHON_MINIMO = [3, 11]

export function versaoAtende(versao, minimo) {
  for (let i = 0; i < minimo.length; i++) {
    if ((versao[i] ?? 0) !== minimo[i]) return (versao[i] ?? 0) > minimo[i]
  }
  return true
}

function hashArquivo(caminho) {
  return createHash('sha256').update(readFileSync(caminho)).digest('hex')
}

/** true se o carimbo guarda o hash atual do arquivo-fonte (nada mudou desde a última instalação). */
export function carimboConfere(fonte, carimbo) {
  return existsSync(carimbo) && readFileSync(carimbo, 'utf8').trim() === hashArquivo(fonte)
}

export function gravarCarimbo(fonte, carimbo) {
  writeFileSync(carimbo, hashArquivo(fonte))
}

const SONDA_VERSAO = 'import sys; print("%d.%d.%d" % sys.version_info[:3])'

/** Executa o Python de verdade para ler a versão (descarta o atalho falso da Microsoft Store). */
export async function versaoPython(comando, argsBase = []) {
  const { codigo, saida } = await executar(comando, [...argsBase, '-c', SONDA_VERSAO])
  if (codigo !== 0) return null
  const achado = saida.match(/^(\d+)\.(\d+)\.(\d+)\s*$/m)
  return achado ? achado.slice(1, 4).map(Number) : null
}

const DICA_PYTHON = {
  win32:
    'Instale em https://www.python.org/downloads/ marcando "Add python.exe to PATH"\n' +
    '(ou: winget install Python.Python.3.13) e abra um terminal novo.',
  darwin: 'Instale com: brew install python@3.13  (ou https://www.python.org/downloads/)',
  linux: 'Instale com: sudo apt install python3 python3-venv  (ou o gerenciador da sua distribuição)',
}

export async function encontrarPython() {
  const candidatos = []
  if (process.env.PYTHON) candidatos.push({ comando: process.env.PYTHON, args: [] })
  if (WINDOWS) candidatos.push({ comando: 'py', args: ['-3'] })
  candidatos.push({ comando: 'python3', args: [] }, { comando: 'python', args: [] })

  const recusados = []
  for (const candidato of candidatos) {
    const versao = await versaoPython(candidato.comando, candidato.args)
    if (!versao) continue
    if (versaoAtende(versao, PYTHON_MINIMO)) return { ...candidato, versao }
    recusados.push(`${[candidato.comando, ...candidato.args].join(' ')} → ${versao.join('.')}`)
  }
  const minimo = PYTHON_MINIMO.join('.')
  throw new ErroAmbiente(
    recusados.length
      ? `Python ${minimo}+ não encontrado (encontrei: ${recusados.join(', ')}).`
      : `Python ${minimo}+ não encontrado.`,
    `${DICA_PYTHON[process.platform] ?? DICA_PYTHON.linux}\n` +
      'Se o Python está instalado fora do PATH, defina a variável PYTHON com o caminho do executável.',
  )
}
