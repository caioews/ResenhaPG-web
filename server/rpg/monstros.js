/** Bestiario: monstros comuns, elites e os bosses dos marcos de nivel. */
import { config } from '../config.js'

/**
 * Cada especie multiplica os atributos de um monstro do nivel dela.
 * Slime aguenta e bate fraco; fantasma bate forte e desvia; golem e uma parede.
 *
 * `desde` e o nivel de jogador a partir do qual a especie comeca a aparecer.
 * As de fim de jogo so entram depois do limiar de escala: um Slime nivel 70
 * nao assusta ninguem, e o bestiario precisava crescer junto com o jogador.
 */
export const ESPECIES = [
  { id: 'slime', nome: 'Slime', emoji: '🟢', mult: { hp: 1.2, atq: 0.7, def: 0.8, agi: 0.6 } },
  { id: 'goblin', nome: 'Goblin', emoji: '👺', mult: { hp: 0.9, atq: 1.0, def: 0.8, agi: 1.2 } },
  { id: 'lobo', nome: 'Lobo', emoji: '🐺', mult: { hp: 0.9, atq: 1.1, def: 0.7, agi: 1.4 } },
  { id: 'esqueleto', nome: 'Esqueleto', emoji: '💀', mult: { hp: 0.85, atq: 1.05, def: 1.1, agi: 0.9 } },
  { id: 'aranha', nome: 'Aranha Gigante', emoji: '🕷️', mult: { hp: 0.8, atq: 1.1, def: 0.7, agi: 1.3 } },
  { id: 'harpia', nome: 'Harpia', emoji: '🦅', mult: { hp: 0.85, atq: 1.0, def: 0.7, agi: 1.5 } },
  { id: 'orc', nome: 'Orc', emoji: '👹', mult: { hp: 1.3, atq: 1.2, def: 1.0, agi: 0.7 } },
  { id: 'fantasma', nome: 'Fantasma', emoji: '👻', mult: { hp: 0.8, atq: 1.15, def: 0.6, agi: 1.5 } },
  { id: 'troll', nome: 'Troll', emoji: '🧌', mult: { hp: 1.4, atq: 1.15, def: 1.0, agi: 0.6 } },
  { id: 'golem', nome: 'Golem', emoji: '🗿', mult: { hp: 1.5, atq: 1.0, def: 1.5, agi: 0.4 } },

  // --------------------------------------------------------- fim de jogo
  { id: 'wyvern', nome: 'Wyverna', emoji: '🐉', desde: 41, mult: { hp: 0.83, atq: 0.95, def: 0.7, agi: 1.35 } },
  { id: 'basilisco', nome: 'Basilisco', emoji: '🦎', desde: 41, mult: { hp: 0.91, atq: 0.99, def: 0.86, agi: 0.81 } },
  { id: 'quimera', nome: 'Quimera', emoji: '🦁', desde: 45, mult: { hp: 1.04, atq: 0.95, def: 0.78, agi: 0.99 } },
  { id: 'espectro', nome: 'Cavaleiro Espectral', emoji: '🏴', desde: 50, mult: { hp: 0.83, atq: 0.99, def: 1.09, agi: 0.9 } },
  { id: 'vampiro', nome: 'Vampiro', emoji: '🧛', desde: 55, mult: { hp: 0.87, atq: 1.03, def: 0.78, agi: 1.26 } },
  { id: 'elemental', nome: 'Elemental de Fogo', emoji: '🔥', desde: 60, mult: { hp: 0.95, atq: 1.1, def: 0.7, agi: 1.08 } },
  { id: 'abominacao', nome: 'Abominação', emoji: '🧟', desde: 65, mult: { hp: 1.33, atq: 0.99, def: 0.93, agi: 0.63 } },
  { id: 'demonio', nome: 'Demônio', emoji: '😈', desde: 72, mult: { hp: 1.08, atq: 1.14, def: 0.97, agi: 1.08 } },
  { id: 'behemoth', nome: 'Behemoth', emoji: '🦬', desde: 80, mult: { hp: 1.49, atq: 1.06, def: 1.09, agi: 0.72 } },
  { id: 'arauto', nome: 'Arauto do Vazio', emoji: '🌑', desde: 90, mult: { hp: 1.16, atq: 1.25, def: 1.01, agi: 1.26 } },
]

