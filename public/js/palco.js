/**
 * O palco: o jogo visto, ao lado do log que já existia.
 *
 * Três cenas moram aqui. A taberna, onde ficam sentados os personagens que
 * estão on-line — é o que aparece enquanto ninguém está caçando. A rota, por
 * onde o personagem anda de fase em fase enfrentando a horda de cada uma. E
 * o Abismo, que é a mesma rota com outro conjunto de cenários.
 *
 * As duas cenas de luta desenham a mesma coisa: um panorama que se repete
 * enquanto o personagem anda para a direita, e que troca — com uma passagem
 * suave por cima, sem piscar — quando a viagem muda de lugar. O panorama
 * vem em uma de duas formas, e o manifesto diz qual:
 *
 *   em camadas  várias imagens, cada uma numa velocidade. É o parallax, e
 *               é como o ato 1 (Ruínas de Valkhar) foi desenhado.
 *   inteiriço   uma imagem só, repetida espelhada. É o que basta para um
 *               ato, e é como vêm os andares do Abismo.
 *
 * Duas regras valem para o arquivo inteiro:
 *
 * 1. O palco NÃO decide nada. Quem diz quem bateu, quanto tirou e quem caiu
 *    continua sendo o servidor, pelo mesmo log que vira texto na narrativa.
 *    Aqui só se desenha o que já aconteceu.
 *
 * 2. Todo tempo é relógio de parede, nunca contagem de quadros. Aba escondida
 *    congela o `requestAnimationFrame`: se a caminhada dependesse dele, quem
 *    trocasse de aba no meio da caçada ficaria esperando para sempre. Com
 *    relógio, o desenho pausa e a história continua.
 */

/** O palco é desenhado sempre neste tamanho; o CSS estica. */
const LARGURA = 640
const ALTURA = 360

/**
 * Um pouco de zoom no panorama em camadas: sobra cenário para a câmera
 * andar por dentro dele.
 */
const ZOOM = 1.2
/**
 * No cenário inteiriço o zoom é quase nenhum: ele vem numa imagem só,
 * desenhada inteira, e cortar o teto seria jogar fora metade do desenho.
 */
const ZOOM_INTEIRO = 1.04
/** Quanto dura a passagem de um cenário para o seguinte. */
const TROCA_DE_CENARIO = 900
/** Do tamanho do atlas para o tamanho em cena. */
const ESCALA = 0.78
/** Onde o herói fica quando a luta começa, em pixels de palco. */
const POSTO_DO_HEROI = 215
/** A distância entre os dois na hora da luta. */
const DISTANCIA_DA_LUTA = 200
/** Velocidade de caminhada, em pixels de palco por segundo. */
const PASSO = 145
/** Quanto dura a escurecida entre uma cena e outra. */
const FADE = 620

/**
 * Cada animação é uma faixa do atlas. Quantos quadros ela tem vem do
 * manifesto, por linha: as folhas não são todas iguais — o golem tem quatro
 * quadros por faixa, o orc anda em sete, o esqueleto defende em quatro.
 */
const ANIMACOES = {
  parado: { linha: 'andar', porQuadro: 900, unico: true },
  andar: { linha: 'andar', porQuadro: 95, laco: true },
  atacar: { linha: 'atacar', porQuadro: 42 },
  defender: { linha: 'defender', porQuadro: 46 },
}

// ------------------------------------------------------------- estado

const estado = {
  tela: null,
  ctx: null,
  arte: null,
  caixa: null,
  cena: 'nada',
  ligado: false,
  /** Transição entre cenas; `ate` = 0 quando não há nenhuma em curso. */
  fade: { de: 0, ate: 0 },
  /** Qual cenário está em cena, e de qual ele está saindo. */
  cenario: { chave: null, anterior: null, trocouEm: 0 },
  camera: { x: 0 },
  heroi: null,
  monstro: null,
  /** Os bichos já derrubados, que ficam caídos no caminho até sair de cena. */
  caidos: [],
  pessoas: [],
  flutuantes: [],
}

