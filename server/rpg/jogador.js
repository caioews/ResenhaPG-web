/** O personagem do jogador: nivel, XP de combate, vida, gold e mochila. */
import { config } from '../config.js'
import * as store from '../store.js'
import { atributosBase, classePodeUsar } from './classes.js'
import { SLOTS, TIPOS, bonusFinal } from './itens.js'
import { ehNivelDeBoss, proximoBoss } from './monstros.js'

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
 * A vida regenera sozinha com o tempo, entao nao precisa de comando para
 * descansar: o valor guardado e recalculado toda vez que alguem olha.
 */
/** A regeneracao passiva: 5% do maximo por minuto desde que a vida foi gravada. */
function regeneracaoPassiva(ficha, maximo) {
  const minutos = (Date.now() - (ficha.hpEm || Date.now())) / 60_000
  return ficha.hp + maximo * (config.rpg.regenPorMinuto * minutos)
}

export function vidaAtual(player) {
  const maximo = atributos(player).hp
  const ficha = player.rpg

  if (ficha.hp === null || ficha.hp === undefined) return maximo

  // Descanso na fogueira: a vida sobe em RAMPA, do que havia quando o fogo
  // foi aceso ate o maximo no instante em que o descanso termina. E uma
  // divergencia deliberada do bot, onde a vida saltava de uma vez no fim.
  //
  // Continua sem temporizador: o que existe e o par (hp, hpEm) gravado no
  // acender e o horario de termino. A conta e feita na leitura, entao o
  // servidor pode cair e voltar no meio do descanso sem perder nada.
  if (ficha.fogueiraAte) {
    if (Date.now() >= ficha.fogueiraAte) return maximo

    const inicio = ficha.hpEm || ficha.fogueiraAte
    const duracao = ficha.fogueiraAte - inicio

    if (duracao > 0) {
      const andado = Math.min(1, Math.max(0, (Date.now() - inicio) / duracao))
      const naFogueira = ficha.hp + (maximo - ficha.hp) * andado

      // Fica a maior das duas contas. Garante que sentar na fogueira nunca
      // renda menos que ficar de pe — o que aconteceria se alguem
      // configurasse um descanso muito longo.
      const melhor = Math.max(naFogueira, regeneracaoPassiva(ficha, maximo))
      return Math.max(0, Math.min(maximo, Math.round(melhor)))
    }
  }

  return Math.max(0, Math.min(maximo, Math.round(regeneracaoPassiva(ficha, maximo))))
}

export function definirVida(player, valor) {
  player.rpg.hp = Math.max(0, Math.round(valor))
  player.rpg.hpEm = Date.now()
  store.save()
}

export const feridoRestante = (player) => Math.max(0, (player.rpg.feridoAte ?? 0) - Date.now())

/** Quanto falta do descanso na fogueira. 0 = nao esta descansando. */
export const descansoRestante = (player) => Math.max(0, (player.rpg.fogueiraAte ?? 0) - Date.now())

/** Senta na fogueira. Devolve o horario em que o descanso termina. */
export function acenderFogueira(player, minutos = config.rpg.fogueiraMinutos) {
  // Grava a vida no instante em que o fogo e aceso: e desse ponto que a
  // rampa de vidaAtual() parte, e e por isso que gravar vem primeiro.
  definirVida(player, vidaAtual(player))
  player.rpg.fogueiraAte = Date.now() + minutos * 60_000
  store.save()
  return player.rpg.fogueiraAte
}

/**
 * Levanta da fogueira, congelando o que ela deu ate aqui.
 *
 * Levantar antes da hora nao perde o que a rampa ja tinha subido — so para
 * de subir. Gravar antes de zerar `fogueiraAte` importa: e vidaAtual() que
 * sabe calcular a rampa, e ela depende desse campo.
 */
export function levantarDaFogueira(player) {
  const terminou = Boolean(player.rpg.fogueiraAte) && Date.now() >= player.rpg.fogueiraAte

  if (player.rpg.fogueiraAte) definirVida(player, vidaAtual(player))

  player.rpg.fogueiraAte = 0
  store.save()
  return terminou
}

export function ferir(player) {
  player.rpg.feridoAte = Date.now() + config.rpg.feridoMinutos * 60_000
  definirVida(player, 1)
}

export function curar(player, fracao) {
  const maximo = atributos(player).hp
  const antes = vidaAtual(player)
  definirVida(player, Math.min(maximo, antes + maximo * fracao))
  return vidaAtual(player) - antes
}

// ------------------------------------------------------------------ nivel

/**
 * Soma XP de combate. O nivel trava nos marcos de boss ate o jogador
 * derrotar o chefe daquele marco — o XP continua entrando, so nao sobe.
 */
export function ganharXp(player, quanto) {
  const ficha = player.rpg
  ficha.xp += quanto

  const subiu = []
  while (ficha.xp >= xpParaSubir(ficha.nivel)) {
    if (bloqueadoPorBoss(player)) break
    ficha.xp -= xpParaSubir(ficha.nivel)
    ficha.nivel++
    subiu.push(ficha.nivel)

    if (ehNivelDeBoss(ficha.nivel) && !ficha.bossesVencidos.includes(ficha.nivel)) {
      ficha.bossPendente = ficha.nivel
      break
    }
  }

  store.save()
  return subiu
}

export const bloqueadoPorBoss = (player) => Boolean(player.rpg.bossPendente)

export function vencerBoss(player, nivelMarco) {
  const ficha = player.rpg
  if (!ficha.bossesVencidos.includes(nivelMarco)) ficha.bossesVencidos.push(nivelMarco)
  ficha.bossPendente = 0
  store.save()
}

export const proximoMarco = (player) => proximoBoss(player.rpg.nivel)

// -------------------------------------------------------------- inventario

export const inventario = (player) => player.rpg.inventario

export const mochilaCheia = (player) => player.rpg.inventario.length >= config.rpg.tamanhoMochila

export function guardarItem(player, item) {
  if (mochilaCheia(player)) return false
  player.rpg.inventario.push(item)
  store.save()
  return true
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

/** Minusculo e sem acento, para "pocao" achar "Poção". */
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
