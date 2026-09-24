/**
 * Evolucao de classe: a missao que abre o proximo degrau da arvore.
 *
 * Sao tres degraus alem da classe base — especialidade (50), maestria
 * (150) e apoteose (200) —, e todos passam pela mesma missao: o Rito.
 * Tres desafios em sequencia, cada um mais alto que o anterior, com pouca
 * cura no meio.
 *
 * As provas sao espelhos do proprio aspirante, e a ultima carrega o nome
 * do que ele quer virar: para subir, tem que vencer a versao de si mesmo
 * que ja chegou la. Foi o jeito de o Rito valer o mesmo para todo mundo —
 * com atributos de monstro a prova saia 72% para o Guerreiro e 8% para o
 * Ladino, e ainda piorava a cada nivel conforme a escala de fim de jogo
 * entrava.
 *
 * Perder custa o gold e algumas horas de espera, nao o personagem.
 */
import { config } from '../config.js'
import * as store from '../store.js'
import { CLASSES, especialidadesDe, nivelDoProximoDegrau, tierDe } from './classes.js'
import { lutar } from './combate.js'
import { comoLutador } from './encontro.js'
import { atributos, darGold, desequiparIncompativeis } from './jogador.js'

/**
 * O guardiao final do Rito de especialidade. Dos degraus de 150 e 200 em
 * diante o guardiao e o eco da propria classe alvo, entao nao precisa de
 * nome proprio aqui.
 */
export const GUARDIOES = {
  paladino: { nome: 'Juiz da Luz', emoji: '⚖️' },
  gladiador: { nome: 'Campeão Invicto', emoji: '🏟️' },
  bruxo: { nome: 'Voz do Pacto', emoji: '🧿' },
  necromante: { nome: 'Primeiro dos Mortos', emoji: '⚱️' },
  guardiao: { nome: 'Raiz Mais Antiga', emoji: '🌳' },
  cacadorDeFeras: { nome: 'A Presa Que Caça', emoji: '🐗' },
  assassino: { nome: 'Mestre das Sombras', emoji: '🌑' },
  ladrao: { nome: 'Rei dos Ratos', emoji: '🐀' },
  espadachim: { nome: 'Lâmina Sem Nome', emoji: '🗡️' },
  cacadorDeRecompensas: { nome: 'O Último Contrato', emoji: '📜' },
  trovador: { nome: 'Primeira Canção', emoji: '🎼' },
  oraculo: { nome: 'O Que Já Viu Tudo', emoji: '👁️' },
  sacerdote: { nome: 'Silêncio do Altar', emoji: '⛪' },
  xama: { nome: 'O Mais Velho da Fogueira', emoji: '🔥' },
}

/** Quem espera o aspirante na terceira prova do caminho para `alvoId`. */
export function guardiaoDe(alvoId) {
  if (GUARDIOES[alvoId]) return GUARDIOES[alvoId]

  const alvo = CLASSES[alvoId]
  return { nome: `Eco de ${alvo.nome}`, emoji: alvo.emoji }
}

/**
 * As tres provas, do mais leve ao guardiao — todas espelhos do aspirante.
 * O multiplicador base sobe com o degrau (ver espelhoPorTier no config):
 * o Rito de apoteose e uma luta contra quase voce mesmo.
 */
const ETAPAS = [
  { titulo: 'Aspirante do Rito', emoji: '🕯️', peso: { hp: 0.76, atq: 0.85, def: 0.85, agi: 0.9 } },
  { titulo: 'Executor do Rito', emoji: '🔥', peso: { hp: 0.85, atq: 0.95, def: 0.95, agi: 1.0 } },
  { titulo: null, emoji: null, peso: { hp: 1.0, atq: 1.05, def: 1.05, agi: 1.1 } },
]

/**
 * Os desafios que um caminho coloca na frente de um jogador.
 * Aceita a ficha do jogador ou, para inspecao, um objeto de atributos.
 */
