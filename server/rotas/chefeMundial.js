/**
 * O chefe mundial visto pela API. As regras moram em server/chefeMundial.js.
 */
import { Router } from 'express'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import { atacar, proximaJanela, verChefe } from '../chefeMundial.js'

export const chefeMundialRotas = Router()

chefeMundialRotas.use(exigirLogin, exigirPersonagem, exigirClasse)

chefeMundialRotas.get(
  '/chefe-mundial',
  rota((req, res) => {
    const agenda = proximaJanela()
    // A hora exata é surpresa: a tela só diz se ele ainda vem hoje.
    res.json({ chefe: verChefe(req.player), aindaVemHoje: !agenda.feito })
  }),
)

chefeMundialRotas.post(
  '/chefe-mundial/atacar',
  rota((req, res) => {
    const feito = atacar(req.player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, { ...feito, chefe: verChefe(req.player) })
  }),
)
