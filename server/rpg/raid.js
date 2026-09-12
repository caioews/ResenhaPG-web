/**
 * Raids: varios jogadores contra um chefe grande demais para uma pessoa so.
 *
 * A sala fica na memoria e vence sozinha depois de alguns minutos. Nada e
 * cobrado de ninguem para entrar, entao um reinicio do bot no meio da
 * formacao nao custa nada — no maximo o pessoal chama de novo.
 *
 * A vida do chefe cresce com o tamanho do grupo (ver config.rpg.raid):
 * entrar mais gente ajuda porque o dano do chefe se espalha, sem virar
 * vitoria garantida por juntar meio grupo.
 */
import { config } from '../config.js'
import { darTitanita, sortearTitanita } from './ferreiro.js'
import { darFeitico, sortearFeitico } from './feiticos.js'
import { criarItem, tiposDaClasse } from './itens.js'
import { escalaDeNivel } from './monstros.js'

/** Os chefes de raid. Todos com muita vida — sozinho nao se vence nenhum. */
export const CHEFES = {
  devorador: {
    id: 'devorador',
    nome: 'Devorador de Mundos',
    emoji: '🐲',
    descricao: 'Uma fera antiga que engoliu reinos inteiros. Bate forte e aguenta mais ainda.',
    mult: { hp: 1.22, atq: 1.25, def: 1.2, agi: 0.9 },
    areaCada: 4, // solta o golpe em area a cada N rodadas
    areaMultiplicador: 0.7,
  },
  leviata: {
    id: 'leviata',
    nome: 'Leviatã das Profundezas',
    emoji: '🦑',
    descricao: 'Tentáculos por todo lado. Acerta o grupo inteiro com frequência.',
    mult: { hp: 1.14, atq: 1.14, def: 1.05, agi: 1.2 },
    areaCada: 3,
    areaMultiplicador: 0.8,
  },
  mae: {
    id: 'mae',
    nome: 'Mãe das Sombras',
    emoji: '🕷️',
    descricao: 'Rápida e venenosa. Escolhe um alvo por vez e não erra.',
    mult: { hp: 1.16, atq: 1.4, def: 1, agi: 1.5 },
    areaCada: 5,
    areaMultiplicador: 0.6,
  },
  soberano: {
    id: 'soberano',
    nome: 'Soberano dos Ossos',
    emoji: '⚰️',
    descricao: 'Couraça de osso e magia velha. Difícil de furar, difícil de derrubar.',
    mult: { hp: 1.33, atq: 1.15, def: 1.35, agi: 0.8 },
    areaCada: 5,
    areaMultiplicador: 0.75,
  },
  colosso: {
    id: 'colosso',
    nome: 'Colosso de Magma',
    emoji: '🌋',
    descricao: 'Lento, mas cada golpe derruba alguém. A rocha viva não cansa.',
    mult: { hp: 1.19, atq: 1.31, def: 1.1, agi: 0.55 },
    areaCada: 4,
    areaMultiplicador: 0.9,
  },
}

/**
 * Chefes do segundo escalao. Aparecem quando quem abre a sala ja passou de
 * config.rpg.raid.nivelParaChefesDuros. Sao mais duros em tudo: mais vida,
 * mais ataque e golpe em area mais frequente.
 */
