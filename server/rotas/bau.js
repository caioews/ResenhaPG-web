/**
 * O baú visto pela API. As regras moram em server/rpg/bau.js.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import { estaEquipado } from '../rpg/jogador.js'
import {
  comprarEspaco,
  espacosDoBau,
  guardarNoBau,
  itensDoBau,
  precoDoProximoEspaco,
  retirarDoBau,
} from '../rpg/bau.js'
import { verItem } from '../visao.js'

export const bauRotas = Router()

bauRotas.use(exigirLogin, exigirPersonagem, exigirClasse)

bauRotas.get(
  '/bau',
  rota((req, res) => {
    const player = req.player

    res.json({
      gold: player.rpg.gold,
      espacos: espacosDoBau(player),
      comprados: player.rpg.bau.espacosComprados ?? 0,
      proximoPreco: precoDoProximoEspaco(player),
      // Quanto cada espaço encarece o seguinte — a tela avisa antes de cobrar.
      precoPorEspaco: config.rpg.bau.precoPorEspaco,
      itens: itensDoBau(player).map((item, i) => verItem(item, i)),
      // O que dá para guardar: a mochila inteira menos o que está em uso.
      guardaveis: player.rpg.inventario
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => !estaEquipado(player, item.uid))
        .map(({ item, i }) => verItem(item, i)),
    })
  }),
)

bauRotas.post(
  '/bau/guardar',
  rota((req, res) => {
    const feito = guardarNoBau(req.player, String(req.body?.uid ?? ''))
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    responder(res, req.player, { texto: `${feito.item.nome} foi para o baú.` })
  }),
)

bauRotas.post(
  '/bau/retirar',
  rota((req, res) => {
    const feito = retirarDoBau(req.player, String(req.body?.uid ?? ''))
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    responder(res, req.player, { texto: `${feito.item.nome} voltou para a mochila.` })
  }),
)

bauRotas.post(
  '/bau/comprar-espaco',
  rota((req, res) => {
    const feito = comprarEspaco(req.player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    responder(res, req.player, {
      texto: `Mais um espaço no baú por ${feito.preco.toLocaleString('pt-BR')} de gold. Agora são ${feito.espacos}.`,
      espacos: feito.espacos,
      proximoPreco: feito.proximoPreco,
    })
  }),
)
