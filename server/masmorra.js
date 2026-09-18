/**
 * Masmorra em grupo: o Abismo descido junto.
 *
 * De 2 a 4 jogadores (um por conta) montam um grupo numa sala; quem abriu
 * decide a hora de descer. A descida se resolve inteira de uma vez, como o
 * Abismo solo: cada andar é uma luta de grupo contra o habitante daquele
 * andar, com a vida multiplicada pelo tamanho do grupo. A vida de cada um
 * carrega de um andar para o outro (com o mesmo respiro e o mesmo piso do
 * Abismo), e quem cai fica caído até o fim. A descida termina quando o grupo
 * inteiro cai.
 *
 * Todo mundo recebe pelos andares que o GRUPO venceu — quem caiu cedo também
 * ajudou a chegar até ali.
 *
 * As salas vivem em memória, como as de raid: não cobram nada nem retêm nada,
 * então um reinício no meio da formação não custa coisa alguma.
 */
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import * as store from './store.js'
import { lutarEmGrupo } from './rpg/combate.js'
import { comoLutador } from './rpg/encontro.js'
import { criarHabitante, recompensaDaDescida, vidaEntreAndares } from './rpg/abismo.js'
import { atributos, darGold, feridoRestante, ferir, ganharXp } from './rpg/jogador.js'
import { emExpedicao } from './rpg/expedicao.js'
import { criarItem, tiposDaClasse } from './rpg/itens.js'
import { TITANITAS, darTitanita, sortearTitanita } from './rpg/ferreiro.js'
import { FEITICOS, darFeitico, sortearFeitico } from './rpg/feiticos.js'
import { xpComPrestigio } from './rpg/prestigio.js'
import { guardarOuEntregar } from './entregas.js'
import { nivelMedioDe } from './grupo.js'

const cfg = () => config.rpg.masmorra

// ================================================================== salas

/** id da sala -> sala */
const salas = new Map()

function limparSalas() {
  for (const [id, sala] of salas) if (Date.now() > sala.expiraEm) salas.delete(id)
}

export function salaDoJogador(personagemId) {
  limparSalas()
  for (const sala of salas.values()) if (sala.participantes.includes(personagemId)) return sala
  return null
}

export function listarSalas() {
  limparSalas()
  return [...salas.values()]
}

export const pegarSala = (id) => {
  limparSalas()
  return salas.get(id) ?? null
}

export const esperaDaMasmorra = (player) =>
  Math.max(0, (player.rpg.masmorra?.ultimaDescida ?? 0) + cfg().cooldownMinutos * 60_000 - Date.now())

/** O que impede alguém de abrir, entrar ou descer. */
export function impedimento(player) {
  if (!player.rpg.classe) return 'Esse personagem ainda não tem classe.'
  if (player.rpg.nivel < cfg().nivelMinimo) return `A masmorra abre no nível ${cfg().nivelMinimo}.`
  if (emExpedicao(player)) return 'Seu personagem está em expedição.'
  if (feridoRestante(player) > 0) return 'Você está ferido demais para descer.'
  const espera = esperaDaMasmorra(player)
  if (espera > 0) return `Você ainda se recupera da última descida (${Math.ceil(espera / 60_000)} min).`
  return null
}

export function abrirSala(player) {
  const sala = {
    id: randomUUID().slice(0, 8),
    liderId: player.id,
    liderNome: player.name,
    participantes: [player.id],
    criadaEm: Date.now(),
    expiraEm: Date.now() + cfg().salaMinutos * 60_000,
  }
  salas.set(sala.id, sala)
  return sala
}

export function entrarNaSala(sala, player) {
  if (sala.participantes.includes(player.id)) return { erro: 'Você já está nesse grupo.' }
  if (sala.participantes.length >= cfg().maxJogadores) return { erro: `O grupo já tem ${cfg().maxJogadores}.` }
  // Um por conta: senão dá para descer sozinho levando os próprios alts.
  const contas = sala.participantes.map((id) => store.buscarPersonagem(id)?.usuarioId)
  if (contas.includes(player.usuarioId)) return { erro: 'Já tem um personagem da sua conta nesse grupo.' }
  sala.participantes.push(player.id)
  return { sala }
}

export function sairDaSala(sala, personagemId) {
  sala.participantes = sala.participantes.filter((id) => id !== personagemId)
  // Líder saiu ou a sala esvaziou: fecha. Sem líder ninguém pode começar.
  const fechou = !sala.participantes.length || sala.liderId === personagemId
  if (fechou) salas.delete(sala.id)
  return { fechou }
}

export const fecharSala = (id) => salas.delete(id)

// ================================================================ descida

/** O habitante de um andar, com a vida escalada pelo tamanho do grupo. */
function inimigoDoAndar(nivelMedio, andar, jogadores) {
  const h = criarHabitante(nivelMedio, andar)
  return {
    nome: `${h.emoji} ${h.nome}`,
    emoji: h.emoji,
    nivel: h.nivel,
    andar,
    hp: Math.round(h.hp * jogadores * cfg().vidaPorJogador),
    atq: Math.round(h.atq * cfg().ataque),
    def: h.def,
    agi: h.agi,
    areaCada: cfg().areaCada,
    areaMultiplicador: cfg().areaMultiplicador,
  }
}