export const CHEFES_DUROS = {
  tita: {
    id: 'tita',
    nome: 'Titã Primordial',
    emoji: '🗿',
    duro: true,
    descricao: 'Anterior às montanhas. Não corre, não recua, não cansa.',
    mult: { hp: 1.44, atq: 1.4, def: 1.6, agi: 0.7 },
    areaCada: 5,
    areaMultiplicador: 0.8,
  },
  hidra: {
    id: 'hidra',
    nome: 'Hidra de Mil Cabeças',
    emoji: '🐍',
    duro: true,
    descricao: 'Cada cabeça escolhe um alvo. Sempre sobra uma para você.',
    mult: { hp: 1.4, atq: 1.34, def: 1.35, agi: 1.25 },
    areaCada: 4,
    areaMultiplicador: 0.8,
  },
  tirano: {
    id: 'tirano',
    nome: 'Tirano do Vazio',
    emoji: '🌑',
    duro: true,
    descricao: 'Escolhe um por vez e não deixa ninguém de pé pelo caminho.',
    mult: { hp: 1.36, atq: 1.69, def: 1.35, agi: 1.4 },
    areaCada: 6,
    areaMultiplicador: 0.7,
  },
  fenix: {
    id: 'fenix',
    nome: 'Fênix Calcinante',
    emoji: '🔥',
    duro: true,
    descricao: 'Bate primeiro, bate rápido e queima o grupo inteiro.',
    mult: { hp: 1.32, atq: 1.51, def: 1.25, agi: 1.8 },
    areaCada: 4,
    areaMultiplicador: 0.85,
  },
  guardiao: {
    id: 'guardiao',
    nome: 'Guardião da Aurora',
    emoji: '☀️',
    duro: true,
    descricao: 'A última porta. Não tem fraqueza — só tem quem aguenta e quem não.',
    mult: { hp: 1.25, atq: 1.42, def: 1.55, agi: 1.2 },
    areaCada: 4,
    areaMultiplicador: 0.85,
  },
}

export const TODOS_OS_CHEFES = { ...CHEFES, ...CHEFES_DUROS }

export const NOMES_DE_CHEFE = Object.keys(CHEFES)
export const NOMES_DE_CHEFE_DURO = Object.keys(CHEFES_DUROS)

/** Qual pool vale para quem esta abrindo a sala. */
export const poolDeChefes = (nivelDoCriador) =>
  nivelDoCriador > config.rpg.raid.nivelParaChefesDuros ? NOMES_DE_CHEFE_DURO : NOMES_DE_CHEFE

/** Sorteia o chefe da sala a partir do nivel de quem abriu. */
export function sortearChefe(nivelDoCriador, sorte = Math.random) {
  const pool = poolDeChefes(nivelDoCriador)
  return pool[Math.floor(sorte() * pool.length)]
}

/** Pesos do drop de raid: nada de comum, e o topo escala de verdade. */
export const PESOS_DO_DROP = {
  incomum: 45,
  raro: 33,
  epico: 17,
  lendario: 5,
}

export function sortearRaridadeDeRaid(sorte = Math.random) {
  const total = Object.values(PESOS_DO_DROP).reduce((a, b) => a + b, 0)
  let ponto = sorte() * total

  for (const [raridade, peso] of Object.entries(PESOS_DO_DROP)) {
    ponto -= peso
    if (ponto <= 0) return raridade
  }
  return 'incomum'
}

/**
 * Monta o chefe para um grupo.
 * A vida cresce com o numero de jogadores elevado a config.rpg.raid.escalaPorJogador.
 */
export function criarChefeDeRaid(id, nivelMedio, jogadores) {
  const chefe = TODOS_OS_CHEFES[id]
  if (!chefe) return null

  const { hpBase, hpPorNivel, atqBase, atqPorNivel, defBase, defPorNivel, agiBase, agiPorNivel } =
    config.rpg.raid

  const escala = Math.pow(Math.max(1, jogadores), config.rpg.raid.escalaPorJogador)
  // A mesma escala de fim de jogo dos monstros: sem ela um grupo de nivel 60
  // com habilidade de especialidade passa por cima de qualquer chefe.
  const fim = escalaDeNivel(nivelMedio)

  return {
    id: chefe.id,
    nome: chefe.nome,
    emoji: chefe.emoji,
    descricao: chefe.descricao,
    duro: Boolean(chefe.duro),
    nivel: nivelMedio,
    hp: Math.round((hpBase + nivelMedio * hpPorNivel) * chefe.mult.hp * escala * fim.hp),
    atq: Math.round((atqBase + nivelMedio * atqPorNivel) * chefe.mult.atq * fim.atq),
    def: Math.round((defBase + nivelMedio * defPorNivel) * chefe.mult.def * fim.def),
    agi: Math.round((agiBase + nivelMedio * agiPorNivel) * chefe.mult.agi * fim.agi),
    // Grupo grande leva golpe em area com mais frequencia: sem isso, o dano
    // de alvo unico se dilui tanto que juntar muita gente vira vitoria certa.
    // O piso e 3 e nao 2: em 2 o chefe acertava o grupo inteiro em metade
    // das rodadas e chamar mais gente virava desvantagem — o Leviata caia
    // de 45% com 4 jogadores para 11% com 6, o oposto do que a raid quer.
    areaCada: Math.max(3, chefe.areaCada - Math.floor(jogadores / 6)),
    areaMultiplicador: chefe.areaMultiplicador,
  }
}

