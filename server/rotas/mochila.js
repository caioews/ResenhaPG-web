/** A mochila: equipar, desequipar e soltar item. */
import { Router } from 'express'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import { desequipar, equipar, itemEquipado, removerItem } from '../rpg/jogador.js'
import { SLOTS } from '../rpg/itens.js'
import { verItem } from '../visao.js'
import * as store from '../store.js'

export const mochila = Router()

mochila.use(exigirLogin, exigirPersonagem, exigirClasse)

const acharPorUid = (player, uid) => player.rpg.inventario.find((it) => it.uid === uid) ?? null

mochila.post(
  '/equipar',
  rota((req, res) => {
    const player = req.player
    const item = acharPorUid(player, String(req.body?.uid ?? ''))
    if (!item) return res.status(404).json({ erro: 'Item não encontrado na mochila.' })

    const feito = equipar(player, item)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    responder(res, player, {
      texto: `${item.nome} equipado.`,
      anterior: feito.anterior ? verItem(feito.anterior) : null,
    })
  }),
)

mochila.post(
  '/desequipar',
  rota((req, res) => {
    const player = req.player
    const slot = String(req.body?.slot ?? '')
    if (!SLOTS.includes(slot)) return res.status(400).json({ erro: 'Slot inválido.' })

    const item = desequipar(player, slot)
    if (!item) return res.status(409).json({ erro: 'Não há nada nesse slot.' })

    responder(res, player, { texto: `${item.nome} guardado na mochila.` })
  }),
)

mochila.post(
  '/soltar',
  rota((req, res) => {
    const player = req.player
    const uid = String(req.body?.uid ?? '')
    const item = acharPorUid(player, uid)
    if (!item) return res.status(404).json({ erro: 'Item não encontrado na mochila.' })

    // Épico e lendário levam meses para cair: soltar exige confirmar o nome.
    const precioso = ['epico', 'lendario'].includes(item.raridade)
    if (precioso && !req.body?.confirmar) {
      return res.status(409).json({
        erro: `${item.nome} é ${item.raridade}. Confirme para soltar mesmo.`,
        precisaConfirmar: true,
      })
    }

    // Item equipado sai do slot junto; removerItem ja cuida disso.
    const estavaEquipado = Boolean(itemEquipado(player, item.slot)?.uid === item.uid)
    removerItem(player, uid)
    store.save()

    responder(res, player, {
      texto: `${item.nome} foi deixado para trás${estavaEquipado ? ' (estava equipado)' : ''}.`,
    })
  }),
)
