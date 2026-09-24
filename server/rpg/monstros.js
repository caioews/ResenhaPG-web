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
 * Os chefes, em ordem de dificuldade. A chave e o nivel de marco para o qual
 * cada um foi calibrado — e por isso que a tabela continua indexada assim,
 * mesmo depois de os marcos terem saido do jogo.
 *
 * Hoje quem os distribui e a rota (rpg/rota.js): um por ato, na ordem desta
 * tabela, na ultima fase de cada um. Ate o 30 os multiplicadores sao os
 * originais — aquela faixa ja estava calibrada e nao havia motivo para
 * mexer. Do 35 para cima eles sobem junto com a escala de fim de jogo (ver
 * escalaEndgame no config).
 */
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

/** Os chefes nomeados, na ordem em que a rota os distribui pelos atos. */
export const NIVEIS_DE_BOSS = Object.keys(BOSSES).map(Number).sort((a, b) => a - b)

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

/** A escala neutra: usada por quem nao quer o termo de fim de jogo. */
const SEM_ESCALA = { hp: 1, atq: 1, def: 1, agi: 1 }

/**
 * Os atributos de um monstro. `escala` e o termo de fim de jogo (8.4); quem
 * passa SEM_ESCALA fica com a conta crua.
 *
 * Quem faz isso e a rota (rpg/rota.js), e por um motivo: escalaDeNivel foi
 * escrita para o caso em que o monstro nasce NO NIVEL DO JOGADOR, e serve
 * para compensar o fato de o jogador crescer duas vezes (nivel e
 * equipamento) e o monstro so uma. Na rota o nivel do inimigo e uma regua
 * fixa, independente de quem esta jogando — aplicar os dois termos
 * multiplicaria uma compensacao que ali nao existe, e a dificuldade deixaria
 * de ser linear na fase. Quem compensa o crescimento do jogador na rota e a
 * propria rampa dela (`forcaPorFase`), que e o que o botao de dificuldade
 * mexe.
 */
export function atributosDeMonstro(nivel, mult, escala = escalaDeNivel(nivel)) {
  return {
    hp: Math.round((56 + nivel * 20.8) * mult.hp * escala.hp),
    atq: Math.round((8.8 + nivel * 4.16) * mult.atq * escala.atq),
    def: Math.round((4 + nivel * 1.92) * mult.def * escala.def),
    agi: Math.round((5 + nivel * 1.4) * mult.agi * escala.agi),
  }
}

/** As especies liberadas para um nivel. */
export const especiesPara = (nivel) => ESPECIES.filter((e) => nivel >= (e.desde ?? 1))

/**
 * A forca da fase entrando nos multiplicadores da especie (rpg/rota.js).
 *
 * Vale cheia em vida, ataque e defesa; em agilidade vale um terco. A
 * agilidade vira critico e esquiva, e as duas saturam: multiplicar agi pelo
 * mesmo fator la no fim da rota so faria o inimigo desviar de tudo, o que e
 * frustrante em vez de dificil. E a mesma escolha da escala de fim de jogo,
 * onde o teto de agi e um terco do de hp.
 */
function aplicarForca(mult, forca) {
  if (forca === 1) return mult
  const suave = 1 + (forca - 1) * 0.35
  return { hp: mult.hp * forca, atq: mult.atq * forca, def: mult.def * forca, agi: mult.agi * suave }
}

/** A escala que vale para estas opcoes: a de fim de jogo, ou nenhuma. */
const escalaPara = (nivel, daRota) => (daRota ? SEM_ESCALA : escalaDeNivel(nivel))

/**
 * Sorteia um monstro de um nivel.
 * O normal e algo entre um nivel abaixo e um acima; de vez em quando
 * aparece um elite, tres niveis acima e bem mais perigoso. `forca` e a rampa
 * da fase em que ele aparece — 1 na fase 1, e crescendo dali em diante.
 */
export function sortearMonstro(nivel, chanceElite = 0.12, sorte = Math.random, { forca = 1, daRota = false } = {}) {
  const pool = especiesPara(nivel)
  const especie = pool[Math.floor(sorte() * pool.length)]
  const variacao = Math.floor(sorte() * 3) - 1 // -1, 0 ou +1
  const elite = sorte() < chanceElite

  const nivelDele = Math.max(1, nivel + variacao + (elite ? 3 : 0))
  const mult = { ...especie.mult }

  if (elite) {
    for (const chave of Object.keys(mult)) mult[chave] *= 1.25
  }

  const titulo = elite ? TITULOS_ELITE[Math.floor(sorte() * TITULOS_ELITE.length)] : ''

  return {
    id: especie.id,
    nome: elite ? `${especie.nome} ${titulo}` : especie.nome,
    emoji: especie.emoji,
    nivel: nivelDele,
    elite,
    boss: false,
    ...atributosDeMonstro(nivelDele, aplicarForca(mult, forca), escalaPara(nivelDele, daRota)),
  }
}

/**
 * Monta um chefe a partir da ficha de tabela (nome, emoji, multiplicadores).
 * Quem escolhe QUAL chefe e a rota; aqui so se da corpo a ele.
 */
export function criarChefe(chefe, nivel, { forca = 1, daRota = false } = {}) {
  return {
    nome: chefe.nome,
    emoji: chefe.emoji,
    eco: Boolean(chefe.eco),
    nivel,
    elite: false,
    boss: true,
    ...atributosDeMonstro(nivel, aplicarForca(chefe.mult, forca), escalaPara(nivel, daRota)),
  }
}

/**
 * Recompensas de um monstro derrotado. `forca` e a rampa da fase em que ele
 * apareceu: o que endurece tambem paga melhor, senao a rota viraria um
 * caminho em que cada passo custa mais e rende o mesmo.
 */
export function recompensas(monstro, sorte = Math.random, forca = 1) {
  const multXp = monstro.boss ? 6 : monstro.elite ? 2.2 : 1
  const multGold = monstro.boss ? 8 : monstro.elite ? 2.5 : 1

  // Acima do limiar o bicho da mais trabalho, entao paga melhor — se nao,
  // subir de nivel no fim de jogo viraria moagem pura.
  const escala = escalaDeNivel(monstro.nivel)
  const bonusEndgame = 1 + (escala.hp - 1) * 0.5
  const bonusDaFase = 1 + (forca - 1) * config.rpg.cacada.bonusDeRecompensa

  const xp = Math.round((18 + monstro.nivel * 8) * multXp * bonusEndgame * bonusDaFase)
  const goldBase = 8 + monstro.nivel * 4
  const gold = Math.round(goldBase * multGold * bonusEndgame * bonusDaFase * (0.7 + sorte() * 0.6))
  const chanceDrop = monstro.boss ? 1 : monstro.elite ? 0.7 : 0.35

  return { xp, gold, chanceDrop }
}
