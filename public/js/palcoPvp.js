/**
 * A Arena dos Campeões, no palco: onde um duelo de PvP é visto.
 *
 * É uma cena parada, como a do chefe final — ninguém anda, a câmera não se
 * mexe. Dois lutadores, um de cada lado da arena, com a skin que cada um tem
 * equipada. A luta em si já foi decidida pelo servidor (é instantânea:
 * `lutar()`, o mesmo motor de sempre); aqui só se anima o log, uma entrada
 * por vez, junto com o texto que a narrativa já mostra.
 */
import {
  ALTURA,
  LARGURA,
  agora,
  aoTrocarDeCena,
  arteDoPalco,
  criarLutador,
  limitar,
  palcoNoPvp,
  pronta,
  quadroDe,
  registrarCena,
  spriteDaClasse,
  tentarCarregar,
  tingir,
  tocar,
  trocarCena,
} from './palco.js'

/** A skin equipada, se houver arte pronta para ela — senão, a classe base. */
const spriteDoLado = (lado) =>
  lado.skinEquipada && arteDoPalco()?.lutadores?.[lado.skinEquipada] ? lado.skinEquipada : spriteDaClasse(lado.classeBase)

/** Onde cada lado pisa, e o tamanho deles na cena. */
const POSTO_A = { x: 195, y: 222 }
const POSTO_B = { x: 445, y: 222 }
const ESCALA = 0.72

const f = { ativo: false, fundo: null, a: null, b: null, flutuantes: [] }

const arte = () => arteDoPalco()?.cenario?.pvp ?? null

/** Se a arte da arena existe: sem ela o duelo narra só em texto. */
export const arenaPvpDisponivel = () => Boolean(arte())
export const naArenaPvp = () => f.ativo

async function carregar(lados) {
  const pedidos = [tentarCarregar(arte().arquivo)]
  for (const lado of [lados.a, lados.b]) {
    const chave = spriteDoLado(lado)
    if (chave && arteDoPalco()?.lutadores?.[chave]) pedidos.push(tentarCarregar(arteDoPalco().lutadores[chave].arquivo))
  }
  await Promise.all(pedidos)
  f.fundo = arte().arquivo
}

/**
 * Leva o palco para a arena. `lados` é `{ a, b }`, cada um com nome, id,
 * classeBase e skinEquipada — o mesmo formato de `duelo.lados` que a rota
 * do PvP já devolve.
 */
export async function irParaArenaPvp(lados) {
  if (!arenaPvpDisponivel()) throw new Error('sem arte da arena de pvp')
  await carregar(lados)

  const chaveA = spriteDoLado(lados.a)
  const chaveB = spriteDoLado(lados.b)
  f.a = Object.assign(criarLutador(chaveA, { x: POSTO_A.x, virado: 1 }), { y: POSTO_A.y, nome: lados.a.nome, id: lados.a.id })
  f.b = Object.assign(criarLutador(chaveB, { x: POSTO_B.x, virado: -1 }), { y: POSTO_B.y, nome: lados.b.nome, id: lados.b.id })
  f.flutuantes = []
  f.ativo = true
  if (!palcoNoPvp()) await trocarCena('pvp')
}

/** Sai da arena: a próxima cena assume o palco. */
export function sairDaArenaPvp() {
  f.ativo = false
  f.a = null
  f.b = null
}

aoTrocarDeCena((nome) => {
  if (nome !== 'pvp') sairDaArenaPvp()
})

// ---------------------------------------------------------------- a luta

function flutuar(l, texto, cor) {
  if (!l) return
  f.flutuantes.push({ x: l.x, y: l.y, texto, cor, nasceu: agora() })
}

const COR_DA_HABILIDADE = '#c9a0ff'
const nomeDaHabilidade = (especial) => (especial ? `${especial.emoji} ${especial.nome}` : '')
const dano = (entrada) => Math.round(entrada.dano ?? 0).toLocaleString('pt-BR')

/**
 * Uma entrada do log de `lutar()` virando movimento. É o mesmo formato que
 * o `golpe()` da rota já entende (`quem` é 'a' ou 'b') — só que aqui os dois
 * lados são gente, não herói-contra-monstro.
 */
export function golpePvp(entrada) {
  if (!f.ativo || !f.a || !f.b) return

  const eu = entrada.quem === 'b' ? f.b : f.a
  const outro = entrada.quem === 'b' ? f.a : f.b

  if (entrada.tipo === 'regenerou') return flutuar(eu, `+${Math.round(entrada.cura ?? 0)}`, '#7bc47b')
  if (entrada.tipo === 'preso' || eu.caiuEm || outro.caiuEm) return

  if (entrada.tipo === 'queimadura') return flutuar(eu, `-${dano(entrada)}`, '#ff8a3d')
  if (entrada.tipo === 'especial') return flutuar(eu, nomeDaHabilidade(entrada.especial), COR_DA_HABILIDADE)
  if (entrada.tipo === 'reflexo') {
    flutuar(eu, nomeDaHabilidade(entrada.especial), COR_DA_HABILIDADE)
    outro.flash = agora()
    return flutuar(outro, `-${dano(entrada)}`, '#f0e8d8')
  }

  tocar(eu, 'atacar')
  eu.impulso = agora()
  tocar(outro, 'defender')
  if (entrada.marca === 'especial') flutuar(eu, nomeDaHabilidade(entrada.especial), COR_DA_HABILIDADE)

  if (entrada.esquivou) {
    outro.empurrao = { desde: agora(), quanto: -outro.virado * 20 }
    return entrada.evasao
      ? flutuar(outro, nomeDaHabilidade(entrada.especial), COR_DA_HABILIDADE)
      : flutuar(outro, 'esquiva', '#9fd1e8')
  }

  outro.flash = agora()
  outro.empurrao = { desde: agora(), quanto: -outro.virado * 12 }
  flutuar(outro, `-${dano(entrada)}`, entrada.executou ? '#ff9d5c' : entrada.critico ? '#ffd166' : '#f0e8d8')
}

