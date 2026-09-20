/**
 * A narrativa: o log estruturado da luta virando texto que rola na tela.
 *
 * O servidor manda o log cru (spec 7.6) — cada golpe com dano, se foi
 * crítico, se esquivou, quanto sobrou de vida. Aqui isso vira prosa, uma
 * linha por vez, com a barra de vida dos dois lados acompanhando. É o mesmo
 * dado que no WhatsApp virava seis linhas de texto; a diferença é que aqui
 * cabe a luta inteira.
 */
import { $, barra, el, limpar, num, pct } from './nucleo.js'

const RITMO = 260 // ms entre duas linhas
const RITMO_MEDIO = 130
const RITMO_RAPIDO = 45

/**
 * Luta curta passa devagar, para dar de ver; luta longa acelera, senão
 * assistir a 30 rodadas cansa. O palco acompanha o mesmo ritmo.
 */
const ritmoPara = (quantasLinhas) =>
  quantasLinhas > 70 ? RITMO_RAPIDO : quantasLinhas > 34 ? RITMO_MEDIO : RITMO

let pulando = false
let emCurso = false

const cena = () => $('#cena')
const narrativa = () => $('#narrativa')

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

function rolarAteOFim() {
  const c = cena()
  c.scrollTop = c.scrollHeight
}

/** Acrescenta um nó ao fim da narrativa e rola junto. */
export function escrever(node) {
  narrativa().append(node)
  rolarAteOFim()
  return node
}

export const limparNarrativa = () => limpar(narrativa())

export const linha = (texto, classe = '') => escrever(el('p', { class: classe }, texto))

export const sussurro = (texto) => escrever(el('p', { class: 'sussurro' }, texto))

export const tituloDeCena = (texto) => escrever(el('div', { class: 'titulo-cena' }, texto))

/** Um parágrafo com pedaços de classes diferentes: ...ricos(['x', el(...)]) */
export const rico = (...partes) => escrever(el('p', {}, ...partes))

export const forte = (texto, classe = 'destaque') => el('span', { class: classe }, texto)

export function definirCena(titulo) {
  $('#titulo-cena').textContent = titulo
}

// ------------------------------------------------------------- placar

/** O placar com as duas barras de vida, atualizado a cada golpe. */
function criarPlacar(nomeA, hpA, hpMaxA, nomeB, hpB, hpMaxB) {
  const barraA = barra('vida', hpA, hpMaxA)
  const barraB = barra('vida', hpB, hpMaxB)

  const node = el(
    'div',
    { class: 'placar-luta' },
    el('div', { class: 'lado' }, el('div', { class: 'quem' }, nomeA), barraA),
    el('div', { class: 'versus' }, '⚔'),
    el('div', { class: 'lado direita' }, el('div', { class: 'quem' }, nomeB), barraB),
  )

  const atualizar = (lado, hp, hpMax) => {
    const alvo = lado === 'a' ? barraA : barraB
    alvo.querySelector('.preenchida').style.width = `${pct(hp, hpMax)}%`
    alvo.querySelector('.rotulo').textContent = `${num(Math.max(0, hp))} / ${num(hpMax)}`
  }

  return { node, atualizar }
}

// ---------------------------------------------------------- vocabulário

const VERBOS = ['acertou', 'atingiu', 'golpeou', 'alcançou', 'feriu']
const VERBOS_ESQUIVA = ['desviou', 'saiu da linha do golpe', 'leu o movimento e escapou']

const sorteio = (lista, semente) => lista[semente % lista.length]