const imagens = new Map()
const aguardando = new Map()

const agora = () => performance.now()
const limitar = (v, min, max) => Math.max(min, Math.min(max, v))
const dormir = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)))

/** Carrega (uma vez) uma imagem da pasta de arte. */
function carregar(relativo) {
  if (!relativo) return Promise.resolve(null)
  if (imagens.has(relativo)) return Promise.resolve(imagens.get(relativo))
  if (aguardando.has(relativo)) return aguardando.get(relativo)

  const promessa = new Promise((ok, falhou) => {
    const img = new Image()
    img.onload = () => {
      imagens.set(relativo, img)
      aguardando.delete(relativo)
      ok(img)
    }
    img.onerror = () => {
      aguardando.delete(relativo)
      falhou(new Error(`não carreguei ${relativo}`))
    }
    img.src = `/arte/${relativo}`
  })

  aguardando.set(relativo, promessa)
  return promessa
}

const pronta = (relativo) => imagens.get(relativo) ?? null
const tentarCarregar = (relativo) => carregar(relativo).catch(() => null)

// -------------------------------------------------------- preparação

/**
 * Liga o palco. Busca o manifesto (quem tem sprite, onde cada camada do
 * cenário entra) e começa a desenhar.
 */
export async function prepararPalco(elemento, { classe = null } = {}) {
  estado.caixa = elemento
  estado.tela = elemento.querySelector('canvas')
  estado.ctx = estado.tela.getContext('2d')

  if (!estado.arte) {
    const res = await fetch('/arte/arte.json')
    if (!res.ok) throw new Error('sem manifesto de arte')
    estado.arte = await res.json()
  }

  ajustarTela()
  new ResizeObserver(ajustarTela).observe(elemento)

  // A arte da luta entra em segundo plano: quando a pessoa clicar em "Ir à
  // caçada" já está tudo carregado, e a taberna abre sem esperar por ela.
  setTimeout(() => {
    const heroi = spriteDaClasse(classe)
    if (heroi) tentarCarregar(estado.arte.lutadores[heroi].arquivo)
    const bicho = spriteDoMonstro(null)
    if (bicho) tentarCarregar(estado.arte.lutadores[bicho].arquivo)
  }, 2500)

  if (!estado.ligado) {
    estado.ligado = true
    // O laço fica pendurado enquanto a aba está escondida e volta sozinho
    // quando ela aparece — por isso o tempo do palco é relógio, não quadro.
    requestAnimationFrame(laco)
  }

  return estado.arte
}

export const palcoPreparado = () => Boolean(estado.arte)

/** Se o palco está mostrando a rota (a caçada), e não a taberna. */
export const palcoNaRota = () => estado.cena === 'rota'

/** Se o palco está fora da taberna — na rota ou no Abismo. */
export const palcoEmCena = () => estado.cena === 'rota' || estado.cena === 'abismo'

/**
 * Quem quer saber que a cena mudou. É assim que o menu de ações descobre
 * que agora existe um "Voltar para a taberna" — sem o palco precisar
 * conhecer o menu.
 */
const ouvintesDaCena = new Set()
export const aoTrocarDeCena = (fn) => ouvintesDaCena.add(fn)

function entrarNaCena(nova) {
  estado.cena = nova
  for (const ouvinte of ouvintesDaCena) ouvinte(nova)
}

function ajustarTela() {
  const { tela, caixa } = estado
  if (!tela || !caixa) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const largura = Math.max(1, Math.round(caixa.clientWidth * dpr))
  const altura = Math.max(1, Math.round(caixa.clientWidth * (ALTURA / LARGURA) * dpr))
  if (tela.width !== largura || tela.height !== altura) {
    tela.width = largura
    tela.height = altura
  }
}

// ------------------------------------------------------------ lutadores

/** A que sprite corresponde uma espécie de monstro (ou o goblin, por ora). */
export function spriteDoMonstro(id) {
  if (id && estado.arte?.lutadores?.[id]) return id
  return estado.arte?.lutadores?.goblin ? 'goblin' : null
}

