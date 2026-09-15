/**
 * Feiticos de infusao: o que o feiticeiro grava na arma ou no item secundario.
 *
 * Cada feitico e so um punhado de efeitos, do mesmo vocabulario que as
 * habilidades de especialidade usam (ver habilidades.js) — o motor de
 * combate nao precisa saber de onde o efeito veio. Isso deixa a infusao
 * combinar com a habilidade da classe em vez de competir com ela: um
 * Pistoleiro com arma de Relampago perfura mais ainda; um Espadachim com
 * arma de Vento encaixa o segundo golpe com mais frequencia.
 *
 * Cada peca carrega um feitico por vez. Gravar outro apaga o anterior. Os
 * feiticos da arma e do secundario equipados valem juntos — mas o MESMO
 * feitico nas duas pecas conta uma vez so: dois Relampagos ignorariam 44% da
 * defesa, e a graca de ter duas pecas e combinar feiticos diferentes.
 *
 * `peso` e a chance relativa de o feitico cair; `nivelMinimo` e o nivel de
 * chefe/andar a partir do qual ele comeca a aparecer. Os mais fortes so
 * saem no fundo do Abismo.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { juntarEfeitos } from './habilidades.js'

export { juntarEfeitos }

export const FEITICOS = {
  chama: {
    id: 'chama',
    nome: 'Chama',
    emoji: '🔥',
    resumo: '+12% de dano em todo golpe.',
    efeitos: { danoExtra: 0.12 },
    peso: 22,
    nivelMinimo: 1,
  },
  gelo: {
    id: 'gelo',
    nome: 'Gelo',
    emoji: '❄️',
    resumo: '8% de chance de congelar o alvo e fazê-lo perder a vez.',
    efeitos: { prender: 0.08 },
    peso: 18,
    nivelMinimo: 1,
  },
  relampago: {
    id: 'relampago',
    nome: 'Relâmpago',
    emoji: '⚡',
    resumo: 'Ignora 22% da defesa do alvo.',
    efeitos: { perfuracao: 0.22 },
    peso: 18,
    nivelMinimo: 1,
  },
  sangue: {
    id: 'sangue',
    nome: 'Sangue',
    emoji: '🩸',
    resumo: 'Recupera 10% do dano causado.',
    efeitos: { vampirismo: 0.1 },
    peso: 15,
    nivelMinimo: 20,
  },
  vento: {
    id: 'vento',
    nome: 'Vento',
    emoji: '🌪️',
    resumo: '15% de chance de um segundo golpe no mesmo turno.',
    efeitos: { golpeDuplo: 0.15 },
    peso: 12,
    nivelMinimo: 30,
  },
  luz: {
    id: 'luz',
    nome: 'Luz',
    emoji: '✨',
    resumo: 'Leva 8% menos dano.',
    efeitos: { reducaoDeDano: 0.08 },
    peso: 10,
    nivelMinimo: 30,
  },
  escuridao: {
    id: 'escuridao',
    nome: 'Escuridão',
    emoji: '🌑',
    resumo: 'Cada acerto tira 5% da defesa do alvo, até −35%.',
    efeitos: { maldicao: { porAcerto: 0.05, teto: 0.35 } },
    peso: 7,
    nivelMinimo: 45,
  },
  caos: {
    id: 'caos',
    nome: 'Caos',
    emoji: '🌀',
    resumo: '7% de chance de um golpe devastador, ignorando parte da defesa.',
    efeitos: { execucao: { chance: 0.07, mult: 2.5, perfuracao: 0.3 } },
    peso: 4,
    nivelMinimo: 60,
  },
}

export const NOMES_DE_FEITICO = Object.keys(FEITICOS)

export const feitico = (id) => FEITICOS[id] ?? null

export function descreverFeitico(id) {
  const f = feitico(id)
  return f ? `${f.emoji} *${f.nome}* — ${f.resumo}` : ''
}

/** Aceita id, nome e nome sem acento: "escuridao" acha "Escuridão". */
export function acharFeitico(busca) {
  const limpo = (t) =>
    String(t ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const texto = limpo(busca)
  if (!texto) return null

  return (
    NOMES_DE_FEITICO.find((id) => limpo(id) === texto) ??
    NOMES_DE_FEITICO.find((id) => limpo(FEITICOS[id].nome) === texto) ??
    (texto.length >= 3 ? NOMES_DE_FEITICO.find((id) => limpo(id).startsWith(texto)) : null) ??
    null
  )
}

/** Os feiticos que podem cair num encontro daquele nivel. */
export const feiticosAte = (nivel) => NOMES_DE_FEITICO.filter((id) => nivel >= FEITICOS[id].nivelMinimo)

/** Sorteia um feitico para um drop de nivel N. null se nenhum liberado. */
export function sortearFeitico(nivel, sorte = Math.random) {
  const pool = feiticosAte(nivel)
  if (!pool.length) return null

  const total = pool.reduce((s, id) => s + FEITICOS[id].peso, 0)
  let ponto = sorte() * total

  for (const id of pool) {
    ponto -= FEITICOS[id].peso
    if (ponto <= 0) return id
  }
  return pool[0]
}

// ------------------------------------------------------------- estoque

export const feiticosDe = (player) => player.rpg.feiticos ?? {}

export const quantosFeiticos = (player, id) => feiticosDe(player)[id] ?? 0

export function darFeitico(player, id, quantidade = 1) {
  if (!FEITICOS[id]) return 0
  player.rpg.feiticos[id] = Math.max(0, (player.rpg.feiticos[id] ?? 0) + quantidade)
  store.save()
  return player.rpg.feiticos[id]
}

export const totalDeFeiticos = (player) =>
  Object.values(feiticosDe(player)).reduce((a, b) => a + b, 0)

// ------------------------------------------------------------- infusao

/** Os slots que aceitam feitico. */
export const SLOTS_COM_FEITICO = ['arma', 'secundario']

/** Quanto custa gravar um feitico nesta peca. Regravar custa mais. */
export function custoDaInfusao(item) {
  const f = config.rpg.feiticeiro
  const base = f.goldPorNivel * item.nivel
  return Math.round(item.feitico ? base * f.multiplicadorDeRegravar : base)
}

/** Por que esta peca nao pode receber este feitico. null = pode. */
export function motivoParaNaoInfundir(player, item, id) {
  if (!SLOTS_COM_FEITICO.includes(item?.slot)) return { erro: 'naoAceitaFeitico' }
  if (!FEITICOS[id]) return { erro: 'feiticoInexistente' }
  if (item.feitico === id) return { erro: 'jaTemEsse' }
  if (quantosFeiticos(player, id) < 1) return { erro: 'semFeitico' }

  const gold = custoDaInfusao(item)
  if (player.rpg.gold < gold) return { erro: 'semGold', gold }

  return null
}

/**
 * Grava o feitico na peca. Consome um feitico do estoque e o gold; o
 * feitico que estava gravado antes se perde — e por isso que regravar
 * custa mais caro.
 */
export function infundir(player, item, id) {
  const gold = custoDaInfusao(item)
  const anterior = item.feitico ?? null

  player.rpg.gold -= gold
  player.rpg.feiticos[id] -= 1
  item.feitico = id
  store.save()

  return { gold, anterior, atual: id }
}

/** Os efeitos que o feitico de uma peca entrega. Vazio se nao houver. */
export const efeitosDoFeitico = (item) => (item?.feitico ? (FEITICOS[item.feitico]?.efeitos ?? {}) : {})

/**
 * Os efeitos somados dos feiticos de varias pecas equipadas. Feitico repetido
 * entra uma vez so (ver o comentario do topo).
 */
export function efeitosDosFeiticos(itens) {
  const vistos = new Set()
  let efeitos = {}
  for (const item of itens) {
    if (!item?.feitico || vistos.has(item.feitico)) continue
    vistos.add(item.feitico)
    efeitos = juntarEfeitos(efeitos, efeitosDoFeitico(item))
  }
  return efeitos
}
