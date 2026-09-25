/**
 * O fim do jogo: o que acontece na tela depois que o Coração do Abismo cai.
 *
 *   1. a tela vai para o branco
 *   2. do branco para o preto
 *   3. aparece FIM
 *   4. a mensagem de congratulações
 *   5. os créditos
 *   6. um pop-up com duas saídas: continuar no último ato, ou prestigiar
 *
 * É só apresentação: quem decide se o personagem zerou o jogo é o servidor
 * (server/final.js), que marca `fim.pendente` na ficha ao derrubar o chefe. Se
 * a pessoa fechar a página no meio dos créditos, a escolha continua esperando
 * — e volta como pop-up, sem repetir o resto (`pedirEscolha`).
 *
 * O tempo aqui é de relógio, não de quadro, e nada bloqueia: um botão "Pular"
 * leva direto ao pop-up.
 */
import { el } from './nucleo.js'

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/** A mensagem, parágrafo a parágrafo. Cada um aparece sozinho, um depois do outro. */
const MENSAGEM = [
  'Parabéns, aventureiro.',
  'Você atravessou cinco arcos, cinquenta e um atos e quinhentas e dez fases — cada uma mais dura que a anterior. ' +
    'Caiu, recuou, voltou mais forte, e se recusou a aceitar que o Abismo tivesse a última palavra.',
  'O Coração do Abismo Demoníaco parou de bater. O céu partido se cala, as ilhas ao longe se aquietam e, ' +
    'pela primeira vez em eras, não há nada respirando sob a pedra.',
  'A jornada foi longa e dura, e só terminou porque você — e quem lutou ao seu lado — não desistiu.',
  'Obrigado por jogar.',
]

/** Os créditos, na ordem em que sobem pela tela. */
const CREDITOS = [
  { titulo: 'Resenha RPG' },
  { rotulo: 'Feito por' },
  { nome: 'Grupo Resenha RPG IRL' },
  { nome: 'Claude' },
  { nome: 'Caio Henrique' },
]

