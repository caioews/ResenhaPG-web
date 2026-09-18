/**
 * Eventos aleatórios: de tempos em tempos o servidor chama todo mundo que
 * está on-line — "uma horda de goblins apareceu na estrada!" — e cada um
 * decide se atende.
 *
 * A chamada fica aberta alguns minutos (config.eventos.inscricaoMinutos).
 * Quando fecha, o evento se resolve sozinho para quem estava na lista:
 *
 *   grupo       uma luta de grupo, igual à raid, com o inimigo do evento
 *   individual  cada um enfrenta sozinho uma criatura de elite do seu nível
 *   bencao      sem luta: quem atendeu recebe o presente
 *
 * Mesma regra das salas de raid: nada fica retido. Atender não cobra nada, e
 * se o servidor reiniciar com a chamada aberta, o evento só some — ninguém
 * perde coisa alguma.
 */
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import * as store from './store.js'
import { escalaDeNivel, sortearMonstro } from './rpg/monstros.js'
import { resolver } from './rpg/encontro.js'
import { atributos, darGold, definirVida, feridoRestante, ganharXp, levantarDaFogueira, vidaAtual } from './rpg/jogador.js'
import { emExpedicao } from './rpg/expedicao.js'
import { TITANITAS, darTitanita, sortearTitanita } from './rpg/ferreiro.js'
import { FEITICOS, darFeitico, sortearFeitico } from './rpg/feiticos.js'
import { nivelMedioDe, resolverLutaDeGrupo } from './grupo.js'
import { xpComPrestigio } from './rpg/prestigio.js'
import { verEncontro, verResumo } from './visao.js'
import { anunciar, emitirPara, emitirParaTodos, jogadoresOnline } from './realtime.js'
import { horaLocal } from './tempo.js'
import { registrar } from './missoes.js'

// ============================================================ catálogo

/**
 * Os eventos. `peso` é a chance relativa de cada um ser sorteado.
 *
 * Os inimigos de grupo usam a mesma conta do chefe de raid (config.rpg.raid)
 * com multiplicadores próprios. Números medidos por simulação, com time de
 * classes sorteadas e equipamento raro:
 *
 *                 sozinho   2 jogadores   3 jogadores   5 jogadores
 *   goblins       60-90%    ~100%         100%          100%
 *   bandidos      40-65%    95-100%       100%          100%
 *   alcateia      40-60%    90-100%       100%          100%
 *   mortos-vivos  10-20%    50-60%        ~95%          100%
 *   dragão         ~3%      ~10%          20-30%        75-85%
 *
 * O dragão é o evento "raid": sem juntar gente não se vence. É também o que
 * paga mais.
 */
