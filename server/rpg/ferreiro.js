/**
 * O ferreiro: reforca equipamento do +1 ao +10 por gold e titanita.
 *
 * Titanita nao ocupa espaco na mochila — e um contador no perfil, como o
 * gold. Subir uma arma ao +10 consome 31 titanitas de quatro graus
 * diferentes; se cada uma fosse um item, o jogador passaria o jogo com a
 * mochila entupida de pedra.
 *
 * O grau exigido sobe junto com o reforco, entao o material do fim de jogo
 * (a Placa) so serve para o ultimo degrau e so cai de raid e do fundo do
 * Abismo. E o que faz o +10 ser um objetivo e nao uma formalidade.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { bonusFinal, ehEquipamento } from './itens.js'

/** Os quatro graus de titanita, do mais comum ao mais raro. */
export const TITANITAS = {
  estilhaco: { id: 'estilhaco', nome: 'Estilhaço de Titanita', emoji: '⬜', de: 1, ate: 3 },
  grande: { id: 'grande', nome: 'Titanita Grande', emoji: '🔷', de: 4, ate: 6 },
  pedaco: { id: 'pedaco', nome: 'Pedaço de Titanita', emoji: '🟦', de: 7, ate: 9 },
  placa: { id: 'placa', nome: 'Placa de Titanita', emoji: '🟨', de: 10, ate: 10 },
}

export const GRAUS = Object.keys(TITANITAS)

/** Qual grau leva um item de `reforco` para `reforco + 1`. */
export function grauPara(reforco) {
  const alvo = reforco + 1
  return GRAUS.find((id) => alvo <= TITANITAS[id].ate) ?? null
}

/** Aceita id, nome e pedaco do nome: "placa", "estilhaço", "grande". */
export function acharGrau(busca) {
  const limpo = (t) =>
    String(t ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const texto = limpo(busca)
  if (!texto) return null

  return (
    GRAUS.find((id) => limpo(id) === texto) ??
    GRAUS.find((id) => limpo(TITANITAS[id].nome) === texto) ??
    GRAUS.find((id) => limpo(TITANITAS[id].nome).includes(texto) && texto.length >= 4) ??
    null
  )
}

// ---------------------------------------------------------------- estoque

export const titanitas = (player) => player.rpg.titanitas ?? {}

export const quantasTitanitas = (player, grau) => titanitas(player)[grau] ?? 0

export function darTitanita(player, grau, quantidade = 1) {
  if (!TITANITAS[grau]) return 0
  player.rpg.titanitas[grau] = Math.max(0, (player.rpg.titanitas[grau] ?? 0) + quantidade)
  store.save()
  return player.rpg.titanitas[grau]
}

export const totalDeTitanitas = (player) => GRAUS.reduce((s, g) => s + quantasTitanitas(player, g), 0)

// ------------------------------------------------------------------ custo

/**
 * O que custa levar um item do reforco atual para o proximo.
 * Devolve null quando o item ja esta no maximo.
 */
export function custoDoReforco(item) {
  const f = config.rpg.ferreiro
  const atual = item.reforco ?? 0
  if (atual >= f.maxReforco) return null

  const grau = grauPara(atual)

  return {
    de: atual,
    para: atual + 1,
    grau,
    quantidade: f.titanitasPorReforco[atual] ?? f.titanitasPorReforco.at(-1),
    gold: Math.round(f.goldBase * item.nivel * Math.pow(atual + 1, f.goldExpoente)),
  }
}

/** O custo somado de levar o item do reforco atual ate o +10. */
export function custoAteOMaximo(item) {
  const total = { gold: 0, porGrau: {} }
  let espelho = { ...item, reforco: item.reforco ?? 0 }

  for (let i = espelho.reforco; i < config.rpg.ferreiro.maxReforco; i++) {
    const c = custoDoReforco(espelho)
    if (!c) break
    total.gold += c.gold
    total.porGrau[c.grau] = (total.porGrau[c.grau] ?? 0) + c.quantidade
    espelho = { ...espelho, reforco: c.para }
  }

  return total
}

/** Por que este item nao pode ser reforçado agora. null = pode. */
export function motivoParaNaoReforcar(player, item) {
  if (!ehEquipamento(item)) return { erro: 'naoEquipamento' }

  const custo = custoDoReforco(item)
  if (!custo) return { erro: 'noMaximo' }

  if (quantasTitanitas(player, custo.grau) < custo.quantidade) {
    return { erro: 'semTitanita', custo }
  }
  if (player.rpg.gold < custo.gold) return { erro: 'semGold', custo }

  return null
}

/**
 * Reforça o item. Cobra antes de aplicar, e nunca falha por sorte — o
 * ferreiro daqui nao quebra equipamento.
 */
export function reforcar(player, item) {
  const custo = custoDoReforco(item)
  if (!custo) return null

  const antes = { ...bonusFinal(item) }

  player.rpg.gold -= custo.gold
  player.rpg.titanitas[custo.grau] -= custo.quantidade
  item.reforco = custo.para
  store.save()

  return { custo, antes, depois: bonusFinal(item) }
}

// ------------------------------------------------------------------- drop

/**
 * Sorteia titanita para um encontro.
 *
 * A origem decide o grau: bicho comum larga estilhaço, chefe larga
 * titanita grande ou pedaço, raid e o fundo do Abismo largam placa. Sem
 * isso o jogador chegaria ao +10 moendo goblin.
 */
const GRAUS_POR_ORIGEM = {
  comum: [['estilhaco', 100]],
  elite: [['estilhaco', 75], ['grande', 25]],
  boss: [['estilhaco', 25], ['grande', 55], ['pedaco', 20]],
  raid: [['grande', 30], ['pedaco', 50], ['placa', 20]],
  abismo: [['grande', 35], ['pedaco', 45], ['placa', 20]],
}

export function sortearTitanita(origem, sorte = Math.random) {
  const f = config.rpg.ferreiro
  const chance = f.chanceDrop[origem] ?? 0
  if (sorte() >= chance) return null

  const tabela = GRAUS_POR_ORIGEM[origem] ?? GRAUS_POR_ORIGEM.comum
  const total = tabela.reduce((s, [, peso]) => s + peso, 0)
  let ponto = sorte() * total
  let grau = tabela[0][0]

  for (const [id, peso] of tabela) {
    ponto -= peso
    if (ponto <= 0) {
      grau = id
      break
    }
  }

  const { min, max } = f.quantidadeDrop
  const quantidade = min + Math.floor(sorte() * (max - min + 1))

  return { grau, quantidade }
}

/** Texto curto de um drop de titanita. */
export const descreverTitanita = (grau, quantidade = 1) =>
  `${TITANITAS[grau].emoji} ${quantidade}× ${TITANITAS[grau].nome}`
