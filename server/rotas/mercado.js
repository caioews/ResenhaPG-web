/**
 * O mercado: oferecer item a outro jogador, aceitar oferta e transferir gold.
 *
 * A loja compra por 70% e vende por 150% do valor de referência. É essa
 * margem que faz este arquivo existir: vender para outra pessoa quase sempre
 * rende mais do que despachar na loja. E como 40% dos drops caem fora da sua
 * classe, o Mago que recebe um arco tem motivo para procurar o Arqueiro.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import * as store from '../store.js'
import * as mercado from '../mercado.js'
import { classePodeUsar } from '../rpg/classes.js'
import { nomeCompleto, precoDeReferencia } from '../rpg/itens.js'
import { precoDeCompra } from '../rpg/loja.js'
import {
  darGold,
  estaEquipado,
  guardarItem,
  mochilaCheia,
  removerItem,
} from '../rpg/jogador.js'
import { verItem, verResumo } from '../visao.js'
import { emitirPara } from '../realtime.js'

export const mercadoRotas = Router()

mercadoRotas.use(exigirLogin, exigirPersonagem, exigirClasse)

/**
 * Uma oferta descrita para a interface.
 *
 * O item é lido da mochila do vendedor na hora, não de uma cópia guardada:
 * assim a tela já mostra "não está mais disponível" antes de alguém tentar
 * aceitar algo que sumiu.
 */
function verOferta(oferta, quemVe) {
  const vendedor = store.buscarPersonagem(oferta.vendedorId)
  const item = vendedor?.rpg.inventario.find((i) => i.uid === oferta.itemUid) ?? null

  return {
    id: oferta.id,
    preco: oferta.preco,
    presente: oferta.preco === 0,
    expiraEm: oferta.expiraEm,
    vendedor: { id: oferta.vendedorId, nome: oferta.vendedorNome },
    comprador: { id: oferta.compradorId, nome: oferta.compradorNome },
    item: item ? verItem(item) : null,
    itemNome: oferta.itemNome,
    disponivel: Boolean(item) && !estaEquipado(vendedor, oferta.itemUid),
    // Serve na tela de quem recebe: dá para equipar isso?
    usavel: item?.slot ? classePodeUsar(quemVe.rpg.classe, item.tipo) : true,
    // A referência ajuda a julgar se o preço é justo.
    referencia: item?.slot ? precoDeReferencia(item) : 0,
    naLoja: item?.slot ? precoDeCompra(item) : 0,
  }
}

mercadoRotas.get(
  '/mercado',
  rota((req, res) => {
    const player = req.player

    res.json({
      ofertaMinutos: config.rpg.ofertaMinutos,
      gold: player.rpg.gold,
      recebidas: mercado.ofertasPara(player.id).map((o) => verOferta(o, player)),
      enviadas: mercado.ofertasDe(player.id).map((o) => verOferta(o, player)),

      // O que você pode oferecer: equipamento na mochila que não está em uso.
      // Consumível não entra — poção não vale o atrito de uma negociação.
      meusItens: player.rpg.inventario
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => item.slot && !estaEquipado(player, item.uid))
        .map(({ item, i }) => ({
          ...verItem(item, i),
          referencia: precoDeReferencia(item),
          naLoja: precoDeCompra(item),
        })),

      // Todo personagem com classe pode receber uma oferta, esteja on-line ou
      // não — ela fica de pé alguns minutos esperando resposta.
      jogadores: store
        .allPlayers()
        .filter((p) => p.id !== player.id && p.rpg.classe)
        .sort((a, b) => b.rpg.nivel - a.rpg.nivel)
        .map(verResumo),
    })
  }),
)

mercadoRotas.post(
  '/mercado/oferecer',
  rota((req, res) => {
    const player = req.player
    const alvo = store.buscarPersonagem(String(req.body?.alvo ?? ''))
    const item = player.rpg.inventario.find((i) => i.uid === String(req.body?.uid ?? ''))
    const preco = Math.max(0, Math.floor(Number(req.body?.preco ?? 0)) || 0)

    if (!alvo) return res.status(404).json({ erro: 'Esse jogador não existe.' })
    if (alvo.id === player.id) return res.status(400).json({ erro: 'Vender para si mesmo não move nada.' })
    if (!alvo.rpg.classe) return res.status(409).json({ erro: 'Esse personagem ainda não tem classe.' })
    if (!item) return res.status(404).json({ erro: 'Item não encontrado na mochila.' })
    if (!item.slot) return res.status(409).json({ erro: 'Consumível não entra em negociação.' })
    if (estaEquipado(player, item.uid)) {
      return res.status(409).json({ erro: `${item.nome} está equipado. Tire de uso antes de oferecer.` })
    }

    const feito = mercado.criarOferta({ vendedor: player, comprador: alvo, item, preco })
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    emitirPara(alvo.id, 'mercado:oferta', { oferta: verOferta(feito.oferta, alvo) })

    res.json({
      oferta: verOferta(feito.oferta, player),
      texto:
        preco === 0
          ? `${nomeCompleto(item)} oferecido de presente a ${alvo.name}.`
          : `${nomeCompleto(item)} oferecido a ${alvo.name} por ${preco} de gold.`,
    })
  }),
)

