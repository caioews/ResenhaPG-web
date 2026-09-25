/**
 * O que um lutador leva para a briga, e o que ele tira de um inimigo caido.
 *
 * E a camada compartilhada entre a caçada (rpg/cacada.js), o Abismo, a
 * masmorra e os eventos: todo mundo monta o jogador do mesmo jeito e paga a
 * vitoria do mesmo jeito. Nada aqui formata mensagem e nada aqui decide
 * quando a luta acontece — so devolve dados.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { classe } from './classes.js'
import { lutar } from './combate.js'
import { darTitanita, sortearTitanita } from './ferreiro.js'
import { SLOTS_COM_FEITICO, darFeitico, efeitosDosFeiticos, juntarEfeitos, sortearFeitico } from './feiticos.js'
import { efeitosDaClasse } from './habilidades.js'
import { sortearDrop } from './itens.js'
import { recompensas } from './monstros.js'
import { xpComPrestigio } from './prestigio.js'
import { atributos, darGold, itemEquipado, ganharXp, guardarLoot } from './jogador.js'

/**
 * Tudo que o jogador leva para a luta alem dos atributos: as habilidades da
 * classe mais os feiticos gravados na arma e no secundario equipados.
 *
 * Todos usam o mesmo vocabulario de efeitos, entao combinam em vez de
 * competir — um Pistoleiro com arma de Relampago perfura mais ainda.
 */
export function efeitosDe(player) {
  const daClasse = efeitosDaClasse(classe(player.rpg.classe))
  const dosFeiticos = efeitosDosFeiticos(SLOTS_COM_FEITICO.map((slot) => itemEquipado(player, slot)))
  return juntarEfeitos(daClasse, dosFeiticos)
}

/**
 * O jogador como combatente. `hp` e a vida com que ele ENTRA: cheia por
 * padrao, e o que sobrou do inimigo anterior quando a horda de uma fase
 * encadeia uma luta na outra.
 */
export function comoLutador(player, nome = 'Você', hp = null) {
  const total = atributos(player)
  return {
    nome,
    nivel: player.rpg.nivel,
    atq: total.atq,
    def: total.def,
    agi: total.agi,
    hp: hp === null ? total.hp : Math.max(1, Math.round(hp)),
    hpMax: total.hp,
    hab: efeitosDe(player),
  }
}

/**
 * O inimigo no formato que o motor de combate espera. `hab` so existe nos
 * chefes (a habilidade especial deles); o resto luta sem ela.
 */
export const comoInimigo = (monstro) => ({
  nome: `${monstro.emoji} ${monstro.nome}`,
  nivel: monstro.nivel,
  atq: monstro.atq,
  def: monstro.def,
  agi: monstro.agi,
  hp: monstro.hp,
  ...(monstro.hab ? { hab: monstro.hab } : {}),
})

/**
 * O que cai de um inimigo derrotado: XP, gold, titanita, feitico e item.
 *
 * Ja aplica tudo na ficha — o retorno e so o relatorio para a tela. `forca`
 * e a rampa da fase (rpg/rota.js): o que endurece tambem paga melhor.
 */
export function premiar(player, monstro, { sorte = Math.random, forca = 1 } = {}) {
  const premio = recompensas(monstro, sorte, forca)
  const hab = efeitosDe(player)

  // O prestigio soma no XP antes de qualquer coisa: o numero que entra na
  // ficha e o mesmo que a tela mostra.
  const xp = xpComPrestigio(player, premio.xp)
  const gold = Math.round(premio.gold * (1 + (hab.saqueGold ?? 0)))

  const ganhos = {
    xp,
    gold,
    goldDeSaque: gold - premio.gold,
    goldDaVenda: 0,
    subiuPara: [],
    drop: null,
    mochilaCheia: false,
    vendidoAutomaticamente: false,
    titanita: null,
    feitico: null,
  }

  darGold(player, gold)
  ganhos.subiuPara = ganharXp(player, xp)

  // Titanita: cai de bicho comum, de elite e sempre de chefe.
  const origem = monstro.boss ? 'boss' : monstro.elite ? 'elite' : 'comum'
  const titanita = sortearTitanita(origem, sorte)
  if (titanita) {
    darTitanita(player, titanita.grau, titanita.quantidade)
    ganhos.titanita = titanita
  }

  // Feitico: so de chefe, e so os liberados para aquele nivel.
  if (monstro.boss && sorte() < config.rpg.feiticeiro.chanceDrop.boss) {
    const id = sortearFeitico(monstro.nivel, sorte)
    if (id) {
      darFeitico(player, id)
      ganhos.feitico = id
    }
  }

  if (sorte() < premio.chanceDrop + (hab.saqueDrop ?? 0)) {
    const item = sortearDrop(player.rpg.classe, monstro.nivel, config.rpg.chanceDropDaPropriaClasse, sorte)
    ganhos.drop = item

    const loot = guardarLoot(player, item)
    if (loot.vendido) {
      ganhos.vendidoAutomaticamente = true
      ganhos.goldDaVenda = loot.gold
      ganhos.gold += loot.gold
      // Mochila cheia nao segura a caçada: o item aparece no relatorio como
      // perdido, e quem esta no laco automatico ve o aviso e vai esvaziar.
    } else if (!loot.coube) {
      ganhos.mochilaCheia = true
    }
  }

  store.save()
  return ganhos
}

/**
 * Uma luta solta, do comeco ao fim: a caçada nao passa por aqui (ela
 * encadeia uma horda inteira, em rpg/cacada.js), mas o evento individual da
 * Fenda sim. Entra com a vida cheia, como tudo fora da rota.
 */
export function resolver(player, monstro, sorte = Math.random) {
  const luta = lutar(comoLutador(player), comoInimigo(monstro), sorte)
  const venceu = luta.vencedor === 'a'

  const saida = {
    venceu,
    luta,
    hpFinal: luta.hpA,
    hpMax: luta.hpMaxA,
    xp: 0,
    gold: 0,
    goldDeSaque: 0,
    goldDaVenda: 0,
    subiuPara: [],
    drop: null,
    mochilaCheia: false,
    vendidoAutomaticamente: false,
    titanita: null,
    feitico: null,
  }

  if (!venceu) {
    player.rpg.derrotas++
    store.save()
    return saida
  }

  player.rpg.vitorias++
  return Object.assign(saida, premiar(player, monstro, { sorte }))
}
