/**
 * Missões diárias vistas pela API: a lista do dia, resgatar e abrir o baú.
 */
import { Router } from 'express'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import { abrirBau, resgatar, verMissoes } from '../missoes.js'

export const missoesRotas = Router()

missoesRotas.use(exigirLogin, exigirPersonagem, exigirClasse)

missoesRotas.get(
  '/missoes',
  rota((req, res) => res.json({ missoes: verMissoes(req.player) })),
)

missoesRotas.post(
  '/missoes/resgatar',
  rota((req, res) => {
    const feito = resgatar(req.player, req.body?.id)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, { ...feito, missoes: verMissoes(req.player) })
  }),
)

missoesRotas.post(
  '/missoes/bau',
  rota((req, res) => {
    const feito = abrirBau(req.player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, { bau: feito, missoes: verMissoes(req.player) })
  }),
)
