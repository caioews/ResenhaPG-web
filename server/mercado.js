/**
 * Negociação entre jogadores: um oferece um item ao outro por um preço.
 *
 * As ofertas vivem só em memória e vencem em `config.rpg.ofertaMinutos`.
 * Essa propriedade é herdada do bot e vale manter: **nada é retido**. O item
 * continua na mochila de quem vende, o gold continua com quem compra, e a
 * troca só acontece no instante do aceite. Se o servidor cair no meio,
 * ninguém perde item nem gold — no máximo a oferta precisa ser refeita.
 *
 * Oferta pendente que retém bens é fonte inesgotável de bug de contabilidade:
 * o servidor reinicia, e alguém fica sem o item e sem o gold.
 *
 * Guardamos só o `uid` do item, nunca uma cópia. É o que permite conferir no
 * aceite se a peça ainda está com quem ofereceu — ela pode ter sido vendida
 * na loja, equipada ou soltada nesse meio-tempo.
 */
import { randomUUID } from 'node:crypto'
import { config } from './config.js'

/** id da oferta -> oferta */
const ofertas = new Map()

/** Quantas ofertas um jogador pode ter de pé ao mesmo tempo. */
const MAX_POR_VENDEDOR = 10

const vencida = (o) => Date.now() > o.expiraEm

function limpar() {
  for (const [id, o] of ofertas) if (vencida(o)) ofertas.delete(id)
}

export const pegarOferta = (id) => {
  limpar()
  return ofertas.get(id) ?? null
}

export const apagarOferta = (id) => ofertas.delete(id)

/** As ofertas esperando a resposta deste personagem. */
export function ofertasPara(personagemId) {
  limpar()
  return [...ofertas.values()].filter((o) => o.compradorId === personagemId)
}

/** As ofertas que este personagem mandou e ainda não foram respondidas. */
export function ofertasDe(personagemId) {
  limpar()
  return [...ofertas.values()].filter((o) => o.vendedorId === personagemId)
}

export function criarOferta({ vendedor, comprador, item, preco }) {
  limpar()

  const minhas = ofertasDe(vendedor.id)
  if (minhas.length >= MAX_POR_VENDEDOR) {
    return { erro: `Você já tem ${MAX_POR_VENDEDOR} ofertas de pé. Espere ou cancele alguma.` }
  }
  if (minhas.some((o) => o.compradorId === comprador.id && o.itemUid === item.uid)) {
    return { erro: `Você já ofereceu ${item.nome} para ${comprador.name}. Espere a resposta.` }
  }

  const oferta = {
    id: randomUUID().slice(0, 8),
    vendedorId: vendedor.id,
    vendedorNome: vendedor.name,
    compradorId: comprador.id,
    compradorNome: comprador.name,
    itemUid: item.uid,
    // O nome fica guardado só para poder dizer "X não está mais com quem
    // ofereceu" quando a peça tiver sumido da mochila.
    itemNome: item.nome,
    preco,
    criadaEm: Date.now(),
    expiraEm: Date.now() + config.rpg.ofertaMinutos * 60_000,
  }

  ofertas.set(oferta.id, oferta)
  return { oferta }
}

/** Apaga tudo que envolve um personagem — usado quando ele é apagado. */
export function esquecerPersonagem(personagemId) {
  for (const [id, o] of ofertas) {
    if (o.vendedorId === personagemId || o.compradorId === personagemId) ofertas.delete(id)
  }
}