/** A classe-raiz vira o sprite do herói. */
const spriteDaClasse = (classe) =>
  estado.arte?.lutadores?.[classe] ? classe : estado.arte?.lutadores?.guerreiro ? 'guerreiro' : null

function criarLutador(chave, { x, virado }) {
  const lutador = {
    chave,
    meta: estado.arte.lutadores[chave],
    x,
    virado,
    anim: 'parado',
    animDesde: agora(),
    caminhada: null,
    impulso: 0,
    empurrao: 0,
    flash: 0,
    caiuEm: 0,
    balanco: Math.random() * 6,
  }
  return lutador
}

function tocar(lutador, nome) {
  if (!lutador) return
  lutador.anim = nome
  lutador.animDesde = agora()
}

/** Manda o lutador andar até um ponto; devolve quando ele deve chegar. */
function caminhar(lutador, destino) {
  const partiu = agora()
  const duracao = (Math.abs(destino - lutador.x) / PASSO) * 1000
  lutador.caminhada = { de: lutador.x, para: destino, partiu, chega: partiu + duracao }
  tocar(lutador, 'andar')
  return lutador.caminhada.chega
}

/** Onde o lutador está agora, com a caminhada já interpolada no relógio. */
function posicao(lutador, t) {
  const c = lutador.caminhada
  if (!c) return lutador.x
  const fracao = c.chega === c.partiu ? 1 : limitar((t - c.partiu) / (c.chega - c.partiu), 0, 1)
  return c.de + (c.para - c.de) * fracao
}

/** O quadro do atlas para este instante: que linha, que coluna, e se acabou. */
function quadroDe(lutador, t) {
  const animacao = ANIMACOES[lutador.anim] ?? ANIMACOES.parado
  const linha = Math.max(0, lutador.meta.linhas.indexOf(animacao.linha))
  const naLinha = Array.isArray(lutador.meta.quadros)
    ? lutador.meta.quadros[linha] ?? 1
    : lutador.meta.quadros
  const quantos = animacao.unico ? 1 : Math.max(1, naLinha)

  const passados = Math.floor((t - lutador.animDesde) / animacao.porQuadro)
  const coluna = animacao.laco ? passados % quantos : Math.min(passados, quantos - 1)
  return { animacao, linha, coluna: Math.max(0, coluna), terminou: passados >= quantos }
}

// ------------------------------------------------------------ cenas

/** Troca de cena com escurecida no meio. Resolve quando a escurecida acaba. */
async function trocarCena(nova, duracao = FADE) {
  const inicio = agora()
  estado.fade = { de: inicio, ate: inicio + duracao }
  await dormir(duracao / 2)
  entrarNaCena(nova)
  await dormir(duracao / 2)
  if (estado.fade.ate <= agora()) estado.fade = { de: 0, ate: 0 }
}

/** A taberna, com quem estiver on-line sentado pelas mesas. */
export async function mostrarTaberna({ imediato = false } = {}) {
  if (!estado.arte) return
  tentarCarregar(estado.arte.cenario.taberna)
  if (imediato || estado.cena === 'nada') {
    entrarNaCena('taberna')
    estado.fade = { de: 0, ate: 0 }
    return
  }
  if (estado.cena === 'taberna') return
  await trocarCena('taberna')
  estado.heroi = null
  estado.monstro = null
  estado.caidos = []
}

/** Quem está on-line: vira gente sentada. O nome fica por cima do sprite. */
export function pessoasNaTaberna(lista) {
  estado.pessoas = (lista ?? []).filter((p) => p.classe).slice(0, ASSENTOS.length)
  for (const p of estado.pessoas) tentarCarregar(estado.arte?.sentados?.[p.classe])
}

// ------------------------------------------------------------- cenários

/**
 * Onde mora o cenário de uma cena. A rota tem um por ato; o Abismo, um por
 * faixa de profundidade. Fora isso os dois são a mesma coisa para o palco.
 */
