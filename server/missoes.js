/**
 * Missões diárias: três tarefas sorteadas por personagem, todo dia.
 *
 * O dia vira à meia-noite no fuso do jogo (tempo.js). A lista é gerada na
 * primeira vez que alguém olha ou faz algo no dia novo — não há agendador:
 * `garantirMissoes` compara a data guardada com a de hoje.
 *
 * Quem move o progresso é `registrar(player, tipo, quanto)`, chamado pelas
 * rotas no momento em que a coisa acontece (venceu uma caçada, desceu
 * andares, deu um lance...). Missão concluída avisa o navegador na hora;
 * a recompensa só entra quando a pessoa resgata, no painel.
 */
import { config } from './config.js'
import * as store from './store.js'
import { darGold, ganharXp, xpParaSubir } from './rpg/jogador.js'
import { xpComPrestigio } from './rpg/prestigio.js'
import { TITANITAS, darTitanita } from './rpg/ferreiro.js'
import { FEITICOS, darFeitico, sortearFeitico } from './rpg/feiticos.js'
import { emitirPara } from './realtime.js'
import { diaLocal, msAteVirarODia } from './tempo.js'

const milhar = (n) => Math.round(n).toLocaleString('pt-BR')

/**
 * O catálogo. `alvo` pode depender do nível; `nivelMinimo` tira do sorteio o
 * que o personagem ainda não consegue fazer (Abismo e masmorra abrem no 40).
 */
export const TIPOS_DE_MISSAO = {
  cacar: { emoji: '⚔️', peso: 5, alvo: () => 12, texto: (n) => `Vença ${n} caçadas` },
  elite: { emoji: '💀', peso: 4, alvo: () => 3, texto: (n) => `Derrote ${n} monstros de elite` },
  gold: {
    emoji: '💰',
    peso: 3,
    // Umas dez caçadas do nível.
    alvo: (nivel) => Math.round((8 + nivel * 4) * 10),
    texto: (n) => `Junte ${milhar(n)} de gold caçando`,
  },
  abismo: { emoji: '🕳️', peso: 3, nivelMinimo: 40, alvo: () => 5, texto: (n) => `Vença ${n} andares do Abismo` },
  masmorra: {
    emoji: '🏰',
    peso: 2,
    nivelMinimo: 40,
    alvo: () => 4,
    texto: (n) => `Vença ${n} andares na Masmorra em grupo`,
  },
  raid: { emoji: '🐲', peso: 2, alvo: () => 1, texto: () => 'Participe de uma raid' },
  evento: { emoji: '🔔', peso: 2, alvo: () => 1, texto: () => 'Atenda ao chamado de um evento' },
  pvp: { emoji: '🤺', peso: 2, alvo: () => 2, texto: (n) => `Vença ${n} duelos` },
  expedicao: { emoji: '🗺️', peso: 3, alvo: () => 1, texto: () => 'Volte de uma expedição' },
  reforco: { emoji: '⚒️', peso: 2, alvo: () => 1, texto: () => 'Reforce um item no ferreiro' },
  chefeMundial: { emoji: '👹', peso: 2, alvo: () => 2, texto: (n) => `Ataque o Chefe Mundial ${n} vezes` },
  leilao: { emoji: '⚖️', peso: 2, alvo: () => 1, texto: () => 'Dê um lance ou anuncie algo na Casa de Leilões' },
}

/** A titanita que combina com o nível: a que o ferreiro pede para as peças dele. */
function grauDoNivel(nivel) {
  if (nivel < 50) return 'estilhaco'
  if (nivel < 100) return 'grande'
  if (nivel < 180) return 'pedaco'
  return 'placa'
}

function sortearTipos(nivel, quantos) {
  const elegiveis = Object.entries(TIPOS_DE_MISSAO).filter(([, t]) => nivel >= (t.nivelMinimo ?? 1))
  const escolhidos = []
  while (escolhidos.length < quantos && elegiveis.length) {
    const total = elegiveis.reduce((s, [, t]) => s + t.peso, 0)
    let ponto = Math.random() * total
    const i = elegiveis.findIndex(([, t]) => (ponto -= t.peso) <= 0)
    escolhidos.push(elegiveis.splice(i === -1 ? 0 : i, 1)[0][0])
  }
  return escolhidos
}

/** Gera a lista do dia se ainda não existe. Devolve o bloco `missoes` da ficha. */
export function garantirMissoes(player) {
  const ficha = player.rpg
  const hoje = diaLocal()
  if (ficha.missoes?.dia === hoje && ficha.missoes.lista?.length) return ficha.missoes

  ficha.missoes = {
    dia: hoje,
    bauResgatado: false,
    lista: sortearTipos(ficha.nivel, config.rpg.missoes.porDia).map((tipo, i) => ({
      id: `${hoje}-${i}`,
      tipo,
      alvo: TIPOS_DE_MISSAO[tipo].alvo(ficha.nivel),
      progresso: 0,
      resgatada: false,
    })),
  }
  store.save()
  return ficha.missoes
}

