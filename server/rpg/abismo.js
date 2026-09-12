/**
 * O Abismo: o fim de jogo.
 *
 * O personagem desce enfrentando um chefe por andar, sem parar e sem cura
 * cheia — so um respiro entre um andar e outro. Cada andar vem mais forte
 * que o anterior, entao a descida sempre termina em morte; a graca e ver
 * ate onde da. A recompensa sai proporcional ao que se aguentou.
 *
 * A descida inteira e resolvida de uma vez, como a raid: nada de estado
 * pendurado esperando o jogador digitar de novo. O que fica guardado no
 * perfil e so o recorde e a hora da ultima descida.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { lutar } from './combate.js'
import { comoLutador, efeitosDe } from './encontro.js'
import { darTitanita, sortearTitanita } from './ferreiro.js'
import { darFeitico, sortearFeitico } from './feiticos.js'
import { RARIDADES, criarItem, tiposDaClasse } from './itens.js'
import { atributos, darGold, definirVida, ferir, ganharXp, guardarItem, mochilaCheia } from './jogador.js'
import { atributosDeMonstro } from './monstros.js'

const ORDEM_RARIDADE = ['comum', 'incomum', 'raro', 'epico', 'lendario']

/**
 * Os moradores do Abismo. Ciclam conforme a descida: quem chega fundo
 * reencontra os mesmos nomes, so que muito mais fortes.
 *
 * Os multiplicadores ficam perto de 1: o andar 1 e um monstro comum do
 * nivel do jogador. Quem transforma isso em chefe la pela metade da
 * descida e a forcaPorAndar, que acumula. Comecar ja em chefe fazia
 * ninguem passar do terceiro andar.
 */
export const HABITANTES = [
  { nome: 'Sentinela de Ossos', emoji: '💀', mult: { hp: 0.9, atq: 1, def: 1, agi: 1.1 } },
  { nome: 'Carrasco Cego', emoji: '🪓', mult: { hp: 1, atq: 1.15, def: 0.85, agi: 0.9 } },
  { nome: 'Coisa Sem Nome', emoji: '🫧', mult: { hp: 1.15, atq: 0.95, def: 1.05, agi: 1 } },
  { nome: 'Vigia do Poço', emoji: '👁️', mult: { hp: 0.8, atq: 1.05, def: 0.9, agi: 1.5 } },
  { nome: 'Fera Acorrentada', emoji: '⛓️', mult: { hp: 1.25, atq: 1.05, def: 0.95, agi: 0.8 } },
  { nome: 'Eco do Rei Morto', emoji: '👑', mult: { hp: 0.95, atq: 1.1, def: 1.1, agi: 1.2 } },
  { nome: 'Devorador de Luz', emoji: '🕳️', mult: { hp: 1.05, atq: 1.2, def: 1, agi: 1.3 } },
]

/** Nomes que o andar ganha conforme fica fundo. */
const PROFUNDIDADES = [
  { ate: 3, nome: 'Boca do Abismo' },
  { ate: 7, nome: 'Galerias' },
  { ate: 12, nome: 'Fossa' },
  { ate: 18, nome: 'Raiz do Mundo' },
  { ate: 25, nome: 'Silêncio' },
  { ate: Infinity, nome: 'Fundo' },
]

export const nomeDaProfundidade = (andar) => PROFUNDIDADES.find((p) => andar <= p.ate).nome

