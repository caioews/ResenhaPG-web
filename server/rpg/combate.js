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

    // O que so a habilidade especial de um chefe mexe (ver ESPECIAIS, abaixo).
    turnos: 0, // turnos proprios ja jogados
    escudo: 0, // dano que ainda e absorvido antes de chegar na vida
    enfurecido: 0, // ATQ extra ganho de uma vez, ao passar de um limiar
    invocados: 0, // quantos aliados ja foram chamados para a luta
    queima: null, // { fracao, turnos }: dano por turno que este lado esta levando
    evasoes: lutador.hab?.especial?.tipo === 'evasao' ? lutador.hab.especial.golpes : 0,
    gastou: {}, // as habilidades de uso unico que ja foram usadas
  }
}

/** O servo do Necromante: bate junto, sem habilidade propria. */
function servoDe(dono, fracao, nome = `Servo de ${dono.nome}`) {
  return {
    nome,
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
 *
 * `extra` e o golpe especial de um chefe (ver ESPECIAIS): `mult` multiplica
 * o dano, `perfuracao` soma ao que a defesa perde e `semEsquiva` faz o golpe
 * nao poder ser desviado. Sem ele o golpe e o de sempre.
 */
export function golpe(atacante, defensor, sorte = Math.random, extra = {}) {
  const meu = atacante.hab ?? {}
  const dele = defensor.hab ?? {}
  const vazio = { dano: 0, esquivou: true, critico: false, executou: false, cura: 0, prendeu: false }

  // A evasao de um chefe nao depende de agilidade nem de precisao: os
  // primeiros golpes simplesmente atravessam. Nao gasta sorteio.
  if (defensor.evasoes > 0 && !extra.semEsquiva) {
    defensor.evasoes--
    return { ...vazio, evasao: true, especial: marcaDe(dele.especial) }
  }

  // A precisao do atacante corta a esquiva do defensor; nunca abaixo de zero.
  const esquiva = Math.max(0, chanceDeEsquiva(defensor.agi) + (dele.esquivaExtra ?? 0) - (meu.precisao ?? 0))
  if (sorte() < esquiva && !extra.semEsquiva) return vazio

  const variacao = 0.85 + sorte() * 0.3
  const critico = sorte() < Math.min(0.6, chanceDeCritico(atacante.agi) + (meu.critico ?? 0))
  const executou = Boolean(meu.execucao) && sorte() < meu.execucao.chance

  // Defesa que o golpe realmente encontra: o que a maldicao ja derreteu,
  // menos o que a perfuracao atravessa.
  const perfuracao = Math.min(
    0.8,
    (meu.perfuracao ?? 0) + (executou ? meu.execucao.perfuracao ?? 0 : 0) + (extra.perfuracao ?? 0),
  )
  const defEfetiva = Math.max(0, defensor.def * (1 - (defensor.maldicao ?? 0)) * (1 - perfuracao))

  // Alvo machucado apanha mais forte de quem tem contrato com ele.
  const faltando = defensor.hpMax ? 1 - Math.max(0, defensor.hp ?? defensor.hpMax) / defensor.hpMax : 0
  const progressivo = 1 + (meu.progressivo ?? 0) * faltando

  const atqEfetivo = atacante.atq * (1 + (atacante.furia ?? 0)) * (1 + (atacante.enfurecido ?? 0))
  const referencia = defesaDeReferencia(defensor.nivel)
  const mitigacao = referencia / (referencia + defEfetiva * 1.5)

  const bruto =
    atqEfetivo *
    variacao *
    (critico ? 1.8 : 1) *
    (executou ? meu.execucao.mult : 1) *
    (extra.mult ?? 1) *
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

/**
 * Aplica o resultado de um golpe: escudo, dano, cura de vampirismo e
 * armadilha. O que o escudo segurou fica em `resultado.absorvido`, que vai
 * junto para o log — a vida do alvo cai so pelo que sobrou.
 */
function aplicar(resultado, atacante, alvo) {
  let dano = resultado.dano

  if (alvo.escudo > 0 && dano > 0) {
    const absorvido = Math.min(alvo.escudo, dano)
    alvo.escudo -= absorvido
    dano -= absorvido
    resultado.absorvido = absorvido
  }

  alvo.hp = Math.max(0, alvo.hp - dano)

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

// ------------------------------------------------- habilidades dos chefes

/**
 * A habilidade especial de um chefe (`hab.especial`, montada em
 * rpg/monstros.js). Cada chefe tem uma so, e ela e de um destes tipos:
 *
 *   golpe       a cada `cada` turnos (ou uma vez, quando o alvo cai abaixo de
 *               `quandoAlvoAbaixoDe`) o golpe do turno vira um golpe especial:
 *               `mult` de dano, `perfuracao`, `semEsquiva`, `prende` (chance
 *               de o alvo perder a vez), `queima` ({ fracao, turnos }: dano
 *               por turno em fracao da vida maxima do alvo) e `cura` (fracao
 *               do dano que volta como vida)
 *   escudo      quando a vida cai abaixo de `abaixoDe` (1 = ja na abertura),
 *               ergue um escudo de `fracao` da vida maxima, uma vez
 *   invocar     a cada `cada` turnos chama um aliado (ate `max`) que bate
 *               junto com `fracao` do ATQ
 *   enfurecer   abaixo de `abaixoDe` de vida, ganha `atq` de ATQ, uma vez
 *   enfraquecer na abertura, tira `atq` e `def` (fracoes) do oponente
 *   reviver     na primeira vez que cairia, volta com `fracao` da vida
 *   refletir    devolve `fracao` do dano que levou para quem bateu
 *   evasao      os primeiros `golpes` que o atingem passam batido
 *   passiva     nada de proprio: so os `efeitos` (regeneracao, furia...), que
 *               ja chegaram misturados no `hab` do lutador
 *
 * Tudo aqui e opt-in: quem nao tem `hab.especial` nao passa por nada disto.
 */
const especialDe = (lutador) => lutador.hab?.especial ?? null
const marcaDe = (esp) => ({ nome: esp.nome, emoji: esp.emoji, texto: esp.texto })

/** Uma linha de log para o que a habilidade fez fora de um golpe. */
function anunciar(log, quem, lutador, oponente, esp, extra = {}) {
  log.push({
    quem,
    tipo: 'especial',
    nome: lutador.nome,
    alvo: oponente.nome,
    especial: marcaDe(esp),
    hpQuemAtaca: lutador.hp,
    hpAlvo: oponente.hp,
    ...extra,
  })
}

/** O que a habilidade de cada lado faz antes do primeiro golpe. */
function abrirLuta(lado, log) {
  for (const id of ['a', 'b']) {
    const eu = lado[id]
    const outro = lado[id === 'a' ? 'b' : 'a']
    const esp = especialDe(eu)
    if (!esp) continue

    if (esp.tipo === 'enfraquecer') {
      outro.atq *= 1 - (esp.atq ?? 0)
      outro.def *= 1 - (esp.def ?? 0)
      anunciar(log, id, eu, outro, esp)
    } else if (esp.tipo === 'escudo' && esp.abaixoDe >= 1) {
      eu.escudo = Math.round(eu.hpMax * esp.fracao)
      eu.gastou.escudo = true
      anunciar(log, id, eu, outro, esp, { escudo: eu.escudo })
    }
  }
}

/**
 * O que a habilidade de quem acabou de apanhar faz em resposta: voltar do
 * fim, levantar o escudo, entrar em furia. Chamada depois de todo golpe que
 * tirou vida — do golpe comum, do revide, do reflexo.
 */
function reagir(lutador, id, oponente, log) {
  const esp = especialDe(lutador)
  if (!esp) return

  if (esp.tipo === 'reviver' && lutador.hp <= 0 && !lutador.gastou.reviver) {
    lutador.gastou.reviver = true
    lutador.hp = Math.max(1, Math.round(lutador.hpMax * esp.fracao))
    lutador.preso = false
    anunciar(log, id, lutador, oponente, esp, { reviveu: true })
    return
  }
  if (lutador.hp <= 0 || !lutador.hpMax) return

  const fracaoDeVida = lutador.hp / lutador.hpMax

  if (esp.tipo === 'escudo' && !lutador.gastou.escudo && fracaoDeVida < esp.abaixoDe) {
    lutador.gastou.escudo = true
    lutador.escudo = Math.round(lutador.hpMax * esp.fracao)
    anunciar(log, id, lutador, oponente, esp, { escudo: lutador.escudo })
  } else if (esp.tipo === 'enfurecer' && !lutador.gastou.enfurecer && fracaoDeVida < esp.abaixoDe) {
    lutador.gastou.enfurecer = true
    lutador.enfurecido = esp.atq
    anunciar(log, id, lutador, oponente, esp)
  }
}

/** Se o golpe deste turno e o especial. `turnos` ja contou o turno de agora. */
function deveGolpear(lutador, alvo, esp) {
  if (esp.quandoAlvoAbaixoDe) {
    return !lutador.gastou.golpe && alvo.hp / alvo.hpMax < esp.quandoAlvoAbaixoDe
  }
  return esp.cada > 0 && lutador.turnos % esp.cada === 0
}

/** O que o golpe especial faz alem do dano: parar o alvo, queimar, curar. */
function completarGolpeEspecial(resultado, alvo, esp, sorte) {
  if (resultado.esquivou) return

  if (esp.prende && sorte() < esp.prende) resultado.prendeu = true
  if (esp.cura) resultado.cura = (resultado.cura ?? 0) + Math.round(resultado.dano * esp.cura)
  if (esp.queima) {
    alvo.queima = { ...esp.queima }
    resultado.queimou = true
  }
}

/** Dano de queimadura no comeco do turno de quem esta queimando. */
function queimar(lutador) {
  const q = lutador.queima
  if (!q || lutador.hp <= 0) return 0

  const dano = Math.max(1, Math.round(lutador.hpMax * q.fracao))
  lutador.hp = Math.max(0, lutador.hp - dano)
  q.turnos--
  if (q.turnos <= 0) lutador.queima = null
  return dano
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

  abrirLuta(lado, log)

  while (lado.a.hp > 0 && lado.b.hp > 0 && rodadas < MAX_RODADAS * 2) {
    rodadas++
    const atacante = lado[vez]
    const alvoId = vez === 'a' ? 'b' : 'a'
    const alvo = lado[alvoId]

    // A queimadura de um golpe especial cobra no comeco do turno de quem esta
    // queimando — inclusive de quem vai perder a vez logo abaixo.
    const queimou = queimar(atacante)
    if (queimou > 0) {
      log.push({
        quem: vez,
        tipo: 'queimadura',
        nome: atacante.nome,
        dano: queimou,
        hpQuemAtaca: atacante.hp,
        hpMaxQuemAtaca: atacante.hpMax,
      })
      if (atacante.hp <= 0) break
    }

    if (atacante.preso) {
      atacante.preso = false
      log.push({ quem: vez, tipo: 'preso', nome: atacante.nome, alvo: alvo.nome, dano: 0, esquivou: false, critico: false })
      vez = alvoId
      continue
    }

    acumularFuria(atacante)
    atacante.turnos++

    const curou = regenerar(atacante)
    if (curou > 0) {
      log.push({ quem: vez, tipo: 'regenerou', nome: atacante.nome, cura: curou, hpQuemAtaca: atacante.hp })
    }

    const esp = especialDe(atacante)
    if (esp?.tipo === 'invocar' && atacante.invocados < esp.max && atacante.turnos % esp.cada === 0) {
      atacante.invocados++
      anunciar(log, vez, atacante, alvo, esp, { invocados: atacante.invocados })
    }

    // O turno pode render mais de um golpe: o proprio (que a habilidade de um
    // chefe pode trocar por um golpe especial), o segundo do Espadachim e os
    // dos servos.
    const especial = esp?.tipo === 'golpe' && deveGolpear(atacante, alvo, esp)
    if (especial && esp.quandoAlvoAbaixoDe) atacante.gastou.golpe = true

    const golpes = [{ quem: atacante, marca: especial ? 'especial' : null }]
    if (atacante.hab.golpeDuplo && sorte() < atacante.hab.golpeDuplo) {
      golpes.push({ quem: atacante, marca: 'duplo' })
    }
    if (atacante.hab.servo) {
      golpes.push({ quem: servoDe(atacante, atacante.hab.servo), marca: 'servo' })
    }
    if (esp?.tipo === 'invocar') {
      for (let i = 0; i < atacante.invocados; i++) {
        golpes.push({ quem: servoDe(atacante, esp.fracao, esp.aliado ?? `Aliado de ${atacante.nome}`), marca: 'servo' })
      }
    }

    for (const { quem, marca } of golpes) {
      if (alvo.hp <= 0) break
      const resultado = golpe(quem, alvo, sorte, marca === 'especial' ? esp : undefined)
      if (marca === 'especial') completarGolpeEspecial(resultado, alvo, esp, sorte)
      aplicar(resultado, atacante, alvo)

      log.push({
        quem: vez,
        tipo: 'ataque',
        marca,
        nome: quem.nome,
        alvo: alvo.nome,
        ...resultado,
        ...(marca === 'especial' ? { especial: marcaDe(esp) } : {}),
        hpAlvo: alvo.hp,
        hpMaxAlvo: alvo.hpMax,
        hpQuemAtaca: atacante.hp,
      })

      reagir(alvo, alvoId, atacante, log)

      // Reflexo: quem tem a habilidade devolve parte do que levou. Conta so o
      // que passou pelo escudo, e nunca reflete de volta.
      const reflexo = especialDe(alvo)
      const tomou = resultado.dano - (resultado.absorvido ?? 0)
      if (reflexo?.tipo === 'refletir' && !resultado.esquivou && tomou > 0) {
        const volta = Math.max(1, Math.round(tomou * reflexo.fracao))
        atacante.hp = Math.max(0, atacante.hp - volta)
        log.push({
          quem: alvoId,
          tipo: 'reflexo',
          nome: alvo.nome,
          alvo: atacante.nome,
          especial: marcaDe(reflexo),
          dano: volta,
          hpAlvo: atacante.hp,
          hpMaxAlvo: atacante.hpMax,
          hpQuemAtaca: alvo.hp,
        })
        if (atacante.hp <= 0) break
      }

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
        reagir(atacante, vez, alvo, log)
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
  if (l.tipo === 'curaGrupo') return `🙌 ${l.nome} curou o grupo em *${l.cura}*`
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
 *
 * Um chefe pode trazer mais que isso, tudo opcional — o Coração do Abismo
 * (rpg/coracao.js) usa os tres:
 *
 *   laser        { cada, alvos, mult, perfuracao }: a cada `cada` rodadas o
 *                chefe atira em `alvos` jogadores diferentes, no lugar do
 *                golpe da rodada. Nao da para desviar
 *   furia        { abaixoDe, atq, laserCada }: quando a vida cai abaixo de
 *                `abaixoDe`, uma vez, o ataque dele sobe `atq` e o laser
 *                passa a sair a cada `laserCada` rodadas
 *   maxRodadas   o teto de rodadas (30 se nao vier)
 *   estados      se verdadeiro, o log ganha um retrato do grupo no fim de cada
 *                rodada — e o que a tela usa para acertar as barras de vida
 */
export function lutarEmGrupo(jogadores, chefeBase, sorte = Math.random) {
  const time = jogadores.map((j) => ({ ...prepararLutador(j), caido: false }))
  const chefe = prepararLutador(chefeBase)
  const log = []
  const maxRodadas = chefeBase.maxRodadas ?? MAX_RODADAS_GRUPO
  let rodada = 0

  const retrato = () => {
    if (!chefe.estados) return
    log.push({
      rodada,
      tipo: 'estado',
      hpChefe: chefe.hp,
      time: time.map((j) => ({ nome: j.nome, hp: j.hp, caido: j.caido })),
    })
  }

  while (chefe.hp > 0 && time.some((j) => !j.caido) && rodada < maxRodadas) {
    rodada++

    for (const jogador of [...time].sort((a, b) => b.agi - a.agi)) {
      if (jogador.caido || chefe.hp <= 0) continue
      acumularFuria(jogador)
      regenerar(jogador)

      // Cura do grupo: so existe em luta de grupo. Numa luta sozinho o campo
      // nao faz nada — quem tem a habilidade ja carrega regeneracao propria.
      // Levanta quem esta de pe; quem caiu continua caido.
      if (jogador.hab.curaDoGrupo) {
        let total = 0
        let curados = 0
        for (const aliado of time) {
          if (aliado.caido || aliado.hp >= aliado.hpMax) continue
          const antes = aliado.hp
          aliado.hp = Math.min(aliado.hpMax, aliado.hp + Math.round(aliado.hpMax * jogador.hab.curaDoGrupo))
          total += aliado.hp - antes
          curados++
        }
        if (curados) log.push({ rodada, tipo: 'curaGrupo', nome: jogador.nome, cura: total, curados })
      }

      const golpes = [{ quem: jogador, marca: null }]
      if (jogador.hab.golpeDuplo && sorte() < jogador.hab.golpeDuplo) golpes.push({ quem: jogador, marca: 'duplo' })
      if (jogador.hab.servo) golpes.push({ quem: servoDe(jogador, jogador.hab.servo), marca: 'servo' })

      for (const { quem, marca } of golpes) {
        if (chefe.hp <= 0) break
        const g = golpe(quem, chefe, sorte)
        aplicar(g, jogador, chefe)
        log.push({ rodada, tipo: 'ataque', marca, nome: quem.nome, dono: jogador.nome, ...g, hpChefe: chefe.hp })
      }
    }

    if (chefe.hp <= 0) break

    // A furia chega uma vez, quando a vida passa do limiar.
    if (chefe.furia && !chefe.enfurecido && chefe.hp / chefe.hpMax < chefe.furia.abaixoDe) {
      chefe.enfurecido = chefe.furia.atq
      log.push({ rodada, tipo: 'furia', nome: chefe.nome, hpChefe: chefe.hp })
    }

    if (chefe.preso) {
      chefe.preso = false
      log.push({ rodada, tipo: 'preso', nome: chefe.nome })
      retrato()
      continue
    }

    const dePe = time.filter((j) => !j.caido)
    const laserCada = chefe.enfurecido ? chefe.furia.laserCada ?? chefe.laser?.cada : chefe.laser?.cada
    const ehLaser = Boolean(chefe.laser) && laserCada > 0 && rodada % laserCada === 0
    const ehArea = chefe.areaCada > 0 && rodada % chefe.areaCada === 0

    if (ehLaser) {
      // Sorteia quem leva, sem repetir: o feixe nao acerta o mesmo duas vezes.
      const fila = [...dePe]
      const atingidos = []
      for (let i = 0; i < chefe.laser.alvos && fila.length; i++) {
        const alvo = fila.splice(Math.floor(sorte() * fila.length), 1)[0]
        const g = golpe(chefe, alvo, sorte, {
          mult: chefe.laser.mult,
          perfuracao: chefe.laser.perfuracao,
          semEsquiva: true,
        })
        alvo.hp = Math.max(0, alvo.hp - g.dano)
        if (alvo.hp === 0) alvo.caido = true
        atingidos.push({
          nome: alvo.nome,
          dano: g.dano,
          critico: g.critico,
          hpAlvo: alvo.hp,
          hpMaxAlvo: alvo.hpMax,
          derrubou: alvo.caido,
        })
      }
      log.push({ rodada, tipo: 'laser', nome: chefe.nome, alvos: atingidos })
    } else if (ehArea) {
      const derrubados = []
      const danos = []
      for (const alvo of dePe) {
        const g = golpe(chefe, alvo, sorte)
        const dano = Math.max(1, Math.round(g.dano * (chefe.areaMultiplicador ?? 0.6)))
        alvo.hp = Math.max(0, alvo.hp - dano)
        if (alvo.hp === 0) {
          alvo.caido = true
          derrubados.push(alvo.nome)
        }
        danos.push({ nome: alvo.nome, dano, hp: alvo.hp })
      }
      log.push({ rodada, tipo: 'area', nome: chefe.nome, atingidos: dePe.length, derrubados, danos })
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

    retrato()
  }

  // O retrato do fim: quem venceu e quem caiu, como a luta terminou.
  retrato()

  return {
    venceu: chefe.hp <= 0,
    rodadas: rodada,
    log,
    chefe,
    time,
    dePe: time.filter((j) => !j.caido).length,
  }
}
