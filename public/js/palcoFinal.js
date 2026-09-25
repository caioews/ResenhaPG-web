/**
 * A arena do Coração do Abismo, no palco.
 *
 * É a única cena que não anda: ninguém caminha, a câmera não se mexe. O
 * desenho é uma pilha de camadas, de trás para a frente, como o cenário foi
 * pensado:
 *
 *   1. o fundo      o céu partido e as ilhas ao longe
 *   2. o chefe      colossal, saindo de dentro da arena
 *   3. a arena      a plataforma central (o chefe fica ATRÁS dela)
 *   4. os jogadores em pé em cima da arena, todos que chegaram até aqui
 *   5. os efeitos   projéteis, o laser, ondas de choque, números
 *
 * Valem as mesmas duas regras do palco.js: aqui só se desenha o que o
 * servidor já decidiu (o log da luta), e todo tempo é relógio de parede.
 *
 * A luta é contada uma entrada de log por vez (`animar`), e cada entrada diz
 * quanto tempo o narrador deve esperar antes da seguinte — é assim que uma
 * saraivada de golpes passa rápido e o laser tem o seu momento.
 */
import {
  ALTURA,
  LARGURA,
  agora,
  aoTrocarDeCena,
  arteDoPalco,
  criarLutador,
  limitar,
  palcoNoFinal,
  pronta,
  quadroDe,
  registrarCena,
  spriteDaClasse,
  tentarCarregar,
  tingir,
  tocar,
  trocarCena,
} from './palco.js'

// ------------------------------------------------------------ composição

/** Onde a base do chefe fica, em pixels de palco: no meio da arena. */
const CHEFE = { x: 320, y: 262 }
/** Do tamanho do atlas para o tamanho em cena. Ele é colossal. */
const ESCALA_CHEFE = 1
/** O herói é pequeno perto dele. */
const ESCALA_HEROI = 0.4

/**
 * Onde cada jogador pisa, na ordem em que chegaram: primeiro a frente e o
 * meio, depois para os lados e para o fundo da arena. Cabem doze.
 */
const LUGARES = [
  [320, 268],
  [262, 263],
  [378, 263],
  [204, 257],
  [436, 257],
  [290, 246],
  [350, 246],
  [232, 243],
  [408, 243],
  [170, 248],
  [470, 248],
  [320, 236],
]

/** O ritmo de cada pose do chefe, em ms por quadro. `laco` repete. */
const POSES = {
  respiro: { porQuadro: 340, laco: true },
  dormindo: { porQuadro: 900, laco: true },
  acordando: { porQuadro: 300 },
  rugir: { porQuadro: 800 },
  golpe: { porQuadro: 170 },
  pancada: { porQuadro: 240 },
  carregar: { porQuadro: 340 },
  laser: { porQuadro: 900 },
  ferido: { porQuadro: 110 },
  caindo: { porQuadro: 700 },
}

const COR_DO_LASER = { fora: 'rgba(255,40,70,0.30)', meio: 'rgba(255,90,120,0.85)', nucleo: 'rgba(255,235,240,0.98)' }

// -------------------------------------------------------------- estado

const f = {
  ativo: false,
  fundo: null,
  arena: null,
  euId: null,
  /** id do personagem -> jogador em pé na arena */
  jogadores: new Map(),
  chefe: null,
  /** Nomes de quem está lutando agora (vazio fora de uma luta). */
  lutando: new Set(),
  info: '',
  flutuantes: [],
  projeteis: [],
  feixes: [],
  ondas: [],
  brasas: [],
  tremor: { ate: 0, forca: 0 },
  clarao: { ate: 0, cor: '255,40,60', forca: 0 },
}

function chefeNovo() {
  return { anim: 'dormindo', desde: agora(), hp: 1, hpMax: 1, flash: 0, furia: false, caiuEm: 0, some: 0 }
}

const arte = () => arteDoPalco()?.chefeFinal ?? null

const quadrosDaPose = (nome) => arte()?.animacoes?.[nome] ?? arte()?.animacoes?.respiro ?? [[0, 0]]

/** Se a arte da luta final existe: sem ela o jogo narra em texto e pronto. */
export const arenaDisponivel = () => Boolean(arte() && arteDoPalco()?.cenario?.final)

/** Se o palco está, agora, na arena. */
export const naArena = () => f.ativo

// ----------------------------------------------------------- preparação

