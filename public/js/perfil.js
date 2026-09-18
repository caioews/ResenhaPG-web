/**
 * Quem é o personagem: a ficha completa (Status do personagem), o perfil de
 * outro jogador (clicando no ranking ou na taverna) e a foto.
 *
 * A ficha própria e o perfil alheio saem da mesma função, `montarFicha`: o
 * servidor manda os dois no mesmo formato (verPersonagem / verPerfil), e o
 * que muda é só o que aparece embaixo da foto.
 */
import {
  ErroDaApi,
  abrirModal,
  aplicarFicha,
  avisarBom,
  avisarErro,
  comBotao,
  el,
  estado,
  fecharModal,
  linhaDeDado,
  linhaDeItem,
  mandar,
  nomeDoSlot,
  num,
  pegar,
  personagemAtivo,
  vazio,
} from './nucleo.js'

const porcento = (v) => `${Math.round(v * 1000) / 10}%`

// ====================================================== R E T R A T O

/**
 * A foto do personagem num quadro 3:4. Sem foto, o quadro mostra o emblema
 * da classe — nunca fica um buraco na tela.
 */
export function retrato(p, { classe = '', titulo = null, onClick = null } = {}) {
  const emblema = p?.classe?.emoji ?? '⚔️'
  return el(
    onClick ? 'button' : 'div',
    {
      class: `retrato${p?.foto ? '' : ' sem-foto'} ${classe}`,
      type: onClick ? 'button' : null,
      title: titulo,
      'aria-label': titulo,
      onClick,
    },
    p?.foto
      ? el('img', { src: p.foto, alt: `Foto de ${p.nome}`, loading: 'lazy', decoding: 'async' })
      : el('span', { class: 'emblema' }, emblema),
  )
}

// ========================================================== F I C H A

const NOMES_DE_EFEITO = {
  perfuracao: 'Perfuração',
  execucao: 'Execução',
  progressivo: 'Dano progressivo',
  golpeDuplo: 'Golpe duplo',
  servo: 'Servo',
  vampirismo: 'Vampirismo',
  reducaoDeDano: 'Redução de dano',
  furia: 'Fúria',
  maldicao: 'Maldição',
  prender: 'Prender',
  esquivaExtra: 'Esquiva extra',
  precisao: 'Precisão',
  critico: 'Crítico',
  danoExtra: 'Dano extra',
  regeneracao: 'Regeneração',
  curaDoGrupo: 'Cura do grupo (raid e evento)',
  contraAtaque: 'Contra-ataque',
  iniciativa: 'Iniciativa',
  saqueGold: 'Gold extra',
  saqueDrop: 'Chance de drop',
}

/**
 * Um efeito em texto. Fração simples vira porcentagem; objeto com chance
 * própria (execução, maldição, fúria) vira a frase que descreve o efeito.
 */
function formatarEfeito(v) {
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'number') return porcento(v)
  if (v.chance !== undefined) {
    const partes = [porcento(v.chance)]
    if (v.mult) partes.push(`dano ×${v.mult}`)
    if (v.perfuracao) partes.push(`ignora ${porcento(v.perfuracao)} da defesa`)
    return partes.join(' · ')
  }
  if (v.porAcerto !== undefined) return `${porcento(v.porAcerto)} por acerto, até ${porcento(v.teto)}`
  if (v.porRodada !== undefined) return `${porcento(v.porRodada)} por rodada, até ${porcento(v.teto)}`
  return JSON.stringify(v)
}

const tituloDaFicha = (p) =>
  `${p.classe?.emoji ?? '⚔️'} ${p.nome} — nível ${p.nivel}${p.prestigio?.contador ? ` · ⭐${p.prestigio.contador}` : ''}`

/**
 * O corpo da ficha. `lateral` é o que vai embaixo da foto: os botões de
 * trocar a foto na ficha própria, o "na taverna agora" no perfil alheio.
 */