mercadoRotas.post(
  '/mercado/responder',
  rota((req, res) => {
    const comprador = req.player
    const oferta = mercado.pegarOferta(String(req.body?.id ?? ''))

    if (!oferta) return res.status(404).json({ erro: 'Essa oferta venceu ou não existe.' })

    // Quem manda pode cancelar; quem recebe pode aceitar ou recusar.
    const souOComprador = oferta.compradorId === comprador.id
    const souOVendedor = oferta.vendedorId === comprador.id
    if (!souOComprador && !souOVendedor) {
      return res.status(403).json({ erro: 'Essa oferta não é sua.' })
    }

    if (!req.body?.aceitar) {
      mercado.apagarOferta(oferta.id)
      const outro = souOComprador ? oferta.vendedorId : oferta.compradorId
      emitirPara(outro, 'mercado:resposta', {
        oferta: { id: oferta.id, itemNome: oferta.itemNome },
        aceitou: false,
        cancelada: souOVendedor,
        quem: comprador.name,
      })
      return res.json({ recusada: true, cancelada: souOVendedor })
    }

    if (!souOComprador) {
      return res.status(403).json({ erro: 'Só quem recebeu a oferta pode aceitar.' })
    }

    const vendedor = store.buscarPersonagem(oferta.vendedorId)
    if (!vendedor) {
      mercado.apagarOferta(oferta.id)
      return res.status(404).json({ erro: 'Quem ofereceu não está mais disponível.' })
    }

    // O item pode ter sido vendido, equipado ou soltado entre a oferta e o
    // aceite — por isso a oferta guarda o uid, e não uma cópia da peça.
    const item = vendedor.rpg.inventario.find((i) => i.uid === oferta.itemUid)
    if (!item) {
      mercado.apagarOferta(oferta.id)
      return res.status(409).json({ erro: `${oferta.itemNome} não está mais com quem ofereceu.` })
    }
    if (estaEquipado(vendedor, item.uid)) {
      return res.status(409).json({ erro: `${item.nome} foi equipado por quem ofereceu.` })
    }
    if (comprador.rpg.gold < oferta.preco) {
      return res.status(409).json({
        erro: `A oferta é de ${oferta.preco} de gold e você tem ${comprador.rpg.gold}.`,
      })
    }
    if (mochilaCheia(comprador)) {
      return res.status(409).json({ erro: 'Sua mochila está cheia. Abra espaço antes de aceitar.' })
    }

    // A troca inteira num só ponto: item sai de um, entra no outro, gold no
    // sentido contrário. Nada foi retido até aqui.
    removerItem(vendedor, item.uid)
    guardarItem(comprador, item)
    if (oferta.preco > 0) {
      darGold(comprador, -oferta.preco)
      darGold(vendedor, oferta.preco)
    }
    mercado.apagarOferta(oferta.id)
    store.flush()

    const negocio = {
      item: verItem(item),
      preco: oferta.preco,
      vendedor: verResumo(vendedor),
      comprador: verResumo(comprador),
    }

    emitirPara(vendedor.id, 'mercado:resposta', {
      oferta: { id: oferta.id, itemNome: oferta.itemNome },
      aceitou: true,
      quem: comprador.name,
      negocio,
    })

    responder(res, comprador, {
      negocio,
      texto:
        oferta.preco === 0
          ? `${nomeCompleto(item)} é seu — presente de ${vendedor.name}.`
          : `${nomeCompleto(item)} é seu por ${oferta.preco} de gold.`,
    })
  }),
)

mercadoRotas.post(
  '/mercado/pagar',
  rota((req, res) => {
    const player = req.player
    const alvo = store.buscarPersonagem(String(req.body?.alvo ?? ''))
    const quanto = Math.floor(Number(req.body?.quanto ?? 0)) || 0

    if (!alvo) return res.status(404).json({ erro: 'Esse jogador não existe.' })
    if (alvo.id === player.id) return res.status(400).json({ erro: 'Pagar a si mesmo não muda nada.' })
    if (quanto <= 0) return res.status(400).json({ erro: 'Diga quanto pagar.' })
    if (player.rpg.gold < quanto) {
      return res.status(409).json({ erro: `Você tem ${player.rpg.gold} de gold e quis pagar ${quanto}.` })
    }

    // Gold recebido nunca é indesejado, então a transferência é direta — sem
    // aceite, diferente de um item, que ocupa espaço na mochila de quem ganha.
    darGold(player, -quanto)
    darGold(alvo, quanto)
    store.flush()

    emitirPara(alvo.id, 'mercado:pagamento', { de: player.name, quanto })

    responder(res, player, { texto: `${quanto} de gold enviados para ${alvo.name}.` })
  }),
)
