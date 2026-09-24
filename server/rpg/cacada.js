/**
 * A caçada: uma fase da rota, do comeco ao fim, resolvida de uma vez.
 *
 * O jogador clica em "Ir à caçada" e o personagem nao para mais: entra na
 * fase, enfrenta a horda um inimigo atras do outro sem respirar e so sai de
 * la vencedor ou caido. Vencer leva a fase seguinte com a vida cheia; perder
 * devolve o personagem a fase anterior, tambem com a vida cheia, e desliga o
 * avanco automatico — dali ele repete o que consegue vencer ate o jogador
 * mandar tentar de novo.
 *
 * Toda a fase e resolvida numa chamada so, como a descida do Abismo. O
 * navegador recebe o log inteiro e anima em cima dele: o resultado ja veio
 * decidido daqui, e nao ha estado pendurado esperando o proximo clique.
 *
 * O que fica guardado na ficha e so a posicao na rota:
 *   { ato, fase, repetindo, travada, maiorAto, maiorFase }
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { lutar } from './combate.js'
import { comoInimigo, comoLutador, premiar } from './encontro.js'
import { atributos } from './jogador.js'
import {
  ARCOS,
  arcoDoAto,
  ato,
  comparar,
  ehOFim,
  faseAnterior,
  faseValida,
  indiceDaFase,
  montarFase,
  nomeDoArco,
  proximaFase,
} from './rota.js'

/** O comeco de todo mundo: ato 1, fase 1. */
export const INICIO = { ato: 1, fase: 1 }

/**
 * Onde o personagem esta na rota. Se a ficha vier torta (banco antigo,
 * config com menos fases por ato), volta ao comeco em vez de explodir.
 */
export function posicao(player) {
  const c = player.rpg.cacada ?? {}
  const onde = { ato: c.ato, fase: c.fase }
  return faseValida(onde) ? onde : { ...INICIO }
}

/** O recorde: a fase mais adiantada que este personagem ja venceu. */
export function recorde(player) {
  const c = player.rpg.cacada ?? {}
  const onde = { ato: c.maiorAto, fase: c.maiorFase }
  return faseValida(onde) ? onde : null
}

/** Quanto falta da trava de ritmo entre duas fases, em milissegundos. */
export const esperaDaCacada = (player) =>
  Math.max(
    0,
    (player.rpg.cacada?.ultimaFaseEm ?? 0) + config.rpg.cacada.esperaEntreFasesSegundos * 1000 - Date.now(),
  )

/** Se o personagem esta parado numa fase, esperando o jogador mandar seguir. */
export const estaRepetindo = (player) => Boolean(player.rpg.cacada?.repetindo)

/**
 * "Ir para a próxima fase": religa o avanco automatico e manda o personagem
 * encarar de novo a fase em que ele empacou.
 *
 * A fase travada e guardada no momento da derrota justamente para isto: na
 * fase 1 do ato 1 nao ha para onde recuar, e sem ela o botao empurraria o
 * personagem para a fase 2 sem ele ter vencido a 1.
 */
export function avancar(player) {
  const c = player.rpg.cacada
  if (!c.repetindo) return { erro: 'Você já está avançando na rota.' }

  const alvo = faseValida(c.travada) ? c.travada : proximaFase(posicao(player))
  c.ato = alvo.ato
  c.fase = alvo.fase
  c.repetindo = false
  store.save()

  return { fase: { ato: c.ato, fase: c.fase } }
}

// --------------------------------------------------------- resolver a fase

/**
 * Enfrenta a fase em que o personagem esta.
 *
 * A vida entra cheia e NAO volta entre um inimigo e outro da mesma horda
 * (config.rpg.cacada.curaEntreInimigos abre uma fresta, se alguem quiser):
 * e o desgaste acumulado que transforma tres lutas soltas numa prova.
 */