export const EVENTOS = {
  hordaGoblin: {
    tipo: 'grupo',
    dificuldade: 'fácil',
    peso: 5,
    nome: 'Horda de Goblins',
    emoji: '👺',
    chamada: 'Uma horda de goblins apareceu na estrada das ruínas!',
    descricao:
      'Dezenas deles descendo a encosta com tochas e facas enferrujadas. Sozinhos são fracos; juntos, derrubam muralha.',
    vitoria: 'A horda de goblins debandou morro abaixo.',
    derrota: 'A horda de goblins passou por cima de quem ficou no caminho.',
    ninguem: 'Ninguém atendeu. Os goblins saquearam a estrada e sumiram na mata.',
    inimigo: { mult: { hp: 0.7, atq: 0.72, def: 0.9, agi: 1.1 }, areaCada: 5, areaMultiplicador: 0.6 },
    recompensa: { xp: 0.5, gold: 0.6, itens: 0.5 },
    materiais: false,
  },

  bandidos: {
    tipo: 'grupo',
    dificuldade: 'fácil',
    peso: 4,
    nome: 'Bando do Corvo Rubro',
    emoji: '🏴‍☠️',
    chamada: 'Bandidos cercaram uma caravana de mercadores perto de Valkhar!',
    descricao:
      'O Bando do Corvo Rubro quer a carga inteira. O mercador promete pagar bem a quem espantar os ladrões.',
    vitoria: 'O Bando do Corvo Rubro fugiu, e o mercador pagou o prometido.',
    derrota: 'O Bando do Corvo Rubro levou a caravana e deixou os defensores no chão.',
    ninguem: 'Ninguém apareceu. A caravana foi saqueada.',
    inimigo: { mult: { hp: 0.75, atq: 0.8, def: 0.9, agi: 1.2 }, areaCada: 5, areaMultiplicador: 0.6 },
    // Paga em gold: é o mercador agradecendo, não espólio.
    recompensa: { xp: 0.45, gold: 1.1, itens: 0.4 },
    materiais: false,
  },

  alcateia: {
    tipo: 'grupo',
    dificuldade: 'média',
    peso: 4,
    nome: 'Alcateia da Lua de Sangue',
    emoji: '🐺',
    chamada: 'A lua ficou vermelha e uma alcateia uivou nos arredores!',
    descricao:
      'Lobos grandes demais para serem só lobos, rondando as ruínas em círculo. Atacam juntos e mordem todo mundo de uma vez.',
    vitoria: 'A alcateia da lua de sangue foi dispersada antes do amanhecer.',
    derrota: 'A alcateia da lua de sangue arrastou os caçadores para a mata.',
    ninguem: 'Ninguém saiu à noite. A alcateia rondou até a lua baixar.',
    inimigo: { mult: { hp: 0.8, atq: 0.85, def: 0.8, agi: 1.4 }, areaCada: 3, areaMultiplicador: 0.55 },
    recompensa: { xp: 0.6, gold: 0.5, itens: 0.5 },
    materiais: false,
  },

  mortosVivos: {
    tipo: 'grupo',
    dificuldade: 'difícil',
    peso: 3,
    nome: 'Legião dos Mortos',
    emoji: '🧟',
    chamada: 'Os mortos se levantaram no cemitério velho de Valkhar!',
    descricao:
      'A terra do cemitério remexe e o que estava enterrado caminha outra vez. Não sentem dor e não param — sozinho, ninguém segura.',
    vitoria: 'A legião dos mortos voltou para debaixo da terra.',
    derrota: 'A legião dos mortos avançou por cima dos vivos.',
    ninguem: 'Ninguém foi ao cemitério. Os mortos vagaram até o sol subir e voltaram para as covas.',
    inimigo: { mult: { hp: 0.95, atq: 0.9, def: 1.05, agi: 0.8 }, areaCada: 4, areaMultiplicador: 0.7 },
    recompensa: { xp: 0.75, gold: 0.7, itens: 0.7 },
    materiais: true,
  },

  dragao: {
    tipo: 'grupo',
    dificuldade: 'raid',
    peso: 2,
    nome: 'Dragão Errante',
    emoji: '🐉',
    chamada: 'Um dragão está sobrevoando Valkhar!',
    descricao:
      'A sombra dele cobre as ruínas inteiras. Pousou na torre quebrada e não parece com pressa de ir embora. É luta de raid: sem juntar gente, não tem conversa.',
    vitoria: 'O Dragão Errante caiu sobre a torre quebrada!',
    derrota: 'O Dragão Errante queimou o grupo e voltou a voar.',
    ninguem: 'Ninguém subiu a torre. O dragão cansou de esperar e seguiu viagem.',
    inimigo: { mult: { hp: 1.15, atq: 1.1, def: 1.15, agi: 1 }, areaCada: 4, areaMultiplicador: 0.85 },
    recompensa: { xp: 1.2, gold: 1.2, itens: 1.2 },
    materiais: true,
  },

  fendaSombria: {
    tipo: 'individual',
    dificuldade: 'média',
    peso: 3,
    nome: 'Fenda Sombria',
    emoji: '🕳️',
    chamada: 'Uma fenda se abriu no chão das ruínas!',
    descricao:
      'Alguma coisa respira lá embaixo. Quem descer enfrenta sozinho o que sair da escuridão — e volta com o dobro, se voltar.',
    ninguem: 'Ninguém desceu. A fenda se fechou sozinha.',
    // Sobre a recompensa normal da criatura (que já é de elite).
    bonus: { xp: 1, gold: 1 },
  },

  festa: {
    tipo: 'bencao',
    dificuldade: null,
    peso: 2,
    nome: 'Festa na Taverna',
    emoji: '🍺',
    chamada: 'O taverneiro abriu os barris: festa na taverna!',
    descricao:
      'Música, comida e cerveja por conta da casa. Quem aparecer sai curado, sem ferimento e com o bolso um pouco mais pesado.',
    ninguem: 'Ninguém apareceu. O taverneiro fechou os barris de novo, emburrado.',
  },

  estrelaCadente: {
    tipo: 'bencao',
    dificuldade: null,
    peso: 2,
    nome: 'Estrela Cadente',
    emoji: '☄️',
    chamada: 'Uma estrela caiu perto das ruínas!',
    descricao:
      'Fragmentos ainda quentes espalhados pela cratera. Quem for buscar volta com titanita — e, com sorte, um feitiço preso no metal.',
    ninguem: 'Ninguém foi até a cratera. Os fragmentos esfriaram e viraram pedra comum.',
  },
}

