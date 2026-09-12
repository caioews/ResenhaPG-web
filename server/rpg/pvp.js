/**
 * Duelos entre jogadores.
 *
 * Os desafios ficam so na memoria e vencem em poucos minutos — se o bot
 * reiniciar no meio, ninguem perde gold, porque a aposta so muda de mao
 * quando o desafiado aceita.
 *
 * O ranking usa pontuacao estilo Elo em vez de contar vitorias: contando
 * vitorias, bastava desafiar sempre o mais fraco do grupo para liderar.
 * Com Elo, ganhar de quem esta muito abaixo rende quase nada, e perder
 * para quem esta muito acima custa quase nada.
 */
import { config } from '../config.js'
import * as store from '../store.js'

/** chave: `${chat}|${desafiadoId}` -> desafio */
const desafios = new Map()

const chave = (chatId, desafiadoId) => `${chatId}|${desafiadoId}`

export function criarDesafio(chatId, { desafianteId, desafianteJid, desafiadoId, desafiadoJid, aposta }) {
  const desafio = {
    desafianteId,
    desafianteJid,
    desafiadoId,
    desafiadoJid,
    aposta,
    criadoEm: Date.now(),
  }

  desafios.set(chave(chatId, desafiadoId), desafio)
  return desafio
}

export function pegarDesafio(chatId, desafiadoId) {
  const desafio = desafios.get(chave(chatId, desafiadoId))
  if (!desafio) return null

  if (Date.now() - desafio.criadoEm > config.rpg.pvp.desafioMinutos * 60_000) {
    desafios.delete(chave(chatId, desafiadoId))
    return null
  }

  return desafio
}

export const apagarDesafio = (chatId, desafiadoId) => desafios.delete(chave(chatId, desafiadoId))

// ------------------------------------------------------------------ ranking

/** Chance esperada de A vencer B, pela diferenca de pontos. */
export const chanceEsperada = (pontosA, pontosB) => 1 / (1 + 10 ** ((pontosB - pontosA) / 400))

/**
 * Aplica o resultado no ranking dos dois lados.
 * Devolve quantos pontos mudaram de mao.
 */
export function registrarResultado(vencedor, perdedor) {
  const { k } = config.rpg.pvp

  const ganho = Math.max(1, Math.round(k * (1 - chanceEsperada(vencedor.rpg.pvp.pontos, perdedor.rpg.pvp.pontos))))

  vencedor.rpg.pvp.pontos += ganho
  vencedor.rpg.pvp.vitorias++
  vencedor.rpg.pvp.sequencia++
  vencedor.rpg.pvp.melhorSequencia = Math.max(
    vencedor.rpg.pvp.melhorSequencia,
    vencedor.rpg.pvp.sequencia,
  )

  perdedor.rpg.pvp.pontos = Math.max(0, perdedor.rpg.pvp.pontos - ganho)
  perdedor.rpg.pvp.derrotas++
  perdedor.rpg.pvp.sequencia = 0

  const agora = Date.now()
  vencedor.rpg.pvp.ultimoDuelo = agora
  perdedor.rpg.pvp.ultimoDuelo = agora

  store.save()
  return ganho
}

/** Quem ja duelou alguma vez, do mais pontuado para o menos. */
export function ranking(limite = 10) {
  return store
    .allPlayers()
    .filter((p) => p.rpg?.pvp && p.rpg.pvp.vitorias + p.rpg.pvp.derrotas > 0)
    .sort((a, b) => b.rpg.pvp.pontos - a.rpg.pvp.pontos)
    .slice(0, limite)
}

export function posicaoNoRanking(player) {
  const todos = store
    .allPlayers()
    .filter((p) => p.rpg?.pvp && p.rpg.pvp.vitorias + p.rpg.pvp.derrotas > 0)
    .sort((a, b) => b.rpg.pvp.pontos - a.rpg.pvp.pontos)

  return todos.findIndex((p) => p.id === player.id) + 1
}

export const esperaEntreDuelos = (player) =>
  Math.max(0, (player.rpg.pvp.ultimoDuelo ?? 0) + config.rpg.pvp.cooldownMinutos * 60_000 - Date.now())
