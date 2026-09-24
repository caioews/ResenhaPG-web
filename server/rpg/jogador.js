/** O personagem do jogador: nivel, XP de combate, vida, gold e mochila. */
import { config } from '../config.js'
import * as store from '../store.js'
import { atributosBase, classePodeUsar } from './classes.js'
import { SLOTS, TIPOS, bonusFinal } from './itens.js'
import { precoDeCompra, vendeAutomatico } from './loja.js'

/** XP de combate para sair de um nivel para o proximo. */
export const xpParaSubir = (nivel) => Math.round(55 * Math.pow(nivel, 1.15))

export const ficha = (player) => player.rpg

export const temClasse = (player) => Boolean(player.rpg.classe)

/** Soma dos bonus de tudo que esta equipado. */
export function bonusDoEquipamento(player) {
  const soma = { hp: 0, atq: 0, def: 0, agi: 0 }

  for (const slot of SLOTS) {
    const item = itemEquipado(player, slot)
    if (!item) continue
    // bonusFinal, nao item.bonus: e aqui que o reforco do ferreiro entra.
    for (const [chave, valor] of Object.entries(bonusFinal(item))) {
      soma[chave] = (soma[chave] ?? 0) + valor
    }
  }

  return soma
}

/**
 * O que o prestigio multiplica nos atributos de classe.
 *
 * A conta fica aqui, e nao em atributosBase (classes.js), por dois motivos:
 * atributosBase e a tabela da especificacao e nao deve mudar, e o bonus vale
 * so para o que a CLASSE da — equipamento continua valendo o que vale, senao
 * quem prestigia com equipamento de fim de jogo viraria intocavel.
 */
const escalaDePrestigio = (player) =>
  1 + Math.max(0, player.rpg.prestigio ?? 0) * config.rpg.prestigio.bonusAtributos

/** Atributos finais: classe + nivel + prestigio + equipamento. */
export function atributos(player) {
  const base = atributosBase(player.rpg.classe, player.rpg.nivel)
  const extra = bonusDoEquipamento(player)
  const escala = escalaDePrestigio(player)

  return {
    hp: Math.round(base.hp * escala) + extra.hp,
    atq: Math.round(base.atq * escala) + extra.atq,
    def: Math.round(base.def * escala) + extra.def,
    agi: Math.round(base.agi * escala) + extra.agi,
  }
}

/** Os atributos que a classe da agora, ja com o prestigio — para a ficha. */
export function atributosDaClasse(player) {
  const base = atributosBase(player.rpg.classe, player.rpg.nivel)
  const escala = escalaDePrestigio(player)
  return {
    hp: Math.round(base.hp * escala),
    atq: Math.round(base.atq * escala),
    def: Math.round(base.def * escala),
    agi: Math.round(base.agi * escala),
  }
}

// ------------------------------------------------------------------ vida

/**
 * A vida fora de combate e SEMPRE cheia.
 *
 * Isso e consequencia direta da rota (rpg/rota.js): a fase e que e a prova,
 * e ela comeca do zero toda vez. Vencer uma fase leva a proxima com a vida
 * inteira; perder devolve o personagem a fase anterior, tambem inteiro. Raid,
 * Abismo, masmorra, evento e duelo entram cheios pelo mesmo motivo.
 *
 * Por isso nao ha mais regeneracao com relogio, fogueira, pocao, bandagem
 * nem estado ferido: eles existiam para administrar a vida ENTRE duas
 * lutas, e entre duas lutas agora nao ha o que administrar. A vida continua
 * importando muito — so que dentro da fase, onde o desgaste de um inimigo
 * para o outro e o que decide se a horda cai ou nao.
 */
export const vidaAtual = (player) => atributos(player).hp

// ------------------------------------------------------------------ nivel

/** Soma XP de combate e devolve os niveis que subiu. */
export function ganharXp(player, quanto) {
  const ficha = player.rpg
  ficha.xp += quanto

  const subiu = []
  while (ficha.xp >= xpParaSubir(ficha.nivel)) {
    ficha.xp -= xpParaSubir(ficha.nivel)
    ficha.nivel++
    subiu.push(ficha.nivel)
  }

  store.save()
  return subiu
}

// -------------------------------------------------------------- inventario

export const inventario = (player) => player.rpg.inventario

export const mochilaCheia = (player) => player.rpg.inventario.length >= config.rpg.tamanhoMochila