const concluida = (m) => m.progresso >= m.alvo

/** O que uma missão paga, no nível atual. */
function recompensaDaMissao(player) {
  const nivel = player.rpg.nivel
  const m = config.rpg.missoes
  return {
    gold: Math.round(m.goldBase + nivel * m.goldPorNivel),
    xp: xpComPrestigio(player, Math.round(xpParaSubir(nivel) * m.fracaoDoNivelEmXp)),
    titanita: { grau: grauDoNivel(nivel), quantidade: 2 },
  }
}

export function verMissao(player, m) {
  const tipo = TIPOS_DE_MISSAO[m.tipo]
  return {
    id: m.id,
    tipo: m.tipo,
    emoji: tipo?.emoji ?? '📋',
    texto: tipo?.texto(m.alvo) ?? m.tipo,
    alvo: m.alvo,
    progresso: Math.min(m.progresso, m.alvo),
    concluida: concluida(m),
    resgatada: m.resgatada,
  }
}

export function verMissoes(player) {
  const bloco = garantirMissoes(player)
  const r = recompensaDaMissao(player)
  const todas = bloco.lista.every((m) => m.resgatada)

  return {
    dia: bloco.dia,
    viraEm: msAteVirarODia(),
    lista: bloco.lista.map((m) => verMissao(player, m)),
    recompensa: {
      gold: r.gold,
      xp: r.xp,
      titanita: { ...r.titanita, nome: TITANITAS[r.titanita.grau].nome, emoji: TITANITAS[r.titanita.grau].emoji },
    },
    bau: {
      disponivel: todas && !bloco.bauResgatado,
      resgatado: bloco.bauResgatado,
      gold: r.gold * config.rpg.missoes.bauMultiplicadorDeGold,
    },
  }
}

/** Resumo curto para o menu: quantas estão prontas para resgatar. */
export function resumoDasMissoes(player) {
  const bloco = garantirMissoes(player)
  const prontas = bloco.lista.filter((m) => concluida(m) && !m.resgatada).length
  const feitas = bloco.lista.filter((m) => m.resgatada).length
  const bau = bloco.lista.every((m) => m.resgatada) && !bloco.bauResgatado
  return { prontas: prontas + (bau ? 1 : 0), feitas, total: bloco.lista.length }
}

/**
 * Soma progresso nas missões do tipo. Silencioso se o personagem não tem
 * missão daquele tipo hoje — que é o caso mais comum.
 */
export function registrar(player, tipo, quanto = 1) {
  if (!player?.rpg?.classe || !(quanto > 0)) return
  const bloco = garantirMissoes(player)

  for (const m of bloco.lista) {
    if (m.tipo !== tipo || concluida(m)) continue
    m.progresso = Math.min(m.alvo, m.progresso + quanto)
    store.save()
    if (concluida(m)) emitirPara(player.id, 'missao:concluida', { missao: verMissao(player, m) })
  }
}

export function resgatar(player, id) {
  const bloco = garantirMissoes(player)
  const m = bloco.lista.find((x) => x.id === String(id))
  if (!m) return { erro: 'Essa missão não é de hoje.' }
  if (m.resgatada) return { erro: 'Essa recompensa já foi resgatada.' }
  if (!concluida(m)) return { erro: 'A missão ainda não terminou.' }

  const r = recompensaDaMissao(player)
  m.resgatada = true
  darGold(player, r.gold)
  const subiu = ganharXp(player, r.xp)
  darTitanita(player, r.titanita.grau, r.titanita.quantidade)
  store.save()

  return {
    recompensa: { ...r, titanita: { ...r.titanita, nome: TITANITAS[r.titanita.grau].nome } },
    subiu,
  }
}

/** O baú de quem fechou as três: gold em dobro, titanita e um feitiço garantido. */
export function abrirBau(player) {
  const bloco = garantirMissoes(player)
  if (bloco.bauResgatado) return { erro: 'O baú de hoje já foi aberto.' }
  if (!bloco.lista.every((m) => m.resgatada)) return { erro: 'Resgate as três missões do dia primeiro.' }

  const r = recompensaDaMissao(player)
  const gold = r.gold * config.rpg.missoes.bauMultiplicadorDeGold
  const grau = grauDoNivel(player.rpg.nivel)
  bloco.bauResgatado = true
  darGold(player, gold)
  darTitanita(player, grau, 3)
  const feitico = sortearFeitico(player.rpg.nivel)
  if (feitico) darFeitico(player, feitico)
  store.save()

  return {
    gold,
    titanita: { grau, quantidade: 3, nome: TITANITAS[grau].nome },
    feitico: feitico ? { id: feitico, nome: FEITICOS[feitico].nome, emoji: FEITICOS[feitico].emoji } : null,
  }
}