const TITULOS_ELITE = ['Veterano', 'Sombrio', 'Ancião', 'Sanguinário', 'Amaldiçoado']

/**
 * Bosses dos marcos. A chave e o nivel em que o jogador trava.
 *
 * O chefe luta NIVEIS_ACIMA niveis acima do marco: e de la que vem a
 * dificuldade. Ate o 30 os multiplicadores sao os originais — aquela faixa
 * ja estava calibrada e nao havia motivo para mexer. Do 35 para cima eles
 * sobem junto com a escala de fim de jogo (ver escalaEndgame no config).
 */
export const NIVEIS_ACIMA = 3

export const BOSSES = {
  10: { nome: 'Rei Goblin', emoji: '👑', mult: { hp: 0.68, atq: 1.3, def: 1.3, agi: 1.0 } },
  15: { nome: 'Cavaleiro Caído', emoji: '🏴', mult: { hp: 0.66, atq: 1.35, def: 1.4, agi: 1.1 } },
  20: { nome: 'Necromante', emoji: '🕯️', mult: { hp: 0.62, atq: 1.45, def: 1.3, agi: 1.2 } },
  25: { nome: 'Dragão Jovem', emoji: '🐉', mult: { hp: 0.63, atq: 1.5, def: 1.4, agi: 1.1 } },
  30: { nome: 'Senhor do Abismo', emoji: '😈', mult: { hp: 0.5, atq: 1.6, def: 1.5, agi: 1.3 } },

  // ---------------------------------------------------- marcos de endgame
  35: { nome: 'Hidra das Brumas', emoji: '🐍', mult: { hp: 0.6, atq: 1.72, def: 1.35, agi: 1.35 } },
  40: { nome: 'Arauto da Ruína', emoji: '🌑', mult: { hp: 0.62, atq: 1.62, def: 1.5, agi: 1.3 } },
  45: { nome: 'Titã Esquecido', emoji: '🗿', mult: { hp: 0.72, atq: 1.45, def: 1.8, agi: 0.85 } },
  50: { nome: 'Rainha das Cinzas', emoji: '👸', mult: { hp: 0.56, atq: 1.85, def: 1.3, agi: 1.45 } },
  55: { nome: 'Devorador de Almas', emoji: '👁️', mult: { hp: 0.68, atq: 1.6, def: 1.55, agi: 1.15 } },
  60: { nome: 'Dragão Ancião', emoji: '🐲', mult: { hp: 0.7, atq: 1.65, def: 1.62, agi: 1.1 } },
  65: { nome: 'Ceifador', emoji: '⚰️', mult: { hp: 0.55, atq: 1.88, def: 1.35, agi: 1.6 } },
  70: { nome: 'Anjo Caído', emoji: '🕊️', mult: { hp: 0.64, atq: 1.7, def: 1.55, agi: 1.4 } },
  75: { nome: 'Leviatã Terrestre', emoji: '🐋', mult: { hp: 0.8, atq: 1.55, def: 1.72, agi: 0.9 } },
  80: { nome: 'Senhor da Tempestade', emoji: '⛈️', mult: { hp: 0.58, atq: 1.8, def: 1.38, agi: 1.7 } },
  85: { nome: 'Guardião do Tempo', emoji: '⏳', mult: { hp: 0.66, atq: 1.62, def: 1.75, agi: 1.35 } },
  90: { nome: 'Avatar da Ruína', emoji: '💥', mult: { hp: 0.6, atq: 1.92, def: 1.45, agi: 1.3 } },
  95: { nome: 'Rei Esquecido', emoji: '👑', mult: { hp: 0.68, atq: 1.7, def: 1.62, agi: 1.3 } },
  100: { nome: 'O Primordial', emoji: '🌌', mult: { hp: 0.75, atq: 1.85, def: 1.75, agi: 1.4 } },
}

