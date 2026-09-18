/**
 * Entregas: itens esperando o dono ir buscar.
 *
 * Quando um item precisa chegar a alguém e a mochila está cheia — arremate
 * de leilão, anúncio que venceu sem lance, prêmio do chefe mundial — ele não
 * se perde: fica aqui, no banco, até a pessoa abrir espaço e retirar.
 */
import { db } from './db.js'
import { guardarItem, mochilaCheia } from './rpg/jogador.js'

const inserir = db.prepare('INSERT INTO entregas (personagem_id, item, motivo, criado_em) VALUES (?, ?, ?, ?)')
const listar = db.prepare('SELECT * FROM entregas WHERE personagem_id = ? ORDER BY id')
const buscar = db.prepare('SELECT * FROM entregas WHERE id = ? AND personagem_id = ?')
const apagar = db.prepare('DELETE FROM entregas WHERE id = ?')

export function entregar(personagemId, item, motivo) {
  inserir.run(personagemId, JSON.stringify(item), motivo, Date.now())
}

export const entregasDe = (personagemId) =>
  listar.all(personagemId).map((linha) => ({
    id: linha.id,
    item: JSON.parse(linha.item),
    motivo: linha.motivo,
    criadoEm: linha.criado_em,
  }))

export const quantasEntregas = (personagemId) => listar.all(personagemId).length

/**
 * Põe o item na mochila, ou nas entregas se ela estiver cheia.
 * @returns 'mochila' | 'entregas'
 */
export function guardarOuEntregar(player, item, motivo) {
  if (!mochilaCheia(player) && guardarItem(player, item)) return 'mochila'
  entregar(player.id, item, motivo)
  return 'entregas'
}

/** Leva uma entrega para a mochila. */
export function retirar(player, id) {
  const linha = buscar.get(Number(id), player.id)
  if (!linha) return { erro: 'Essa entrega não existe ou já foi retirada.' }
  if (mochilaCheia(player)) return { erro: 'Sua mochila está cheia. Abra espaço antes de retirar.' }

  const item = JSON.parse(linha.item)
  // Apaga antes de guardar: se algo der errado no meio, o pior caso é o item
  // na mochila e a linha já sem uso — nunca o item em dois lugares.
  apagar.run(linha.id)
  guardarItem(player, item)
  return { item }
}