const REGRAS = {
  grupo:
    'Luta em grupo, como uma raid: quando a chamada fechar, todos entram juntos com a vida cheia. Quanto mais gente, mais vida o inimigo tem — mas o dano dele se espalha. Derrota deixa todo mundo ferido.',
  individual:
    'Cada um luta sozinho contra uma criatura de elite do próprio nível, com a vida que tiver na hora. Vitória paga o dobro; derrota fere como numa caçada.',
  bencao: 'Sem luta. Basta estar na lista quando a chamada fechar.',
}

/** O inimigo de um evento de grupo, na mesma conta do chefe de raid. */
export function inimigoDoEvento(chave, nivelMedio, jogadores) {
  const def = EVENTOS[chave]
  const r = config.rpg.raid
  const escala = Math.max(1, jogadores) ** r.escalaPorJogador
  const fim = escalaDeNivel(nivelMedio)
  const { mult, areaCada, areaMultiplicador } = def.inimigo

  return {
    id: chave,
    nome: def.nome,
    emoji: def.emoji,
    descricao: def.descricao,
    duro: def.dificuldade === 'raid',
    nivel: nivelMedio,
    hp: Math.round((r.hpBase + nivelMedio * r.hpPorNivel) * mult.hp * escala * fim.hp),
    atq: Math.round((r.atqBase + nivelMedio * r.atqPorNivel) * mult.atq * fim.atq),
    def: Math.round((r.defBase + nivelMedio * r.defPorNivel) * mult.def * fim.def),
    agi: Math.round((r.agiBase + nivelMedio * r.agiPorNivel) * mult.agi * fim.agi),
    areaCada: Math.max(3, areaCada - Math.floor(jogadores / 6)),
    areaMultiplicador,
  }
}

// ============================================================== estado

/** O evento com a chamada aberta. Um de cada vez. */
let atual = null
let temporizadorDoProximo = null
let temporizadorDoFim = null
let proximoEm = 0

export function verEvento(evento) {
  if (!evento) return null
  const def = EVENTOS[evento.chave]

  return {
    id: evento.id,
    chave: evento.chave,
    tipo: def.tipo,
    dificuldade: def.dificuldade,
    nome: def.nome,
    emoji: def.emoji,
    chamada: def.chamada,
    descricao: def.descricao,
    regras: REGRAS[def.tipo],
    criadoEm: evento.criadoEm,
    fechaEm: evento.fechaEm,
    maxParticipantes: def.tipo === 'grupo' ? config.eventos.maxParticipantes : null,
    participantes: evento.participantes
      .map((x) => store.buscarPersonagem(x.personagemId))
      .filter(Boolean)
      .map(verResumo),
  }
}

