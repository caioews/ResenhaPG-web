/**
 * O que envolve mais de um jogador: raids, duelos de PvP e os rankings.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import * as store from '../store.js'
import { classe, rotuloClasse } from '../rpg/classes.js'
import { lutar, lutarEmGrupo } from '../rpg/combate.js'
import { comoLutador } from '../rpg/encontro.js'
import { atributos, darGold, feridoRestante, ferir, ganharXp, guardarItem, mochilaCheia } from '../rpg/jogador.js'
import { emExpedicao } from '../rpg/expedicao.js'
import { criarChefeDeRaid, droparMateriais, droparRecompensas, TODOS_OS_CHEFES } from '../rpg/raid.js'
import { chanceEsperada, esperaEntreDuelos, ranking as rankingPvp, registrarResultado } from '../rpg/pvp.js'
import { FEITICOS } from '../rpg/feiticos.js'
import { TITANITAS } from '../rpg/ferreiro.js'
import { verItem, verResumo } from '../visao.js'
import * as salas from '../salas.js'
import { anunciar, emitirPara, emitirParaTodos, jogadoresOnline } from '../realtime.js'

export const social = Router()

social.use(exigirLogin, exigirPersonagem)

// ============================================================== R A I D

const verSala = (sala) => {
  const chefe = TODOS_OS_CHEFES[sala.chefeId]
  const participantes = sala.participantes.map((id) => store.buscarPersonagem(id)).filter(Boolean)

  return {
    id: sala.id,
    criadorId: sala.criadorId,
    criadorNome: sala.criadorNome,
    expiraEm: sala.expiraEm,
    chefe: { id: chefe.id, nome: chefe.nome, emoji: chefe.emoji, descricao: chefe.descricao, duro: Boolean(chefe.duro) },
    participantes: participantes.map(verResumo),
    nivelMedio: participantes.length
      ? Math.round(participantes.reduce((s, p) => s + p.rpg.nivel, 0) / participantes.length)
      : 0,
    minJogadores: config.rpg.raid.minJogadores,
    maxJogadores: config.rpg.raid.maxJogadores,
  }
}

const avisarSala = (sala) => emitirParaTodos('raid:atualizou', { sala: sala ? verSala(sala) : null })

social.get(
  '/raid',
  rota((req, res) => {
    const player = req.player
    const minha = salas.salaDoJogador(player.id)

    res.json({
      minhaSala: minha ? verSala(minha) : null,
      salas: salas.listarSalas().map(verSala),
      espera: Math.max(
        0,
        (player.rpg.raid?.ultimaRaid ?? 0) + config.rpg.raid.cooldownMinutos * 60_000 - Date.now(),
      ),
      minJogadores: config.rpg.raid.minJogadores,
      maxJogadores: config.rpg.raid.maxJogadores,
      salaMinutos: config.rpg.raid.salaMinutos,
    })
  }),
)

/** As checagens que valem para abrir e para entrar numa sala. */
function impedimentoDeRaid(player) {
  if (emExpedicao(player)) return 'Seu personagem está em expedição.'
  if (feridoRestante(player) > 0) return 'Você está ferido demais para uma raid.'

  const espera = (player.rpg.raid?.ultimaRaid ?? 0) + config.rpg.raid.cooldownMinutos * 60_000 - Date.now()
  if (espera > 0) return `Você ainda está se refazendo da última raid (${Math.ceil(espera / 60_000)} min).`

  return null
}

social.post(
  '/raid/abrir',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const erro = impedimentoDeRaid(player)
    if (erro) return res.status(409).json({ erro })
    if (salas.salaDoJogador(player.id)) {
      return res.status(409).json({ erro: 'Você já está numa sala de raid.' })
    }

    const sala = salas.abrirSala(player)
    avisarSala(sala)
    anunciar(`${player.name} abriu uma raid contra ${TODOS_OS_CHEFES[sala.chefeId].nome}. Entrem!`)

    res.json({ sala: verSala(sala) })
  }),
)

social.post(
  '/raid/entrar',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const sala = salas.pegarSala(String(req.body?.id ?? ''))
    if (!sala) return res.status(404).json({ erro: 'Essa sala não existe mais.' })

    const erro = impedimentoDeRaid(player)
    if (erro) return res.status(409).json({ erro })
    if (salas.salaDoJogador(player.id)) {
      return res.status(409).json({ erro: 'Você já está numa sala de raid.' })
    }

    const feito = salas.entrarNaSala(sala, player.id)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    avisarSala(sala)
    res.json({ sala: verSala(sala) })
  }),
)

