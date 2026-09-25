/**
 * A luta final, do lado do navegador: a arena, o "pronto", a luta contada e
 * o fim do jogo.
 *
 * Quem decide tudo é o servidor (server/final.js). Aqui a arena é uma lista
 * de quem chegou, um menu de ações e um palco desenhado — e a luta chega
 * pronta, com o log inteiro, para ser animada.
 *
 * A luta é mostrada a todos que estão na arena, lutando ou não. Só quem
 * lutou ganha (ou perde) alguma coisa, e só quem derrubou o chefe pela
 * primeira vez vê o fim.
 */
import { el, estado, limpar, mandar, pegar, avisar, avisarBom, avisarErro, duracao } from './nucleo.js'
import { definirCena, escrever, esperarNarracao, limparNarrativa, sussurro, tituloDeCena } from './narrativa.js'
import { narrarRaidCompleta } from './paineis.js'
import {
  animar,
  arenaDisponivel,
  atualizarPresentes,
  comecarLuta,
  definirInfo,
  irParaAArena,
  terminarLuta,
  voltarAoRepouso,
} from './palcoFinal.js'
import { encerrar, fimNaTela, pedirEscolha, tocarFim } from './fim.js'

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const st = {
  arena: null,
  naArena: false,
  /** Uma luta está sendo contada nesta aba (a minha ou a que estou vendo). */
  emLuta: false,
  fimEmCurso: false,
  /** Lutas de outros que chegaram enquanto esta aba ainda contava uma. */
  fila: [],
  ganchos: {},
}

/** Se o personagem está, agora, na arena do chefe final. */
export const naArenaFinal = () => st.naArena

/**
 * Liga a arena ao resto do jogo. Quem sabe atualizar a ficha, redesenhar o
 * menu e trocar de cena é o app.js; a arena só chama:
 *
 *   atualizarFicha     pede a ficha nova ao servidor
 *   redesenharMenu     o menu de ações mudou
 *   voltarParaTaberna  sai de cena para a taberna
 *   continuarCacando   religa o laço da caçada (depois de "continuar")
 */
export function configurarFinal(ganchos) {
  st.ganchos = ganchos
}

// ---------------------------------------------------------------- a arena

const INTRODUCAO = [
  'A trilha acaba aqui. Não há mais para onde caminhar: só um céu partido, ilhas mortas à deriva e, no meio delas, ' +
    'uma arena de pedra rachada sustentando o que resta do mundo. Sob a arena, algo colossal dorme — e bate.',
  'Todos os que chegam a este ponto vêm para o mesmo lugar. Combinem, marquem que estão prontos e, quando houver ' +
    'gente bastante, comecem. O Coração do Abismo só cai em grupo.',
]

/**
 * Chegou ao último degrau da rota: o personagem é levado para a arena.
 * `arena` é o que o servidor devolveu ao aceitar a entrada.
 */
export async function irAoChefeFinal(arena) {
  st.arena = arena
  st.naArena = true

  limparNarrativa()
  definirCena('Coração do Abismo Demoníaco')
  tituloDeCena('🫀 O Coração do Abismo')
  for (const p of INTRODUCAO) sussurro(p)
  sussurro(
    `São precisos pelo menos ${arena.minJogadores} aventureiros prontos (no máximo ${arena.maxJogadores}). ` +
      'Ele foi feito para um grupo de nível 300 com equipamento lendário — e mesmo assim vai ser sofrido.',
  )
  escrever(el('div', { id: 'arena-lobby', class: 'lobby-final' }))
  desenharLobby()

  try {
    await irParaAArena(arena.presentes, estado.p.id)
    sincronizarPalco()
  } catch (e) {
    // Sem arte a arena continua inteira, só que em texto.
    console.warn('arena:', e)
  }
  st.ganchos.redesenharMenu?.()
}

