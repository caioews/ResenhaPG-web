/** Registro, login e a estante de personagens da conta. */
import { Router } from 'express'
import { config } from '../config.js'
import {
  COOKIE,
  abrirSessao,
  entrar,
  exigirLogin,
  fecharSessao,
  opcoesDoCookie,
  registrar,
  usuarioDaSessao,
} from '../auth.js'
import * as store from '../store.js'
import { esquecerPersonagem } from '../mercado.js'
import { classesBase, verPersonagem, verResumo } from '../visao.js'
import { exigirPersonagem, responder, rota } from '../contexto.js'
import { darGold } from '../rpg/jogador.js'
import { classe } from '../rpg/classes.js'

export const contas = Router()

const NOME_DE_PERSONAGEM = /^[\p{L}\p{N} _.'-]{3,18}$/u

// --------------------------------------------------------------- sessao

contas.post(
  '/auth/registrar',
  rota((req, res) => {
    const { usuario, senha } = req.body ?? {}
    const feito = registrar(usuario, senha)
    if (feito.erro) return res.status(400).json({ erro: feito.erro })

    const token = abrirSessao(feito.usuario.id)
    res.cookie(COOKIE, token, opcoesDoCookie())
    res.json({ usuario: { id: feito.usuario.id, nome: feito.usuario.usuario }, personagens: [] })
  }),
)

contas.post(
  '/auth/entrar',
  rota((req, res) => {
    const { usuario, senha } = req.body ?? {}
    const feito = entrar(usuario, senha)
    if (feito.erro) return res.status(401).json({ erro: feito.erro })

    const token = abrirSessao(feito.usuario.id)
    res.cookie(COOKIE, token, opcoesDoCookie())
    res.json({
      usuario: { id: feito.usuario.id, nome: feito.usuario.usuario },
      personagens: store.personagensDoUsuario(feito.usuario.id).map(verResumo),
    })
  }),
)

contas.post(
  '/auth/sair',
  rota((req, res) => {
    fecharSessao(req.cookies?.[COOKIE])
    res.clearCookie(COOKIE, { path: '/' })
    res.json({ ok: true })
  }),
)

contas.get(
  '/auth/eu',
  rota((req, res) => {
    const usuario = usuarioDaSessao(req.cookies?.[COOKIE])
    if (!usuario) return res.json({ usuario: null, personagens: [] })

    res.json({
      usuario: { id: usuario.id, nome: usuario.usuario },
      personagens: store.personagensDoUsuario(usuario.id).map(verResumo),
      maxPersonagens: config.web.maxPersonagens,
    })
  }),
)

// ----------------------------------------------------------- personagens

contas.get(
  '/classes',
  rota((_req, res) => res.json({ classes: classesBase() })),
)

contas.get(
  '/personagens',
  exigirLogin,
  rota((req, res) =>
    res.json({
      personagens: store.personagensDoUsuario(req.usuario.id).map(verResumo),
      maxPersonagens: config.web.maxPersonagens,
    }),
  ),
)

contas.post(
  '/personagens',
  exigirLogin,
  rota((req, res) => {
    const nome = String(req.body?.nome ?? '').trim().replace(/\s+/g, ' ')
    const classeId = String(req.body?.classe ?? '')

    if (!NOME_DE_PERSONAGEM.test(nome)) {
      return res.status(400).json({ erro: 'O nome precisa ter de 3 a 18 letras, números ou espaços.' })
    }
    if (store.personagensDoUsuario(req.usuario.id).length >= config.web.maxPersonagens) {
      return res
        .status(409)
        .json({ erro: `Sua conta já tem ${config.web.maxPersonagens} personagens.` })
    }
    if (!store.nomeEstaLivre(nome)) {
      return res.status(409).json({ erro: 'Já existe um personagem com esse nome.' })
    }

    const escolhida = classe(classeId)
    if (!escolhida || escolhida.tier !== 1) {
      return res.status(400).json({ erro: 'Escolha uma das classes iniciais.' })
    }

    const player = store.criarPersonagem(req.usuario.id, nome)
    player.rpg.classe = classeId
    // Sem gold inicial o novato entra sem equipamento e sem como comprar
    // a primeira peca — e trava antes de comecar.
    darGold(player, config.rpg.goldInicial)
    store.flush()

    res.json({ personagem: verPersonagem(player) })
  }),
)

contas.delete(
  '/personagens/:id',
  exigirLogin,
  rota((req, res) => {
    const player = store.buscarPersonagem(req.params.id)
    if (!player || player.usuarioId !== req.usuario.id) {
      return res.status(404).json({ erro: 'Personagem não encontrado nesta conta.' })
    }
    // Apagar personagem nao tem desfazer: exige o nome escrito por extenso.
    if (String(req.body?.confirmacao ?? '').trim().toLowerCase() !== player.name.toLowerCase()) {
      return res.status(400).json({ erro: `Para apagar, escreva o nome do personagem: ${player.name}` })
    }

    // Oferta pendente de um personagem que deixou de existir não serve para
    // nada, e aceitar uma daria erro no meio da troca.
    esquecerPersonagem(player.id)
    store.apagarPersonagem(player.id)
    res.json({ ok: true, personagens: store.personagensDoUsuario(req.usuario.id).map(verResumo) })
  }),
)

contas.post(
  '/personagem/renomear',
  exigirLogin,
  exigirPersonagem,
  rota((req, res) => {
    const player = req.player
    const nome = String(req.body?.nome ?? '').trim().replace(/\s+/g, ' ')

    if (!NOME_DE_PERSONAGEM.test(nome)) {
      return res.status(400).json({ erro: 'O nome precisa ter de 3 a 18 letras, números ou espaços.' })
    }
    if (!store.nomeEstaLivre(nome, player.id)) {
      return res.status(409).json({ erro: 'Já existe um personagem com esse nome.' })
    }

    store.renomearPersonagem(player, nome)
    responder(res, player, { texto: `Agora você é ${nome}.` })
  }),
)

contas.get(
  '/estado',
  exigirLogin,
  exigirPersonagem,
  rota((req, res) => {
    store.tocar(req.player)
    res.json({ personagem: verPersonagem(req.player) })
  }),
)