/** A camada que cobre o jogo inteiro. Criada uma vez e reaproveitada. */
function camada() {
  let fim = document.getElementById('fim')
  if (fim) return fim

  fim = el(
    'div',
    { id: 'fim', class: 'fim', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Fim de jogo' },
    el('div', { class: 'fim-branco' }),
    el('div', { class: 'fim-palco' }),
    el('button', { class: 'fim-pular', type: 'button' }, 'Pular ›'),
  )
  document.body.append(fim)
  return fim
}

const palcoDe = (fim) => fim.querySelector('.fim-palco')

/** Faz o elemento aparecer (classe `visivel`) e espera a transição acabar. */
async function aparecer(node, ms = 1800) {
  node.style.transitionDuration = `${ms}ms`
  // O quadro seguinte: sem ele o navegador junta o "antes" e o "depois" e a
  // transição nem começa.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  node.classList.add('visivel')
  await dormir(ms)
}

async function sumir(node, ms = 1200) {
  node.style.transitionDuration = `${ms}ms`
  node.classList.remove('visivel')
  await dormir(ms)
}

/** Esmaece um elemento que já está visível por padrão (o palco dos créditos). */
async function esmaecer(node, ms) {
  node.style.transition = `opacity ${ms}ms ease`
  node.style.opacity = '0'
  await dormir(ms)
}

/** Tira do elemento o que `esmaecer` deixou. */
function reaparecer(node) {
  node.style.transition = 'none'
  node.style.opacity = ''
}

// ------------------------------------------------------------ o pop-up

/**
 * As duas saídas. Devolve `'continuar'` ou `'prestigiar'`. Não fecha por
 * fora: a escolha é obrigatória.
 *
 * `prestigio` é o que o próximo prestígio daria ({ bonusAtributos, bonusXp }),
 * para o texto dizer o que se ganha em vez de só "recomeçar".
 */
function escolher(fim, { prestigio = null } = {}) {
  const palco = palcoDe(fim)
  fim.classList.add('escolhendo')

  return new Promise((resolve) => {
    const ganho = prestigio
      ? ` Cada prestígio soma +${Math.round(prestigio.bonusAtributos * 100)}% aos atributos de classe e ` +
        `+${Math.round(prestigio.bonusXp * 100)}% ao XP ganho — para sempre.`
      : ''

    const opcao = (escolha, titulo, texto, classe = '') =>
      el(
        'button',
        {
          class: `fim-opcao ${classe}`,
          type: 'button',
          onClick: (ev) => {
            for (const b of caixa.querySelectorAll('button')) b.disabled = true
            ev.currentTarget.classList.add('escolhida')
            resolve(escolha)
          },
        },
        el('span', { class: 'fim-opcao-titulo' }, titulo),
        el('span', { class: 'fim-opcao-texto' }, texto),
      )

    const caixa = el(
      'div',
      { class: 'fim-escolha' },
      el('div', { class: 'fim-escolha-titulo' }, 'E agora?'),
      el('p', { class: 'fim-escolha-intro' }, 'A rota acabou. O que fica para o seu personagem?'),
      opcao(
        'continuar',
        'Continuar',
        'Ficar com o personagem no último ato, caçando num laço sem fim. ' +
          'O Coração do Abismo continua lá para quem quiser enfrentá-lo de novo.',
      ),
      opcao(
        'prestigiar',
        'Prestigiar',
        `Voltar ao nível 1 com um prestígio a mais. Itens, gold e o recorde da rota ficam com você.${ganho}`,
        'raro',
      ),
    )

    palco.replaceChildren(caixa)
    requestAnimationFrame(() => requestAnimationFrame(() => caixa.classList.add('visivel')))
  })
}

// ------------------------------------------------------------ a sequência

/**
 * Toca o fim inteiro e devolve a escolha da pessoa. A camada fica na tela: quem
 * chamou decide quando tirá-la (`encerrar`), depois de cuidar do que a escolha
 * pede.
 */
export async function tocarFim({ prestigio = null } = {}) {
  const fim = camada()
  const palco = palcoDe(fim)
  const branco = fim.querySelector('.fim-branco')
  const pular = fim.querySelector('.fim-pular')

  palco.replaceChildren()
  fim.className = 'fim'
  fim.hidden = false
  branco.classList.remove('visivel')

  let pulou = false
  const parar = () => {
    pulou = true
  }
  pular.onclick = parar
  pular.classList.remove('visivel')
  const teclas = (ev) => {
    if (ev.key === 'Escape' || ev.key === ' ') {
      ev.preventDefault()
      parar()
    }
  }
  window.addEventListener('keydown', teclas)

  /** Espera; ou não espera nada, se a pessoa pulou. */
  const esperar = (ms) => (pulou ? Promise.resolve() : dormir(ms))

  try {
    // O botão de pular aparece depois de um respiro — a primeira vez ninguém
    // quer pular.
    setTimeout(() => pular.classList.add('visivel'), 6000)

    // 1 e 2: branco, depois preto.
    await aparecer(branco, 2600)
    fim.classList.add('preto')
    await sumir(branco, 2200)

    if (!pulou) {
      // 3: FIM.
      const titulo = el('div', { class: 'fim-titulo' }, 'FIM')
      palco.append(titulo)
      await aparecer(titulo, 2200)
      await esperar(1800)

      // 4: a mensagem, um parágrafo por vez, embaixo do FIM.
      if (!pulou) {
        titulo.classList.add('recuado')
        const texto = el('div', { class: 'fim-mensagem' })
        palco.append(texto)
        for (const [i, paragrafo] of MENSAGEM.entries()) {
          if (pulou) break
          // O primeiro e o último têm estilo próprio, marcado à mão: `:last-child`
          // pegaria cada parágrafo enquanto ele ainda é o último a entrar.
          const p = el('p', { class: i === 0 ? 'abertura' : i === MENSAGEM.length - 1 ? 'despedida' : '' }, paragrafo)
          texto.append(p)
          await aparecer(p, 1500)
          await esperar(Math.min(6500, 1800 + paragrafo.length * 32))
        }
        await esperar(2500)
        if (!pulou) await esmaecer(palco, 1400)
      }

      // 5: os créditos, subindo.
      if (!pulou) {
        palco.replaceChildren()
        reaparecer(palco)
        const trilha = el(
          'div',
          { class: 'fim-creditos' },
          ...CREDITOS.map((c) =>
            c.titulo
              ? el('div', { class: 'fim-creditos-titulo' }, c.titulo)
              : c.rotulo
                ? el('div', { class: 'fim-creditos-rotulo' }, c.rotulo)
                : el('div', { class: 'fim-creditos-nome' }, c.nome),
          ),
        )
        palco.append(trilha)
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        trilha.classList.add('subindo')

        // Sai quando a animação de CSS acaba — ou quando a pessoa pula.
        await Promise.race([
          new Promise((r) => trilha.addEventListener('animationend', r, { once: true })),
          new Promise((r) => {
            const vigia = setInterval(() => {
              if (pulou) {
                clearInterval(vigia)
                r()
              }
            }, 120)
          }),
        ])
      }
    }
  } finally {
    window.removeEventListener('keydown', teclas)
    pular.onclick = null
    pular.classList.remove('visivel')
  }

  // 6: a escolha.
  reaparecer(palco)
  fim.classList.add('preto')
  return escolher(fim, { prestigio })
}

/**
 * Só o pop-up, sobre o preto: para quem fechou a página antes de escolher. Os
 * créditos já passaram uma vez e não passam de novo.
 */
export function pedirEscolha({ prestigio = null } = {}) {
  const fim = camada()
  palcoDe(fim).replaceChildren()
  fim.className = 'fim preto'
  fim.hidden = false
  fim.querySelector('.fim-branco').classList.remove('visivel')
  return escolher(fim, { prestigio })
}

/** Tira a camada de cima do jogo, com uma última esmaecida. */
export async function encerrar() {
  const fim = document.getElementById('fim')
  if (!fim || fim.hidden) return
  fim.classList.add('saindo')
  await dormir(900)
  fim.hidden = true
  fim.className = 'fim'
  palcoDe(fim).replaceChildren()
}

/** Se a sequência do fim está na tela. */
export const fimNaTela = () => {
  const fim = document.getElementById('fim')
  return Boolean(fim && !fim.hidden)
}
