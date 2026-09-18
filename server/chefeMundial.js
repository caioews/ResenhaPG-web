/**
 * Chefe mundial: um por dia, com a vida compartilhada pelo servidor inteiro.
 *
 * Aparece numa hora sorteada entre config.rpg.chefeMundial.horaInicio e
 * horaFim (fuso do jogo) e fica `duracaoHoras` no ar. Cada jogador ataca
 * quando quiser, com uma espera entre um ataque e outro.
 *
 * Cada ataque é uma investida contra uma PROJEÇÃO do chefe no nível de quem
 * ataca, e o dano conta em "unidades": a vida de um monstro comum daquele
 * nível. É o que deixa um nível 20 e um nível 220 contribuírem na mesma
 * régua — cada um apanha e bate na própria faixa. Cair só encerra a
 * investida; ninguém sai ferido de um ataque ao chefe mundial.
 *
 * A vida total é proporcional às contas ativas nos últimos dias. Quando
 * zera, o espólio sai para todo mundo que bateu, na proporção do dano. Se o
 * tempo acabar antes, o chefe foge e o espólio sai pela metade.
 *
 * O estado mora no banco (tabela `estado`): o chefe fica horas no ar, e um
 * reinício do servidor no meio não pode zerar a vida nem as contribuições.
 */
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { db } from './db.js'
import * as store from './store.js'
import { lutar } from './rpg/combate.js'
import { comoLutador } from './rpg/encontro.js'
import { atributosDeMonstro } from './rpg/monstros.js'
import { atributos, darGold, feridoRestante, ganharXp } from './rpg/jogador.js'
import { emExpedicao } from './rpg/expedicao.js'
import { criarItem, tiposDaClasse } from './rpg/itens.js'
import { TITANITAS, darTitanita, sortearTitanita } from './rpg/ferreiro.js'
import { FEITICOS, darFeitico, sortearFeitico } from './rpg/feiticos.js'
import { xpComPrestigio } from './rpg/prestigio.js'
import { guardarOuEntregar } from './entregas.js'
import { registrar } from './missoes.js'
import { anunciar, emitirPara, emitirParaTodos } from './realtime.js'
import { diaLocal, horaLocal } from './tempo.js'
import { verItem } from './visao.js'

const cfg = () => config.rpg.chefeMundial

export const CHEFES_MUNDIAIS = {
  kraken: {
    nome: 'Kraken do Lago Velho',
    emoji: '🦑',
    chamada: 'O lago velho de Valkhar ferveu: o Kraken subiu!',
    descricao: 'Tentáculos do tamanho de torres batem na margem. Sozinho, ninguém derruba — mas cada golpe conta.',
  },
  reiSemCoroa: {
    nome: 'O Rei Sem Coroa',
    emoji: '👑',
    chamada: 'O Rei Sem Coroa voltou para reclamar o trono das ruínas!',
    descricao: 'Um rei morto que não aceitou o fim. A armadura dele é de antes da cidade existir.',
  },
  gorgona: {
    nome: 'Górgona Ancestral',
    emoji: '🐍',
    chamada: 'A Górgona Ancestral acordou debaixo do templo em ruínas!',
    descricao: 'Quem olha demais vira estátua. Quem olha de menos não acerta.',
  },
  colosso: {
    nome: 'Colosso das Areias',
    emoji: '🗿',
    chamada: 'O Colosso das Areias está marchando em direção a Valkhar!',
    descricao: 'Pedra que anda. Cada passo racha o chão, cada golpe dele derruba muralha.',
  },
  wyrm: {
    nome: 'Wyrm Eterno',
    emoji: '🐉',
    chamada: 'O Wyrm Eterno pousou sobre as ruínas!',
    descricao: 'O mais velho dos dragões. Não voa mais — não precisa.',
  },
}

// ------------------------------------------------------------------ estado

const lerEstado = db.prepare('SELECT valor FROM estado WHERE chave = ?')
const gravarEstado = db.prepare(
  'INSERT INTO estado (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
)

