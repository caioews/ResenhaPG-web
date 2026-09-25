/**
 * A luta final (server/final.js): a arena, o "pronto", o começo da luta e a
 * escolha de depois do fim.
 *
 * Entrar na arena não tem rota própria de propósito: quem chega à última fase
 * da rota é levado para lá pela própria caçada (`POST /api/combate/cacada`),
 * e o cliente só lê o estado daqui.
 */
import { Router } from 'express'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import {
  comecarALuta,
  entrarNaArena,
  escolherDepoisDoFim,
  marcarPronto,
  sairDaArena,
  verArena,
} from '../final.js'

export const finalRotas = Router()

finalRotas.use(exigirLogin, exigirPersonagem)

/** Quem está na arena, quem está pronto e o que falta. */
finalRotas.get(
  '/',
  rota((req, res) => res.json({ arena: verArena(req.player) })),
)

/** "Ir ao Coração": entra (ou volta) para a arena, se já chegou à última fase. */
finalRotas.post(
  '/entrar',
  exigirClasse,
  rota((req, res) => {
    const feito = entrarNaArena(req.player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, { arena: verArena(req.player) })
  }),
)

finalRotas.post(
  '/pronto',
  exigirClasse,
  rota((req, res) => {
    const feito = marcarPronto(req.player, Boolean(req.body?.pronto))
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    res.json({ arena: verArena(req.player) })
  }),
)

finalRotas.post(
  '/sair',
  rota((req, res) => {
    sairDaArena(req.player.id)
    res.json({ ok: true })
  }),
)

/** Começa a luta com todos os que estão prontos. */
finalRotas.post(
  '/lutar',
  exigirClasse,
  rota((req, res) => {
    const feito = comecarALuta(req.player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, { luta: feito.luta })
  }),
)

/** Depois dos créditos: continuar no último ato ou prestigiar. */
finalRotas.post(
  '/escolha',
  exigirClasse,
  rota((req, res) => {
    const feito = escolherDepoisDoFim(req.player, String(req.body?.escolha ?? ''))
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, feito)
  }),
)
