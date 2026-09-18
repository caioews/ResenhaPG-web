/**
 * O relógio do jogo: hora e dia no fuso dos jogadores, não no do servidor.
 *
 * A VPS roda em UTC. Sem isto, "o dia" das missões viraria às 21h de
 * Brasília e o chefe mundial apareceria de madrugada.
 */
import { config } from './config.js'

function partes(agora = new Date()) {
  const lista = new Intl.DateTimeFormat('en-US', {
    timeZone: config.eventos.fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(agora)
  const pegar = (tipo) => lista.find((p) => p.type === tipo)?.value ?? '0'
  return { ano: pegar('year'), mes: pegar('month'), dia: pegar('day'), hora: Number(pegar('hour')), minuto: Number(pegar('minute')) }
}

/** A hora do dia com fração, no fuso do jogo. 14h30 = 14.5 */
export function horaLocal(agora = new Date()) {
  const p = partes(agora)
  return p.hora + p.minuto / 60
}

/** O dia no fuso do jogo, como '2026-09-17'. É a chave das missões diárias. */
export function diaLocal(agora = new Date()) {
  const p = partes(agora)
  return `${p.ano}-${p.mes}-${p.dia}`
}

/** Quantos ms faltam para o dia virar (meia-noite no fuso do jogo). */
export function msAteVirarODia(agora = new Date()) {
  return Math.max(60_000, Math.round((24 - horaLocal(agora)) * 3_600_000))
}
