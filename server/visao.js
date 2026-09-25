/**
 * A ficha do personagem como o navegador a enxerga.
 *
 * Regra de ouro: o cliente nunca recalcula nada que decida alguma coisa. Os
 * atributos, a vida, os cooldowns e os precos saem prontos daqui. O front
 * so desenha — se ele calculasse gold ou dano, viraria formulario de fraude.
 */
import { config } from './config.js'
import {
  ARMAS_DE_TODOS,
  CLASSES,
  classe,
  especialidadesDe,
  linhagemDe,
  nivelDoProximoDegrau,
} from './rpg/classes.js'
import { HABILIDADES, efeitosDaClasse, habilidadesDaClasse } from './rpg/habilidades.js'
import { NOME_DO_SLOT, RARIDADES, SLOTS, TIPOS, bonusFinal, nomeCompleto, precoDeReferencia } from './rpg/itens.js'
import { atributos, itemEquipado, vidaAtual, xpParaSubir } from './rpg/jogador.js'
import { verRota } from './rpg/cacada.js'
import { chefeDoAto, nomeDoArco, arcoDoAto, ato as atoDaRota } from './rpg/rota.js'
import { FEITICOS } from './rpg/feiticos.js'
import { TITANITAS } from './rpg/ferreiro.js'
import { emExpedicao, tempoRestante, EXPEDICOES } from './rpg/expedicao.js'
import { esperaDoAbismo } from './rpg/abismo.js'
import { esperaEntreDuelos, posicaoNoRanking } from './rpg/pvp.js'
import { esperaDoRito } from './rpg/evolucao.js'
import { escalaDeAtributos, escalaDeXp, motivoParaNaoPrestigiar, prestigioDe } from './rpg/prestigio.js'
import { bauCheio, espacosDoBau, itensDoBau, precoDoProximoEspaco } from './rpg/bau.js'
import { resumoDasMissoes } from './missoes.js'
import { quantasEntregas } from './entregas.js'
import { urlDaFoto } from './fotos.js'

/** Um item com tudo que a interface precisa mostrar sem recalcular nada. */
export function verItem(item, index = null) {
  if (!item) return null

  const base = {
    uid: item.uid,
    posicao: index === null ? null : index + 1,
    tipo: item.tipo,
    nome: item.nome,
    nomeCompleto: nomeCompleto(item),
    emoji: TIPOS[item.tipo]?.emoji ?? '📦',
    slot: item.slot ?? null,
    nomeDoSlot: item.slot ? NOME_DO_SLOT[item.slot] : null,
    equipavel: Boolean(item.slot),
  }

  const raridade = RARIDADES[item.raridade] ?? RARIDADES.comum

  return {
    ...base,
    raridade: item.raridade,
    raridadeNome: raridade.nome,
    raridadeEmoji: raridade.emoji,
    nivel: item.nivel,
    reforco: item.reforco ?? 0,
    feitico: item.feitico ?? null,
    feiticoNome: item.feitico ? FEITICOS[item.feitico]?.nome ?? null : null,
    feiticoEmoji: item.feitico ? FEITICOS[item.feitico]?.emoji ?? null : null,
    bonus: bonusFinal(item),
    bonusDeFabrica: item.bonus,
    preco: precoDeReferencia(item),
  }
}

export const verClasse = (id) => {
  const c = classe(id)
  if (!c) return null
  return {
    id,
    nome: c.nome,
    emoji: c.emoji,
    resumo: c.resumo ?? '',
    tier: c.tier,
    // A foice (e o que mais entrar em ARMAS_DE_TODOS) não está no `usa` de
    // classe nenhuma justamente por ser de todas: ela entra aqui, na leitura,
    // para a tela de classes não mentir sobre o que dá para equipar.
    usa: [...c.usa, ...ARMAS_DE_TODOS],
    base: c.base,
    ganho: c.ganho,
    habilidade: c.habilidade ?? null,
    evoluiDe: c.evoluiDe ?? null,
  }
}

export const verHabilidade = (id) => {
  const h = HABILIDADES[id]
  return h ? { id, nome: h.nome, emoji: h.emoji, resumo: h.resumo, efeitos: h.efeitos } : null
}

/** As sete classes base, para a tela de criacao de personagem. */
export const classesBase = () =>
  Object.keys(CLASSES)
    .filter((id) => CLASSES[id].tier === 1)
    .map((id) => ({ ...verClasse(id), passiva: verHabilidade(CLASSES[id].habilidade) }))

