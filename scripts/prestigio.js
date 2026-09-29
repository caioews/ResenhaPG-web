/**
 * Mede o prestígio por simulação.
 *
 *   npm run prestigio
 *   RUNS=3000 npm run prestigio           mais lutas por célula
 *   FATOR=0.6 npm run prestigio           testa um valor sem editar o config
 *
 * O prestígio (rpg/prestigio.js) devolve o personagem ao nível 1, mas ele
 * carrega o equipamento, o reforço e os feitiços que já tinha — só a classe
 * fica ~12% mais forte por volta. Sem nada compensando isso do lado dos
 * inimigos, a rota inteira vira passeio depois da primeira volta: é
 * exatamente essa comparação que este script faz.
 *
 *   veterano   nível 1, prestígio N, mas com o EQUIPAMENTO que ele tinha
 *              antes de prestigiar (nível NIVEL_ANTES, raridade RARIDADE)
 *   novato     nível 1, prestígio 0, com o equipamento comum que a rota
 *              espera de quem está começando — o alvo de sempre (~70%)
 *
 * O alvo é o veterano, contra a rota já com `inimigoPorPrestigio`,
 * encontrar uma taxa de vitória parecida com a do novato: parecida, não
 * igual — prestígio tem de continuar valendo alguma coisa, só não a ponto
 * de esvaziar o jogo. `config.rpg.prestigio.inimigoPorPrestigio` sai daqui.
 */
import { config } from '../server/config.js'
import { CLASSES, NOMES_DE_CLASSE, atributosBase, especialidadesDe } from '../server/rpg/classes.js'
import { lutar } from '../server/rpg/combate.js'
import { efeitosDaClasse } from '../server/rpg/habilidades.js'
import { TIPOS, criarItem } from '../server/rpg/itens.js'
import { sortearMonstro } from '../server/rpg/monstros.js'
import { criarChefeDoAto, faseDoIndice, faseDoNivel, forcaDaFase, indiceDaFase, nivelDaFase } from '../server/rpg/rota.js'
import { referencia } from './simulador.js'

const RUNS = Number(process.env.RUNS ?? 2000)
const NIVEL_ANTES = Number(process.env.NIVEL_ANTES ?? config.rpg.prestigio.nivelMinimo)
const RARIDADE_VETERANO = process.env.RARIDADE_VETERANO ?? 'lendario'
const PRESTIGIOS = (process.env.PRESTIGIOS ?? '1,3,5,10').split(',').map(Number)
const PONTOS = (process.env.FASES ?? '1,5,9').split(',').map(Number) // fase dentro do ato
const ATO = Number(process.env.ATO ?? 1)

if (process.env.FATOR) config.rpg.prestigio.inimigoPorPrestigio = Number(process.env.FATOR)

/** As classes do último degrau — o elenco possível em qualquer nível alto. */
function classesFinais() {
  let elenco = NOMES_DE_CLASSE
  for (let tier = 2; tier <= 4; tier++) elenco = elenco.flatMap((id) => especialidadesDe(id))
  return elenco
}
const CLASSES_FINAIS = classesFinais()
const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)]

/**
 * O veterano: atributos de classe no nível 1 (com o bônus do prestígio),
 * mas equipamento no nível (e raridade) de antes de prestigiar — é
 * exatamente o que um personagem real carrega ao voltar.
 */
function veterano(classeId, prestigio) {
  const info = CLASSES[classeId]
  const base = atributosBase(classeId, 1)
  const escalaPrestigio = 1 + Math.max(0, prestigio) * config.rpg.prestigio.bonusAtributos
  const soma = { hp: 0, atq: 0, def: 0, agi: 0 }

  const valor = (tipo) => Object.values(criarItem(tipo, NIVEL_ANTES, RARIDADE_VETERANO).bonus).reduce((a, b) => a + b, 0)
  const melhorDoSlot = (slot) => info.usa.filter((t) => TIPOS[t]?.slot === slot).sort((a, b) => valor(b) - valor(a))[0]
  const arma = melhorDoSlot('arma')
  const secundario = melhorDoSlot('secundario')

  for (const tipo of [arma, secundario, 'elmo', 'armadura', 'anel'].filter(Boolean)) {
    const item = criarItem(tipo, NIVEL_ANTES, RARIDADE_VETERANO)
    for (const [k, v] of Object.entries(item.bonus)) soma[k] += v
  }

  return {
    nome: info.nome,
    nivel: 1,
    hp: Math.round(base.hp * escalaPrestigio) + soma.hp,
    atq: Math.round(base.atq * escalaPrestigio) + soma.atq,
    def: Math.round(base.def * escalaPrestigio) + soma.def,
    agi: Math.round(base.agi * escalaPrestigio) + soma.agi,
    hab: efeitosDaClasse(info),
  }
}

