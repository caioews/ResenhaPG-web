/**
 * O núcleo do cliente: chamadas à API, estado em memória e as ajudinhas de
 * interface que todo painel usa.
 *
 * Regra que atravessa o arquivo inteiro: nada aqui decide nada do jogo. O
 * cliente pede, o servidor responde com a ficha nova, e a tela redesenha.
 */
import { palcoEmCena } from './palco.js'

export const estado = {
  usuario: null,
  personagens: [],
  maxPersonagens: 10,
  /** A ficha completa do personagem em jogo (GET /api/estado). */
  p: null,
  socket: null,
  /** Assinantes que querem redesenhar quando a ficha muda. */
  ouvintes: new Set(),
}

const CHAVE_PERSONAGEM = 'resenha:personagem'

export const personagemAtivo = () => {
  try {
    return localStorage.getItem(CHAVE_PERSONAGEM)
  } catch {
    return null
  }
}

export function definirPersonagemAtivo(id) {
  try {
    if (id) localStorage.setItem(CHAVE_PERSONAGEM, id)
    else localStorage.removeItem(CHAVE_PERSONAGEM)
  } catch {
    // Navegador com armazenamento bloqueado: o jogo ainda funciona, só não
    // lembra do personagem entre recarregamentos.
  }
}

// ------------------------------------------------------------------- API

/** Erro vindo da API, já com a mensagem que o servidor quis mostrar. */
export class ErroDaApi extends Error {
  constructor(mensagem, status, corpo) {
    super(mensagem)
    this.status = status
    this.corpo = corpo
  }
}

export async function api(metodo, caminho, corpo) {
  const cabecalhos = { 'content-type': 'application/json' }
  const id = personagemAtivo()
  if (id) cabecalhos['x-personagem'] = id

  const res = await fetch(caminho, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })

  let json = null
  try {
    json = await res.json()
  } catch {
    json = {}
  }

  if (!res.ok) throw new ErroDaApi(json.erro ?? 'Algo deu errado.', res.status, json)

  // Toda rota que altera alguma coisa devolve a ficha nova junto: aproveita.
  if (json.personagem) aplicarFicha(json.personagem)

  return json
}

export const pegar = (caminho) => api('GET', caminho)
export const mandar = (caminho, corpo) => api('POST', caminho, corpo)

export function aplicarFicha(ficha) {
  estado.p = ficha
  for (const ouvinte of estado.ouvintes) ouvinte(ficha)
}

export const aoMudarFicha = (fn) => estado.ouvintes.add(fn)

/**
 * A classe de ORIGEM do personagem — é o sprite que ele usa em cena. Um
 * Ceifador Noturno continua desenhado como o Ladino que ele era.
 */
export const classeBase = () => estado.p?.linhagem?.[0]?.id ?? estado.p?.classe?.id ?? null

// ------------------------------------------------------------ formatação

/** 12.400 em vez de 12400 — número grande no meio de texto cansa de ler. */
export const num = (n) => Math.round(Number(n) || 0).toLocaleString('pt-BR')

export function duracao(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 ? `${m}min ${s % 60}s` : `${m}min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}min` : `${h}h`
}

export const hora = (ms) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0)

const NOME_DO_SLOT = {
  arma: 'Arma',
  secundario: 'Secundário',
  elmo: 'Elmo',
  armadura: 'Armadura',
  anel: 'Anel',
}
export const nomeDoSlot = (slot) => NOME_DO_SLOT[slot] ?? slot

// --------------------------------------------------------------- DOM

/** Cria elementos sem virar sopa de innerHTML. */
export function el(tag, propriedades = {}, ...filhos) {
  const node = document.createElement(tag)

  for (const [chave, valor] of Object.entries(propriedades)) {
    if (valor === null || valor === undefined || valor === false) continue
    if (chave === 'class') node.className = valor
    else if (chave === 'dataset') Object.assign(node.dataset, valor)
    else if (chave.startsWith('on') && typeof valor === 'function') {
      node.addEventListener(chave.slice(2).toLowerCase(), valor)
    } else if (chave === 'html') node.innerHTML = valor
    else if (chave in node) node[chave] = valor
    else node.setAttribute(chave, valor)
  }

  for (const filho of filhos.flat(9)) {
    if (filho === null || filho === undefined || filho === false) continue
    node.append(filho instanceof Node ? filho : document.createTextNode(String(filho)))
  }

  return node
}

export const $ = (seletor) => document.querySelector(seletor)

export function limpar(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
  return node
}

// ------------------------------------------------------------- avisos

export function avisar(texto, tipo = '') {
  const caixa = el('div', { class: `aviso-flutuante ${tipo}` }, texto)
  $('#avisos').append(caixa)
  setTimeout(() => {
    caixa.style.transition = 'opacity .3s, transform .3s'
    caixa.style.opacity = '0'
    caixa.style.transform = 'translateY(-10px)'
    setTimeout(() => caixa.remove(), 300)
  }, 3200)
}