social.post(
  '/raid/sair',
  rota((req, res) => {
    const player = req.player
    const sala = salas.salaDoJogador(player.id)
    if (!sala) return res.status(409).json({ erro: 'Você não está em nenhuma sala.' })

    const fechou = sala.criadorId === player.id
    salas.sairDaSala(sala, player.id)
    avisarSala(fechou ? null : sala)

    res.json({ ok: true, fechou })
  }),
)

social.post(
  '/raid/iniciar',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const sala = salas.salaDoJogador(player.id)
    if (!sala) return res.status(409).json({ erro: 'Você não está em nenhuma sala.' })
    if (sala.criadorId !== player.id) {
      return res.status(403).json({ erro: 'Só quem abriu a raid decide a hora de começar.' })
    }
    if (sala.participantes.length < config.rpg.raid.minJogadores) {
      return res.status(409).json({
        erro: `Uma raid precisa de pelo menos ${config.rpg.raid.minJogadores} jogadores. Vocês são ${sala.participantes.length}.`,
      })
    }

    const participantes = sala.participantes.map((id) => store.buscarPersonagem(id)).filter(Boolean)
    const media = Math.round(participantes.reduce((s, p) => s + p.rpg.nivel, 0) / participantes.length)
    const chefe = criarChefeDeRaid(sala.chefeId, media, participantes.length)
    salas.fecharSala(sala.id)
    avisarSala(null)

    // Todo mundo entra inteiro: a raid é um evento marcado, não uma emboscada.
    const time = participantes.map((p) => {
      const lutador = comoLutador(p, p.name)
      lutador.hp = atributos(p).hp
      return lutador
    })

    const resultado = lutarEmGrupo(time, chefe)
    const agora = Date.now()
    for (const p of participantes) p.rpg.raid.ultimaRaid = agora

    const cabecalho = {
      chefe: {
        nome: chefe.nome,
        emoji: chefe.emoji,
        nivel: chefe.nivel,
        hpMax: chefe.hp,
        duro: chefe.duro,
        areaCada: chefe.areaCada,
      },
      nivelMedio: media,
      participantes: participantes.map(verResumo),
      rodadas: resultado.rodadas,
      log: resultado.log,
      venceu: resultado.venceu,
    }

    if (!resultado.venceu) {
      for (const p of participantes) {
        p.rpg.raid.derrotas++
        ferir(p)
      }
      store.flush()

      const saida = {
        raid: {
          ...cabecalho,
          hpRestanteDoChefe: Math.round((resultado.chefe.hp / resultado.chefe.hpMax) * 100),
          porJogador: [],
          itens: [],
          materiais: [],
        },
      }

      for (const p of participantes) emitirPara(p.id, 'raid:resultado', saida)
      anunciar(`${chefe.nome} derrotou o grupo de ${participantes.length} aventureiros.`)
      return responder(res, player, saida)
    }

    // Vitória: XP e gold para todos, e quem caiu leva 60%.
    const { xpBase, xpPorNivel, goldBase, goldPorNivel } = config.rpg.raid
    const xpCheio = Math.round(xpBase + media * xpPorNivel)
    const goldCheio = Math.round(goldBase + media * goldPorNivel)

    const porJogador = participantes.map((p, i) => {
      const estado = resultado.time[i]
      const caiu = estado?.caido ?? false
      const fracao = caiu ? 0.6 : 1
      const xp = Math.round(xpCheio * fracao)
      const gold = Math.round(goldCheio * fracao)

      darGold(p, gold)
      const subiu = ganharXp(p, xp)
      p.rpg.raid.vitorias++

      return {
        personagem: verResumo(p),
        caiu,
        xp,
        gold,
        subiu,
        hp: estado?.hp ?? 0,
        hpMax: estado?.hpMax ?? 1,
      }
    })

    // `droparMateriais` e `droparRecompensas` esperam { player } em cada
    // participante — é assim que o motor do bot os recebe.
    const embrulho = participantes.map((p) => ({ id: p.id, player: p }))
    const materiais = droparMateriais(embrulho, media).map((m) => ({
      personagem: verResumo(m.dono.player),
      titanita: m.titanita
        ? { ...m.titanita, nome: TITANITAS[m.titanita.grau].nome, emoji: TITANITAS[m.titanita.grau].emoji }
        : null,
      feitico: m.feitico
        ? { id: m.feitico, nome: FEITICOS[m.feitico].nome, emoji: FEITICOS[m.feitico].emoji }
        : null,
    }))

    const itens = droparRecompensas(embrulho).map(({ dono, item }) => {
      const perdido = mochilaCheia(dono.player)
      if (!perdido) guardarItem(dono.player, item)
      return { personagem: verResumo(dono.player), item: verItem(item), perdido }
    })

    store.flush()

    const saida = { raid: { ...cabecalho, porJogador, itens, materiais } }
    for (const p of participantes) emitirPara(p.id, 'raid:resultado', saida)
    anunciar(`${chefe.nome} caiu diante de ${participantes.length} aventureiros!`)

    responder(res, player, saida)
  }),
)

