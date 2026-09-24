/**
 * A caçada na rota e a descida do Abismo.
 *
 * Todo calculo acontece aqui, no servidor. O navegador recebe o log
 * estruturado de cada luta e anima em cima dele — o resultado ja veio
 * decidido. Uma chamada a /cacada resolve UMA fase inteira, da primeira
 * criatura da horda ate a ultima; o laco automatico do cliente e so pedir a
 * seguinte quando a animacao acabar.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import {
  cenarioDaProfundidade,
  descer,
  esperaDoAbismo,
  nomeDaProfundidade,
  ranking as rankingDoAbismo,
  vidaEntreAndares,
} from '../rpg/abismo.js'
import { avancar, enfrentar, esperaDaCacada, verRota } from '../rpg/cacada.js'
import { emExpedicao } from '../rpg/expedicao.js'
import { verFase, verItem, verResumo } from '../visao.js'
import { anunciar } from '../realtime.js'
import { registrar } from '../missoes.js'
import { nomeCompleto } from '../rpg/itens.js'

export const combate = Router()

combate.use(exigirLogin, exigirPersonagem)

// ----------------------------------------------------------------- caçada

/**
 * O que vale a pena aparecer no chat de todo mundo. Só o que é raro de
 * verdade — se cada goblin virasse anúncio, ninguém leria mais o chat.
 */
function anunciarFeitos(player, saida) {
  if (!saida.venceu) return

  // O chefe do ato só é notícia na PRIMEIRA vez: o laço automático repete a
  // mesma fase enquanto o jogador não mandar seguir, e sem `recorde` cada
  // volta viraria uma linha igual no chat de todo mundo.
  if (saida.fase.chefe && saida.recorde) {
    const chefe = saida.fase.inimigos[0]
    anunciar(`${player.name} derrubou ${chefe.emoji} ${chefe.nome} e fechou ${saida.fase.nomeDoAto}.`)
  }
  if (saida.total.subiuPara.length) {
    anunciar(`${player.name} chegou ao nível ${saida.total.subiuPara.at(-1)}.`)
  }
  for (const { item, perdido } of saida.total.itens) {
    if (!perdido && ['epico', 'lendario'].includes(item.raridade)) {
      anunciar(`${player.name} achou ${nomeCompleto(item)}.`)
    }
  }
}

/** O que uma fase vencida move nas missões do dia. */
function missoesDaFase(player, saida) {
  if (!saida.venceu) return
  registrar(player, 'cacar')
  for (const luta of saida.lutas) {
    if (luta.venceu && luta.inimigo.elite) registrar(player, 'elite')
  }
  registrar(player, 'gold', saida.total.gold)
}

combate.post(
  '/cacada',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    if (emExpedicao(player)) return res.status(409).json({ erro: 'Seu personagem está em expedição.' })

    const espera = esperaDaCacada(player)
    if (espera > 0) return res.status(409).json({ erro: `Recupere o fôlego: ${Math.ceil(espera / 1000)}s.` })

    const saida = enfrentar(player)
    anunciarFeitos(player, saida)
    missoesDaFase(player, saida)

    responder(res, player, { cacada: verFase(player, saida) })
  }),
)

/** "Ir para a próxima fase": religa o avanço depois de uma queda. */
combate.post(
  '/cacada/avancar',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const feito = avancar(player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })
    responder(res, player, { rota: verRota(player) })
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

    const espera = esperaDoAbismo(player)
    if (espera > 0) {
      return res.status(409).json({ erro: `O Abismo se fecha por mais ${Math.ceil(espera / 60_000)} min.` })
    }

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
          // O que o palco precisa para desenhar o andar: o cenário da faixa
          // de profundidade e o sprite deste habitante.
          cenario: cenarioDaProfundidade(a.andar),
          inimigo: {
            id: a.inimigo.id,
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