/** Deixa em memória tudo que a arena desenha. Devolve quando estiver pronto. */
async function carregarArena(presentes) {
  const cenario = arteDoPalco().cenario.final
  const pedidos = [
    tentarCarregar(cenario.fundo),
    tentarCarregar(cenario.arena),
    tentarCarregar(arte().arquivo),
  ]
  for (const p of presentes) {
    const chave = spriteDaClasse(p.classeBase)
    if (chave) pedidos.push(tentarCarregar(arteDoPalco().lutadores[chave].arquivo))
  }
  await Promise.all(pedidos)

  f.fundo = cenario.fundo
  f.arena = cenario.arena
}

/**
 * Leva o palco para a arena. `presentes` é a lista que o servidor mantém
 * (id, nome, classeBase, pronto); `euId` é quem está olhando.
 */
export async function irParaAArena(presentes, euId) {
  if (!arenaDisponivel()) throw new Error('sem arte da arena')
  await carregarArena(presentes)

  f.euId = euId
  f.chefe = chefeNovo()
  f.jogadores = new Map()
  f.lutando = new Set()
  f.flutuantes = []
  f.projeteis = []
  f.feixes = []
  f.ondas = []
  f.info = ''
  f.tremor = { ate: 0, forca: 0 }
  f.clarao = { ate: 0, cor: '255,40,60', forca: 0 }
  f.brasas = Array.from({ length: 34 }, () => novaBrasa(true))
  atualizarPresentes(presentes, euId, { imediato: true })

  // Ligada antes da passagem: a escurecida acontece com a arena já desenhada
  // por baixo, e não com um quadro preto no meio.
  f.ativo = true
  if (!palcoNoFinal()) await trocarCena('final')
}

/** Sai da arena: a próxima cena (a taberna) assume o palco. */
export function sairDaArena() {
  f.ativo = false
  f.jogadores = new Map()
  f.lutando = new Set()
}

// A cena de fora: qualquer troca que não seja para a arena a desliga.
aoTrocarDeCena((nome) => {
  if (nome !== 'final') sairDaArena()
})

/**
 * Sincroniza quem está em pé na arena com a lista do servidor. Quem chega
 * aparece (vindo do escuro); quem sai some; quem fica anda até o seu lugar.
 */
export function atualizarPresentes(presentes, euId = f.euId, { imediato = false } = {}) {
  f.euId = euId
  const ids = new Set(presentes.map((p) => p.id))

  // Quem saiu deixa de ser desenhado depois de sumir.
  for (const [id, j] of f.jogadores) {
    if (!ids.has(id) && !j.saindo) j.saindo = agora()
  }

  presentes.forEach((p, indice) => {
    const chave = spriteDaClasse(p.classeBase)
    if (!chave || !arteDoPalco()?.lutadores?.[chave]) return
    tentarCarregar(arteDoPalco().lutadores[chave].arquivo)

    const [x, y] = LUGARES[indice % LUGARES.length]
    let j = f.jogadores.get(p.id)

    if (!j) {
      j = criarLutador(chave, { x, virado: x < CHEFE.x ? 1 : -1 })
      j.id = p.id
      j.y = y
      j.entrouEm = imediato ? 0 : agora()
      j.hp = 1
      j.hpMax = 1
      j.caido = false
      f.jogadores.set(p.id, j)
    }

    j.nome = p.nome
    j.pronto = Boolean(p.pronto)
    j.eu = p.id === euId
    j.saindo = 0
    j.alvoX = x
    j.alvoY = y
    j.virado = x < CHEFE.x - 4 ? 1 : x > CHEFE.x + 4 ? -1 : j.virado
  })
}

/** O texto de baixo da cena: "prontos 3 de 5". */
export function definirInfo(texto) {
  f.info = texto
}

// ---------------------------------------------------------------- a luta

/**
 * Começa a luta: quem vai lutar ganha barra de vida, o resto vira plateia, e
 * o chefe acorda.
 */
export function comecarLuta({ participantes, hpMaxDoChefe }) {
  f.lutando = new Set(participantes.map((p) => p.nome))

  for (const j of f.jogadores.values()) {
    const dados = participantes.find((p) => p.nome === j.nome)
    j.caido = false
    j.caiuEm = 0
    j.saindo = 0
    if (dados) {
      j.hpMax = dados.hpMax ?? 1
      j.hp = j.hpMax
    }
  }

  f.chefe = { ...chefeNovo(), hp: hpMaxDoChefe, hpMax: hpMaxDoChefe }
  trocarPose('acordando')
  tremer(6, 900)
  clarear('255,60,80', 500, 0.28)
}

