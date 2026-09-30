/**
 * Runas: upgrades permanentes comprados com gold, em três árvores — Ouro,
 * Dano e XP. Cada nó só libera para compra quando pelo menos um nó vizinho
 * já foi comprado; a raiz de cada árvore já nasce liberada (custo 0), então
 * sempre há por onde começar.
 *
 * O efeito de cada nó usa o mesmo vocabulário de `hab` que classes e
 * feitiços já falam (rpg/habilidades.js, rpg/encontro.js): saqueGold,
 * saqueDrop, danoExtra, critico e perfuracao entram ali e combinam com o
 * resto sem precisar de nenhum código novo no motor de combate. XP não tem
 * um hub assim — soma direto em rpg/prestigio.js, o único cano por onde
 * toda recompensa de XP do jogo já passa.
 *
 * Reiniciar uma árvore (`resetarArvore`) devolve as runas para comprar de
 * novo, mas NUNCA devolve o gold gasto: é um recomeço, não um estorno.
 */
import * as store from '../store.js'
import { darGold } from './jogador.js'

/**
 * Layout em grade: `x` é a coluna (0 = raiz, 9 = nó final) e `y` é a linha
 * (-1 topo, 0 meio, 1 base) — o cliente usa isso direto para desenhar a
 * árvore, sem precisar recalcular posição nenhuma.
 */
