/**
 * Prepara a arte do jogo.
 *
 *   npm run arte
 *
 * Lê as imagens cruas de `Assets/` (as folhas geradas com a IA: título,
 * três faixas rotuladas e oito quadros em cada uma) e escreve em
 * `public/arte/` o que o navegador consome: atlas de sprites com fundo
 * transparente, os cenários em camadas e um `arte.json` com a geometria.
 *
 * Por que existe: as folhas vêm como imagem de apresentação, não como
 * spritesheet — quadros em posições irregulares, fundo chapado, painéis
 * desenhados em volta. Recortar isso à mão toda vez que entrar um monstro
 * novo seria trabalho perdido; aqui o recorte é medido a partir da própria
 * imagem (onde há conteúdo, onde há fundo) e o resultado é reproduzível.
 *
 * `Assets/` não vai para o Git (é pesado e é fonte, não produto). Só o que
 * sai daqui, já otimizado, é versionado.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { ESPECIES } from '../server/rpg/monstros.js'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRADA = path.join(raiz, 'Assets')
const SAIDA = path.join(raiz, 'public', 'arte')

// ------------------------------------------------------------- medidas

/** Altura do personagem no atlas, em pixels. Tudo é normalizado para isso. */
const ALTURA_DO_HEROI = 150
/** O goblin é um bicho pequeno: entra um pouco menor que o herói. */
const ALTURA_RELATIVA = { goblin: 0.86 }
/**
 * Folhas desenhadas olhando para a esquerda. O normal é olharem para a
 * direita — inclusive a do goblin, apesar do rótulo "ANDANDO (ESQUERDA)" que
 * veio na imagem: o punhal dele sai para a direita. Quem estiver aqui é
 * espelhado ao contrário na hora de desenhar (public/js/palco.js).
 */
const OLHA_PARA_ESQUERDA = new Set()
/** Altura do sprite sentado da taberna. */
const ALTURA_SENTADO = 120
/** Quantos quadros cada faixa tem. */
const QUADROS = 8
/** O que cada faixa da folha significa, de cima para baixo. */
const FAIXAS = ['andar', 'atacar', 'defender']

// --------------------------------------------------------- ferramentas

const somaAbs = (a, b, c, d, e, f) => Math.abs(a - d) + Math.abs(b - e) + Math.abs(c - f)

async function lerRaw(arquivo) {
  const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, W: info.width, H: info.height }
}

/** A cor que mais aparece — nestas imagens é sempre o fundo. */
function corDeFundo(data) {
  const conta = new Map()
  for (let i = 0; i < data.length; i += 4) {
    const k = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
    conta.set(k, (conta.get(k) ?? 0) + 1)
  }
  const chave = [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0]
  return [((chave >> 10) & 31) << 3 | 4, ((chave >> 5) & 31) << 3 | 4, (chave & 31) << 3 | 4]
}

/**
 * Transparência por distância da cor de fundo, com uma faixa de meio-termo
 * para a borda não ficar serrilhada. JPEG suja a borda do desenho, então o
 * corte nunca pode ser binário.
 */
function alphaDoFundo(data, W, H, fundo, dentro = 60, fora = 130) {
  const alpha = new Uint8Array(W * H)
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    const d = somaAbs(data[i], data[i + 1], data[i + 2], fundo[0], fundo[1], fundo[2])
    alpha[p] = d <= dentro ? 0 : d >= fora ? 255 : Math.round(((d - dentro) / (fora - dentro)) * 255)
  }
  return alpha
}

/** Apaga manchinhas soltas (ruído de JPEG) e devolve o alpha limpo. */
function limparIlhas(alpha, W, H, minArea) {
  const visto = new Uint8Array(W * H)
  const pilha = new Int32Array(W * H)
  for (let inicio = 0; inicio < W * H; inicio++) {
    if (visto[inicio] || alpha[inicio] < 40) continue
    let topo = 0
    pilha[topo++] = inicio
    visto[inicio] = 1
    const grupo = []
    while (topo > 0) {
      const p = pilha[--topo]
      grupo.push(p)
      const x = p % W
      const y = (p / W) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const q = ny * W + nx
        if (visto[q] || alpha[q] < 40) continue
        visto[q] = 1
        pilha[topo++] = q
      }
    }
    if (grupo.length < minArea) for (const p of grupo) alpha[p] = 0
  }
  return alpha
}

