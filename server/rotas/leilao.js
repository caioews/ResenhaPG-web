/**
 * A Casa de Leilões vista pela API. As regras moram em server/leilao.js.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import * as leilao from '../leilao.js'
import { entregasDe, retirar } from '../entregas.js'
import { estaEquipado } from '../rpg/jogador.js'
import { precoDeReferencia } from '../rpg/itens.js'
import { precoDeCompra } from '../rpg/loja.js'
import { verItem } from '../visao.js'

export const leilaoRotas = Router()

leilaoRotas.use(exigirLogin, exigirPersonagem, exigirClasse)

leilaoRotas.get(
  '/leilao',
  rota((req, res) => {
    const player = req.player
    const abertos = leilao.listarAbertos()

    res.json({
      gold: player.rpg.gold,
      regras: {
        duracoesHoras: config.rpg.leilao.duracoesHoras,
        taxaDeVenda: config.rpg.leilao.taxaDeVenda,
        incrementoMinimo: config.rpg.leilao.incrementoMinimo,
        maxAnuncios: config.rpg.leilao.maxAnunciosPorPersonagem,
        prorrogacaoMinutos: config.rpg.leilao.prorrogacaoMinutos,
      },
      abertos: abertos.map((l) => leilao.verLeilao(l, player)),
      meus: leilao.anunciosDe(player.id).map((l) => leilao.verLeilao(l, player)),
      lidero: abertos.filter((l) => l.compradorId === player.id).map((l) => leilao.verLeilao(l, player)),
      entregas: entregasDe(player.id).map((e) => ({ id: e.id, motivo: e.motivo, criadoEm: e.criadoEm, item: verItem(e.item) })),
      // O que dá para anunciar: equipamento fora de uso.
      vendaveis: player.rpg.inventario
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => item.slot && !estaEquipado(player, item.uid))
        .map(({ item, i }) => ({ ...verItem(item, i), referencia: precoDeReferencia(item), naLoja: precoDeCompra(item) })),
    })
  }),
)

leilaoRotas.post(
  '/leilao/anunciar',
  rota((req, res) => {
    const feito = leilao.anunciar(req.player, req.body ?? {})
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, {
      texto: `${feito.leilao.item.nome} está no leilão.`,
      leilao: leilao.verLeilao(feito.leilao, req.player),
    })
  }),
)

leilaoRotas.post(
  '/leilao/lance',
  rota((req, res) => {
    const feito = leilao.darLance(req.player, req.body?.id, req.body?.valor)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, {
      texto: feito.arremate
        ? `Arrematado por ${feito.lance.toLocaleString('pt-BR')} de gold!`
        : `Lance de ${feito.lance.toLocaleString('pt-BR')} de gold registrado. Você está na frente.`,
      arremate: feito.arremate,
    })
  }),
)

leilaoRotas.post(
  '/leilao/comprar',
  rota((req, res) => {
    const feito = leilao.darLance(req.player, req.body?.id, null, { compraJa: true })
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, { texto: `Comprado por ${feito.lance.toLocaleString('pt-BR')} de gold!`, arremate: true })
  }),
)

leilaoRotas.post(
  '/leilao/cancelar',
  rota((req, res) => {
    const feito = leilao.cancelar(req.player, req.body?.id)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, {
      texto:
        feito.onde === 'mochila'
          ? `Anúncio cancelado. ${feito.item.nome} voltou para a mochila.`
          : `Anúncio cancelado. A mochila está cheia: ${feito.item.nome} ficou em "Retirar".`,
    })
  }),
)

leilaoRotas.post(
  '/leilao/retirar',
  rota((req, res) => {
    const feito = retirar(req.player, req.body?.id)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, req.player, { texto: `${feito.item.nome} foi para a mochila.` })
  }),
)