const bancoDeCenarios = (cena = estado.cena) =>
  (cena === 'abismo' ? estado.arte?.cenario?.abismo : estado.arte?.cenario?.atos) ?? {}

const dadosDoCenario = (chave, cena) => bancoDeCenarios(cena)[chave] ?? null

/** Os arquivos de um cenário: as camadas dele, ou a imagem única. */
const arquivosDoCenario = (dados) =>
  dados ? (dados.camadas ? dados.camadas.map((c) => c.arquivo) : [dados.arquivo]) : []

/** Deixa prontos os cenários que esta caçada ou esta descida vai atravessar. */
export function prepararCenarios(chaves, cena = estado.cena) {
  for (const chave of new Set(chaves.filter(Boolean))) {
    for (const arquivo of arquivosDoCenario(dadosDoCenario(chave, cena))) tentarCarregar(arquivo)
  }
}

/**
 * Sai da taberna e entra numa cena de luta: o personagem aparece pela
 * esquerda andando para a direita, com a câmera atrás.
 *
 * Vale para a rota e para o Abismo — a única diferença é de qual banco sai o
 * cenário e quanto o herói anda antes de o primeiro inimigo entrar.
 */
async function entrarEmCampo(cena, classe, chave, distancia) {
  if (!estado.arte) return
  const heroi = spriteDaClasse(classe)
  const dados = dadosDoCenario(chave, cena)
  if (!heroi) return

  await Promise.all([
    ...arquivosDoCenario(dados).map(tentarCarregar),
    tentarCarregar(estado.arte.lutadores[heroi].arquivo),
  ])

  estado.cenario = { chave, anterior: null, trocouEm: 0 }
  estado.monstro = null
  estado.caidos = []
  estado.flutuantes = []
  estado.camera.x = 0
  estado.heroi = criarLutador(heroi, { x: -70, virado: 1 })
  caminhar(estado.heroi, POSTO_DO_HEROI + distancia)

  if (estado.cena !== cena) await trocarCena(cena)
}

/** Entra na rota, no cenário do ato em que o personagem está. */
export const irParaOAto = (classe, chave) => entrarEmCampo('rota', classe, chave, 260)

/** Entra no Abismo, no cenário do primeiro andar da descida. */
export const irAoAbismo = (classe, chave) => entrarEmCampo('abismo', classe, chave, 170)

/**
 * Segue viagem: o herói caminha mais um trecho e, se o lugar mudou, o
 * cenário novo entra por cima do velho sem piscar preto no meio.
 *
 * É o mesmo movimento para a fase seguinte da rota e para o andar seguinte
 * do Abismo. Passar a mesma chave de sempre só faz o herói andar.
 */
export function seguirViagem(chave = estado.cenario.chave) {
  if (!palcoEmCena() || !estado.heroi) return

  if (estado.monstro?.caiuEm) estado.caidos.push(estado.monstro)
  estado.monstro = null
  // Quem apanhou na fase anterior levanta antes de seguir.
  estado.heroi.caiuEm = 0
  caminhar(estado.heroi, posicao(estado.heroi, agora()) + 215)

  if (chave && chave !== estado.cenario.chave && dadosDoCenario(chave)) {
    for (const arquivo of arquivosDoCenario(dadosDoCenario(chave))) tentarCarregar(arquivo)
    estado.cenario = { chave, anterior: estado.cenario.chave, trocouEm: agora() }
  }
}

/** Qual cenário está em cena agora. */
export const cenarioEmCena = () => estado.cenario.chave

/** O bicho entra pela direita e para na distância de luta. */
export async function entrarOMonstro(especie) {
  if (!estado.arte) return
  const chave = spriteDoMonstro(especie)
  if (!chave || !estado.heroi) return
  await tentarCarregar(estado.arte.lutadores[chave].arquivo)

  const destinoDoHeroi = estado.heroi.caminhada?.para ?? estado.heroi.x
  estado.monstro = criarLutador(chave, { x: destinoDoHeroi + LARGURA - POSTO_DO_HEROI + 90, virado: -1 })
  caminhar(estado.monstro, destinoDoHeroi + DISTANCIA_DA_LUTA)
}