/** Uma entrada de log de combate individual virando um parágrafo. */
function descrever(entrada, i) {
  if (entrada.tipo === 'regenerou') {
    return el(
      'p',
      {},
      forte(entrada.nome),
      ' se refez em ',
      forte(num(entrada.cura), 'cura'),
      ' de vida.',
    )
  }

  if (entrada.tipo === 'preso') {
    return el('p', { class: 'sussurro' }, `${entrada.nome} está preso e perdeu a vez.`)
  }

  if (entrada.esquivou) {
    return el(
      'p',
      {},
      forte(entrada.alvo),
      ' ',
      el('span', { class: 'esquiva' }, sorteio(VERBOS_ESQUIVA, i)),
      ` do golpe de ${entrada.nome}.`,
    )
  }

  const partes = []

  if (entrada.executou) partes.push(el('span', { class: 'execucao' }, 'EXECUÇÃO! '))
  else if (entrada.critico) partes.push(el('span', { class: 'critico' }, 'CRÍTICO! '))
  else if (entrada.marca === 'duplo') partes.push(el('span', { class: 'destaque' }, 'Em sequência, '))
  else if (entrada.marca === 'revide') partes.push(el('span', { class: 'destaque' }, 'No revide, '))
  else if (entrada.marca === 'servo') partes.push(el('span', { class: 'destaque' }, 'O servo avança: '))

  partes.push(
    forte(entrada.nome),
    ` ${sorteio(VERBOS, i)} `,
    forte(entrada.alvo),
    ' em ',
    forte(num(entrada.dano), entrada.executou ? 'execucao' : entrada.critico ? 'critico' : 'destaque'),
    entrada.hpAlvo !== undefined
      ? el('span', { class: 'sussurro' }, `  (${num(Math.max(0, entrada.hpAlvo))}/${num(entrada.hpMaxAlvo)})`)
      : '.',
  )

  return el('p', {}, ...partes)
}

/** Uma entrada de log de raid (o formato de grupo é diferente). */
function descreverGrupo(entrada, i) {
  if (entrada.tipo === 'curaGrupo') {
    return el(
      'p',
      {},
      forte(entrada.nome),
      ' ergue as mãos e a luz cai sobre o grupo: ',
      forte(`+${num(entrada.cura)}`, 'cura'),
      ` de vida entre ${entrada.curados} ${entrada.curados > 1 ? 'aliados' : 'aliado'}.`,
    )
  }

  if (entrada.tipo === 'preso') {
    return el('p', { class: 'sussurro' }, `Rodada ${entrada.rodada}: ${entrada.nome} perdeu a vez.`)
  }

  if (entrada.tipo === 'area') {
    const caiu = entrada.derrubados.length
      ? ` — ${entrada.derrubados.join(', ')} ${entrada.derrubados.length > 1 ? 'caíram' : 'caiu'}`
      : ''
    return el(
      'p',
      {},
      el('span', { class: 'perigo' }, `Rodada ${entrada.rodada}: `),
      forte(entrada.nome),
      ` acertou o grupo inteiro (${entrada.atingidos} atingidos)`,
      caiu ? el('span', { class: 'perigo' }, caiu) : '',
      '.',
    )
  }

  if (entrada.tipo === 'chefe') {
    if (entrada.esquivou) {
      return el('p', {}, forte(entrada.alvo), el('span', { class: 'esquiva' }, ' desviou'), ' do chefe.')
    }
    return el(
      'p',
      {},
      forte(entrada.nome),
      ' acertou ',
      forte(entrada.alvo),
      ' em ',
      forte(num(entrada.dano), 'perigo'),
      entrada.derrubou ? el('span', { class: 'perigo' }, '  — caiu!') : '',
    )
  }

  if (entrada.esquivou) {
    return el('p', { class: 'esquiva' }, `O chefe desviou do golpe de ${entrada.nome}.`)
  }

  const partes = []
  if (entrada.executou) partes.push(el('span', { class: 'execucao' }, 'EXECUÇÃO! '))
  else if (entrada.critico) partes.push(el('span', { class: 'critico' }, 'CRÍTICO! '))
  else if (entrada.marca === 'servo') partes.push(el('span', { class: 'destaque' }, 'O servo de '))
  else if (entrada.marca === 'duplo') partes.push(el('span', { class: 'destaque' }, 'Em sequência, '))

  partes.push(forte(entrada.nome), ` ${sorteio(VERBOS, i)} o chefe em `, forte(num(entrada.dano)))
  return el('p', {}, ...partes)
}