export const ARVORES = {
  ouro: [
    { id: 'raiz', nome: 'Faro por Ouro', emoji: '🪙', custo: 0, x: 0, y: 0, requer: [], efeito: { chave: 'saqueGold', valor: 0.01 } },
    { id: 'r1a', nome: 'Bolsos Largos', emoji: '👛', custo: 5_000, x: 1, y: -1, requer: ['raiz'], efeito: { chave: 'saqueGold', valor: 0.02 } },
    { id: 'r1b', nome: 'Olho Vivo', emoji: '👁️', custo: 5_000, x: 1, y: 1, requer: ['raiz'], efeito: { chave: 'saqueDrop', valor: 0.02 } },
    { id: 'r2a', nome: 'Mão Leve', emoji: '🤲', custo: 15_000, x: 2, y: -1, requer: ['r1a'], efeito: { chave: 'saqueGold', valor: 0.03 } },
    { id: 'r2b', nome: 'Faro Aguçado', emoji: '👃', custo: 15_000, x: 2, y: 1, requer: ['r1b'], efeito: { chave: 'saqueDrop', valor: 0.02 } },
    { id: 'not1', nome: 'Bolso Fundo', emoji: '💰', custo: 60_000, x: 3, y: 0, requer: ['r2a', 'r2b'], efeito: { chave: 'saqueGold', valor: 0.08 } },
    { id: 'r3a', nome: 'Sorte do Viajante', emoji: '🍀', custo: 40_000, x: 4, y: -1, requer: ['not1'], efeito: { chave: 'saqueGold', valor: 0.03 } },
    { id: 'r3b', nome: 'Instinto de Caçador', emoji: '🎯', custo: 40_000, x: 4, y: 1, requer: ['not1'], efeito: { chave: 'saqueDrop', valor: 0.03 } },
    { id: 'r4a', nome: 'Punho Cheio', emoji: '👊', custo: 80_000, x: 5, y: -1, requer: ['r3a'], efeito: { chave: 'saqueGold', valor: 0.04 } },
    { id: 'r4b', nome: 'Vista de Águia', emoji: '🦅', custo: 80_000, x: 5, y: 1, requer: ['r3b'], efeito: { chave: 'saqueDrop', valor: 0.03 } },
    { id: 'not2', nome: 'Faro para Riqueza', emoji: '🧲', custo: 150_000, x: 6, y: 0, requer: ['r4a', 'r4b'], efeito: { chave: 'saqueDrop', valor: 0.06 } },
    { id: 'r5a', nome: 'Cofre Vivo', emoji: '🏺', custo: 120_000, x: 7, y: -1, requer: ['not2'], efeito: { chave: 'saqueGold', valor: 0.04 } },
    { id: 'r5b', nome: 'Trilha do Saque', emoji: '🐾', custo: 120_000, x: 7, y: 1, requer: ['not2'], efeito: { chave: 'saqueDrop', valor: 0.03 } },
    { id: 'r6a', nome: 'Mãos de Midas', emoji: '✋', custo: 200_000, x: 8, y: -1, requer: ['r5a'], efeito: { chave: 'saqueGold', valor: 0.05 } },
    { id: 'r6b', nome: 'Sexto Sentido', emoji: '🔮', custo: 200_000, x: 8, y: 1, requer: ['r5b'], efeito: { chave: 'saqueDrop', valor: 0.04 } },
    { id: 'capstone', nome: 'Rei Mercante', emoji: '👑', custo: 400_000, x: 9, y: 0, requer: ['r6a', 'r6b'], efeito: { chave: 'saqueGold', valor: 0.2 } },
  ],
  dano: [
    { id: 'raiz', nome: 'Fio da Lâmina', emoji: '⚔️', custo: 0, x: 0, y: 0, requer: [], efeito: { chave: 'danoExtra', valor: 0.01 } },
    { id: 'r1a', nome: 'Braço Forte', emoji: '💪', custo: 5_000, x: 1, y: -1, requer: ['raiz'], efeito: { chave: 'danoExtra', valor: 0.02 } },
    { id: 'r1b', nome: 'Olhar Frio', emoji: '🥶', custo: 5_000, x: 1, y: 1, requer: ['raiz'], efeito: { chave: 'critico', valor: 0.01 } },
    { id: 'r2a', nome: 'Golpe Certeiro', emoji: '🎯', custo: 15_000, x: 2, y: -1, requer: ['r1a'], efeito: { chave: 'danoExtra', valor: 0.02 } },
    { id: 'r2b', nome: 'Ponta Afiada', emoji: '🗡️', custo: 15_000, x: 2, y: 1, requer: ['r1b'], efeito: { chave: 'perfuracao', valor: 0.02 } },
    { id: 'not1', nome: 'Golpe Fatal', emoji: '💥', custo: 60_000, x: 3, y: 0, requer: ['r2a', 'r2b'], efeito: { chave: 'critico', valor: 0.05 } },
    { id: 'r3a', nome: 'Fúria Contida', emoji: '😤', custo: 40_000, x: 4, y: -1, requer: ['not1'], efeito: { chave: 'danoExtra', valor: 0.03 } },
    { id: 'r3b', nome: 'Corte Profundo', emoji: '🔪', custo: 40_000, x: 4, y: 1, requer: ['not1'], efeito: { chave: 'perfuracao', valor: 0.02 } },
    { id: 'r4a', nome: 'Músculos de Aço', emoji: '🦾', custo: 80_000, x: 5, y: -1, requer: ['r3a'], efeito: { chave: 'danoExtra', valor: 0.03 } },
    { id: 'r4b', nome: 'Reflexo Mortal', emoji: '⚡', custo: 80_000, x: 5, y: 1, requer: ['r3b'], efeito: { chave: 'critico', valor: 0.02 } },
    { id: 'not2', nome: 'Fúria de Batalha', emoji: '🔥', custo: 150_000, x: 6, y: 0, requer: ['r4a', 'r4b'], efeito: { chave: 'danoExtra', valor: 0.08 } },
    { id: 'r5a', nome: 'Lâmina Perfurante', emoji: '🔱', custo: 120_000, x: 7, y: -1, requer: ['not2'], efeito: { chave: 'perfuracao', valor: 0.03 } },
    { id: 'r5b', nome: 'Instinto Assassino', emoji: '🩸', custo: 120_000, x: 7, y: 1, requer: ['not2'], efeito: { chave: 'danoExtra', valor: 0.03 } },
    { id: 'r6a', nome: 'Golpe Preciso', emoji: '🏹', custo: 200_000, x: 8, y: -1, requer: ['r5a'], efeito: { chave: 'critico', valor: 0.03 } },
    { id: 'r6b', nome: 'Força Bruta', emoji: '🦍', custo: 200_000, x: 8, y: 1, requer: ['r5b'], efeito: { chave: 'danoExtra', valor: 0.04 } },
    { id: 'capstone', nome: 'Avatar da Guerra', emoji: '🌩️', custo: 400_000, x: 9, y: 0, requer: ['r6a', 'r6b'], efeito: { chave: 'danoExtra', valor: 0.2 } },
  ],
  xp: [
    { id: 'raiz', nome: 'Mente Curiosa', emoji: '📖', custo: 0, x: 0, y: 0, requer: [], efeito: { chave: 'xp', valor: 0.01 } },
    { id: 'r1a', nome: 'Aprendiz Aplicado', emoji: '✏️', custo: 5_000, x: 1, y: -1, requer: ['raiz'], efeito: { chave: 'xp', valor: 0.02 } },
    { id: 'r1b', nome: 'Memória Fresca', emoji: '🧠', custo: 5_000, x: 1, y: 1, requer: ['raiz'], efeito: { chave: 'xp', valor: 0.02 } },
    { id: 'r2a', nome: 'Foco Total', emoji: '🎯', custo: 15_000, x: 2, y: -1, requer: ['r1a'], efeito: { chave: 'xp', valor: 0.03 } },
    { id: 'r2b', nome: 'Estudo Constante', emoji: '📚', custo: 15_000, x: 2, y: 1, requer: ['r1b'], efeito: { chave: 'xp', valor: 0.02 } },
    { id: 'not1', nome: 'Mente Afiada', emoji: '🧩', custo: 60_000, x: 3, y: 0, requer: ['r2a', 'r2b'], efeito: { chave: 'xp', valor: 0.06 } },
    { id: 'r3a', nome: 'Reflexão Rápida', emoji: '💡', custo: 40_000, x: 4, y: -1, requer: ['not1'], efeito: { chave: 'xp', valor: 0.03 } },
    { id: 'r3b', nome: 'Prática Diária', emoji: '🏋️', custo: 40_000, x: 4, y: 1, requer: ['not1'], efeito: { chave: 'xp', valor: 0.03 } },
    { id: 'r4a', nome: 'Sabedoria Acumulada', emoji: '📜', custo: 80_000, x: 5, y: -1, requer: ['r3a'], efeito: { chave: 'xp', valor: 0.03 } },
    { id: 'r4b', nome: 'Visão Ampla', emoji: '👓', custo: 80_000, x: 5, y: 1, requer: ['r3b'], efeito: { chave: 'xp', valor: 0.04 } },
    { id: 'not2', nome: 'Memória Perfeita', emoji: '💎', custo: 150_000, x: 6, y: 0, requer: ['r4a', 'r4b'], efeito: { chave: 'xp', valor: 0.08 } },
    { id: 'r5a', nome: 'Intuição Aguçada', emoji: '✨', custo: 120_000, x: 7, y: -1, requer: ['not2'], efeito: { chave: 'xp', valor: 0.03 } },
    { id: 'r5b', nome: 'Concentração Máxima', emoji: '🧘', custo: 120_000, x: 7, y: 1, requer: ['not2'], efeito: { chave: 'xp', valor: 0.04 } },
    { id: 'r6a', nome: 'Mente Brilhante', emoji: '💫', custo: 200_000, x: 8, y: -1, requer: ['r5a'], efeito: { chave: 'xp', valor: 0.04 } },
    { id: 'r6b', nome: 'Sabedoria Ancestral', emoji: '🏛️', custo: 200_000, x: 8, y: 1, requer: ['r5b'], efeito: { chave: 'xp', valor: 0.05 } },
    { id: 'capstone', nome: 'Iluminação', emoji: '🌟', custo: 400_000, x: 9, y: 0, requer: ['r6a', 'r6b'], efeito: { chave: 'xp', valor: 0.2 } },
  ],
}

