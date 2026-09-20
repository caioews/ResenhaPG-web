/** Geracao de equipamento: tipo, material por nivel, raridade e atributos. */
import { config } from '../config.js'
import { classePodeUsar } from './classes.js'
import { FEITICOS } from './feiticos.js'

export const RARIDADES = {
  comum: { nome: 'comum', emoji: '⚪', mult: 1.0, peso: 55 },
  incomum: { nome: 'incomum', emoji: '🟢', mult: 1.25, peso: 27 },
  raro: { nome: 'raro', emoji: '🔵', mult: 1.6, peso: 13 },
  epico: { nome: 'épico', emoji: '🟣', mult: 2.1, peso: 4.4 },
  lendario: { nome: 'lendário', emoji: '🟠', mult: 3.0, peso: 0.6 },
}

const ORDEM_RARIDADE = ['comum', 'incomum', 'raro', 'epico', 'lendario']

/**
 * Tipos de equipamento. "slot" e onde ele entra no personagem.
 * Os nomes sao todos com preposicao ("de Ferro") para nao dar problema
 * de genero: "Espada de Ferro" e "Escudo de Ferro" funcionam igual.
 */
export const TIPOS = {
  espada: { nome: 'Espada', slot: 'arma', emoji: '⚔️' },
  cajado: { nome: 'Cajado', slot: 'arma', emoji: '🪄' },
  arco: { nome: 'Arco', slot: 'arma', emoji: '🏹' },
  adaga: { nome: 'Adaga', slot: 'arma', emoji: '🗡️' },
  rapieira: { nome: 'Rapieira', slot: 'arma', emoji: '🤺' },
  martelo: { nome: 'Martelo', slot: 'arma', emoji: '🔨' },
  maca: { nome: 'Maça', slot: 'arma', emoji: '🏏' },
  flauta: { nome: 'Flauta', slot: 'arma', emoji: '🪈' },
  banjo: { nome: 'Banjo', slot: 'arma', emoji: '🪕' },
  // A unica arma que toda classe equipa, em qualquer degrau da arvore.
  // Quem decide isso e ARMAS_DE_TODOS, em classes.js.
  foice: { nome: 'Foice', slot: 'arma', emoji: '🌾' },
  // Armas de especialidade: so caem para quem evoluiu naquele caminho.
  pistola: { nome: 'Pistola', slot: 'arma', emoji: '🔫', exclusivo: true },
  machado: { nome: 'Machado', slot: 'arma', emoji: '🪓', exclusivo: true },
  escudo: { nome: 'Escudo', slot: 'secundario', emoji: '🛡️' },
  magia: { nome: 'Magia', slot: 'secundario', emoji: '✨' },
  grimorio: { nome: 'Grimório', slot: 'secundario', emoji: '📕' },
  punhal: { nome: 'Punhal', slot: 'secundario', emoji: '🔪' },
  aljava: { nome: 'Aljava', slot: 'secundario', emoji: '🎯' },
  manopla: { nome: 'Manopla', slot: 'secundario', emoji: '🥊' },
  capa: { nome: 'Capa', slot: 'secundario', emoji: '🧣' },
  totem: { nome: 'Totem Ritualístico', slot: 'secundario', emoji: '🗿' },
  mascara: { nome: 'Máscara Cênica', slot: 'secundario', emoji: '🎭' },
  caveira: { nome: 'Caveira', slot: 'secundario', emoji: '☠️', exclusivo: true },
  rede: { nome: 'Rede', slot: 'secundario', emoji: '🕸️', exclusivo: true },
  elmo: { nome: 'Elmo', slot: 'elmo', emoji: '⛑️' },
  armadura: { nome: 'Armadura', slot: 'armadura', emoji: '🥋' },
  anel: { nome: 'Anel', slot: 'anel', emoji: '💍' },
}

export const SLOTS = ['arma', 'secundario', 'elmo', 'armadura', 'anel']

export const NOME_DO_SLOT = {
  arma: 'Arma',
  secundario: 'Secundário',
  elmo: 'Elmo',
  armadura: 'Armadura',
  anel: 'Anel',
}