// ------------------------------------------------------------- exibição

/**
 * Reproduz uma luta individual. Enquanto roda, clicar ou apertar uma tecla
 * pula para o fim — ninguém quer assistir 30 rodadas duas vezes.
 */
export async function narrarLuta({ nomeA, hpA, hpMaxA, nomeB, hpB, hpMaxB, log, aoEntrada }) {
  const placar = criarPlacar(nomeA, hpA, hpMaxA, nomeB, hpB, hpMaxB)
  escrever(placar.node)

  pulando = false
  emCurso = true

  const pular = () => {
    pulando = true
  }
  cena().addEventListener('click', pular)
  window.addEventListener('keydown', pular)

  let vidaA = hpA
  let vidaB = hpB

  try {
    for (let i = 0; i < log.length; i++) {
      const entrada = log[i]
      escrever(descrever(entrada, i))
      // O palco desenha o mesmo lance que a linha acabou de contar.
      aoEntrada?.(entrada)

      if (entrada.tipo === 'ataque' && !entrada.esquivou) {
        // `quem` é quem bateu; o alvo é o outro lado.
        if (entrada.quem === 'a') {
          vidaB = entrada.hpAlvo
          placar.atualizar('b', vidaB, hpMaxB)
          if (entrada.hpQuemAtaca !== undefined) placar.atualizar('a', entrada.hpQuemAtaca, hpMaxA)
        } else {
          vidaA = entrada.hpAlvo
          placar.atualizar('a', vidaA, hpMaxA)
          if (entrada.hpQuemAtaca !== undefined) placar.atualizar('b', entrada.hpQuemAtaca, hpMaxB)
        }
      } else if (entrada.tipo === 'regenerou' && entrada.hpQuemAtaca !== undefined) {
        placar.atualizar(entrada.quem, entrada.hpQuemAtaca, entrada.quem === 'a' ? hpMaxA : hpMaxB)
      }

      await dormir(pulando ? 0 : ritmoPara(log.length))
    }
  } finally {
    emCurso = false
    cena().removeEventListener('click', pular)
    window.removeEventListener('keydown', pular)
  }

  return placar
}

/** Reproduz uma luta de raid: uma barra só, a do chefe. */
export async function narrarRaid({ nomeDoChefe, hpMaxDoChefe, log }) {
  const barraChefe = barra('vida', hpMaxDoChefe, hpMaxDoChefe)
  escrever(
    el(
      'div',
      { class: 'placar-luta', style: 'grid-template-columns:1fr' },
      el('div', { class: 'lado' }, el('div', { class: 'quem' }, nomeDoChefe), barraChefe),
    ),
  )

  pulando = false
  emCurso = true
  const pular = () => {
    pulando = true
  }
  cena().addEventListener('click', pular)
  window.addEventListener('keydown', pular)

  try {
    for (let i = 0; i < log.length; i++) {
      const entrada = log[i]
      escrever(descreverGrupo(entrada, i))

      if (entrada.hpChefe !== undefined) {
        barraChefe.querySelector('.preenchida').style.width = `${pct(entrada.hpChefe, hpMaxDoChefe)}%`
        barraChefe.querySelector('.rotulo').textContent = `${num(Math.max(0, entrada.hpChefe))} / ${num(hpMaxDoChefe)}`
      }

      await dormir(pulando ? 0 : log.length > 60 ? 20 : 90)
    }
  } finally {
    emCurso = false
    cena().removeEventListener('click', pular)
    window.removeEventListener('keydown', pular)
  }
}

export const narrando = () => emCurso

/** Espera a narração em curso terminar — para um aviso não atropelar a luta. */
export async function esperarNarracao() {
  while (emCurso) await dormir(250)
}
