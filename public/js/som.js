/**
 * Alertas sonoros: um toque curto para o que chega sem a pessoa pedir —
 * evento, raid, duelo, negociação.
 *
 * Os sons são sintetizados na hora com a Web Audio API. Nada de arquivo de
 * áudio para baixar, e cada tipo de aviso tem um desenho próprio, dá para
 * saber o que chegou sem olhar a tela.
 *
 * O navegador só deixa tocar som depois que a pessoa interagiu com a página
 * (clique ou tecla). Por isso o contexto de áudio nasce no primeiro gesto —
 * antes disso, um aviso que chegar fica em silêncio.
 */

const CHAVE = 'resenha:som'

let contexto = null
let saida = null
const ultimaVez = new Map()

export function somLigado() {
  try {
    return localStorage.getItem(CHAVE) !== 'desligado'
  } catch {
    return true
  }
}

export function alternarSom() {
  const ligar = !somLigado()
  try {
    localStorage.setItem(CHAVE, ligar ? 'ligado' : 'desligado')
  } catch {
    // Armazenamento bloqueado: vale só até recarregar.
  }
  if (ligar) tocar('aviso')
  return ligar
}

function prepararContexto() {
  if (contexto) {
    if (contexto.state === 'suspended') contexto.resume().catch(() => {})
    return contexto
  }

  const Classe = window.AudioContext || window.webkitAudioContext
  if (!Classe) return null

  contexto = new Classe()

  // Tudo passa por um passa-baixa e um volume geral: tira a aspereza das
  // ondas quadradas e dente de serra, e deixa o jogo com um volume só.
  const filtro = contexto.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.value = 3200
  saida = contexto.createGain()
  saida.gain.value = 0.55
  filtro.connect(saida)
  saida.connect(contexto.destination)
  saida = filtro

  return contexto
}

/** Liga o áudio no primeiro gesto da pessoa na página. */
export function destravarSom() {
  const destravar = () => {
    prepararContexto()
    window.removeEventListener('pointerdown', destravar)
    window.removeEventListener('keydown', destravar)
  }
  window.addEventListener('pointerdown', destravar)
  window.addEventListener('keydown', destravar)
}

/**
 * Cada som é uma lista de notas: frequência (Hz), quando começa e quanto dura
 * (segundos), forma da onda e volume. `ate` desliza a frequência até ali.
 */
const SONS = {
  // Fanfarra subindo: um chamado para todo mundo.
  evento: [
    { f: 523.25, t: 0, d: 0.16, onda: 'triangle', v: 0.32 },
    { f: 659.25, t: 0.14, d: 0.16, onda: 'triangle', v: 0.32 },
    { f: 783.99, t: 0.28, d: 0.16, onda: 'triangle', v: 0.32 },
    { f: 1046.5, t: 0.42, d: 0.5, onda: 'triangle', v: 0.36 },
    { f: 523.25, t: 0.42, d: 0.5, onda: 'sine', v: 0.18 },
  ],
  // Trompa grave, duas vezes: chamado de guerra.
  raid: [
    { f: 110, t: 0, d: 0.42, onda: 'sawtooth', v: 0.22 },
    { f: 164.81, t: 0.36, d: 0.7, onda: 'sawtooth', v: 0.24 },
    { f: 82.41, t: 0.36, d: 0.7, onda: 'sine', v: 0.25 },
  ],
  // Lâminas batendo: metálico e curto.
  pvp: [
    { f: 1500, t: 0, d: 0.12, onda: 'square', v: 0.09, ate: 700 },
    { f: 2100, t: 0.11, d: 0.22, onda: 'square', v: 0.08, ate: 1200 },
    { f: 3150, t: 0.11, d: 0.3, onda: 'sine', v: 0.08 },
  ],
  // Duas moedas.
  mercado: [
    { f: 1318.5, t: 0, d: 0.14, onda: 'sine', v: 0.3 },
    { f: 1975.5, t: 0.1, d: 0.35, onda: 'sine', v: 0.26 },
  ],
  // Um toque neutro, para o resto.
  aviso: [{ f: 880, t: 0, d: 0.22, onda: 'sine', v: 0.26 }],
}

/** Toca um dos sons. Silencioso se o som estiver desligado ou travado. */
export function tocar(tipo) {
  if (!somLigado()) return
  const notas = SONS[tipo] ?? SONS.aviso

  // Três avisos iguais no mesmo instante (três pessoas entrando na sala)
  // viram um só.
  const agora = Date.now()
  if (agora - (ultimaVez.get(tipo) ?? 0) < 700) return
  ultimaVez.set(tipo, agora)

  const ctx = prepararContexto()
  if (!ctx || ctx.state !== 'running') return

  const inicio = ctx.currentTime + 0.02
  for (const n of notas) {
    const osc = ctx.createOscillator()
    const volume = ctx.createGain()
    const t0 = inicio + n.t
    const t1 = t0 + n.d

    osc.type = n.onda
    osc.frequency.setValueAtTime(n.f, t0)
    if (n.ate) osc.frequency.exponentialRampToValueAtTime(n.ate, t1)

    volume.gain.setValueAtTime(0.0001, t0)
    volume.gain.exponentialRampToValueAtTime(n.v, t0 + 0.012)
    volume.gain.exponentialRampToValueAtTime(0.0001, t1)

    osc.connect(volume)
    volume.connect(saida)
    osc.start(t0)
    osc.stop(t1 + 0.05)
  }
}