/** Espera os dois chegarem ao lugar. O relógio manda, não o desenho. */
export async function esperarEmPosicao() {
  const chegada = Math.max(
    estado.heroi?.caminhada?.chega ?? 0,
    estado.monstro?.caminhada?.chega ?? 0,
  )
  await dormir(chegada - agora())
}

// ------------------------------------------------------------- luta

/** Um número subindo em cima de quem levou (ou de quem se curou). */
function flutuar(lutador, texto, cor) {
  if (!lutador) return
  estado.flutuantes.push({ texto, cor, x: posicao(lutador, agora()), nasceu: agora() })
}

/**
 * Um lance do log virando movimento. É chamado pela narrativa, uma vez por
 * linha, então o palco conta exatamente a mesma luta que o texto.
 */
export function golpe(entrada) {
  if (!palcoEmCena() || !estado.heroi || !estado.monstro) return

  const eu = entrada.quem === 'b' ? estado.monstro : estado.heroi
  const outro = entrada.quem === 'b' ? estado.heroi : estado.monstro

  if (entrada.tipo === 'regenerou') return flutuar(eu, `+${Math.round(entrada.cura ?? 0)}`, '#7bc47b')
  if (entrada.tipo === 'preso' || eu.caiuEm || outro.caiuEm) return

  tocar(eu, 'atacar')
  eu.impulso = agora()
  tocar(outro, 'defender')

  if (entrada.esquivou) {
    outro.empurrao = { desde: agora(), quanto: -outro.virado * 30 }
    return flutuar(outro, 'esquiva', '#9fd1e8')
  }

  outro.flash = agora()
  outro.empurrao = { desde: agora(), quanto: -outro.virado * 18 }
  flutuar(
    outro,
    `-${Math.round(entrada.dano ?? 0).toLocaleString('pt-BR')}`,
    entrada.executou ? '#ff9d5c' : entrada.critico ? '#ffd166' : '#f0e8d8',
  )
}

/** Fim de luta: quem perdeu cai, quem venceu respira. */
export function fimDaLuta({ venceu }) {
  if (!palcoEmCena() || !estado.heroi || !estado.monstro) return
  const perdedor = venceu ? estado.monstro : estado.heroi
  const vencedor = venceu ? estado.heroi : estado.monstro
  perdedor.caiuEm = agora()
  tocar(perdedor, 'defender')
  tocar(vencedor, 'parado')
}

// --------------------------------------------------------- desenho

/** O cenário em cena: o do ato da rota, ou o do andar do Abismo. */
const cenarioAtual = () => dadosDoCenario(estado.cenario.chave)

/** O zoom depende da forma: em camadas a câmera anda por dentro do panorama. */
const zoomDe = (dados) => (dados?.camadas ? ZOOM : ZOOM_INTEIRO)

const panoramaAltura = (dados = cenarioAtual()) => ALTURA * zoomDe(dados)
const panoramaTopo = (dados = cenarioAtual()) => ALTURA - panoramaAltura(dados)
const linhaDoChao = () => {
  const dados = cenarioAtual()
  return panoramaTopo(dados) + panoramaAltura(dados) * (dados?.linhaDoChao ?? 0.94)
}

/**
 * Um panorama desenhado, repetido enquanto o personagem anda — é a
 * repetição que dá a sensação de movimento.
 *
 * Em camadas, cada uma anda no seu ritmo e sai o parallax; inteiriço, é uma
 * imagem só. `opacidade` é o que faz a passagem de um lugar para o outro:
 * o novo aparece por cima do velho em vez de piscar preto no meio.
 */
