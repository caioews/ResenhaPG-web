/**
 * A luta final: a arena do Coração do Abismo, quem está nela e o que
 * acontece depois de ele cair.
 *
 * Quem vence a rota até a última fase não luta com o chefe sozinho: é levado
 * para a arena, e todo mundo que chega lá vai para o MESMO lugar — como na
 * taberna, dá para ver quem mais está ali. O chefe é uma raid (rpg/coracao.js)
 * e só cai em grupo de no mínimo `config.rpg.coracao.minJogadores`.
 *
 * Quem está na arena marca "pronto"; quando há o mínimo de prontos, qualquer
 * um deles manda começar e todos os prontos (até o máximo) entram na luta.
 * Os outros ficam olhando: a luta é mostrada a todos na arena, e só quem lutou
 * ganha ou perde alguma coisa.
 *
 * A arena vive só em memória, como as salas de raid: nada é cobrado de
 * ninguém para entrar, e um reinício do servidor só manda todo mundo chamar a
 * caçada de novo (o personagem continua parado na última fase).
 */
import { config } from './config.js'
import * as store from './store.js'
import { classeRaiz } from './rpg/classes.js'
import { criarCoracao, CORACAO } from './rpg/coracao.js'
import { emExpedicao } from './rpg/expedicao.js'
import { prestigiar, prestigioDe } from './rpg/prestigio.js'
import { posicao } from './rpg/cacada.js'
import { ehFaseDoChefeFinal, TOTAL_DE_ATOS, fasesPorAto } from './rpg/rota.js'
import { resolverLutaDeGrupo } from './grupo.js'
import { anunciar, emitirPara } from './realtime.js'
import { registrar } from './missoes.js'
import { verResumo } from './visao.js'

/** personagemId -> { desde, pronto, prontoDesde } */
const arena = new Map()

/** Até quando a luta em curso está sendo contada nas telas (ms). 0 = nenhuma. */
let lutaAte = 0

const emLuta = () => Date.now() < lutaAte

// ------------------------------------------------------------ a arena

const c = () => config.rpg.coracao

/** Quanto falta para este personagem poder lutar de novo, em milissegundos. */
export const esperaDoChefeFinal = (player) =>
  Math.max(0, (player.rpg.fim?.ultimaLuta ?? 0) + c().cooldownMinutos * 60_000 - Date.now())

/** Por que este personagem não pode estar na arena. null = pode. */
export function impedimentoDeArena(player) {
  if (!player.rpg.classe) return 'Esse personagem ainda não escolheu uma classe.'
  if (emExpedicao(player)) return 'Seu personagem está em expedição.'
  if (!ehFaseDoChefeFinal(posicao(player))) return 'Você ainda não chegou ao Coração do Abismo.'
  return null
}

/** A arena como a tela a desenha, do ponto de vista de um personagem. */
export function verArena(player = null) {
  const presentes = [...arena.entries()]
    .map(([id, p]) => ({ id, ...p, player: store.buscarPersonagem(id) }))
    .filter((p) => p.player)
    .sort((a, b) => a.desde - b.desde)

  const prontos = presentes.filter((p) => p.pronto)

  return {
    presentes: presentes.map((p) => ({
      id: p.id,
      nome: p.player.name,
      nivel: p.player.rpg.nivel,
      classe: verResumo(p.player).classe,
      // A classe de origem é o sprite que fica em pé na arena.
      classeBase: p.player.rpg.classe ? classeRaiz(p.player.rpg.classe) : null,
      pronto: p.pronto,
      espera: esperaDoChefeFinal(p.player),
    })),
    prontos: prontos.length,
    minJogadores: c().minJogadores,
    maxJogadores: c().maxJogadores,
    emLuta: emLuta(),
    // Do ponto de vista de quem pergunta.
    eu: player
      ? {
          presente: arena.has(player.id),
          pronto: Boolean(arena.get(player.id)?.pronto),
          espera: esperaDoChefeFinal(player),
          zerou: Boolean(player.rpg.fim?.zerou),
          pendente: Boolean(player.rpg.fim?.pendente),
        }
      : null,
    chefe: { nome: CORACAO.nome, emoji: CORACAO.emoji, descricao: CORACAO.descricao },
  }
}

