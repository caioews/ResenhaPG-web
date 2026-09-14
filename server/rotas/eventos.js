/**
 * Os eventos aleatórios vistos pela API: o que está aberto, atender e
 * desistir. A agenda e a resolução moram em server/eventos.js.
 */
import { Router } from 'express'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, rota } from '../contexto.js'
import * as eventos from '../eventos.js'

export const eventosRotas = Router()

eventosRotas.use(exigirLogin, exigirPersonagem)

eventosRotas.get(
  '/eventos',
  rota((_req, res) => {
    res.json({ evento: eventos.eventoAtual() })
  }),
)

eventosRotas.post(
  '/eventos/participar',
  exigirClasse,
  rota((req, res) => {
    const feito = eventos.participar(req.player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    res.json(feito)
  }),
)

eventosRotas.post(
  '/eventos/desistir',
  rota((req, res) => {
    const feito = eventos.desistir(req.player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    res.json(feito)
  }),
)
