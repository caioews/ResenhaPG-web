/**
 * Simulador de combate — funcao pura, sem tocar em store nem em rede.
 *
 * Recebe dois lados ja com os atributos somados e devolve quem venceu mais
 * o log da luta. O sorteio entra por parametro para os testes poderem
 * fixar o resultado e conferir a matematica.
 *
 * Habilidades de especialidade entram por um campo opcional `hab` no
 * lutador (ver habilidades.js). Quem nao tem `hab` luta exatamente como
 * antes — monstro, chefe e personagem sem evolucao passam batido por todo
 * esse codigo.
 */
import { config } from '../config.js'

const MAX_RODADAS = 30

/**
 * Defesa de referencia do defensor. Cresce com o nivel para que 1 ponto de
 * DEF valha proporcionalmente o mesmo no nivel 5 e no nivel 100 — ver o
 * comentario de config.rpg.mitigacao. Sem nivel (monstro antigo, teste
 * solto) cai no valor original e nada muda.
 */
function defesaDeReferencia(nivel) {
  const m = config.rpg.mitigacao
  return m.referenciaBase + Math.max(0, (nivel ?? 1) - m.desde) * m.porNivel
}

const chanceDeCritico = (agi) => Math.min(0.35, agi / 200)
const chanceDeEsquiva = (agi) => Math.min(0.25, agi / 280)

/** Prepara um lado para lutar: copia, fixa hpMax e zera os acumuladores. */
function prepararLutador(lutador) {
  return {
    ...lutador,
    hp: lutador.hp,
    hpMax: lutador.hpMax ?? lutador.hp,
    hab: lutador.hab ?? {},
    maldicao: 0, // DEF que ja perdeu para um Bruxo
    furia: 0, // ATQ extra acumulado pelo Gladiador
    preso: false, // caiu numa armadilha e perde a proxima vez
  }
}

/** O servo do Necromante: bate junto, sem habilidade propria. */
function servoDe(dono, fracao) {
  return {
    nome: `Servo de ${dono.nome}`,
    atq: dono.atq * fracao,
    def: dono.def,
    agi: dono.agi * 0.5,
    hab: {},
  }
}

/**
 * Dano de um golpe.
 *
 * A defesa reduz por porcentagem, nao por subtracao: subtraindo, bastava a
 * defesa passar do ataque do inimigo para todo golpe virar o minimo de 1 —
 * e o jogador ficava invencivel a partir de umas poucas pecas de equipamento.
 *
 * Efeito colateral proposital: acumula a maldicao no defensor. E o unico
 * estado que precisa sobreviver de um golpe para o outro.
 */
export function golpe(atacante, defensor, sorte = Math.random) {
  const meu = atacante.hab ?? {}
  const dele = defensor.hab ?? {}
  const vazio = { dano: 0, esquivou: true, critico: false, executou: false, cura: 0, prendeu: false }

  // A precisao do atacante corta a esquiva do defensor; nunca abaixo de zero.
  const esquiva = Math.max(0, chanceDeEsquiva(defensor.agi) + (dele.esquivaExtra ?? 0) - (meu.precisao ?? 0))
  if (sorte() < esquiva) return vazio

  const variacao = 0.85 + sorte() * 0.3
  const critico = sorte() < Math.min(0.6, chanceDeCritico(atacante.agi) + (meu.critico ?? 0))
  const executou = Boolean(meu.execucao) && sorte() < meu.execucao.chance

  // Defesa que o golpe realmente encontra: o que a maldicao ja derreteu,
  // menos o que a perfuracao atravessa.
  const perfuracao = Math.min(0.8, (meu.perfuracao ?? 0) + (executou ? meu.execucao.perfuracao ?? 0 : 0))
  const defEfetiva = Math.max(0, defensor.def * (1 - (defensor.maldicao ?? 0)) * (1 - perfuracao))

  // Alvo machucado apanha mais forte de quem tem contrato com ele.
  const faltando = defensor.hpMax ? 1 - Math.max(0, defensor.hp ?? defensor.hpMax) / defensor.hpMax : 0
  const progressivo = 1 + (meu.progressivo ?? 0) * faltando

  const atqEfetivo = atacante.atq * (1 + (atacante.furia ?? 0))
  const referencia = defesaDeReferencia(defensor.nivel)
  const mitigacao = referencia / (referencia + defEfetiva * 1.5)

  const bruto =
    atqEfetivo *
    variacao *
    (critico ? 1.8 : 1) *
    (executou ? meu.execucao.mult : 1) *
    progressivo *
    mitigacao *
    (1 + (meu.danoExtra ?? 0)) *
    (1 - (dele.reducaoDeDano ?? 0))

  const dano = Math.max(1, Math.round(bruto))

  if (meu.maldicao) {
    defensor.maldicao = Math.min(meu.maldicao.teto, (defensor.maldicao ?? 0) + meu.maldicao.porAcerto)
  }

  return {
    dano,
    esquivou: false,
    critico,
    executou,
    cura: meu.vampirismo ? Math.round(dano * meu.vampirismo) : 0,
    prendeu: Boolean(meu.prender) && sorte() < meu.prender,
  }
}

