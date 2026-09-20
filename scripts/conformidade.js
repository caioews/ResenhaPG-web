/**
 * Confere se o porte do motor bate com a especificação.
 *
 *   npm run conformidade
 *
 * Compara os números que este código produz com as tabelas do documento —
 * atributos base por classe e nível (3.6), a escala de fim de jogo (8.4), os
 * atributos de monstro (8.1), os bônus de item (6.4) — e verifica as
 * invariantes da árvore de classes (18.5).
 *
 * Não mede balanceamento: para as taxas de vitória existe o simulador
 * (`npm run balance`), que é o do bot portado sem alteração. Aqui o assunto é
 * outro — a prova de que nenhuma tabela se perdeu na tradução.
 */
import { CLASSES, atributosBase } from '../server/rpg/classes.js'
import { criarItem } from '../server/rpg/itens.js'
import { ESPECIES, atributosDeMonstro, escalaDeNivel } from '../server/rpg/monstros.js'

let erros = 0
const ok = (certo, texto) => {
  if (!certo) erros++
  console.log(`  ${certo ? 'ok  ' : 'ERRO'} ${texto}`)
}

console.log('\nTabelas conferidas contra a especificação\n')

console.log('Atributos base por classe e nível (spec 3.6):')
for (const [id, nivel, esperado] of [
  ['guerreiro', 1, { hp: 120, atq: 12, def: 10, agi: 6 }],
  ['guerreiro', 50, { hp: 806, atq: 120, def: 108, agi: 45 }],
  ['guerreiro', 250, { hp: 3606, atq: 560, def: 508, agi: 205 }],
  ['mago', 100, { hp: 872, atq: 335, def: 104, agi: 127 }],
  ['arqueiro', 25, { hp: 335, atq: 76, def: 35, agi: 60 }],
  ['ladino', 25, { hp: 306, atq: 82, def: 32, agi: 72 }],
  ['duelista', 50, { hp: 644, atq: 131, def: 86, agi: 88 }],
  ['bardo', 150, { hp: 1665, atq: 386, def: 185, agi: 326 }],
  ['clerigo', 200, { hp: 2702, atq: 471, def: 367, agi: 206 }],
]) {
  const obtido = atributosBase(id, nivel)
  const bate = ['hp', 'atq', 'def', 'agi'].every((k) => obtido[k] === esperado[k])
  ok(bate, `${id} nv${nivel}: ${JSON.stringify(obtido)}`)
}

console.log('\nEscala de fim de jogo (spec 8.4):')
for (const [nivel, hp, atq, def, agi] of [
  [1, 1, 1, 1, 1],
  [40, 1, 1, 1, 1],
  [45, 1.209, 1.186, 1.195, 1.065],
  [50, 1.321, 1.285, 1.3, 1.1],
  [100, 1.45, 1.4, 1.42, 1.14],
  [149, 1.45, 1.4, 1.42, 1.14],
  [150, 1.75, 1.7, 1.72, 1.23],
  [199, 1.75, 1.7, 1.72, 1.23],
  [200, 2.3, 2.25, 2.27, 1.395],
  [250, 2.3, 2.25, 2.27, 1.395],
]) {
  const e = escalaDeNivel(nivel)
  const perto = (a, b) => Math.abs(a - b) < 0.002
  ok(
    perto(e.hp, hp) && perto(e.atq, atq) && perto(e.def, def) && perto(e.agi, agi),
    `nv${nivel}: ${e.hp.toFixed(3)} / ${e.atq.toFixed(3)} / ${e.def.toFixed(3)} / ${e.agi.toFixed(3)}` +
      `  (esperado ${hp} / ${atq} / ${def} / ${agi})`,
  )
}

console.log('\nMonstro neutro, todos os multiplicadores em 1 (spec 8.1):')
for (const [nivel, hp, atq, def, agi] of [
  [10, 264, 50, 23, 19],
  [25, 576, 113, 52, 40],
  [50, 1448, 279, 130, 82],
  [100, 3097, 595, 278, 165],
  [150, 5558, 1076, 502, 264],
  [200, 9697, 1892, 881, 398],
]) {
  const m = atributosDeMonstro(nivel, { hp: 1, atq: 1, def: 1, agi: 1 })
  ok(m.hp === hp && m.atq === atq && m.def === def && m.agi === agi, `nv${nivel}: ${JSON.stringify(m)}`)
}