/** O chefe caiu (ou o grupo caiu): o desfecho, ainda dentro da cena. */
export function terminarLuta({ venceu }) {
  const c = f.chefe
  if (!c) return

  if (venceu) {
    c.anim = 'caindo'
    c.desde = agora()
    c.caiuEm = agora()
    c.hp = 0
    tremer(14, 2600)
    clarear('255,255,255', 2600, 0.5)
    for (const j of f.jogadores.values()) if (!j.caido) tocar(j, 'parado')
  } else {
    c.anim = 'rugir'
    c.desde = agora()
    tremer(8, 900)
    for (const j of f.jogadores.values()) if (f.lutando.has(j.nome)) tocar(j, 'parado')
  }
}

/** Depois da luta: quem caiu levanta, o chefe volta a dormir. */
export function voltarAoRepouso() {
  f.lutando = new Set()
  for (const j of f.jogadores.values()) {
    j.caido = false
    j.caiuEm = 0
    j.hp = j.hpMax
  }
  if (f.chefe) {
    f.chefe = { ...chefeNovo(), hp: f.chefe.hp, hpMax: f.chefe.hpMax }
    // O chefe derrubado some de vez; o vencedor de uma luta perdida volta a dormir.
  }
}

const jogadorPorNome = (nome) => [...f.jogadores.values()].find((j) => j.nome === nome) ?? null

// -------------------------------------------------------------- efeitos

function tremer(forca, duracao) {
  f.tremor = { ate: agora() + duracao, forca }
}

function clarear(cor, duracao, forca) {
  f.clarao = { ate: agora() + duracao, inicio: agora(), cor, forca }
}

function flutuar(x, y, texto, cor, tamanho = 13) {
  f.flutuantes.push({ x, y, texto, cor, tamanho, nasceu: agora() })
  // Uma luta longa gera milhares: só os últimos ficam na tela.
  if (f.flutuantes.length > 22) f.flutuantes.splice(0, f.flutuantes.length - 22)
}

/** Daqui a `ms` faz `fn` — relógio de parede, como tudo no palco. */
const depois = (ms, fn) => setTimeout(() => f.ativo && fn(), ms)

const formatar = (n) => Math.round(n ?? 0).toLocaleString('pt-BR')

/** O ponto do coração do chefe, em pixels de palco. */
function pontoDoCoracao() {
  const [cx, cy] = arte()?.coracao ?? [0, -120]
  return { x: CHEFE.x + cx * ESCALA_CHEFE, y: CHEFE.y + cy * ESCALA_CHEFE }
}

/** A boca do chefe: de onde o laser sai. */
function pontoDaBoca() {
  const [bx, by] = arte()?.boca ?? [60, -120]
  return { x: CHEFE.x + bx * ESCALA_CHEFE, y: CHEFE.y + by * ESCALA_CHEFE }
}

/** O centro do corpo de um jogador: onde o golpe pega. */
const centroDe = (j) => ({ x: j.x, y: (j.y ?? 250) - 26 })

function derrubar(j) {
  if (!j || j.caido) return
  j.caido = true
  j.caiuEm = agora()
  tocar(j, 'defender')
}

function machucar(j, dano, { critico = false } = {}) {
  if (!j) return
  j.flash = agora()
  tocar(j, 'defender')
  const { x, y } = centroDe(j)
  flutuar(x, y - 14, `-${formatar(dano)}`, critico ? '#ffd166' : '#ff7c72')
}

function trocarPose(nome) {
  const c = f.chefe
  if (!c) return
  c.anim = nome
  c.desde = agora()
}

// ------------------------------------------------------- o log virando cena

/**
 * Uma entrada do log da luta virando movimento. Devolve quantos
 * milissegundos o narrador deve esperar antes da próxima.
 */
