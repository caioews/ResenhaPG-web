/**
 * Mede (e calibra) os chefes de ato jogando a rota inteira.
 *
 *   npm run chefes                    o quanto cada chefe realmente doi
 *   RUNS=300 npm run chefes           mais rotas (menos ruido)
 *   ATE=25 npm run chefes             para no ato 25, para iterar rapido
 *   AJUSTAR=12 npm run chefes         ajusta o ataque de cada chefe, 12
 *                                     rodadas de simulacao, e imprime os
 *                                     valores (so imprime: nao grava nada)
 *
 * Um jogador simulado percorre a rota do ato 1 ao fim: sobe de nivel com o XP
 * que ganha, evolui de classe quando o nivel abre, volta uma fase toda vez
 * que cai. A cada chefe se anota a PRIMEIRA tentativa (passou ou nao) e
 * quantas foram precisas. E o que mede a dificuldade que o jogador sente, e
 * nao a de um jogador "na curva": quem chega ao chefe costuma estar bem acima
 * do nivel da fase (o XP das nove fases de antes o leva la), e um chefe
 * calibrado para o nivel da fase cairia de primeira em quase todo mundo.
 *
 * O alvo e passar de primeira ~50% das vezes: chefe tem que ser a parte mais
 * dura da rota, sem virar parede. O equipamento simulado e cheio de uma
 * raridade so — incomum ate o ato 6, raro dali em diante —, e as classes sao
 * sorteadas: os numeros valem como regua, nao como promessa.
 *
 * O chefe FINAL nao esta aqui: ele e uma raid (rpg/coracao.js) e se mede em
 * outro lugar, com `npm run coracao`. Esta regua vai ate o ato 50.
 *
 * Os `atq` da tabela BOSSES (rpg/monstros.js) e os ATQ_DOS_ECOS (rpg/rota.js)
 * saem daqui. Foram calibrados para os pesos de vida e defesa de
 * `config.rpg.cacada.chefe`: trocar esses dois pesos pede calibrar de novo.
 *
 * Nao e teste: e regua.
 */
import { config } from '../server/config.js'
import { especialidadesDe, NOMES_DE_CLASSE } from '../server/rpg/classes.js'
import { lutar } from '../server/rpg/combate.js'
import { xpParaSubir } from '../server/rpg/jogador.js'
import { recompensas } from '../server/rpg/monstros.js'
import {
  ATQ_DOS_ECOS,
  TOTAL_DE_ATOS,
  chefeDoAto,
  faseAnterior,
  montarFase,
  proximaFase,
} from '../server/rpg/rota.js'
import { referencia } from './simulador.js'

const RUNS = Number(process.env.RUNS ?? 150)
// Vai ate o ato 50: o ato 51 e o do chefe final, que nao se luta sozinho.
const ATE = Number(process.env.ATE ?? TOTAL_DE_ATOS - 1)
const AJUSTAR = Number(process.env.AJUSTAR ?? 0)
/** Trava de seguranca: uma rota que nao termina nao trava a simulacao. */
const MAX_FASES = 20_000

const c = config.rpg.cacada
const niveisDeEvolucao = config.rpg.evolucao.niveis

/** Passar de primeira: ~50% dos chefes de ato. */
const alvoDoAto = () => 0.5

/** O equipamento que se espera de quem esta naquele ato. */
const raridadeNoAto = (ato) => (ato <= 6 ? 'incomum' : 'raro')

const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)]

/** Uma fase jogada do comeco ao fim, com a mesma conta da cacada. */
function jogarFase(eu, ato, fase) {
  const f = montarFase(ato, fase)
  let hp = eu.hp
  let xp = 0

  for (const inimigo of f.inimigos) {
    const luta = lutar({ ...eu, hp }, { nome: inimigo.nome, ...inimigo })
    if (luta.vencedor !== 'a') return { venceu: false, xp }

    xp += recompensas(inimigo, Math.random, f.forca).xp
    hp = Math.min(eu.hp, luta.hpA + eu.hp * c.curaEntreInimigos)
  }

  return { venceu: true, xp }
}