export const eventoAtual = () => (atual ? verEvento(atual) : null)

const avisarMudanca = () => emitirParaTodos('evento:atualizou', { evento: eventoAtual() })

// ============================================================ agenda

const minutos = (n) => n * 60_000
const sortearEntre = (min, max) => min + Math.random() * (max - min)

function dentroDaJanela() {
  const { horaInicio, horaFim } = config.eventos
  const h = horaLocal()
  return horaInicio <= horaFim ? h >= horaInicio && h < horaFim : h >= horaInicio || h < horaFim
}

/** Quantos minutos faltam para a janela abrir. */
const minutosAteAbrir = () => (((config.eventos.horaInicio - horaLocal()) % 24) + 24) % 24 * 60

function agendar(ms, motivo) {
  clearTimeout(temporizadorDoProximo)
  proximoEm = Date.now() + ms
  temporizadorDoProximo = setTimeout(tentarDisparar, ms)
  console.log(`[eventos] próximo em ${Math.round(ms / 60_000)} min (${motivo})`)
}

function agendarProximo() {
  const { intervaloMinimo, intervaloMaximo } = config.eventos
  agendar(minutos(sortearEntre(intervaloMinimo, intervaloMaximo)), 'intervalo sorteado')
}

function tentarDisparar() {
  if (!config.eventos.ligado) return
  if (atual) return agendarProximo()

  if (!dentroDaJanela()) {
    // Nada de evento de madrugada: marca para um pouco depois de abrir, para
    // não cair sempre no mesmo minuto.
    return agendar(minutos(minutosAteAbrir() + sortearEntre(5, config.eventos.intervaloMinimo)), 'fora do horário')
  }

  if (jogadoresOnline().length < config.eventos.minimoOnline) {
    return agendar(minutos(config.eventos.esperaSemGenteMinutos), 'ninguém on-line')
  }

  dispararEvento()
}

export function iniciarEventos() {
  if (!config.eventos.ligado) {
    console.log('[eventos] desligados em config.eventos.ligado')
    return
  }
  agendarProximo()
}

export const proximoEvento = () => proximoEm

function sortearChave() {
  const lista = Object.entries(EVENTOS)
  const total = lista.reduce((s, [, e]) => s + e.peso, 0)
  let ponto = Math.random() * total
  for (const [chave, e] of lista) {
    ponto -= e.peso
    if (ponto <= 0) return chave
  }
  return lista[0][0]
}

/**
 * Abre a chamada de um evento. Sem chave, sorteia. `segundos` encurta a
 * inscrição — serve para o comando de administrador testar sem esperar.
 */
export function dispararEvento(chave = sortearChave(), { segundos = null } = {}) {
  if (atual) return { erro: `Já tem um evento aberto: ${EVENTOS[atual.chave].nome}.` }
  if (!EVENTOS[chave]) return { erro: `Evento desconhecido: ${chave}.` }

  const duracao = segundos ? segundos * 1000 : minutos(config.eventos.inscricaoMinutos)

  atual = {
    id: randomUUID().slice(0, 8),
    chave,
    criadoEm: Date.now(),
    fechaEm: Date.now() + duracao,
    participantes: [],
  }

  clearTimeout(temporizadorDoProximo)
  temporizadorDoFim = setTimeout(encerrarEvento, duracao)

  const def = EVENTOS[chave]
  emitirParaTodos('evento:novo', { evento: eventoAtual() })
  anunciar(`${def.emoji} ${def.chamada} A chamada fica aberta por ${Math.round(duracao / 60_000) || 1} min.`)
  console.log(`[eventos] ${def.nome} aberto`)

  return { evento: eventoAtual() }
}

// ======================================================== inscrição