/** Fim do duelo: quem perdeu cai. */
export function fimDaLutaPvp({ venceu }) {
  if (!f.ativo || !f.a || !f.b) return
  const perdedor = venceu ? f.b : f.a
  const vencedor = venceu ? f.a : f.b
  perdedor.caiuEm = agora()
  tocar(perdedor, 'defender')
  tocar(vencedor, 'parado')
}

// --------------------------------------------------------------- desenho

function desenharFundo(ctx) {
  ctx.fillStyle = '#07040a'
  ctx.fillRect(0, 0, LARGURA, ALTURA)
  const img = pronta(f.fundo)
  if (!img) return
  const escala = Math.max(LARGURA / img.width, ALTURA / img.height)
  const dw = img.width * escala
  const dh = img.height * escala
  ctx.drawImage(img, (LARGURA - dw) / 2, (ALTURA - dh) / 2, dw, dh)
}

/** Um lutador na arena: sombra, quadro do atlas, barra de baque, nome. */
function desenharLado(ctx, l, t) {
  const img = pronta(l.meta.arquivo)
  if (!img) return

  const [cw, ch] = l.meta.quadro
  const [ax, ay] = l.meta.ancora
  const { animacao, linha, coluna, terminou } = quadroDe(l, t)
  if (terminou && !animacao.laco && !l.caiuEm) tocar(l, 'parado')

  const desdeImpulso = l.impulso ? t - l.impulso : Infinity
  const avanco = desdeImpulso < 260 ? Math.sin((desdeImpulso / 260) * Math.PI) * 22 * l.virado : 0
  const desdeEmpurrao = l.empurrao ? t - l.empurrao.desde : Infinity
  const recuo = desdeEmpurrao < 240 ? (1 - desdeEmpurrao / 240) * l.empurrao.quanto : 0
  const respiro = l.anim === 'parado' ? Math.sin(t / 620 + l.balanco) * 1.4 : 0
  const flash = l.flash ? Math.max(0, 1 - (t - l.flash) / 260) : 0
  const queda = l.caiuEm ? limitar((t - l.caiuEm) / 420, 0, 1) : 0

  ctx.globalAlpha = 0.35 * (1 - queda * 0.4)
  ctx.fillStyle = '#05030a'
  ctx.beginPath()
  ctx.ellipse(l.x, l.y + 3, 17, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.save()
  ctx.translate(l.x + avanco + recuo, l.y + respiro)
  if (queda) {
    ctx.rotate(queda * (Math.PI / 2) * 0.82 * (l.virado === 1 ? -1 : 1))
    ctx.globalAlpha = 1 - queda * 0.5
  }
  if (l.virado === -1) ctx.scale(-1, 1)
  ctx.scale(ESCALA, ESCALA)

  const sx = coluna * cw
  const sy = linha * ch
  if (flash > 0) ctx.drawImage(tingir(img, sx, sy, cw, ch, flash), 0, 0, cw, ch, -ax, -ay, cw, ch)
  else ctx.drawImage(img, sx, sy, cw, ch, -ax, -ay, cw, ch)
  ctx.restore()

  ctx.globalAlpha = 1
  ctx.font = '600 12px Cinzel, Georgia, serif'
  ctx.textAlign = 'center'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(6,4,10,0.9)'
  const topo = l.y - ch * ESCALA * 0.66
  ctx.strokeText(l.nome ?? '', l.x, topo)
  ctx.fillStyle = '#e8dcc4'
  ctx.fillText(l.nome ?? '', l.x, topo)
}

function desenharFlutuantes(ctx, t) {
  f.flutuantes = f.flutuantes.filter((n) => t - n.nasceu < 900)
  ctx.textAlign = 'center'
  for (const n of f.flutuantes) {
    const k = (t - n.nasceu) / 900
    ctx.globalAlpha = limitar(1 - k, 0, 1)
    ctx.font = '700 15px "JetBrains Mono", monospace'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(6,4,10,0.9)'
    ctx.strokeText(n.texto, n.x, n.y - 40 - k * 30)
    ctx.fillStyle = n.cor
    ctx.fillText(n.texto, n.x, n.y - 40 - k * 30)
  }
  ctx.globalAlpha = 1
}

function desenharArenaPvp(ctx, t) {
  if (!f.ativo) {
    ctx.fillStyle = '#07040a'
    ctx.fillRect(0, 0, LARGURA, ALTURA)
    return
  }

  desenharFundo(ctx)
  for (const l of [f.a, f.b].filter(Boolean).sort((x, y) => x.y - y.y)) desenharLado(ctx, l, t)
  desenharFlutuantes(ctx, t)

  const veu = ctx.createLinearGradient(0, ALTURA - 50, 0, ALTURA)
  veu.addColorStop(0, 'rgba(8,6,14,0)')
  veu.addColorStop(1, 'rgba(8,6,14,0.45)')
  ctx.fillStyle = veu
  ctx.fillRect(0, ALTURA - 50, LARGURA, 50)
}

registrarCena('pvp', desenharArenaPvp)