const MATERIAIS = [
  { ate: 4, nome: 'de Madeira' },
  { ate: 9, nome: 'de Ferro' },
  { ate: 14, nome: 'de Aço' },
  { ate: 19, nome: 'de Prata' },
  { ate: 24, nome: 'de Mithril' },
  { ate: 29, nome: 'de Obsidiana' },
  { ate: 39, nome: 'do Dragão' },
  { ate: 49, nome: 'de Adamante' },
  { ate: 59, nome: 'do Vazio' },
  { ate: 69, nome: 'de Éter' },
  { ate: 79, nome: 'do Cataclismo' },
  { ate: 89, nome: 'do Eclipse' },
  { ate: 99, nome: 'do Abismo' },
  { ate: Infinity, nome: 'da Eternidade' },
]

const material = (nivel) => MATERIAIS.find((m) => nivel <= m.ate).nome

/** Atributos crus de um item antes da raridade. */
function bonusBase(tipo, nivel) {
  const slot = TIPOS[tipo].slot

  // Armas de especialidade batem um pouco mais forte que as comuns: e
  // parte do premio de ter evoluido, junto com a habilidade.
  if (tipo === 'pistola') return { atq: 4 + nivel * 1.8 }
  if (tipo === 'machado') return { atq: 4 + nivel * 1.75 }
  if (tipo === 'martelo') return { atq: 3 + nivel * 1.5, def: 1 + nivel * 0.4 }
  if (tipo === 'maca') return { atq: 3 + nivel * 1.5, def: 1 + nivel * 0.35 }
  if (tipo === 'flauta') return { atq: 3 + nivel * 1.45, agi: 1 + nivel * 0.4 }
  if (tipo === 'banjo') return { atq: 3 + nivel * 1.5, hp: 3 + nivel * 1.1 }
  // A foice serve a qualquer classe, entao nao pode ser a melhor arma de
  // nenhuma: bate um pouco menos que a arma comum (1.55 contra 1.6 por
  // nivel) e devolve a diferenca em agilidade. Assim ela e sempre uma
  // escolha — nunca a escolha obvia que aposentaria as outras.
  if (tipo === 'foice') return { atq: 3 + nivel * 1.55, agi: 1 + nivel * 0.25 }
  if (slot === 'arma') return { atq: 3 + nivel * 1.6 }

  if (tipo === 'escudo') return { def: 2 + nivel * 1.2, hp: 5 + nivel * 2 }
  if (tipo === 'magia') return { atq: 2 + nivel * 1.3 }
  if (tipo === 'grimorio') return { atq: 1.5 + nivel * 1.0, hp: 4 + nivel * 1.4 }
  if (tipo === 'punhal') return { atq: 1.5 + nivel * 1.0, agi: 1 + nivel * 0.5 }
  if (tipo === 'aljava') return { atq: 2 + nivel * 1.1, hp: 3 + nivel * 1.0 }
  if (tipo === 'manopla') return { def: 1.5 + nivel * 0.9, atq: 1 + nivel * 0.6 }
  if (tipo === 'capa') return { agi: 1.5 + nivel * 0.8, hp: 4 + nivel * 1.6 }
  if (tipo === 'caveira') return { atq: 2 + nivel * 1.2, def: 1 + nivel * 0.4 }
  if (tipo === 'rede') return { agi: 1 + nivel * 0.6, atq: 1.5 + nivel * 0.9 }
  if (tipo === 'totem') return { atq: 1.5 + nivel * 1.0, def: 1 + nivel * 0.5 }
  if (tipo === 'mascara') return { agi: 1.5 + nivel * 0.75, atq: 1 + nivel * 0.75 }

  if (slot === 'elmo') return { def: 1 + nivel * 0.6, hp: 4 + nivel * 1.5 }
  if (slot === 'armadura') return { def: 2 + nivel * 1.1, hp: 8 + nivel * 3 }
  return { agi: 1 + nivel * 0.5, atq: 1 + nivel * 0.4 } // anel
}

export function sortearRaridade(sorte = Math.random) {
  const total = ORDEM_RARIDADE.reduce((soma, r) => soma + RARIDADES[r].peso, 0)
  let ponto = sorte() * total

  for (const id of ORDEM_RARIDADE) {
    ponto -= RARIDADES[id].peso
    if (ponto <= 0) return id
  }
  return 'comum'
}

