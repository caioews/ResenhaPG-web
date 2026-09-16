/**
 * Prestígio: chegar ao teto e recomeçar mais forte.
 *
 * No nível `config.rpg.prestigio.nivelMinimo` o personagem pode prestigiar.
 * Ele volta ao nível 1 e à classe base — perde a árvore de evolução inteira e
 * as habilidades que ela dava — mas mantém tudo o que juntou: itens, gold,
 * titanitas, feitiços, os chefes de marco já derrubados e os rankings.
 *
 * Em troca, o contador de prestígio passa a valer para sempre:
 *
 *   atributos   cada prestígio soma uma fração aos atributos que a CLASSE dá
 *               (o bônus do equipamento não muda — ver jogador.atributos)
 *   XP          cada prestígio soma uma fração a todo XP ganho
 *
 * Como os marcos de chefe já vencidos continuam vencidos, a subida de volta
 * não trava em nenhum deles: é justamente a ideia, recomeçar e subir rápido.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { classeRaiz } from './classes.js'
import { atributos, definirVida, desequiparIncompativeis } from './jogador.js'
import { emExpedicao } from './expedicao.js'

export const prestigioDe = (player) => player.rpg.prestigio ?? 0

/** Multiplicador dos atributos de classe para N prestígios. */
export const escalaDeAtributos = (n) => 1 + Math.max(0, n) * config.rpg.prestigio.bonusAtributos

/** Multiplicador do XP ganho para N prestígios. */
export const escalaDeXp = (n) => 1 + Math.max(0, n) * config.rpg.prestigio.bonusXp

/**
 * O XP que este jogador realmente recebe por uma recompensa.
 *
 * Fica aqui, e não dentro de ganharXp, porque quem chama precisa do número
 * final para mostrar na tela: a linha "+320 de XP" tem de bater com o que
 * entrou na ficha.
 */
export const xpComPrestigio = (player, xp) => Math.round(xp * escalaDeXp(prestigioDe(player)))

/** Por que este personagem não pode prestigiar agora. null = pode. */
export function motivoParaNaoPrestigiar(player) {
  if (!player.rpg.classe) return { erro: 'semClasse' }
  if (emExpedicao(player)) return { erro: 'emExpedicao' }
  if (player.rpg.nivel < config.rpg.prestigio.nivelMinimo) {
    return { erro: 'nivelBaixo', nivel: config.rpg.prestigio.nivelMinimo }
  }
  return null
}

/**
 * Reinicia o personagem e soma um no contador.
 *
 * Não confere nada: quem chama já passou por motivoParaNaoPrestigiar.
 */
export function prestigiar(player) {
  const ficha = player.rpg
  const classeAntiga = ficha.classe
  const raiz = classeRaiz(classeAntiga)

  ficha.prestigio = prestigioDe(player) + 1
  ficha.prestigioEm = Date.now()

  ficha.classe = raiz
  ficha.nivel = 1
  ficha.xp = 0
  ficha.bossPendente = 0
  ficha.evolucao = { esperaAte: 0, tentativas: 0, evoluiuEm: 0 }

  // O corpo é novo: sem ferimento, sem fogueira acesa, com a vida cheia.
  ficha.feridoAte = 0
  ficha.fogueiraAte = 0

  // As armas exclusivas da especialidade (pistola, machado, caveira, rede)
  // saem de uso — continuam na mochila, esperando a próxima evolução.
  const tirados = desequiparIncompativeis(player)
  definirVida(player, atributos(player).hp)

  store.save()

  return {
    prestigio: ficha.prestigio,
    classeAntiga,
    classe: raiz,
    tirados,
    escalaDeAtributos: escalaDeAtributos(ficha.prestigio),
    escalaDeXp: escalaDeXp(ficha.prestigio),
  }
}

/** Ranking de prestígio: mais prestígios, e desempate pelo nível. */
export function ranking(limite = 20) {
  return store
    .allPlayers()
    .filter((p) => p.rpg.classe && prestigioDe(p) > 0)
    .sort((a, b) => prestigioDe(b) - prestigioDe(a) || b.rpg.nivel - a.rpg.nivel || a.rpg.prestigioEm - b.rpg.prestigioEm)
    .slice(0, limite)
}