/**
 * O nível que a masmorra usa para o grupo: o meio do caminho entre a média e
 * o mais alto. Só a média deixava um nível 210 carregar três de nível 60 até
 * o andar 22 — e o espólio por andar cresce ao quadrado, então quem ia de
 * carona saía com XP de semanas.
 */
export function nivelDoGrupo(participantes) {
  const maior = Math.max(...participantes.map((p) => p.rpg.nivel))
  return Math.max(1, Math.round((nivelMedioDe(participantes) + maior) / 2))
}

/**
 * Desce a masmorra com o grupo inteiro. Grava tudo na ficha de cada um e
 * devolve o relato para a tela.
 */
export function descer(participantes) {
  const media = nivelDoGrupo(participantes)
  const n = participantes.length

  // Cada um entra inteiro; daqui em diante a vida é carregada andar a andar.
  const estado = participantes.map((p) => {
    const lutador = comoLutador(p, p.name)
    const maximo = atributos(p).hp
    return { player: p, lutador: { ...lutador, hp: maximo, hpMax: maximo }, caido: false }
  })

  const andares = []
  let vencidos = 0

  for (let andar = 1; andar <= config.rpg.abismo.maxAndares; andar++) {
    const dePe = estado.filter((e) => !e.caido)
    if (!dePe.length) break

    const inimigo = inimigoDoAndar(media, andar, n)
    const entraram = dePe.map((e) => ({ nome: e.player.name, hp: e.lutador.hp, hpMax: e.lutador.hpMax }))
    const luta = lutarEmGrupo(
      dePe.map((e) => e.lutador),
      inimigo,
    )

    // Atualiza cada um com o que sobrou da luta.
    luta.time.forEach((depois, i) => {
      const e = dePe[i]
      if (depois.caido || depois.hp <= 0) {
        e.caido = true
        e.lutador.hp = 0
      } else {
        e.lutador.hp = depois.hp
      }
    })

    andares.push({
      andar,
      inimigo: { nome: inimigo.nome, emoji: inimigo.emoji, nivel: inimigo.nivel, hpMax: inimigo.hp, areaCada: inimigo.areaCada },
      venceu: luta.venceu,
      rodadas: luta.rodadas,
      entraram,
      caidos: dePe.filter((e) => e.caido).map((e) => e.player.name),
      log: luta.log,
    })

    if (!luta.venceu) break
    vencidos++

    // O respiro entre andares, igual ao do Abismo, para quem ainda está de pé.
    for (const e of estado) {
      if (!e.caido) e.lutador.hp = vidaEntreAndares(e.lutador.hp, e.lutador.hpMax)
    }
  }

  const agora = Date.now()
  const porJogador = participantes.map((p) => {
    const ficha = p.rpg
    ficha.masmorra.ultimaDescida = agora
    ficha.masmorra.descidas++
    const recorde = vencidos > (ficha.masmorra.melhorAndar ?? 0)
    if (recorde) ficha.masmorra.melhorAndar = vencidos

    // A recompensa do Abismo no nível de cada um, numa fração: o grupo
    // desce mais fundo que o solo, e o prêmio por andar cresce ao quadrado.
    const premio = recompensaDaDescida(ficha.nivel, vencidos)
    const xp = xpComPrestigio(p, Math.round(premio.xp * cfg().recompensa))
    const gold = Math.round(premio.gold * cfg().recompensa)
    darGold(p, gold)
    const subiu = ganharXp(p, xp)

    const itens = []
    const tipos = tiposDaClasse(ficha.classe)
    for (const raridade of premio.raridades) {
      const tipo = tipos[Math.floor(Math.random() * tipos.length)]
      const item = criarItem(tipo, ficha.nivel, raridade)
      itens.push({ item, onde: guardarOuEntregar(p, item, 'Espólio da masmorra') })
    }

    let titanita = null
    let feitico = null
    if (vencidos > 0) {
      titanita = sortearTitanita('abismo')
      if (titanita) darTitanita(p, titanita.grau, titanita.quantidade)
      if (vencidos >= config.rpg.abismo.andaresPorFeitico && Math.random() < config.rpg.feiticeiro.chanceDrop.abismo) {
        feitico = sortearFeitico(Math.max(1, Math.round(ficha.nivel * 0.8)))
        if (feitico) darFeitico(p, feitico)
      }
    }

    // Sai da masmorra carregado: todo mundo termina caído, como no Abismo.
    ferir(p)

    return {
      player: p,
      xp,
      gold,
      subiu,
      recorde,
      itens,
      titanita: titanita ? { ...titanita, nome: TITANITAS[titanita.grau].nome } : null,
      feitico: feitico ? { id: feitico, nome: FEITICOS[feitico].nome, emoji: FEITICOS[feitico].emoji } : null,
    }
  })

  store.flush()

  return { nivelMedio: media, vencidos, andares, porJogador }
}

/** Ranking pelo andar mais fundo alcançado em grupo. */
export function ranking(limite = 20) {
  return store
    .allPlayers()
    .filter((p) => p.rpg.classe && (p.rpg.masmorra?.melhorAndar ?? 0) > 0)
    .sort((a, b) => b.rpg.masmorra.melhorAndar - a.rpg.masmorra.melhorAndar || b.rpg.nivel - a.rpg.nivel)
    .slice(0, limite)
}