/** Os pedaços separados de desenho dentro de um retângulo. */
function componentes(alpha, W, x0, x1, y0, y1) {
  const visto = new Set()
  const grupos = []
  const pilha = []
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const inicio = y * W + x
      if (visto.has(inicio) || alpha[inicio] < 40) continue
      pilha.push(inicio)
      visto.add(inicio)
      const grupo = { pixels: [], x0: x, x1: x, y0: y, y1: y }
      while (pilha.length) {
        const p = pilha.pop()
        grupo.pixels.push(p)
        const px = p % W
        const py = (p / W) | 0
        if (px < grupo.x0) grupo.x0 = px
        if (px > grupo.x1) grupo.x1 = px
        if (py < grupo.y0) grupo.y0 = py
        if (py > grupo.y1) grupo.y1 = py
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = px + dx
          const ny = py + dy
          if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue
          const q = ny * W + nx
          if (visto.has(q) || alpha[q] < 40) continue
          visto.add(q)
          pilha.push(q)
        }
      }
      grupos.push(grupo)
    }
  }
  return grupos
}

/**
 * Tira da célula o que não é o quadro: a borda do painel (uma linha fina) e
 * os restos do quadro vizinho que passaram do corte (a ponta de uma lâmina,
 * o fim de um efeito).
 */
function limparCelula(alpha, W, x0, x1, y0, y1) {
  const grupos = componentes(alpha, W, x0, x1, y0, y1)
  if (!grupos.length) return
  const maior = grupos.reduce((a, b) => (a.pixels.length >= b.pixels.length ? a : b))
  const centro = (x0 + x1) / 2
  const meio = (x1 - x0) * 0.3

  for (const g of grupos) {
    if (g === maior) continue
    const largura = g.x1 - g.x0 + 1
    const altura = g.y1 - g.y0 + 1
    const fino = largura <= 6 && altura >= 20
    const doVizinho = g.pixels.length < maior.pixels.length * 0.12 && Math.abs((g.x0 + g.x1) / 2 - centro) > meio
    if (fino || doVizinho) for (const p of g.pixels) alpha[p] = 0
  }
}

/** Sequências de linhas (ou colunas) com conteúdo, juntando vãos pequenos. */
function corridas(perfil, minimo, vaoMaximo) {
  const saida = []
  let inicio = -1
  let fim = -1
  for (let i = 0; i < perfil.length; i++) {
    if (perfil[i] > minimo) {
      if (inicio < 0) inicio = i
      fim = i
    } else if (inicio >= 0 && i - fim > vaoMaximo) {
      saida.push([inicio, fim])
      inicio = -1
    }
  }
  if (inicio >= 0) saida.push([inicio, fim])
  return saida
}

const caixaDe = (alpha, W, x0, x1, y0, y1) => {
  let minX = x1, maxX = x0, minY = y1, maxY = y0
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (alpha[y * W + x] < 40) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < minX ? null : { x0: minX, x1: maxX, y0: minY, y1: maxY }
}

/**
 * Onde o personagem pisa. O x sai do centro do quarto de baixo do desenho
 * (as pernas), não da caixa inteira: num quadro de ataque o efeito da lâmina
 * puxaria o centro para o lado e o boneco andaria de ré entre um quadro e
 * outro.
 */
function ancora(alpha, W, caixa) {
  const alturaBaixo = Math.max(2, Math.round((caixa.y1 - caixa.y0 + 1) * 0.25))
  let soma = 0
  let peso = 0
  for (let y = caixa.y1 - alturaBaixo + 1; y <= caixa.y1; y++) {
    for (let x = caixa.x0; x <= caixa.x1; x++) {
      const a = alpha[y * W + x]
      if (a < 40) continue
      soma += x * a
      peso += a
    }
  }
  return { x: peso ? soma / peso : (caixa.x0 + caixa.x1) / 2, y: caixa.y1 }
}