export function animar(entrada) {
  if (!f.ativo || !f.chefe) return 0
  const c = f.chefe

  switch (entrada.tipo) {
    case 'ataque': {
      const j = jogadorPorNome(entrada.dono ?? entrada.nome)
      if (entrada.hpChefe !== undefined) c.hp = entrada.hpChefe
      if (!j) return 30

      tocar(j, 'atacar')
      j.impulso = agora()
      const de = centroDe(j)
      const para = pontoDoCoracao()
      // Cada golpe pega num ponto um pouco diferente do peito, e o número
      // sobe ali — com dez jogadores batendo, todos no mesmo lugar viravam
      // uma mancha ilegível.
      const alvo = { x: para.x + (Math.random() - 0.5) * 150, y: para.y + (Math.random() - 0.5) * 80 }
      f.projeteis.push({
        de,
        para: alvo,
        nasceu: agora(),
        dura: 240 + Math.random() * 60,
        cor: entrada.critico ? '#ffd166' : '#ffe9b0',
        aoChegar: () => {
          c.flash = agora()
          if (entrada.esquivou) flutuar(alvo.x, alvo.y - 8, 'esquiva', '#9fd1e8', 11)
          else {
            flutuar(
              alvo.x,
              alvo.y - 8,
              formatar(entrada.dano),
              entrada.executou ? '#ff9d5c' : entrada.critico ? '#ffd166' : '#f0e8d8',
              entrada.critico ? 15 : 12,
            )
          }
        },
      })
      return entrada.critico ? 80 : 46
    }

    case 'curaGrupo': {
      const j = jogadorPorNome(entrada.nome)
      if (j) {
        const { x, y } = centroDe(j)
        flutuar(x, y - 16, `+${formatar(entrada.cura)}`, '#7bc47b')
      }
      return 160
    }

    case 'chefe': {
      const alvo = jogadorPorNome(entrada.alvo)
      trocarPose('golpe')
      depois(230, () => {
        if (!alvo) return
        if (entrada.hpAlvo !== undefined) alvo.hp = entrada.hpAlvo
        if (entrada.esquivou) {
          const { x, y } = centroDe(alvo)
          flutuar(x, y - 14, 'esquiva', '#9fd1e8')
          return
        }
        machucar(alvo, entrada.dano, { critico: entrada.critico })
        f.ondas.push({ ...centroDe(alvo), nasceu: agora(), dura: 380, raio: 30, cor: '255,70,70' })
        tremer(4, 220)
        if (entrada.derrubou) derrubar(alvo)
      })
      return 820
    }

    case 'area': {
      trocarPose('pancada')
      depois(300, () => {
        tremer(11, 520)
        clarear('255,60,60', 420, 0.22)
        f.ondas.push({ x: CHEFE.x, y: 262, nasceu: agora(), dura: 700, raio: 300, cor: '255,80,60', achatada: true })
        for (const d of entrada.danos ?? []) {
          const j = jogadorPorNome(d.nome)
          if (!j) continue
          j.hp = d.hp
          machucar(j, d.dano)
          if (d.hp <= 0) derrubar(j)
        }
      })
      return 1250
    }

    case 'laser': {
      trocarPose('carregar')
      const boca = pontoDaBoca()
      // A carga: um clarão na boca antes do disparo.
      f.ondas.push({ x: boca.x, y: boca.y, nasceu: agora(), dura: 520, raio: 26, cor: '255,80,110', encolhe: true })
      depois(560, () => {
        trocarPose('laser')
        tremer(6, 800)
        clarear('255,60,90', 260, 0.2)
        for (const alvo of entrada.alvos ?? []) {
          const j = jogadorPorNome(alvo.nome)
          if (!j) continue
          f.feixes.push({ de: boca, para: () => centroDe(j), nasceu: agora(), dura: 760 })
          depois(180, () => {
            j.hp = alvo.hpAlvo
            machucar(j, alvo.dano, { critico: alvo.critico })
            f.ondas.push({ ...centroDe(j), nasceu: agora(), dura: 460, raio: 44, cor: '255,110,140' })
            if (alvo.derrubou) derrubar(j)
          })
        }
      })
      depois(1500, () => trocarPose('respiro'))
      return 2100
    }

    case 'furia': {
      c.furia = true
      trocarPose('rugir')
      tremer(10, 1100)
      clarear('255,30,40', 1100, 0.34)
      flutuar(CHEFE.x, 70, 'FÚRIA!', '#ff5a4d', 22)
      return 1500
    }

    case 'preso': {
      trocarPose('ferido')
      flutuar(CHEFE.x, 90, 'atordoado', '#c9a0ff', 13)
      depois(500, () => trocarPose('respiro'))
      return 520
    }

    case 'estado': {
      c.hp = entrada.hpChefe
      for (const s of entrada.time ?? []) {
        const j = jogadorPorNome(s.nome)
        if (!j) continue
        j.hp = s.hp
        if (s.caido && !j.caido) derrubar(j)
      }
      return 130
    }

    default:
      return 0
  }
}

// --------------------------------------------------------------- desenho

function novaBrasa(espalhada = false) {
  return {
    x: Math.random() * LARGURA,
    y: espalhada ? Math.random() * ALTURA : ALTURA + 6,
    vx: (Math.random() - 0.5) * 8,
    vy: -(6 + Math.random() * 14),
    r: 0.8 + Math.random() * 1.4,
    fase: Math.random() * 6,
  }
}

/** A imagem certa da camada, ou nada enquanto ela não carregou. */
const camada = (relativo) => (relativo ? pronta(relativo) : null)