export function desafiosDo(alvoId, player) {
  const guardiao = guardiaoDe(alvoId)
  const meus = player.rpg ? atributos(player) : player
  const nivelJogador = player.rpg ? player.rpg.nivel : (player.nivel ?? 1)

  const espelho = config.rpg.evolucao.espelhoPorTier[CLASSES[alvoId].tier] ?? 0.82

  return ETAPAS.map((etapa, i) => ({
    nome: etapa.titulo ?? guardiao.nome,
    emoji: etapa.emoji ?? guardiao.emoji,
    nivel: nivelJogador + config.rpg.evolucao.degraus[i],
    final: i === ETAPAS.length - 1,
    hp: Math.round(meus.hp * etapa.peso.hp * espelho),
    atq: Math.round(meus.atq * etapa.peso.atq * espelho),
    def: Math.round(meus.def * etapa.peso.def * espelho),
    agi: Math.round(meus.agi * etapa.peso.agi * espelho),
  }))
}

/** Quanto custa o Rito que leva a esta classe. */
export const custoDoRito = (alvoId) =>
  config.rpg.evolucao.custoGold[CLASSES[alvoId]?.tier] ?? config.rpg.evolucao.custoGold[2]

/** Por que este jogador nao pode tentar o Rito agora. null = pode. */
export function motivoParaNaoEvoluir(player) {
  const ficha = player.rpg
  if (!ficha.classe) return 'semClasse'

  const opcoes = especialidadesDe(ficha.classe)
  if (!opcoes.length) return 'fimDaLinha'

  const exigido = nivelDoProximoDegrau(ficha.classe)
  if (ficha.nivel < exigido) return 'nivelBaixo'
  if (ficha.gold < custoDoRito(opcoes[0])) return 'semGold'
  if (Date.now() < (ficha.evolucao?.esperaAte ?? 0)) return 'esperando'

  return null
}

export const esperaDoRito = (player) => Math.max(0, (player.rpg.evolucao?.esperaAte ?? 0) - Date.now())

/** Os caminhos abertos a partir de onde o personagem esta agora. */
export const opcoesDe = (player) => especialidadesDe(player.rpg.classe)

/** O nivel que o proximo degrau exige, ou null no fim da linha. */
export const nivelExigido = (player) => nivelDoProximoDegrau(player.rpg.classe)

/**
 * Roda o Rito inteiro.
 *
 * Cobra o gold antes de comecar (tentar ja custa), roda as tres provas
 * com a vida carregando de uma para a outra e, se passar nas tres, sobe o
 * personagem para a classe alvo.
 */
export function encarar(player, alvoId, sorte = Math.random) {
  const e = config.rpg.evolucao
  const maximo = atributos(player).hp
  const custo = custoDoRito(alvoId)

  darGold(player, -custo)

  const eu = comoLutador(player, player.name || 'Você')
  eu.hp = maximo

  const etapas = []
  let venceuTudo = true

  for (const desafio of desafiosDo(alvoId, player)) {
    const luta = lutar(
      { ...eu, hp: eu.hp, hpMax: maximo },
      {
        nome: `${desafio.emoji} ${desafio.nome}`,
        nivel: desafio.nivel,
        atq: desafio.atq,
        def: desafio.def,
        agi: desafio.agi,
        hp: desafio.hp,
      },
      sorte,
    )

    const venceu = luta.vencedor === 'a'
    etapas.push({ desafio, venceu, luta, hpFinal: luta.hpA, hpMax: maximo })

    if (!venceu) {
      venceuTudo = false
      break
    }

    eu.hp = Math.min(maximo, luta.hpA + Math.round(maximo * e.curaEntreDesafios))
  }

  const ficha = player.rpg

  if (!venceuTudo) {
    ficha.evolucao.esperaAte = Date.now() + e.esperaHoras * 3_600_000
    ficha.evolucao.tentativas++
    store.save()
    return { venceu: false, etapas, alvoId, custo, tier: tierDe(alvoId) }
  }

  const anterior = ficha.classe
  ficha.classe = alvoId
  ficha.evolucao.esperaAte = 0
  ficha.evolucao.tentativas++
  ficha.evolucao.evoluiuEm = Date.now()

  // Por construcao cada degrau usa tudo que o anterior usava, mas se algum
  // dia isso mudar e melhor devolver o item do que sumir com ele.
  const tirados = desequiparIncompativeis(player)
  store.save()

  return { venceu: true, etapas, alvoId, anterior, custo, tier: tierDe(alvoId), tirados }
}