/** Aplica o resultado de um golpe: dano, cura de vampirismo e armadilha. */
function aplicar(resultado, atacante, alvo) {
  alvo.hp = Math.max(0, alvo.hp - resultado.dano)

  if (resultado.cura > 0 && atacante.hpMax) {
    atacante.hp = Math.min(atacante.hpMax, atacante.hp + resultado.cura)
  }
  if (resultado.prendeu && alvo.hp > 0) alvo.preso = true
}

/** Sobe a furia de quem acabou de jogar o turno. */
function acumularFuria(lutador) {
  const f = lutador.hab?.furia
  if (!f) return
  lutador.furia = Math.min(f.teto, (lutador.furia ?? 0) + f.porRodada)
}

/** Regenera no comeco do proprio turno. Devolve quanto voltou. */
function regenerar(lutador) {
  const fracao = lutador.hab?.regeneracao
  if (!fracao || !lutador.hpMax || lutador.hp <= 0) return 0

  const antes = lutador.hp
  lutador.hp = Math.min(lutador.hpMax, lutador.hp + Math.round(lutador.hpMax * fracao))
  return lutador.hp - antes
}

/**
 * Roda a luta inteira.
 * @returns {{ vencedor: 'a'|'b', rodadas: number, log: object[], hpA: number, hpB: number, porDecisao: boolean }}
 */