/** Avisa todo mundo que está na arena de que ela mudou. */
function avisarArena(exceto = null) {
  for (const id of arena.keys()) {
    if (id === exceto) continue
    emitirPara(id, 'final:arena', { arena: verArena(store.buscarPersonagem(id)) })
  }
}

/** Leva o personagem para a arena. Devolve `{ erro }` se ele não puder ir. */
export function entrarNaArena(player) {
  const erro = impedimentoDeArena(player)
  if (erro) return { erro }

  if (!arena.has(player.id)) {
    arena.set(player.id, { desde: Date.now(), pronto: false, prontoDesde: 0 })
    avisarArena()
  }
  return { ok: true }
}

/** Tira o personagem da arena (voltou para a taberna, ou fechou o jogo). */
export function sairDaArena(personagemId) {
  if (!arena.delete(personagemId)) return false
  avisarArena()
  return true
}

/** Marca (ou desmarca) "pronto". Quem está em cooldown não pode marcar. */
export function marcarPronto(player, pronto) {
  const dado = arena.get(player.id)
  if (!dado) return { erro: 'Você não está na arena.' }

  if (pronto) {
    const espera = esperaDoChefeFinal(player)
    if (espera > 0) {
      return { erro: `Você ainda se refaz da última tentativa (${Math.ceil(espera / 60_000)} min).` }
    }
    if (emLuta()) return { erro: 'Há uma luta em curso. Espere ela acabar.' }
  }

  dado.pronto = Boolean(pronto)
  dado.prontoDesde = pronto ? Date.now() : 0
  avisarArena()
  return { ok: true }
}

// -------------------------------------------------------------- a luta

/**
 * Quanto tempo as telas levam para contar esta luta, em milissegundos.
 *
 * É uma conta do RITMO da cena (public/js/palcoFinal.js, `animar`): cada tipo
 * de entrada do log leva um tempo. Estar um pouco longe não faz mal — só decide
 * até quando ninguém começa outra luta por cima —, mas se ficar curta os botões
 * destravam com a animação ainda rolando.
 */
const RITMO_DA_NARRACAO = { ataque: 55, curaGrupo: 160, chefe: 820, area: 1250, laser: 2100, furia: 1500, preso: 520, estado: 130 }

function duracaoDaNarracao(log) {
  const corpo = log.reduce((soma, e) => soma + (RITMO_DA_NARRACAO[e.tipo] ?? 90), 0)
  // A abertura (o chefe acordando) e o fecho (ele caindo, ou o grupo).
  return Math.min(300_000, 5_000 + corpo + 4_500)
}

/**
 * Manda começar. Quem manda tem de estar pronto, e tem de haver o mínimo de
 * prontos. Devolve a luta resolvida — o mesmo que vai por socket para quem
 * está olhando.
 */
