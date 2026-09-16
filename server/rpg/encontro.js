/**
 * Junta tudo que acontece numa luta contra um monstro: combate, vida,
 * recompensa, drop e a punicao da derrota. Os comandos so formatam o que
 * sai daqui.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { classe } from './classes.js'
import { barraDeVida, lutar, resumir } from './combate.js'
import { darTitanita, sortearTitanita } from './ferreiro.js'
import { SLOTS_COM_FEITICO, darFeitico, efeitosDosFeiticos, juntarEfeitos, sortearFeitico } from './feiticos.js'
import { efeitosDaClasse } from './habilidades.js'
import { sortearDrop } from './itens.js'
import { recompensas } from './monstros.js'
import { xpComPrestigio } from './prestigio.js'
import {
  atributos,
  darGold,
  definirVida,
  itemEquipado,
  ferir,
  ganharXp,
  guardarItem,
  levantarDaFogueira,
  mochilaCheia,
  vencerBoss,
  vidaAtual,
} from './jogador.js'

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
 * O jogador como combatente: atributos totais, entrando com a vida atual e
 * carregando habilidades de classe e feiticos das pecas.
 */
export function comoLutador(player, nome = 'Você') {
  const total = atributos(player)
  return {
    nome,
    nivel: player.rpg.nivel,
    atq: total.atq,
    def: total.def,
    agi: total.agi,
    hp: vidaAtual(player),
    hpMax: total.hp,
    hab: efeitosDe(player),
  }
}

/**
 * Resolve um encontro completo.
 * Nao formata mensagem: devolve os dados para o comando montar o texto.
 */
export function resolver(player, monstro, sorte = Math.random) {
  levantarDaFogueira(player) // ninguem luta sentado
  const eu = comoLutador(player)
  const inimigo = {
    nome: `${monstro.emoji} ${monstro.nome}`,
    nivel: monstro.nivel,
    atq: monstro.atq,
    def: monstro.def,
    agi: monstro.agi,
    hp: monstro.hp,
  }

  const luta = lutar(eu, inimigo, sorte)
  const venceu = luta.vencedor === 'a'

  const saida = {
    venceu,
    luta,
    linhas: resumir(luta),
    barra: barraDeVida(venceu ? luta.hpA : 0, luta.hpMaxA),
    hpFinal: luta.hpA,
    hpMax: luta.hpMaxA,
    xp: 0,
    gold: 0,
    drop: null,
    mochilaCheia: false,
    subiuPara: [],
    bossVencido: false,
    goldPerdido: 0,
    goldDeSaque: 0,
    titanita: null,
    feitico: null,
  }

  player.rpg.ultimaLuta = Date.now()

  if (!venceu) {
    player.rpg.derrotas++
    saida.goldPerdido = Math.floor(player.rpg.gold * config.rpg.goldPerdidoAoPerder)
    darGold(player, -saida.goldPerdido)
    ferir(player)
    store.save()
    return saida
  }

  player.rpg.vitorias++
  definirVida(player, luta.hpA)

  const premio = recompensas(monstro, sorte)
  const hab = efeitosDe(player)

  // O prestigio soma no XP antes de qualquer coisa: o numero que entra na
  // ficha e o mesmo que a tela mostra.
  saida.xp = xpComPrestigio(player, premio.xp)
  saida.gold = Math.round(premio.gold * (1 + (hab.saqueGold ?? 0)))
  saida.goldDeSaque = saida.gold - premio.gold

  darGold(player, saida.gold)

  if (monstro.boss) {
    vencerBoss(player, monstro.marco ?? monstro.nivel)
    saida.bossVencido = true
  }

  saida.subiuPara = ganharXp(player, saida.xp)

  // Titanita: cai de bicho comum, de elite e sempre de chefe.
  const origem = monstro.boss ? 'boss' : monstro.elite ? 'elite' : 'comum'
  const titanita = sortearTitanita(origem, sorte)
  if (titanita) {
    darTitanita(player, titanita.grau, titanita.quantidade)
    saida.titanita = titanita
  }

  // Feitico: so de chefe, e so os liberados para aquele nivel.
  if (monstro.boss && sorte() < config.rpg.feiticeiro.chanceDrop.boss) {
    const id = sortearFeitico(monstro.nivel, sorte)
    if (id) {
      darFeitico(player, id)
      saida.feitico = id
    }
  }

  if (sorte() < premio.chanceDrop + (hab.saqueDrop ?? 0)) {
    const item = sortearDrop(player.rpg.classe, monstro.nivel, config.rpg.chanceDropDaPropriaClasse, sorte)
    if (mochilaCheia(player)) {
      saida.mochilaCheia = true
      saida.drop = item
    } else {
      guardarItem(player, item)
      saida.drop = item
    }
  }

  store.save()
  return saida
}
