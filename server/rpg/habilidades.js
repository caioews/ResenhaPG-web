/**
 * Habilidades de classe — o que cada degrau da evolucao liga dentro da luta.
 *
 * Cada habilidade e so um punhado de numeros. O simulador (combate.js) le
 * esses campos e aplica; nada de callback aqui de proposito, para a
 * habilidade poder ser mostrada no /perfil, testada isoladamente e ajustada
 * sem mexer no motor de combate.
 *
 * Elas ACUMULAM ao longo do caminho: um Ceifador Noturno carrega Execução
 * (Assassino) + Passo das Sombras (Sicário) + Execução Sombria. Por isso as
 * de nivel 150 e 200 sao individualmente mais modestas do que a descricao
 * sugere — quem chega la tem tres somadas, nao uma.
 *
 * Campos que o combate entende:
 *   perfuracao        fracao da DEF do alvo que o golpe ignora
 *   execucao          { chance, mult, perfuracao } golpe que encerra a luta
 *   progressivo       ate quanto o dano cresce conforme o alvo perde vida
 *   golpeDuplo        chance de atacar de novo no mesmo turno
 *   servo             fracao do ATQ que um segundo atacante bate todo turno
 *   vampirismo        fracao do dano causado que volta como vida
 *   reducaoDeDano     fracao do dano recebido que e cortada
 *   furia             { porRodada, teto } ATQ ganho por rodada, acumulando
 *   maldicao          { porAcerto, teto } DEF que o alvo perde a cada acerto
 *   prender           chance do alvo perder o turno seguinte
 *   esquivaExtra      chance de esquiva somada a que a agilidade ja da
 *   danoExtra         fracao somada ao dano final (usado pelos feiticos)
 *   regeneracao       fracao do HP maximo recuperada a cada turno proprio
 *   contraAtaque      chance de revidar quando e atingido
 *   iniciativa        comeca a luta independente da agilidade
 *   precisao          quanto corta da esquiva do alvo
 *   critico           chance de critico somada a que a agilidade ja da
 *
 * Campos lidos fora do combate (encontro/abismo):
 *   saqueGold         gold extra sobre o premio
 *   saqueDrop         chance de drop somada
 */
import { CLASSES } from './classes.js'