/** Chaves de efeito que entram no `hab` de combate — xp fica fora, ver bonusXpDeRunas. */
const EFEITOS_DE_COMBATE = new Set(['saqueGold', 'saqueDrop', 'danoExtra', 'critico', 'perfuracao'])

const ficha = (player) => (player.rpg.runas ??= { ouro: [], dano: [], xp: [] })

/** A raiz é sempre considerada comprada (custo 0) — não precisa entrar na lista salva. */
const estaComprada = (no, compradas) => no.custo === 0 || compradas.has(no.id)

/**
 * O conjunto de ids "comprados" pra fins de vizinhança: o que veio do save
 * mais toda raiz (custo 0) da árvore, que nunca é salva mas conta como dona.
 */
const conjuntoEfetivo = (lista, compradas) => {
  const efetivo = new Set(compradas)
  for (const no of lista) if (no.custo === 0) efetivo.add(no.id)
  return efetivo
}

/** Livre para comprar: ainda não é dona, e algum vizinho já é (efetivamente). */
const estaDisponivel = (no, efetivo) => !efetivo.has(no.id) && no.requer.some((id) => efetivo.has(id))

/** Todos os nós comprados do jogador, nas três árvores juntas. */
function nosComprados(player) {
  const runas = ficha(player)
  const nos = []
  for (const [arvore, lista] of Object.entries(ARVORES)) {
    const compradas = new Set(runas[arvore] ?? [])
    for (const no of lista) if (estaComprada(no, compradas)) nos.push(no)
  }
  return nos
}