/** Quem está na arena, em texto: o que a tela lateral mostra. */
function desenharLobby() {
  const caixa = document.getElementById('arena-lobby')
  if (!caixa || !st.arena) return
  const a = st.arena
  limpar(caixa)

  caixa.append(el('div', { class: 'rotulo-secao' }, `Na arena (${a.presentes.length})`))
  if (!a.presentes.length) caixa.append(el('div', { class: 'sussurro' }, 'Ninguém por aqui.'))

  for (const p of a.presentes) {
    caixa.append(
      el(
        'div',
        { class: `lobby-linha${p.id === estado.p?.id ? ' eu' : ''}` },
        el('span', { class: 'nome' }, `${p.classe?.emoji ?? '⚔️'} ${p.nome}`),
        el('span', { class: 'nv' }, `nv ${p.nivel}`),
        p.pronto ? el('span', { class: 'pronto' }, '✓ pronto') : el('span', { class: 'sussurro' }, 'a caminho'),
      ),
    )
  }

  const falta = Math.max(0, a.minJogadores - a.prontos)
  caixa.append(
    el(
      'div',
      { class: `lobby-contagem${falta ? '' : ' completo'}` },
      falta
        ? `${a.prontos} de ${a.minJogadores} prontos — faltam ${falta}.`
        : `${a.prontos} prontos. Dá para começar.`,
    ),
  )
  if (a.eu?.espera > 0) {
    caixa.append(el('div', { class: 'lobby-aviso' }, `Você ainda se refaz da última tentativa: ${duracao(a.eu.espera)}.`))
  }
}

/** Leva ao palco o que o servidor diz da arena. */
function sincronizarPalco() {
  const a = st.arena
  if (!a) return
  atualizarPresentes(a.presentes, estado.p?.id)
  const falta = Math.max(0, a.minJogadores - a.prontos)
  definirInfo(falta ? `prontos: ${a.prontos} de ${a.minJogadores}` : 'o Coração espera — podem começar')
}

/** O servidor avisa: alguém entrou, saiu ou marcou "pronto". */
function arenaMudou(arena) {
  st.arena = arena
  if (!st.naArena) return
  sincronizarPalco()
  if (!st.emLuta) desenharLobby()
  st.ganchos.redesenharMenu?.()
}

async function recarregarArena() {
  const r = await pegar('/api/final')
  arenaMudou(r.arena)
}

// ------------------------------------------------------------------ ações

/** O que o menu de ações mostra enquanto o personagem está na arena. */
export function acoesDaArena() {
  const a = st.arena
  const eu = a?.eu
  const pronto = Boolean(eu?.pronto)
  const ocupado = st.emLuta || Boolean(a?.emLuta)
  const espera = eu?.espera ?? 0
  const prontos = a?.prontos ?? 0
  const minimo = a?.minJogadores ?? 5

  return [
    {
      rotulo: pronto ? 'Não estou pronto' : 'Estou pronto',
      nota: espera > 0 && !pronto ? `se refazendo: ${duracao(espera)}` : `${prontos} de ${minimo} prontos`,
      desabilitado: ocupado || (!pronto && espera > 0),
      acao: alternarPronto,
    },
    {
      rotulo: 'Enfrentar o Coração do Abismo',
      nota: !pronto ? 'marque que está pronto' : prontos < minimo ? `faltam ${minimo - prontos}` : 'começa agora, com todos os prontos',
      desabilitado: ocupado || !pronto || prontos < minimo,
      acao: comecar,
    },
    {
      rotulo: 'Voltar para a taberna',
      nota: 'sair da arena',
      desabilitado: ocupado,
      acao: sairParaATaberna,
    },
  ]
}

async function alternarPronto() {
  const r = await mandar('/api/final/pronto', { pronto: !st.arena?.eu?.pronto })
  arenaMudou(r.arena)
}

async function comecar() {
  st.emLuta = true
  st.ganchos.redesenharMenu?.()
  try {
    const r = await mandar('/api/final/lutar')
    await narrarFinal(r.luta)
  } finally {
    st.emLuta = false
    st.ganchos.redesenharMenu?.()
  }
}

async function sairParaATaberna() {
  try {
    await mandar('/api/final/sair')
  } catch (e) {
    console.warn('arena:', e)
  }
  st.naArena = false
  st.arena = null
  st.fila = []
  await st.ganchos.voltarParaTaberna?.()
}

// ------------------------------------------------------------ a luta

/**
 * Conta a luta: o log vira texto e cena ao mesmo tempo. Se foi a primeira vez
 * do personagem, termina no fim do jogo.
 */