// ================================================================ P V P

const verDesafio = (d) => ({
  id: d.id,
  aposta: d.aposta,
  expiraEm: d.expiraEm,
  desafiante: { id: d.desafianteId, nome: d.desafianteNome },
  desafiado: { id: d.desafiadoId, nome: d.desafiadoNome },
})

social.get(
  '/pvp',
  rota((req, res) => {
    const player = req.player

    res.json({
      espera: esperaEntreDuelos(player),
      pontos: player.rpg.pvp.pontos,
      recebidos: salas.desafiosPara(player.id).map(verDesafio),
      enviados: salas.desafiosDe(player.id).map(verDesafio),
      online: jogadoresOnline().filter((p) => p.id !== player.id),
      // Qualquer personagem com classe pode ser desafiado, esteja on-line ou
      // não — o desafio fica de pé por alguns minutos esperando resposta.
      oponentes: store
        .allPlayers()
        .filter((p) => p.id !== player.id && p.rpg.classe)
        .sort((a, b) => b.rpg.pvp.pontos - a.rpg.pvp.pontos)
        .slice(0, 50)
        .map((p) => ({
          ...verResumo(p),
          chance: Math.round(chanceEsperada(player.rpg.pvp.pontos, p.rpg.pvp.pontos) * 100),
        })),
      ranking: rankingPvp(20).map((p, i) => ({ ...verResumo(p), posicao: i + 1 })),
    })
  }),
)

social.post(
  '/pvp/desafiar',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const alvo = store.buscarPersonagem(String(req.body?.alvo ?? ''))
    const aposta = Math.max(0, Math.floor(Number(req.body?.aposta ?? 0)) || 0)

    if (!alvo) return res.status(404).json({ erro: 'Esse jogador não existe.' })
    if (alvo.id === player.id) return res.status(400).json({ erro: 'Você não pode duelar consigo mesmo.' })
    if (!alvo.rpg.classe) return res.status(409).json({ erro: 'Esse personagem ainda não tem classe.' })

    const espera = esperaEntreDuelos(player)
    if (espera > 0) {
      return res.status(409).json({ erro: `Espere ${Math.ceil(espera / 1000)}s entre um duelo e outro.` })
    }
    if (aposta > player.rpg.gold) {
      return res.status(409).json({ erro: `Você tem ${player.rpg.gold} de gold e quis apostar ${aposta}.` })
    }

    const feito = salas.criarDesafio({ desafiante: player, desafiado: alvo, aposta })
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    emitirPara(alvo.id, 'pvp:desafio', { desafio: verDesafio(feito.desafio) })
    res.json({ desafio: verDesafio(feito.desafio) })
  }),
)