/** Os marcos que tem chefe proprio, com nome e multiplicadores na tabela. */
export const NIVEIS_DE_BOSS = Object.keys(BOSSES).map(Number).sort((a, b) => a - b)

/** O primeiro marco do jogo e o ultimo com chefe de nome proprio. */
export const PRIMEIRO_MARCO = NIVEIS_DE_BOSS[0]
export const ULTIMO_MARCO_NOMEADO = NIVEIS_DE_BOSS.at(-1)

/** De quanto em quanto nivel aparece um chefe. */
export const PASSO_DO_MARCO = 5

/**
 * Os chefes reaproveitados depois do ultimo marco nomeado. So os de fim de
 * jogo entram no rodizio: um Rei Goblin no nivel 130 nao assusta ninguem,
 * mesmo com os atributos daquela faixa.
 */
const RODIZIO = NIVEIS_DE_BOSS.filter((n) => n >= 35)

/**
 * O proximo marco a partir de um nivel.
 *
 * Depois do ultimo chefe nomeado a conta continua: marco a cada cinco
 * niveis, para sempre. Nunca devolve null — a progressao nao tem teto.
 */
export function proximoBoss(nivel) {
  const proximo = (Math.floor(nivel / PASSO_DO_MARCO) + 1) * PASSO_DO_MARCO
  return Math.max(PRIMEIRO_MARCO, proximo)
}

export const ehNivelDeBoss = (nivel) => nivel >= PRIMEIRO_MARCO && nivel % PASSO_DO_MARCO === 0

/**
 * O chefe de um marco alem da tabela: um dos chefes de fim de jogo voltando
 * como eco, com os atributos do marco novo. E o que mantem a mecanica de
 * chefe a cada cinco niveis funcionando sem fim.
 */
function chefeEcoado(nivelMarco) {
  const passos = (nivelMarco - ULTIMO_MARCO_NOMEADO) / PASSO_DO_MARCO - 1
  const marcoOriginal = RODIZIO[passos % RODIZIO.length]
  const volta = Math.floor(passos / RODIZIO.length)
  const original = BOSSES[marcoOriginal]

  return {
    ...original,
    marcoOriginal,
    nome: `${original.nome} Ecoado${volta > 0 ? ' ' + '★'.repeat(Math.min(3, volta)) : ''}`,
    eco: true,
  }
}

/** A ficha de tabela do chefe de um marco, nomeado ou ecoado. */
export function chefeDoMarco(nivelMarco) {
  if (!ehNivelDeBoss(nivelMarco)) return null
  return BOSSES[nivelMarco] ?? chefeEcoado(nivelMarco)
}

/**
 * Quanto os atributos de monstro crescem acima do limiar.
 *
 * Ate o limiar a conta e a de sempre — a faixa de 1 a 35 ja estava
 * calibrada. Dali para cima entra um termo a mais por nivel, porque o
 * jogador tambem cresce duas vezes: pelo nivel da classe E pelo
 * equipamento, que ainda multiplica por ate 3 na raridade lendaria. Sem
 * isso o monstro vira linear contra um jogador quadratico, e foi
 * exatamente o que deixou o fim de jogo facil.
 */
export function escalaDeNivel(nivel) {
  const e = config.rpg.escalaEndgame
  const passos = Math.max(0, nivel - e.desde)
  const curva = 1 - Math.exp(-passos / e.meia)

  // Degraus de classe: o mundo endurece exatamente onde o jogador ganha
  // uma habilidade nova.
  //
  // A curva sozinha bastava enquanto o personagem parava na especialidade.
  // Com maestria (150) e apoteose (200) as habilidades ACUMULAM, e medindo
  // deu para ver que o salto de poder vem delas, nao do crescimento de
  // atributo — trocar crescimentoPorTier de 1.02 para 1.07 quase nao mexia
  // na taxa de vitoria, enquanto cada degrau novo somava 25 pontos. Uma
  // rampa linear desde o 40 nao servia: punia quem ainda esta no degrau de
  // baixo. Estes degraus sobem so a partir do nivel em que cada um abre.
  let degrau = 0
  for (const [nivelDoDegrau, quanto] of Object.entries(e.degrausDeClasse ?? {})) {
    if (nivel >= Number(nivelDoDegrau)) degrau += quanto
  }

  return {
    hp: 1 + e.teto.hp * curva + degrau,
    atq: 1 + e.teto.atq * curva + degrau,
    def: 1 + e.teto.def * curva + degrau,
    agi: 1 + e.teto.agi * curva + degrau * 0.3,
  }
}

