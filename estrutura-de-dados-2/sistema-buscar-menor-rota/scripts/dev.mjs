import path from 'node:path'
import { BACKEND, FRONTEND, PYTHON_VENV } from './lib/ambiente.mjs'
import { falha, info, ok, tratarErroFatal } from './lib/log.mjs'
import { encerrarArvore, iniciarServico, primeiraPortaLivre } from './lib/processos.mjs'
import { prepararAmbiente } from './setup.mjs'

async function main() {
  await prepararAmbiente()

  const portaDesejada = Number(process.env.API_PORT) || 8000
  const portaApi = await primeiraPortaLivre(portaDesejada)
  if (portaApi !== portaDesejada) info(`Porta ${portaDesejada} ocupada; a API vai usar a ${portaApi}.`)

  const ambiente = { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', FORCE_COLOR: '1' }
  const api = iniciarServico({
    nome: 'api',
    cor: 'ciano',
    comando: PYTHON_VENV,
    args: ['-m', 'uvicorn', 'app.main:app', '--reload', '--reload-dir', 'app', '--host', '127.0.0.1', '--port', String(portaApi)],
    cwd: BACKEND,
    env: ambiente,
  })
  const web = iniciarServico({
    nome: 'web',
    cor: 'magenta',
    comando: process.execPath,
    args: [path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'],
    cwd: FRONTEND,
    env: { ...ambiente, API_PORT: String(portaApi) },
  })
  ok(`API em http://127.0.0.1:${portaApi}/docs — o endereço do site aparece nas linhas [web]. Ctrl+C encerra tudo.`)

  let encerrando = false
  function encerrar(codigo) {
    if (encerrando) return
    encerrando = true
    encerrarArvore(api)
    encerrarArvore(web)
    setTimeout(() => process.exit(codigo), 500) // dá tempo do taskkill/kill agir
  }

  for (const [nome, filho] of [
    ['api', api],
    ['web', web],
  ]) {
    filho.on('error', (erro) => {
      falha(`Não foi possível iniciar [${nome}]: ${erro.message}`)
      encerrar(1)
    })
    filho.on('exit', (codigo, sinal) => {
      // No Windows o Ctrl+C chega aos filhos ao mesmo tempo que a nós;
      // esperamos um instante para não confundir isso com uma queda.
      setTimeout(() => {
        if (encerrando) return
        falha(`[${nome}] terminou (${sinal ?? `código ${codigo}`}); encerrando o outro serviço.`)
        encerrar(codigo || 1)
      }, 300)
    })
  }
  // SIGHUP: fechar o terminal (Linux/Mac); SIGBREAK: Ctrl+Break (Windows)
  const sinais = ['SIGINT', 'SIGTERM', 'SIGHUP', ...(process.platform === 'win32' ? ['SIGBREAK'] : [])]
  for (const sinal of sinais) process.on(sinal, () => encerrar(0))
}

main().catch(tratarErroFatal)