export function guardarItem(player, item) {
  if (mochilaCheia(player)) return false
  player.rpg.inventario.push(item)
  store.save()
  return true
}

/**
 * Um item de LOOT — o que cai de um inimigo, nunca o que se compra, se
 * retira do baú ou se recebe numa troca. Se a raridade dele está marcada
 * para venda automática (rpg/loja.js), vira gold na hora, pelo preço que a
 * loja pagaria, em vez de ocupar espaço na mochila.
 *
 * Devolve o que aconteceu, para a tela poder contar a história: `vendido`
 * (com o `gold` que entrou) ou `coube` (guardou, ou não — mochila cheia).
 */
export function guardarLoot(player, item) {
  if (vendeAutomatico(player, item)) {
    const gold = precoDeCompra(item)
    darGold(player, gold)
    return { vendido: true, gold, coube: false }
  }
  return { vendido: false, gold: 0, coube: guardarItem(player, item) }
}

export function removerItem(player, uid) {
  const i = player.rpg.inventario.findIndex((it) => it.uid === uid)
  if (i < 0) return null

  const [item] = player.rpg.inventario.splice(i, 1)
  for (const slot of SLOTS) {
    if (player.rpg.equipado[slot] === uid) player.rpg.equipado[slot] = null
  }

  store.save()
  return item
}

export function itemEquipado(player, slot) {
  const uid = player.rpg.equipado[slot]
  return uid ? player.rpg.inventario.find((it) => it.uid === uid) ?? null : null
}

export const estaEquipado = (player, uid) => Object.values(player.rpg.equipado).includes(uid)

/** Minusculo e sem acento, para "cajado" achar "Cajado de Prata". */
const semAcento = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/**
 * Todos os itens da mochila que batem com a busca por nome.
 * Serve para o comando avisar quando a busca esta ambigua em vez de
 * escolher sozinho — vender o item errado nao tem desfazer.
 */
export function acharTodosOsItens(player, busca) {
  const texto = semAcento(busca).replace(/^#/, '')
  if (!texto || /^d+$/.test(texto)) return []

  const mochila = player.rpg.inventario
  const exatos = mochila.filter((it) => semAcento(it.nome) === texto)
  if (exatos.length) return exatos

  return mochila.filter((it) => semAcento(it.nome).includes(texto))
}

/** Acha um item na mochila por posicao (#3), codigo ou nome. */
export function acharItem(player, busca) {
  const mochila = player.rpg.inventario
  if (!mochila.length || !busca) return null

  const texto = semAcento(busca).replace(/^#/, '')

  if (/^\d+$/.test(texto)) {
    const index = Number(texto) - 1
    return mochila[index] ?? null
  }

  const porUid = mochila.find((it) => it.uid === texto)
  if (porUid) return porUid

  const exato = mochila.find((it) => semAcento(it.nome) === texto)
  if (exato) return exato

  return mochila.find((it) => semAcento(it.nome).includes(texto)) ?? null
}

/** Equipa um item, devolvendo o que saiu do slot. */
export function equipar(player, item) {
  if (!item.slot) return { erro: 'Esse item não é equipamento.' }
  if (!classePodeUsar(player.rpg.classe, item.tipo)) {
    return { erro: `Sua classe não sabe usar ${TIPOS[item.tipo].nome.toLowerCase()}.` }
  }
  if (item.nivel > player.rpg.nivel) {
    return { erro: `Precisa ser nível *${item.nivel}* para equipar (você é ${player.rpg.nivel}).` }
  }

  const anterior = itemEquipado(player, item.slot)
  player.rpg.equipado[item.slot] = item.uid
  store.save()

  return { anterior }
}

export function desequipar(player, slot) {
  const item = itemEquipado(player, slot)
  if (!item) return null
  player.rpg.equipado[slot] = null
  store.save()
  return item
}

/** Tira de uso tudo que a classe atual nao sabe usar (apos mudar de classe). */
export function desequiparIncompativeis(player) {
  const tirados = []

  for (const slot of SLOTS) {
    const item = itemEquipado(player, slot)
    if (item && !classePodeUsar(player.rpg.classe, item.tipo)) {
      player.rpg.equipado[slot] = null
      tirados.push(item)
    }
  }

  if (tirados.length) store.save()
  return tirados
}

// ------------------------------------------------------------------- gold

export function darGold(player, quanto) {
  player.rpg.gold = Math.max(0, player.rpg.gold + Math.round(quanto))
  store.save()
  return player.rpg.gold
}
