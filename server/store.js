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

/**
 * Tipos de item que mudaram de id depois de o jogo ja estar rodando.
 *
 * Mesma ideia das classes renomeadas, um degrau abaixo: o item guardado
 * carrega o `tipo` e o `nome` de quando caiu, entao renomear uma arma em
 * rpg/itens.js nao basta — o tambor de nivel 40 de alguem continuaria se
 * chamando Tambor e apontando para um tipo que nao existe mais, e nenhuma
 * classe sabe usar o que nao esta em TIPOS.
 *
 * A tabela se basta de proposito (nao importa TIPOS): store.js e carregado
 * por rpg/feiticos.js, e depender de rpg/itens.js aqui fecharia um ciclo bem
 * no caminho de carregar().
 */
const TIPOS_DE_ITEM_RENOMEADOS = {
  tambor: { tipo: 'banjo', de: 'Tambor', para: 'Banjo' },
}

/**
 * Tipos de item que sairam do jogo. Pocao e bandagem administravam a vida
 * ENTRE duas lutas, e entre duas lutas nao ha mais o que administrar: a fase
 * comeca sempre com a vida cheia (ver rpg/jogador.js). Quem tinha alguma
 * guardada simplesmente nao a encontra mais na mochila.
 */
const TIPOS_DE_ITEM_APOSENTADOS = new Set(['pocao', 'bandagem'])

/** Se este item ainda existe no jogo. */
export const itemAposentado = (item) => TIPOS_DE_ITEM_APOSENTADOS.has(item?.tipo)

/**
 * Poe um item guardado no formato de hoje. Devolve o proprio item — vale
 * tambem para os que estao fora da mochila (leiloes, entregas).
 */
export function migrarItem(item) {
  const troca = TIPOS_DE_ITEM_RENOMEADOS[item?.tipo]
  if (!troca) return item

  item.tipo = troca.tipo
  // O nome e "<Tipo> <material>": troca so a primeira parte, para o material
  // sorteado la atras continuar sendo o que era.
  if (typeof item.nome === 'string' && item.nome.startsWith(troca.de)) {
    item.nome = troca.para + item.nome.slice(troca.de.length)
  }

  return item
}

/** A ficha de RPG zerada. É tambem o gabarito da migracao. */
export function fichaNova() {
  return {
    classe: null,
    nivel: 1,
    xp: 0,
    gold: 0,
    // Onde o personagem esta na rota (rpg/rota.js) e o que ele ja venceu.
    // `repetindo` = o avanco automatico esta desligado porque ele caiu;
    // `travada` = a fase em que caiu, que e para onde o botao "ir para a
    // proxima fase" o manda de volta.
    cacada: {
      ato: 1,
      fase: 1,
      repetindo: false,
      travada: null,
      maiorAto: 0,
      maiorFase: 0,
      vitorias: 0,
      derrotas: 0,
      ultimaFaseEm: 0,
    },
    inventario: [],
    // O bau (server/rpg/bau.js): itens guardados fora da mochila. Os espacos
    // comprados somam ao que config.rpg.bau.espacos ja da de graca.
    bau: { itens: [], espacosComprados: 0 },
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
    provaAte: 0,
    // Quantas vezes este personagem ja recomecou do nivel 1 (rpg/prestigio.js)
    prestigio: 0,
    prestigioEm: 0,
    // Missoes do dia (server/missoes.js). `dia` e a chave: dia novo, lista nova.
    missoes: { dia: '', lista: [], bauResgatado: false },
    // Masmorra em grupo (server/masmorra.js)
    masmorra: { ultimaDescida: 0, melhorAndar: 0, descidas: 0 },
    // Quando a foto foi enviada (server/fotos.js); 0 = sem foto. Entra no
    // endereço da imagem para o navegador saber que ela mudou.
    foto: 0,
    vitorias: 0,
    derrotas: 0,
  }
}

/**
 * Funde a ficha lida com uma em branco. Campo novo acrescentado depois
 * aparece preenchido com o padrao, sem script de migracao e sem `undefined`
 * vazando para o calculo.
 */
const CAMPOS_APOSENTADOS = [
  // A vida deixou de ser guardada: fora de combate ela e sempre cheia.
  'hp',
  'hpEm',
  'feridoAte',
  'fogueiraAte',
  // Os marcos de nivel viraram os chefes de ato (rpg/rota.js).
  'bossPendente',
  'bossesVencidos',
  'ultimaLuta',
]

function migrar(rpg = {}) {
  const base = fichaNova()
  const classe = CLASSES_RENOMEADAS[rpg.classe] ?? rpg.classe ?? null
  for (const campo of CAMPOS_APOSENTADOS) delete rpg[campo]

  return {
    ...base,
    ...rpg,
    classe,
    equipado: { ...base.equipado, ...rpg.equipado },
    // Os itens aposentados somem na leitura: e a mesma ideia das classes
    // renomeadas, so que sem para onde converter.
    inventario: (rpg.inventario ?? []).filter((i) => !itemAposentado(i)).map(migrarItem),
    bau: {
      ...base.bau,
      ...rpg.bau,
      itens: (rpg.bau?.itens ?? []).filter((i) => !itemAposentado(i)).map(migrarItem),
    },
    cacada: { ...base.cacada, ...rpg.cacada },
    // A oferta do dia tambem guarda um item inteiro, e ele fica de pe por
    // minutos depois de um reinicio: passa pela mesma conversao.
    lojaOferta: {
      ...base.lojaOferta,
      ...rpg.lojaOferta,
      item:
        rpg.lojaOferta?.item && !itemAposentado(rpg.lojaOferta.item)
          ? migrarItem(rpg.lojaOferta.item)
          : null,
    },
    expedicao: { ...base.expedicao, ...rpg.expedicao },
    raid: { ...base.raid, ...rpg.raid },
    evolucao: { ...base.evolucao, ...rpg.evolucao },
    titanitas: { ...base.titanitas, ...rpg.titanitas },
    feiticos: { ...base.feiticos, ...rpg.feiticos },
    abismo: { ...base.abismo, ...rpg.abismo },
    pvp: { ...base.pvp, ...rpg.pvp },
    missoes: { ...base.missoes, ...rpg.missoes },
    masmorra: { ...base.masmorra, ...rpg.masmorra },
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
