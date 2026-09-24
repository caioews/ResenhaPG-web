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
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { ESPECIES } from '../server/rpg/monstros.js'
import { ATOS } from '../server/rpg/rota.js'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRADA = path.join(raiz, 'Assets')
const SAIDA = path.join(raiz, 'public', 'arte')

// ------------------------------------------------------------- medidas

/** Altura do personagem no atlas, em pixels. Tudo é normalizado para isso. */
const ALTURA_DO_HEROI = 150
/**
 * Altura de cada bicho em relação ao herói. É o que dá escala ao palco: um
 * slime pela canela, um behemoth que não cabe na tela. Espécie que não
 * estiver aqui entra do tamanho do herói.
 */
const ALTURA_RELATIVA = {
  slime: 0.62,
  goblin: 0.86,
  lobo: 0.78,
  esqueleto: 0.95,
  aranha: 0.82,
  harpia: 0.98,
  orc: 1.12,
  fantasma: 0.98,
  troll: 1.3,
  golem: 1.35,
  wyvern: 1.18,
  basilisco: 0.95,
  quimera: 1.15,
  espectro: 1.08,
  vampiro: 1,
  elemental: 1.05,
  abominacao: 1.2,
  demonio: 1.18,
  behemoth: 1.45,
  arauto: 1.12,
  // Os chefes do Abismo. Todos maiores que o herói: são chefes.
  'sentinela-de-ossos': 1.15,
  'carrasco-cego': 1.22,
  'coisa-sem-nome': 1.2,
  'vigia-do-poco': 1.12,
  'fera-acorrentada': 1.3,
  'eco-do-rei-morto': 1.18,
  'devorador-de-luz': 1.25,
}
/**
 * Folhas desenhadas olhando para a esquerda. O normal é olharem para a
 * direita — inclusive a do goblin, apesar do rótulo "ANDANDO (ESQUERDA)" que
 * veio na imagem: o punhal dele sai para a direita. Quem estiver aqui é
 * espelhado ao contrário na hora de desenhar (public/js/palco.js).
 */
const OLHA_PARA_ESQUERDA = new Set()
/** Altura do sprite sentado da taberna. */
const ALTURA_SENTADO = 120
/** Quantos quadros uma faixa costuma ter — só o palpite de partida. */
const QUADROS_PADRAO = 8

/**
 * Quantos quadros cada faixa tem, quando a medição erra.
 *
 * Quase todas as folhas se medem sozinhas — inclusive as que fogem do
 * padrão: o esqueleto vem com 6, 5 e 4 quadros, o golem com 4, o orc anda em
 * 7. Estas três têm cenário desenhado ATRÁS dos bonecos (cavernas ao fundo,
 * chão de pedra contínuo), e a mancha de cenário se confunde com quadro. Em
 * vez de inventar regra para o caso particular, a contagem vem escrita.
 */
const QUADROS_A_MAO = {
  behemoth: [8, 8, 8],
  troll: [7, 7, 7],
  lobo: [8, 8, 7],
  // Chefes do Abismo. Aqui o que confunde a contagem é o efeito: o rastro da
  // foice, a lâmina que o gerador desenhou solta no fim da faixa, a bola de
  // luz que ocupa dois quadros. A medição parte a mancha grande em duas.
  'sentinela-de-ossos': [7, 7, 4],
  'eco-do-rei-morto': [6, 6, 6],
  'fera-acorrentada': [6, 6, 4],
}

/**
 * Quantos quadros ficam, do começo da faixa.
 *
 * O gerador às vezes desenha sobra no fim da linha: uma lâmina solta sem
 * corpo, meio boneco, o rastro do golpe já sem quem golpeou. A grade não
 * muda (os cortes continuam saindo da faixa inteira, e é isso que mantém os
 * quadros bons alinhados) — o que muda é até onde ela é aproveitada.
 */
const ATE_O_QUADRO = {
  // Andando, o sétimo quadro é só o machado, sem esqueleto nenhum. Atacando,
  // do quarto em diante sobrou o rastro branco do golpe e meio boneco.
  'sentinela-de-ossos': [6, 3, 4],
}
/** O que cada faixa da folha significa, de cima para baixo. */
const FAIXAS = ['andar', 'atacar', 'defender']

/**
 * Quanto se pode apagar de "fundo preso dentro do desenho".
 *
 * A régua apertada é a boa: sai o vão azul entre o braço e o corpo do golem,
 * fica o miolo translúcido do slime e o corpo escuro do behemoth — que
 * também são manchas chapadas parecidas com o fundo, e já foram apagados por
 * engano. A frouxa existe para as folhas que desenharam CENÁRIO atrás dos
 * quadros (a caverna do troll): ali a mancha é grande e precisa sair, senão
 * ela se confunde com o bicho na hora de medir as faixas.
 */
const BOLSAO_APERTADO = { area: 0.004, variacao: 30, cor: 20 }
const BOLSAO_FROUXO = { area: 0.03, variacao: 46, cor: 34 }
/** Folhas com cenário desenhado atrás dos quadros. */
const COM_CENARIO_ATRAS = new Set(['troll'])

/**
 * Folhas em que o bicho é quase da cor do fundo (um dragão cinza-escuro
 * sobre azul-escuro). Aí a inundação precisa de rédea mais curta, senão
 * atravessa o contorno e come o corpo.
 */
const CONTRASTE_BAIXO = new Set(['wyvern'])

/**
 * Quantas camadas de fundo desenhado tirar, quando a conta erra. O normal é
 * deixar a régua da área decidir (até 3).
 */
const CAMADAS_A_MAO = {
  // Cartelas claras e bicho escuro: na terceira volta a conta ia atrás do
  // corpo da aranha.
  aranha: 1,
  // Moldura de janela + painel + cartela; a quarta volta comia a armadura.
  arauto: 2,
}

/**
 * Folhas de grade REGULAR: a faixa é dividida em N quadros de mesma largura,
 * de ponta a ponta, sem medir onde está cada boneco.
 *
 * Serve para as que têm efeito grande no meio da faixa — o rastro branco da
 * foice da Sentinela, o chicote de correntes da Fera. A mancha do efeito
 * pesa na conta do centro de massa e desloca a grade medida; mas o gerador
 * desenhou os quadros numa régua certinha, e é essa régua que se usa aqui.
 */