function desenharPanorama(ctx, dados, opacidade = 1) {
  if (!dados) return
  const alturaP = panoramaAltura(dados)
  const topo = panoramaTopo(dados)
  const largura = alturaP * (dados.proporcao ?? 2)

  ctx.globalAlpha = opacidade

  if (dados.camadas) {
    for (const camada of dados.camadas) {
      const img = pronta(camada.arquivo)
      if (!img) continue
      repetir(
        ctx,
        img,
        -estado.camera.x * camada.velocidade,
        topo + alturaP * camada.de,
        largura,
        alturaP * (camada.ate - camada.de),
      )
    }
  } else {
    const img = pronta(dados.arquivo)
    if (img) repetir(ctx, img, -estado.camera.x, topo, largura, alturaP)
  }

  ctx.globalAlpha = 1
}

/** O que vale para as duas cenas de luta: cenário, elenco e números. */
function desenharCena(ctx, t) {
  // A câmera anda atrás do herói, sem fim: o cenário se repete.
  if (estado.heroi) estado.camera.x = posicao(estado.heroi, t) - POSTO_DO_HEROI

  ctx.fillStyle = estado.cena === 'abismo' ? '#05040a' : '#0b0a12'
  ctx.fillRect(0, 0, LARGURA, ALTURA)

  const trocando = estado.cenario.anterior && t - estado.cenario.trocouEm < TROCA_DE_CENARIO
  if (trocando) desenharPanorama(ctx, dadosDoCenario(estado.cenario.anterior))
  desenharPanorama(
    ctx,
    cenarioAtual(),
    trocando ? limitar((t - estado.cenario.trocouEm) / TROCA_DE_CENARIO, 0, 1) : 1,
  )

  estado.caidos = estado.caidos.filter((c) => c.x - estado.camera.x > -140)
  for (const lutador of [...estado.caidos, estado.heroi, estado.monstro].filter(Boolean).sort((a, b) => a.x - b.x)) {
    desenharLutador(ctx, lutador, t)
  }

  estado.flutuantes = estado.flutuantes.filter((f) => t - f.nasceu < 900)
  for (const f of estado.flutuantes) {
    const fracao = (t - f.nasceu) / 900
    ctx.globalAlpha = limitar(1 - fracao, 0, 1)
    ctx.font = '700 17px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(6,5,10,0.85)'
    ctx.strokeText(f.texto, f.x - estado.camera.x, linhaDoChao() - 104 - fracao * 42)
    ctx.fillStyle = f.cor
    ctx.fillText(f.texto, f.x - estado.camera.x, linhaDoChao() - 104 - fracao * 42)
    ctx.globalAlpha = 1
  }

  // Um véu escuro no rodapé para o desenho não brigar com a moldura.
  const veu = ctx.createLinearGradient(0, ALTURA - 60, 0, ALTURA)
  veu.addColorStop(0, 'rgba(8,6,14,0)')
  veu.addColorStop(1, 'rgba(8,6,14,0.5)')
  ctx.fillStyle = veu
  ctx.fillRect(0, ALTURA - 60, LARGURA, 60)
}

/**
 * A camada repetida até cobrir a tela, invertendo uma cópia sim, outra não.
 * O panorama não foi feito para emendar consigo mesmo; espelhado, emenda —
 * e é isso que deixa o personagem andar para sempre.
 */
function repetir(ctx, img, dx, dy, dw, dh) {
  const primeiro = Math.ceil(-dx / dw) - 1
  const ultimo = Math.ceil((LARGURA - dx) / dw)
  for (let i = primeiro; i < ultimo; i++) {
    const x = i * dw + dx
    if (((i % 2) + 2) % 2 === 1) {
      ctx.save()
      ctx.translate(x + dw, dy)
      ctx.scale(-1, 1)
      ctx.drawImage(img, 0, 0, dw, dh)
      ctx.restore()
    } else {
      ctx.drawImage(img, x, dy, dw, dh)
    }
  }
}

/** Uma tela de rascunho: é nela que o quadro ganha o vermelho do baque. */
const rascunho = document.createElement('canvas')

/**
 * O quadro pintado de vermelho. Tem de ser numa tela à parte: `source-atop`
 * na tela principal pintaria o cenário inteiro, não só o boneco.
 */