function desenharFundo(ctx, t) {
  ctx.fillStyle = '#07040a'
  ctx.fillRect(0, 0, LARGURA, ALTURA)
  const img = camada(f.fundo)
  if (img) ctx.drawImage(img, 0, 0, LARGURA, ALTURA)

  // As brasas que sobem do abismo: um pouco de vida no fundo parado.
  ctx.globalCompositeOperation = 'lighter'
  for (const b of f.brasas) {
    b.x += b.vx / 60
    b.y += b.vy / 60
    if (b.y < -6) Object.assign(b, novaBrasa())
    const brilho = 0.35 + Math.sin(t / 340 + b.fase) * 0.2
    ctx.fillStyle = `rgba(255,${90 + Math.round(brilho * 80)},70,${brilho.toFixed(3)})`
    ctx.fillRect(b.x, b.y, b.r, b.r)
  }
  ctx.globalCompositeOperation = 'source-over'
}

function desenharChefe(ctx, t) {
  const c = f.chefe
  const a = arte()
  const img = a && pronta(a.arquivo)
  if (!img) return

  const pose = POSES[c.anim] ?? POSES.respiro
  const quadros = quadrosDaPose(c.anim)
  const passados = Math.floor((t - c.desde) / pose.porQuadro)
  const indice = pose.laco ? passados % quadros.length : Math.min(passados, quadros.length - 1)

  // Golpe, pancada e recém-acordado voltam ao respiro sozinhos.
  if (!pose.laco && passados >= quadros.length && !['laser', 'carregar', 'caindo', 'rugir'].includes(c.anim)) {
    trocarPoseSemPular('respiro')
  }
  if (c.anim === 'rugir' && passados >= quadros.length && !c.caiuEm && f.lutando.size) trocarPoseSemPular('respiro')

  const [col, lin] = quadros[indice] ?? [0, 0]
  const [cw, ch] = a.quadro
  const [ax, ay] = a.ancora

  const dormindo = c.anim === 'dormindo'
  const respiro = Math.sin(t / (dormindo ? 1100 : 700)) * (dormindo ? 1.4 : 2.2)
  // Vinte golpes por rodada: um tom de vermelho cheio a cada um deixaria o
  // chefe vermelho o tempo todo. O baque é curto e leve.
  const flash = c.flash ? Math.max(0, 1 - (t - c.flash) / 150) * 0.38 : 0

  // O chefe derrubado se desfaz aos poucos.
  let opacidade = 1
  if (c.caiuEm) opacidade = limitar(1 - (t - c.caiuEm - 900) / 2200, 0, 1)
  if (opacidade <= 0) return

  // O brilho do coração, atrás do corpo: mais forte enfurecido, mais fraco dormindo.
  const { x: hx, y: hy } = pontoDoCoracao()
  const pulso = 0.5 + Math.sin(t / (c.furia ? 220 : 520)) * 0.5
  const forca = (dormindo ? 0.08 : c.furia ? 0.42 : 0.24) * (0.7 + pulso * 0.5) * opacidade
  ctx.globalCompositeOperation = 'lighter'
  const aura = ctx.createRadialGradient(hx, hy + respiro, 6, hx, hy + respiro, c.furia ? 210 : 170)
  aura.addColorStop(0, `rgba(255,50,80,${forca.toFixed(3)})`)
  aura.addColorStop(1, 'rgba(255,40,70,0)')
  ctx.fillStyle = aura
  ctx.fillRect(0, 0, LARGURA, ALTURA)
  ctx.globalCompositeOperation = 'source-over'

  ctx.save()
  ctx.globalAlpha = opacidade
  ctx.translate(CHEFE.x, CHEFE.y + respiro)
  ctx.scale(ESCALA_CHEFE, ESCALA_CHEFE)
  const sx = col * cw
  const sy = lin * ch
  if (flash > 0) ctx.drawImage(tingir(img, sx, sy, cw, ch, flash), 0, 0, cw, ch, -ax, -ay, cw, ch)
  else ctx.drawImage(img, sx, sy, cw, ch, -ax, -ay, cw, ch)
  ctx.restore()
}

/** Troca de pose no meio do desenho, sem reiniciar o relógio de quem já está nela. */
function trocarPoseSemPular(nome) {
  if (!f.chefe || f.chefe.anim === nome) return
  f.chefe.anim = nome
  f.chefe.desde = agora()
}

function desenharArena(ctx) {
  const img = camada(f.arena)
  if (img) ctx.drawImage(img, 0, 0, LARGURA, ALTURA)
}