// ------------------------------------------------------- folha -> atlas

/** As três faixas de quadros de uma folha, já sem o título e sem os rótulos. */
function faixasDaFolha(alpha, W, H) {
  const margem = Math.round(W * 0.02)
  const perfilY = new Int32Array(H)
  for (let y = 0; y < H; y++) {
    let s = 0
    for (let x = margem; x < W - margem; x++) if (alpha[y * W + x] >= 40) s++
    perfilY[y] = s
  }

  const bandas = corridas(perfilY, Math.round(W * 0.004), 6).filter(([a, b]) => b - a > H * 0.15)
  if (bandas.length !== 3) throw new Error(`esperava 3 faixas, achei ${bandas.length}`)

  return bandas.map(([ya, yb]) => {
    // Dentro da faixa, o rótulo é uma listra baixa colada no topo do painel.
    const altura = yb - ya + 1
    const internas = corridas(perfilY.slice(ya, yb + 1), 0, 4).map(([a, b]) => [a + ya, b + ya])
    const uteis = internas.filter(([a, b]) => !(b - a < altura * 0.25 && b - ya < altura * 0.35))
    return { y0: Math.min(...uteis.map(([a]) => a)), y1: Math.max(...uteis.map(([, b]) => b)) }
  })
}

/** Os centros dos oito quadros de uma faixa, medidos onde há desenho. */
function centrosDaFaixa(alpha, W, faixa) {
  const margem = Math.round(W * 0.02)
  const perfilX = new Int32Array(W)
  for (let x = margem; x < W - margem; x++) {
    let s = 0
    for (let y = faixa.y0; y <= faixa.y1; y++) if (alpha[y * W + x] >= 40) s++
    perfilX[x] = s
  }

  const grupos = corridas(perfilX, 1, 6).filter(([a, b]) => b - a > W * 0.01)
  if (grupos.length === QUADROS) {
    return { centros: grupos.map(([a, b]) => (a + b) / 2), perfilX }
  }

  // Quadros que se encostam (um efeito grande invade o vizinho): divide o
  // espaço ocupado em oito partes iguais, que é como a folha foi desenhada.
  const a = grupos[0][0]
  const b = grupos.at(-1)[1]
  const largura = (b - a) / QUADROS
  return { centros: Array.from({ length: QUADROS }, (_, i) => a + largura * (i + 0.5)), perfilX }
}

/** O corte entre dois quadros: a coluna mais vazia perto do meio. */
function corteEntre(perfilX, c1, c2) {
  const meio = (c1 + c2) / 2
  const margem = (c2 - c1) * 0.28
  let melhor = Math.round(meio)
  let valor = Infinity
  for (let x = Math.round(meio - margem); x <= Math.round(meio + margem); x++) {
    const custo = perfilX[x] + Math.abs(x - meio) * 0.02
    if (custo < valor) {
      valor = custo
      melhor = x
    }
  }
  return melhor
}

/** Recorta uma folha inteira: devolve os quadros já com fundo transparente. */
async function lerFolha(arquivo) {
  const { data, W, H } = await lerRaw(arquivo)
  const fundo = corDeFundo(data)
  const alpha = limparIlhas(alphaDoFundo(data, W, H, fundo), W, H, Math.round(W * H * 0.00002))

  const bandas = faixasDaFolha(alpha, W, H)
  const referencia = centrosDaFaixa(alpha, W, bandas[0])
  const margem = Math.round(W * 0.02)

  const linhas = bandas.map((faixa, iFaixa) => {
    const { centros } = iFaixa === 0 ? referencia : centrosDaFaixa(alpha, W, faixa)
    const usar = centros.length === QUADROS ? centros : referencia.centros
    const perfil = centrosDaFaixa(alpha, W, faixa).perfilX

    const cortes = [Math.round(usar[0] - (usar[1] - usar[0]) * 0.62)]
    for (let i = 1; i < usar.length; i++) cortes.push(corteEntre(perfil, usar[i - 1], usar[i]))
    cortes.push(Math.round(usar.at(-1) + (usar.at(-1) - usar.at(-2)) * 0.62))

    return Array.from({ length: QUADROS }, (_, i) => {
      const x0 = Math.max(margem, cortes[i])
      const x1 = Math.min(W - 1 - margem, cortes[i + 1])
      limparCelula(alpha, W, x0, x1, faixa.y0, faixa.y1)
      const caixa = caixaDe(alpha, W, x0, x1, faixa.y0, faixa.y1)
      return { caixa, ancora: caixa ? ancora(alpha, W, caixa) : null }
    })
  })

  return { data, alpha, W, H, linhas }
}

