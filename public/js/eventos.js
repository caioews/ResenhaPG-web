/**
 * Os eventos aleatórios do lado da tela: o pop-up da chamada, o botão que
 * fica no menu enquanto ela está aberta e a narração do resultado.
 *
 * Quem decide tudo é o servidor (server/eventos.js). Aqui só se mostra o que
 * ele mandou e se leva o "vou" ou o "não vou" de volta.
 */
import { $, avisar, avisarBom, comBotao, duracao, el, estado, limpar, mandar, pegar } from './nucleo.js'
import { definirCena, esperarNarracao, forte, limparNarrativa, rico, sussurro, tituloDeCena } from './narrativa.js'
import { narrarRaidCompleta } from './paineis.js'
import { tocar } from './som.js'

/** O evento com a chamada aberta, como o servidor descreveu. */
let atual = null
let relogio = null

/** O que o app.js empresta: sem isso este arquivo teria de importá-lo. */
const ganchos = {
  mostrarEncontro: async () => {},
  atualizarFicha: async () => {},
}

export const configurarEventos = (g) => Object.assign(ganchos, g)

const NOME_DO_TIPO = {
  grupo: 'Luta em grupo',
  individual: 'Luta individual',
  bencao: 'Sem luta',
}

const estouNaLista = () => Boolean(atual && estado.p && atual.participantes.some((x) => x.id === estado.p.id))

const popupAberto = () => !$('#fundo-evento').hidden

// ------------------------------------------------------------- estado

function definirEvento(evento) {
  atual = evento
  desenharIndicador()
  if (popupAberto()) {
    if (atual) desenharPopup()
    else fecharPopup()
  }

  clearInterval(relogio)
  relogio = atual ? setInterval(atualizarRelogios, 1000) : null
}

/** Ao entrar no jogo: se tem chamada aberta, a pessoa fica sabendo na hora. */
export async function buscarEvento() {
  try {
    const r = await pegar('/api/eventos')
    definirEvento(r.evento)
    if (atual && !estouNaLista()) abrirPopup()
  } catch {
    // Sem evento é o normal; um erro de rede aqui não precisa de aviso.
  }
}

// ------------------------------------------------------------ socket

export function ouvirEventos(socket) {
  socket.on('evento:novo', ({ evento }) => {
    tocar('evento')
    definirEvento(evento)
    abrirPopup()
  })

  socket.on('evento:atualizou', ({ evento }) => definirEvento(evento))

  socket.on('evento:encerrado', ({ texto, participantes }) => {
    const participei = estado.p && participantes.includes(estado.p.id)
    definirEvento(null)
    // Quem participou recebe o resultado inteiro logo em seguida; o resto
    // fica sabendo por aqui.
    if (!participei) avisar(texto)
  })

  socket.on('evento:resultado', async (resultado) => {
    tocar(resultado.raid || resultado.encontro ? 'raid' : 'evento')
    await ganchos.atualizarFicha()
    await esperarNarracao()
    await narrarResultado(resultado)
  })
}

// ------------------------------------------------------------- pop-up

export function abrirPopup() {
  if (!atual) return
  desenharPopup()
  $('#fundo-evento').hidden = false
}

export function fecharPopup() {
  $('#fundo-evento').hidden = true
}

export const eventoNaTela = popupAberto