const novoUid = () => Math.random().toString(36).slice(2, 8)

/** Monta um item de equipamento. */
export function criarItem(tipo, nivel, raridade) {
  const info = TIPOS[tipo]
  const mult = RARIDADES[raridade].mult
  const bonus = {}

  for (const [chave, valor] of Object.entries(bonusBase(tipo, nivel))) {
    bonus[chave] = Math.max(1, Math.round(valor * mult))
  }

  return {
    uid: novoUid(),
    tipo,
    slot: info.slot,
    nome: `${info.nome} ${material(nivel)}`,
    raridade,
    nivel,
    bonus,
  }
}

/**
 * Tipos que caem para qualquer um. Os exclusivos (pistola, machado, caveira...)
 * so aparecem no drop de quem evoluiu para a especialidade que os usa —
 * senao a mochila do grupo inteiro enche de arma que ninguem consegue equipar.
 */
export const TIPOS_COMUNS = Object.keys(TIPOS).filter((t) => !TIPOS[t].exclusivo)

/** Tipos que uma classe consegue usar (para o drop mirar no jogador). */
export function tiposDaClasse(classeId) {
  return Object.keys(TIPOS).filter((t) => classePodeUsar(classeId, t))
}

/**
 * Sorteia um drop. Boa parte vem da classe do jogador, mas de proposito
 * uma fatia vem de outra classe — e o que faz a troca entre jogadores existir.
 */
export function sortearDrop(classeId, nivel, chanceDaPropriaClasse = 0.6, sorte = Math.random) {
  const daClasse = tiposDaClasse(classeId)
  const lista = sorte() < chanceDaPropriaClasse && daClasse.length ? daClasse : TIPOS_COMUNS
  const tipo = lista[Math.floor(sorte() * lista.length)]

  return criarItem(tipo, Math.max(1, nivel), sortearRaridade(sorte))
}

// ------------------------------------------------------- reforco (+1 a +10)

/**
 * Os atributos que o item REALMENTE da, ja contando o reforco do ferreiro.
 *
 * O `bonus` guardado no item continua sendo o de fabrica — o reforco e um
 * multiplicador aplicado na leitura. Assim o mesmo item reforçado por dois
 * caminhos diferentes nunca diverge, e mudar a tabela do ferreiro no config
 * vale para todo mundo na hora, sem migracao.
 */
export function bonusFinal(item) {
  const base = item?.bonus ?? {}
  const reforco = item?.reforco ?? 0
  if (!reforco) return base

  const mult = 1 + reforco * config.rpg.ferreiro.ganhoPorNivel
  const saida = {}
  for (const [chave, valor] of Object.entries(base)) saida[chave] = Math.max(1, Math.round(valor * mult))
  return saida
}

export const ehEquipamento = (item) => Boolean(item?.slot)

/**
 * O nome de um item como aparece em texto: raridade, reforço, feitiço e nível.
 *
 * No bot isso saía com a marcação do WhatsApp (*+3*, _nv60_); na web a
 * marcação aparecia crua no chat e nos avisos, então aqui é texto puro.
 */
export function nomeCompleto(item) {
  if (!ehEquipamento(item)) return `${item.emoji ?? '🧪'} ${item.nome}`

  const reforco = item.reforco ? ` +${item.reforco}` : ''
  const feitico = item.feitico ? ` ${FEITICOS[item.feitico]?.emoji ?? '✴️'}` : ''
  return `${RARIDADES[item.raridade].emoji} ${item.nome}${reforco}${feitico} (nv ${item.nivel})`
}

export function descreverBonus(item) {
  const rotulos = { hp: 'HP', atq: 'ATQ', def: 'DEF', agi: 'AGI' }
  return Object.entries(bonusFinal(item))
    .map(([chave, valor]) => `+${valor} ${rotulos[chave] ?? chave}`)
    .join('  ')
}

/** Quanto o item vale para a loja/referencia de preco. */
export function precoDeReferencia(item) {
  if (!item.bonus) return 50
  const soma = Object.values(bonusFinal(item)).reduce((a, b) => a + b, 0)
  return Math.max(20, Math.round(soma * 4 * RARIDADES[item.raridade].mult))
}
