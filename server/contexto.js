/**
 * O personagem ativo de uma requisicao.
 *
 * A conta e identificada pelo cookie de sessao; o personagem, por um
 * cabecalho `X-Personagem`. Separar os dois e o que deixa a pessoa abrir
 * duas abas com dois personagens da mesma conta sem uma derrubar a outra.
 *
 * Toda rota que altera alguma coisa termina em `responder()`, que grava e
 * ja devolve a ficha atualizada junto — assim o front nunca precisa de uma
 * segunda chamada para saber como o personagem ficou.
 */
import * as store from './store.js'
import { verPersonagem } from './visao.js'

export const CABECALHO = 'x-personagem'

/** Exige um personagem valido e dono da conta logada. */
export function exigirPersonagem(req, res, next) {
  const id = req.get(CABECALHO) || req.query.personagem
  if (!id) return res.status(400).json({ erro: 'Nenhum personagem selecionado.' })

  const player = store.buscarPersonagem(String(id))
  if (!player || player.usuarioId !== req.usuario.id) {
    return res.status(404).json({ erro: 'Personagem não encontrado nesta conta.' })
  }

  req.player = player
  next()
}

/** Exige, alem disso, que o personagem ja tenha escolhido uma classe. */
export function exigirClasse(req, res, next) {
  if (!req.player.rpg.classe) {
    return res.status(409).json({ erro: 'Esse personagem ainda não escolheu uma classe.' })
  }
  next()
}

/** Grava o que mudou e devolve a resposta com a ficha nova junto. */
export function responder(res, player, corpo = {}) {
  store.tocar(player)
  store.flush()
  res.json({ ...corpo, personagem: verPersonagem(player) })
}

/** Envolve um handler assincrono para que um erro nao derrube o processo. */
export const rota = (handler) => (req, res, next) => {
  try {
    const saida = handler(req, res, next)
    if (saida && typeof saida.catch === 'function') saida.catch(next)
  } catch (err) {
    next(err)
  }
}