export function lutar(a, b, sorte = Math.random) {
  const lado = { a: prepararLutador(a), b: prepararLutador(b) }

  // Quem tem mais agilidade comeca; empate fica com o lado A (o jogador).
  // Habilidade de iniciativa passa na frente da agilidade — e se os dois
  // lados tiverem, volta a valer a agilidade.
  let vez = lado.a.agi >= lado.b.agi ? 'a' : 'b'
  if (lado.a.hab.iniciativa && !lado.b.hab.iniciativa) vez = 'a'
  else if (lado.b.hab.iniciativa && !lado.a.hab.iniciativa) vez = 'b'
  const log = []
  let rodadas = 0

  while (lado.a.hp > 0 && lado.b.hp > 0 && rodadas < MAX_RODADAS * 2) {
    rodadas++
    const atacante = lado[vez]
    const alvoId = vez === 'a' ? 'b' : 'a'
    const alvo = lado[alvoId]

    if (atacante.preso) {
      atacante.preso = false
      log.push({ quem: vez, tipo: 'preso', nome: atacante.nome, alvo: alvo.nome, dano: 0, esquivou: false, critico: false })
      vez = alvoId
      continue
    }

    acumularFuria(atacante)

    const curou = regenerar(atacante)
    if (curou > 0) {
      log.push({ quem: vez, tipo: 'regenerou', nome: atacante.nome, cura: curou, hpQuemAtaca: atacante.hp })
    }

    // O turno pode render mais de um golpe: o proprio, o segundo do
    // Espadachim e o do servo do Necromante.
    const golpes = [{ quem: atacante, marca: null }]
    if (atacante.hab.golpeDuplo && sorte() < atacante.hab.golpeDuplo) {
      golpes.push({ quem: atacante, marca: 'duplo' })
    }
    if (atacante.hab.servo) {
      golpes.push({ quem: servoDe(atacante, atacante.hab.servo), marca: 'servo' })
    }

    for (const { quem, marca } of golpes) {
      if (alvo.hp <= 0) break
      const resultado = golpe(quem, alvo, sorte)
      aplicar(resultado, atacante, alvo)

      log.push({
        quem: vez,
        tipo: 'ataque',
        marca,
        nome: quem.nome,
        alvo: alvo.nome,
        ...resultado,
        hpAlvo: alvo.hp,
        hpMaxAlvo: alvo.hpMax,
        hpQuemAtaca: atacante.hp,
      })

      // Revide: quem levou o golpe devolve na hora. O contra-ataque nunca
      // gera outro contra-ataque, senao dois lados com a habilidade ficariam
      // trocando golpes para sempre dentro do mesmo turno.
      if (alvo.hp > 0 && resultado.dano > 0 && alvo.hab.contraAtaque && sorte() < alvo.hab.contraAtaque) {
        const revide = golpe(alvo, atacante, sorte)
        aplicar(revide, alvo, atacante)
        log.push({
          quem: alvoId,
          tipo: 'ataque',
          marca: 'revide',
          nome: alvo.nome,
          alvo: atacante.nome,
          ...revide,
          hpAlvo: atacante.hp,
          hpMaxAlvo: atacante.hpMax,
        })
        if (atacante.hp <= 0) break
      }
    }

    vez = alvoId
  }

  const aVivo = lado.a.hp > 0
  const bVivo = lado.b.hp > 0
  let vencedor
  let porDecisao = false

  if (aVivo && bVivo) {
    // Bateu o limite de rodadas: ganha quem estiver com mais vida proporcional.
    porDecisao = true
    vencedor = lado.a.hp / lado.a.hpMax >= lado.b.hp / lado.b.hpMax ? 'a' : 'b'
  } else {
    vencedor = aVivo ? 'a' : 'b'
  }

  return {
    vencedor,
    rodadas,
    log,
    hpA: lado.a.hp,
    hpB: lado.b.hp,
    hpMaxA: lado.a.hpMax,
    hpMaxB: lado.b.hpMax,
    porDecisao,
  }
}

/**
 * Resume a luta em poucas linhas — a mensagem do WhatsApp nao aguenta
 * 30 rodadas, e ninguem le. Mostra a abertura, os momentos e o fim.
 */
export function resumir(resultado, limite = 6) {
  const { log } = resultado
  const destaques = []

  if (log[0]) destaques.push(log[0])
  for (const linha of log.slice(1, -1)) {
    if (linha.executou || linha.critico || linha.esquivou || linha.tipo === 'preso') destaques.push(linha)
  }
  if (log.length > 1) destaques.push(log.at(-1))

  const escolhidos =
    destaques.length > limite ? [destaques[0], ...destaques.slice(1, limite - 1), destaques.at(-1)] : destaques

  return escolhidos.map(descreverGolpe)
}

/** Uma linha de log virando texto. */
export function descreverGolpe(l) {
  if (l.tipo === 'regenerou') return `💚 ${l.nome} se refez em *${l.cura}*`
  if (l.tipo === 'preso') return `🪤 ${l.nome} está preso e perdeu a vez`
  if (l.esquivou) return `💨 ${l.alvo} desviou do golpe de ${l.nome}`

  const marca = l.executou
    ? '🩸 *EXECUÇÃO!* '
    : l.critico
      ? '💥 *CRÍTICO!* '
      : l.marca === 'duplo'
        ? '🤺 '
        : l.marca === 'servo'
          ? '💀 '
          : l.marca === 'revide'
            ? '↩️ '
            : '• '

  return `${marca}${l.nome} causou *${l.dano}* em ${l.alvo} _(${l.hpAlvo}/${l.hpMaxAlvo})_`
}

