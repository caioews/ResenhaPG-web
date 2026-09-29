/**
 * Mede o Coração do Abismo por simulacao.
 *
 *   npm run coracao
 *   RUNS=2000 npm run coracao           mais lutas por tamanho de grupo
 *   GRUPOS=5,8 npm run coracao          so estes tamanhos
 *   NIVEL=300 RARIDADE=lendario ...     o jogador de referencia
 *
 * Monta grupos de jogadores de referencia — classes sorteadas entre as de
 * ultimo degrau, nivel NIVEL, equipamento cheio de uma raridade — e joga a
 * luta final milhares de vezes. O chefe NAO tem numero fixo: nasce dos
 * atributos do proprio grupo simulado (rpg/coracao.js), exatamente como no
 * jogo. Mudar NIVEL ou RARIDADE aqui e trocar QUEM esta entrando na arena, e
 * o alvo e a luta continuar do mesmo jeito nos dois casos — e a prova de que
 * a escala por atributo funciona: um grupo mais fraco ou mais forte que o de
 * referencia deveria sentir a MESMA dificuldade, nao uma diferente.
 *
 *   vitoria   perto de 30% no grupo minimo, subindo sem exagero com mais
 *             gente: chamar mais jogadores ajuda, mas nao e "quanto mais,
 *             melhor" sem limite
 *   caidos    quantos do grupo terminam a luta no chao. A luta e para ser
 *             SOFRIDA: mesmo quem vence perde varios pelo caminho
 *   rodadas   o quanto ela dura (o teto e `config.rpg.coracao.maxRodadas`)
 *
 * Os numeros de `config.rpg.coracao` (hpPorAtaqueDoGrupo, atqPorVidaDoGrupo,
 * laser, furia) saem daqui. Nao e teste: e regua.
 */
import { config } from '../server/config.js'
import { NOMES_DE_CLASSE, especialidadesDe } from '../server/rpg/classes.js'
import { lutarEmGrupo } from '../server/rpg/combate.js'
import { criarCoracao } from '../server/rpg/coracao.js'
import { referencia } from './simulador.js'

const RUNS = Number(process.env.RUNS ?? 800)
const NIVEL = Number(process.env.NIVEL ?? config.rpg.coracao.nivel)
const RARIDADE = process.env.RARIDADE ?? 'lendario'
const GRUPOS = (process.env.GRUPOS ?? '5,6,8,10').split(',').map(Number)

// Os pesos do config, por variavel de ambiente: e assim que se compara duas
// calibragens sem editar o arquivo no meio.
const c = config.rpg.coracao
if (process.env.HP_POR_ATAQUE) c.hpPorAtaqueDoGrupo = Number(process.env.HP_POR_ATAQUE)
if (process.env.ATQ_POR_VIDA) c.atqPorVidaDoGrupo = Number(process.env.ATQ_POR_VIDA)
if (process.env.DEF) c.def = Number(process.env.DEF)
if (process.env.LASER_MULT) c.laser.mult = Number(process.env.LASER_MULT)
if (process.env.LASER_CADA) c.laser.cada = Number(process.env.LASER_CADA)
if (process.env.LASER_ALVOS) c.laser.alvos = Number(process.env.LASER_ALVOS)
if (process.env.AREA_CADA) c.areaCada = Number(process.env.AREA_CADA)
if (process.env.ATQ_EXTRA) c.atqPorJogadorExtra = Number(process.env.ATQ_EXTRA)

/** As classes do ultimo degrau: e com elas que se chega ao nivel 300. */
function classesFinais() {
  let elenco = NOMES_DE_CLASSE
  for (let tier = 2; tier <= 4; tier++) elenco = elenco.flatMap((id) => especialidadesDe(id))
  return elenco
}

const CLASSES_FINAIS = classesFinais()
const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)]

// Montar o jogador de referencia custa; uma vez por classe basta.
const modelos = new Map(CLASSES_FINAIS.map((id) => [id, referencia(id, NIVEL, RARIDADE)]))

function grupoDe(tamanho) {
  return Array.from({ length: tamanho }, (_, i) => {
    const m = modelos.get(sorteia(CLASSES_FINAIS))
    return { ...m, nome: `${m.nome} ${i + 1}` }
  })
}

const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4)
const col = (v, n) => String(v).padStart(n)

console.log(`# O Coração do Abismo — ${RUNS} lutas por tamanho, nível ${NIVEL}, equipamento ${RARIDADE}`)
console.log(
  `hp/ataque ${c.hpPorAtaqueDoGrupo} · atq/vida ${c.atqPorVidaDoGrupo} · +atq/extra ${c.atqPorJogadorExtra} · ` +
    `def ${c.def} · área a cada ${c.areaCada} · laser a cada ${c.laser.cada} (${c.laser.alvos} alvos, ×${c.laser.mult}) · ` +
    `fúria abaixo de ${c.furia.abaixoDe * 100}%\n`,
)
console.log('grupo  vitória  caídos (média)  rodadas  vida do chefe ao perder  hp chefe   atq chefe')

for (const tamanho of GRUPOS) {
  let venceu = 0
  let caidos = 0
  let rodadas = 0
  let sobra = 0
  let derrotas = 0
  let hpChefe = 0
  let atqChefe = 0

  for (let i = 0; i < RUNS; i++) {
    const grupo = grupoDe(tamanho)
    const chefe = criarCoracao(grupo.map((j) => ({ hp: j.hp, atq: j.atq, def: j.def, agi: j.agi })))
    hpChefe += chefe.hp
    atqChefe += chefe.atq
    const r = lutarEmGrupo(grupo, chefe)
    if (r.venceu) venceu++
    else {
      derrotas++
      sobra += r.chefe.hp / r.chefe.hpMax
    }
    caidos += tamanho - r.dePe
    rodadas += r.rodadas
  }

  console.log(
    `${col(tamanho, 5)}  ${pct(venceu / RUNS)}     ${col((caidos / RUNS).toFixed(1), 4)} de ${col(tamanho, 2)}      ` +
      `${col((rodadas / RUNS).toFixed(1), 5)}    ${derrotas ? pct(sobra / derrotas) : '   —'}` +
      `             ${col(Math.round(hpChefe / RUNS), 8)}  ${col(Math.round(atqChefe / RUNS), 6)}`,
  )
}
