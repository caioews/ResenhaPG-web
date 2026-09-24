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
import { sortearMonstro } from '../server/rpg/monstros.js'
import { criarChefeDoAto, faseDoIndice, faseDoNivel, forcaDaFase } from '../server/rpg/rota.js'

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
 * Em que ponto da rota um nivel se encaixa, e o chefe que espera por la.
 *
 * A dificuldade deixou de sair do nivel do jogador e passou a sair da FASE
 * (server/rpg/rota.js): quem quer saber se o nivel 60 esta duro precisa
 * medir contra a fase em que o nivel 60 cai, nao contra um monstro nivel 60
 * qualquer. E o que esta funcao faz.
 */
export function pontoDaRota(nivel) {
  const indice = faseDoNivel(nivel)
  const { ato, fase } = faseDoIndice(indice)
  return { indice, ato, fase, forca: forcaDaFase(indice), chefe: criarChefeDoAto(ato, indice) }
}

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
    console.log('nível  fase   classe                    comum  elite  chefe')

    for (const nivel of niveis) {
      const ponto = pontoDaRota(nivel)
      for (const classeId of elencoPara(nivel)) {
        const eu = referencia(classeId, nivel, raridade)

        const comum = taxaDeVitoria(eu, () => sortearMonstro(nivel, 0, Math.random, { forca: ponto.forca, daRota: true }))
        const elite = taxaDeVitoria(eu, () => sortearMonstro(nivel, 1, Math.random, { forca: ponto.forca, daRota: true }))
        const boss = taxaDeVitoria(eu, () => ponto.chefe)

        console.log(
          `${String(nivel).padStart(4)}   ${`${ponto.ato}-${ponto.fase}`.padStart(5)}  ` +
            `${CLASSES[classeId].nome.padEnd(24)} ${pct(comum)}   ${pct(elite)}  ${pct(boss)}`,
        )
      }
    }
  }
}

/** Media da taxa de vitoria de todo o elenco de um nivel, por alvo. */
export function medias(nivel, raridade) {
  const elenco = elencoPara(nivel)
  const ponto = pontoDaRota(nivel)
  const soma = { comum: 0, elite: 0, boss: 0 }

  for (const classeId of elenco) {
    const eu = referencia(classeId, nivel, raridade)
    soma.comum += taxaDeVitoria(eu, () => sortearMonstro(nivel, 0, Math.random, { forca: ponto.forca, daRota: true }))
    soma.elite += taxaDeVitoria(eu, () => sortearMonstro(nivel, 1, Math.random, { forca: ponto.forca, daRota: true }))
    soma.boss += taxaDeVitoria(eu, () => ponto.chefe)
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
