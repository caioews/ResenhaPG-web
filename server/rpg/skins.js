/**
 * Skins: cosmético puro, comprado na loja. Troca o sprite padrão da classe
 * por um dos personagens desenhados em `Assets/personagens/sprites <classe>/
 * skins <classe>/` — `scripts/arte.js` já embutiu cada uma no manifesto de
 * arte que o palco lê, na mesma chave usada aqui: "<classe base>:<id>".
 *
 * Skin é da CLASSE BASE (a raiz da árvore, a que tem sprite — rpg/classes.js,
 * `classeRaiz`): quem evolui continua com a skin, porque continua com o
 * mesmo desenho por baixo da armadura.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { classeRaiz } from './classes.js'
import { darGold } from './jogador.js'

/** Uma entrada por classe base que tem skin; vazio para quem não tem. */
export const CATALOGO_DE_SKINS = {
  ladino: [{ id: 'yuno', nome: 'Yuno' }],
  mago: [
    { id: 'aila-morthaine', nome: 'Aila Morthaine' },
    { id: 'megumin', nome: 'Megumin' },
  ],
}

const chaveDaSkin = (classeBase, id) => `${classeBase}:${id}`

/** As skins da classe do jogador, com preço, posse e qual está em uso. */
export function skinsDoJogador(player) {
  const base = classeRaiz(player.rpg.classe)
  return (CATALOGO_DE_SKINS[base] ?? []).map((s) => {
    const chave = chaveDaSkin(base, s.id)
    return {
      id: s.id,
      nome: s.nome,
      chave,
      custo: config.rpg.custoDaSkin,
      comprada: player.rpg.skins.compradas.includes(chave),
      equipada: player.rpg.skins.equipada === chave,
    }
  })
}

const encontrar = (player, id) => {
  const base = classeRaiz(player.rpg.classe)
  const skin = (CATALOGO_DE_SKINS[base] ?? []).find((s) => s.id === id)
  return skin ? { skin, chave: chaveDaSkin(base, skin.id) } : null
}

/** Compra uma skin da própria classe. Não equipa sozinha — só entra na posse. */
export function comprarSkin(player, id) {
  const achada = encontrar(player, id)
  if (!achada) return { erro: 'Essa skin não existe para a sua classe.' }
  if (player.rpg.skins.compradas.includes(achada.chave)) return { erro: 'Você já tem essa skin.' }
  if (player.rpg.gold < config.rpg.custoDaSkin) {
    return { erro: `Faltam ${config.rpg.custoDaSkin - player.rpg.gold} de gold.` }
  }

  darGold(player, -config.rpg.custoDaSkin)
  player.rpg.skins.compradas.push(achada.chave)
  store.save()
  return { nome: achada.skin.nome, chave: achada.chave }
}

/** Troca a skin em uso. `id` nulo volta ao sprite padrão da classe. */
export function equiparSkin(player, id) {
  if (id === null) {
    player.rpg.skins.equipada = null
    store.save()
    return { equipada: null }
  }

  const achada = encontrar(player, id)
  if (!achada) return { erro: 'Essa skin não existe para a sua classe.' }
  if (!player.rpg.skins.compradas.includes(achada.chave)) return { erro: 'Você não comprou essa skin.' }

  player.rpg.skins.equipada = achada.chave
  store.save()
  return { equipada: achada.chave }
}

/**
 * A skin equipada é sempre da classe base atual: mudar de classe raiz (a
 * Prova do Espelho) troca o sprite todo, e a skin da classe antiga não
 * bate mais com nenhum sprite. `desequiparSeForaDaClasse` limpa nesse caso
 * — chamada de onde a classe base pode mudar.
 */
export function desequiparSeForaDaClasse(player) {
  const equipada = player.rpg.skins.equipada
  if (!equipada) return
  const base = classeRaiz(player.rpg.classe)
  if (!equipada.startsWith(`${base}:`)) player.rpg.skins.equipada = null
}