export const HABILIDADES = {
  // =================================================== nivel 50 (especialidade)

  luzSagrada: {
    nome: 'Luz Sagrada',
    emoji: '✨',
    resumo: 'Recupera 8% do dano causado e leva 7% menos dano.',
    efeitos: { vampirismo: 0.08, reducaoDeDano: 0.07 },
  },
  furia: {
    nome: 'Fúria da Arena',
    emoji: '🔥',
    resumo: '+5% de ataque a cada rodada, acumulando até +45%.',
    efeitos: { furia: { porRodada: 0.05, teto: 0.45 } },
  },
  maldicao: {
    nome: 'Maldição',
    emoji: '🧿',
    resumo: 'Cada acerto tira 7% da defesa do alvo, até derreter metade dela.',
    efeitos: { maldicao: { porAcerto: 0.07, teto: 0.5 } },
  },
  servo: {
    nome: 'Servo',
    emoji: '💀',
    resumo: 'Um servo ataca junto todo turno, com 45% do seu ataque.',
    efeitos: { servo: 0.45 },
  },
  raizes: {
    nome: 'Raízes',
    emoji: '🌿',
    resumo: '12% de chance de prender o alvo no lugar, e leva 6% menos dano.',
    efeitos: { prender: 0.12, reducaoDeDano: 0.06 },
  },
  armadilha: {
    nome: 'Armadilha',
    emoji: '🪤',
    resumo: '18% de chance por golpe de prender o alvo e fazê-lo perder a vez.',
    efeitos: { prender: 0.18 },
  },
  execucao: {
    nome: 'Execução',
    emoji: '🩸',
    resumo: '12% de chance de executar: dano triplo ignorando metade da defesa.',
    efeitos: { execucao: { chance: 0.12, mult: 3, perfuracao: 0.5 } },
  },
  saque: {
    nome: 'Mãos Leves',
    emoji: '🪙',
    resumo: '+10% de esquiva, +35% de gold em tudo que derrota e +15% de chance de drop.',
    efeitos: { esquivaExtra: 0.1, saqueGold: 0.35, saqueDrop: 0.15 },
  },
  golpeDuplo: {
    nome: 'Sequência',
    emoji: '🤺',
    resumo: '30% de chance de encaixar um segundo golpe no mesmo turno.',
    efeitos: { golpeDuplo: 0.3 },
  },
  contrato: {
    nome: 'Contrato',
    emoji: '🎯',
    resumo: 'Bate até +60% mais forte conforme o alvo perde vida. +20% de gold.',
    efeitos: { progressivo: 0.6, saqueGold: 0.2 },
  },
  balada: {
    nome: 'Balada de Guerra',
    emoji: '🎵',
    resumo: 'Recupera 3% da vida máxima por turno e leva 5% menos dano.',
    efeitos: { regeneracao: 0.03, reducaoDeDano: 0.05 },
  },
  presciencia: {
    nome: 'Presciência',
    emoji: '🔯',
    resumo: '+9% de esquiva e +8% de chance de crítico — já viu o golpe acontecer.',
    efeitos: { esquivaExtra: 0.09, critico: 0.08 },
  },
  bencao: {
    nome: 'Bênção',
    emoji: '🕊️',
    resumo: 'Recupera 10% da vida máxima por turno.',
    efeitos: { regeneracao: 0.10 },
  },
  ancestrais: {
    nome: 'Ancestrais',
    emoji: '🪶',
    resumo: 'Um espírito ataca junto (30% do seu ataque) e 18% de chance de revidar.',
    efeitos: { servo: 0.3, contraAtaque: 0.18 },
  },

  // ====================================================== nivel 150 (maestria)

  sombras: {
    nome: 'Passo das Sombras',
    emoji: '🌘',
    resumo: 'Ignora 18% da defesa e +6% de esquiva — some antes do revide.',
    efeitos: { perfuracao: 0.18, esquivaExtra: 0.06 },
  },
  toxina: {
    nome: 'Toxina',
    emoji: '🧪',
    resumo: 'Cada acerto corrói 4% da defesa do alvo, até −30%.',
    efeitos: { maldicao: { porAcerto: 0.04, teto: 0.3 } },
  },
  duplicatas: {
    nome: 'Duplicatas',
    emoji: '🃏',
    resumo: '+11% de esquiva: metade dos golpes acerta uma cópia.',
    efeitos: { esquivaExtra: 0.11 },
  },
  sabotagem: {
    nome: 'Sabotagem',
    emoji: '💣',
    resumo: '+9% de dano, 8% de chance de prender e +15% de gold.',
    efeitos: { danoExtra: 0.09, prender: 0.08, saqueGold: 0.15 },
  },
  juramento: {
    nome: 'Juramento',
    emoji: '🛡️',
    resumo: 'Leva 9% menos dano e recupera 2% da vida máxima por turno.',
    efeitos: { reducaoDeDano: 0.09, regeneracao: 0.02 },
  },
  chamaPurificadora: {
    nome: 'Chama Purificadora',
    emoji: '🕯️',
    resumo: '+10% de dano e recupera 6% do que causa.',
    efeitos: { danoExtra: 0.1, vampirismo: 0.06 },
  },
  sedeDeVitoria: {
    nome: 'Sede de Vitória',
    emoji: '🏆',
    resumo: '+3% de ataque por rodada (até +30%) e +7% de crítico.',
    efeitos: { furia: { porRodada: 0.03, teto: 0.3 }, critico: 0.07 },
  },
  grilhoes: {
    nome: 'Grilhões',
    emoji: '⛓️',
    resumo: '11% de chance de prender e corta 12% da esquiva do alvo.',
    efeitos: { prender: 0.11, precisao: 0.12 },
  },
  pacto: {
    nome: 'Pacto',
    emoji: '👁️',
    resumo: 'O pactuário ataca junto com 28% do seu ataque.',
    efeitos: { servo: 0.28 },
  },
  formaElemental: {
    nome: 'Forma Elemental',
    emoji: '🌊',
    resumo: '+10% de dano e leva 7% menos — o corpo virou elemento.',
    efeitos: { danoExtra: 0.1, reducaoDeDano: 0.07 },
  },
  legiao: {
    nome: 'Legião de Ossos',
    emoji: '🦴',
    resumo: 'Mais um morto na fila: +30% do seu ataque por turno.',
    efeitos: { servo: 0.3 },
  },
  tributoDeSangue: {
    nome: 'Tributo de Sangue',
    emoji: '🩸',
    resumo: '+13% de dano e recupera 7% do que causa.',
    efeitos: { danoExtra: 0.13, vampirismo: 0.07 },
  },
  espinhos: {
    nome: 'Espinhos',
    emoji: '🌱',
    resumo: '16% de chance de revidar quando é atingido, e leva 6% menos dano.',
    efeitos: { contraAtaque: 0.16, reducaoDeDano: 0.06 },
  },
  alcateia: {
    nome: 'Alcateia',
    emoji: '🐺',
    resumo: 'A fera companheira ataca junto com 32% do seu ataque.',
    efeitos: { servo: 0.32 },
  },
  pontoFraco: {
    nome: 'Ponto Fraco',
    emoji: '🔎',
    resumo: 'Ignora 20% da defesa e corta 10% da esquiva do alvo.',
    efeitos: { perfuracao: 0.2, precisao: 0.1 },
  },
  trofeus: {
    nome: 'Troféus',
    emoji: '🦴',
    resumo: 'Leva 8% menos dano e +10% de chance de drop — veste o que abateu.',
    efeitos: { reducaoDeDano: 0.08, saqueDrop: 0.1 },
  },
  contraGolpe: {
    nome: 'Contra-Golpe',
    emoji: '⚔️',
    resumo: '20% de chance de revidar quando é atingido.',
    efeitos: { contraAtaque: 0.2 },
  },
  postura: {
    nome: 'Postura Real',
    emoji: '👑',
    resumo: 'Começa a luta sempre. Corta 10% da esquiva do alvo e leva 5% menos dano.',
    efeitos: { iniciativa: true, precisao: 0.1, reducaoDeDano: 0.05 },
  },
  marcado: {
    nome: 'Alvo Marcado',
    emoji: '🎯',
    resumo: 'Bate até +35% mais forte conforme o alvo perde vida.',
    efeitos: { progressivo: 0.35 },
  },
  arsenal: {
    nome: 'Arsenal',
    emoji: '🧰',
    resumo: '9% de chance de prender, ignora 12% da defesa e +8% de drop.',
    efeitos: { prender: 0.09, perfuracao: 0.12, saqueDrop: 0.08 },
  },
  melodiaCurativa: {
    nome: 'Melodia Curativa',
    emoji: '🎶',
    resumo: 'Recupera 3% da vida máxima por turno e 6% do dano causado.',
    efeitos: { regeneracao: 0.03, vampirismo: 0.06 },
  },
  dissonancia: {
    nome: 'Dissonância',
    emoji: '📢',
    resumo: '10% de chance de atordoar e corta 11% da esquiva do alvo.',
    efeitos: { prender: 0.1, precisao: 0.11 },
  },
  fioDaSorte: {
    nome: 'Fio da Sorte',
    emoji: '🕯️',
    resumo: '+10% de esquiva e +5% de crítico.',
    efeitos: { esquivaExtra: 0.1, critico: 0.05 },
  },
  segredos: {
    nome: 'Segredos Perdidos',
    emoji: '📖',
    resumo: 'Ignora 16% da defesa e cada acerto derrete mais 3%, até −24%.',
    efeitos: { perfuracao: 0.16, maldicao: { porAcerto: 0.03, teto: 0.24 } },
  },
  graca: {
    nome: 'Graça',
    emoji: '☀️',
    resumo: 'Recupera 4% da vida máxima por turno e leva 6% menos dano.',
    efeitos: { regeneracao: 0.04, reducaoDeDano: 0.06 },
  },
  furiaSagrada: {
    nome: 'Fúria Sagrada',
    emoji: '⚖️',
    resumo: '+11% de dano e ignora 14% da defesa do alvo.',
    efeitos: { danoExtra: 0.11, perfuracao: 0.14 },
  },
  espiritosDeGuerra: {
    nome: 'Espíritos de Guerra',
    emoji: '🗿',
    resumo: 'Mais um ancestral em campo: +28% do seu ataque, e 12% de revide.',
    efeitos: { servo: 0.28, contraAtaque: 0.12 },
  },
  meioEtereo: {
    nome: 'Meio Etéreo',
    emoji: '👻',
    resumo: '+10% de esquiva e ignora 14% da defesa — meio daqui, meio de lá.',
    efeitos: { esquivaExtra: 0.1, perfuracao: 0.14 },
  },

  // ====================================================== nivel 200 (apoteose)

  execucaoSombria: {
    nome: 'Execução Sombria',
    emoji: '🌑',
    resumo: '9% de chance de executar pela própria sombra do alvo, ignorando 70% da defesa.',
    efeitos: { execucao: { chance: 0.09, mult: 2.8, perfuracao: 0.7 }, esquivaExtra: 0.05 },
  },
  praga: {
    nome: 'Praga',
    emoji: '☣️',
    resumo: 'Cada acerto apodrece 5% da defesa (até −40%) e +8% de dano.',
    efeitos: { maldicao: { porAcerto: 0.05, teto: 0.4 }, danoExtra: 0.08 },
  },
  miragem: {
    nome: 'Miragem',
    emoji: '🎭',
    resumo: '+13% de esquiva e 12% de chance de revidar de onde não esperavam.',
    efeitos: { esquivaExtra: 0.13, contraAtaque: 0.12 },
  },
  redeDeContatos: {
    nome: 'Rede de Contatos',
    emoji: '👑',
    resumo: 'Capangas atacam junto (25% do ataque), +30% de gold e +12% de drop.',
    efeitos: { servo: 0.25, saqueGold: 0.3, saqueDrop: 0.12 },
  },
  veredito: {
    nome: 'Veredito',
    emoji: '⚖️',
    resumo: 'Leva 10% menos dano, revida 15% das vezes e regenera 2% por turno.',
    efeitos: { reducaoDeDano: 0.1, contraAtaque: 0.15, regeneracao: 0.02 },
  },
  redencao: {
    nome: 'Redenção',
    emoji: '🌟',
    resumo: 'Recupera 5% da vida máxima por turno e 8% do dano causado.',
    efeitos: { regeneracao: 0.05, vampirismo: 0.08 },
  },
  imperioDaArena: {
    nome: 'Império da Arena',
    emoji: '🔥',
    resumo: '+4% de ataque por rodada, até +50%. Quanto mais dura, pior para o outro.',
    efeitos: { furia: { porRodada: 0.04, teto: 0.5 }, critico: 0.05 },
  },
  correntesSemFim: {
    nome: 'Correntes Sem Fim',
    emoji: '⛓️',
    resumo: '14% de chance de prender, corta 14% da esquiva e leva 7% menos dano.',
    efeitos: { prender: 0.14, precisao: 0.14, reducaoDeDano: 0.07 },
  },
  avatarDoPacto: {
    nome: 'Avatar do Pacto',
    emoji: '🌀',
    resumo: 'Um avatar da entidade luta junto, com 38% do seu ataque.',
    efeitos: { servo: 0.38 },
  },
  formaPrimordial: {
    nome: 'Forma Primordial',
    emoji: '🌋',
    resumo: '+13% de dano, leva 9% menos e regenera 2% por turno.',
    efeitos: { danoExtra: 0.13, reducaoDeDano: 0.09, regeneracao: 0.02 },
  },
  phylactery: {
    nome: 'Phylactery',
    emoji: '☠️',
    resumo: 'A morte é temporária: regenera 5% por turno e leva 8% menos dano.',
    efeitos: { regeneracao: 0.05, reducaoDeDano: 0.08 },
  },
  sedeDeSangue: {
    nome: 'Sede de Sangue',
    emoji: '🍷',
    resumo: 'Recupera 12% de todo dano causado e bate +10% mais forte.',
    efeitos: { vampirismo: 0.12, danoExtra: 0.1 },
  },
  dominioVerde: {
    nome: 'Domínio Verde',
    emoji: '🌳',
    resumo: '15% de chance de prender, revida 14% das vezes e leva 7% menos dano.',
    efeitos: { prender: 0.15, contraAtaque: 0.14, reducaoDeDano: 0.07 },
  },
  formaHibrida: {
    nome: 'Forma Híbrida',
    emoji: '🐾',
    resumo: '+12% de dano, +7% de crítico e a fera continua atacando (25%).',
    efeitos: { danoExtra: 0.12, critico: 0.07, servo: 0.25 },
  },
  olhoDoFlagelo: {
    nome: 'Olho do Flagelo',
    emoji: '🐉',
    resumo: 'Ignora 24% da defesa, corta 12% da esquiva e +6% de crítico.',
    efeitos: { perfuracao: 0.24, precisao: 0.12, critico: 0.06 },
  },
  bestiario: {
    nome: 'Bestiário Vivo',
    emoji: '📕',
    resumo: 'Veste qualquer fera já abatida: +10% de dano, 8% menos dano recebido, +12% de drop.',
    efeitos: { danoExtra: 0.1, reducaoDeDano: 0.08, saqueDrop: 0.12 },
  },
  laminasEspectrais: {
    nome: 'Lâminas Espectrais',
    emoji: '🗡️',
    resumo: '22% de chance de um golpe extra e ignora 18% da defesa.',
    efeitos: { golpeDuplo: 0.22, perfuracao: 0.18 },
  },
  dueloImposto: {
    nome: 'Duelo Imposto',
    emoji: '👑',
    resumo: 'Começa sempre, +12% de dano e corta 12% da esquiva do alvo.',
    efeitos: { iniciativa: true, danoExtra: 0.12, precisao: 0.12 },
  },
  apex: {
    nome: 'Predação Apex',
    emoji: '🦅',
    resumo: 'Bate até +45% mais forte conforme o alvo cai, e +8% de crítico.',
    efeitos: { progressivo: 0.45, critico: 0.08 },
  },
  carrasco: {
    nome: 'Execução Solitária',
    emoji: '🪓',
    resumo: '10% de chance de execução ignorando 60% da defesa. Sozinho é onde ele é pior.',
    efeitos: { execucao: { chance: 0.1, mult: 2.6, perfuracao: 0.6 } },
  },
  versoQueCura: {
    nome: 'Verso que Cura',
    emoji: '🎼',
    resumo: 'Recupera 6% da vida máxima por turno e leva 7% menos dano.',
    efeitos: { regeneracao: 0.06, reducaoDeDano: 0.07 },
  },
  notaFinal: {
    nome: 'Nota Final',
    emoji: '🎺',
    resumo: '13% de chance de atordoar, corta 13% da esquiva e +9% de dano.',
    efeitos: { prender: 0.13, precisao: 0.13, danoExtra: 0.09 },
  },
  reescrever: {
    nome: 'Reescrever',
    emoji: '🧵',
    resumo: '+14% de esquiva e +8% de crítico — o golpe fatal vira arranhão.',
    efeitos: { esquivaExtra: 0.14, critico: 0.08 },
  },
  nomeVerdadeiro: {
    nome: 'Nome Verdadeiro',
    emoji: '🔇',
    resumo: 'Ignora 22% da defesa e cada acerto desfaz mais 4%, até −32%.',
    efeitos: { perfuracao: 0.22, maldicao: { porAcerto: 0.04, teto: 0.32 } },
  },
  maoDivina: {
    nome: 'Mão Viva',
    emoji: '🙌',
    resumo: 'Regenera 6% da vida máxima por turno e leva 9% menos dano.',
    efeitos: { regeneracao: 0.06, reducaoDeDano: 0.09 },
  },
  julgamento: {
    nome: 'Julgamento',
    emoji: '⚔️',
    resumo: '+13% de dano, ignora 20% da defesa — proteção impura não conta.',
    efeitos: { danoExtra: 0.13, perfuracao: 0.2 },
  },
  milEspiritos: {
    nome: 'Mil Espíritos',
    emoji: '🌬️',
    resumo: 'A hoste inteira em campo: +35% do ataque por turno e 15% de revide.',
    efeitos: { servo: 0.35, contraAtaque: 0.15 },
  },
  travessia: {
    nome: 'Travessia',
    emoji: '🌉',
    resumo: '+13% de esquiva, 10% de chance de arrastar o alvo para o outro lado.',
    efeitos: { esquivaExtra: 0.13, prender: 0.1, perfuracao: 0.1 },
  },
}

