/**
 * A loja do bot: poções, bandagem, um equipamento básico e uma oferta especial
 * sorteada de tempos em tempos.
 *
 * A loja compra barato e vende caro de propósito. É essa diferença que faz a
 * negociação entre jogadores valer a pena: vender para outra pessoa quase
 * sempre rende mais do que despachar na loja.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { criarItem, precoDeReferencia, tiposDaClasse } from './itens.js'

export const POCAO_PEQUENA = { tipo: 'pocao', nome: 'Poção Pequena', emoji: '🧪', cura: 0.4 }
export const POCAO_GRANDE = { tipo: 'pocao', nome: 'Poção Grande', emoji: '⚗️', cura: 1 }
export const BANDAGEM = { tipo: 'bandagem', nome: 'Bandagem', emoji: '🩹', tiraFerimento: true }

/**
 * Pesos da raridade na oferta especial — quanto mais raro, mais difícil.
 * São mais generosos que os do drop comum: a oferta é o lugar onde vale a
 * pena juntar gold e esperar algo bom aparecer.
 */
export const PESOS_DA_OFERTA = {
  comum: 30,
  incomum: 33,
  raro: 24,
  epico: 10,
  lendario: 3,
}

const novoUid = () => Math.random().toString(36).slice(2, 8)

const consumivel = (modelo) => ({ uid: novoUid(), slot: null, ...modelo })

/** Quanto a loja PAGA por um item do jogador. */
export const precoDeCompra = (item) =>
  Math.max(5, Math.round(precoDeReferencia(item) * config.rpg.lojaFracaoDeCompra))

/** Quanto a loja COBRA por um item da oferta especial. */
export const precoDeVenda = (item) =>
  Math.max(20, Math.round(precoDeReferencia(item) * config.rpg.lojaMultiplicadorDeVenda))

export function sortearRaridadeDaOferta(sorte = Math.random) {
  const total = Object.values(PESOS_DA_OFERTA).reduce((a, b) => a + b, 0)
  let ponto = sorte() * total

  for (const [raridade, peso] of Object.entries(PESOS_DA_OFERTA)) {
    ponto -= peso
    if (ponto <= 0) return raridade
  }
  return 'comum'
}

/**
 * A oferta especial do jogador. Fica de pé por um tempo e só então é
 * sorteada de novo — senão bastava abrir a loja repetidas vezes até
 * aparecer um lendário.
 */
export function ofertaEspecial(player, sorte = Math.random) {
  const guardada = player.rpg.lojaOferta

  if (guardada?.expiraEm > Date.now()) return guardada

  const expiraEm = Date.now() + config.rpg.lojaOfertaMinutos * 60_000

  // Nem toda rodada tem oferta: às vezes a prateleira fica vazia mesmo.
  if (sorte() >= config.rpg.lojaChanceDeOferta) {
    player.rpg.lojaOferta = { item: null, expiraEm }
    store.save()
    return player.rpg.lojaOferta
  }

  const tipos = tiposDaClasse(player.rpg.classe)
  const tipo = tipos[Math.floor(sorte() * tipos.length)]
  const item = criarItem(tipo, player.rpg.nivel, sortearRaridadeDaOferta(sorte))

  player.rpg.lojaOferta = { item, expiraEm }
  store.save()
  return player.rpg.lojaOferta
}

export function limparOferta(player) {
  player.rpg.lojaOferta = { item: null, expiraEm: player.rpg.lojaOferta?.expiraEm ?? 0 }
  store.save()
}

/**
 * A prateleira depende do jogador: o equipamento básico sai no nível e na
 * classe dele, para quem cai no grupo sem nada ter por onde começar.
 */
export function prateleira(player) {
  const nivel = player.rpg.nivel
  const itens = [
    {
      id: 1,
      nome: `${POCAO_PEQUENA.emoji} ${POCAO_PEQUENA.nome}`,
      descricao: 'Recupera 40% da vida',
      preco: config.rpg.precoPocaoPequena,
      criar: () => consumivel(POCAO_PEQUENA),
    },
    {
      id: 2,
      nome: `${POCAO_GRANDE.emoji} ${POCAO_GRANDE.nome}`,
      descricao: 'Recupera toda a vida',
      preco: config.rpg.precoPocaoGrande,
      criar: () => consumivel(POCAO_GRANDE),
    },
    {
      id: 3,
      nome: `${BANDAGEM.emoji} ${BANDAGEM.nome}`,
      descricao: 'Tira o estado ferido na hora',
      preco: config.rpg.precoBandagem,
      criar: () => consumivel(BANDAGEM),
    },
    {
      id: 4,
      nome: `⚒️ Equipamento básico (nível ${nivel})`,
      descricao: 'Uma peça comum sorteada entre as que sua classe usa',
      preco: config.rpg.precoEquipamentoPorNivel * nivel,
      criar: () => {
        const tipos = tiposDaClasse(player.rpg.classe)
        const tipo = tipos[Math.floor(Math.random() * tipos.length)]
        return criarItem(tipo, nivel, 'comum')
      },
    },
  ]

  const oferta = ofertaEspecial(player)
  if (oferta.item) {
    itens.push({
      id: 5,
      especial: true,
      item: oferta.item,
      expiraEm: oferta.expiraEm,
      nome: null, // o comando monta com o nome completo do item
      descricao: 'Oferta do dia',
      preco: precoDeVenda(oferta.item),
      criar: () => oferta.item,
    })
  }

  return itens
}

export const itemDaLoja = (player, id) => prateleira(player).find((i) => i.id === Number(id)) ?? null