/** O que impede um personagem de lutar num evento agora. */
function impedimento(player, def) {
  if (!player.rpg.classe) return 'Esse personagem ainda não tem classe.'
  if (emExpedicao(player)) return 'Seu personagem está em expedição.'
  if (def.tipo !== 'bencao' && feridoRestante(player) > 0) {
    return 'Você está ferido demais para lutar. Uma bandagem resolve na hora.'
  }
  return null
}

export function participar(player) {
  if (!atual || Date.now() > atual.fechaEm) return { erro: 'Não tem evento com a chamada aberta agora.' }
  const def = EVENTOS[atual.chave]

  if (atual.participantes.some((x) => x.personagemId === player.id)) {
    return { erro: 'Você já está nesse evento.' }
  }
  // Um por conta: senão a conta com dez personagens leva dez vezes o espólio.
  if (atual.participantes.some((x) => x.usuarioId === player.usuarioId)) {
    return { erro: 'Outro personagem da sua conta já atendeu a esse chamado. É um por conta.' }
  }

  const erro = impedimento(player, def)
  if (erro) return { erro }

  if (def.tipo === 'grupo' && atual.participantes.length >= config.eventos.maxParticipantes) {
    return { erro: `O evento já tem ${config.eventos.maxParticipantes} aventureiros.` }
  }

  atual.participantes.push({ personagemId: player.id, usuarioId: player.usuarioId })
  avisarMudanca()
  return { evento: eventoAtual() }
}

export function desistir(player) {
  if (!atual) return { erro: 'Não tem evento aberto.' }
  const antes = atual.participantes.length
  atual.participantes = atual.participantes.filter((x) => x.personagemId !== player.id)
  if (atual.participantes.length === antes) return { erro: 'Você não está nesse evento.' }

  avisarMudanca()
  return { evento: eventoAtual() }
}

/** Um personagem apagado sai da lista na hora. */
export function esquecerPersonagem(id) {
  if (!atual) return
  atual.participantes = atual.participantes.filter((x) => x.personagemId !== id)
}

// ======================================================== resolução

/** Fecha a chamada agora e resolve. */
export function encerrarEvento() {
  if (!atual) return { erro: 'Não tem evento aberto.' }

  clearTimeout(temporizadorDoFim)
  const evento = atual
  atual = null

  const def = EVENTOS[evento.chave]
  const visto = { ...verEvento(evento), encerrado: true }

  // A condição é conferida de novo: dá para ter se ferido ou saído em
  // expedição entre atender e a chamada fechar.
  const inscritos = evento.participantes.map((x) => store.buscarPersonagem(x.personagemId)).filter(Boolean)
  const presentes = inscritos.filter((p) => !impedimento(p, def))
  for (const p of presentes) registrar(p, 'evento')
  const ausentes = inscritos.filter((p) => impedimento(p, def)).map((p) => p.name)

  let texto

  try {
    if (!presentes.length) {
      texto = ausentes.length
        ? `${def.emoji} ${def.nome}: quem atendeu não pôde ir a tempo (${nomes(ausentes)}).`
        : `${def.emoji} ${def.ninguem}`
    } else if (def.tipo === 'grupo') {
      texto = resolverGrupo(evento, def, presentes, visto, ausentes)
    } else if (def.tipo === 'individual') {
      texto = resolverIndividual(evento, def, presentes, visto, ausentes)
    } else {
      texto = resolverBencao(evento, def, presentes, visto, ausentes)
    }
  } catch (err) {
    console.error('[eventos] falhou ao resolver', err)
    texto = `${def.emoji} ${def.nome} terminou sem resultado — algo quebrou no servidor.`
  }

  store.flush()
  anunciar(texto)
  emitirParaTodos('evento:encerrado', {
    evento: visto,
    texto,
    participantes: presentes.map((p) => p.id),
  })
  console.log(`[eventos] ${def.nome} encerrado com ${presentes.length} participante(s)`)

  agendarProximo()
  return { texto }
}

const nomes = (lista) =>
  lista.length <= 1 ? lista.join('') : `${lista.slice(0, -1).join(', ')} e ${lista.at(-1)}`

