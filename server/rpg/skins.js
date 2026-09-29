/**
 * Skins: cosmético puro, comprado na loja. Troca o sprite padrão da classe
 * por um dos personagens desenhados em `Assets/personagens/sprites <classe>/
 * skins <classe>/` — `scripts/arte.js` já embutiu cada uma no manifesto de
 * arte que o palco lê, na mesma chave usada aqui: "<classe base>:<id>".
 *
 * O catálogo sai direto desse manifesto: uma skin nova só precisa da pasta
 * certa em Assets e de rodar `npm run arte` de novo — não há lista para
 * manter à mão aqui.
 *
 * Skin é da CLASSE BASE (a raiz da árvore, a que tem sprite — rpg/classes.js,
 * `classeRaiz`): quem evolui continua com a skin, porque continua com o
 * mesmo desenho por baixo da armadura.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import { raizDoProjeto } from '../db.js'
import * as store from '../store.js'
import { classeRaiz } from './classes.js'
import { darGold } from './jogador.js'

const ARQUIVO_DA_ARTE = path.join(raizDoProjeto, 'public', 'arte', 'arte.json')

/** "janna-star-guardian" -> "Janna Star Guardian"; "2b" -> "2B". */
const nomeDaSkin = (id) =>
  id
    .split('-')
    .map((p) => (/^\d/.test(p) ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join(' ')

/** classe base -> [{ id, nome }], lido uma vez do manifesto de arte. */
let catalogo = null
function catalogoCompleto() {
  if (catalogo) return catalogo
  catalogo = {}
  if (!existsSync(ARQUIVO_DA_ARTE)) return catalogo

  const manifesto = JSON.parse(readFileSync(ARQUIVO_DA_ARTE, 'utf8'))
  for (const chave of Object.keys(manifesto.lutadores)) {
    const separador = chave.indexOf(':')
    if (separador < 0) continue
    const classe = chave.slice(0, separador)
    const id = chave.slice(separador + 1)
    ;(catalogo[classe] ??= []).push({ id, nome: nomeDaSkin(id) })
  }
  for (const lista of Object.values(catalogo)) lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return catalogo
}

const chaveDaSkin = (classeBase, id) => `${classeBase}:${id}`

/** As skins da classe do jogador, com preço, posse e qual está em uso. */
export function skinsDoJogador(player) {
  const base = classeRaiz(player.rpg.classe)
  return (catalogoCompleto()[base] ?? []).map((s) => {
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
  const skin = (catalogoCompleto()[base] ?? []).find((s) => s.id === id)
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
