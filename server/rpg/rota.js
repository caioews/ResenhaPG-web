/**
 * A rota: o caminho que o personagem percorre do comeco ao fim do jogo.
 *
 * Cinco arcos, dez atos cada, dez fases cada ato — mais o ato final, que tem
 * um so. Sao 510 fases em linha reta, e a fase e a unica coisa que decide o
 * que aparece: o nivel do inimigo, quantos vem e quanto eles batem saem
 * daqui, NUNCA do nivel do jogador. E essa inversao que faz o jogo empacar.
 *
 * No modelo antigo o monstro nascia com o nivel de quem cacava: subir de
 * nivel nunca deixava a caçada mais facil, so trocava os numeros dos dois
 * lados. Aqui a fase 120 e a fase 120 para todo mundo — quem nao da conta
 * volta uma fase, repete o que consegue vencer e sobe de nivel ate passar.
 * A parede e o conteudo.
 *
 * A ultima fase de cada ato (10 de 10) e o chefe do ato. Sao os mesmos
 * chefes de marco de antes (rpg/monstros.js), redistribuidos: o Rei Goblin
 * fecha o ato 1, o Primordial fecha o 19, e dali para frente eles voltam
 * como eco, cada volta mais forte — a rota tem 51 atos e chefes nomeados
 * so ha 19.
 */
import { config } from '../config.js'
import { chaveDeArte } from './arte.js'
import { BOSSES, NIVEIS_DE_BOSS, criarChefe, sortearMonstro } from './monstros.js'

/**
 * Os arcos, na ordem. O nome do ato e o mesmo da pasta de cenario em
 * `Assets/CENARIOS` — e `chaveDeArte` que liga um ao outro, entao trocar um
 * nome aqui pede trocar o nome da pasta la.
 */
export const ARCOS = [
  {
    nome: 'Terras Perdidas',
    romano: 'I',
    atos: [
      'Ruínas de Valkhar',
      'Estrada dos Exilados',
      'Bosque dos Ecos',
      'Campos de Eredun',
      'Pântano das Lamentações',
      'Garganta de Ferro Negro',
      'Deserto de Ashkar',
      'Oásis dos Condenados',
      'Penhascos de Skaroth',
      'Fortaleza de Arkanis',
    ],
  },
  {
    nome: 'Fronteira Sombria',
    romano: 'II',
    atos: [
      'Floresta de Umbrafolha',
      'Vale das Bruxas',
      'Cripta dos Reis Caídos',
      'Colinas da Névoa Eterna',
      'Minas de Kar-Dur',
      'Cidade Abandonada de Nyr',
      'Lago da Lua Negra',
      'Campos de Ossos',
      'Torre do Vigia Morto',
      'Portões de Malgor',
    ],
  },
  {
    nome: 'Terras Corrompidas',
    romano: 'III',
    atos: [
      'Planícies Escarlates',
      'Bosque das Cinzas',
      'Vale da Praga',
      'Rio Sangrento',
      'Desfiladeiro dos Mil Gritos',
      'Ruínas de Thal-Mor',
      'Picos da Tempestade Negra',
      'Catedral Profanada',
      'Jardim dos Enforcados',
      'Bastião de Vharok',
    ],
  },
  {
    nome: 'Domínio Infernal',
    romano: 'IV',
    atos: [
      'Campos de Lava de Ghor',
      'Forjas do Inferno',
      'Trilha das Almas Perdidas',
      'Labirinto Carmesim',
      'Trono dos Hereges',
      'Abismo de Kor-Mal',
      'Fortaleza das Correntes',
      'Deserto de Enxofre',
      'Mar de Chamas Eternas',
      'Cidadela de Azrakhul',
    ],
  },
  {
    nome: 'Profundezas do Abismo',
    romano: 'V',
    atos: [
      'Fendas do Vazio',
      'Vale das Sombras Eternas',
      'Covil dos Devoradores',
      'Ruínas do Primeiro Pecado',
      'Ponte dos Mil Condenados',
      'Cavernas do Caos',
      'Domínio de Belzhar',
      'Trono da Escuridão',
      'Núcleo do Abismo',
      'Caminho do Fim dos Tempos',
    ],
  },
  // O ato final nao e um arco de dez: e o fecho. Fica num arco proprio para
  // a tela poder escrever "Ato Final" em vez de "Arco VI".
  { nome: 'Ato Final', romano: '', final: true, atos: ['Coração do Abismo Demoníaco'] },
]

