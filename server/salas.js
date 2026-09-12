/**
 * Salas de raid e desafios de PvP — o estado que vive só em memória.
 *
 * Essa escolha é herdada do bot e vale a pena manter: uma sala não retém
 * nada de ninguém. Não cobra entrada, não guarda item, não segura gold. Se
 * o servidor reiniciar no meio da formação, ninguém perde coisa alguma — no
 * máximo o pessoal chama de novo. Oferta pendente que retém bens é fonte
 * inesgotável de bug de contabilidade.
 */
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { sortearChefe, TODOS_OS_CHEFES } from './rpg/raid.js'

// ------------------------------------------------------------ raid

/** id da sala -> sala */
const salas = new Map()

const salaVencida = (sala) => Date.now() > sala.expiraEm

function limparSalas() {
  for (const [id, sala] of salas) if (salaVencida(sala)) salas.delete(id)
}

export function salaDoJogador(personagemId) {
  limparSalas()
  for (const sala of salas.values()) {
    if (sala.participantes.includes(personagemId)) return sala
  }
  return null
}

export function listarSalas() {
  limparSalas()
  return [...salas.values()]
}

export const pegarSala = (id) => {
  limparSalas()
  return salas.get(id) ?? null
}

export function abrirSala(player) {
  const chefeId = sortearChefe(player.rpg.nivel)
  const sala = {
    id: randomUUID().slice(0, 8),
    chefeId,
    criadorId: player.id,
    criadorNome: player.name,
    participantes: [player.id],
    criadaEm: Date.now(),
    expiraEm: Date.now() + config.rpg.raid.salaMinutos * 60_000,
  }
  salas.set(sala.id, sala)
  return sala
}

export function entrarNaSala(sala, personagemId) {
  if (sala.participantes.includes(personagemId)) return { erro: 'Você já está nessa sala.' }
  if (sala.participantes.length >= config.rpg.raid.maxJogadores) {
    return { erro: `A sala já tem ${config.rpg.raid.maxJogadores} jogadores.` }
  }
  sala.participantes.push(personagemId)
  return { sala }
}

export function sairDaSala(sala, personagemId) {
  sala.participantes = sala.participantes.filter((id) => id !== personagemId)
  // Sala vazia, ou dono saiu: fecha. Sem dono ninguém pode começar.
  if (!sala.participantes.length || sala.criadorId === personagemId) salas.delete(sala.id)
  return sala
}

export const fecharSala = (id) => salas.delete(id)

export const chefeDaSala = (sala) => TODOS_OS_CHEFES[sala.chefeId]

// ------------------------------------------------------------- pvp

/** id do desafio -> desafio */
const desafios = new Map()

const desafioVencido = (d) => Date.now() > d.expiraEm

function limparDesafios() {
  for (const [id, d] of desafios) if (desafioVencido(d)) desafios.delete(id)
}

export function criarDesafio({ desafiante, desafiado, aposta }) {
  limparDesafios()

  // Um desafio de cada vez entre as mesmas duas pessoas.
  for (const d of desafios.values()) {
    if (d.desafianteId === desafiante.id && d.desafiadoId === desafiado.id) {
      return { erro: 'Você já desafiou esse jogador. Espere a resposta.' }
    }
  }

  const desafio = {
    id: randomUUID().slice(0, 8),
    desafianteId: desafiante.id,
    desafianteNome: desafiante.name,
    desafiadoId: desafiado.id,
    desafiadoNome: desafiado.name,
    aposta,
    criadoEm: Date.now(),
    expiraEm: Date.now() + config.rpg.pvp.desafioMinutos * 60_000,
  }

  desafios.set(desafio.id, desafio)
  return { desafio }
}

export const pegarDesafio = (id) => {
  limparDesafios()
  return desafios.get(id) ?? null
}

export const apagarDesafio = (id) => desafios.delete(id)

/** Os desafios que esperam resposta deste personagem. */
export function desafiosPara(personagemId) {
  limparDesafios()
  return [...desafios.values()].filter((d) => d.desafiadoId === personagemId)
}

/** Os desafios que este personagem mandou e ainda não foram respondidos. */
export function desafiosDe(personagemId) {
  limparDesafios()
  return [...desafios.values()].filter((d) => d.desafianteId === personagemId)
}
