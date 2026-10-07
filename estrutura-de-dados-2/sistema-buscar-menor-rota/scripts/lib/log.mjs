const CORES = { ciano: 36, magenta: 35, verde: 32, vermelho: 31, amarelo: 33, cinza: 90 }
const usarCor = !process.env.NO_COLOR && Boolean(process.stdout.isTTY)

export function colorir(cor, texto) {
  return usarCor ? `\x1b[${CORES[cor]}m${texto}\x1b[0m` : texto
}

export function ok(mensagem) {
  console.log(`${colorir('verde', '✔')} ${mensagem}`)
}

export function info(mensagem) {
  console.log(`${colorir('cinza', '•')} ${mensagem}`)
}

export function falha(mensagem, dica) {
  console.error(`${colorir('vermelho', '✖')} ${mensagem}`)
  if (dica) console.error(colorir('amarelo', `  → ${dica.split('\n').join('\n    ')}`))
}

/** Erro esperado do ambiente: mostra mensagem + dica, sem stack trace. */
export class ErroAmbiente extends Error {
  constructor(mensagem, dica) {
    super(mensagem)
    this.dica = dica
  }
}

export function tratarErroFatal(erro) {
  if (erro instanceof ErroAmbiente) falha(erro.message, erro.dica)
  else console.error(erro)
  process.exit(1)
}