export function enfrentar(player, sorte = Math.random) {
  const c = player.rpg.cacada
  const onde = posicao(player)
  const fase = montarFase(onde.ato, onde.fase, sorte)

  const lutas = []
  const total = { xp: 0, gold: 0, itens: [], subiuPara: [], titanitas: [], feiticos: [], perdidos: 0 }
  let hp = atributos(player).hp
  let venceu = true

  for (const inimigo of fase.inimigos) {
    const hpMax = atributos(player).hp
    const hpInicial = Math.min(hp, hpMax)
    const luta = lutar(comoLutador(player, 'Você', hpInicial), comoInimigo(inimigo), sorte)
    const ganhou = luta.vencedor === 'a'

    const registro = {
      inimigo,
      hpInicial,
      hpMax: luta.hpMaxA,
      venceu: ganhou,
      rodadas: luta.rodadas,
      porDecisao: luta.porDecisao,
      log: luta.log,
      ganhos: null,
    }

    if (ganhou) {
      const ganhos = premiar(player, inimigo, { sorte, forca: fase.forca })
      registro.ganhos = ganhos
      total.xp += ganhos.xp
      total.gold += ganhos.gold
      total.subiuPara.push(...ganhos.subiuPara)
      if (ganhos.drop) total.itens.push({ item: ganhos.drop, perdido: ganhos.mochilaCheia })
      if (ganhos.mochilaCheia) total.perdidos++
      if (ganhos.titanita) total.titanitas.push(ganhos.titanita)
      if (ganhos.feitico) total.feiticos.push(ganhos.feitico)

      // O que sobrou segue para o proximo inimigo. Subir de nivel no meio da
      // horda aumenta o teto, e a vida absoluta continua a mesma: o alivio
      // vem de a barra ficar proporcionalmente mais cheia.
      hp = Math.min(atributos(player).hp, luta.hpA + atributos(player).hp * config.rpg.cacada.curaEntreInimigos)
    } else {
      hp = 0
      venceu = false
    }

    lutas.push(registro)
    if (!ganhou) break
  }

  const saida = { fase, lutas, venceu, total, ...andarNaRota(player, onde, venceu) }

  c.ultimaFaseEm = Date.now()
  if (venceu) c.vitorias = (c.vitorias ?? 0) + 1
  else c.derrotas = (c.derrotas ?? 0) + 1
  store.save()

  return saida
}

/**
 * O que a rota faz depois de a fase acabar.
 *
 * Vencendo: se o avanco automatico esta ligado, a proxima fase; se o jogador
 * mandou repetir, fica onde esta. Perdendo: uma fase atras, e o avanco
 * automatico desliga ate ele pedir de novo.
 */
function andarNaRota(player, onde, venceu) {
  const c = player.rpg.cacada

  if (!venceu) {
    const atras = faseAnterior(onde)
    c.ato = atras.ato
    c.fase = atras.fase
    c.repetindo = true
    c.travada = { ...onde }
    return { proxima: { ...atras }, repetindo: true, recorde: false, terminou: false }
  }

  const bateuRecorde = marcarRecorde(player, onde)
  const fim = ehOFim(onde)

  // Vencer a fase que travava limpa a trava: ela deixou de ser um problema.
  if (faseValida(c.travada) && comparar(onde, c.travada) >= 0) c.travada = null

  const destino = c.repetindo || fim ? { ...onde } : proximaFase(onde)
  c.ato = destino.ato
  c.fase = destino.fase

  return {
    proxima: destino,
    repetindo: Boolean(c.repetindo),
    recorde: bateuRecorde,
    terminou: fim,
    // O ato so muda quando a rota anda de verdade: e o que dispara o nome
    // do lugar aparecendo na tela.
    novoAto: destino.ato !== onde.ato,
  }
}

/** Guarda a fase mais adiantada ja vencida. E o que o mapa desenha. */
function marcarRecorde(player, onde) {
  const c = player.rpg.cacada
  const antigo = recorde(player)
  if (antigo && comparar(onde, antigo) <= 0) return false
  c.maiorAto = onde.ato
  c.maiorFase = onde.fase
  return true
}

// ------------------------------------------------------------------ visao

/** A rota como a tela a desenha: o mapa do ato, o arco e o recorde. */
export function verRota(player) {
  const onde = posicao(player)
  const oAto = ato(onde.ato)
  const oArco = arcoDoAto(onde.ato)
  const melhor = recorde(player)
  const c = player.rpg.cacada ?? {}

  return {
    ato: onde.ato,
    fase: onde.fase,
    fasesPorAto: config.rpg.cacada.fasesPorAto,
    nomeDoAto: oAto?.nome ?? '',
    cenario: oAto?.cenario ?? null,
    noArco: oAto?.noArco ?? 1,
    atosNoArco: oArco?.atos.length ?? 1,
    arco: {
      numero: oAto?.arco ?? 1,
      nome: oArco?.nome ?? '',
      rotulo: nomeDoArco(oArco),
      final: Boolean(oArco?.final),
    },
    totalDeArcos: ARCOS.length,
    // Quanto do ato ja caiu: quantas fases DESTE ato o recorde ja passou.
    vencidasNoAto: melhor && melhor.ato > onde.ato ? config.rpg.cacada.fasesPorAto : melhor?.ato === onde.ato ? melhor.fase : 0,
    recorde: melhor,
    repetindo: Boolean(c.repetindo),
    travada: faseValida(c.travada) ? c.travada : null,
    indice: indiceDaFase(onde.ato, onde.fase),
    vitorias: c.vitorias ?? 0,
    derrotas: c.derrotas ?? 0,
  }
}