function tingir(img, sx, sy, sw, sh, forca) {
  if (rascunho.width !== sw || rascunho.height !== sh) {
    rascunho.width = sw
    rascunho.height = sh
  }
  const g = rascunho.getContext('2d')
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, sw, sh)
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  g.globalCompositeOperation = 'source-atop'
  g.fillStyle = `rgba(255,70,60,${(forca * 0.6).toFixed(3)})`
  g.fillRect(0, 0, sw, sh)
  g.globalCompositeOperation = 'source-over'
  return rascunho
}

/** O quadro certo do atlas, no lugar certo, com o baque de quem levou. */
function desenharLutador(ctx, l, t) {
  const img = pronta(l.meta.arquivo)
  if (!img) return

  const [cw, ch] = l.meta.quadro
  const [ax, ay] = l.meta.ancora
  const { animacao, linha, coluna, terminou } = quadroDe(l, t)

  // Golpe e defesa voltam ao repouso sozinhos quando a animação acaba.
  if (terminou && !animacao.laco && !l.caiuEm) tocar(l, 'parado')

  // Caminhada terminada vira parada.
  if (l.caminhada && t >= l.caminhada.chega) {
    l.x = l.caminhada.para
    l.caminhada = null
    if (l.anim === 'andar') tocar(l, 'parado')
  } else if (l.caminhada) {
    l.x = posicao(l, t)
  }

  const desdeImpulso = l.impulso ? t - l.impulso : Infinity
  const avanco = desdeImpulso < 260 ? Math.sin((desdeImpulso / 260) * Math.PI) * 26 * l.virado : 0
  const desdeEmpurrao = l.empurrao ? t - l.empurrao.desde : Infinity
  const recuo = desdeEmpurrao < 240 ? (1 - desdeEmpurrao / 240) * l.empurrao.quanto : 0
  const respiro = l.anim === 'parado' ? Math.sin(t / 620 + l.balanco) * 1.6 : 0
  const flash = l.flash ? Math.max(0, 1 - (t - l.flash) / 260) : 0
  const queda = l.caiuEm ? limitar((t - l.caiuEm) / 420, 0, 1) : 0

  // O atlas do herói olha para a direita; o do goblin, para a esquerda.
  const espelhar = l.meta.viradoParaEsquerda ? l.virado === 1 : l.virado === -1

  ctx.save()
  ctx.translate(l.x - estado.camera.x + avanco + recuo, linhaDoChao() + respiro)
  if (queda) {
    ctx.rotate(queda * (Math.PI / 2) * 0.82 * (espelhar ? -1 : 1))
    ctx.globalAlpha = 1 - queda * 0.5
  }
  if (espelhar) ctx.scale(-1, 1)
  ctx.scale(ESCALA, ESCALA)

  const sx = coluna * cw
  const sy = linha * ch
  if (flash > 0) ctx.drawImage(tingir(img, sx, sy, cw, ch, flash), 0, 0, cw, ch, -ax, -ay, cw, ch)
  else ctx.drawImage(img, sx, sy, cw, ch, -ax, -ay, cw, ch)

  ctx.restore()
}

// ------------------------------------------------------------ taberna

/**
 * Os lugares da taberna, em fração da imagem do salão. A ordem importa: é
 * ela que decide quem senta onde, e quem chega depois senta adiante.
 */
const ASSENTOS = [
  [0.27, 0.55],
  [0.18, 0.63],
  [0.41, 0.6],
  [0.33, 0.67],
  [0.68, 0.57],
  [0.47, 0.73],
  [0.74, 0.61],
  [0.36, 0.79],
  [0.81, 0.65],
  [0.58, 0.78],
  [0.26, 0.74],
  [0.5, 0.86],
]