/**
 * Monta o atlas: 8 colunas × 3 linhas, todo quadro na mesma célula, com os
 * pés no mesmo ponto. Assim a animação não treme.
 */
async function montarAtlas(arquivo, { alturaAlvo }) {
  const folha = await lerFolha(arquivo)
  const { data, alpha, W, linhas } = folha

  // Escala: a altura do personagem andando é a medida de referência.
  const alturas = linhas[0].filter((q) => q.caixa).map((q) => q.caixa.y1 - q.caixa.y0 + 1)
  const alturaCrua = alturas.sort((a, b) => a - b)[Math.floor(alturas.length / 2)]
  const escala = alturaAlvo / alturaCrua

  // Célula: o suficiente para o maior quadro, medido a partir da âncora.
  let esq = 0, dir = 0, cima = 0, baixo = 0
  for (const linha of linhas) {
    for (const q of linha) {
      if (!q.caixa) continue
      esq = Math.max(esq, q.ancora.x - q.caixa.x0)
      dir = Math.max(dir, q.caixa.x1 - q.ancora.x)
      cima = Math.max(cima, q.ancora.y - q.caixa.y0)
      baixo = Math.max(baixo, q.caixa.y1 - q.ancora.y)
    }
  }

  const pad = 3
  const CW = Math.ceil((esq + dir) * escala) + pad * 2
  const CH = Math.ceil((cima + baixo) * escala) + pad * 2
  const ax = Math.round(esq * escala) + pad
  const ay = Math.round(cima * escala) + pad

  const atlas = sharp({
    create: { width: CW * QUADROS, height: CH * linhas.length, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })

  const pedacos = []
  for (let l = 0; l < linhas.length; l++) {
    for (let c = 0; c < QUADROS; c++) {
      const q = linhas[l][c]
      if (!q.caixa) continue
      const lw = q.caixa.x1 - q.caixa.x0 + 1
      const lh = q.caixa.y1 - q.caixa.y0 + 1

      // Recorte cru do quadro, com o alpha calculado.
      const recorte = Buffer.alloc(lw * lh * 4)
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const origem = ((q.caixa.y0 + y) * W + q.caixa.x0 + x) * 4
          const destino = (y * lw + x) * 4
          recorte[destino] = data[origem]
          recorte[destino + 1] = data[origem + 1]
          recorte[destino + 2] = data[origem + 2]
          recorte[destino + 3] = alpha[(q.caixa.y0 + y) * W + q.caixa.x0 + x]
        }
      }

      const destinoW = Math.max(1, Math.round(lw * escala))
      const destinoH = Math.max(1, Math.round(lh * escala))
      const png = await sharp(recorte, { raw: { width: lw, height: lh, channels: 4 } })
        .resize(destinoW, destinoH, { kernel: 'lanczos3' })
        .png()
        .toBuffer()

      pedacos.push({
        input: png,
        left: c * CW + ax - Math.round((q.ancora.x - q.caixa.x0) * escala),
        top: l * CH + ay - Math.round((q.ancora.y - q.caixa.y0) * escala),
      })
    }
  }

  const buffer = await atlas.composite(pedacos).webp({ quality: 85, alphaQuality: 100 }).toBuffer()
  return { buffer, quadro: [CW, CH], ancora: [ax, ay], linhas: FAIXAS, quadros: QUADROS }
}