export function atributosDeMonstro(nivel, mult) {
  const escala = escalaDeNivel(nivel)

  return {
    hp: Math.round((56 + nivel * 20.8) * mult.hp * escala.hp),
    atq: Math.round((8.8 + nivel * 4.16) * mult.atq * escala.atq),
    def: Math.round((4 + nivel * 1.92) * mult.def * escala.def),
    agi: Math.round((5 + nivel * 1.4) * mult.agi * escala.agi),
  }
}

/** As especies liberadas para o nivel de um jogador. */
export const especiesPara = (nivelJogador) => ESPECIES.filter((e) => nivelJogador >= (e.desde ?? 1))

/**
 * Sorteia um monstro para o nivel do jogador.
 * O normal e algo entre um nivel abaixo e um acima; de vez em quando
 * aparece um elite, tres niveis acima e bem mais perigoso.
 */
export function sortearMonstro(nivelJogador, chanceElite = 0.12, sorte = Math.random) {
  const pool = especiesPara(nivelJogador)
  const especie = pool[Math.floor(sorte() * pool.length)]
  const variacao = Math.floor(sorte() * 3) - 1 // -1, 0 ou +1
  const elite = sorte() < chanceElite

  const nivel = Math.max(1, nivelJogador + variacao + (elite ? 3 : 0))
  const mult = { ...especie.mult }

  if (elite) {
    for (const chave of Object.keys(mult)) mult[chave] *= 1.25
  }

  const titulo = elite ? TITULOS_ELITE[Math.floor(sorte() * TITULOS_ELITE.length)] : ''

  return {
    id: especie.id,
    nome: elite ? `${especie.nome} ${titulo}` : especie.nome,
    emoji: especie.emoji,
    nivel,
    elite,
    boss: false,
    ...atributosDeMonstro(nivel, mult),
  }
}

/** Monta o boss de um marco. */
export function criarBoss(nivelMarco) {
  const boss = chefeDoMarco(nivelMarco)
  if (!boss) return null

  const nivel = nivelMarco + NIVEIS_ACIMA

  return {
    id: `boss${nivelMarco}`,
    nome: boss.nome,
    emoji: boss.emoji,
    eco: Boolean(boss.eco),
    nivel,
    marco: nivelMarco,
    elite: false,
    boss: true,
    ...atributosDeMonstro(nivel, boss.mult),
  }
}

/** Recompensas de um monstro derrotado. */
export function recompensas(monstro, sorte = Math.random) {
  const multXp = monstro.boss ? 6 : monstro.elite ? 2.2 : 1
  const multGold = monstro.boss ? 8 : monstro.elite ? 2.5 : 1

  // Acima do limiar o bicho da mais trabalho, entao paga melhor — se nao,
  // subir de nivel no fim de jogo viraria moagem pura.
  const escala = escalaDeNivel(monstro.nivel)
  const bonusEndgame = 1 + (escala.hp - 1) * 0.5

  const xp = Math.round((18 + monstro.nivel * 8) * multXp * bonusEndgame)
  const goldBase = 8 + monstro.nivel * 4
  const gold = Math.round(goldBase * multGold * bonusEndgame * (0.7 + sorte() * 0.6))
  const chanceDrop = monstro.boss ? 1 : monstro.elite ? 0.7 : 0.35

  return { xp, gold, chanceDrop }
}