/** Barra de vida em texto. */
export function barraDeVida(atual, maximo, tamanho = 10) {
  const cheio = Math.max(0, Math.min(tamanho, Math.round((atual / maximo) * tamanho)))
  return '█'.repeat(cheio) + '░'.repeat(tamanho - cheio)
}

const MAX_RODADAS_GRUPO = 30

/**
 * Varios jogadores contra um chefe de raid.
 *
 * Cada rodada: todos os jogadores de pe atacam (em ordem de agilidade), e
 * entao o chefe revida. De tempos em tempos ele solta um golpe que acerta o
 * grupo inteiro — e o que impede a raid de virar "quanto mais gente, melhor"
 * sem limite: com muita gente, o golpe em area derruba varios de uma vez.
 *
 * Quem chega a zero fica caido e para de atacar, mas a luta continua.
 */
export function lutarEmGrupo(jogadores, chefeBase, sorte = Math.random) {
  const time = jogadores.map((j) => ({ ...prepararLutador(j), caido: false }))
  const chefe = prepararLutador(chefeBase)
  const log = []
  let rodada = 0

  while (chefe.hp > 0 && time.some((j) => !j.caido) && rodada < MAX_RODADAS_GRUPO) {
    rodada++

    for (const jogador of [...time].sort((a, b) => b.agi - a.agi)) {
      if (jogador.caido || chefe.hp <= 0) continue
      acumularFuria(jogador)
      regenerar(jogador)

      const golpes = [{ quem: jogador, marca: null }]
      if (jogador.hab.golpeDuplo && sorte() < jogador.hab.golpeDuplo) golpes.push({ quem: jogador, marca: 'duplo' })
      if (jogador.hab.servo) golpes.push({ quem: servoDe(jogador, jogador.hab.servo), marca: 'servo' })

      for (const { quem, marca } of golpes) {
        if (chefe.hp <= 0) break
        const g = golpe(quem, chefe, sorte)
        aplicar(g, jogador, chefe)
        log.push({ rodada, tipo: 'ataque', marca, nome: quem.nome, ...g, hpChefe: chefe.hp })
      }
    }

    if (chefe.hp <= 0) break

    if (chefe.preso) {
      chefe.preso = false
      log.push({ rodada, tipo: 'preso', nome: chefe.nome })
      continue
    }

    const dePe = time.filter((j) => !j.caido)
    const ehArea = chefe.areaCada > 0 && rodada % chefe.areaCada === 0

    if (ehArea) {
      const derrubados = []
      for (const alvo of dePe) {
        const g = golpe(chefe, alvo, sorte)
        const dano = Math.max(1, Math.round(g.dano * (chefe.areaMultiplicador ?? 0.6)))
        alvo.hp = Math.max(0, alvo.hp - dano)
        if (alvo.hp === 0) {
          alvo.caido = true
          derrubados.push(alvo.nome)
        }
      }
      log.push({ rodada, tipo: 'area', nome: chefe.nome, atingidos: dePe.length, derrubados })
    } else {
      const alvo = dePe[Math.floor(sorte() * dePe.length)]
      const g = golpe(chefe, alvo, sorte)
      alvo.hp = Math.max(0, alvo.hp - g.dano)
      if (alvo.hp === 0) alvo.caido = true

      log.push({
        rodada,
        tipo: 'chefe',
        nome: chefe.nome,
        alvo: alvo.nome,
        ...g,
        hpAlvo: alvo.hp,
        hpMaxAlvo: alvo.hpMax,
        derrubou: alvo.caido,
      })
    }
  }

  return {
    venceu: chefe.hp <= 0,
    rodadas: rodada,
    log,
    chefe,
    time,
    dePe: time.filter((j) => !j.caido).length,
  }
}