/**
 * Os atos numa lista so, do 1 ao 51. E por este numero que tudo anda: a
 * ficha guarda `{ ato, fase }` e nada mais.
 */
export const ATOS = ARCOS.flatMap((a, i) =>
  a.atos.map((nome, j) => ({
    nome,
    // O que o palco usa para achar o cenario deste ato.
    cenario: chaveDeArte(nome),
    arco: i + 1,
    // A posicao dentro do arco, para a tela escrever "ato 3 de 10".
    noArco: j + 1,
  })),
).map((a, i) => ({ ...a, numero: i + 1 }))

export const TOTAL_DE_ATOS = ATOS.length

const limitar = (v, min, max) => Math.max(min, Math.min(max, v))

export const fasesPorAto = () => config.rpg.cacada.fasesPorAto
export const totalDeFases = () => TOTAL_DE_ATOS * fasesPorAto()

export const ato = (numero) => ATOS[numero - 1] ?? null
export const arco = (numero) => ARCOS[numero - 1] ?? null
export const arcoDoAto = (numeroDoAto) => arco(ato(numeroDoAto)?.arco ?? 0)

/** O nome que aparece em cima do mapa: "Arco II — Fronteira Sombria". */
export const nomeDoArco = (a) => (a?.final ? a.nome : `Arco ${a?.romano ?? ''} — ${a?.nome ?? ''}`)

// ------------------------------------------------------- a conta da fase

/**
 * O indice global de uma fase, de 1 a 510. E o numero que manda em tudo que
 * escala; `{ ato, fase }` e so a forma de mostrar.
 */
export const indiceDaFase = (numeroDoAto, numeroDaFase) =>
  (numeroDoAto - 1) * fasesPorAto() + numeroDaFase

/** O caminho de volta: do indice global para o par que a tela mostra. */
export function faseDoIndice(indice) {
  const porAto = fasesPorAto()
  const g = limitar(indice, 1, totalDeFases())
  return { ato: Math.floor((g - 1) / porAto) + 1, fase: ((g - 1) % porAto) + 1 }
}

/** A ultima fase de cada ato e o chefe. */
export const ehFaseDeChefe = (numeroDaFase) => numeroDaFase === fasesPorAto()

/**
 * O nivel dos inimigos de uma fase. Meio nivel por fase: a fase 1 nasce no
 * nivel 1 e a 510 no 255 — que e, nao por acaso, onde o prestigio abre.
 */
export const nivelDaFase = (indice) =>
  Math.max(1, 1 + Math.floor((indice - 1) * config.rpg.cacada.nivelPorFase))

/** O caminho inverso: em que fase da rota um nivel se encaixa. */
export const faseDoNivel = (nivel) =>
  limitar(Math.round((nivel - 1) / config.rpg.cacada.nivelPorFase) + 1, 1, totalDeFases())

/**
 * A rampa de dificuldade: quanto os atributos do inimigo sao multiplicados
 * ALEM do que o nivel dele ja da.
 *
 * O nivel sozinho deixa jogador e inimigo crescendo no mesmo ritmo, e o
 * jogador ainda cresce uma segunda vez pelo equipamento — daria uma rota
 * que so fica mais facil conforme anda. Esta e a correcao, e e ela que o
 * `escalaDeDificuldade` do config mexe: em 1 vale a rampa calibrada aqui,
 * em 2 o excedente dobra, em 0 a rota inteira vira nivel puro.
 */
export function forcaDaFase(indice) {
  const c = config.rpg.cacada
  return 1 + Math.max(0, indice - 1) * c.forcaPorFase * c.escalaDeDificuldade
}

/** Quantos inimigos tem a horda de uma fase comum. */
export function quantosInimigos(numeroDoAto, numeroDaFase) {
  const c = config.rpg.cacada.inimigos
  const quantos = c.base + (numeroDaFase - 1) * c.porFase + (numeroDoAto - 1) * c.porAto
  return limitar(Math.round(quantos), 1, c.maximo)
}

// ------------------------------------------------------------- os chefes

