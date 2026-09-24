/**
 * A masmorra em grupo vista pela API: o lobby (abrir, entrar, sair) e a
 * descida. As regras moram em server/masmorra.js.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import * as store from '../store.js'
import * as masmorra from '../masmorra.js'
import { registrar } from '../missoes.js'
import { nomeDaProfundidade } from '../rpg/abismo.js'
import { precoDeCompra } from '../rpg/loja.js'
import { verItem, verResumo } from '../visao.js'
import { anunciar, emitirPara, emitirParaTodos } from '../realtime.js'

export const masmorraRotas = Router()

masmorraRotas.use(exigirLogin, exigirPersonagem)

const verSala = (sala) => {
  const participantes = sala.participantes.map((id) => store.buscarPersonagem(id)).filter(Boolean)
  return {
    id: sala.id,
    liderId: sala.liderId,
    liderNome: sala.liderNome,
    expiraEm: sala.expiraEm,
    participantes: participantes.map(verResumo),
    // O nível em que a masmorra vai descer, não a média simples.
    nivelMedio: participantes.length ? masmorra.nivelDoGrupo(participantes) : 0,
    minJogadores: config.rpg.masmorra.minJogadores,
    maxJogadores: config.rpg.masmorra.maxJogadores,
  }
}

const avisar = () => emitirParaTodos('masmorra:atualizou', {})

masmorraRotas.get(
  '/masmorra',
  rota((req, res) => {
    const player = req.player
    const minha = masmorra.salaDoJogador(player.id)
    res.json({
      minhaSala: minha ? verSala(minha) : null,
      salas: masmorra.listarSalas().map(verSala),
      espera: masmorra.esperaDaMasmorra(player),
      impedimento: masmorra.impedimento(player),
      nivelMinimo: config.rpg.masmorra.nivelMinimo,
      minJogadores: config.rpg.masmorra.minJogadores,
      maxJogadores: config.rpg.masmorra.maxJogadores,
      salaMinutos: config.rpg.masmorra.salaMinutos,
      melhorAndar: player.rpg.masmorra?.melhorAndar ?? 0,
      ranking: masmorra.ranking(10).map((p, i) => ({ ...verResumo(p), posicao: i + 1 })),
    })
  }),
)

masmorraRotas.post(
  '/masmorra/abrir',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const erro = masmorra.impedimento(player)
    if (erro) return res.status(409).json({ erro })
    if (masmorra.salaDoJogador(player.id)) return res.status(409).json({ erro: 'Você já está num grupo.' })

    const sala = masmorra.abrirSala(player)
    avisar()
    anunciar(`${player.name} está montando um grupo para a Masmorra. Quem vem?`)
    res.json({ sala: verSala(sala) })
  }),
)

masmorraRotas.post(
  '/masmorra/entrar',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const sala = masmorra.pegarSala(String(req.body?.id ?? ''))
    if (!sala) return res.status(404).json({ erro: 'Esse grupo não existe mais.' })
    const erro = masmorra.impedimento(player)
    if (erro) return res.status(409).json({ erro })
    if (masmorra.salaDoJogador(player.id)) return res.status(409).json({ erro: 'Você já está num grupo.' })

    const feito = masmorra.entrarNaSala(sala, player)
    if (feito.erro) return res.status(409).json({ erro: feito.erro })

    avisar()
    for (const id of sala.participantes) {
      if (id !== player.id) emitirPara(id, 'masmorra:entrou', { nome: player.name, sala: verSala(sala) })
    }
    res.json({ sala: verSala(sala) })
  }),
)

masmorraRotas.post(
  '/masmorra/sair',
  rota((req, res) => {
    const sala = masmorra.salaDoJogador(req.player.id)
    if (!sala) return res.status(409).json({ erro: 'Você não está em nenhum grupo.' })
    const { fechou } = masmorra.sairDaSala(sala, req.player.id)
    avisar()
    res.json({ ok: true, fechou })
  }),
)

/** A descida no formato da tela. O log inteiro só do último andar — o da queda. */
function verDescida(resultado) {
  const ultimo = resultado.andares.length - 1
  return {
    nivelMedio: resultado.nivelMedio,
    vencidos: resultado.vencidos,
    profundidade: nomeDaProfundidade(Math.max(1, resultado.vencidos)),
    andares: resultado.andares.map((a, i) => ({ ...a, log: i === ultimo ? a.log : undefined })),
    porJogador: resultado.porJogador.map((j) => ({
      personagem: verResumo(j.player),
      xp: j.xp,
      gold: j.gold,
      subiu: j.subiu,
      recorde: j.recorde,
      // O gold so importa quando `onde` e 'vendido'; recalcular a partir do
      // item e barato e evita guardar mais um campo em guardarOuEntregar.
      itens: j.itens.map((x) => ({
        item: verItem(x.item),
        onde: x.onde,
        goldDoItem: x.onde === 'vendido' ? precoDeCompra(x.item) : null,
      })),
      titanita: j.titanita,
      feitico: j.feitico,
    })),
  }
}

masmorraRotas.post(
  '/masmorra/iniciar',
  exigirClasse,
  rota((req, res) => {
    const player = req.player
    const sala = masmorra.salaDoJogador(player.id)
    if (!sala) return res.status(409).json({ erro: 'Você não está em nenhum grupo.' })
    if (sala.liderId !== player.id) return res.status(403).json({ erro: 'Só quem abriu o grupo decide a hora de descer.' })
    if (sala.participantes.length < config.rpg.masmorra.minJogadores) {
      return res.status(409).json({ erro: `A masmorra precisa de pelo menos ${config.rpg.masmorra.minJogadores} jogadores.` })
    }

    const participantes = sala.participantes.map((id) => store.buscarPersonagem(id)).filter(Boolean)
    // A condição é conferida de novo: alguém pode ter saído em
    // expedição enquanto esperava na sala.
    for (const p of participantes) {
      const erro = masmorra.impedimento(p)
      if (erro) return res.status(409).json({ erro: `${p.name} não pode descer agora: ${erro}` })
    }

    masmorra.fecharSala(sala.id)
    avisar()

    const resultado = masmorra.descer(participantes)
    for (const p of participantes) registrar(p, 'masmorra', resultado.vencidos)

    const descida = verDescida(resultado)
    for (const p of participantes) emitirPara(p.id, 'masmorra:resultado', { descida })
    if (resultado.vencidos > 0) {
      anunciar(
        `${participantes.map((p) => p.name).join(', ')} desceram ${resultado.vencidos} andar(es) da Masmorra — ${descida.profundidade}.`,
      )
    }

    responder(res, player, { descida })
  }),
)