function montarFicha(p, { retratoClicavel = null, lateral = [], antes = null } = {}) {
  const a = p.atributos

  const linhagem = el(
    'div',
    { class: 'trilha' },
    ...p.linhagem.flatMap((c, i) => [
      i > 0 ? el('span', { class: 'seta' }, '→') : null,
      el('span', { class: `degrau${c.id === p.classe?.id ? ' atual' : ''}` }, `${c.emoji} ${c.nome}`),
    ]),
  )

  const efeitos = Object.entries(p.efeitos ?? {})
  const listaDeEfeitos = efeitos.length
    ? el(
        'div',
        { class: 'lista' },
        ...efeitos.map(([chave, valor]) => linhaDeDado(NOMES_DE_EFEITO[chave] ?? chave, formatarEfeito(valor))),
      )
    : vazio('Nenhum efeito ainda — as habilidades chegam com o Rito, no nível 50.')

  // O prestígio mora embaixo da foto: é quem o personagem É, não um número
  // de combate — e a frase inteira não cabe numa linha da coluna de atributos.
  const prestigio = p.prestigio?.contador
    ? el(
        'div',
        { class: 'retrato-prestigio' },
        el('div', { class: 'estrela-prestigio' }, `⭐ Prestígio ${p.prestigio.contador}`),
        el(
          'div',
          { class: 'sussurro' },
          `+${porcento(p.prestigio.bonusAtributos)} atributos · +${porcento(p.prestigio.bonusXp)} XP`,
        ),
      )
    : null

  const topo = el(
    'div',
    { class: 'ficha-topo' },
    el(
      'div',
      { class: 'ficha-retrato' },
      retrato(p, {
        classe: 'grande',
        titulo: retratoClicavel ? (p.foto ? 'Trocar a foto' : 'Enviar uma foto') : null,
        onClick: retratoClicavel,
      }),
      prestigio,
      ...lateral,
    ),
    el(
      'div',
      { class: 'bloco' },
      el('h4', {}, 'Atributos'),
      linhaDeDado('❤️ Vida', `${num(p.hp)} / ${num(p.hpMax)}`),
      linhaDeDado('⚔️ Ataque', num(a.atq)),
      linhaDeDado('🛡️ Defesa', num(a.def)),
      linhaDeDado('🥾 Agilidade', num(a.agi)),
      linhaDeDado('💰 Gold', num(p.gold), 'ouro'),
      linhaDeDado('📈 XP no nível', `${num(p.xp)} / ${num(p.xpParaSubir)}`),
    ),
    el(
      'div',
      { class: 'bloco' },
      el('h4', {}, 'Feitos'),
      linhaDeDado('Vitórias em caçada', num(p.vitorias)),
      linhaDeDado('Derrotas', num(p.derrotas)),
      linhaDeDado('Chefes vencidos', num(p.boss.vencidos.length)),
      linhaDeDado('Abismo — recorde', p.abismo.melhorAndar ? `andar ${p.abismo.melhorAndar}` : '—'),
      linhaDeDado('Masmorra — recorde', p.masmorra?.melhorAndar ? `andar ${p.masmorra.melhorAndar}` : '—'),
      linhaDeDado('Raids', `${num(p.raid.vitorias)}V / ${num(p.raid.derrotas)}D`),
      linhaDeDado('PvP', `${num(p.pvp.pontos)} pts · ${num(p.pvp.vitorias)}V / ${num(p.pvp.derrotas)}D`),
    ),
  )

  return el(
    'div',
    {},
    antes,
    linhagem,
    topo,
    el(
      'div',
      { class: 'bloco', style: 'margin-top:14px' },
      el('h4', {}, `Habilidades (${p.habilidades.length})`),
      p.habilidades.length
        ? el(
            'div',
            { class: 'lista' },
            ...p.habilidades.map((h) =>
              el(
                'div',
                { class: 'linha-item' },
                el('div', { class: 'icone' }, h.emoji),
                el('div', { class: 'corpo' }, el('div', { class: 'nome' }, h.nome), el('div', { class: 'detalhe' }, h.resumo)),
              ),
            ),
          )
        : vazio('As habilidades acumulam a cada degrau da árvore. A primeira vem no nível 50.'),
    ),
    el(
      'div',
      { class: 'bloco', style: 'margin-top:14px' },
      el('h4', {}, 'Equipamento'),
      el(
        'div',
        { class: 'lista' },
        ...Object.entries(p.equipado).map(([slot, item]) =>
          item
            ? linhaDeItem(item)
            : el(
                'div',
                { class: 'linha-item' },
                el('div', { class: 'icone' }, '·'),
                el(
                  'div',
                  { class: 'corpo' },
                  el('div', { class: 'nome', style: 'color:#5a5449;font-style:italic' }, `${nomeDoSlot(slot)} — vazio`),
                ),
              ),
        ),
      ),
    ),
    el('div', { class: 'bloco', style: 'margin-top:14px' }, el('h4', {}, 'Efeitos somados'), listaDeEfeitos),
  )
}