export const avisarErro = (e) => avisar(e instanceof Error ? e.message : String(e), 'erro')
export const avisarBom = (texto) => avisar(texto, 'bom')

/** Roda uma ação de botão mostrando que está em curso e tratando o erro. */
export async function comBotao(botao, acao) {
  if (botao.disabled) return
  const antes = botao.disabled
  botao.disabled = true
  try {
    return await acao()
  } catch (e) {
    // Recusa do servidor (cooldown, mochila cheia) é rotina; o resto é bug,
    // e aí a pilha no console vale mais que o aviso, que some em segundos.
    if (e instanceof ErroDaApi) console.warn(e.message)
    else console.error(e)
    avisarErro(e)
  } finally {
    botao.disabled = antes
  }
}

// -------------------------------------------------------------- peças

export function barra(classe, atual, maximo, rotulo) {
  return el(
    'div',
    { class: `barra ${classe}` },
    el('div', { class: 'preenchida', style: `width:${pct(atual, maximo)}%` }),
    el('div', { class: 'rotulo' }, rotulo ?? `${num(atual)} / ${num(maximo)}`),
  )
}

// -------------------------------------------------- a vida em cena

/**
 * A vida que a ficha mostra ENQUANTO uma luta esta sendo narrada.
 *
 * A ficha vem pronta do servidor, e fora de combate a vida e sempre cheia —
 * entao, sozinha, a barra lateral ficaria parada no maximo enquanto o placar
 * da luta sangra. Quem narra avisa aqui a cada golpe e as duas passam a
 * contar a mesma historia.
 *
 * `null` = nao ha luta em cena, e vale o que o servidor disse. E por isso que
 * a barra volta sozinha ao maximo quando a fase acaba: ninguem precisa
 * lembrar de desfazer nada.
 */
let vidaEmCena = null

/** A vida que a ficha deve desenhar agora. */
export const vidaDaFicha = (p) => (vidaEmCena === null ? p?.hp ?? 0 : vidaEmCena)

/** Pinta a barra da ficha no lugar — redesenhar a ficha inteira piscaria. */
function pintarVida(hp, hpMax) {
  const alvo = document.querySelector('#ficha .barra.vida')
  if (!alvo) return
  alvo.querySelector('.preenchida').style.width = `${pct(hp, hpMax)}%`
  alvo.querySelector('.rotulo').textContent = `${num(Math.max(0, hp))} / ${num(hpMax)}`
}

/** A luta mexeu na vida de quem esta jogando: a ficha acompanha. */
export function mostrarVidaEmCena(hp, hpMax) {
  vidaEmCena = Math.max(0, Math.round(hp))
  pintarVida(vidaEmCena, hpMax)
}

/** Acabou a luta: a ficha volta a mostrar o que o servidor diz. */
export function limparVidaEmCena() {
  vidaEmCena = null
  if (estado.p) pintarVida(estado.p.hp, estado.p.hpMax)
}

/**
 * O Rito, as raids e a masmorra em grupo pedem o personagem inteiro por um
 * tempo — não dá para estar no meio da rota (ou do Abismo) e aceitar outra
 * coisa ao mesmo tempo. `palcoEmCena()` já diz se o personagem está fora da
 * taberna; os três painéis usam o mesmo aviso e o mesmo texto.
 */
export const AVISO_FORA_DA_TABERNA = 'Para aceitar você deve voltar para a taberna.'
export const avisoForaDaTaberna = () =>
  palcoEmCena() ? el('p', { style: 'color:var(--erro)' }, AVISO_FORA_DA_TABERNA) : null

export function linhaDeBarra(sigla, classe, atual, maximo, rotulo) {
  return el(
    'div',
    { class: 'linha-barra' },
    el('div', { class: 'sigla' }, sigla),
    barra(classe, atual, maximo, rotulo),
  )
}

export const linhaDeDado = (rotulo, valor, classeValor = '') =>
  el(
    'div',
    { class: 'linha-dado' },
    el('div', { class: 'rotulo' }, rotulo),
    el('div', { class: `valor ${classeValor}` }, valor),
  )

/** Os bônus de um item em texto curto: "+58 ATQ +12 DEF". */
export function textoDeBonus(item) {
  if (!item?.bonus) return ''
  const nomes = { hp: 'HP', atq: 'ATQ', def: 'DEF', agi: 'AGI' }
  return Object.entries(item.bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `+${num(v)} ${nomes[k] ?? k.toUpperCase()}`)
    .join('  ')
}

/** O nome de um item com raridade, reforço e feitiço — como ele aparece. */
export function nomeDoItem(item) {
  if (!item) return ''
  const pedacos = [item.nome]
  if (item.reforco > 0) pedacos.push(`+${item.reforco}`)
  return pedacos.join(' ')
}

export function etiquetaDeRaridade(item) {
  if (!item) return null
  return el('span', { class: `etiqueta r-${item.raridade}` }, item.raridadeNome)
}