export const habilidade = (id) => HABILIDADES[id] ?? null

/**
 * Junta dois conjuntos de efeitos.
 *
 * Numeros somam; `iniciativa` e booleano (basta um lado ter); objetos com
 * chance propria (execucao, maldicao, furia) ficam com o mais forte dos
 * dois em vez de somar, senao um Assassino que vira Ceifador Noturno
 * executaria quase todo golpe.
 */
export function juntarEfeitos(a = {}, b = {}) {
  const saida = { ...a }

  for (const [chave, valor] of Object.entries(b)) {
    const atual = saida[chave]

    if (atual === undefined) {
      saida[chave] = valor
      continue
    }
    if (typeof valor === 'boolean' || typeof atual === 'boolean') {
      saida[chave] = Boolean(atual) || Boolean(valor)
      continue
    }
    if (typeof valor === 'number' && typeof atual === 'number') {
      saida[chave] = atual + valor
      continue
    }

    const forca = (x) => (x?.chance ?? x?.porAcerto ?? x?.porRodada ?? 0) * (x?.mult ?? 1)
    saida[chave] = forca(valor) > forca(atual) ? valor : atual
  }

  return saida
}

/**
 * Os efeitos de uma classe, somando o caminho inteiro.
 *
 * Recebe a ficha da classe (o objeto de classes.js). Como o caminho e
 * cumulativo, a funcao sobe a linhagem ate a base juntando tudo.
 */
export function efeitosDaClasse(classeInfo) {
  if (!classeInfo) return {}

  let efeitos = {}
  let atual = classeInfo

  while (atual) {
    const h = HABILIDADES[atual.habilidade]
    if (h) efeitos = juntarEfeitos(efeitos, h.efeitos)
    atual = atual.evoluiDe ? CLASSES[atual.evoluiDe] : null
  }

  return efeitos
}

/** As habilidades do caminho inteiro, da base ate a classe atual. */
export function habilidadesDaClasse(classeInfo) {
  const lista = []
  let atual = classeInfo

  while (atual) {
    if (HABILIDADES[atual.habilidade]) lista.unshift(atual.habilidade)
    atual = atual.evoluiDe ? CLASSES[atual.evoluiDe] : null
  }

  return lista
}

export function descreverHabilidade(id) {
  const h = habilidade(id)
  return h ? `${h.emoji} *${h.nome}* — ${h.resumo}` : ''
}