/** O inimigo no formato que a tela e o palco desenham. */
export const verInimigo = (monstro) => ({
  // É o `id` que diz ao palco qual sprite desenhar.
  id: monstro.id,
  nome: monstro.nome,
  emoji: monstro.emoji,
  nivel: monstro.nivel,
  elite: Boolean(monstro.elite),
  boss: Boolean(monstro.boss),
  eco: Boolean(monstro.eco),
  // A habilidade especial do chefe, para a tela anunciar antes da luta.
  especial: monstro.especial
    ? { nome: monstro.especial.nome, emoji: monstro.especial.emoji, resumo: monstro.especial.resumo }
    : null,
  hpMax: monstro.hp,
  atq: monstro.atq,
  def: monstro.def,
  agi: monstro.agi,
})

/**
 * Uma luta solta resolvida (o evento da Fenda), no formato que a interface
 * desenha. `hpInicial` é a vida com que o jogador ENTROU.
 */
export const verEncontro = (monstro, saida, hpInicial) => ({
  hpInicial,
  monstro: verInimigo(monstro),
  venceu: saida.venceu,
  rodadas: saida.luta.rodadas,
  porDecisao: saida.luta.porDecisao,
  log: saida.luta.log,
  hpFinal: saida.luta.hpA,
  hpMax: saida.luta.hpMaxA,
  xp: saida.xp,
  gold: saida.gold,
  goldDeSaque: saida.goldDeSaque,
  subiuPara: saida.subiuPara,
  drop: saida.drop ? verItem(saida.drop) : null,
  mochilaCheia: saida.mochilaCheia,
  titanita: saida.titanita,
  feitico: saida.feitico,
})

/**
 * Uma fase da rota resolvida, no formato que a interface anima.
 *
 * Vem com a horda inteira: uma entrada por inimigo, cada uma com o log
 * completo daquela luta e a vida com que o personagem ENTROU nela — é o
 * desgaste de uma para a outra que o palco precisa desenhar. O cliente só
 * reproduz; nada aqui ainda está por decidir.
 */
export const verFase = (player, saida) => ({
  ato: saida.fase.ato,
  fase: saida.fase.fase,
  nomeDoAto: saida.fase.nomeDoAto,
  cenario: saida.fase.cenario,
  nivel: saida.fase.nivel,
  chefe: saida.fase.chefe,
  // Quantos inimigos a fase TINHA. `lutas` só traz os que aconteceram: se o
  // personagem cai no terceiro, o quarto e o quinto nunca entram em cena.
  horda: saida.fase.inimigos.length,
  venceu: saida.venceu,

  lutas: saida.lutas.map((l) => ({
    inimigo: verInimigo(l.inimigo),
    hpInicial: l.hpInicial,
    hpMax: l.hpMax,
    venceu: l.venceu,
    rodadas: l.rodadas,
    porDecisao: l.porDecisao,
    log: l.log,
    ganhos: l.ganhos
      ? {
          xp: l.ganhos.xp,
          gold: l.ganhos.gold,
          goldDeSaque: l.ganhos.goldDeSaque,
          goldDaVenda: l.ganhos.goldDaVenda,
          subiuPara: l.ganhos.subiuPara,
          drop: l.ganhos.drop ? verItem(l.ganhos.drop) : null,
          mochilaCheia: l.ganhos.mochilaCheia,
          vendidoAutomaticamente: l.ganhos.vendidoAutomaticamente,
          titanita: l.ganhos.titanita,
          feitico: l.ganhos.feitico,
        }
      : null,
  })),

  // O fechamento da fase, somado — é o que o relatório final mostra.
  total: {
    xp: saida.total.xp,
    gold: saida.total.gold,
    subiuPara: saida.total.subiuPara,
    itens: saida.total.itens.map((d) => ({
      item: verItem(d.item),
      perdido: d.perdido,
      vendido: d.vendido,
      gold: d.gold,
    })),
    titanitas: saida.total.titanitas,
    feiticos: saida.total.feiticos,
    perdidos: saida.total.perdidos,
    vendidos: saida.total.vendidos,
    goldDaVenda: saida.total.goldDaVenda,
  },

  // Para onde a rota andou, e o que a tela faz com isso.
  proxima: {
    ...saida.proxima,
    nomeDoAto: atoDaRota(saida.proxima.ato)?.nome ?? '',
    cenario: atoDaRota(saida.proxima.ato)?.cenario ?? null,
    rotuloDoArco: nomeDoArco(arcoDoAto(saida.proxima.ato)),
    chefe: chefeDoAto(saida.proxima.ato)?.nome ?? null,
  },
  novoAto: Boolean(saida.novoAto),
  repetindo: saida.repetindo,
  recorde: saida.recorde,
  terminou: saida.terminou,
  rota: verRota(player),
})