console.log('\nBônus de item no nível 50, raridade comum (spec 6.4):')
for (const [tipo, esperado] of [
  ['espada', { atq: 83 }],
  ['martelo', { atq: 78, def: 21 }],
  // O tambor da especificação virou banjo; os números são os mesmos.
  ['banjo', { atq: 78, hp: 58 }],
  ['pistola', { atq: 94 }],
  ['escudo', { def: 62, hp: 105 }],
  ['grimorio', { atq: 52, hp: 74 }],
  ['capa', { agi: 42, hp: 84 }],
  ['mascara', { agi: 39, atq: 39 }],
  ['elmo', { def: 31, hp: 79 }],
  ['armadura', { def: 57, hp: 158 }],
  ['anel', { agi: 26, atq: 21 }],
]) {
  const item = criarItem(tipo, 50, 'comum')
  const bate =
    Object.keys(esperado).length === Object.keys(item.bonus).length &&
    Object.entries(esperado).every(([k, v]) => item.bonus[k] === v)
  ok(bate, `${tipo}: ${JSON.stringify(item.bonus)}`)
}

console.log('\nMultiplicador de raridade (spec 6.1):')
for (const [raridade, esperado] of [
  ['comum', 83],
  ['incomum', 104],
  ['raro', 133],
  ['epico', 174],
  ['lendario', 249],
]) {
  const item = criarItem('espada', 50, raridade)
  ok(item.bonus.atq === esperado, `espada nv50 ${raridade}: +${item.bonus.atq} ATQ (esperado +${esperado})`)
}

console.log('\nInvariantes da árvore de classes (spec 18.5):')
let quebras = 0
for (const [id, c] of Object.entries(CLASSES)) {
  if (!c.evoluiDe) continue
  const pai = CLASSES[c.evoluiDe]

  // Nenhuma evolução pode reduzir nenhum atributo.
  for (const s of ['hp', 'atq', 'def', 'agi']) {
    if (c.ganho[s] < pai.ganho[s]) {
      console.log(`  ERRO ${id}.${s} (${c.ganho[s]}) é menor que o do pai (${pai.ganho[s]})`)
      quebras++
    }
  }
  // Nenhuma evolução perde um tipo de arma que a anterior usava.
  for (const arma of pai.usa) {
    if (!c.usa.includes(arma)) {
      console.log(`  ERRO ${id} perdeu o tipo "${arma}"`)
      quebras++
    }
  }
  // A base é herdada intacta até a raiz.
  if (JSON.stringify(c.base) !== JSON.stringify(pai.base)) {
    console.log(`  ERRO ${id} não herdou a base do pai`)
    quebras++
  }
}

const habilidades = Object.values(CLASSES)
  .map((c) => c.habilidade)
  .filter(Boolean)
if (new Set(habilidades).size !== habilidades.length) {
  console.log('  ERRO alguma habilidade aparece em duas classes')
  quebras++
}

// Todo caminho termina em exatamente uma apoteose, e a árvore não tem ciclo.
for (const id of Object.keys(CLASSES)) {
  let atual = id
  let passos = 0
  while (CLASSES[atual]?.evoluiDe && passos < 10) {
    atual = CLASSES[atual].evoluiDe
    passos++
  }
  if (passos >= 10) {
    console.log(`  ERRO ciclo na linhagem de ${id}`)
    quebras++
  }
}

erros += quebras
ok(quebras === 0, 'nenhuma evolução reduz atributo, perde arma, troca a base ou repete habilidade')
// 70 habilidades da especificação + 5 passivas de classe base que a versão
// web acrescentou no balanceamento (Mago, Arqueiro, Ladino, Duelista, Bardo).
ok(
  Object.keys(CLASSES).length === 77 && new Set(habilidades).size === 75,
  `${Object.keys(CLASSES).length} classes, ${new Set(habilidades).size} habilidades, ${ESPECIES.length} espécies`,
)

console.log(
  erros
    ? `\n${erros} divergência(s) em relação à especificação.\n`
    : '\nTudo bate com a especificação. Para as taxas de vitória: npm run balance\n',
)

process.exit(erros ? 1 : 0)
