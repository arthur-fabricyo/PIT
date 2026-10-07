import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BACKEND,
  BANCO,
  carimboConfere,
  encontrarPython,
  FRONTEND,
  gravarCarimbo,
  NODE_MINIMO,
  PYTHON_VENV,
  VENV,
  versaoAtende,
  versaoPython,
} from './lib/ambiente.mjs'
import { ErroAmbiente, info, ok, tratarErroFatal } from './lib/log.mjs'
import { executar, executarNpm, WINDOWS } from './lib/processos.mjs'

const AMBIENTE_PYTHON = { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }

function verificarNode() {
  const versao = process.versions.node.split('.').map(Number)
  if (!versaoAtende(versao, NODE_MINIMO)) {
    throw new ErroAmbiente(
      `Node ${NODE_MINIMO.join('.')}+ é necessário (você tem ${process.versions.node}).`,
      'Atualize em https://nodejs.org/ (versão LTS) e abra um terminal novo.',
    )
  }
  ok(`Node ${process.versions.node}`)
}

async function venvFunciona() {
  return existsSync(PYTHON_VENV) && (await versaoPython(PYTHON_VENV)) !== null
}

async function prepararVenv(python) {
  if (await venvFunciona()) {
    ok('Ambiente virtual do Python (backend/.venv)')
    return
  }
  if (existsSync(VENV)) {
    info('backend/.venv está quebrada; recriando…')
    rmSync(VENV, { recursive: true, force: true })
  }
  info('Criando backend/.venv…')
  const { codigo, saida } = await executar(python.comando, [...python.args, '-m', 'venv', VENV])
  if (codigo !== 0 || !(await venvFunciona())) {
    const [maior, menor] = python.versao
    const faltaVenv = /ensurepip|python3-venv|No module named venv/i.test(saida)
    throw new ErroAmbiente(
      'Não foi possível criar o ambiente virtual do Python.',
      faltaVenv
        ? `Instale o módulo venv: sudo apt install python3-venv  (ou python${maior}.${menor}-venv)`
        : saida.trim().split('\n').slice(-5).join('\n'),
    )
  }
  ok('Ambiente virtual do Python criado (backend/.venv)')
}

async function instalarDependenciasPython() {
  const requisitos = path.join(BACKEND, 'requirements.txt')
  const carimbo = path.join(VENV, '.requirements.sha256')
  if (carimboConfere(requisitos, carimbo)) {
    ok('Dependências do Python em dia')
    return
  }
  info('Instalando dependências do Python (pip)…')
  const { codigo } = await executar(
    PYTHON_VENV,
    ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', requisitos],
    { mostrar: true },
  )
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'A instalação das dependências do Python falhou (veja o erro acima).',
      'Sem internet ou atrás de proxy corporativo? Defina HTTPS_PROXY=http://servidor:porta e rode de novo.',
    )
  }
  gravarCarimbo(requisitos, carimbo)
  ok('Dependências do Python instaladas')
}

async function instalarDependenciasFront() {
  const lock = path.join(FRONTEND, 'package-lock.json')
  const carimbo = path.join(FRONTEND, 'node_modules', '.package-lock.sha256')
  if (carimboConfere(lock, carimbo)) {
    ok('Dependências do front em dia')
    return
  }
  info('Instalando dependências do front (npm install)…')
  const { codigo } = await executarNpm(['install', '--no-audit', '--no-fund'], FRONTEND)
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'npm install do front falhou (veja o erro acima).',
      'Atrás de proxy corporativo? Rode: npm config set proxy http://servidor:porta  e tente de novo.',
    )
  }
  gravarCarimbo(lock, carimbo) // depois do install: o npm pode reescrever o lock
  ok('Dependências do front instaladas')
}

async function prepararBanco() {
  if (existsSync(BANCO)) {
    ok('Banco de dados (backend/data/rotas.db)')
    return
  }
  info('Gerando backend/data/rotas.db (só na primeira vez; leva menos de 1 minuto)…')
  const { codigo } = await executar(PYTHON_VENV, [path.join(BACKEND, 'scripts', 'construir_banco.py')], {
    mostrar: true,
    env: AMBIENTE_PYTHON,
  })
  if (codigo !== 0) {
    throw new ErroAmbiente(
      'Falha ao gerar o banco de dados (veja o erro acima).',
      'Confira se backend/data/municipios.csv e backend/data/estados.csv existem.',
    )
  }
  ok('Banco de dados gerado')
}

export async function prepararAmbiente() {
  verificarNode()
  const python = await encontrarPython()
  ok(`Python ${python.versao.join('.')} (${[python.comando, ...python.args].join(' ')})`)
  await prepararVenv(python)
  await instalarDependenciasPython()
  await instalarDependenciasFront()
  await prepararBanco()
}

// Roda só quando chamado direto (npm run setup), não quando importado pelo dev.mjs.
// No Windows a letra do drive pode vir em caixa diferente, então compara sem caixa.
const normalizar = (caminho) => (WINDOWS ? path.resolve(caminho).toLowerCase() : path.resolve(caminho))
if (process.argv[1] && normalizar(process.argv[1]) === normalizar(fileURLToPath(import.meta.url))) {
  prepararAmbiente().then(() => ok('Ambiente pronto. Rode: npm run dev'), tratarErroFatal)
}