export function comecarALuta(player) {
  const eu = arena.get(player.id)
  if (!eu) return { erro: 'Você não está na arena.' }
  if (!eu.pronto) return { erro: 'Marque que você está pronto antes de começar.' }
  if (emLuta()) return { erro: 'Há uma luta em curso. Espere ela acabar.' }

  const prontos = [...arena.entries()]
    .filter(([, p]) => p.pronto)
    .sort((a, b) => a[1].prontoDesde - b[1].prontoDesde)
    .map(([id]) => store.buscarPersonagem(id))
    .filter(Boolean)

  if (prontos.length < c().minJogadores) {
    return {
      erro: `O Coração só cai em grupo: são precisos pelo menos ${c().minJogadores} prontos. Por ora, ${prontos.length}.`,
    }
  }

  // Quem chegou primeiro entra; sobrando gente, ela espera a próxima.
  const participantes = prontos.slice(0, c().maxJogadores)
  const chefe = criarCoracao(participantes.length)

  const luta = resolverLutaDeGrupo(participantes, chefe, {
    recompensa: c().recompensa,
    pesosDoDrop: c().pesosDoDrop,
  })

  const agora = Date.now()
  const primeiraVez = []

  for (const p of participantes) {
    const fim = p.rpg.fim
    fim.ultimaLuta = agora
    registrar(p, 'raid')

    if (luta.venceu) {
      fim.vitorias++
      // O recorde da rota chega ao fim: o mapa mostra a última fase vencida.
      p.rpg.cacada.maiorAto = TOTAL_DE_ATOS
      p.rpg.cacada.maiorFase = fasesPorAto()

      if (!fim.zerou) {
        fim.zerou = true
        fim.pendente = true
        fim.em = agora
        primeiraVez.push(p.id)
      }
    } else {
      fim.derrotas++
    }

    // Terminada a luta, ninguém segue marcado como pronto.
    const dado = arena.get(p.id)
    if (dado) dado.pronto = false
  }

  // A luta é contada nas telas por um tempo, e neste tempo ninguém começa
  // outra por cima. Quando ele passa, a arena é avisada: sem isso os botões
  // de quem estava vendo ficariam travados até alguém mexer em alguma coisa.
  lutaAte = agora + duracaoDaNarracao(luta.log)
  setTimeout(() => avisarArena(), lutaAte - agora + 250)

  store.flush()

  const saida = {
    ...luta,
    // O retrato completo de cada lutador: o palco precisa da classe de origem
    // para saber que sprite botar em pé.
    participantes: luta.participantes.map((r, i) => ({
      ...r,
      classeBase: participantes[i].rpg.classe ? classeRaiz(participantes[i].rpg.classe) : null,
    })),
    primeiraVez,
  }

  // O chat só fala do resultado quando a luta acaba nas telas: um "o Coração
  // caiu!" que chegasse no começo da animação entregaria o final dela.
  const nomes = participantes.map((p) => p.name)
  const aviso = luta.venceu
    ? `⚔️ ${CORACAO.emoji} ${CORACAO.nome} caiu! Derrubado por ${nomes.join(', ')}. A rota chegou ao fim.`
    : `${CORACAO.emoji} ${CORACAO.nome} derrotou o grupo de ${participantes.length} aventureiros.`
  setTimeout(() => anunciar(aviso), Math.max(0, lutaAte - Date.now() - 2000))

  // Todo mundo que está na arena vê a luta; quem lutou recebe a ficha nova.
  for (const id of arena.keys()) emitirPara(id, 'final:luta', { luta: saida })
  avisarArena()

  return { luta: saida }
}

// ----------------------------------------------------- depois do chefe

/**
 * O que o personagem faz depois de derrubar o Coração pela primeira vez:
 *
 *   continuar   fica no último ato, num laço eterno: a rota o deixa repetindo
 *               a última fase antes do chefe, e ele pode voltar a enfrentá-lo
 *               com quem quiser
 *   prestigiar  volta ao nível 1 com um prestígio a mais (rpg/prestigio.js)
 */
export function escolherDepoisDoFim(player, escolha) {
  const fim = player.rpg.fim
  if (!fim?.pendente) return { erro: 'Não há nada a decidir agora.' }
  if (!['continuar', 'prestigiar'].includes(escolha)) return { erro: 'Escolha continuar ou prestigiar.' }
  if (escolha === 'prestigiar' && emExpedicao(player)) return { erro: 'Seu personagem está em expedição.' }

  sairDaArena(player.id)
  fim.pendente = false
  fim.escolha = escolha

  if (escolha === 'prestigiar') {
    prestigiar(player)
    store.save()
    return { escolha, prestigio: prestigioDe(player) }
  }

  // Continuar: de volta a última fase comum do ato final, repetindo. O botão
  // "ir para a próxima fase" leva de novo até o chefe.
  const c = player.rpg.cacada
  const ultima = fasesPorAto() - 1
  c.ato = TOTAL_DE_ATOS
  c.fase = ultima
  c.repetindo = true
  c.travada = { ato: TOTAL_DE_ATOS, fase: fasesPorAto() }
  store.save()
  return { escolha }
}
