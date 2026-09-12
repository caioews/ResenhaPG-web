/**
 * A ficha do personagem como o navegador a enxerga.
 *
 * Regra de ouro: o cliente nunca recalcula nada que decida alguma coisa. Os
 * atributos, a vida, os cooldowns e os precos saem prontos daqui. O front
 * so desenha — se ele calculasse gold ou dano, viraria formulario de fraude.
 */
import { config } from './config.js'
import { CLASSES, classe, especialidadesDe, linhagemDe, nivelDoProximoDegrau } from './rpg/classes.js'
import { HABILIDADES, efeitosDaClasse, habilidadesDaClasse } from './rpg/habilidades.js'
import { NOME_DO_SLOT, RARIDADES, SLOTS, TIPOS, bonusFinal, nomeCompleto, precoDeReferencia } from './rpg/itens.js'
import {
  atributos,
  descansoRestante,
  feridoRestante,
  itemEquipado,
  vidaAtual,
  xpParaSubir,
} from './rpg/jogador.js'
import { NIVEIS_ACIMA, chefeDoMarco, proximoBoss } from './rpg/monstros.js'
import { FEITICOS } from './rpg/feiticos.js'
import { TITANITAS } from './rpg/ferreiro.js'
import { emExpedicao, tempoRestante, EXPEDICOES } from './rpg/expedicao.js'
import { esperaDoAbismo } from './rpg/abismo.js'
import { esperaEntreDuelos, posicaoNoRanking } from './rpg/pvp.js'
import { esperaDoRito } from './rpg/evolucao.js'

/** Um item com tudo que a interface precisa mostrar sem recalcular nada. */
export function verItem(item, index = null) {
  if (!item) return null

  const base = {
    uid: item.uid,
    posicao: index === null ? null : index + 1,
    tipo: item.tipo,
    nome: item.nome,
    nomeCompleto: nomeCompleto(item),
    emoji: TIPOS[item.tipo]?.emoji ?? '📦',
    slot: item.slot ?? null,
    nomeDoSlot: item.slot ? NOME_DO_SLOT[item.slot] : null,
    equipavel: Boolean(item.slot),
  }

  if (!item.slot) {
    // Consumivel: pocao ou bandagem.
    return {
      ...base,
      consumivel: true,
      emoji: item.emoji ?? base.emoji,
      cura: item.cura ?? 0,
      tiraFerimento: Boolean(item.tiraFerimento),
    }
  }

  const raridade = RARIDADES[item.raridade] ?? RARIDADES.comum

  return {
    ...base,
    consumivel: false,
    raridade: item.raridade,
    raridadeNome: raridade.nome,
    raridadeEmoji: raridade.emoji,
    nivel: item.nivel,
    reforco: item.reforco ?? 0,
    feitico: item.feitico ?? null,
    feiticoNome: item.feitico ? FEITICOS[item.feitico]?.nome ?? null : null,
    feiticoEmoji: item.feitico ? FEITICOS[item.feitico]?.emoji ?? null : null,
    bonus: bonusFinal(item),
    bonusDeFabrica: item.bonus,
    preco: precoDeReferencia(item),
  }
}

export const verClasse = (id) => {
  const c = classe(id)
  if (!c) return null
  return {
    id,
    nome: c.nome,
    emoji: c.emoji,
    resumo: c.resumo ?? '',
    tier: c.tier,
    usa: c.usa,
    base: c.base,
    ganho: c.ganho,
    habilidade: c.habilidade ?? null,
    evoluiDe: c.evoluiDe ?? null,
  }
}

export const verHabilidade = (id) => {
  const h = HABILIDADES[id]
  return h ? { id, nome: h.nome, emoji: h.emoji, resumo: h.resumo, efeitos: h.efeitos } : null
}

/** As sete classes base, para a tela de criacao de personagem. */
export const classesBase = () =>
  Object.keys(CLASSES)
    .filter((id) => CLASSES[id].tier === 1)
    .map(verClasse)