const ler = (chave) => {
  const linha = lerEstado.get(chave)
  return linha ? JSON.parse(linha.valor) : null
}
const gravar = (chave, valor) => gravarEstado.run(chave, JSON.stringify(valor))

let atual = ler('chefeMundial')

const salvar = () => gravar('chefeMundial', atual)

const ativo = () => atual?.estado === 'ativo'

// ------------------------------------------------------------------ contas

/** Vida de um monstro comum do nível: a régua das "unidades". */
const vidaDeReferencia = (nivel) => atributosDeMonstro(nivel, { hp: 1, atq: 1, def: 1, agi: 1 }).hp

/** Contas (não personagens) que jogaram nos últimos dias. */
function contasAtivas() {
  const desde = Date.now() - cfg().diasParaContarAtivo * 86_400_000
  const contas = new Set(
    store
      .allPlayers()
      .filter((p) => p.rpg.classe && (p.jogadoEm ?? 0) >= desde)
      .map((p) => p.usuarioId),
  )
  return contas.size
}

/** A recompensa cheia de uma raid no nível do jogador — a base do espólio. */
function recompensaBase(nivel) {
  const r = config.rpg.raid
  return { xp: r.xpBase + nivel * r.xpPorNivel, gold: r.goldBase + nivel * r.goldPorNivel }
}

// ------------------------------------------------------------------ visão

export function verChefe(player = null) {
  const def = atual ? CHEFES_MUNDIAIS[atual.chave] : null
  const lista = atual
    ? Object.entries(atual.contribuicoes)
        .map(([id, c]) => ({ id, ...c }))
        .sort((a, b) => b.unidades - a.unidades)
    : []
  const total = lista.reduce((s, c) => s + c.unidades, 0) || 1
  const meu = player && atual ? atual.contribuicoes[player.id] : null
  const espera = meu
    ? Math.max(0, meu.ultimoAtaque + cfg().esperaEntreAtaquesMinutos * 60_000 - Date.now())
    : 0

  return {
    ativo: ativo(),
    estado: atual?.estado ?? null,
    chefe: def ? { chave: atual.chave, nome: def.nome, emoji: def.emoji, chamada: def.chamada, descricao: def.descricao } : null,
    vida: atual ? Math.max(0, atual.vida) : 0,
    vidaMax: atual?.vidaMax ?? 0,
    criadoEm: atual?.criadoEm ?? 0,
    terminaEm: atual?.terminaEm ?? 0,
    fechadoEm: atual?.fechadoEm ?? 0,
    golpeFinal: atual?.golpeFinal ?? null,
    ranking: lista.slice(0, 10).map((c, i) => ({
      posicao: i + 1,
      id: c.id,
      nome: c.nome,
      unidades: Math.round(c.unidades * 10) / 10,
      fracao: c.unidades / total,
      ataques: c.ataques,
    })),
    participantes: lista.length,
    eu: meu
      ? { unidades: Math.round(meu.unidades * 10) / 10, fracao: meu.unidades / total, ataques: meu.ataques, espera }
      : { unidades: 0, fracao: 0, ataques: 0, espera: 0 },
    janela: { horaInicio: cfg().horaInicio, horaFim: cfg().horaFim, duracaoHoras: cfg().duracaoHoras },
    esperaEntreAtaquesMinutos: cfg().esperaEntreAtaquesMinutos,
  }
}

// ------------------------------------------------------------------ surgir

export function surgir(chave = null) {
  if (ativo()) return { erro: 'Já tem um chefe mundial no ar.' }
  const chaves = Object.keys(CHEFES_MUNDIAIS)
  const escolhida = chave && CHEFES_MUNDIAIS[chave] ? chave : chaves[Math.floor(Math.random() * chaves.length)]
  const vidaMax = Math.max(cfg().unidadesMinimas, cfg().unidadesPorJogador * contasAtivas())

  atual = {
    id: randomUUID().slice(0, 8),
    chave: escolhida,
    criadoEm: Date.now(),
    terminaEm: Date.now() + cfg().duracaoHoras * 3_600_000,
    vidaMax,
    vida: vidaMax,
    contribuicoes: {},
    estado: 'ativo',
    golpeFinal: null,
    fechadoEm: 0,
  }
  salvar()

  const def = CHEFES_MUNDIAIS[escolhida]
  anunciar(`${def.emoji} ${def.chamada} Ele fica ${cfg().duracaoHoras}h — todo golpe conta.`)
  emitirParaTodos('chefeMundial:surgiu', { chefe: verChefe() })
  console.log(`[chefe mundial] ${def.nome} surgiu com ${vidaMax} unidades de vida`)
  return { chefe: verChefe() }
}

