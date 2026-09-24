/**
 * O mapa da rota, logo abaixo do palco.
 *
 * Mostra o arco, o ato e as dez fases dele: as vencidas acesas, a atual
 * pulsando, a décima sempre com a caveira do chefe. É só leitura — quem
 * anda na rota é a caçada, e quem decide para onde é o servidor.
 *
 * Tudo que ele desenha vem pronto de `verRota()` (server/rpg/cacada.js), que
 * viaja junto com a ficha em toda resposta. O cliente não conta fase
 * nenhuma.
 */
import { $, el, limpar } from './nucleo.js'

const doisDigitos = (n) => String(n).padStart(2, '0')

/** Redesenha o mapa a partir da rota que veio na ficha. */
export function desenharMapa(rota) {
  const caixa = $('#mapa')
  if (!caixa) return

  if (!rota) {
    caixa.hidden = true
    return
  }

  caixa.hidden = false
  limpar(caixa)

  const total = rota.fasesPorAto
  const travadaAqui = rota.repetindo && rota.travada?.ato === rota.ato ? rota.travada.fase : 0

  const nos = Array.from({ length: total }, (_, i) => {
    const fase = i + 1
    const chefe = fase === total
    const classes = ['mapa-no']
    if (chefe) classes.push('chefe')
    if (fase <= rota.vencidasNoAto) classes.push('feita')
    if (fase === rota.fase) classes.push('atual')
    else if (fase === travadaAqui) classes.push('travada')

    return el(
      'div',
      {
        class: classes.join(' '),
        title: chefe
          ? `Fase ${doisDigitos(fase)} de ${total} — o chefe do ato`
          : `Fase ${doisDigitos(fase)} de ${total}`,
      },
      chefe ? '☠' : String(fase),
    )
  })

  const recorde = rota.recorde
    ? `recorde: ato ${rota.recorde.ato} · fase ${doisDigitos(rota.recorde.fase)}`
    : 'nenhuma fase vencida ainda'

  caixa.append(
    el(
      'div',
      { class: 'mapa-cabeca' },
      el(
        'div',
        { style: 'min-width:0' },
        el('div', { class: 'mapa-arco' }, rota.arco.rotulo),
        el('div', { class: 'mapa-ato', title: rota.nomeDoAto }, `${rota.ato}. ${rota.nomeDoAto}`),
      ),
      el('div', { class: 'mapa-contador' }, `${doisDigitos(rota.fase)}-${doisDigitos(total)}`),
    ),
    el('div', { class: 'mapa-trilha' }, ...nos),
    el(
      'div',
      { class: 'mapa-rodape' },
      el(
        'span',
        {},
        rota.arco.final ? 'O fecho da rota' : `Ato ${rota.noArco} de ${rota.atosNoArco} deste arco`,
      ),
      el('span', { class: 'recorde' }, recorde),
    ),
  )
}

/**
 * O nome do lugar aparecendo na tela: entra, fica um segundo e some.
 *
 * A animação mora no CSS; aqui só se liga e desliga a classe. Tirar e pôr de
 * novo com um `offsetWidth` no meio é o que faz dois atos seguidos tocarem
 * duas vezes em vez de uma — sem isso o navegador não reinicia a animação.
 */
export function anunciarAto(nome, arco) {
  const caixa = $('#anuncio-ato')
  if (!caixa || !nome) return

  limpar(caixa)
  caixa.append(
    arco ? el('div', { class: 'arco' }, arco) : null,
    el('div', { class: 'nome' }, nome),
    el('div', { class: 'risco' }),
  )

  caixa.hidden = false
  caixa.classList.remove('tocando')
  void caixa.offsetWidth
  caixa.classList.add('tocando')

  caixa.addEventListener(
    'animationend',
    () => {
      caixa.classList.remove('tocando')
      caixa.hidden = true
    },
    { once: true },
  )
}