async function narrarFinal(luta) {
  const eu = estado.p
  const lutei = luta.participantes.some((p) => p.id === eu?.id)
  const primeiraVez = Boolean(luta.venceu && lutei && luta.primeiraVez?.includes(eu?.id))

  comecarLuta({
    participantes: luta.participantes.map((p) => ({ nome: p.nome, hpMax: p.hpMax })),
    hpMaxDoChefe: luta.chefe.hpMax,
  })

  await narrarRaidCompleta(luta, {
    cena: 'Coração do Abismo Demoníaco',
    abertura: lutei ? null : 'Você assiste da borda da arena: outros aventureiros o enfrentam.',
    aoEntrada: animar,
  })

  terminarLuta({ venceu: luta.venceu })
  await dormir(luta.venceu ? 3600 : 2400)

  if (primeiraVez) {
    await conduzirOFim()
    return
  }

  voltarAoRepouso()
  escrever(el('div', { id: 'arena-lobby', class: 'lobby-final' }))
  try {
    await recarregarArena()
  } catch (e) {
    console.warn('arena:', e)
  }
  desenharLobby()
  if (luta.venceu) sussurro('O Coração já caiu por aqui uma vez, mas a arena continua de pé. Ele acorda de novo para quem o chamar.')
}

/**
 * O servidor avisa que uma luta começou na arena: quem não iniciou também a
 * vê. Se esta aba ainda está contando uma luta (a aba escondida anda devagar),
 * a nova espera a vez em vez de se perder.
 */
async function lutaAlheia(luta) {
  if (!st.naArena) return
  if (st.emLuta) {
    st.fila.push(luta)
    return
  }
  st.emLuta = true
  st.ganchos.redesenharMenu?.()
  try {
    await st.ganchos.atualizarFicha?.()
    await esperarNarracao()
    await narrarFinal(luta)
  } catch (e) {
    avisarErro(e)
  } finally {
    st.emLuta = false
    st.ganchos.redesenharMenu?.()
    const proxima = st.fila.shift()
    if (proxima) lutaAlheia(proxima)
  }
}

// ------------------------------------------------------------- o fim

/**
 * O fim inteiro, e depois o que a pessoa escolher. O jogo por baixo troca de
 * cena enquanto a tela está preta, para o pop-up não mostrar a arena
 * desmontando.
 */
async function conduzirOFim() {
  st.fimEmCurso = true
  const escolha = await tocarFim({ prestigio: estado.p?.prestigio?.proximo ?? null })
  await concluirEscolha(escolha)
}

/** Manda a escolha ao servidor; se falhar, mostra o pop-up de novo. */
async function concluirEscolha(escolhaInicial) {
  const prestigio = estado.p?.prestigio?.proximo ?? null
  let escolha = escolhaInicial
  let feito = null

  while (!feito) {
    try {
      feito = await mandar('/api/final/escolha', { escolha })
    } catch (e) {
      avisarErro(e)
      escolha = await pedirEscolha({ prestigio })
    }
  }

  st.naArena = false
  st.arena = null
  st.fila = []

  if (escolha === 'prestigiar') {
    await st.ganchos.voltarParaTaberna?.()
    await encerrar()
    avisarBom(`Prestígio ${feito.prestigio ?? ''}: você recomeça do nível 1, mais forte a cada passo.`)
  } else {
    // Continuar: a caçada volta a rodar, e o laço eterno do último ato começa.
    st.ganchos.continuarCacando?.()
    await dormir(1400)
    await encerrar()
    avisar('Você fica no último ato. A rota não acaba: quando quiser enfrentar o Coração de novo, mande seguir em frente.')
  }

  st.fimEmCurso = false
}

/**
 * Se a ficha diz que falta escolher o que vem depois do fim (a pessoa fechou
 * a página no meio dos créditos), o pop-up volta — sem repetir o resto.
 */
export function verificarPendencia(p) {
  if (!p?.fim?.pendente || st.fimEmCurso || st.emLuta || fimNaTela()) return
  st.fimEmCurso = true
  setTimeout(async () => {
    try {
      const escolha = await pedirEscolha({ prestigio: p.prestigio?.proximo ?? null })
      await concluirEscolha(escolha)
    } catch (e) {
      st.fimEmCurso = false
      avisarErro(e)
    }
  }, 900)
}

// ---------------------------------------------------------- tempo real

/** Liga os avisos do servidor sobre a arena ao socket do jogo. */
export function ouvirFinal(socket) {
  socket.on('final:arena', ({ arena }) => arenaMudou(arena))
  socket.on('final:luta', ({ luta }) => lutaAlheia(luta))
}

/** Se a arte da arena existe (senão a luta é só em texto). */
export { arenaDisponivel }