function desenharPopup() {
  const corpo = limpar($('#evento-corpo'))
  if (!atual) return

  const eu = estouNaLista()
  const nomes = atual.participantes.map((x) => `${x.classe?.emoji ?? ''} ${x.nome}`.trim())
  const teto = atual.maxParticipantes ? ` de ${atual.maxParticipantes}` : ''

  const botoes = eu
    ? [
        el(
          'button',
          {
            class: 'btn',
            type: 'button',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                const r = await mandar('/api/eventos/desistir')
                definirEvento(r.evento)
                avisar('Você saiu da lista.')
              }),
          },
          'Desistir',
        ),
        el('button', { class: 'btn primario', type: 'button', onClick: fecharPopup }, 'Fechar'),
      ]
    : [
        el(
          'button',
          {
            class: 'btn primario',
            type: 'button',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                const r = await mandar('/api/eventos/participar')
                definirEvento(r.evento)
                fecharPopup()
                avisarBom(`Você atendeu ao chamado. ${atual?.tipo === 'bencao' ? 'O presente chega' : 'A luta começa'} quando a chamada fechar.`)
              }),
          },
          'Participar',
        ),
        el('button', { class: 'btn', type: 'button', onClick: fecharPopup }, 'Agora não'),
      ]

  corpo.append(
    el('div', { class: 'evento-emoji' }, atual.emoji),
    el('h3', { id: 'evento-chamada' }, atual.chamada),
    el(
      'div',
      { class: 'evento-etiquetas' },
      el('span', { class: 'etiqueta' }, NOME_DO_TIPO[atual.tipo] ?? atual.tipo),
      atual.dificuldade
        ? el('span', { class: `etiqueta dificuldade-${atual.dificuldade === 'raid' ? 'raid' : 'normal'}` }, atual.dificuldade)
        : null,
    ),
    el('p', { class: 'evento-descricao' }, atual.descricao),
    el('p', { class: 'evento-regras' }, atual.regras),
    el(
      'div',
      { class: 'evento-lista' },
      el('span', { class: 'rotulo-secao' }, `Atenderam · ${atual.participantes.length}${teto}`),
      el('div', {}, nomes.length ? nomes.join(' · ') : 'Ninguém ainda.'),
    ),
    el(
      'div',
      { class: 'evento-fecha' },
      'A chamada fecha em ',
      el('span', { class: 'destaque', dataset: { relogioEvento: '1' } }, duracao(atual.fechaEm - Date.now())),
    ),
    // `append` escreveria "null" na tela; el() é quem sabe pular o vazio.
    eu ? el('p', { class: 'evento-dentro' }, '✔ Você está na lista.') : '',
    el('div', { class: 'botoes' }, ...botoes),
  )
}

// -------------------------------------------------- botão do menu

let indicador = null

/** O botão que fica no menu enquanto a chamada está aberta. */
export function criarIndicador() {
  indicador = el(
    'button',
    { class: 'lugar lugar-evento', type: 'button', hidden: true, onClick: abrirPopup },
    el('span', { class: 'icone' }, '🔔'),
    el('span', { class: 'rotulo-evento' }, ''),
    el('span', { class: 'selo', dataset: { relogioEvento: '1' } }, ''),
  )
  desenharIndicador()
  return indicador
}

function desenharIndicador() {
  if (!indicador) return
  indicador.hidden = !atual
  if (!atual) return
  // A coluna do menu é estreita: "inscrito" vira o ícone, não texto cortado.
  indicador.querySelector('.icone').textContent = estouNaLista() ? '✅' : '🔔'
  indicador.title = estouNaLista() ? 'Você está na lista deste evento' : 'Evento aberto: clique para ver'
  indicador.querySelector('.rotulo-evento').textContent = `${atual.emoji} ${atual.nome}`
  atualizarRelogios()
}

function atualizarRelogios() {
  if (!atual) return
  const falta = atual.fechaEm - Date.now()
  for (const node of document.querySelectorAll('[data-relogio-evento]')) {
    node.textContent = falta > 0 ? duracao(falta) : 'agora'
  }
}

// ---------------------------------------------------------- resultado

async function narrarResultado({ evento, ausentes = [], raid, encontro, bonus, bencao }) {
  // No celular a aventura pode estar fora da tela (a pessoa rolou até o
  // menu): o resultado chegou sem ela pedir, então a tela vai até ele.
  const aventura = $('#painel-aventura')
  const caixa = aventura.getBoundingClientRect()
  if (caixa.bottom < 0 || caixa.top > window.innerHeight) aventura.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (raid) {
    await narrarRaidCompleta(raid, { cena: 'Evento', abertura: forte(evento.chamada) })
  } else if (encontro) {
    definirCena('Evento')
    await ganchos.mostrarEncontro(encontro, false)
    if (bonus?.xp || bonus?.gold) {
      rico(
        `${evento.emoji} A ${evento.nome.toLowerCase()} paga o dobro: +`,
        forte(bonus.xp.toLocaleString('pt-BR')),
        ' de XP e +',
        forte(bonus.gold.toLocaleString('pt-BR')),
        ' de gold a mais, já somados acima.',
      )
    }
  } else if (bencao) {
    limparNarrativa()
    definirCena('Evento')
    tituloDeCena(`${evento.emoji} ${evento.nome}`)
    rico(forte(evento.chamada))
    sussurro(evento.descricao)
    rico('Você saiu com: ', forte(bencao.ganhos.join(', ')), '.')
  }

  if (ausentes.length) sussurro(`Atenderam mas não puderam ir: ${ausentes.join(', ')}.`)
}