function desenharTaberna(ctx, t) {
  ctx.fillStyle = '#0c0a10'
  ctx.fillRect(0, 0, LARGURA, ALTURA)

  const img = pronta(estado.arte.cenario.taberna)
  if (!img) return

  const escala = Math.max(LARGURA / img.width, ALTURA / img.height)
  const dw = img.width * escala
  const dh = img.height * escala
  const dx = (LARGURA - dw) / 2
  const dy = (ALTURA - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)

  // A lareira pisca: um clarão quente que respira.
  const piscada = 0.5 + Math.sin(t / 210) * 0.12 + Math.sin(t / 77) * 0.06
  const fogo = ctx.createRadialGradient(dx + dw * 0.29, dy + dh * 0.33, 4, dx + dw * 0.29, dy + dh * 0.33, dw * 0.24)
  fogo.addColorStop(0, `rgba(255,170,70,${(0.3 * piscada).toFixed(3)})`)
  fogo.addColorStop(1, 'rgba(255,150,60,0)')
  ctx.fillStyle = fogo
  ctx.fillRect(0, 0, LARGURA, ALTURA)

  // De trás para a frente: quem senta mais perto tapa quem está atrás.
  const sentados = estado.pessoas
    .map((pessoa, i) => ({ pessoa, assento: ASSENTOS[i % ASSENTOS.length] }))
    .sort((a, b) => a.assento[1] - b.assento[1])

  sentados.forEach(({ pessoa, assento }) => {
    const sprite = pronta(estado.arte.sentados[pessoa.classe])
    const [fx, fy] = assento
    const x = dx + dw * fx
    const y = dy + dh * fy
    const h = ALTURA * 0.185
    const w = sprite ? (sprite.width / sprite.height) * h : h
    if (!sprite) return

    // Uma sombra curta prende o sprite ao banco.
    ctx.globalAlpha = 0.32
    ctx.fillStyle = '#05040a'
    ctx.beginPath()
    ctx.ellipse(x, y, w * 0.3, h * 0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.drawImage(sprite, x - w / 2, y - h, w, h)

    const nome = pessoa.nome ?? ''
    ctx.font = '600 12px Cinzel, Georgia, serif'
    ctx.textAlign = 'center'
    const largura = ctx.measureText(nome).width + 12
    const topo = y - h - 8
    ctx.fillStyle = 'rgba(8,6,12,0.7)'
    ctx.fillRect(x - largura / 2, topo - 12, largura, 16)
    ctx.fillStyle = pessoa.eu ? '#e6c766' : '#d8cfbc'
    ctx.fillText(nome, x, topo)
  })

  if (!estado.pessoas.length) {
    ctx.font = 'italic 14px "EB Garamond", Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(214,203,180,0.75)'
    ctx.fillText('A taberna está vazia esta noite.', LARGURA / 2, ALTURA - 24)
  }
}

// --------------------------------------------------------------- laço

function desenhar(t) {
  const { ctx, tela } = estado
  if (!ctx || !tela.width) return

  ctx.setTransform(tela.width / LARGURA, 0, 0, tela.width / LARGURA, 0, 0)
  ctx.clearRect(0, 0, LARGURA, ALTURA)

  if (palcoEmCena() && cenarioAtual()) desenharCena(ctx, t)
  else if (estado.cena === 'taberna') desenharTaberna(ctx, t)
  else {
    ctx.fillStyle = '#0c0a10'
    ctx.fillRect(0, 0, LARGURA, ALTURA)
  }

  if (estado.fade.ate > t) {
    const meio = (estado.fade.de + estado.fade.ate) / 2
    const forca = 1 - Math.abs(t - meio) / ((estado.fade.ate - estado.fade.de) / 2)
    ctx.fillStyle = `rgba(6,5,10,${limitar(forca, 0, 1).toFixed(3)})`
    ctx.fillRect(0, 0, LARGURA, ALTURA)
  }
}

function laco(t) {
  if (!estado.ligado) return
  requestAnimationFrame(laco)

  if (document.hidden || !estado.caixa?.isConnected || !estado.caixa.clientWidth) return
  try {
    desenhar(t)
  } catch (e) {
    // Um quadro torto não pode matar o laço — e nem o resto do jogo.
    console.warn('palco:', e)
  }
}