/** Soma dos efeitos de combate (dano e ouro) de todas as runas compradas — entra em `hab`. */
export function efeitosDeRunas(player) {
  const soma = {}
  for (const no of nosComprados(player)) {
    if (!EFEITOS_DE_COMBATE.has(no.efeito.chave)) continue
    soma[no.efeito.chave] = (soma[no.efeito.chave] ?? 0) + no.efeito.valor
  }
  return soma
}

/** Fração extra de XP de todas as runas da árvore de XP compradas. */
export function bonusXpDeRunas(player) {
  let soma = 0
  for (const no of nosComprados(player)) if (no.efeito.chave === 'xp') soma += no.efeito.valor
  return soma
}

/** O catálogo das três árvores, já marcado com o que este jogador comprou e pode comprar. */
export function catalogoPara(player) {
  const runas = ficha(player)
  const saida = {}
  for (const [arvore, lista] of Object.entries(ARVORES)) {
    const compradas = new Set(runas[arvore] ?? [])
    const efetivo = conjuntoEfetivo(lista, compradas)
    saida[arvore] = lista.map((no) => ({
      ...no,
      comprada: estaComprada(no, compradas),
      disponivel: estaDisponivel(no, efetivo),
    }))
  }
  return saida
}

/** Compra uma runa: precisa existir, não ser dona ainda, ter vizinho comprado e ter o gold. */
export function comprarRuna(player, arvore, id) {
  const lista = ARVORES[arvore]
  if (!lista) return { erro: 'Essa árvore de runas não existe.' }

  const no = lista.find((n) => n.id === id)
  if (!no) return { erro: 'Essa runa não existe.' }

  const runas = ficha(player)
  const compradas = new Set(runas[arvore] ?? [])
  if (estaComprada(no, compradas)) return { erro: 'Você já tem essa runa.' }
  if (!estaDisponivel(no, conjuntoEfetivo(lista, compradas))) return { erro: 'Compre uma runa vizinha antes dessa.' }
  if (player.rpg.gold < no.custo) return { erro: `Faltam ${no.custo - player.rpg.gold} de gold.` }

  darGold(player, -no.custo)
  runas[arvore] = [...compradas, no.id]
  store.save()
  return { nome: no.nome, arvore, id: no.id }
}

/** Reinicia uma árvore inteira: as runas voltam a ficar disponíveis, mas o gold gasto não volta. */
export function resetarArvore(player, arvore) {
  if (!ARVORES[arvore]) return { erro: 'Essa árvore de runas não existe.' }

  const runas = ficha(player)
  if (!runas[arvore]?.length) return { erro: 'Essa árvore ainda não tem nenhuma runa comprada.' }

  runas[arvore] = []
  store.save()
  return { arvore }
}
