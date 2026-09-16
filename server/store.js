/**
 * O deposito de personagens, e a peca que deixa o motor do bot rodar aqui
 * sem uma linha alterada.
 *
 * O motor portado (server/rpg/*) so conhece duas coisas deste modulo:
 *   store.save()        — "mudei alguma coisa, grave quando puder"
 *   store.allPlayers()  — a lista inteira, para os rankings
 *
 * Entao e isso que ele encontra. Todos os personagens vivem em memoria (sao
 * poucos KB cada) e o SQLite e so a copia durável: `save()` agenda uma
 * gravacao com debounce, igual ao bot original, e so as fichas que mudaram
 * de verdade viram UPDATE.
 *
 * O objeto `player` tem exatamente o formato que o motor espera:
 *   { id, name, rpg: { ... } }
 * — os campos de chat, aposta e Pokemon do bot nao existem aqui.
 */
import { randomUUID } from 'node:crypto'
import { db, fecharBanco } from './db.js'
import { config } from './config.js'

/** id do personagem -> objeto vivo */
const personagens = new Map()
/** id do personagem -> JSON da ultima gravacao (para so gravar o que mudou) */
const gravado = new Map()

/**
 * Classes que sairam do jogo e para onde o personagem vai. O gancho existe
 * porque arvore de classe muda: quando o "Pistoleiro" virou "Guardiao", as
 * fichas antigas foram convertidas na primeira leitura, sem script nenhum.
 */
const CLASSES_RENOMEADAS = { pistoleiro: 'guardiao' }

/** A ficha de RPG zerada. É tambem o gabarito da migracao. */
export function fichaNova() {
  return {
    classe: null,
    nivel: 1,
    xp: 0,
    gold: 0,
    hp: null, // null = vida cheia
    hpEm: 0,
    feridoAte: 0,
    fogueiraAte: 0,
    bossPendente: 0,
    bossesVencidos: [],
    inventario: [],
    equipado: { arma: null, secundario: null, elmo: null, armadura: null, anel: null },
    lojaOferta: { item: null, expiraEm: 0 },
    expedicao: { tipo: null, terminaEm: 0 },
    raid: { vitorias: 0, derrotas: 0, ultimaRaid: 0 },
    evolucao: { esperaAte: 0, tentativas: 0, evoluiuEm: 0 },
    titanitas: { estilhaco: 0, grande: 0, pedaco: 0, placa: 0 },
    feiticos: {},
    abismo: { melhorAndar: 0, descidas: 0, andaresTotais: 0, ultimaDescida: 0 },
    pvp: {
      pontos: config.rpg.pvp.pontosIniciais,
      vitorias: 0,
      derrotas: 0,
      sequencia: 0,
      melhorSequencia: 0,
      goldGanho: 0,
      ultimoDuelo: 0,
    },
    ultimaLuta: 0,
    provaAte: 0,
    // Quantas vezes este personagem ja recomecou do nivel 1 (rpg/prestigio.js)
    prestigio: 0,
    prestigioEm: 0,
    vitorias: 0,
    derrotas: 0,
  }
}

/**
 * Funde a ficha lida com uma em branco. Campo novo acrescentado depois
 * aparece preenchido com o padrao, sem script de migracao e sem `undefined`
 * vazando para o calculo.
 */
function migrar(rpg = {}) {
  const base = fichaNova()
  const classe = CLASSES_RENOMEADAS[rpg.classe] ?? rpg.classe ?? null

  return {
    ...base,
    ...rpg,
    classe,
    equipado: { ...base.equipado, ...rpg.equipado },
    inventario: rpg.inventario ?? [],
    bossesVencidos: rpg.bossesVencidos ?? [],
    lojaOferta: { ...base.lojaOferta, ...rpg.lojaOferta },
    expedicao: { ...base.expedicao, ...rpg.expedicao },
    raid: { ...base.raid, ...rpg.raid },
    evolucao: { ...base.evolucao, ...rpg.evolucao },
    titanitas: { ...base.titanitas, ...rpg.titanitas },
    feiticos: { ...base.feiticos, ...rpg.feiticos },
    abismo: { ...base.abismo, ...rpg.abismo },
    pvp: { ...base.pvp, ...rpg.pvp },
  }
}