/** O chefe de um andar, para um jogador de determinado nivel. */
export function criarHabitante(nivelJogador, andar) {
  const a = config.rpg.abismo
  const habitante = HABITANTES[(andar - 1) % HABITANTES.length]
  // O nivel do andar e uma fracao do nivel do jogador, nao um degrau fixo:
  // "dez niveis abaixo" vale muito mais para quem e nivel 45 do que para
  // quem e 100, e a descida ficava com profundidades incomparaveis.
  const fracao = a.fracaoInicial + (andar - 1) * a.fracaoPorAndar
  const nivel = Math.max(1, Math.round(nivelJogador * fracao))

  // Alem de subir de nivel, cada andar aperta os multiplicadores. E o que
  // garante que a descida termine: em algum ponto o andar passa do jogador.
  const forca = 1 + (andar - 1) * a.forcaPorAndar
  const mult = {
    hp: habitante.mult.hp * forca,
    atq: habitante.mult.atq * forca,
    def: habitante.mult.def * forca,
    agi: habitante.mult.agi,
  }

  const volta = Math.floor((andar - 1) / HABITANTES.length)
  const sufixo = volta > 0 ? ` ${'★'.repeat(Math.min(3, volta))}` : ''

  return {
    nome: `${habitante.nome}${sufixo}`,
    emoji: habitante.emoji,
    nivel,
    andar,
    ...atributosDeMonstro(nivel, mult),
  }
}

/**
 * Com quanta vida se entra no proximo andar.
 *
 * Um respiro fixo mais um piso: ninguem comeca um andar abaixo de
 * pisoDeVida do maximo. Sem o piso a descida acabava por sangramento em
 * dois ou tres andares — e pior, acabava mais cedo para as classes de
 * corpo mole, que perdiam metade da vida em cada luta ganha. Com o piso, o
 * que encerra a descida e a rampa de dificuldade alcancar o personagem,
 * que e o que a gente quer medir.
 */
export function vidaEntreAndares(hpAtual, maximo) {
  const a = config.rpg.abismo
  const comRespiro = hpAtual + maximo * a.curaPorAndar
  return Math.min(maximo, Math.round(Math.max(comRespiro, maximo * a.pisoDeVida)))
}

/**
 * Melhor de N sorteios de raridade — quanto mais fundo, mais tentativas.
 * O piso e incomum: quem desceu o Abismo nao volta com item comum.
 */
function sortearRaridadeDoAbismo(andar, sorte) {
  const tentativas = 1 + Math.floor(andar / 5)
  let melhor = 1

  for (let i = 0; i < tentativas; i++) {
    const total = ORDEM_RARIDADE.reduce((s, r) => s + RARIDADES[r].peso, 0)
    let ponto = sorte() * total
    let escolhido = 0

    for (let j = 0; j < ORDEM_RARIDADE.length; j++) {
      ponto -= RARIDADES[ORDEM_RARIDADE[j]].peso
      if (ponto <= 0) {
        escolhido = j
        break
      }
    }
    if (escolhido > melhor) melhor = escolhido
  }

  return ORDEM_RARIDADE[melhor]
}

/** O que a descida rendeu. Andar 0 (morreu no primeiro) nao paga nada. */
export function recompensaDaDescida(nivel, andares, sorte = Math.random) {
  const a = config.rpg.abismo
  const fator = 1 + nivel * 0.03

  let xp = 0
  let gold = 0
  for (let i = 1; i <= andares; i++) {
    xp += (a.xpPorAndar + a.xpPorAndarAoQuadrado * (i - 1)) * fator
    gold += (a.goldPorAndar + a.goldPorAndarAoQuadrado * (i - 1)) * fator
  }

  const quantidade = andares > 0 ? Math.min(a.maxItens, Math.max(1, Math.floor(andares / a.andaresPorItem))) : 0

  return {
    xp: Math.round(xp),
    gold: Math.round(gold),
    quantidade,
    raridades: Array.from({ length: quantidade }, () => sortearRaridadeDoAbismo(andares, sorte)),
  }
}

/**
 * Desce o Abismo inteiro.
 *
 * Nao formata mensagem nem cobra cooldown — isso e do comando. Aqui so
 * acontece a descida, o premio e a gravacao.
 */
