/**
 * Caçar, enfrentar o chefe do marco, descansar na fogueira e descer o Abismo.
 *
 * Todo calculo acontece aqui, no servidor. O navegador recebe o log
 * estruturado da luta e anima em cima dele — o resultado ja veio decidido.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import {
  descer,
  esperaDoAbismo,
  nomeDaProfundidade,
  ranking as rankingDoAbismo,
  vidaEntreAndares,
} from '../rpg/abismo.js'
import { resolver } from '../rpg/encontro.js'
import { criarBoss, sortearMonstro } from '../rpg/monstros.js'
import {
  acenderFogueira,
  atributos,
  curar,
  descansoRestante,
  feridoRestante,
  levantarDaFogueira,
  vidaAtual,
} from '../rpg/jogador.js'
import { emExpedicao } from '../rpg/expedicao.js'
import { verEncontro, verItem, verResumo } from '../visao.js'
import { anunciar } from '../realtime.js'
import { registrar } from '../missoes.js'
import { nomeCompleto } from '../rpg/itens.js'

export const combate = Router()

combate.use(exigirLogin, exigirPersonagem)

/**
 * As pre-condicoes de qualquer luta PvE. Sao as mesmas para caçar e para o
 * chefe — a unica diferenca e que caçar levanta quem esta na fogueira em vez
 * de recusar.
 */
function impedimento(player, { levantaDaFogueira = false } = {}) {
  if (emExpedicao(player)) return 'Seu personagem está em expedição.'

  const ferido = feridoRestante(player)
  if (ferido > 0) return `Você está ferido. Volte em ${Math.ceil(ferido / 1000)}s ou use uma bandagem.`

  const descanso = descansoRestante(player)
  if (descanso > 0 && !levantaDaFogueira) {
    return `Você está descansando na fogueira (${Math.ceil(descanso / 1000)}s).`
  }

  const espera =
    (player.rpg.ultimaLuta ?? 0) + config.rpg.cooldownSummonSeconds * 1000 - Date.now()
  if (espera > 0) return `Recupere o fôlego: ${Math.ceil(espera / 1000)}s.`

  return null
}

/**
 * O que vale a pena aparecer no chat de todo mundo. Só o que é raro de
 * verdade — se cada goblin virasse anúncio, ninguém leria mais o chat.
 */
function anunciarFeitos(player, monstro, saida) {
  if (!saida.venceu) return

  if (saida.bossVencido) {
    anunciar(`${player.name} derrubou ${monstro.emoji} ${monstro.nome} e destravou o nível ${monstro.marco}.`)
  }
  if (saida.subiuPara.length) {
    anunciar(`${player.name} chegou ao nível ${saida.subiuPara.at(-1)}.`)
  }
  if (saida.drop && ['epico', 'lendario'].includes(saida.drop.raridade)) {
    anunciar(`${player.name} achou ${nomeCompleto(saida.drop)}.`)
  }
}

/** O que uma luta vencida move nas missões do dia. */
function missoesDaLuta(player, monstro, saida) {
  if (!saida.venceu) return
  registrar(player, 'cacar')
  if (monstro.elite) registrar(player, 'elite')
  registrar(player, 'gold', saida.gold)
}

// ------------------------------------------------------------------ caçar

combate.post(
  '/cacar',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const erro = impedimento(player, { levantaDaFogueira: true })
    if (erro) return res.status(409).json({ erro })

    const monstro = sortearMonstro(player.rpg.nivel, config.rpg.chanceElite)
    const hpInicial = vidaAtual(player)
    const saida = resolver(player, monstro)
    anunciarFeitos(player, monstro, saida)
    missoesDaLuta(player, monstro, saida)

    responder(res, player, {
      encontro: verEncontro(monstro, saida, hpInicial),
      // Quando o nivel esta travado o XP continua entrando, so nao sobe.
      travado: Boolean(player.rpg.bossPendente),
    })
  }),
)

// ------------------------------------------------------------------ chefe

combate.post(
  '/chefe',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const marco = player.rpg.bossPendente
    if (!marco) return res.status(409).json({ erro: 'Nenhum chefe está travando o seu nível.' })

    const erro = impedimento(player)
    if (erro) return res.status(409).json({ erro })

    const boss = criarBoss(marco)
    if (!boss) return res.status(500).json({ erro: 'Não consegui montar esse chefe.' })

    levantarDaFogueira(player)
    const hpInicial = vidaAtual(player)
    const saida = resolver(player, boss)
    anunciarFeitos(player, boss, saida)
    missoesDaLuta(player, boss, saida)

    responder(res, player, { encontro: verEncontro(boss, saida, hpInicial) })
  }),
)