/** A ficha do próprio personagem — o "Status do personagem" do menu. */
export async function abrirFicha() {
  const p = estado.p
  const trocar = () => abrirEditorDeFoto({ aoTerminar: abrirFicha })

  const botoes = el(
    'div',
    { class: 'retrato-botoes' },
    el('button', { class: 'btn pequeno', type: 'button', onClick: trocar }, p.foto ? '📷 Trocar' : '📷 Enviar foto'),
    p.foto
      ? el(
          'button',
          {
            class: 'btn pequeno',
            type: 'button',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                await mandar('/api/foto/remover')
                avisarBom('Foto removida.')
                abrirFicha()
              }),
          },
          'Remover',
        )
      : null,
  )

  abrirModal(tituloDaFicha(p), montarFicha(p, { retratoClicavel: trocar, lateral: [botoes] }))
}

/**
 * O perfil de outro jogador. `voltar` é o painel de onde a pessoa veio (o
 * ranking, na aba em que estava): o modal é um só, então sem o botão ela
 * teria de abrir o ranking de novo e achar a aba.
 */
export async function abrirPerfil(id, { voltar = null, rotuloVoltar = 'Voltar' } = {}) {
  if (id === estado.p?.id) return abrirFicha()

  let perfil
  try {
    ;({ perfil } = await pegar(`/api/jogadores/${encodeURIComponent(id)}`))
  } catch (e) {
    return avisarErro(e)
  }

  const lateral = [
    perfil.online
      ? el('div', { class: 'retrato-status online' }, el('span', { class: 'ponto' }), 'Na taverna agora')
      : null,
    el('div', { class: 'retrato-status' }, `Sua chance num duelo: ${perfil.chance}%`),
  ]

  const antes = voltar
    ? el(
        'div',
        { style: 'margin-bottom:10px' },
        el('button', { class: 'btn pequeno', type: 'button', onClick: voltar }, `← ${rotuloVoltar}`),
      )
    : null

  abrirModal(tituloDaFicha(perfil), montarFicha(perfil, { lateral, antes }))
}

// ====================================================== E D I T O R

/**
 * O tamanho final da foto. Tem de bater com config.web.fotoLargura/Altura
 * no servidor — lá é só a referência; quem recorta é aqui.
 */
const FOTO_LARGURA = 480
const FOTO_ALTURA = 640
/** Imagem enorme (foto de celular de 12 MP) é reduzida uma vez, na entrada: arrastar fica leve. */
const LADO_MAXIMO_DA_FONTE = 2000
const ZOOM_MAXIMO = 4

/**
 * Escolher, enquadrar e mandar a foto. A pessoa arrasta para posicionar e
 * usa a barra (ou a rodinha do mouse) para aproximar; o quadro tem a
 * proporção exata da foto final, então o que se vê é o que fica.
 */