/**
 * Os chefes que voltam depois do ultimo nomeado. So os de fim de jogo
 * entram no rodizio: um Rei Goblin no ato 30 nao assusta ninguem, mesmo com
 * os atributos daquela faixa.
 */
const RODIZIO = NIVEIS_DE_BOSS.filter((n) => n >= 35)

/**
 * O multiplicador de ataque de cada eco, por ato (20 a 50).
 *
 * Um mesmo chefe volta em atos muito diferentes, e o ataque calibrado para o
 * ato de origem dele nao serve nos outros: a Hidra que era medida no ato 6
 * seria um enfeite no 34, e o Dragao Anciao do ato 25 uma parede. Estes numeros
 * saem de simulacao da rota inteira, um por ato, mirando o mesmo alvo do resto
 * da tabela — o jogador simulado passa de primeira em ~50% dos chefes. Os
 * degraus em torno do 30 e do 40 sao o jogador ganhando maestria (nivel 150)
 * e apoteose (200): o chefe acompanha, senao a rota ficaria facil dali em
 * diante. Recalibrar: npm run chefes.
 */
export const ATQ_DOS_ECOS = {
  20: 2.12, 21: 2.28, 22: 1.33, 23: 1.68, 24: 1.52, 25: 1.55, 26: 1.74, 27: 1.47, 28: 1.64, 29: 2.09,
  30: 1.96, 31: 2.81, 32: 2.79, 33: 1.58, 34: 3.18, 35: 2.72, 36: 1.59, 37: 2.04, 38: 1.91, 39: 2,
  40: 2.29, 41: 1.79, 42: 1.61, 43: 1.58, 44: 1.45, 45: 2.07, 46: 2.11, 47: 1.2, 48: 2.5, 49: 2.22,
  50: 1.24,
}

/**
 * O fecho da rota tem chefe proprio — nenhum eco serve de ultimo chefe.
 *
 * Esta ficha so vale para o que ainda monta a fase 10 do ato 51 como luta de
 * uma pessoa so (as simulacoes da rota). No jogo, essa fase nao se enfrenta
 * sozinho: leva a arena, onde o Coracao do Abismo e uma raid (rpg/coracao.js).
 */
const CHEFE_FINAL = {
  nome: 'O Coração do Abismo',
  emoji: '🫀',
  mult: { hp: 0.95, atq: 1.15, def: 1.85, agi: 1.5 },
  especial: {
    nome: 'Batida do Abismo',
    emoji: '🫀',
    resumo: 'A cada 2 turnos o coração pulsa: 1,35× de dano que não dá para desviar, e ele recupera 60% do que causou.',
    texto: 'pulsa, e o abismo inteiro treme sugando a sua vida',
    tipo: 'golpe',
    cada: 2,
    mult: 1.35,
    semEsquiva: true,
    cura: 0.6,
  },
}

/**
 * O chefe de um ato: a ficha de tabela (nome, emoji, multiplicadores).
 *
 * Atos 1 a 19 pegam os chefes de marco na ordem em que foram escritos, que
 * ja e a ordem de dificuldade. Do 20 em diante eles voltam como eco, com os
 * atributos do ato novo e uma estrela a cada volta completa.
 */
export function chefeDoAto(numeroDoAto) {
  if (numeroDoAto === TOTAL_DE_ATOS) return { ...CHEFE_FINAL, final: true }

  const nomeado = NIVEIS_DE_BOSS[numeroDoAto - 1]
  if (nomeado) return { ...BOSSES[nomeado], marcoOriginal: nomeado }

  const passos = numeroDoAto - NIVEIS_DE_BOSS.length - 1
  const original = BOSSES[RODIZIO[passos % RODIZIO.length]]
  const volta = Math.floor(passos / RODIZIO.length)

  return {
    ...original,
    // O ataque do eco nao e o da tabela: e o do ato (ver ATQ_DOS_ECOS).
    mult: { ...original.mult, atq: ATQ_DOS_ECOS[numeroDoAto] ?? original.mult.atq },
    nome: `${original.nome} Ecoado${volta > 0 ? ` ${'★'.repeat(Math.min(3, volta))}` : ''}`,
    eco: true,
  }
}

/**
 * O chefe do ato pronto para lutar, ja com o nivel e a forca da fase.
 *
 * Os multiplicadores da tabela sao a personalidade dele; `config.rpg.cacada
 * .chefe` e o quanto TODOS os chefes pesam a mais por cima disso — e o botao
 * que se mexe para chefe ficar mais facil ou mais duro sem tocar em cada um.
 */