social.post(
  '/pvp/responder',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const desafio = salas.pegarDesafio(String(req.body?.id ?? ''))
    if (!desafio) return res.status(404).json({ erro: 'Esse desafio venceu ou não existe.' })
    if (desafio.desafiadoId !== player.id) {
      return res.status(403).json({ erro: 'Esse desafio não é seu.' })
    }

    if (!req.body?.aceitar) {
      salas.apagarDesafio(desafio.id)
      emitirPara(desafio.desafianteId, 'pvp:recusado', { desafio: verDesafio(desafio) })
      return res.json({ recusado: true })
    }

    const desafiante = store.buscarPersonagem(desafio.desafianteId)
    if (!desafiante) {
      salas.apagarDesafio(desafio.id)
      return res.status(404).json({ erro: 'O desafiante não está mais disponível.' })
    }

    const espera = esperaEntreDuelos(player)
    if (espera > 0) {
      return res.status(409).json({ erro: `Espere ${Math.ceil(espera / 1000)}s entre um duelo e outro.` })
    }

    // A aposta é conferida duas vezes: ao criar o desafio e aqui. O
    // desafiante pode ter gastado o gold nesse meio-tempo.
    if (desafio.aposta > 0) {
      if (desafiante.rpg.gold < desafio.aposta) {
        salas.apagarDesafio(desafio.id)
        return res.status(409).json({ erro: `${desafiante.name} não tem mais os ${desafio.aposta} de gold da aposta.` })
      }
      if (player.rpg.gold < desafio.aposta) {
        return res.status(409).json({ erro: `A aposta é de ${desafio.aposta} de gold e você tem ${player.rpg.gold}.` })
      }
    }

    salas.apagarDesafio(desafio.id)

    // Duelo é treino: os dois entram com a vida cheia e o resultado não
    // consome HP de ninguém. Senão quem acabou de caçar perderia sempre.
    const a = comoLutador(desafiante, desafiante.name)
    const b = comoLutador(player, player.name)
    a.hp = atributos(desafiante).hp
    b.hp = atributos(player).hp

    const luta = lutar(a, b)
    const venceuDesafiante = luta.vencedor === 'a'
    const vencedor = venceuDesafiante ? desafiante : player
    const perdedor = venceuDesafiante ? player : desafiante

    const pontos = registrarResultado(vencedor, perdedor)

    if (desafio.aposta > 0) {
      darGold(perdedor, -desafio.aposta)
      darGold(vencedor, desafio.aposta)
      vencedor.rpg.pvp.goldGanho += desafio.aposta
    }

    const agora = Date.now()
    desafiante.rpg.pvp.ultimoDuelo = agora
    player.rpg.pvp.ultimoDuelo = agora
    store.flush()

    const duelo = {
      aposta: desafio.aposta,
      pontos,
      rodadas: luta.rodadas,
      porDecisao: luta.porDecisao,
      log: luta.log,
      lados: {
        a: {
          ...verResumo(desafiante),
          classeRotulo: rotuloClasse(desafiante.rpg.classe),
          hpFinal: luta.hpA,
          hpMax: luta.hpMaxA,
          venceu: venceuDesafiante,
        },
        b: {
          ...verResumo(player),
          classeRotulo: rotuloClasse(player.rpg.classe),
          hpFinal: luta.hpB,
          hpMax: luta.hpMaxB,
          venceu: !venceuDesafiante,
        },
      },
      vencedor: verResumo(vencedor),
      sequencia: vencedor.rpg.pvp.sequencia,
    }

    emitirPara(desafiante.id, 'pvp:resultado', { duelo })
    anunciar(`${vencedor.name} venceu ${perdedor.name} em duelo (+${pontos} pontos).`)

    responder(res, player, { duelo })
  }),
)

// ========================================================= R A N K I N G S

social.get(
  '/ranking',
  rota((_req, res) => {
    const todos = store.allPlayers().filter((p) => p.rpg.classe)

    res.json({
      nivel: [...todos]
        .sort((a, b) => b.rpg.nivel - a.rpg.nivel || b.rpg.xp - a.rpg.xp)
        .slice(0, 20)
        .map((p, i) => ({ ...verResumo(p), posicao: i + 1 })),
      gold: [...todos]
        .sort((a, b) => b.rpg.gold - a.rpg.gold)
        .slice(0, 20)
        .map((p, i) => ({ ...verResumo(p), posicao: i + 1 })),
      abismo: [...todos]
        .filter((p) => (p.rpg.abismo?.melhorAndar ?? 0) > 0)
        .sort((a, b) => b.rpg.abismo.melhorAndar - a.rpg.abismo.melhorAndar || b.rpg.nivel - a.rpg.nivel)
        .slice(0, 20)
        .map((p, i) => ({ ...verResumo(p), posicao: i + 1 })),
      pvp: rankingPvp(20).map((p, i) => ({ ...verResumo(p), posicao: i + 1 })),
      online: jogadoresOnline(),
    })
  }),
)

/** A ficha pública de outro jogador — o que se vê antes de desafiar. */
social.get(
  '/jogadores/:id',
  rota((req, res) => {
    const alvo = store.buscarPersonagem(req.params.id)
    if (!alvo || !alvo.rpg.classe) return res.status(404).json({ erro: 'Jogador não encontrado.' })

    const c = classe(alvo.rpg.classe)
    res.json({
      ...verResumo(alvo),
      atributos: atributos(alvo),
      classeRotulo: rotuloClasse(alvo.rpg.classe),
      resumoDaClasse: c?.resumo ?? '',
      equipado: Object.fromEntries(
        Object.entries(alvo.rpg.equipado).map(([slot, uid]) => [
          slot,
          verItem(alvo.rpg.inventario.find((it) => it.uid === uid) ?? null),
        ]),
      ),
      pvp: alvo.rpg.pvp,
      abismo: alvo.rpg.abismo,
      chance: Math.round(chanceEsperada(req.player.rpg.pvp.pontos, alvo.rpg.pvp.pontos) * 100),
    })
  }),
)