/** Um sprite solto num fundo chapado (os sentados da taberna). */
async function recortarSolto(arquivo, { alturaAlvo }) {
  const { data, W, H } = await lerRaw(arquivo)
  const fundo = corDeFundo(data)
  const alpha = limparIlhas(alphaDoFundo(data, W, H, fundo, 40, 90), W, H, Math.round(W * H * 0.00002))
  const caixa = caixaDe(alpha, W, 0, W - 1, 0, H - 1)
  if (!caixa) throw new Error(`não achei desenho em ${arquivo}`)

  const lw = caixa.x1 - caixa.x0 + 1
  const lh = caixa.y1 - caixa.y0 + 1
  const recorte = Buffer.alloc(lw * lh * 4)
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const origem = ((caixa.y0 + y) * W + caixa.x0 + x) * 4
      const destino = (y * lw + x) * 4
      recorte[destino] = data[origem]
      recorte[destino + 1] = data[origem + 1]
      recorte[destino + 2] = data[origem + 2]
      recorte[destino + 3] = alpha[(caixa.y0 + y) * W + caixa.x0 + x]
    }
  }

  const escala = alturaAlvo / lh
  return sharp(recorte, { raw: { width: lw, height: lh, channels: 4 } })
    .resize(Math.max(1, Math.round(lw * escala)), alturaAlvo, { kernel: 'lanczos3' })
    .webp({ quality: 88, alphaQuality: 100 })
    .toBuffer()
}

// ------------------------------------------------------------ cenários

/** Uma camada do cenário de batalha: recorte por faixa e fundo branco fora. */
async function camada(arquivo, { de, ate, transparente, desvanecerTopo = 0, largura }) {
  const { data, W, H } = await lerRaw(arquivo)
  const y0 = Math.round(H * de)
  const y1 = Math.round(H * ate)
  const altura = y1 - y0

  const recorte = Buffer.alloc(W * altura * 4)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < W; x++) {
      const origem = ((y0 + y) * W + x) * 4
      const destino = (y * W + x) * 4
      recorte[destino] = data[origem]
      recorte[destino + 1] = data[origem + 1]
      recorte[destino + 2] = data[origem + 2]
      recorte[destino + 3] = 255
    }
  }

  if (transparente) {
    // O branco destas camadas é "vazio": vira transparência.
    const alpha = alphaDoFundo(recorte, W, altura, [255, 255, 255], 30, 120)
    for (let p = 0; p < W * altura; p++) recorte[p * 4 + 3] = alpha[p]
  }

  if (desvanecerTopo) {
    // O topo da camada do chão desaparece aos poucos: sem isso a emenda com
    // o céu vira um risco reto atravessando a tela quando a câmera anda.
    const ate = Math.round(altura * desvanecerTopo)
    for (let y = 0; y < ate; y++) {
      const peso = Math.round(255 * (y / ate) ** 1.5)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4 + 3
        recorte[i] = Math.min(recorte[i], peso)
      }
    }
  }

  const img = sharp(recorte, { raw: { width: W, height: altura, channels: 4 } }).resize({ width: largura })
  return transparente || desvanecerTopo
    ? img.webp({ quality: 88, alphaQuality: 100 }).toBuffer()
    : img.webp({ quality: 82 }).toBuffer()
}

/**
 * O que está ligado à borda da imagem e parece com a cor da borda. Serve
 * para a taberna, que vem desenhada sobre uma folha de papel: o papel toca
 * as bordas, o salão não.
 */
function fundoPorInundacao(data, W, H, tolerancia) {
  const semente = [data[0], data[1], data[2]]
  const fora = new Uint8Array(W * H)
  const pilha = []
  const olhar = (x, y) => {
    const p = y * W + x
    if (fora[p]) return
    const i = p * 4
    if (somaAbs(data[i], data[i + 1], data[i + 2], semente[0], semente[1], semente[2]) > tolerancia) return
    fora[p] = 1
    pilha.push(p)
  }
  for (let x = 0; x < W; x++) { olhar(x, 0); olhar(x, H - 1) }
  for (let y = 0; y < H; y++) { olhar(0, y); olhar(W - 1, y) }
  while (pilha.length) {
    const p = pilha.pop()
    const x = p % W
    const y = (p / W) | 0
    if (x > 0) olhar(x - 1, y)
    if (x < W - 1) olhar(x + 1, y)
    if (y > 0) olhar(x, y - 1)
    if (y < H - 1) olhar(x, y + 1)
  }
  return fora
}