// ------------------------------------------------------------------ atacar

export function impedimentoDeAtaque(player) {
  if (!ativo()) return 'Não tem chefe mundial no ar agora.'
  if (!player.rpg.classe) return 'Esse personagem ainda não tem classe.'
  if (emExpedicao(player)) return 'Seu personagem está em expedição.'
  if (feridoRestante(player) > 0) return 'Você está ferido. Cure-se antes de encarar o chefe.'
  const meu = atual.contribuicoes[player.id]
  const espera = meu ? meu.ultimoAtaque + cfg().esperaEntreAtaquesMinutos * 60_000 - Date.now() : 0
  if (espera > 0) return `Recupere o fôlego: próximo ataque em ${Math.ceil(espera / 60_000)} min.`
  return null
}

export function atacar(player) {
  const erro = impedimentoDeAtaque(player)
  if (erro) return { erro }

  const def = CHEFES_MUNDIAIS[atual.chave]
  const nivel = player.rpg.nivel
  const p = cfg().projecao

  // Entra inteiro e sai como entrou: a investida não mexe na vida da ficha.
  const eu = comoLutador(player, 'Você')
  eu.hp = atributos(player).hp
  eu.hpMax = eu.hp

  const projecao = {
    nome: `${def.emoji} ${def.nome}`,
    nivel,
    ...atributosDeMonstro(nivel, { hp: p.escudo, atq: p.atq, def: p.def, agi: p.agi }),
  }
  const luta = lutar(eu, projecao)
  const dano = projecao.hp - Math.max(0, luta.hpB)
  const unidades = Math.round((dano / vidaDeReferencia(nivel)) * 100) / 100

  const c = (atual.contribuicoes[player.id] ??= { nome: player.name, unidades: 0, ataques: 0, ultimoAtaque: 0 })
  c.nome = player.name
  c.unidades += unidades
  c.ataques++
  c.ultimoAtaque = Date.now()
  atual.vida = Math.max(0, atual.vida - unidades)

  const derrubou = atual.vida <= 0
  if (derrubou) atual.golpeFinal = player.name
  salvar()

  registrar(player, 'chefeMundial')
  emitirParaTodos('chefeMundial:atualizou', { chefe: verChefe() })

  const resultado = {
    investida: {
      chefe: { nome: def.nome, emoji: def.emoji, nivel, hpMax: projecao.hp },
      hpInicial: eu.hp,
      hpMax: eu.hpMax,
      log: luta.log,
      caiu: luta.vencedor === 'b' && !luta.porDecisao,
      quebrouOEscudo: luta.vencedor === 'a',
      dano,
      unidades,
      derrubou,
    },
  }

  if (derrubou) encerrar('derrotado')
  return resultado
}

// ------------------------------------------------------------------ fim