// --------------------------------------------------------------- fogueira

combate.post(
  '/fogueira',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    if (emExpedicao(player)) return res.status(409).json({ erro: 'Seu personagem está em expedição.' })
    if (vidaAtual(player) >= atributos(player).hp) {
      return res.status(409).json({ erro: 'Sua vida já está cheia.' })
    }
    if (descansoRestante(player) > 0) {
      return res.status(409).json({ erro: 'Você já está descansando.' })
    }

    const ate = acenderFogueira(player)
    responder(res, player, { terminaEm: ate })
  }),
)

combate.post(
  '/levantar',
  rota((req, res) => {
    const player = req.player
    const terminou = levantarDaFogueira(player)
    responder(res, player, { descansoCompleto: terminou })
  }),
)

// ----------------------------------------------------------------- abismo

combate.get(
  '/abismo',
  rota((req, res) => {
    const player = req.player
    res.json({
      nivelMinimo: config.rpg.abismo.nivelMinimo,
      espera: esperaDoAbismo(player),
      melhorAndar: player.rpg.abismo?.melhorAndar ?? 0,
      profundidade: nomeDaProfundidade(Math.max(1, player.rpg.abismo?.melhorAndar ?? 1)),
      ranking: rankingDoAbismo(15).map((p) => ({
        ...verResumo(p),
        melhorAndar: p.rpg.abismo.melhorAndar,
        profundidade: nomeDaProfundidade(p.rpg.abismo.melhorAndar),
      })),
    })
  }),
)

combate.post(
  '/abismo',
  exigirClasse,
  rota((req, res) => {
    const player = req.player

    if (player.rpg.nivel < config.rpg.abismo.nivelMinimo) {
      return res
        .status(409)
        .json({ erro: `O Abismo só se abre para quem passou do nível ${config.rpg.abismo.nivelMinimo}.` })
    }
    if (emExpedicao(player)) return res.status(409).json({ erro: 'Seu personagem está em expedição.' })
    if (feridoRestante(player) > 0) {
      return res.status(409).json({ erro: 'Ninguém desce o Abismo ferido.' })
    }

    const espera = esperaDoAbismo(player)
    if (espera > 0) {
      return res.status(409).json({ erro: `O Abismo se fecha por mais ${Math.ceil(espera / 60_000)} min.` })
    }

    levantarDaFogueira(player)
    const descida = descer(player)
    registrar(player, 'abismo', descida.vencidos)

    if (descida.recorde && descida.vencidos > 0) {
      anunciar(
        `${player.name} desceu ${descida.vencidos} andar(es) do Abismo — ${nomeDaProfundidade(descida.vencidos)}.`,
      )
    }

    responder(res, player, {
      descida: {
        vencidos: descida.vencidos,
        recorde: descida.recorde,
        hpMax: descida.hpMax,
        premio: descida.premio,
        subiu: descida.subiu,
        materiais: descida.materiais,
        itens: descida.itens.map((d) => ({ item: verItem(d.item), perdido: d.perdido })),
        // A vida com que se entra em cada andar: cheia no primeiro, e depois
        // o que `vidaEntreAndares` devolveu do andar anterior.
        andares: descida.andares.map((a, i) => ({
          andar: a.andar,
          hpInicial:
            i === 0
              ? descida.hpMax
              : vidaEntreAndares(descida.andares[i - 1].hpFinal, descida.hpMax),
          venceu: a.venceu,
          rodadas: a.rodadas,
          hpFinal: a.hpFinal,
          hpMax: a.hpMax,
          profundidade: nomeDaProfundidade(a.andar),
          inimigo: {
            nome: a.inimigo.nome,
            emoji: a.inimigo.emoji,
            nivel: a.inimigo.nivel,
            hpMax: a.inimigo.hp,
          },
          log: a.luta.log,
        })),
      },
    })
  }),
)

// ---------------------------------------------------------- usar consumivel

/** Poção e bandagem valem fora de combate; e o que salva uma sequência de caçadas. */
export function usarConsumivel(player, item) {
  if (item.tiraFerimento) {
    player.rpg.feridoAte = 0
    const voltou = curar(player, 0.3)
    return { texto: `Bandagem aplicada. O ferimento fechou e ${voltou} de vida voltou.` }
  }

  if (item.cura) {
    const voltou = curar(player, item.cura)
    if (voltou <= 0) return { erro: 'Sua vida já está cheia.' }
    return { texto: `${item.nome}: ${voltou} de vida recuperada.` }
  }

  return { erro: 'Esse item não faz nada fora de combate.' }
}