export function descer(player, sorte = Math.random) {
  const a = config.rpg.abismo
  const maximo = atributos(player).hp
  const hab = efeitosDe(player)

  const eu = comoLutador(player, player.name || 'Você')
  eu.hp = maximo // entra inteiro: o Abismo ja e duro o bastante

  const andares = []
  let vencidos = 0

  for (let andar = 1; andar <= a.maxAndares; andar++) {
    const inimigo = criarHabitante(player.rpg.nivel, andar)
    const luta = lutar(
      { ...eu, hp: eu.hp, hpMax: maximo },
      { nome: `${inimigo.emoji} ${inimigo.nome}`, nivel: inimigo.nivel, atq: inimigo.atq, def: inimigo.def, agi: inimigo.agi, hp: inimigo.hp },
      sorte,
    )

    const venceu = luta.vencedor === 'a'
    andares.push({ andar, inimigo, venceu, hpFinal: luta.hpA, hpMax: maximo, rodadas: luta.rodadas, luta })

    if (!venceu) break

    vencidos++
    eu.hp = vidaEntreAndares(luta.hpA, maximo)
  }

  const premio = recompensaDaDescida(player.rpg.nivel, vencidos, sorte)
  const ficha = player.rpg

  ficha.abismo.descidas++
  ficha.abismo.ultimaDescida = Date.now()
  ficha.abismo.andaresTotais += vencidos
  const recorde = vencidos > ficha.abismo.melhorAndar
  if (recorde) ficha.abismo.melhorAndar = vencidos

  const itens = []
  const materiais = { titanitas: [], feiticos: [] }

  if (vencidos > 0) {
    darGold(player, Math.round(premio.gold * (1 + (hab.saqueGold ?? 0))))

    // O Abismo e a melhor fonte de feitiço do jogo: um sorteio a cada
    // andaresPorFeitico andares vencidos, com os mais fortes so aparecendo
    // para quem desce fundo (o nivel do sorteio e o do andar alcancado).
    const nivelDoFundo = criarHabitante(ficha.nivel, vencidos).nivel

    for (let i = 0; i < Math.max(1, Math.floor(vencidos / a.andaresPorItem)); i++) {
      const titanita = sortearTitanita('abismo', sorte)
      if (titanita) {
        darTitanita(player, titanita.grau, titanita.quantidade)
        materiais.titanitas.push(titanita)
      }
    }

    for (let i = 0; i < Math.max(1, Math.floor(vencidos / a.andaresPorFeitico)); i++) {
      if (sorte() >= config.rpg.feiticeiro.chanceDrop.abismo) continue
      const id = sortearFeitico(nivelDoFundo, sorte)
      if (id) {
        darFeitico(player, id)
        materiais.feiticos.push(id)
      }
    }

    const tipos = tiposDaClasse(ficha.classe)
    for (const raridade of premio.raridades) {
      const tipo = tipos[Math.floor(sorte() * tipos.length)]
      const item = criarItem(tipo, ficha.nivel, raridade)
      const coube = !mochilaCheia(player)
      if (coube) guardarItem(player, item)
      itens.push({ item, perdido: !coube })
    }
  }

  // Sai do Abismo carregado nos bracos: ferido, como qualquer derrota.
  ferir(player)
  const subiu = ganharXp(player, premio.xp)
  store.save()

  return { andares, vencidos, recorde, premio, itens, materiais, subiu, hpMax: maximo }
}

/** Quanto falta para poder descer de novo. 0 = liberado. */
export const esperaDoAbismo = (player) =>
  Math.max(0, (player.rpg.abismo?.ultimaDescida ?? 0) + config.rpg.abismo.cooldownMinutos * 60_000 - Date.now())

/** Ranking pelo andar mais fundo que cada um alcancou. */
export function ranking(limite = 10) {
  return store
    .allPlayers()
    .filter((p) => (p.rpg?.abismo?.melhorAndar ?? 0) > 0)
    .sort((a, b) => b.rpg.abismo.melhorAndar - a.rpg.abismo.melhorAndar || b.rpg.nivel - a.rpg.nivel)
    .slice(0, limite)
}
