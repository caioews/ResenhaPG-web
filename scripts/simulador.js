/**
 * Mede a dificuldade do RPG por simulacao.
 *
 *   npm run balance
 *
 * Monta jogadores de referencia (classe x nivel x raridade do equipamento),
 * joga milhares de lutas contra monstro comum, elite e chefe de marco, e
 * imprime a taxa de vitoria de cada cruzamento. E o que diz se um ajuste no
 * config deixou o jogo duro ou mole demais — nao serve de teste, serve de
 * regua.
 *
 * Alvos que o jogo persegue acima do nivel 40 (equipamento raro, que e o
 * que um jogador ativo carrega):
 *   comum  ~70%   elite  ~55%   chefe de marco  ~50%
 */
import { config } from '../server/config.js'
import { CLASSES, NOMES_DE_CLASSE, atributosBase, especialidadesDe } from '../server/rpg/classes.js'
import { lutar } from '../server/rpg/combate.js'
import { efeitosDaClasse } from '../server/rpg/habilidades.js'
import { RARIDADES, TIPOS, criarItem } from '../server/rpg/itens.js'
import { criarBoss, sortearMonstro } from '../server/rpg/monstros.js'

const RODADAS = Number(process.env.RODADAS ?? 1500)

/** Um jogador de referencia: classe, nivel e equipamento cheio numa raridade. */
export function referencia(classeId, nivel, raridade) {
  const info = CLASSES[classeId]
  const base = atributosBase(classeId, nivel)
  const soma = { hp: 0, atq: 0, def: 0, agi: 0 }

  // Uma peca por slot. Quando a classe usa mais de uma arma, vale a melhor:
  // um Pistoleiro nao anda com arco depois de achar a pistola.
  const valor = (tipo) => Object.values(criarItem(tipo, nivel, raridade).bonus).reduce((a, b) => a + b, 0)
  const melhorDoSlot = (slot) =>
    info.usa.filter((t) => TIPOS[t]?.slot === slot).sort((a, b) => valor(b) - valor(a))[0]

  const arma = melhorDoSlot('arma')
  const secundario = melhorDoSlot('secundario')

  for (const tipo of [arma, secundario, 'elmo', 'armadura', 'anel'].filter(Boolean)) {
    const item = criarItem(tipo, nivel, raridade)
    for (const [k, v] of Object.entries(item.bonus)) soma[k] += v
  }

  return {
    nome: info.nome,
    nivel,
    hp: base.hp + soma.hp,
    atq: base.atq + soma.atq,
    def: base.def + soma.def,
    agi: base.agi + soma.agi,
    hab: efeitosDaClasse(info),
  }
}

/** Fracao de vitorias do jogador contra um inimigo gerado por `fabrica`. */
export function taxaDeVitoria(jogador, fabrica, rodadas = RODADAS) {
  let venceu = 0

  for (let i = 0; i < rodadas; i++) {
    const inimigo = fabrica()
    const luta = lutar({ ...jogador }, { nome: inimigo.nome, ...inimigo }, Math.random)
    if (luta.vencedor === 'a') venceu++
  }

  return venceu / rodadas
}

const pct = (n) => `${(n * 100).toFixed(0)}%`.padStart(4)

/**
 * Qual elenco usar num nivel: o degrau mais alto que ja estaria aberto.
 * Abaixo de 50 e a classe base; dali para cima, especialidade, maestria e
 * apoteose conforme os niveis do config.
 */
function elencoPara(nivel) {
  const niveis = config.rpg.evolucao.niveis
  let elenco = NOMES_DE_CLASSE

  for (const tier of [2, 3, 4]) {
    if (nivel < niveis[tier]) break
    elenco = elenco.flatMap((id) => especialidadesDe(id))
  }

  return elenco
}

function tabela(niveis, raridades) {
  for (const raridade of raridades) {
    console.log(`\n### equipamento ${RARIDADES[raridade].nome} ${RARIDADES[raridade].emoji}`)
    console.log('nível  classe                    comum  elite  chefe')

    for (const nivel of niveis) {
      for (const classeId of elencoPara(nivel)) {
        const eu = referencia(classeId, nivel, raridade)

        const comum = taxaDeVitoria(eu, () => sortearMonstro(nivel, 0))
        const elite = taxaDeVitoria(eu, () => sortearMonstro(nivel, 1))
        const marco = Math.floor(nivel / 5) * 5
        const chefe = criarBoss(marco)
        const boss = chefe ? taxaDeVitoria(eu, () => chefe) : null

        console.log(
          `${String(nivel).padStart(4)}   ${CLASSES[classeId].nome.padEnd(24)} ${pct(comum)}   ${pct(elite)}  ` +
            `${boss === null ? '   —' : pct(boss)}`,
        )
      }
    }
  }
}

/** Media da taxa de vitoria de todo o elenco de um nivel, por alvo. */
export function medias(nivel, raridade) {
  const elenco = elencoPara(nivel)
  const marco = Math.floor(nivel / 5) * 5
  const chefe = criarBoss(marco)
  const soma = { comum: 0, elite: 0, boss: 0 }

  for (const classeId of elenco) {
    const eu = referencia(classeId, nivel, raridade)
    soma.comum += taxaDeVitoria(eu, () => sortearMonstro(nivel, 0))
    soma.elite += taxaDeVitoria(eu, () => sortearMonstro(nivel, 1))
    soma.boss += chefe ? taxaDeVitoria(eu, () => chefe) : 0
  }

  return {
    comum: soma.comum / elenco.length,
    elite: soma.elite / elenco.length,
    boss: soma.boss / elenco.length,
  }
}

if (process.argv[1]?.endsWith('simulador.js')) {
  console.log(`# Balanceamento do RPG — ${RODADAS} lutas por célula`)
  console.log(`escalaEndgame: ${JSON.stringify(config.rpg.escalaEndgame)}`)

  tabela([10, 20, 30], ['comum', 'raro'])
  tabela([40, 50, 60, 70, 85, 100], ['comum', 'raro', 'lendario'])
}