const GRADE_REGULAR = {
  'sentinela-de-ossos': [7, 7, 4],
  'eco-do-rei-morto': [6, 6, 6],
  'fera-acorrentada': [6, 6, 4],
}

/**
 * Folhas em que todas as faixas usam a grade da primeira. Serve para as que
 * têm cenário atrás: o chão e as pedras confundem a medição de uma linha,
 * mas as três linhas foram desenhadas na mesma grade.
 */
const GRADE_DA_PRIMEIRA = new Set(['troll'])

/**
 * Quanto cortar do TOPO de um cenário do Abismo.
 *
 * Duas das seis vieram com o rótulo do gerador escrito em cima ("LEVEL 3:
 * THE TRENCH"). Cortar a faixa é mais honesto que pintar por cima: some o
 * texto e o teto da caverna continua inteiro.
 */
const RECORTE_DO_TOPO = {
  fossa: 0.06,
  'raiz-do-mundo': 0.06,
}

/**
 * Onde ficam os pés de quem está em cena, em fração da altura do cenário.
 * Cada andar do Abismo tem o chão numa altura diferente; quem não estiver
 * aqui usa o padrão.
 */
const LINHA_DO_CHAO = { padrao: 0.93 }

// --------------------------------------------------------- ferramentas

const somaAbs = (a, b, c, d, e, f) => Math.abs(a - d) + Math.abs(b - e) + Math.abs(c - f)

async function lerRaw(arquivo) {
  const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  // Uma cópia sem o granulado do JPEG. Ela decide o que é fundo; o desenho
  // que sai no atlas é sempre o original. Sem isso, a tolerância teria de
  // ser alta o bastante para engolir o ruído — e aí engole também o contorno
  // de um bicho escuro sobre fundo escuro.
  const suave = await sharp(arquivo).ensureAlpha().median(3).raw().toBuffer()
  return { data, suave, W: info.width, H: info.height }
}

/** As cores que mais aparecem entre os pixels marcados (ou entre todos). */
function coresDominantes(data, W, H, incluir = null, quantas = 1) {
  const conta = new Map()
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    if (incluir && !incluir(p)) continue
    const k = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
    conta.set(k, (conta.get(k) ?? 0) + 1)
  }
  return [...conta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantas)
    .map(([k]) => [(((k >> 10) & 31) << 3) | 4, (((k >> 5) & 31) << 3) | 4, ((k & 31) << 3) | 4])
}

const corDominante = (data, W, H, incluir = null) => coresDominantes(data, W, H, incluir, 1)[0] ?? null

const corDeFundo = (data, W, H) => corDominante(data, W, H)

/**
 * O fundo, por alastramento a partir das bordas.
 *
 * É o único jeito que aguenta as três folhas diferentes que chegaram: fundo
 * chapado (goblin), fundo em degradê (lobo, orc) e cada quadro numa cartela
 * mais clara (fantasma, aranha). Cada pixel entra se for parecido com o
 * VIZINHO de onde veio, e não com uma cor fixa — degradê passa, contorno de
 * desenho não.
 */
function alastrar(data, W, H, sementes, tolerancia) {
  const fora = new Uint8Array(W * H)
  const pilha = []
  for (const p of sementes) {
    if (fora[p]) continue
    fora[p] = 1
    pilha.push(p)
  }

  while (pilha.length) {
    const p = pilha.pop()
    const i = p * 4
    const x = p % W
    const y = (p / W) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const q = ny * W + nx
      if (fora[q]) continue
      const j = q * 4
      if (somaAbs(data[i], data[i + 1], data[i + 2], data[j], data[j + 1], data[j + 2]) > tolerancia) continue
      fora[q] = 1
      pilha.push(q)
    }
  }
  return fora
}

/**
 * O alpha de uma folha inteira.
 *
 * Alastra das bordas; se ainda sobrar muita área chapada (as cartelas de
 * cada quadro, a faixa colorida de cada linha), alastra de novo a partir
 * dela. Cada passo é desfeito se apagar quase tudo — foi o que aconteceu com
 * a folha da aranha, em que o corpo do bicho virou "o que mais aparece".
 */
function alphaDaFolha(data, W, H, { tolerancia = 10, bolsoes = BOLSAO_APERTADO, camadas = 3 } = {}) {
  const bordas = []
  for (let x = 0; x < W; x++) {
    bordas.push(x)
    bordas.push((H - 1) * W + x)
  }
  for (let y = 0; y < H; y++) {
    bordas.push(y * W)
    bordas.push(y * W + W - 1)
  }

  const sobraDe = (fora) => {
    let n = 0
    for (let p = 0; p < W * H; p++) if (!fora[p]) n++
    return n / (W * H)
  }

  let fora = alastrar(data, W, H, bordas, tolerancia)

  // Cada volta tira mais uma camada de fundo desenhado: o painel atrás das
  // faixas, a cartela atrás de cada quadro, a moldura de janela que algumas
  // folhas têm em volta de tudo.
  //
  // Quando parar sai do tamanho do que sobrou: fundo desenhado ocupa metade
  // da folha ou mais; boneco, de um décimo a um terço. Enquanto sobrar
  // muito, ainda é fundo. Uma volta que deixe quase nada estava seguindo a
  // cor do bicho, e é desfeita. `camadas` limita isso à mão quando a conta
  // não serve para uma folha específica.
  for (let volta = 0; volta < camadas && sobraDe(fora) >= 0.35; volta++) {
    const cor = corDominante(data, W, H, (p) => !fora[p])
    const sementes = []
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      if (fora[p]) continue
      if (somaAbs(data[i], data[i + 1], data[i + 2], cor[0], cor[1], cor[2]) <= 26) sementes.push(p)
    }
    if (sementes.length < W * H * 0.06) break

    for (let p = 0; p < W * H; p++) if (fora[p]) sementes.push(p)
    const tentativa = alastrar(data, W, H, sementes, tolerancia)
    if (sobraDe(tentativa) < 0.08) break
    fora = tentativa
  }

  tirarBolsoes(data, W, H, fora, bolsoes)

  const alpha = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) alpha[p] = fora[p] ? 0 : 255
  return alpha
}