/** A ficha inteira. É o payload de GET /api/estado. */
export function verPersonagem(player) {
  const ficha = player.rpg
  const c = classe(ficha.classe)
  const total = atributos(player)
  const hp = vidaAtual(player)

  const linhagem = ficha.classe ? linhagemDe(ficha.classe).map(verClasse) : []
  const habilidades = c ? habilidadesDaClasse(c).map(verHabilidade) : []

  return {
    id: player.id,
    nome: player.name,
    criadoEm: player.criadoEm,
    foto: urlDaFoto(player),

    classe: c ? verClasse(ficha.classe) : null,
    linhagem,
    habilidades,
    efeitos: c ? efeitosDaClasse(c) : {},

    nivel: ficha.nivel,
    xp: ficha.xp,
    xpParaSubir: xpParaSubir(ficha.nivel),
    gold: ficha.gold,

    hp,
    hpMax: total.hp,
    atributos: total,

    equipado: Object.fromEntries(SLOTS.map((slot) => [slot, verItem(itemEquipado(player, slot))])),
    // O que está em uso vem primeiro, em toda lista que parte da mochila
    // (mochila, venda na loja). O resto mantém a ordem em que entrou. A
    // `posicao` continua sendo a do array guardado, não a desta ordem.
    inventario: ficha.inventario
      .map((item, i) => ({ item, i, emUso: Object.values(ficha.equipado).includes(item.uid) }))
      .sort((a, b) => Number(b.emUso) - Number(a.emUso) || a.i - b.i)
      .map(({ item, i }) => verItem(item, i)),
    mochila: { usado: ficha.inventario.length, total: config.rpg.tamanhoMochila },
    // Só a contagem: a lista do baú é pesada e só interessa a quem abre o
    // painel, que a pede em GET /api/bau.
    bau: {
      usado: itensDoBau(player).length,
      total: espacosDoBau(player),
      cheio: bauCheio(player),
      proximoPreco: precoDoProximoEspaco(player),
    },

    titanitas: Object.fromEntries(
      Object.entries(TITANITAS).map(([grau, t]) => [
        grau,
        { nome: t.nome, emoji: t.emoji, quantidade: ficha.titanitas?.[grau] ?? 0 },
      ]),
    ),
    feiticos: Object.entries(ficha.feiticos ?? {})
      .filter(([, quantas]) => quantas > 0)
      .map(([id, quantas]) => ({
        id,
        quantidade: quantas,
        nome: FEITICOS[id]?.nome ?? id,
        emoji: FEITICOS[id]?.emoji ?? '✨',
        resumo: FEITICOS[id]?.resumo ?? '',
      })),

    estados: {
      expedicao: emExpedicao(player)
        ? {
            tipo: ficha.expedicao.tipo,
            nome: EXPEDICOES[ficha.expedicao.tipo]?.nome ?? ficha.expedicao.tipo,
            emoji: EXPEDICOES[ficha.expedicao.tipo]?.emoji ?? '🚶',
            restante: tempoRestante(player),
          }
        : null,
      esperaDoRito: esperaDoRito(player),
      esperaDaProva: Math.max(0, (ficha.provaAte ?? 0) - Date.now()),
    },

    cooldowns: {
      abismo: esperaDoAbismo(player),
      pvp: esperaEntreDuelos(player),
      raid: Math.max(
        0,
        (ficha.raid?.ultimaRaid ?? 0) + config.rpg.raid.cooldownMinutos * 60_000 - Date.now(),
      ),
    },

    // Onde o personagem está na rota: é o que o mapa desenha, e é de onde
    // sai o rótulo do botão de caçar.
    cacada: verRota(player),

    // O fim do jogo: o chefe final ja caiu, e se falta escolher o que vem depois.
    fim: {
      zerou: Boolean(ficha.fim?.zerou),
      pendente: Boolean(ficha.fim?.pendente),
      escolha: ficha.fim?.escolha ?? null,
    },

    // O prestígio: o contador, o que ele já dá e o que o próximo daria.
    prestigio: (() => {
      const n = prestigioDe(player)
      return {
        ...verPrestigio(player),
        desde: ficha.prestigioEm ?? 0,
        nivelMinimo: config.rpg.prestigio.nivelMinimo,
        podeAgora: motivoParaNaoPrestigiar(player) === null,
        motivo: motivoParaNaoPrestigiar(player)?.erro ?? null,
        proximo: {
          bonusAtributos: escalaDeAtributos(n + 1) - 1,
          bonusXp: escalaDeXp(n + 1) - 1,
        },
      }
    })(),

    // Para os selos do menu: missões prontas para resgatar e itens esperando
    // em "Retirar" na Casa de Leilões.
    missoes: ficha.classe ? resumoDasMissoes(player) : null,
    entregas: quantasEntregas(player.id),
    masmorra: {
      melhorAndar: ficha.masmorra?.melhorAndar ?? 0,
      espera: Math.max(
        0,
        (ficha.masmorra?.ultimaDescida ?? 0) + config.rpg.masmorra.cooldownMinutos * 60_000 - Date.now(),
      ),
    },

    evolucao: {
      nivelExigido: nivelDoProximoDegrau(ficha.classe),
      opcoes: ficha.classe ? especialidadesDe(ficha.classe).length : 0,
      tentativas: ficha.evolucao?.tentativas ?? 0,
    },

    abismo: { ...ficha.abismo },
    raid: { ...ficha.raid },
    pvp: { ...ficha.pvp, posicao: posicaoNoRanking(player) },
    vitorias: ficha.vitorias,
    derrotas: ficha.derrotas,
  }
}