/** Reparte o espólio e fecha o chefe. `como` = 'derrotado' | 'fugiu'. */
export function encerrar(como = 'fugiu') {
  if (!ativo()) return { erro: 'Não tem chefe mundial no ar.' }
  const def = CHEFES_MUNDIAIS[atual.chave]
  atual.estado = como
  atual.fechadoEm = Date.now()
  salvar()

  const lista = Object.entries(atual.contribuicoes)
    .map(([id, c]) => ({ id, ...c, player: store.buscarPersonagem(id) }))
    .filter((c) => c.player && c.unidades > 0)
    .sort((a, b) => b.unidades - a.unidades)
  const total = lista.reduce((s, c) => s + c.unidades, 0) || 1
  const fator = como === 'derrotado' ? 1 : cfg().recompensa.seFugir

  lista.forEach((c, i) => {
    const p = c.player
    const fracao = c.unidades / total
    const mult = (cfg().recompensa.base + cfg().recompensa.porFracao * fracao) * fator
    const base = recompensaBase(p.rpg.nivel)
    const xp = xpComPrestigio(p, Math.round(base.xp * mult))
    const gold = Math.round(base.gold * mult)
    darGold(p, gold)
    const subiu = ganharXp(p, xp)

    // Item: o primeiro leva o melhor; do segundo ao terceiro, épico; quem
    // passou da fração mínima, raro. Se fugiu, só o primeiro leva, e raro.
    let raridade = null
    if (como === 'derrotado') {
      if (i === 0) raridade = 'lendario'
      else if (i <= 2) raridade = 'epico'
      else if (fracao >= cfg().fracaoParaItem) raridade = 'raro'
    } else if (i === 0) {
      raridade = 'raro'
    }

    let item = null
    let onde = null
    if (raridade) {
      const tipos = tiposDaClasse(p.rpg.classe)
      item = criarItem(tipos[Math.floor(Math.random() * tipos.length)], p.rpg.nivel, raridade)
      onde = guardarOuEntregar(p, item, `Espólio: ${def.nome}`)
    }

    const titanita = sortearTitanita('raid')
    if (titanita) darTitanita(p, titanita.grau, titanita.quantidade)
    let feitico = null
    if (como === 'derrotado' && Math.random() < 0.5) {
      feitico = sortearFeitico(p.rpg.nivel)
      if (feitico) darFeitico(p, feitico)
    }

    emitirPara(p.id, 'chefeMundial:recompensa', {
      como,
      chefe: { nome: def.nome, emoji: def.emoji },
      posicao: i + 1,
      fracao,
      xp,
      gold,
      subiu,
      item: item ? verItem(item) : null,
      onde,
      titanita: titanita ? { ...titanita, nome: TITANITAS[titanita.grau].nome } : null,
      feitico: feitico ? { nome: FEITICOS[feitico].nome, emoji: FEITICOS[feitico].emoji } : null,
    })
  })
  store.flush()

  const topo = lista[0]
  anunciar(
    como === 'derrotado'
      ? `${def.emoji} ${def.nome} caiu! ${lista.length} aventureiro(s) bateram; golpe final de ${atual.golpeFinal}${topo ? `, maior dano de ${topo.nome}` : ''}.`
      : `${def.emoji} ${def.nome} fugiu com ${Math.round((atual.vida / atual.vidaMax) * 100)}% da vida. Quem bateu leva metade do espólio.`,
  )
  emitirParaTodos('chefeMundial:fim', { chefe: verChefe() })
  console.log(`[chefe mundial] ${def.nome} ${como}`)
  return { chefe: verChefe() }
}

// ------------------------------------------------------------------ agenda

/** A hora de hoje em que o chefe aparece, sorteada uma vez por dia. */
function agendaDeHoje() {
  const hoje = diaLocal()
  let agenda = ler('chefeMundial:agenda')
  if (agenda?.dia !== hoje) {
    const { horaInicio, horaFim } = cfg()
    agenda = { dia: hoje, hora: horaInicio + Math.random() * Math.max(0, horaFim - horaInicio), feito: false }
    gravar('chefeMundial:agenda', agenda)
  }
  return agenda
}

function tique() {
  try {
    if (ativo() && Date.now() >= atual.terminaEm) encerrar('fugiu')
    if (!cfg().ligado || ativo()) return

    const agenda = agendaDeHoje()
    if (!agenda.feito && horaLocal() >= agenda.hora) {
      agenda.feito = true
      gravar('chefeMundial:agenda', agenda)
      surgir()
    }
  } catch (err) {
    console.error('[chefe mundial] falhou no relógio', err)
  }
}

/** Quando sai o próximo — só a janela, a hora exata é surpresa. */
export const proximaJanela = () => agendaDeHoje()

let relogio = null
export function iniciarChefeMundial() {
  tique()
  clearInterval(relogio)
  relogio = setInterval(tique, 30_000)
}