function carregar() {
  const linhas = db.prepare('SELECT * FROM personagens').all()
  for (const linha of linhas) {
    let rpg = {}
    try {
      rpg = JSON.parse(linha.dados)
    } catch (err) {
      console.error(`[erro] ficha ilegivel de ${linha.nome} (${err.message}); recomecando do zero`)
    }

    const player = {
      id: linha.id,
      usuarioId: linha.usuario_id,
      name: linha.nome,
      criadoEm: linha.criado_em,
      jogadoEm: linha.jogado_em,
      rpg: migrar(rpg),
    }

    personagens.set(player.id, player)
    gravado.set(player.id, JSON.stringify(player.rpg))
  }
  console.log(`[dados] ${personagens.size} personagem(ns) carregado(s)`)
}

// ---------------------------------------------------------------- gravacao

const gravarFicha = db.prepare('UPDATE personagens SET dados = ?, jogado_em = ? WHERE id = ?')

let timerDeGravacao = null

function gravarAgora() {
  timerDeGravacao = null
  const mudaram = []

  for (const player of personagens.values()) {
    const json = JSON.stringify(player.rpg)
    if (gravado.get(player.id) === json) continue
    mudaram.push([json, player.jogadoEm || Date.now(), player.id])
    gravado.set(player.id, json)
  }

  if (!mudaram.length) return

  const transacao = db.transaction((linhas) => {
    for (const linha of linhas) gravarFicha.run(...linha)
  })

  try {
    transacao(mudaram)
  } catch (err) {
    console.error('[erro] nao consegui gravar as fichas:', err.message)
    // Deixa as fichas marcadas como sujas para a proxima tentativa.
    for (const [, , id] of mudaram) gravado.delete(id)
  }
}

/**
 * Agenda a gravacao. Varias alteracoes seguidas (o que uma caçada faz: vida,
 * XP, gold, drop, titanita) viram uma escrita so.
 */
export function save() {
  if (timerDeGravacao) return
  timerDeGravacao = setTimeout(gravarAgora, 400)
}

/** Grava na hora. Chamado no fim de toda rota que altera alguma coisa. */
export function flush() {
  if (timerDeGravacao) {
    clearTimeout(timerDeGravacao)
    timerDeGravacao = null
  }
  gravarAgora()
}

/** Todos os personagens do servidor. É o que os rankings usam. */
export function allPlayers() {
  return [...personagens.values()]
}

// ------------------------------------------------------------ personagens

export const buscarPersonagem = (id) => personagens.get(id) ?? null

export const personagensDoUsuario = (usuarioId) =>
  allPlayers()
    .filter((p) => p.usuarioId === usuarioId)
    .sort((a, b) => a.criadoEm - b.criadoEm)

export const nomeEstaLivre = (nome) =>
  !db.prepare('SELECT 1 FROM personagens WHERE nome = ?').get(nome)

export function criarPersonagem(usuarioId, nome) {
  const player = {
    id: randomUUID(),
    usuarioId,
    name: nome,
    criadoEm: Date.now(),
    jogadoEm: Date.now(),
    rpg: fichaNova(),
  }

  db.prepare(
    'INSERT INTO personagens (id, usuario_id, nome, dados, criado_em, jogado_em) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(player.id, usuarioId, nome, JSON.stringify(player.rpg), player.criadoEm, player.jogadoEm)

  personagens.set(player.id, player)
  gravado.set(player.id, JSON.stringify(player.rpg))
  return player
}

export function apagarPersonagem(id) {
  db.prepare('DELETE FROM personagens WHERE id = ?').run(id)
  personagens.delete(id)
  gravado.delete(id)
}

/** Marca que o personagem acabou de ser usado (ordena a tela de selecao). */
export function tocar(player) {
  player.jogadoEm = Date.now()
  save()
}

carregar()

// Grava o pendente e só então fecha o banco, nessa ordem.
process.on('exit', () => {
  flush()
  fecharBanco()
})
process.on('SIGINT', () => {
  flush()
  process.exit(0)
})
process.on('SIGTERM', () => {
  flush()
  process.exit(0)
})