function taxaDeVitoria(jogador, fabrica, rodadas = RUNS) {
  let venceu = 0
  for (let i = 0; i < rodadas; i++) {
    const inimigo = fabrica()
    const luta = lutar({ ...jogador }, { nome: inimigo.nome, ...inimigo }, Math.random)
    if (luta.vencedor === 'a') venceu++
  }
  return venceu / rodadas
}

const pct = (n) => `${(n * 100).toFixed(0)}%`.padStart(4)

/** A taxa média do elenco inteiro contra comum, elite e chefe de uma fase. */
function medidaDoAto(ato, jogadorDe, fase, prestigioDoInimigo = 0) {
  const indice = indiceDaFase(ato, fase)
  const nivel = nivelDaFase(indice)
  const forca = forcaDaFase(indice)
  const soma = { comum: 0, elite: 0, chefe: 0 }

  for (const classeId of CLASSES_FINAIS) {
    const eu = jogadorDe(classeId)
    soma.comum += taxaDeVitoria(eu, () =>
      sortearMonstro(nivel, 0, Math.random, { forca, daRota: true, prestigio: prestigioDoInimigo }),
    )
    soma.elite += taxaDeVitoria(eu, () =>
      sortearMonstro(nivel, 1, Math.random, { forca, daRota: true, prestigio: prestigioDoInimigo }),
    )
    if (fase === config.rpg.cacada.fasesPorAto) {
      soma.chefe += taxaDeVitoria(eu, () => criarChefeDoAto(ato, indice, prestigioDoInimigo))
    }
  }

  const n = CLASSES_FINAIS.length
  return { comum: soma.comum / n, elite: soma.elite / n, chefe: fase === config.rpg.cacada.fasesPorAto ? soma.chefe / n : null }
}

console.log(`# Prestígio — ${RUNS} lutas por classe e alvo, ato ${ATO}`)
console.log(
  `inimigoPorPrestigio: ${config.rpg.prestigio.inimigoPorPrestigio} · veterano: nível-antes ${NIVEL_ANTES} ` +
    `${RARIDADE_VETERANO}, de volta ao nível 1\n`,
)

// A raridade que a rota espera de quem está progredindo normalmente
// (scripts/chefes.js usa a mesma régua).
const raridadeNoAto = (ato) => (ato <= 6 ? 'incomum' : 'raro')

console.log(`## novato (prestígio 0, equipamento ${raridadeNoAto(ATO)} — a régua de sempre)`)
for (const fase of PONTOS) {
  const nivel = nivelDaFase(indiceDaFase(ATO, fase))
  const r = medidaDoAto(ATO, (classeId) => referencia(classeId, nivel, raridadeNoAto(ATO)), fase)
  console.log(
    `fase ${ATO}-${fase}  comum ${pct(r.comum)}  elite ${pct(r.elite)}` +
      (r.chefe !== null ? `  chefe ${pct(r.chefe)}` : ''),
  )
}

for (const prestigio of PRESTIGIOS) {
  console.log(`\n## veterano — prestígio ${prestigio}`)
  for (const fase of PONTOS) {
    const r = medidaDoAto(ATO, (classeId) => veterano(classeId, prestigio), fase, prestigio)
    console.log(
      `fase ${ATO}-${fase}  comum ${pct(r.comum)}  elite ${pct(r.elite)}` +
        (r.chefe !== null ? `  chefe ${pct(r.chefe)}` : ''),
    )
  }
}