/** Um jogador em pé na arena, com o nome, a barra de vida e o "pronto". */
function desenharJogador(ctx, j, t) {
  const img = pronta(j.meta.arquivo)
  if (!img) return

  // Anda até o lugar dele (quem chegou depois empurra os outros).
  if (j.alvoX !== undefined) {
    j.x += (j.alvoX - j.x) * 0.12
    j.y += (j.alvoY - j.y) * 0.12
  }

  const [cw, ch] = j.meta.quadro
  const [ax, ay] = j.meta.ancora
  const { animacao, linha, coluna, terminou } = quadroDe(j, t)
  if (terminou && !animacao.laco && !j.caido) tocar(j, 'parado')

  // Entrando (vindo do escuro) ou saindo.
  let opacidade = j.entrouEm ? limitar((t - j.entrouEm) / 700, 0, 1) : 1
  if (j.saindo) opacidade = Math.min(opacidade, limitar(1 - (t - j.saindo) / 600, 0, 1))
  if (opacidade <= 0) return
  const plateia = f.lutando.size && !f.lutando.has(j.nome)
  if (plateia) opacidade *= 0.5

  const desdeImpulso = j.impulso ? t - j.impulso : Infinity
  const avanco = desdeImpulso < 220 ? Math.sin((desdeImpulso / 220) * Math.PI) * 7 * j.virado : 0
  const respiro = j.anim === 'parado' ? Math.sin(t / 620 + j.balanco) * 0.9 : 0
  const flash = j.flash ? Math.max(0, 1 - (t - j.flash) / 260) : 0
  const queda = j.caiuEm ? limitar((t - j.caiuEm) / 420, 0, 1) : 0

  // Uma sombra curta prende o boneco ao chão.
  ctx.globalAlpha = 0.35 * opacidade
  ctx.fillStyle = '#05030a'
  ctx.beginPath()
  ctx.ellipse(j.x, j.y + 1, 15, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.globalAlpha = opacidade * (1 - queda * 0.45)
  ctx.translate(j.x + avanco, j.y + respiro)
  if (queda) ctx.rotate(queda * (Math.PI / 2) * 0.82 * (j.virado === 1 ? -1 : 1))
  if (j.virado === -1) ctx.scale(-1, 1)
  ctx.scale(ESCALA_HEROI, ESCALA_HEROI)
  const sx = coluna * cw
  const sy = linha * ch
  if (flash > 0) ctx.drawImage(tingir(img, sx, sy, cw, ch, flash), 0, 0, cw, ch, -ax, -ay, cw, ch)
  else ctx.drawImage(img, sx, sy, cw, ch, -ax, -ay, cw, ch)
  ctx.restore()
  ctx.globalAlpha = 1

  if (queda >= 1 && j.caido) return

  // A barra de vida, só em luta e só de quem luta.
  const topo = j.y - ch * ESCALA_HEROI * 0.62
  if (f.lutando.has(j.nome) && !j.caido) {
    const largura = 26
    const cheio = limitar(j.hp / Math.max(1, j.hpMax), 0, 1)
    ctx.fillStyle = 'rgba(8,5,12,0.75)'
    ctx.fillRect(j.x - largura / 2 - 1, topo - 9, largura + 2, 5)
    ctx.fillStyle = cheio > 0.5 ? '#6fbf73' : cheio > 0.25 ? '#e0b34a' : '#d6584c'
    ctx.fillRect(j.x - largura / 2, topo - 8, largura * cheio, 3)
  }

  // O nome: pequeno, e mais claro em quem é você.
  ctx.globalAlpha = opacidade
  ctx.font = `600 ${j.eu ? 10 : 9}px Cinzel, Georgia, serif`
  ctx.textAlign = 'center'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(6,4,10,0.9)'
  ctx.strokeText(j.nome ?? '', j.x, topo - (f.lutando.has(j.nome) ? 12 : 4))
  ctx.fillStyle = j.eu ? '#f1d47a' : '#ddd3c2'
  ctx.fillText(j.nome ?? '', j.x, topo - (f.lutando.has(j.nome) ? 12 : 4))

  // O "pronto": um selo verde em cima de quem já se preparou.
  if (j.pronto && !f.lutando.size) {
    ctx.fillStyle = '#7bd389'
    ctx.font = '700 11px "JetBrains Mono", monospace'
    ctx.strokeText('✓', j.x, topo - 14)
    ctx.fillText('✓', j.x, topo - 14)
  }
  ctx.globalAlpha = 1
}

function desenharProjeteis(ctx, t) {
  ctx.globalCompositeOperation = 'lighter'
  f.projeteis = f.projeteis.filter((p) => {
    const k = (t - p.nasceu) / p.dura
    if (k >= 1) {
      p.aoChegar?.()
      // Uma faísca onde o golpe pegou.
      f.ondas.push({ x: p.para.x, y: p.para.y, nasceu: t, dura: 220, raio: 13, cor: '255,220,160' })
      return false
    }
    const e = k * k * (3 - 2 * k)
    const x = p.de.x + (p.para.x - p.de.x) * e
    const y = p.de.y + (p.para.y - p.de.y) * e - Math.sin(k * Math.PI) * 14
    // O rastro
    const antes = Math.max(0, e - 0.16)
    const x0 = p.de.x + (p.para.x - p.de.x) * antes
    const y0 = p.de.y + (p.para.y - p.de.y) * antes - Math.sin(antes * Math.PI) * 14
    ctx.strokeStyle = p.cor
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = p.cor
    ctx.beginPath()
    ctx.arc(x, y, 2.6, 0, Math.PI * 2)
    ctx.fill()
    return true
  })
  ctx.globalCompositeOperation = 'source-over'
}

function desenharOndas(ctx, t) {
  ctx.globalCompositeOperation = 'lighter'
  f.ondas = f.ondas.filter((o) => {
    const k = (t - o.nasceu) / o.dura
    if (k >= 1) return false
    const raio = (o.encolhe ? 1 - k : k) * o.raio
    ctx.strokeStyle = `rgba(${o.cor},${((1 - k) * 0.85).toFixed(3)})`
    ctx.lineWidth = 2 + (1 - k) * 3
    ctx.beginPath()
    if (o.achatada) ctx.ellipse(o.x, o.y, raio, raio * 0.2, 0, 0, Math.PI * 2)
    else ctx.arc(o.x, o.y, Math.max(1, raio), 0, Math.PI * 2)
    ctx.stroke()
    return true
  })
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * O laser: um feixe que sai da boca do chefe e vai até quem ele mirou. Três
 * traços um por cima do outro (brilho, corpo, núcleo) e anéis correndo pelo
 * feixe, como no desenho do disparo.
 */
function desenharFeixes(ctx, t) {
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'

  f.feixes = f.feixes.filter((b) => {
    const k = (t - b.nasceu) / b.dura
    if (k >= 1) return false

    const alvo = typeof b.para === 'function' ? b.para() : b.para
    // Nasce grosso, afina no fim.
    const forca = k < 0.12 ? k / 0.12 : 1 - Math.max(0, (k - 0.6) / 0.4)
    const tremido = 1 + Math.sin(t / 26) * 0.08
    const grosso = 15 * forca * tremido

    for (const [cor, largura] of [
      [COR_DO_LASER.fora, grosso * 2.4],
      [COR_DO_LASER.meio, grosso * 1.25],
      [COR_DO_LASER.nucleo, grosso * 0.5],
    ]) {
      ctx.strokeStyle = cor
      ctx.lineWidth = Math.max(0.5, largura)
      ctx.beginPath()
      ctx.moveTo(b.de.x, b.de.y)
      ctx.lineTo(alvo.x, alvo.y)
      ctx.stroke()
    }

    // Anéis de luz correndo pelo feixe.
    const dx = alvo.x - b.de.x
    const dy = alvo.y - b.de.y
    const angulo = Math.atan2(dy, dx)
    for (let i = 0; i < 3; i++) {
      const p = ((t / 520 + i / 3) % 1)
      ctx.save()
      ctx.translate(b.de.x + dx * p, b.de.y + dy * p)
      ctx.rotate(angulo)
      ctx.strokeStyle = `rgba(255,150,170,${(0.7 * forca).toFixed(3)})`
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.ellipse(0, 0, 2.5 + p * 3, (6 + p * 5) * forca, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // O estouro onde ele pega.
    const raio = 16 + Math.sin(t / 40) * 3 + 10 * (1 - k)
    const brilho = ctx.createRadialGradient(alvo.x, alvo.y, 1, alvo.x, alvo.y, raio * 1.6)
    brilho.addColorStop(0, `rgba(255,240,245,${(0.9 * forca).toFixed(3)})`)
    brilho.addColorStop(0.4, `rgba(255,80,110,${(0.6 * forca).toFixed(3)})`)
    brilho.addColorStop(1, 'rgba(255,40,70,0)')
    ctx.fillStyle = brilho
    ctx.beginPath()
    ctx.arc(alvo.x, alvo.y, raio * 1.6, 0, Math.PI * 2)
    ctx.fill()
    return true
  })

  ctx.lineCap = 'butt'
  ctx.globalCompositeOperation = 'source-over'
}

function desenharFlutuantes(ctx, t) {
  f.flutuantes = f.flutuantes.filter((n) => t - n.nasceu < 950)
  ctx.textAlign = 'center'
  for (const n of f.flutuantes) {
    const k = (t - n.nasceu) / 950
    ctx.globalAlpha = limitar(1.4 - k * 1.4, 0, 1)
    ctx.font = `700 ${n.tamanho}px "JetBrains Mono", monospace`
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(6,4,10,0.9)'
    ctx.strokeText(n.texto, n.x, n.y - k * 34)
    ctx.fillStyle = n.cor
    ctx.fillText(n.texto, n.x, n.y - k * 34)
  }
  ctx.globalAlpha = 1
}

/** A vida do chefe, no alto da cena, e a linha de baixo com o que falta. */
function desenharBarras(ctx) {
  const c = f.chefe

  if (f.lutando.size && c && c.hpMax > 1) {
    const larg = 330
    const x = (LARGURA - larg) / 2
    const cheio = limitar(c.hp / c.hpMax, 0, 1)
    ctx.fillStyle = 'rgba(8,4,10,0.72)'
    ctx.fillRect(x - 2, 9, larg + 4, 13)
    const g = ctx.createLinearGradient(x, 0, x + larg, 0)
    g.addColorStop(0, c.furia ? '#ff3b30' : '#b3202c')
    g.addColorStop(1, c.furia ? '#ff7a45' : '#e0455a')
    ctx.fillStyle = g
    ctx.fillRect(x, 11, larg * cheio, 9)
    ctx.font = '600 10px Cinzel, Georgia, serif'
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(6,4,10,0.9)'
    const rotulo = `O CORAÇÃO DO ABISMO   ${formatar(c.hp)} / ${formatar(c.hpMax)}`
    ctx.strokeText(rotulo, LARGURA / 2, 18.5)
    ctx.fillStyle = '#f3e3d0'
    ctx.fillText(rotulo, LARGURA / 2, 18.5)
  }

  if (f.info && !f.lutando.size) {
    ctx.font = 'italic 13px "EB Garamond", Georgia, serif'
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(6,4,10,0.9)'
    ctx.strokeText(f.info, LARGURA / 2, ALTURA - 12)
    ctx.fillStyle = 'rgba(232,220,200,0.92)'
    ctx.fillText(f.info, LARGURA / 2, ALTURA - 12)
  }
}

function desenharClarao(ctx, t) {
  const c = f.clarao
  if (!c.ate || t >= c.ate) return
  const k = (t - c.inicio) / (c.ate - c.inicio)
  ctx.fillStyle = `rgba(${c.cor},${(c.forca * (1 - k)).toFixed(3)})`
  ctx.fillRect(0, 0, LARGURA, ALTURA)
}

/** A cena inteira. É o que o palco chama, quadro a quadro, enquanto ela está em cena. */
function desenharArenaFinal(ctx, t) {
  if (!f.ativo || !f.chefe) {
    ctx.fillStyle = '#07040a'
    ctx.fillRect(0, 0, LARGURA, ALTURA)
    return
  }

  ctx.save()
  // O chão treme.
  if (f.tremor.ate > t) {
    const k = (f.tremor.ate - t) / 600
    const forca = f.tremor.forca * Math.min(1, k)
    ctx.translate((Math.random() - 0.5) * forca, (Math.random() - 0.5) * forca)
  }

  desenharFundo(ctx, t)
  desenharChefe(ctx, t)
  desenharArena(ctx)

  // De trás para a frente: quem está mais para baixo tapa quem está atrás.
  const emOrdem = [...f.jogadores.values()].sort((a, b) => a.y - b.y)
  for (const j of emOrdem) desenharJogador(ctx, j, t)
  f.jogadores.forEach((j, id) => {
    if (j.saindo && t - j.saindo > 700) f.jogadores.delete(id)
  })

  desenharProjeteis(ctx, t)
  desenharOndas(ctx, t)
  desenharFeixes(ctx, t)
  desenharFlutuantes(ctx, t)
  desenharClarao(ctx, t)
  ctx.restore()

  desenharBarras(ctx)

  // Um véu escuro no rodapé, como nas outras cenas.
  const veu = ctx.createLinearGradient(0, ALTURA - 50, 0, ALTURA)
  veu.addColorStop(0, 'rgba(8,6,14,0)')
  veu.addColorStop(1, 'rgba(8,6,14,0.45)')
  ctx.fillStyle = veu
  ctx.fillRect(0, ALTURA - 50, LARGURA, 50)
}

registrarCena('final', desenharArenaFinal)