/** Itens que caem quando o grupo vence, um sorteio de dono por item. */
export function droparRecompensas(participantes, sorte = Math.random) {
  const quantidade = Math.max(
    config.rpg.raid.itensMinimos,
    Math.ceil(participantes.length * config.rpg.raid.itensPorJogador),
  )

  const drops = []
  for (let i = 0; i < quantidade; i++) {
    const dono = participantes[Math.floor(sorte() * participantes.length)]
    const tipos = tiposDaClasse(dono.player.rpg.classe)
    const tipo = tipos[Math.floor(sorte() * tipos.length)]

    // No nivel de quem recebe, para dar de equipar na hora.
    drops.push({ dono, item: criarItem(tipo, dono.player.rpg.nivel, sortearRaridadeDeRaid(sorte)) })
  }

  return drops
}

/**
 * Material que a raid larga alem do equipamento: titanita para todo mundo e
 * uma chance de feitico por participante. Raid e a fonte mais confiavel de
 * titanita de grau alto — e o que da motivo para juntar o grupo mesmo
 * quando ninguem precisa de arma nova.
 */
export function droparMateriais(participantes, nivel, sorte = Math.random) {
  const saida = []

  for (const p of participantes) {
    const titanita = sortearTitanita('raid', sorte)
    if (titanita) darTitanita(p.player, titanita.grau, titanita.quantidade)

    let feitico = null
    if (sorte() < config.rpg.feiticeiro.chanceDrop.raid) {
      feitico = sortearFeitico(nivel, sorte)
      if (feitico) darFeitico(p.player, feitico)
    }

    if (titanita || feitico) saida.push({ dono: p, titanita, feitico })
  }

  return saida
}

// --------------------------------------------------------------- salas

/** chat -> sala */
const salas = new Map()

export function criarSala(chatId, { criadorId, criadorJid, chefeId, player }) {
  const sala = {
    chatId,
    criadorId,
    chefeId,
    criadaEm: Date.now(),
    participantes: [{ id: criadorId, jid: criadorJid, player }],
  }

  salas.set(chatId, sala)
  return sala
}

export function pegarSala(chatId) {
  const sala = salas.get(chatId)
  if (!sala) return null

  if (Date.now() - sala.criadaEm > config.rpg.raid.salaMinutos * 60_000) {
    salas.delete(chatId)
    return null
  }

  return sala
}

export const fecharSala = (chatId) => salas.delete(chatId)

export function entrarNaSala(sala, { id, jid, player }) {
  if (sala.participantes.some((p) => p.id === id)) return false
  if (sala.participantes.length >= config.rpg.raid.maxJogadores) return false

  sala.participantes.push({ id, jid, player })
  return true
}

export function sairDaSala(sala, id) {
  const antes = sala.participantes.length
  sala.participantes = sala.participantes.filter((p) => p.id !== id)
  return sala.participantes.length < antes
}

export const nivelMedio = (sala) =>
  Math.max(
    1,
    Math.round(
      sala.participantes.reduce((soma, p) => soma + p.player.rpg.nivel, 0) / sala.participantes.length,
    ),
  )
