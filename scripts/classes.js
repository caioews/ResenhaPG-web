/**
 * Força de cada classe, degrau por degrau: PvP e PvE juntos.
 *
 *   npm run classes
 *   N=60 npm run classes            (passada rápida)
 *   TIERS=4 npm run classes         (só as apoteoses)
 *
 * Para cada degrau da árvore, junta as classes que existem nele e mede:
 *
 *   PvP    vitória média contra todas as outras do mesmo degrau, mesmo
 *          nível e mesmo equipamento, as duas ordens de turno
 *   PvE    vitória contra monstro comum, elite e chefe do marco, em dois
 *          níveis do degrau
 *   força  a média das duas colunas
 *
 * É a régua usada no balanceamento das classes: dentro de um degrau, as
 * forças devem ficar parecidas. Marca com ▼ quem ficou mais de 10 pontos
 * abaixo da mediana e com ▲ quem ficou mais de 12 acima.
 *
 * Complementa o `npm run balance`, que mede o jogador contra o mundo; este
 * mede as classes umas contra as outras.
 */
import { pontoDaRota, referencia } from './simulador.js'
import { CLASSES, NOMES_DE_CLASSE, especialidadesDe } from '../server/rpg/classes.js'
import { lutar } from '../server/rpg/combate.js'
import { sortearMonstro } from '../server/rpg/monstros.js'

const N = Number(process.env.N ?? 120)
const RARIDADE = process.env.RARIDADE ?? 'raro'
const TIERS = (process.env.TIERS ?? '1,2,3,4').split(',').map(Number)

/** Níveis medidos em cada degrau: PvE em dois pontos, PvP em um. */
const NIVEIS = {
  1: { pve: [20, 45], pvp: 30 },
  2: { pve: [60, 110], pvp: 80 },
  3: { pve: [160, 190], pvp: 170 },
  4: { pve: [210, 250], pvp: 220 },
}

const NOME_DO_DEGRAU = { 1: 'classes base', 2: 'especialidades', 3: 'maestrias', 4: 'apoteoses' }

const pct = (x) => `${Math.round(x * 100)}`.padStart(3)

// O combate mexe no lutador (fúria, maldição): cada luta recebe uma cópia.
const copia = (x) => ({ ...x, hab: { ...x.hab } })

function elencoDoDegrau(tier) {
  let elenco = NOMES_DE_CLASSE
  for (let t = 2; t <= tier; t++) elenco = elenco.flatMap((id) => especialidadesDe(id))
  return elenco
}

function pvp(nivel, elenco) {
  const refs = Object.fromEntries(elenco.map((id) => [id, referencia(id, nivel, RARIDADE)]))
  const soma = Object.fromEntries(elenco.map((id) => [id, 0]))

  for (let i = 0; i < elenco.length; i++) {
    for (let j = i + 1; j < elenco.length; j++) {
      const a = elenco[i]
      const b = elenco[j]
      let venceuA = 0
      for (let k = 0; k < N; k++) {
        // Alterna quem é o lado A, que ganha o empate de agilidade.
        const inverte = k % 2 === 1
        const luta = inverte ? lutar(copia(refs[b]), copia(refs[a])) : lutar(copia(refs[a]), copia(refs[b]))
        if (inverte ? luta.vencedor === 'b' : luta.vencedor === 'a') venceuA++
      }
      soma[a] += venceuA / N
      soma[b] += 1 - venceuA / N
    }
  }

  return Object.fromEntries(elenco.map((id) => [id, soma[id] / (elenco.length - 1)]))
}

function pve(id, nivel) {
  const eu = referencia(id, nivel, RARIDADE)
  const ponto = pontoDaRota(nivel)
  const taxa = (fabrica) => {
    let v = 0
    for (let i = 0; i < N; i++) if (lutar(copia(eu), { ...fabrica() }).vencedor === 'a') v++
    return v / N
  }
  return {
    comum: taxa(() => sortearMonstro(nivel, 0, Math.random, { forca: ponto.forca, daRota: true })),
    elite: taxa(() => sortearMonstro(nivel, 1, Math.random, { forca: ponto.forca, daRota: true })),
    chefe: taxa(() => ponto.chefe),
  }
}

console.log(`# Força das classes — equipamento ${RARIDADE}, ${N} lutas por confronto`)

for (const tier of TIERS) {
  const elenco = elencoDoDegrau(tier)
  const { pve: niveisPve, pvp: nivelPvp } = NIVEIS[tier]
  const duelos = pvp(nivelPvp, elenco)

  const linhas = elenco
    .map((id) => {
      const medidas = niveisPve.map((nivel) => pve(id, nivel))
      const media = (k) => medidas.reduce((s, m) => s + m[k], 0) / medidas.length
      const mundo = { comum: media('comum'), elite: media('elite'), chefe: media('chefe') }
      const pveMedio = (mundo.comum + mundo.elite + mundo.chefe) / 3
      return { id, pvp: duelos[id], mundo, forca: (duelos[id] + pveMedio) / 2 }
    })
    .sort((a, b) => b.forca - a.forca)

  const forcas = linhas.map((l) => l.forca)
  const mediana = forcas[Math.floor(forcas.length / 2)]

  console.log(
    `\n## ${NOME_DO_DEGRAU[tier]} · PvE nível ${niveisPve.join(' e ')} · PvP nível ${nivelPvp}` +
      ` · mediana ${pct(mediana)} · faixa ${pct(forcas.at(-1))}–${pct(forcas[0])}`,
  )
  console.log('classe                               força  PvP   comum elite chefe')
  for (const l of linhas) {
    const c = CLASSES[l.id]
    const marca = l.forca < mediana - 0.1 ? '  ▼' : l.forca > mediana + 0.12 ? '  ▲' : ''
    console.log(
      `${`${c.emoji} ${c.nome}`.padEnd(36)} ${pct(l.forca)}   ${pct(l.pvp)}   ${pct(l.mundo.comum)}   ${pct(l.mundo.elite)}   ${pct(l.mundo.chefe)}${marca}`,
    )
  }
}