/** A taberna: o salão recortado do fundo de papel. */
async function taberna(arquivo, { largura }) {
  const { data, W, H } = await lerRaw(arquivo)
  const fora = fundoPorInundacao(data, W, H, 120)
  const suave = alphaDoFundo(data, W, H, [data[0], data[1], data[2]], 40, 110)
  const alpha = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) alpha[p] = fora[p] ? 0 : suave[p]

  const caixa = caixaDe(alpha, W, 0, W - 1, 0, H - 1)
  const lw = caixa.x1 - caixa.x0 + 1
  const lh = caixa.y1 - caixa.y0 + 1
  const recorte = Buffer.alloc(lw * lh * 4)
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const origem = ((caixa.y0 + y) * W + caixa.x0 + x) * 4
      const destino = (y * lw + x) * 4
      recorte[destino] = data[origem]
      recorte[destino + 1] = data[origem + 1]
      recorte[destino + 2] = data[origem + 2]
      recorte[destino + 3] = alpha[(caixa.y0 + y) * W + caixa.x0 + x]
    }
  }

  return sharp(recorte, { raw: { width: lw, height: lh, channels: 4 } })
    .resize({ width: largura })
    .webp({ quality: 82, alphaQuality: 100 })
    .toBuffer()
}

// --------------------------------------------------------------- mãos

const achar = (pasta, filtro) => {
  const nomes = readdirSync(pasta).filter(filtro)
  if (!nomes.length) throw new Error(`nada encontrado em ${pasta}`)
  return path.join(pasta, nomes[0])
}

const ehSentado = (n) => /sentad/i.test(n)
const ehImagem = (n) => /\.(png|jpe?g|jfif|webp)$/i.test(n)

