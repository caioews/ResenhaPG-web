/**
 * O baú: um depósito que não ocupa a mochila.
 *
 * A mochila é pequena de propósito — é ela que obriga a escolher o que
 * carregar e a vender o resto. O baú não mexe nisso: o que está guardado
 * está *fora de jogo*. Não pode ser equipado, vendido na loja, oferecido no
 * mercado nem anunciado no leilão, porque todos esses caminhos procuram o
 * item na mochila e não o encontram. Guardar é uma decisão de arrumação,
 * nunca um atalho para carregar mais.
 *
 * Os itens ficam na própria ficha (`rpg.bau.itens`), e não numa tabela
 * separada como os leilões: aqui nada é retido pelo servidor, é o mesmo
 * personagem segurando as mesmas peças — só que na outra mão.
 *
 * Os espaços são comprados um a um e cada um custa mais que o anterior
 * (ver `config.rpg.bau`). É de onde vem o segundo uso do baú: um ralo de
 * gold para quem já tem tudo o que a loja vende.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { darGold, estaEquipado, guardarItem, mochilaCheia, removerItem } from './jogador.js'

export const itensDoBau = (player) => player.rpg.bau.itens

/** Quantos espaços o baú tem: os de graça mais os comprados. */
export const espacosDoBau = (player) =>
  config.rpg.bau.espacos + (player.rpg.bau.espacosComprados ?? 0)

export const bauCheio = (player) => itensDoBau(player).length >= espacosDoBau(player)

/**
 * Quanto custa o próximo espaço. O primeiro sai pelo preço cheio, o segundo
 * pelo dobro, o terceiro pelo triplo — 50 mil, 100 mil, 150 mil.
 */
export const precoDoProximoEspaco = (player) =>
  config.rpg.bau.precoPorEspaco * ((player.rpg.bau.espacosComprados ?? 0) + 1)

/** Da mochila para o baú. */
export function guardarNoBau(player, uid) {
  const item = player.rpg.inventario.find((it) => it.uid === uid)
  if (!item) return { erro: 'Item não encontrado na mochila.' }

  // Guardar não desequipa sozinho: perder a arma sem ter pedido, e descobrir
  // isso na caçada seguinte, seria pior que o aviso.
  if (estaEquipado(player, uid)) {
    return { erro: `${item.nome} está equipado. Tire de uso antes de guardar.` }
  }
  if (bauCheio(player)) {
    return { erro: 'O baú está cheio. Retire alguma coisa ou compre mais um espaço.' }
  }

  // removerItem antes de empilhar: se alguma coisa falhar no meio, o pior
  // caso é o item perdido de um lado só — nunca o mesmo item nos dois.
  removerItem(player, uid)
  player.rpg.bau.itens.push(item)
  store.save()
  return { item }
}

/** Do baú para a mochila. */
export function retirarDoBau(player, uid) {
  const i = player.rpg.bau.itens.findIndex((it) => it.uid === uid)
  if (i < 0) return { erro: 'Esse item não está no baú.' }
  if (mochilaCheia(player)) {
    return { erro: 'Sua mochila está cheia. Abra espaço antes de retirar.' }
  }

  const [item] = player.rpg.bau.itens.splice(i, 1)
  guardarItem(player, item)
  store.save()
  return { item }
}

/** Compra mais um espaço, pelo preço do momento. */
export function comprarEspaco(player) {
  const preco = precoDoProximoEspaco(player)
  if (player.rpg.gold < preco) {
    const falta = (preco - player.rpg.gold).toLocaleString('pt-BR')
    return { erro: `Faltam ${falta} de gold para o próximo espaço.` }
  }

  darGold(player, -preco)
  player.rpg.bau.espacosComprados = (player.rpg.bau.espacosComprados ?? 0) + 1
  store.save()

  return { preco, espacos: espacosDoBau(player), proximoPreco: precoDoProximoEspaco(player) }
}
