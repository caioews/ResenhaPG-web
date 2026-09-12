/**
 * Tempo real: o chat da guilda, quem está on-line e os avisos que precisam
 * chegar sem o jogador recarregar a página (desafio de PvP, alguém entrou na
 * sua sala de raid, a raid começou).
 *
 * Nada de regra de jogo passa por aqui. O socket só avisa; quem decide
 * qualquer coisa é a API, com o cálculo no servidor.
 */
import { Server } from 'socket.io'
import cookie from 'cookie'
import { config } from './config.js'
import { COOKIE, usuarioDaSessao } from './auth.js'
import { gravarMensagem, historicoDoChat, podarChat } from './db.js'
import * as store from './store.js'
import { classe } from './rpg/classes.js'

const CANAL = 'guilda'

let io = null

/** personagemId -> quantas abas daquele personagem estão abertas */
const online = new Map()

const marcarOnline = (id) => online.set(id, (online.get(id) ?? 0) + 1)

function marcarOffline(id) {
  const quantas = (online.get(id) ?? 1) - 1
  if (quantas <= 0) online.delete(id)
  else online.set(id, quantas)
}

/** Quem está com o jogo aberto agora. */
export function jogadoresOnline() {
  return [...online.keys()]
    .map((id) => store.buscarPersonagem(id))
    .filter(Boolean)
    .map((p) => {
      const c = classe(p.rpg.classe)
      return {
        id: p.id,
        nome: p.name,
        nivel: p.rpg.nivel,
        classe: c ? { id: p.rpg.classe, nome: c.nome, emoji: c.emoji } : null,
        pontosPvp: p.rpg.pvp?.pontos ?? 0,
      }
    })
    .sort((a, b) => b.nivel - a.nivel)
}

const sala = (personagemId) => `personagem:${personagemId}`

/** Manda um evento para todas as abas de um personagem. */
export function emitirPara(personagemId, evento, dados) {
  io?.to(sala(personagemId)).emit(evento, dados)
}

/** Manda um evento para todo mundo. */
export function emitirParaTodos(evento, dados) {
  io?.emit(evento, dados)
}

function publicar(mensagem) {
  gravarMensagem.run(mensagem.canal, mensagem.autor, mensagem.texto, mensagem.criado_em)
  podarChat(mensagem.canal, config.web.chatHistorico)
  io?.emit('chat:mensagem', mensagem)
}

/**
 * Aviso do sistema no chat: subiu de nível, derrubou um chefe, achou um
 * lendário. É o que faz o servidor parecer habitado.
 */
export function anunciar(texto) {
  publicar({ canal: CANAL, autor: '', texto, criado_em: Date.now() })
}

export const historico = () => historicoDoChat(CANAL, config.web.chatHistorico)

export function iniciarRealtime(servidorHttp) {
  io = new Server(servidorHttp, { cors: { origin: false } })

  io.on('connection', (socket) => {
    const cabecalho = socket.handshake.headers.cookie ?? ''
    const usuario = usuarioDaSessao(cookie.parse(cabecalho)[COOKIE])

    if (!usuario) {
      socket.emit('erro', 'Sessão inválida.')
      socket.disconnect(true)
      return
    }

    let personagemId = null
    let ultimaMensagem = 0

    socket.on('entrar', (id) => {
      const player = store.buscarPersonagem(String(id ?? ''))
      if (!player || player.usuarioId !== usuario.id) {
        socket.emit('erro', 'Personagem não encontrado nesta conta.')
        return
      }

      if (personagemId) {
        socket.leave(sala(personagemId))
        marcarOffline(personagemId)
      }

      personagemId = player.id
      socket.join(sala(personagemId))
      marcarOnline(personagemId)

      socket.emit('chat:historico', historico())
      io.emit('jogadores:online', jogadoresOnline())
    })

    socket.on('chat:enviar', (texto) => {
      if (!personagemId) return
      const player = store.buscarPersonagem(personagemId)
      if (!player) return

      const limpo = String(texto ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, config.web.chatMaxCaracteres)
      if (!limpo) return

      const agora = Date.now()
      if (agora - ultimaMensagem < config.web.chatCooldownSegundos * 1000) return
      ultimaMensagem = agora

      publicar({ canal: CANAL, autor: player.name, texto: limpo, criado_em: agora })
    })

    socket.on('disconnect', () => {
      if (!personagemId) return
      marcarOffline(personagemId)
      io.emit('jogadores:online', jogadoresOnline())
    })
  })

  return io
}