/**
 * A linha padrão de um item nas listas (mochila, loja, forja).
 *
 * `tecla` é o atalho de teclado da linha: o número aparece à esquerda, como o
 * `[1]` do menu de ações, e marca a PRIMEIRA ação — é ela que a tecla dispara
 * (o despacho está em prepararTeclado, no app.js). `0` não numera a linha mas
 * guarda o lugar, para as listas onde só as nove primeiras têm atalho não
 * saírem desalinhadas; `null` não reserva nada.
 */
export function linhaDeItem(
  item,
  { acoes = [], detalhes = [], selecionada = false, onClick, tecla = null } = {},
) {
  const corpo = el(
    'div',
    { class: 'corpo' },
    el(
      'div',
      { class: 'nome' },
      nomeDoItem(item),
      item.feiticoNome
        ? el('span', { class: 'feitico-marca' }, ` ${item.feiticoEmoji} ${item.feiticoNome}`)
        : null,
    ),
    el(
      'div',
      { class: 'detalhe' },
      etiquetaDeRaridade(item),
      item.nivel ? el('span', {}, `nv ${item.nivel}`) : null,
      item.nomeDoSlot ? el('span', {}, item.nomeDoSlot) : null,
      textoDeBonus(item) ? el('span', { class: 'bonus' }, textoDeBonus(item)) : null,
      ...detalhes.map((d) => (d instanceof Node ? d : el('span', {}, d))),
    ),
  )

  if (tecla && acoes.length) acoes[0].dataset.tecla = String(tecla)

  return el(
    'div',
    {
      class: `linha-item${selecionada ? ' selecionada' : ''}`,
      onClick: onClick ?? null,
      style: onClick ? 'cursor:pointer' : null,
    },
    tecla === null ? null : el('span', { class: 'tecla-item' }, tecla ? `[${tecla}]` : ''),
    el('div', { class: 'icone' }, item.emoji ?? '📦'),
    corpo,
    acoes.length ? el('div', { class: 'acoes-item' }, ...acoes) : null,
  )
}

export const vazio = (texto) => el('div', { class: 'vazio-aviso' }, texto)

// --------------------------------------------------------------- modal

let aoFecharModal = null

/**
 * Que painel está na tela, e como redesenhá-lo.
 *
 * Serve para o tempo real: quando alguém entra na sua sala de raid ou manda
 * um desafio, o socket avisa e o painel aberto se refaz sozinho — sem isso a
 * pessoa ficaria olhando uma lista velha.
 */
const painel = { nome: null, recarregar: null }

export function abrirModal(
  titulo,
  conteudo,
  { largura = '', abas = null, aoFechar = null, nome = null, aoRecarregar = null } = {},
) {
  const modal = $('#modal')
  modal.className = `moldura modal ${largura}`
  $('#modal-titulo').textContent = titulo

  const caixaAbas = limpar($('#modal-abas'))
  if (abas) caixaAbas.append(abas)

  limpar($('#modal-corpo')).append(conteudo)
  $('#fundo-modal').classList.add('aberto')
  aoFecharModal = aoFechar
  painel.nome = nome
  painel.recarregar = aoRecarregar
}

export function fecharModal() {
  $('#fundo-modal').classList.remove('aberto')
  aoFecharModal?.()
  aoFecharModal = null
  painel.nome = null
  painel.recarregar = null
}

export const modalAberto = () => $('#fundo-modal').classList.contains('aberto')

/** Redesenha o painel aberto, se for o que o chamador esperava. */
export function recarregarPainel(nome) {
  if (!modalAberto() || painel.nome !== nome || !painel.recarregar) return
  Promise.resolve(painel.recarregar()).catch(() => {
    // Painel que não recarrega não é motivo para quebrar a tela.
  })
}

/** Monta a barra de abas de um modal. */
export function abasDoModal(itens, ativo, aoTrocar) {
  return el(
    'div',
    { class: 'abas-modal' },
    ...itens.map((item) =>
      el(
        'button',
        {
          class: `aba${item.id === ativo ? ' ativa' : ''}`,
          type: 'button',
          onClick: () => aoTrocar(item.id),
        },
        item.nome,
      ),
    ),
  )
}

/** Confirmação em duas etapas para o que não tem desfazer. */
export function confirmar(titulo, texto, aoConfirmar, rotulo = 'Confirmar') {
  const corpo = el(
    'div',
    {},
    el('p', { style: 'margin-top:0' }, texto),
    el(
      'div',
      { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px' },
      el('button', { class: 'btn', type: 'button', onClick: fecharModal }, 'Cancelar'),
      el(
        'button',
        {
          class: 'btn perigo',
          type: 'button',
          onClick: async (ev) => {
            await comBotao(ev.currentTarget, aoConfirmar)
            fecharModal()
          },
        },
        rotulo,
      ),
    ),
  )
  abrirModal(titulo, corpo, { largura: 'estreito' })
}