export function abrirEditorDeFoto({ aoTerminar = fecharModal } = {}) {
  const tela = el('canvas', { class: 'recorte-tela' })
  const dica = el('div', { class: 'recorte-dica' }, 'Escolha uma imagem', el('small', {}, 'ou arraste uma para cá'))
  const palco = el('div', { class: 'recorte' }, tela, dica)
  const zoom = el('input', { type: 'range', min: '1', max: String(ZOOM_MAXIMO), step: '0.01', value: '1', disabled: true })
  const arquivo = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/*', hidden: true })
  const salvar = el('button', { class: 'btn primario', type: 'button', disabled: true }, 'Salvar foto')

  /** A imagem (ou a versão reduzida dela) e o enquadramento atual. */
  const q = { fonte: null, largura: 0, altura: 0, escala: 1, x: 0, y: 0 }

  const medidas = () => ({ w: palco.clientWidth, h: palco.clientHeight })
  const escalaMinima = () => {
    const { w, h } = medidas()
    return Math.max(w / q.largura, h / q.altura)
  }

  // A imagem sempre cobre o quadro inteiro: nada de faixa vazia na borda.
  function prender() {
    const { w, h } = medidas()
    q.x = Math.min(0, Math.max(w - q.largura * q.escala, q.x))
    q.y = Math.min(0, Math.max(h - q.altura * q.escala, q.y))
  }

  function desenhar() {
    const { w, h } = medidas()
    const dpr = window.devicePixelRatio || 1
    if (tela.width !== Math.round(w * dpr) || tela.height !== Math.round(h * dpr)) {
      tela.width = Math.round(w * dpr)
      tela.height = Math.round(h * dpr)
    }
    const ctx = tela.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0a0f'
    ctx.fillRect(0, 0, w, h)
    if (!q.fonte) return
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(q.fonte, q.x, q.y, q.largura * q.escala, q.altura * q.escala)
  }

  /** Aproxima mantendo parado o ponto (px, py) do quadro — o centro, ou onde está o mouse. */
  function aproximar(nova, px, py) {
    const minima = escalaMinima()
    nova = Math.min(minima * ZOOM_MAXIMO, Math.max(minima, nova))
    const ix = (px - q.x) / q.escala
    const iy = (py - q.y) / q.escala
    q.escala = nova
    q.x = px - ix * nova
    q.y = py - iy * nova
    prender()
    zoom.value = String(nova / minima)
    desenhar()
  }

  async function carregar(file) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      return avisarErro('Escolha uma imagem (JPG, PNG ou WebP).')
    }

    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()

      // Reduz uma vez aqui, e não a cada quadro do arrasto.
      let fonte = img
      let largura = img.naturalWidth
      let altura = img.naturalHeight
      const maior = Math.max(largura, altura)
      if (maior > LADO_MAXIMO_DA_FONTE) {
        const k = LADO_MAXIMO_DA_FONTE / maior
        largura = Math.round(largura * k)
        altura = Math.round(altura * k)
        fonte = el('canvas', { width: largura, height: altura })
        const ctx = fonte.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, largura, altura)
      }

      Object.assign(q, { fonte, largura, altura })
      const { w, h } = medidas()
      q.escala = escalaMinima()
      q.x = (w - largura * q.escala) / 2
      // Retrato costuma ter o rosto no terço de cima: começa um pouco acima do centro.
      q.y = Math.min(0, (h - altura * q.escala) * 0.3)
      prender()

      zoom.value = '1'
      zoom.disabled = false
      salvar.disabled = false
      dica.hidden = true
      palco.classList.add('com-imagem')
      desenhar()
    } catch {
      avisarErro('Não deu para abrir essa imagem. Tente um JPG ou PNG.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  // ---- arrastar (mouse e dedo)
  let arrasto = null
  // Quadro vazio: tocar nele abre a escolha de arquivo. Tem de ser no
  // `click` — no celular o `pointerdown` não conta como gesto para abrir o
  // seletor.
  palco.addEventListener('click', () => {
    if (!q.fonte) arquivo.click()
  })
  palco.addEventListener('pointerdown', (ev) => {
    if (!q.fonte) return
    // A captura só deixa o arrasto continuar com o dedo fora do quadro; se
    // o navegador recusar, arrastar dentro dele funciona do mesmo jeito.
    try {
      palco.setPointerCapture(ev.pointerId)
    } catch {
      // segue sem captura
    }
    arrasto = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }
    palco.classList.add('arrastando')
  })
  palco.addEventListener('pointermove', (ev) => {
    if (!arrasto || ev.pointerId !== arrasto.id) return
    q.x += ev.clientX - arrasto.x
    q.y += ev.clientY - arrasto.y
    arrasto.x = ev.clientX
    arrasto.y = ev.clientY
    prender()
    desenhar()
  })
  const soltar = () => {
    arrasto = null
    palco.classList.remove('arrastando')
  }
  palco.addEventListener('pointerup', soltar)
  palco.addEventListener('pointercancel', soltar)

  // ---- rodinha do mouse: aproxima em volta do ponteiro
  palco.addEventListener(
    'wheel',
    (ev) => {
      if (!q.fonte) return
      ev.preventDefault()
      const caixa = palco.getBoundingClientRect()
      aproximar(q.escala * Math.exp(-ev.deltaY * 0.0015), ev.clientX - caixa.left, ev.clientY - caixa.top)
    },
    { passive: false },
  )

  zoom.addEventListener('input', () => {
    if (!q.fonte) return
    const { w, h } = medidas()
    aproximar(escalaMinima() * Number(zoom.value), w / 2, h / 2)
  })

  // ---- arrastar um arquivo para o quadro
  palco.addEventListener('dragover', (ev) => {
    ev.preventDefault()
    palco.classList.add('soltando')
  })
  palco.addEventListener('dragleave', () => palco.classList.remove('soltando'))
  palco.addEventListener('drop', (ev) => {
    ev.preventDefault()
    palco.classList.remove('soltando')
    carregar(ev.dataTransfer?.files?.[0])
  })

  arquivo.addEventListener('change', () => {
    carregar(arquivo.files?.[0])
    arquivo.value = ''
  })

  /** O quadro recortado, no tamanho final, como JPEG. */
  function exportar(qualidade) {
    const { w } = medidas()
    const k = FOTO_LARGURA / w
    const saida = el('canvas', { width: FOTO_LARGURA, height: FOTO_ALTURA })
    const ctx = saida.getContext('2d')
    ctx.fillStyle = '#0b0a0f'
    ctx.fillRect(0, 0, FOTO_LARGURA, FOTO_ALTURA)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(q.fonte, q.x * k, q.y * k, q.largura * q.escala * k, q.altura * q.escala * k)
    return new Promise((ok) => saida.toBlob(ok, 'image/jpeg', qualidade))
  }

  salvar.addEventListener('click', (ev) =>
    comBotao(ev.currentTarget, async () => {
      if (!q.fonte) return
      let blob = await exportar(0.86)
      if (blob && blob.size > 380 * 1024) blob = await exportar(0.7)
      if (!blob) throw new Error('Não consegui preparar a imagem.')

      const res = await fetch('/api/foto', {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg', 'x-personagem': personagemAtivo() ?? '' },
        body: blob,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new ErroDaApi(json.erro ?? 'Não consegui mandar a foto.', res.status, json)
      if (json.personagem) aplicarFicha(json.personagem)

      avisarBom('Foto nova no lugar!')
      aoTerminar()
    }),
  )

  const corpo = el(
    'div',
    { class: 'editor-foto' },
    palco,
    el('label', { class: 'recorte-zoom' }, el('span', {}, '🔍'), zoom),
    el(
      'p',
      { class: 'sussurro', style: 'margin:4px 0 0;text-align:center' },
      'Arraste para enquadrar e use a barra para aproximar. A foto aparece na sua ficha, no ranking e no seu perfil.',
    ),
    arquivo,
    el(
      'div',
      { class: 'editor-foto-botoes' },
      el('button', { class: 'btn', type: 'button', onClick: () => arquivo.click() }, 'Escolher imagem'),
      el('span', { style: 'flex:1' }),
      el('button', { class: 'btn', type: 'button', onClick: () => aoTerminar() }, 'Cancelar'),
      salvar,
    ),
  )

  abrirModal('Foto do personagem', corpo, { largura: 'estreito' })
  // O quadro só tem tamanho depois de entrar na tela.
  requestAnimationFrame(desenhar)
}