/**
 * Fundo preso dentro do desenho (entre o braço e o corpo, no vão de uma
 * perna): a inundação não tem por onde entrar. Reconhece-se por ser um
 * pedaço chapado, da cor do fundo, cercado de desenho.
 */
function tirarBolsoes(data, W, H, fora, regua) {
  const paleta = coresDominantes(data, W, H, (p) => fora[p] === 1, 8)
  const visto = new Uint8Array(W * H)
  const pilha = new Int32Array(W * H)

  for (let inicio = 0; inicio < W * H; inicio++) {
    if (visto[inicio] || fora[inicio]) continue
    let topo = 0
    pilha[topo++] = inicio
    visto[inicio] = 1
    const grupo = []
    let soma = [0, 0, 0]
    let menor = [255, 255, 255]
    let maior = [0, 0, 0]

    while (topo > 0) {
      const p = pilha[--topo]
      grupo.push(p)
      for (let c = 0; c < 3; c++) {
        const v = data[p * 4 + c]
        soma[c] += v
        if (v < menor[c]) menor[c] = v
        if (v > maior[c]) maior[c] = v
      }
      const x = p % W
      const y = (p / W) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const q = ny * W + nx
        if (visto[q] || fora[q]) continue
        visto[q] = 1
        pilha[topo++] = q
      }
    }

    if (grupo.length > W * H * regua.area) continue
    const chapado = maior.every((v, c) => v - menor[c] < regua.variacao)
    if (!chapado) continue
    const media = soma.map((v) => v / grupo.length)
    const doFundo = paleta.some((cor) => somaAbs(media[0], media[1], media[2], cor[0], cor[1], cor[2]) <= regua.cor)
    if (doFundo) for (const p of grupo) fora[p] = 1
  }
}

/**
 * Transparência por distância de uma cor de fundo conhecida, com uma faixa
 * de meio-termo para a borda não ficar serrilhada. Serve para as imagens de
 * fundo chapado e óbvio: os sentados da taberna, as camadas do cenário.
 */
function alphaDoFundo(data, W, H, fundo, dentro = 60, fora = 130) {
  const alpha = new Uint8Array(W * H)
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    const d = somaAbs(data[i], data[i + 1], data[i + 2], fundo[0], fundo[1], fundo[2])
    alpha[p] = d <= dentro ? 0 : d >= fora ? 255 : Math.round(((d - dentro) / (fora - dentro)) * 255)
  }
  return alpha
}

/**
 * Apaga o que não é desenho: manchinhas soltas (ruído de JPEG) e as molduras
 * que a folha desenha em volta de cada faixa. A moldura se reconhece pela
 * forma — ocupa uma área enorme e quase não tem tinta dentro dela.
 */