function resolverGrupo(evento, def, presentes, visto, ausentes) {
  const chefe = inimigoDoEvento(evento.chave, nivelMedioDe(presentes), presentes.length)
  const raid = resolverLutaDeGrupo(presentes, chefe, {
    recompensa: def.recompensa,
    materiais: def.materiais,
    ferirNaDerrota: true,
  })

  for (const p of presentes) emitirPara(p.id, 'evento:resultado', { evento: visto, ausentes, raid })

  const quem = nomes(presentes.map((p) => p.name))
  return raid.venceu
    ? `${def.emoji} ${def.vitoria} Lutaram: ${quem}.`
    : `${def.emoji} ${def.derrota} Lutaram: ${quem}.`
}

function resolverIndividual(evento, def, presentes, visto, ausentes) {
  let venceram = 0

  for (const p of presentes) {
    const monstro = sortearMonstro(p.rpg.nivel, 1)
    monstro.nome = `${monstro.nome} da Fenda`
    const hpInicial = vidaAtual(p)
    const saida = resolver(p, monstro)

    const bonus = { xp: 0, gold: 0, titanita: null }
    if (saida.venceu) {
      venceram++
      bonus.xp = xpComPrestigio(p, Math.round(saida.xp * def.bonus.xp))
      bonus.gold = Math.round(saida.gold * def.bonus.gold)
      darGold(p, bonus.gold)
      saida.subiuPara.push(...ganharXp(p, bonus.xp))
      saida.xp += bonus.xp
      saida.gold += bonus.gold

      // A fenda sempre larga titanita para quem volta dela.
      if (!saida.titanita) {
        const t = sortearTitanita('boss')
        if (t) {
          darTitanita(p, t.grau, t.quantidade)
          saida.titanita = t
        }
      }
    }

    emitirPara(p.id, 'evento:resultado', {
      evento: visto,
      ausentes,
      encontro: verEncontro(monstro, saida, hpInicial),
      bonus,
    })
  }

  return `${def.emoji} ${def.nome}: ${venceram} de ${presentes.length} voltaram vitoriosos da escuridão.`
}

/** 1.280 em vez de 1280 — o texto vai pronto para a tela. */
const milhar = (n) => n.toLocaleString('pt-BR')

function resolverBencao(evento, def, presentes, visto, ausentes) {
  for (const p of presentes) {
    const ganhos = []

    if (evento.chave === 'festa') {
      levantarDaFogueira(p)
      if (p.rpg.feridoAte > Date.now()) ganhos.push('o ferimento sarou')
      p.rpg.feridoAte = 0
      definirVida(p, atributos(p).hp)
      ganhos.push('vida cheia')

      const gold = Math.round(40 + p.rpg.nivel * 15)
      darGold(p, gold)
      ganhos.push(`+${milhar(gold)} de gold`)
    } else {
      const t = sortearTitanita('raid')
      if (t) {
        darTitanita(p, t.grau, t.quantidade)
        ganhos.push(`${t.quantidade}× ${TITANITAS[t.grau].nome}`)
      }
      if (Math.random() < 0.25) {
        const feitico = sortearFeitico(p.rpg.nivel)
        if (feitico) {
          darFeitico(p, feitico)
          ganhos.push(`um feitiço de ${FEITICOS[feitico].nome}`)
        }
      }
      const xp = xpComPrestigio(p, Math.round(60 + p.rpg.nivel * 20))
      const subiu = ganharXp(p, xp)
      ganhos.push(`+${milhar(xp)} de XP`)
      if (subiu.length) ganhos.push(`subiu para o nível ${subiu.at(-1)}`)
    }

    emitirPara(p.id, 'evento:resultado', { evento: visto, ausentes, bencao: { ganhos } })
  }

  return `${def.emoji} ${def.nome}: ${nomes(presentes.map((p) => p.name))} ${presentes.length > 1 ? 'aproveitaram' : 'aproveitou'}.`
}