/** O contador de prestígio e o bônus que ele já dá. */
function verPrestigio(player) {
  const n = prestigioDe(player)
  return { contador: n, bonusAtributos: escalaDeAtributos(n) - 1, bonusXp: escalaDeXp(n) - 1 }
}

/**
 * O perfil de outro jogador — o que se vê clicando no nome dele no ranking.
 *
 * Tem o mesmo formato da ficha (verPersonagem) nos campos que a tela de
 * status usa, para o cliente desenhar as duas com o mesmo código. O que é
 * só do dono fica de fora: mochila, materiais, cooldowns, missões.
 */
export function verPerfil(player) {
  const ficha = player.rpg
  const c = classe(ficha.classe)
  const total = atributos(player)

  return {
    id: player.id,
    nome: player.name,
    foto: urlDaFoto(player),
    criadoEm: player.criadoEm,
    jogadoEm: player.jogadoEm,

    classe: c ? verClasse(ficha.classe) : null,
    linhagem: ficha.classe ? linhagemDe(ficha.classe).map(verClasse) : [],
    habilidades: c ? habilidadesDaClasse(c).map(verHabilidade) : [],
    efeitos: c ? efeitosDaClasse(c) : {},

    nivel: ficha.nivel,
    xp: ficha.xp,
    xpParaSubir: xpParaSubir(ficha.nivel),
    gold: ficha.gold,
    hp: vidaAtual(player),
    hpMax: total.hp,
    atributos: total,

    equipado: Object.fromEntries(SLOTS.map((slot) => [slot, verItem(itemEquipado(player, slot))])),
    prestigio: verPrestigio(player),

    cacada: {
      ato: ficha.cacada?.maiorAto ?? 0,
      fase: ficha.cacada?.maiorFase ?? 0,
      nomeDoAto: atoDaRota(ficha.cacada?.maiorAto ?? 0)?.nome ?? null,
    },
    abismo: { melhorAndar: ficha.abismo?.melhorAndar ?? 0 },
    masmorra: { melhorAndar: ficha.masmorra?.melhorAndar ?? 0 },
    raid: { vitorias: ficha.raid?.vitorias ?? 0, derrotas: ficha.raid?.derrotas ?? 0 },
    pvp: {
      pontos: ficha.pvp?.pontos ?? 0,
      vitorias: ficha.pvp?.vitorias ?? 0,
      derrotas: ficha.pvp?.derrotas ?? 0,
      posicao: posicaoNoRanking(player),
    },
    vitorias: ficha.vitorias,
    derrotas: ficha.derrotas,
  }
}

/** Resumo curto — a lista de personagens da conta e o ranking do servidor. */
export function verResumo(player) {
  const c = classe(player.rpg.classe)
  return {
    id: player.id,
    nome: player.name,
    foto: urlDaFoto(player),
    nivel: player.rpg.nivel,
    prestigio: player.rpg.prestigio ?? 0,
    classe: c ? { id: player.rpg.classe, nome: c.nome, emoji: c.emoji, tier: c.tier } : null,
    gold: player.rpg.gold,
    hp: vidaAtual(player),
    hpMax: atributos(player).hp,
    criadoEm: player.criadoEm,
    jogadoEm: player.jogadoEm,
    vitorias: player.rpg.vitorias,
    derrotas: player.rpg.derrotas,
    melhorAndar: player.rpg.abismo?.melhorAndar ?? 0,
    melhorMasmorra: player.rpg.masmorra?.melhorAndar ?? 0,
    pontosPvp: player.rpg.pvp?.pontos ?? 0,
  }
}