/** A ficha inteira. É o payload de GET /api/estado. */
export function verPersonagem(player) {
  const ficha = player.rpg
  const c = classe(ficha.classe)
  const total = atributos(player)
  const hp = vidaAtual(player)

  const linhagem = ficha.classe ? linhagemDe(ficha.classe).map(verClasse) : []
  const habilidades = c ? habilidadesDaClasse(c).map(verHabilidade) : []

  const esperaDeLuta = Math.max(
    0,
    (ficha.ultimaLuta ?? 0) + config.rpg.cooldownSummonSeconds * 1000 - Date.now(),
  )

  const marco = ficha.bossPendente || proximoBoss(ficha.nivel)
  const chefe = chefeDoMarco(marco)

  return {
    id: player.id,
    nome: player.name,
    criadoEm: player.criadoEm,

    classe: c ? verClasse(ficha.classe) : null,
    linhagem,
    habilidades,
    efeitos: c ? efeitosDaClasse(c) : {},

    nivel: ficha.nivel,
    xp: ficha.xp,
    xpParaSubir: xpParaSubir(ficha.nivel),
    gold: ficha.gold,

    hp,
    hpMax: total.hp,
    atributos: total,

    equipado: Object.fromEntries(SLOTS.map((slot) => [slot, verItem(itemEquipado(player, slot))])),
    inventario: ficha.inventario.map(verItem),
    mochila: { usado: ficha.inventario.length, total: config.rpg.tamanhoMochila },

    titanitas: Object.fromEntries(
      Object.entries(TITANITAS).map(([grau, t]) => [
        grau,
        { nome: t.nome, emoji: t.emoji, quantidade: ficha.titanitas?.[grau] ?? 0 },
      ]),
    ),
    feiticos: Object.entries(ficha.feiticos ?? {})
      .filter(([, quantas]) => quantas > 0)
      .map(([id, quantas]) => ({
        id,
        quantidade: quantas,
        nome: FEITICOS[id]?.nome ?? id,
        emoji: FEITICOS[id]?.emoji ?? '✨',
        resumo: FEITICOS[id]?.resumo ?? '',
      })),

    estados: {
      ferido: feridoRestante(player),
      descansando: descansoRestante(player),
      expedicao: emExpedicao(player)
        ? {
            tipo: ficha.expedicao.tipo,
            nome: EXPEDICOES[ficha.expedicao.tipo]?.nome ?? ficha.expedicao.tipo,
            emoji: EXPEDICOES[ficha.expedicao.tipo]?.emoji ?? '🚶',
            restante: tempoRestante(player),
          }
        : null,
      esperaDoRito: esperaDoRito(player),
      esperaDaProva: Math.max(0, (ficha.provaAte ?? 0) - Date.now()),

      // O bastante para a tela desenhar a rampa da fogueira sem pedir nada
      // ao servidor a cada segundo: de onde a vida partiu e quanto dura o
      // descanso. O cliente interpola exatamente a mesma conta de
      // vidaAtual() — e o valor que vale continua sendo o de cima, `hp`.
      fogueira:
        descansoRestante(player) > 0
          ? {
              duracao: ficha.fogueiraAte - (ficha.hpEm || ficha.fogueiraAte),
              hpNoInicio: ficha.hp ?? total.hp,
            }
          : null,
    },

    cooldowns: {
      luta: esperaDeLuta,
      abismo: esperaDoAbismo(player),
      pvp: esperaEntreDuelos(player),
      raid: Math.max(
        0,
        (ficha.raid?.ultimaRaid ?? 0) + config.rpg.raid.cooldownMinutos * 60_000 - Date.now(),
      ),
    },

    boss: {
      pendente: ficha.bossPendente,
      proximoMarco: proximoBoss(ficha.nivel),
      vencidos: ficha.bossesVencidos,
      // O chefe de um marco luta tres niveis acima dele — e dai que vem a
      // dificuldade, mais do que dos multiplicadores.
      chefe: chefe
        ? { nome: chefe.nome, emoji: chefe.emoji, nivel: marco + NIVEIS_ACIMA, marco, eco: Boolean(chefe.eco) }
        : null,
    },

    evolucao: {
      nivelExigido: nivelDoProximoDegrau(ficha.classe),
      opcoes: ficha.classe ? especialidadesDe(ficha.classe).length : 0,
      tentativas: ficha.evolucao?.tentativas ?? 0,
    },

    abismo: { ...ficha.abismo },
    raid: { ...ficha.raid },
    pvp: { ...ficha.pvp, posicao: posicaoNoRanking(player) },
    vitorias: ficha.vitorias,
    derrotas: ficha.derrotas,
  }
}

/** Resumo curto — a lista de personagens da conta e o ranking do servidor. */
export function verResumo(player) {
  const c = classe(player.rpg.classe)
  return {
    id: player.id,
    nome: player.name,
    nivel: player.rpg.nivel,
    classe: c ? { id: player.rpg.classe, nome: c.nome, emoji: c.emoji, tier: c.tier } : null,
    gold: player.rpg.gold,
    hp: vidaAtual(player),
    hpMax: atributos(player).hp,
    criadoEm: player.criadoEm,
    jogadoEm: player.jogadoEm,
    vitorias: player.rpg.vitorias,
    derrotas: player.rpg.derrotas,
    melhorAndar: player.rpg.abismo?.melhorAndar ?? 0,
    pontosPvp: player.rpg.pvp?.pontos ?? 0,
  }
}
