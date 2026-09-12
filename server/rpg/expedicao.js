/**
 * Expedicoes: manda o personagem para fora por um tempo e ele volta com
 * XP, gold e talvez um item.
 *
 * Enquanto esta fora o personagem nao luta — e o custo da expedicao. Quem
 * esta jogando ativamente ganha mais caçando; a expedicao e para quem vai
 * fechar o WhatsApp e voltar depois.
 *
 * Quanto mais longa, melhor: alem de render por mais tempo, ganha um bonus
 * em cima do total e mais tentativas de raridade no drop.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { RARIDADES, criarItem, tiposDaClasse } from './itens.js'

const ORDEM_RARIDADE = ['comum', 'incomum', 'raro', 'epico', 'lendario']

export const EXPEDICOES = {
  patrulha: {
    id: 'patrulha',
    nome: 'Patrulha',
    emoji: '🚶',
    resumo: 'Uma volta rápida pelos arredores',
    minutos: 15,
    bonus: 1.0,
    chanceDrop: 0.25,
    tentativasDeRaridade: 1,
  },
  cacada: {
    id: 'cacada',
    nome: 'Caçada',
    emoji: '🏕️',
    resumo: 'Alguns dias de caça em território selvagem',
    minutos: 45,
    bonus: 1.15,
    chanceDrop: 0.4,
    tentativasDeRaridade: 2,
  },
  incursao: {
    id: 'incursao',
    nome: 'Incursão',
    emoji: '🗺️',
    resumo: 'Expedição longa em ruínas distantes',
    minutos: 120,
    bonus: 1.35,
    chanceDrop: 0.6,
    tentativasDeRaridade: 3,
  },
}

export const NOMES_DE_EXPEDICAO = Object.keys(EXPEDICOES)

/** Aceita o nome, o id ou o numero na lista. */
export function acharExpedicao(busca) {
  const texto = String(busca ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

  if (/^\d+$/.test(texto)) return EXPEDICOES[NOMES_DE_EXPEDICAO[Number(texto) - 1]] ?? null

  return (
    Object.values(EXPEDICOES).find((e) => e.id === texto || e.nome.toLowerCase() === texto) ?? null
  )
}

/** Quanto uma expedicao rende para um jogador daquele nivel. */
export function recompensasDe(expedicao, nivel) {
  const { xpPorMinuto, goldPorMinuto } = config.rpg.expedicao

  return {
    xp: Math.round((xpPorMinuto.base + nivel * xpPorMinuto.porNivel) * expedicao.minutos * expedicao.bonus),
    gold: Math.round(
      (goldPorMinuto.base + nivel * goldPorMinuto.porNivel) * expedicao.minutos * expedicao.bonus,
    ),
  }
}

/**
 * Sorteia a raridade do drop. Expedicao longa tenta mais vezes e fica com a
 * melhor — e o que faz valer a pena esperar em vez de encadear patrulhas.
 */
export function sortearRaridade(tentativas, sorte = Math.random) {
  let melhor = 'comum'

  for (let i = 0; i < tentativas; i++) {
    const total = ORDEM_RARIDADE.reduce((soma, r) => soma + RARIDADES[r].peso, 0)
    let ponto = sorte() * total
    let sorteada = 'comum'

    for (const id of ORDEM_RARIDADE) {
      ponto -= RARIDADES[id].peso
      if (ponto <= 0) {
        sorteada = id
        break
      }
    }

    if (ORDEM_RARIDADE.indexOf(sorteada) > ORDEM_RARIDADE.indexOf(melhor)) melhor = sorteada
  }

  return melhor
}

export const emExpedicao = (player) => Boolean(player.rpg.expedicao?.tipo)

export const tempoRestante = (player) =>
  Math.max(0, (player.rpg.expedicao?.terminaEm ?? 0) - Date.now())

export const expedicaoTerminou = (player) => emExpedicao(player) && tempoRestante(player) === 0

export function enviar(player, expedicao) {
  player.rpg.expedicao = {
    tipo: expedicao.id,
    terminaEm: Date.now() + expedicao.minutos * 60_000,
  }
  store.save()
  return player.rpg.expedicao
}

export function limpar(player) {
  player.rpg.expedicao = { tipo: null, terminaEm: 0 }
  store.save()
}
