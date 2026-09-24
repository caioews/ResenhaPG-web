/**
 * Mede a rota inteira por simulacao: do ato 1, nivel 1, ate onde der.
 *
 *   npm run rota
 *   ESCALA=1.4 npm run rota          (testa outro escalaDeDificuldade)
 *   RARIDADE=raro npm run rota       (outro equipamento de referencia)
 *   ATE=20 npm run rota              (para no ato 20, para iterar rapido)
 *
 * Joga a rota como um jogador jogaria — uma fase por vez, a horda inteira
 * sem cura no meio, XP entrando, nivel subindo, e voltando uma fase toda vez
 * que cai — e imprime, ato a ato, com que nivel se chega la e quantas fases
 * foram precisas.
 *
 * E a regua de `config.rpg.cacada`. O que se quer ver:
 *
 *   fases/ato   perto de 10 no comeco (passa reto) e subindo devagar depois.
 *               E a friccao que faz o jogador parar para melhorar o
 *               personagem em vez de zerar o jogo numa tarde. Centenas de
 *               fases num ato so significa parede, nao desafio.
 *   nivel       acompanhando de perto o nivel da fase. Se o jogador precisa
 *               estar tres vezes acima para passar, o XP (que sai do nivel
 *               do INIMIGO) nao acompanha, e a moagem explode.
 *
 * Nao e teste: e regua. Nenhum numero daqui e verificado em lugar nenhum.
 */
import { config } from '../server/config.js'
import { lutar } from '../server/rpg/combate.js'
import { xpParaSubir } from '../server/rpg/jogador.js'
import { recompensas } from '../server/rpg/monstros.js'
import {
  TOTAL_DE_ATOS,
  ato,
  faseAnterior,
  indiceDaFase,
  montarFase,
  nivelDaFase,
  proximaFase,
} from '../server/rpg/rota.js'
import { referencia } from './simulador.js'

const CLASSE = process.env.CLASSE ?? 'guerreiro'
const RARIDADE = process.env.RARIDADE ?? 'incomum'
const ATE = Number(process.env.ATE ?? TOTAL_DE_ATOS)
/** Trava de seguranca: a simulacao para aqui em vez de rodar para sempre. */
const MAX_FASES = Number(process.env.MAX_FASES ?? 60_000)

// Os botoes do config, por variavel de ambiente: e assim que se compara duas
// calibragens sem editar o arquivo no meio.
const c = config.rpg.cacada
if (process.env.ESCALA) c.escalaDeDificuldade = Number(process.env.ESCALA)
if (process.env.FORCA) c.forcaPorFase = Number(process.env.FORCA)
if (process.env.NIVEL_POR_FASE) c.nivelPorFase = Number(process.env.NIVEL_POR_FASE)
if (process.env.CURA) c.curaEntreInimigos = Number(process.env.CURA)
if (process.env.HORDA) c.inimigos.base = Number(process.env.HORDA)

/** Uma fase jogada do comeco ao fim. */
function jogarFase(eu, numeroDoAto, numeroDaFase) {
  const fase = montarFase(numeroDoAto, numeroDaFase)
  let hp = eu.hp
  let xp = 0

  for (const inimigo of fase.inimigos) {
    const luta = lutar({ ...eu, hp }, { nome: inimigo.nome, ...inimigo })
    if (luta.vencedor !== 'a') return { venceu: false, xp }

    xp += recompensas(inimigo, Math.random, fase.forca).xp
    hp = Math.min(eu.hp, luta.hpA + eu.hp * c.curaEntreInimigos)
  }

  return { venceu: true, xp }
}

/**
 * A rota inteira, com um jogador que se comporta como gente: quando cai,
 * repete a fase anterior e tenta de novo assim que a vence.
 */
function jogarARota() {
  let nivel = 1
  let xp = 0
  let onde = { ato: 1, fase: 1 }
  let travada = null
  let fases = 0

  // Por ato: quantas fases foram jogadas dentro dele, quantas derrotas, e
  // com que nivel o jogador o venceu.
  const porAto = new Map()
  const anote = (a) => porAto.get(a) ?? porAto.set(a, { fases: 0, derrotas: 0, nivel: 0 }).get(a)

  // O equipamento so e remontado quando o nivel muda: montar a cada fase
  // custa caro e nao muda nada.
  let eu = referencia(CLASSE, nivel, RARIDADE)

  while (fases < MAX_FASES && onde.ato <= ATE) {
    const marca = anote(onde.ato)
    const r = jogarFase(eu, onde.ato, onde.fase)
    fases++
    marca.fases++
    xp += r.xp

    const antes = nivel
    while (xp >= xpParaSubir(nivel)) {
      xp -= xpParaSubir(nivel)
      nivel++
    }
    if (nivel !== antes) eu = referencia(CLASSE, nivel, RARIDADE)

    if (!r.venceu) {
      marca.derrotas++
      travada = travada ?? { ...onde }
      onde = faseAnterior(onde)
      continue
    }

    marca.nivel = nivel
    // Venceu: se estava repetindo, volta a encarar a fase que o derrubou.
    const destino = travada ?? proximaFase(onde)
    travada = null
    // Fim da rota: a ultima fase do ultimo ato nao tem para onde apontar.
    if (destino.ato === onde.ato && destino.fase === onde.fase && onde.ato === TOTAL_DE_ATOS) break
    onde = destino
  }

  return { porAto, fases, nivel, chegou: onde }
}

const n = (v, largura) => String(v).padStart(largura)

console.log(`# A rota — ${CLASSE}, equipamento ${RARIDADE}`)
console.log(
  `escala ${c.escalaDeDificuldade} · forcaPorFase ${c.forcaPorFase} · nivelPorFase ${c.nivelPorFase} · ` +
    `cura entre inimigos ${c.curaEntreInimigos} · horda base ${c.inimigos.base}\n`,
)
console.log('ato  nome                          nível  nv.fase  força  fases  derrotas  acum.')

const { porAto, fases, nivel, chegou } = jogarARota()
let acumulado = 0

for (const [numero, m] of [...porAto.entries()].sort((a, b) => a[0] - b[0])) {
  acumulado += m.fases
  const indice = indiceDaFase(numero, c.fasesPorAto)
  const forca = 1 + (indice - 1) * c.forcaPorFase * c.escalaDeDificuldade
  console.log(
    `${n(numero, 3)}  ${(ato(numero)?.nome ?? '').padEnd(28)} ${n(m.nivel || nivel, 5)}  ` +
      `${n(nivelDaFase(indice), 7)}  ${n(forca.toFixed(2), 5)}  ${n(m.fases, 5)}  ` +
      `${n(m.derrotas, 8)}  ${n(acumulado, 5)}`,
  )
}

console.log(`\n${fases} fases jogadas. Terminou no nível ${nivel}, no ato ${chegou.ato}, fase ${chegou.fase}.`)