/** As pastas de classe, pelo nome (a pasta chama-se "sprites <classe>"). */
function pastasDeClasse() {
  const base = path.join(ENTRADA, 'PERSONAGENS')
  const saida = {}
  for (const entrada of readdirSync(base, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue
    const chave = entrada.name
      .toLowerCase()
      .replace(/sprites?\s*/i, '')
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    saida[chave] = path.join(base, entrada.name)
  }
  return saida
}

const semAcento = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * As folhas de inimigo, por espécie. Vale o nome da pasta ou do arquivo:
 * `Assets/inimigos/lobo/folha.png` ou `Assets/inimigos/lobo.png`. Um arquivo
 * solto com nome de gerador entra como goblin enquanto for o único — foi
 * assim que o primeiro chegou.
 */
function folhasDeInimigo() {
  const base = path.join(ENTRADA, 'inimigos')
  const ids = ESPECIES.map((e) => e.id)
  const saida = {}
  const soltos = []

  for (const entrada of readdirSync(base, { withFileTypes: true })) {
    const nome = semAcento(entrada.name)
    const id = ids.find((x) => nome.includes(x))
    if (entrada.isDirectory()) {
      if (!id) throw new Error(`a pasta "${entrada.name}" não bate com nenhuma espécie`)
      saida[id] = achar(path.join(base, entrada.name), ehImagem)
    } else if (ehImagem(entrada.name)) {
      if (id) saida[id] = path.join(base, entrada.name)
      else soltos.push(path.join(base, entrada.name))
    }
  }

  if (soltos.length === 1 && !saida.goblin) saida.goblin = soltos[0]
  else for (const s of soltos) console.log(`  (ignorado: ${path.basename(s)} — renomeie com o id da espécie)`)

  return saida
}

async function principal() {
  if (!existsSync(ENTRADA)) throw new Error(`não achei a pasta ${ENTRADA}`)
  rmSync(SAIDA, { recursive: true, force: true })
  for (const p of ['cenario', 'lutadores', 'sentados']) mkdirSync(path.join(SAIDA, p), { recursive: true })

  const manifesto = { lutadores: {}, sentados: {}, cenario: {} }
  const escrever = (relativo, buffer) => {
    writeFileSync(path.join(SAIDA, relativo), buffer)
    console.log(`  ${relativo.padEnd(34)} ${(buffer.length / 1024).toFixed(0)} KB`)
  }

  console.log('\nLutadores')
  const classes = pastasDeClasse()
  for (const [classe, pasta] of Object.entries(classes)) {
    const folha = achar(pasta, (n) => ehImagem(n) && !ehSentado(n))
    const atlas = await montarAtlas(folha, { alturaAlvo: ALTURA_DO_HEROI })
    escrever(`lutadores/${classe}.webp`, atlas.buffer)
    manifesto.lutadores[classe] = { arquivo: `lutadores/${classe}.webp`, ...semBuffer(atlas) }

    const sentado = achar(pasta, (n) => ehImagem(n) && ehSentado(n))
    escrever(`sentados/${classe}.webp`, await recortarSolto(sentado, { alturaAlvo: ALTURA_SENTADO }))
    manifesto.sentados[classe] = `sentados/${classe}.webp`
  }

  console.log('\nInimigos')
  for (const [chave, arquivo] of Object.entries(folhasDeInimigo())) {
    const atlas = await montarAtlas(arquivo, {
      alturaAlvo: Math.round(ALTURA_DO_HEROI * (ALTURA_RELATIVA[chave] ?? 1)),
    })
    escrever(`lutadores/${chave}.webp`, atlas.buffer)
    manifesto.lutadores[chave] = {
      arquivo: `lutadores/${chave}.webp`,
      ...semBuffer(atlas),
      viradoParaEsquerda: OLHA_PARA_ESQUERDA.has(chave),
    }
  }

  console.log('\nCenário')
  const batalha = path.join(ENTRADA, 'CENARIOS', 'cenario de batalha')
  const arquivoDe = (pedaco) => achar(batalha, (n) => n.toUpperCase().startsWith(pedaco))

  // Cada camada vem com o chão desenhado no rodapé; se todas ficassem
  // inteiras, o mesmo chão apareceria três vezes, em velocidades diferentes,
  // assim que a câmera andasse. Cada uma fica só com a parte que lhe cabe, e
  // o manifesto guarda onde ela entra no panorama — é o que deixa o cliente
  // empilhar tudo alinhado.
  const CAMADAS = [
    { nome: 'ceu', de: 0, ate: 0.7, velocidade: 0.18, fonte: 'CÉU' },
    { nome: 'longe', de: 0, ate: 0.7, velocidade: 0.42, fonte: 'ESTRUTURAS MAIS', transparente: true },
    { nome: 'perto', de: 0, ate: 0.72, velocidade: 0.68, fonte: 'ESTRUTURAS.', transparente: true },
    { nome: 'chao', de: 0.66, ate: 1, velocidade: 1, fonte: 'CÉU', desvanecerTopo: 0.16 },
  ]

  const proporcao = await sharp(arquivoDe('CÉU')).metadata().then((m) => m.width / m.height)
  const camadas = []
  for (const c of CAMADAS) {
    const relativo = `cenario/batalha-${c.nome}.webp`
    escrever(relativo, await camada(arquivoDe(c.fonte), { ...c, largura: 1600 }))
    camadas.push({ arquivo: relativo, de: c.de, ate: c.ate, velocidade: c.velocidade })
  }

  manifesto.cenario.batalha = {
    // Proporção do panorama inteiro: as camadas são pedaços dele.
    proporcao,
    // Onde ficam os pés de quem está em cena, em fração da altura do panorama.
    linhaDoChao: 0.94,
    camadas,
  }

  const salao = path.join(ENTRADA, 'CENARIOS', 'cenário taberna')
  escrever('cenario/taberna.webp', await taberna(achar(salao, ehImagem), { largura: 1280 }))
  manifesto.cenario.taberna = 'cenario/taberna.webp'

  writeFileSync(path.join(SAIDA, 'arte.json'), `${JSON.stringify(manifesto, null, 2)}\n`)
  console.log(`\nPronto: ${SAIDA}\n`)
}

const semBuffer = ({ buffer, ...resto }) => resto

await principal()
