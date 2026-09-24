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

/** O fecho da rota tem chefe proprio — nenhum eco serve de ultimo chefe. */
const CHEFE_FINAL = {
  nome: 'O Coração do Abismo',
  emoji: '🫀',
  mult: { hp: 0.95, atq: 2.05, def: 1.85, agi: 1.5 },
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
    nome: `${original.nome} Ecoado${volta > 0 ? ` ${'★'.repeat(Math.min(3, volta))}` : ''}`,
    eco: true,
  }
}

/** O chefe do ato pronto para lutar, ja com o nivel e a forca da fase. */
export function criarChefeDoAto(numeroDoAto, indice) {
  const chefe = chefeDoAto(numeroDoAto)
  const nivel = nivelDaFase(indice) + config.rpg.cacada.chefeNiveisAcima

  return {
    ...criarChefe(chefe, nivel, { forca: forcaDaFase(indice), daRota: true }),
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