export function criarChefeDoAto(numeroDoAto, indice) {
  const chefe = chefeDoAto(numeroDoAto)
  const nivel = nivelDaFase(indice) + config.rpg.cacada.chefeNiveisAcima
  const peso = config.rpg.cacada.chefe
  const mult = {
    hp: chefe.mult.hp * peso.hp,
    atq: chefe.mult.atq * peso.atq,
    def: chefe.mult.def * peso.def,
    agi: chefe.mult.agi,
  }

  return {
    ...criarChefe({ ...chefe, mult }, nivel, { forca: forcaDaFase(indice), daRota: true }),
    // O sprite sai do nome, como os chefes do Abismo: pôr a folha em
    // `Assets/inimigos/chefes` com o nome do chefe basta para ele entrar em
    // cena desenhado (ver scripts/arte.js).
    id: chaveDeArte(chefe.nome),
    ato: numeroDoAto,
  }
}

// ---------------------------------------------------------- montar a fase

/**
 * A fase inteira antes de a luta comecar: quem aparece, nesta ordem.
 *
 * A horda e resolvida sem cura no meio (config.rpg.cacada.curaEntreInimigos
 * abre uma fresta, se alguem quiser): e o desgaste acumulado que faz a fase
 * ser uma prova, e nao tres lutas soltas.
 */
export function montarFase(numeroDoAto, numeroDaFase, sorte = Math.random) {
  const indice = indiceDaFase(numeroDoAto, numeroDaFase)
  const nivel = nivelDaFase(indice)
  const forca = forcaDaFase(indice)
  const chefe = ehFaseDeChefe(numeroDaFase)
  const oAto = ato(numeroDoAto)

  const inimigos = chefe
    ? [criarChefeDoAto(numeroDoAto, indice)]
    : Array.from({ length: quantosInimigos(numeroDoAto, numeroDaFase) }, () =>
        sortearMonstro(nivel, config.rpg.chanceElite, sorte, { forca, daRota: true }),
      )

  return {
    ato: numeroDoAto,
    fase: numeroDaFase,
    indice,
    nivel,
    forca,
    chefe,
    nomeDoAto: oAto?.nome ?? '',
    cenario: oAto?.cenario ?? null,
    inimigos,
  }
}

// --------------------------------------------------------- andar na rota

/** A fase seguinte. No fim da rota, devolve a propria — nao ha o que vir. */
export function proximaFase({ ato: a, fase: f }) {
  if (f < fasesPorAto()) return { ato: a, fase: f + 1 }
  if (a < TOTAL_DE_ATOS) return { ato: a + 1, fase: 1 }
  return { ato: a, fase: f }
}

/** A fase anterior. Na fase 1 do ato 1 devolve a propria: dali ninguem recua. */
export function faseAnterior({ ato: a, fase: f }) {
  if (f > 1) return { ato: a, fase: f - 1 }
  if (a > 1) return { ato: a - 1, fase: fasesPorAto() }
  return { ato: a, fase: f }
}

/**
 * Se a fase existe na rota. Protege a ficha de vir torta do banco — e aceita
 * `null` de bom grado, porque `travada` e nulo na maior parte do tempo.
 */
export function faseValida(onde) {
  if (!onde) return false
  const { ato: a, fase: f } = onde
  return Number.isInteger(a) && Number.isInteger(f) && a >= 1 && a <= TOTAL_DE_ATOS && f >= 1 && f <= fasesPorAto()
}

/** Qual das duas vem depois na rota. */
export const comparar = (a, b) => indiceDaFase(a.ato, a.fase) - indiceDaFase(b.ato, b.fase)

/** O fim da rota: a ultima fase do ultimo ato. */
export const ehOFim = ({ ato: a, fase: f }) => a === TOTAL_DE_ATOS && f === fasesPorAto()

/**
 * Se a fase e a do chefe final. E a mesma que ehOFim, com outro significado:
 * ninguem "enfrenta" essa fase sozinho — quem chega nela vai para a arena
 * (server/final.js), onde o Coracao do Abismo so cai em grupo.
 */
export const ehFaseDoChefeFinal = ehOFim
