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
 * tabela, na ultima fase de cada um. Os `mult` sao a personalidade de cada
 * chefe (o Tita e uma parede, a Rainha e vidro e fogo); o quanto TODOS eles
 * pesam a mais que um inimigo comum e o botao `config.rpg.cacada.chefe`.
 *
 * Cada chefe traz uma habilidade especial: `tipo` diz o que ela faz e o
 * resto sao os numeros — o motor de combate (rpg/combate.js, secao das
 * habilidades dos chefes) le e aplica. `resumo` e o que a tela mostra quando
 * o chefe entra em cena; `texto` e a frase que o log conta, com o nome do
 * chefe na frente.
 */
export const BOSSES = {
  10: {
    nome: 'Rei Goblin',
    emoji: '👑',
    mult: { hp: 0.68, atq: 1.27, def: 1.3, agi: 1.0 },
    especial: {
      nome: 'Pancada Real',
      emoji: '👑',
      resumo: 'A cada 3 turnos, desce o cetro com o peso do trono: 2,2× de dano.',
      texto: 'ergue o cetro dourado e o desce com o peso do trono',
      tipo: 'golpe',
      cada: 3,
      mult: 2.2,
    },
  },
  15: {
    nome: 'Cavaleiro Caído',
    emoji: '🏴',
    mult: { hp: 0.66, atq: 1.33, def: 1.4, agi: 1.1 },
    especial: {
      nome: 'Guarda Caída',
      emoji: '🛡️',
      resumo: 'Ao cair abaixo de metade da vida, cerra o escudo e absorve dano equivalente a 25% da vida máxima.',
      texto: 'cerra o escudo partido e a armadura passa a engolir os golpes',
      tipo: 'escudo',
      abaixoDe: 0.5,
      fracao: 0.25,
    },
  },
  20: {
    nome: 'Necromante',
    emoji: '🕯️',
    mult: { hp: 0.62, atq: 1.35, def: 1.3, agi: 1.2 },
    especial: {
      nome: 'Erguer Mortos',
      emoji: '💀',
      resumo: 'A cada 3 turnos ergue um morto-vivo (até 3) que ataca junto, com 22% do ataque dele.',
      texto: 'murmura uma palavra proibida e um morto-vivo se ergue do chão',
      tipo: 'invocar',
      cada: 3,
      max: 3,
      fracao: 0.22,
      aliado: 'Morto-vivo',
    },
  },
  25: {
    nome: 'Dragão Jovem',
    emoji: '🐉',
    mult: { hp: 0.63, atq: 0.93, def: 1.4, agi: 1.1 },
    especial: {
      nome: 'Sopro de Fogo',
      emoji: '🔥',
      resumo: 'A cada 4 turnos cospe fogo que não dá para desviar (1,4× de dano) e queima 5% da sua vida por turno, por 3 turnos.',
      texto: 'enche o peito e cospe fogo sobre você',
      tipo: 'golpe',
      cada: 4,
      mult: 1.4,
      semEsquiva: true,
      queima: { fracao: 0.05, turnos: 3 },
    },
  },
  30: {
    nome: 'Senhor do Abismo',
    emoji: '😈',
    mult: { hp: 0.6, atq: 1.11, def: 1.3, agi: 1.3 },
    especial: {
      nome: 'Marca do Abismo',
      emoji: '🌀',
      resumo: 'Abre a luta marcando você: −20% de ataque e −15% de defesa até o fim.',
      texto: 'crava a marca do abismo em você e as suas forças escorrem',
      tipo: 'enfraquecer',
      atq: 0.2,
      def: 0.15,
    },
  },

  // ---------------------------------------------------- marcos de endgame
  35: {
    nome: 'Hidra das Brumas',
    emoji: '🐍',
    mult: { hp: 0.6, atq: 1.17, def: 1.1, agi: 1.35 },
    especial: {
      nome: 'Cabeças Renascidas',
      emoji: '🐍',
      resumo: 'Cada cabeça cortada volta: regenera 2% da vida máxima a cada turno.',
      tipo: 'passiva',
      efeitos: { regeneracao: 0.02 },
    },
  },
  40: {
    nome: 'Arauto da Ruína',
    emoji: '🌑',
    mult: { hp: 0.62, atq: 1.1, def: 1.3, agi: 1.3 },
    especial: {
      nome: 'Dobre de Finados',
      emoji: '🔔',
      resumo: 'A cada 4 turnos toca o sino da ruína: o golpe paralisa e você perde a próxima vez.',
      texto: 'toca o sino da ruína e o som paralisa você',
      tipo: 'golpe',
      cada: 4,
      mult: 1.2,
      prende: 1,
    },
  },
  45: {
    nome: 'Titã Esquecido',
    emoji: '🗿',
    mult: { hp: 0.72, atq: 1, def: 1.8, agi: 0.85 },
    especial: {
      nome: 'Pele Pétrea',
      emoji: '🪨',
      resumo: 'A pele de pedra devolve 18% de todo o dano que ele leva para quem bateu.',
      texto: 'devolve parte do golpe pela pele de pedra',
      tipo: 'refletir',
      fracao: 0.18,
    },
  },
  50: {
    nome: 'Rainha das Cinzas',
    emoji: '👸',
    mult: { hp: 0.6, atq: 1.36, def: 1.3, agi: 1.45 },
    especial: {
      nome: 'Renascer das Cinzas',
      emoji: '🔥',
      resumo: 'Na primeira vez que cairia, renasce das cinzas com 40% da vida máxima.',
      texto: 'se desfaz em brasas e renasce das próprias cinzas',
      tipo: 'reviver',
      fracao: 0.4,
    },
  },
  55: {
    nome: 'Devorador de Almas',
    emoji: '👁️',
    mult: { hp: 0.68, atq: 1.18, def: 1.55, agi: 1.15 },
    especial: {
      nome: 'Devorar Alma',
      emoji: '👁️',
      resumo: 'A cada 3 turnos crava o olhar em você (1,5× de dano) e recupera tudo o que causou.',
      texto: 'crava o olhar em você e arranca um pedaço da sua alma',
      tipo: 'golpe',
      cada: 3,
      mult: 1.5,
      cura: 1,
    },
  },
  60: {
    nome: 'Dragão Ancião',
    emoji: '🐲',
    mult: { hp: 0.7, atq: 1.2, def: 1.62, agi: 1.1 },
    especial: {
      nome: 'Fúria Ancestral',
      emoji: '🐲',
      resumo: 'Ao cair abaixo de metade da vida, entra em fúria: +40% de ataque até o fim.',
      texto: 'ruge, e a fúria de mil anos toma conta do corpo',
      tipo: 'enfurecer',
      abaixoDe: 0.5,
      atq: 0.4,
    },
  },
  65: {
    nome: 'Ceifador',
    emoji: '⚰️',
    mult: { hp: 0.6, atq: 1.27, def: 1.35, agi: 1.6 },
    especial: {
      nome: 'Ceifa',
      emoji: '⚰️',
      resumo: 'Quando a sua vida cai abaixo de 40%, desce a foice sobre você: 3,2× de dano, atravessando metade da defesa. Só uma vez.',
      texto: 'ergue a foice sobre quem já está no fim e a desce sem piedade',
      tipo: 'golpe',
      quandoAlvoAbaixoDe: 0.4,
      mult: 3.2,
      perfuracao: 0.5,
      semEsquiva: true,
    },
  },
  70: {
    nome: 'Anjo Caído',
    emoji: '🕊️',
    mult: { hp: 0.64, atq: 1.19, def: 1.55, agi: 1.4 },
    especial: {
      nome: 'Voo Sombrio',
      emoji: '🕊️',
      resumo: 'Some entre as asas negras: os 3 primeiros golpes que você tentar cortam o vazio.',
      texto: 'some entre as asas negras e o golpe atravessa o vazio',
      tipo: 'evasao',
      golpes: 3,
    },
  },
  75: {
    nome: 'Leviatã Terrestre',
    emoji: '🐋',
    mult: { hp: 0.8, atq: 0.94, def: 1.72, agi: 0.9 },
    especial: {
      nome: 'Couraça Colossal',
      emoji: '🛡️',
      resumo: 'Já entra com uma couraça que absorve dano equivalente a 30% da vida máxima.',
      texto: 'fecha a couraça colossal, que engole os primeiros golpes',
      tipo: 'escudo',
      abaixoDe: 1,
      fracao: 0.3,
    },
  },
  80: {
    nome: 'Senhor da Tempestade',
    emoji: '⛈️',
    mult: { hp: 0.6, atq: 1.01, def: 1.38, agi: 1.7 },
    especial: {
      nome: 'Relâmpago',
      emoji: '⚡',
      resumo: 'A cada 3 turnos um raio cai sobre você: 1,7× de dano, atravessa 70% da defesa e não dá para desviar.',
      texto: 'racha o céu e um raio cai sobre você',
      tipo: 'golpe',
      cada: 3,
      mult: 1.7,
      perfuracao: 0.7,
      semEsquiva: true,
    },
  },
  85: {
    nome: 'Guardião do Tempo',
    emoji: '⏳',
    mult: { hp: 0.66, atq: 0.96, def: 1.75, agi: 1.35 },
    especial: {
      nome: 'Eco do Tempo',
      emoji: '⏳',
      resumo: 'Rebobina o instante: começa a luta e tem 40% de chance de agir duas vezes no mesmo turno.',
      tipo: 'passiva',
      efeitos: { iniciativa: true, golpeDuplo: 0.4 },
    },
  },
  90: {
    nome: 'Avatar da Ruína',
    emoji: '💥',
    mult: { hp: 0.6, atq: 1.31, def: 1.45, agi: 1.3 },
    especial: {
      nome: 'Ruína Crescente',
      emoji: '💥',
      resumo: 'A ruína cresce a cada turno: +8% de ataque por rodada, até +80%.',
      tipo: 'passiva',
      efeitos: { furia: { porRodada: 0.08, teto: 0.8 } },
    },
  },
  95: {
    nome: 'Rei Esquecido',
    emoji: '👑',
    mult: { hp: 0.68, atq: 1.35, def: 1.62, agi: 1.3 },
    especial: {
      nome: 'Esquecimento',
      emoji: '🕳️',
      resumo: 'Cada golpe dele apaga um pedaço da sua armadura: −6% de defesa por acerto, até −50%.',
      tipo: 'passiva',
      efeitos: { maldicao: { porAcerto: 0.06, teto: 0.5 } },
    },
  },
  100: {
    nome: 'O Primordial',
    emoji: '🌌',
    mult: { hp: 0.75, atq: 0.82, def: 1.75, agi: 1.4 },
    especial: {
      nome: 'Gênese Primordial',
      emoji: '🌌',
      resumo: 'A cada 4 turnos desfaz o mundo por um instante: 2,4× de dano, atravessa 40% da defesa e não dá para desviar.',
      texto: 'desfaz o mundo por um instante e o refaz por cima de você',
      tipo: 'golpe',
      cada: 4,
      mult: 2.4,
      perfuracao: 0.4,
      semEsquiva: true,
    },
  },
}

/**
 * A habilidade de um chefe no formato que o combate le: os `efeitos` das
 * passivas entram direto no `hab` (regeneracao, furia... ja existem la), e o
 * resto vai inteiro em `hab.especial`.
 */
export const habDoChefe = (especial) => (especial ? { ...(especial.efeitos ?? {}), especial } : undefined)

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
    // A habilidade especial: `especial` e o que a tela mostra, `hab` e o que o
    // combate le (o mesmo campo que as habilidades de classe usam).
    especial: chefe.especial ?? null,
    hab: habDoChefe(chefe.especial),
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