function limparIlhas(alpha, W, H, minArea) {
  const visto = new Uint8Array(W * H)
  const pilha = new Int32Array(W * H)
  for (let inicio = 0; inicio < W * H; inicio++) {
    if (visto[inicio] || alpha[inicio] < 40) continue
    let topo = 0
    pilha[topo++] = inicio
    visto[inicio] = 1
    const grupo = []
    let minX = W, maxX = 0, minY = H, maxY = 0
    while (topo > 0) {
      const p = pilha[--topo]
      grupo.push(p)
      const x = p % W
      const y = (p / W) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
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
    const caixa = (maxX - minX + 1) * (maxY - minY + 1)
    // Moldura do painel: ocupa um retângulo enorme e quase não tem tinta.
    const moldura = caixa > W * H * 0.02 && grupo.length < caixa * 0.06
    if (grupo.length < minArea || moldura) for (const p of grupo) alpha[p] = 0
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
 * Limpa a faixa antes de medir os quadros: fora o desenho, o que sobrou ali
 * é moldura de cartela (linha fina), rótulo ("ATACANDO (MACHADO)") e letra
 * solta. Tem de sair ANTES da medição — senão um rótulo comprido vira
 * "quadro" e desloca a grade inteira.
 */
function limparFaixa(alpha, W, faixa) {
  const altura = faixa.y1 - faixa.y0 + 1
  for (const g of componentes(alpha, W, 0, W - 1, faixa.y0, faixa.y1)) {
    const larg = g.x1 - g.x0 + 1
    const alt = g.y1 - g.y0 + 1
    const fino = (larg <= 8 && alt >= 24) || (alt <= 8 && larg >= 24)
    const listra = alt < altura * 0.2 && larg > alt * 3.5
    const letra = alt < altura * 0.16 && g.pixels.length < altura * altura * 0.02
    // A cartela de um quadro: um retângulo do tamanho da faixa, oco.
    const cartela = alt > altura * 0.5 && larg > altura * 0.4 && g.pixels.length < larg * alt * 0.12
    if (fino || listra || letra || cartela) for (const p of g.pixels) alpha[p] = 0
  }
}

/**
 * Tira da célula os restos do quadro vizinho que passaram do corte: a ponta
 * de uma lâmina, o fim de um efeito.
 */
function limparCelula(alpha, W, x0, x1, y0, y1) {
  const grupos = componentes(alpha, W, x0, x1, y0, y1)
  if (!grupos.length) return
  const maior = grupos.reduce((a, b) => (a.pixels.length >= b.pixels.length ? a : b))
  const centro = (x0 + x1) / 2
  const meio = (x1 - x0) * 0.3

  const perto = (g) =>
    g.x1 >= maior.x0 - (maior.x1 - maior.x0) * 0.1 &&
    g.x0 <= maior.x1 + (maior.x1 - maior.x0) * 0.1 &&
    g.y1 >= maior.y0 - (maior.y1 - maior.y0) * 0.1 &&
    g.y0 <= maior.y1 + (maior.y1 - maior.y0) * 0.1

  for (const g of grupos) {
    if (g === maior) continue
    const doVizinho = g.pixels.length < maior.pixels.length * 0.12 && Math.abs((g.x0 + g.x1) / 2 - centro) > meio
    // Migalha longe do boneco: letra que sobrou do rótulo, pedra do cenário.
    const migalha = g.pixels.length < maior.pixels.length * 0.05 && !perto(g)
    if (doVizinho || migalha) for (const p of g.pixels) alpha[p] = 0
  }
}

/**
 * Apaga as réguas retas que sobram do desenho da folha: a moldura da
 * cartela de cada quadro, a linha que separa uma faixa da outra. Vai no
 * pixel, e não por componente, porque a cartela quase sempre encosta no
 * bicho — e aí os dois viram uma peça só.
 *
 * O que é "régua": um trecho reto, comprido e fino. Comprido o bastante para
 * não pegar a lança de ninguém.
 */
/**
 * Régua ou lança? As duas são retas e compridas; a régua da cartela tem a
 * mesma espessura do começo ao fim, e a lança (a flecha do arqueiro, a
 * língua do basilisco) afina na ponta. Mede em três pontos e compara.
 */
function reguaDeitada(alpha, W, H, x0, x1, y, espessura) {
  // Uma régua de cartela termina encostada na régua perpendicular do canto —
  // um traço vertical tão alto quanto a cartela. A flecha do arqueiro
  // termina numa ponta de uma dúzia de pixels. É o que separa as duas.
  const apoio = (x) => {
    if (x < 0 || x >= W) return 0
    let n = 1
    while (y - n >= 0 && alpha[(y - n) * W + x] >= 40) n++
    let m = 0
    while (y + m + 1 < H && alpha[(y + m + 1) * W + x] >= 40) m++
    return n + m
  }
  const comprimento = x1 - x0
  if (apoio(x0 - 1) < comprimento * 0.25 && apoio(x1 + 1) < comprimento * 0.25) return false

  const medir = (x) => {
    let n = 1
    while (y - n >= 0 && alpha[(y - n) * W + x] >= 40) n++
    let m = 0
    while (y + m + 1 < H && alpha[(y + m + 1) * W + x] >= 40) m++
    return n + m
  }
  const pontos = [0.15, 0.5, 0.85].map((f) => medir(Math.round(x0 + (x1 - x0) * f)))
  return Math.max(...pontos) <= espessura && Math.max(...pontos) <= Math.min(...pontos) * 1.6
}

function reguaEmPe(alpha, W, H, y0, y1, x, espessura) {
  const apoio = (y) => {
    if (y < 0 || y >= H) return 0
    let n = 1
    while (x - n >= 0 && alpha[y * W + x - n] >= 40) n++
    let m = 0
    while (x + m + 1 < W && alpha[y * W + x + m + 1] >= 40) m++
    return n + m
  }
  const comprimento = y1 - y0
  if (apoio(y0 - 1) < comprimento * 0.25 && apoio(y1 + 1) < comprimento * 0.25) return false

  const medir = (y) => {
    let n = 1
    while (x - n >= 0 && alpha[y * W + x - n] >= 40) n++
    let m = 0
    while (x + m + 1 < W && alpha[y * W + x + m + 1] >= 40) m++
    return n + m
  }
  const pontos = [0.15, 0.5, 0.85].map((f) => medir(Math.round(y0 + (y1 - y0) * f)))
  return Math.max(...pontos) <= espessura && Math.max(...pontos) <= Math.min(...pontos) * 1.6
}

function tirarLinhasRetas(alpha, W, H) {
  const apagar = new Uint8Array(W * H)
  const ESPESSURA = 11
  const minDeitada = Math.round(W * 0.1)
  const minEmPe = Math.round(H * 0.15)

  for (let y = 0; y < H; y++) {
    let x = 0
    while (x < W) {
      if (alpha[y * W + x] < 40) { x++; continue }
      let fim = x
      while (fim < W && alpha[y * W + fim] >= 40) fim++
      if (fim - x >= minDeitada && reguaDeitada(alpha, W, H, x, fim, y, ESPESSURA)) {
        for (let k = x; k < fim; k++) apagar[y * W + k] = 1
      }
      x = fim
    }
  }

  for (let x = 0; x < W; x++) {
    let y = 0
    while (y < H) {
      if (alpha[y * W + x] < 40) { y++; continue }
      let fim = y
      while (fim < H && alpha[fim * W + x] >= 40) fim++
      if (fim - y >= minEmPe && reguaEmPe(alpha, W, H, y, fim, x, ESPESSURA)) {
        for (let k = y; k < fim; k++) apagar[k * W + x] = 1
      }
      y = fim
    }
  }

  for (let p = 0; p < W * H; p++) if (apagar[p]) alpha[p] = 0
  return alpha
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

  // As faixas são as corridas altas: título e rótulos são listras baixas,
  // qualquer que seja o desenho da folha. Quando o cenário desenhado atrás
  // gruda duas faixas numa só (a caverna do troll), ela é cortada na linha
  // mais vazia do meio — é sempre o vão entre uma fileira e a outra.
  const brutas = corridas(perfilY, Math.round(W * 0.004), 6)
  if (process.env.ARTE_DEBUG) {
    console.log(`      corridas: ${brutas.map(([a, b]) => `${a}-${b}(${b - a + 1})`).join(' ')}`)
  }

  let bandas = brutas.filter(([a, b]) => b - a > H * 0.08)
  while (bandas.length < 3 && bandas.length > 0) {
    bandas.sort((x, y) => y[1] - y[0] - (x[1] - x[0]))
    const [a, b] = bandas.shift()
    const de = a + Math.round((b - a) * 0.3)
    const ate = b - Math.round((b - a) * 0.3)
    let corte = de
    for (let y = de; y <= ate; y++) if (perfilY[y] < perfilY[corte]) corte = y
    bandas.push([a, corte - 1], [corte + 1, b])
  }

  bandas = bandas
    .sort((x, y) => y[1] - y[0] - (x[1] - x[0]))
    .slice(0, 3)
    .sort((x, y) => x[0] - y[0])

  if (bandas.length !== 3) throw new Error(`esperava 3 faixas, achei ${bandas.length}`)
  const maisAlta = Math.max(...bandas.map(([a, b]) => b - a))
  const baixa = bandas.find(([a, b]) => b - a < maisAlta * 0.35)
  if (baixa) throw new Error(`faixa ${baixa[0]}-${baixa[1]} é baixa demais para ser uma linha de quadros`)

  return bandas.map(([ya, yb]) => {
    // Dentro da faixa, o rótulo é uma listra baixa colada no topo do painel.
    const altura = yb - ya + 1
    const internas = corridas(perfilY.slice(ya, yb + 1), 0, 4).map(([a, b]) => [a + ya, b + ya])
    const uteis = internas.filter(([a, b]) => !(b - a < altura * 0.25 && b - ya < altura * 0.35))
    return { y0: Math.min(...uteis.map(([a]) => a)), y1: Math.max(...uteis.map(([, b]) => b)) }
  })
}

/**
 * Os centros dos quadros de uma faixa.
 *
 * O caminho honesto seria confiar nos vãos entre um desenho e o seguinte,
 * mas eles mentem dos dois lados: um efeito grande cola dois quadros num
 * borrão só, e uma faísca solta vira um "quadro" a mais. Então só se confia
 * na contagem medida quando ela vem espaçada por igual; fora isso vale o
 * oito de sempre, esticado entre o primeiro e o último desenho — que é como
 * estas folhas são desenhadas. (O orc anda em sete, e cai no primeiro caso.)
 */
function centrosDaFaixa(alpha, W, faixa) {
  const margem = Math.round(W * 0.02)
  const perfilX = new Int32Array(W)
  for (let x = margem; x < W - margem; x++) {
    let s = 0
    for (let y = faixa.y0; y <= faixa.y1; y++) if (alpha[y * W + x] >= 40) s++
    perfilX[x] = s
  }

  const grupos = corridas(perfilX, 1, 6).filter(([a, b]) => b - a > W * 0.012)
  const comMassa = grupos.map(([a, b]) => {
    let massa = 0
    let soma = 0
    for (let x = a; x <= b; x++) {
      massa += perfilX[x]
      soma += x * perfilX[x]
    }
    return { a, b, massa, centro: massa ? soma / massa : (a + b) / 2 }
  })

  // Faísca solta, poeira, o fim de um efeito: tem posição, mas quase não tem
  // tinta. Não conta como quadro.
  const massas = comMassa.map((g) => g.massa).sort((x, y) => x - y)
  const mediana = massas[Math.floor(massas.length / 2)] ?? 0
  const cheios = comMassa.filter((g) => g.massa > mediana * 0.15)
  const centros = cheios.map((g) => g.centro)

  if (centros.length < 2) {
    const a = cheios[0]?.a ?? margem
    const b = cheios[0]?.b ?? W - margem
    const largura = (b - a) / QUADROS_PADRAO
    return { centros: Array.from({ length: QUADROS_PADRAO }, (_, i) => a + largura * (i + 0.5)), perfilX }
  }

  const vaos = []
  for (let i = 1; i < centros.length; i++) vaos.push(centros[i] - centros[i - 1])
  const regular = Math.max(...vaos) <= Math.min(...vaos) * 1.4

  if (centros.length === QUADROS_PADRAO || (regular && centros.length >= 4 && centros.length <= 12)) {
    return { centros, perfilX }
  }

  const largura = (centros.at(-1) - centros[0]) / (QUADROS_PADRAO - 1)
  return {
    centros: Array.from({ length: QUADROS_PADRAO }, (_, i) => centros[0] + largura * i),
    perfilX,
  }
}

/** Os mesmos limites, com o número de quadros que veio escrito. */
function espalhar(centros, quantos) {
  if (!quantos || quantos === centros.length) return centros
  const largura = (centros.at(-1) - centros[0]) / (quantos - 1)
  return Array.from({ length: quantos }, (_, i) => centros[0] + largura * i)
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
/** Um quadro recortado: onde ele está na folha, quanta tinta tem e a âncora. */
function medirQuadro(alpha, W, x0, x1, faixa) {
  limparCelula(alpha, W, x0, x1, faixa.y0, faixa.y1)
  const caixa = caixaDe(alpha, W, x0, x1, faixa.y0, faixa.y1)

  let massa = 0
  if (caixa) {
    for (let y = caixa.y0; y <= caixa.y1; y++) {
      for (let x = caixa.x0; x <= caixa.x1; x++) if (alpha[y * W + x] >= 40) massa++
    }
  }

  return { caixa, massa, ancora: caixa ? ancora(alpha, W, caixa) : null }
}

async function lerFolha(
  arquivo,
  {
    quadrosAMao = null,
    gradeRegular = null,
    ateOQuadro = null,
    bolsoes = BOLSAO_APERTADO,
    camadas = 3,
    gradeUnica = false,
    tolerancia = 10,
  } = {},
) {
  const { data, suave, W, H } = await lerRaw(arquivo)
  const alpha = limparIlhas(
    tirarLinhasRetas(alphaDaFolha(suave, W, H, { bolsoes, camadas, tolerancia }), W, H),
    W,
    H,
    Math.round(W * H * 0.00002),
  )

  const bandas = faixasDaFolha(alpha, W, H)
  const margem = Math.round(W * 0.02)
  if (process.env.ARTE_DEBUG) {
    console.log(`    ${path.basename(arquivo)}: faixas ${bandas.map((b) => `${b.y0}-${b.y1}`).join(' ')}`)
  }

  for (const faixa of bandas) limparFaixa(alpha, W, faixa)
  // (a massa de cada quadro é medida na volta abaixo; quadro quase vazio é
  // descartado depois, comparando com os vizinhos da mesma linha)

  // Linha com o mesmo número de quadros da primeira usa a grade da primeira:
  // as três faixas foram desenhadas na mesma régua, e um efeito grande no
  // meio de uma delas desloca a medição dela sozinha.
  let grade = null
  const linhas = bandas.map((faixa, iFaixa) => {
    const { centros: medidos, perfilX } = centrosDaFaixa(alpha, W, faixa)
    const quantosRegulares = gradeRegular?.[iFaixa] ?? 0

    // Grade regular: N fatias iguais, do primeiro ao último pingo de tinta da
    // faixa. Não há centro para medir, e é justamente esse o ponto. A régua
    // parte da tinta, e não da borda da folha, porque há faixa que termina no
    // meio — a Sentinela defende em quatro quadros e deixa o resto em branco.
    if (quantosRegulares) {
      let ini = margem
      let fim = W - 1 - margem
      while (ini < fim && !perfilX[ini]) ini++
      while (fim > ini && !perfilX[fim]) fim--

      const passo = (fim - ini + 1) / quantosRegulares
      const cortes = Array.from({ length: quantosRegulares + 1 }, (_, i) => Math.round(ini + passo * i))
      return Array.from({ length: quantosRegulares }, (_, i) => medirQuadro(alpha, W, cortes[i], cortes[i + 1], faixa))
    }

    const daPrimeira = grade && (gradeUnica || grade.length === medidos.length)
    const centros = espalhar(daPrimeira ? grade : medidos, quadrosAMao?.[iFaixa])
    if (iFaixa === 0) grade = centros

    const cortes = [Math.round(centros[0] - (centros[1] - centros[0]) * 0.62)]
    for (let i = 1; i < centros.length; i++) cortes.push(corteEntre(perfilX, centros[i - 1], centros[i]))
    cortes.push(Math.round(centros.at(-1) + (centros.at(-1) - centros.at(-2)) * 0.62))

    return Array.from({ length: centros.length }, (_, i) =>
      medirQuadro(alpha, W, Math.max(margem, cortes[i]), Math.min(W - 1 - margem, cortes[i + 1]), faixa),
    )
  })

  // A sobra do fim da faixa, se a folha tiver (ver ATE_O_QUADRO).
  if (ateOQuadro) {
    for (let i = 0; i < linhas.length; i++) {
      if (ateOQuadro[i]) linhas[i] = linhas[i].slice(0, ateOQuadro[i])
    }
  }

  // Quadro com uma migalha de tinta perto do que têm os vizinhos não é
  // quadro: é resto. Vira vazio, e o atlas repete o anterior no lugar dele.
  for (const linha of linhas) {
    const massas = linha.map((q) => q.massa).sort((a, b) => a - b)
    const mediana = massas[Math.floor(massas.length / 2)] || 0
    for (const q of linha) {
      if (q.caixa && q.massa < mediana * 0.08) q.caixa = null
    }
  }

  if (process.env.ARTE_DEBUG) console.log(`    quadros por faixa: ${linhas.map((l) => l.length).join(', ')}`)

  return { data, alpha, W, H, linhas }
}

/**
 * Monta o atlas: uma coluna por quadro, uma linha por faixa, todo quadro na
 * mesma célula e com os pés no mesmo ponto — assim a animação não treme. As
 * folhas não têm todas o mesmo número de quadros (o orc anda em sete), então
 * o manifesto guarda quantos cada linha tem.
 */
async function montarAtlas(
  arquivo,
  {
    alturaAlvo,
    quadros = null,
    regular = null,
    ate = null,
    bolsoes = BOLSAO_APERTADO,
    camadas = 3,
    gradeUnica = false,
    tolerancia = 10,
  },
) {
  const folha = await lerFolha(arquivo, {
    quadrosAMao: quadros,
    gradeRegular: regular,
    ateOQuadro: ate,
    bolsoes,
    camadas,
    gradeUnica,
    tolerancia,
  })
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

  const colunas = Math.max(...linhas.map((l) => l.length))
  const atlas = sharp({
    create: { width: CW * colunas, height: CH * linhas.length, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })

  const pedacos = []
  for (let l = 0; l < linhas.length; l++) {
    // Quadro que saiu vazio (um corte torto, um efeito que ficou todo no
    // vizinho) repete o anterior: na animação isso é imperceptível, e um
    // buraco seria um piscar.
    let ultimo = null
    for (let c = 0; c < linhas[l].length; c++) {
      const q = linhas[l][c]
      if (!q.caixa) {
        if (ultimo) pedacos.push({ ...ultimo, left: ultimo.left + (c - ultimo.coluna) * CW })
        continue
      }
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

      ultimo = {
        input: png,
        coluna: c,
        left: c * CW + ax - Math.round((q.ancora.x - q.caixa.x0) * escala),
        top: l * CH + ay - Math.round((q.ancora.y - q.caixa.y0) * escala),
      }
      pedacos.push(ultimo)
    }
  }

  const buffer = await atlas.composite(pedacos).webp({ quality: 85, alphaQuality: 100 }).toBuffer()
  return {
    buffer,
    quadro: [CW, CH],
    ancora: [ax, ay],
    linhas: FAIXAS,
    quadros: linhas.map((l) => l.length),
  }
}

/** Um sprite solto num fundo chapado (os sentados da taberna). */
async function recortarSolto(arquivo, { alturaAlvo }) {
  const { data, W, H } = await lerRaw(arquivo)
  const fundo = corDeFundo(data, W, H)
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
 * O identificador de uma peça de arte, tirado do nome: minúsculo, sem
 * acento, hífen no lugar do espaço. É ele que liga o arquivo ao jogo —
 * "Vigia do Poço.jfif" e o habitante "Vigia do Poço" viram `vigia-do-poco`,
 * "raiz do mundo.jfif" e a profundidade "Raiz do Mundo", `raiz-do-mundo`.
 * O servidor faz a mesma conta (`chaveDeArte`, em server/rpg/abismo.js).
 */
const chaveDeArte = (nome) =>
  semAcento(path.parse(nome).name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * As folhas de inimigo, por espécie. Vale o nome da pasta ou do arquivo:
 * `Assets/inimigos/lobo/folha.png` ou `Assets/inimigos/lobo.png`. Um arquivo
 * solto com nome de gerador entra como goblin enquanto for o único — foi
 * assim que o primeiro chegou.
 */
function folhasDeInimigo() {
  const base = path.join(ENTRADA, 'inimigos')
  // Vale o id da espécie ou o nome dela no jogo: "cavaleiro espectral.jfif"
  // é o `espectro`, "aranha gigante.jfif" é a `aranha`.
  const chaves = ESPECIES.map((e) => ({ id: e.id, pistas: [e.id, semAcento(e.nome)] }))
  const saida = {}
  const soltos = []

  for (const entrada of readdirSync(base, { withFileTypes: true })) {
    const nome = semAcento(entrada.name)
    const id = chaves.find((e) => e.pistas.some((pista) => nome.includes(pista)))?.id
    if (entrada.isDirectory()) {
      // Os chefes do Abismo moram numa pasta só deles e não são espécies.
      if (entrada.name === PASTA_DOS_CHEFES) continue
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

/** Onde ficam as folhas dos chefes do Abismo, dentro de `inimigos`. */
const PASTA_DOS_CHEFES = 'chefes abismo'

/**
 * As folhas dos chefes do Abismo. Diferente das espécies, aqui não há lista
 * para conferir: a ligação é pelo NOME do arquivo, que vira a chave do
 * manifesto. Renomear um habitante em server/rpg/abismo.js pede renomear o
 * arquivo — senão o chefe entra em cena com o sprite de reserva.
 */
function folhasDeChefeDoAbismo() {
  const base = path.join(ENTRADA, 'inimigos', PASTA_DOS_CHEFES)
  if (!existsSync(base)) return {}

  const saida = {}
  for (const nome of readdirSync(base)) {
    if (ehImagem(nome)) saida[chaveDeArte(nome)] = path.join(base, nome)
  }
  return saida
}

/**
 * Um cenário inteiriço — os andares do Abismo vêm numa imagem só, sem
 * camadas. O palco repete a imagem enquanto o personagem anda: não há
 * parallax aqui, o que dá a sensação de movimento é a repetição.
 */
async function cenaInteira(arquivo, { recorteDoTopo = 0, largura }) {
  const { width, height } = await sharp(arquivo).metadata()
  const topo = Math.round(height * recorteDoTopo)
  const altura = height - topo

  const buffer = await sharp(arquivo)
    .extract({ left: 0, top: topo, width, height: altura })
    .resize({ width: largura })
    .webp({ quality: 82 })
    .toBuffer()

  return { buffer, proporcao: width / altura }
}

/**
 * As camadas de um cenário desenhado em partes. Só a primeira pasta veio
 * assim (Ruínas de Valkhar, o ato 1): céu, estruturas ao fundo, estruturas
 * de perto e chão, cada uma andando numa velocidade — é o parallax.
 *
 * Cada camada vem com o chão desenhado no rodapé; se todas ficassem
 * inteiras, o mesmo chão apareceria três vezes, em velocidades diferentes,
 * assim que a câmera andasse. Cada uma fica só com a parte que lhe cabe, e o
 * manifesto guarda onde ela entra no panorama — é o que deixa o cliente
 * empilhar tudo alinhado.
 */
const CAMADAS_DO_CENARIO = [
  { nome: 'ceu', de: 0, ate: 0.7, velocidade: 0.18, fonte: 'CÉU' },
  { nome: 'longe', de: 0, ate: 0.7, velocidade: 0.42, fonte: 'ESTRUTURAS MAIS', transparente: true },
  { nome: 'perto', de: 0, ate: 0.72, velocidade: 0.68, fonte: 'ESTRUTURAS.', transparente: true },
  { nome: 'chao', de: 0.66, ate: 1, velocidade: 1, fonte: 'CÉU', desvanecerTopo: 0.16 },
]

/**
 * O cenário de um ato da rota.
 *
 * Duas formas cabem na mesma pasta, e qual é decidido pelo conteúdo dela:
 *
 *   em camadas — tem um arquivo começando por "CÉU". Sai um panorama com
 *                parallax, como o do ato 1.
 *   inteiriço  — qualquer outra imagem. Sai uma imagem só, que o palco
 *                repete espelhada enquanto o personagem anda. É o formato
 *                dos andares do Abismo, e é o que basta para um ato.
 *
 * O palco desenha os dois a partir do manifesto, sem saber de antemão qual
 * é qual: pôr uma imagem nova numa pasta de ato e rodar `npm run arte`
 * basta para o ato ganhar cenário.
 */
/**
 * Cenários inteiriços já escritos, por conteúdo do arquivo de origem.
 *
 * Os atos que ainda não têm imagem recebem todos a MESMA placa preta, e sem
 * isto ela sairia 40 vezes em `public/arte`. Com isto sai uma vez e os
 * outros apontam para ela; quando cada ato ganhar a sua imagem, cada um
 * volta a ter o seu arquivo sozinho, sem ninguém precisar mexer aqui.
 */
const cenariosJaEscritos = new Map()

/** A impressão digital de uma imagem de cenário: conteúdo + como ela é cortada. */
const impressaoDe = (fonte, ato) =>
  `${createHash('sha1').update(readFileSync(fonte)).digest('hex')}:${RECORTE_DO_TOPO[ato.cenario] ?? 0}`

/** As impressões que mais de um ato usa. Preenchida antes do laço principal. */
const compartilhados = new Set()

/**
 * Descobre, antes de escrever qualquer coisa, quais imagens se repetem entre
 * atos. É o que permite dar ao arquivo compartilhado um nome que se explica.
 */
function acharCenariosCompartilhados(pastaDeCenario) {
  const vistos = new Set()
  for (const ato of ATOS) {
    const pasta = pastaDeCenario.get(ato.cenario)
    if (!pasta) continue
    const arquivos = readdirSync(pasta).filter(ehImagem)
    if (!arquivos.length || arquivos.some((n) => n.toUpperCase().startsWith('CÉU'))) continue

    const impressao = impressaoDe(path.join(pasta, arquivos[0]), ato)
    if (vistos.has(impressao)) compartilhados.add(impressao)
    vistos.add(impressao)
  }
}

async function cenarioDoAto(ato, pasta, escrever) {
  const arquivos = readdirSync(pasta).filter(ehImagem)
  if (!arquivos.length) return null

  const comCamadas = arquivos.find((n) => n.toUpperCase().startsWith('CÉU'))
  const linhaDoChao = LINHA_DO_CHAO[ato.cenario] ?? LINHA_DO_CHAO.padrao

  if (comCamadas) {
    const arquivoDe = (pedaco) => achar(pasta, (n) => n.toUpperCase().startsWith(pedaco))
    const proporcao = await sharp(arquivoDe('CÉU')).metadata().then((m) => m.width / m.height)
    const camadas = []

    for (const c of CAMADAS_DO_CENARIO) {
      const relativo = `cenario/ato-${ato.cenario}-${c.nome}.webp`
      escrever(relativo, await camada(arquivoDe(c.fonte), { ...c, largura: 1600 }))
      camadas.push({ arquivo: relativo, de: c.de, ate: c.ate, velocidade: c.velocidade })
    }

    // Proporção do panorama inteiro: as camadas são pedaços dele.
    return { proporcao, linhaDoChao: LINHA_DO_CHAO[ato.cenario] ?? 0.94, camadas }
  }

  const fonte = path.join(pasta, arquivos[0])
  const impressao = impressaoDe(fonte, ato)
  const repetido = cenariosJaEscritos.get(impressao)
  if (repetido) {
    console.log(`  ${ato.nome.padEnd(32)} = ${path.basename(repetido.arquivo)}`)
    return { ...repetido, linhaDoChao }
  }

  // O arquivo leva o nome do ATO quando é só dele, e o nome da IMAGEM quando
  // vários atos dividem a mesma — senão a placa preta que 17 atos usam sairia
  // batizada de "ato-portoes-de-malgor", que é só o primeiro da fila.
  const relativo = compartilhados.has(impressao)
    ? `cenario/ato-${chaveDeArte(path.basename(fonte))}.webp`
    : `cenario/ato-${ato.cenario}.webp`
  const feito = await cenaInteira(fonte, {
    recorteDoTopo: RECORTE_DO_TOPO[ato.cenario] ?? 0,
    largura: 1600,
  })
  escrever(relativo, feito.buffer)
  cenariosJaEscritos.set(impressao, { arquivo: relativo, proporcao: feito.proporcao })
  return { arquivo: relativo, proporcao: feito.proporcao, linhaDoChao }
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
      quadros: QUADROS_A_MAO[chave] ?? null,
      bolsoes: COM_CENARIO_ATRAS.has(chave) ? BOLSAO_FROUXO : BOLSAO_APERTADO,
      camadas: CAMADAS_A_MAO[chave] ?? 3,
      gradeUnica: GRADE_DA_PRIMEIRA.has(chave),
      tolerancia: CONTRASTE_BAIXO.has(chave) ? 6 : 10,
    })
    escrever(`lutadores/${chave}.webp`, atlas.buffer)
    manifesto.lutadores[chave] = {
      arquivo: `lutadores/${chave}.webp`,
      ...semBuffer(atlas),
      viradoParaEsquerda: OLHA_PARA_ESQUERDA.has(chave),
    }
  }

  console.log('\nChefes do Abismo')
  for (const [chave, arquivo] of Object.entries(folhasDeChefeDoAbismo())) {
    const atlas = await montarAtlas(arquivo, {
      alturaAlvo: Math.round(ALTURA_DO_HEROI * (ALTURA_RELATIVA[chave] ?? 1.15)),
      quadros: QUADROS_A_MAO[chave] ?? null,
      regular: GRADE_REGULAR[chave] ?? null,
      ate: ATE_O_QUADRO[chave] ?? null,
      bolsoes: COM_CENARIO_ATRAS.has(chave) ? BOLSAO_FROUXO : BOLSAO_APERTADO,
      // Nenhuma volta de descasque: estas folhas vêm com fundo branco
      // chapado e sem painel desenhado, e o pouco que a inundação deixa em
      // volta dos bonecos bastava para a régua da área achar que ainda havia
      // fundo. A volta seguinte então ia atrás do preto do capuz e vazava o
      // corpo inteiro — sobravam o machado e o contorno.
      camadas: CAMADAS_A_MAO[chave] ?? 0,
      gradeUnica: GRADE_DA_PRIMEIRA.has(chave),
      tolerancia: CONTRASTE_BAIXO.has(chave) ? 6 : 10,
    })
    escrever(`lutadores/${chave}.webp`, atlas.buffer)
    manifesto.lutadores[chave] = {
      arquivo: `lutadores/${chave}.webp`,
      ...semBuffer(atlas),
      viradoParaEsquerda: OLHA_PARA_ESQUERDA.has(chave),
    }
  }

  console.log('\nCenário — os atos da rota')

  // Um cenário por ato (server/rpg/rota.js), achado pelo NOME DA PASTA: a
  // chave de arte de "Ruínas de Valkhar" é a mesma dos dois lados. Ato sem
  // pasta não entra no manifesto, e o palco segue desenhando o cenário que
  // já estava em cena — é o que deixa a rota inteira montada enquanto as
  // imagens não chegam.
  const pastaDeCenario = new Map()
  for (const e of readdirSync(path.join(ENTRADA, 'CENARIOS'), { withFileTypes: true })) {
    if (e.isDirectory()) pastaDeCenario.set(chaveDeArte(e.name), path.join(ENTRADA, 'CENARIOS', e.name))
  }

  acharCenariosCompartilhados(pastaDeCenario)

  manifesto.cenario.atos = {}
  for (const ato of ATOS) {
    const pasta = pastaDeCenario.get(ato.cenario)
    if (!pasta) {
      console.log(`  (sem cenário: ${ato.nome})`)
      continue
    }
    const feito = await cenarioDoAto(ato, pasta, escrever)
    if (feito) manifesto.cenario.atos[ato.cenario] = feito
  }

  // Os andares do Abismo: uma imagem por profundidade, e o palco troca de
  // uma para a outra conforme a descida muda de faixa.
  console.log('\nCenário — o Abismo')
  const abismo = path.join(ENTRADA, 'CENARIOS', 'abismo')
  manifesto.cenario.abismo = {}
  for (const nome of readdirSync(abismo).filter(ehImagem)) {
    const chave = chaveDeArte(nome)
    const relativo = `cenario/abismo-${chave}.webp`
    const feito = await cenaInteira(path.join(abismo, nome), {
      recorteDoTopo: RECORTE_DO_TOPO[chave] ?? 0,
      largura: 1600,
    })
    escrever(relativo, feito.buffer)
    manifesto.cenario.abismo[chave] = {
      arquivo: relativo,
      proporcao: feito.proporcao,
      linhaDoChao: LINHA_DO_CHAO[chave] ?? LINHA_DO_CHAO.padrao,
    }
  }

  const salao = path.join(ENTRADA, 'CENARIOS', 'cenário taberna')
  escrever('cenario/taberna.webp', await taberna(achar(salao, ehImagem), { largura: 1280 }))
  manifesto.cenario.taberna = 'cenario/taberna.webp'

  writeFileSync(path.join(SAIDA, 'arte.json'), `${JSON.stringify(manifesto, null, 2)}\n`)
  console.log(`\nPronto: ${SAIDA}\n`)
}

const semBuffer = ({ buffer, ...resto }) => resto

await principal()