/** Uma rota inteira. Devolve, por ato, as tentativas contra o chefe e o nivel da primeira. */
function jogarARota() {
  let classe = sorteia(NOMES_DE_CLASSE)
  let nivel = 1
  let xp = 0
  let tier = 1
  let onde = { ato: 1, fase: 1 }
  let travada = null
  let fases = 0
  const chefes = new Map()
  let eu = referencia(classe, nivel, raridadeNoAto(onde.ato))

  while (fases < MAX_FASES && onde.ato <= ATE) {
    const r = jogarFase(eu, onde.ato, onde.fase)
    fases++
    xp += r.xp

    if (onde.fase === c.fasesPorAto) {
      const registro = chefes.get(onde.ato) ?? chefes.set(onde.ato, { tentativas: [], nivel }).get(onde.ato)
      registro.tentativas.push(r.venceu)
    }

    let subiu = false
    while (xp >= xpParaSubir(nivel)) {
      xp -= xpParaSubir(nivel)
      nivel++
      subiu = true

      // Evolucao de classe: quando o nivel abre, escolhe uma das opcoes.
      for (const t of [2, 3, 4]) {
        if (tier < t && nivel >= niveisDeEvolucao[t]) {
          const opcoes = especialidadesDe(classe)
          if (opcoes.length) classe = sorteia(opcoes)
          tier = t
        }
      }
    }
    // O equipamento so e remontado quando algo muda: montar a cada fase custa caro.
    if (subiu || onde.fase === 1) eu = referencia(classe, nivel, raridadeNoAto(onde.ato))

    if (!r.venceu) {
      travada = travada ?? { ...onde }
      onde = faseAnterior(onde)
      continue
    }

    const destino = travada ?? proximaFase(onde)
    travada = null
    onde = destino
  }

  return chefes
}

/** RUNS rotas, somadas por ato. */
function medir() {
  const soma = new Map()

  for (let i = 0; i < RUNS; i++) {
    for (const [ato, registro] of jogarARota()) {
      const s = soma.get(ato) ?? soma.set(ato, { n: 0, primeira: 0, tentativas: 0, nivel: 0 }).get(ato)
      s.n++
      s.primeira += registro.tentativas[0] ? 1 : 0
      const passou = registro.tentativas.indexOf(true) + 1
      s.tentativas += passou > 0 ? passou : registro.tentativas.length
      s.nivel += registro.nivel
    }
  }

  return [...soma.entries()].sort((a, b) => a[0] - b[0])
}

/** O ataque de cada chefe, onde ele mora: a tabela ou os ecos. */
const atqDo = (ato) => (ato >= 20 && ato < TOTAL_DE_ATOS ? ATQ_DOS_ECOS[ato] : chefeDoAto(ato).mult.atq)

function definirAtq(ato, valor) {
  // O `mult` de chefeDoAto e o mesmo objeto da tabela.
  if (ato >= 20 && ato < TOTAL_DE_ATOS) ATQ_DOS_ECOS[ato] = valor
  else chefeDoAto(ato).mult.atq = valor
}

const col = (v, n) => String(v).padStart(n)

function linha(ato, s) {
  return (
    `${col(ato, 3)}  ${chefeDoAto(ato).nome.padEnd(30)} atq ${col(atqDo(ato).toFixed(2), 5)}   ` +
    `de primeira ${col(Math.round((s.primeira / s.n) * 100), 3)}% (alvo ${Math.round(alvoDoAto(ato) * 100)}%)   ` +
    `tentativas ${col((s.tentativas / s.n).toFixed(1), 4)}   nivel ${col((s.nivel / s.n).toFixed(0), 3)}`
  )
}

console.log(`# Os chefes — ${RUNS} rotas simuladas até o ato ${ATE}`)
console.log(`pesos: ${JSON.stringify(c.chefe)}\n`)

if (!AJUSTAR) {
  for (const [ato, s] of medir()) console.log(linha(ato, s))
} else {
  for (let rodada = 1; rodada <= AJUSTAR; rodada++) {
    const resultado = medir()
    let erro = 0

    for (const [ato, s] of resultado) {
      const taxa = s.primeira / s.n
      erro += Math.abs(taxa - alvoDoAto(ato))
      if (rodada === AJUSTAR) console.log(linha(ato, s))

      // Passou mais que o alvo: o chefe fica mais forte. Menos: mais fraco. O
      // passo encolhe a cada rodada: a simulacao tem ruido, e um passo fixo
      // ficaria pulando em volta do alvo em vez de parar nele.
      const passo = 1.4 / (1 + 0.35 * (rodada - 1))
      const novo = Math.max(0.05, Math.min(8, atqDo(ato) * Math.exp((taxa - alvoDoAto(ato)) * passo)))
      definirAtq(ato, Math.round(novo * 100) / 100)
    }

    console.error(`rodada ${rodada}: erro medio ${(erro / resultado.length).toFixed(3)}`)
  }

  const saida = {}
  for (let ato = 1; ato <= Math.min(ATE, TOTAL_DE_ATOS); ato++) saida[ato] = atqDo(ato)
  console.log('\nato -> atq (para a tabela BOSSES ou ATQ_DOS_ECOS):')
  console.log(JSON.stringify(saida))
}
