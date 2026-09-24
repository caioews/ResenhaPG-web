/**
 * Uma luta de grupo resolvida do começo ao fim: time contra chefe, XP, gold,
 * itens e materiais.
 *
 * É o miolo que a raid e os eventos de grupo dividem. Quem chama decide o
 * que é só dele — a raid marca o cooldown e o placar de raids; um evento
 * multiplica a recompensa. O formato da saída é o mesmo nos dois casos, e é
 * por isso que o navegador narra os dois com a mesma função.
 */
import { config } from './config.js'
import * as store from './store.js'
import { lutarEmGrupo } from './rpg/combate.js'
import { comoLutador } from './rpg/encontro.js'
import { atributos, darGold, ganharXp, guardarLoot } from './rpg/jogador.js'
import { droparMateriais, droparRecompensas } from './rpg/raid.js'
import { xpComPrestigio } from './rpg/prestigio.js'
import { FEITICOS } from './rpg/feiticos.js'
import { TITANITAS } from './rpg/ferreiro.js'
import { verItem, verResumo } from './visao.js'

export const nivelMedioDe = (participantes) =>
  Math.max(1, Math.round(participantes.reduce((s, p) => s + p.rpg.nivel, 0) / participantes.length))

/**
 * @param participantes  personagens (objetos do store), já validados
 * @param chefe          o inimigo pronto, no formato de criarChefeDeRaid
 * @param opcoes.recompensa  multiplicadores { xp, gold, itens } sobre a conta da raid
 * @param opcoes.materiais   se cai titanita e feitiço na vitória
 */
export function resolverLutaDeGrupo(
  participantes,
  chefe,
  { recompensa = {}, materiais = true } = {},
) {
  const media = nivelMedioDe(participantes)
  const mult = { xp: 1, gold: 1, itens: 1, ...recompensa }

  // Todo mundo entra inteiro: é um combate marcado, não uma emboscada.
  const time = participantes.map((p) => {
    const lutador = comoLutador(p, p.name)
    lutador.hp = atributos(p).hp
    return lutador
  })

  const resultado = lutarEmGrupo(time, chefe)

  const cabecalho = {
    chefe: {
      nome: chefe.nome,
      emoji: chefe.emoji,
      nivel: chefe.nivel,
      hpMax: chefe.hp,
      duro: Boolean(chefe.duro),
      areaCada: chefe.areaCada,
    },
    nivelMedio: media,
    participantes: participantes.map(verResumo),
    rodadas: resultado.rodadas,
    log: resultado.log,
    venceu: resultado.venceu,
  }

  if (!resultado.venceu) {
    store.flush()

    return {
      ...cabecalho,
      hpRestanteDoChefe: Math.round((resultado.chefe.hp / resultado.chefe.hpMax) * 100),
      porJogador: [],
      itens: [],
      materiais: [],
    }
  }

  // Vitória: XP e gold para todos, e quem caiu leva 60%.
  const { xpBase, xpPorNivel, goldBase, goldPorNivel } = config.rpg.raid
  const xpCheio = Math.round((xpBase + media * xpPorNivel) * mult.xp)
  const goldCheio = Math.round((goldBase + media * goldPorNivel) * mult.gold)

  const porJogador = participantes.map((p, i) => {
    const estado = resultado.time[i]
    const caiu = estado?.caido ?? false
    const fracao = caiu ? 0.6 : 1
    // O prestigio e de cada um, entao o XP e calculado jogador a jogador.
    const xp = xpComPrestigio(p, Math.round(xpCheio * fracao))
    const gold = Math.round(goldCheio * fracao)

    darGold(p, gold)
    const subiu = ganharXp(p, xp)

    return {
      personagem: verResumo(p),
      caiu,
      xp,
      gold,
      subiu,
      hp: estado?.hp ?? 0,
      hpMax: estado?.hpMax ?? 1,
    }
  })

  // `droparMateriais` e `droparRecompensas` esperam { player } em cada
  // participante — é assim que o motor do bot os recebe.
  const embrulho = participantes.map((p) => ({ id: p.id, player: p }))

  const listaDeMateriais = materiais
    ? droparMateriais(embrulho, media).map((m) => ({
        personagem: verResumo(m.dono.player),
        titanita: m.titanita
          ? { ...m.titanita, nome: TITANITAS[m.titanita.grau].nome, emoji: TITANITAS[m.titanita.grau].emoji }
          : null,
        feitico: m.feitico ? { id: m.feitico, nome: FEITICOS[m.feitico].nome, emoji: FEITICOS[m.feitico].emoji } : null,
      }))
    : []

  // O multiplicador mexe na QUANTIDADE de itens, nunca na peça: menos que a
  // raid corta a lista, mais que ela sorteia de novo. Piso de um.
  const drops = droparRecompensas(embrulho)
  const quantos = Math.max(1, Math.round(drops.length * mult.itens))
  while (drops.length < quantos) drops.push(...droparRecompensas(embrulho))

  const itens = drops.slice(0, quantos).map(({ dono, item }) => {
    const loot = guardarLoot(dono.player, item)
    return {
      personagem: verResumo(dono.player),
      item: verItem(item),
      perdido: !loot.vendido && !loot.coube,
      vendido: loot.vendido,
      gold: loot.gold,
    }
  })

  store.flush()

  return { ...cabecalho, porJogador, itens, materiais: listaDeMateriais }
}
