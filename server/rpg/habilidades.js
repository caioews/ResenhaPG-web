/**
 * Habilidades de classe — o que cada degrau da evolucao liga dentro da luta.
 *
 * Cada habilidade e so um punhado de numeros. O simulador (combate.js) le
 * esses campos e aplica; nada de callback aqui de proposito, para a
 * habilidade poder ser mostrada no /perfil, testada isoladamente e ajustada
 * sem mexer no motor de combate.
 *
 * Elas ACUMULAM ao longo do caminho: um Ceifador Noturno carrega Instinto
 * (Ladino) + Execução (Assassino) + Passo das Sombras (Sicário) + Execução
 * Sombria. Por isso as de nivel 150 e 200 sao individualmente mais modestas
 * do que a descricao sugere — quem chega la tem varias somadas, nao uma.
 *
 * Cuidado com os efeitos que sao objeto (execucao, maldicao, furia): esses
 * nao somam, fica o mais forte do caminho (ver juntarEfeitos). Uma habilidade
 * de cima com o mesmo objeto mais fraco que o de baixo simplesmente nao faz
 * nada — foi o que acontecia com a Fúria do Campeão e do Imperador e com a
 * Execução Sombria, e por isso as delas agora superam a do degrau anterior.
 *
 * Os numeros sairam de simulacao (npm run classes): a meta e que toda classe
 * de um mesmo degrau tenha forca parecida, somando PvP e PvE.
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
 *   curaDoGrupo       fracao do HP maximo de cada aliado de pe curada a cada
 *                     turno proprio — so em luta de grupo (raid, evento)
 *
 * Campos lidos fora do combate (encontro/abismo):
 *   saqueGold         gold extra sobre o premio
 *   saqueDrop         chance de drop somada
 */
import { CLASSES } from './classes.js'


export const HABILIDADES = {
  // ================================================== nivel 1 (classe base)
  //
  // Passivas das classes base que ficavam para tras. Guerreiro e Clerigo nao
  // tem: a vida e a defesa deles ja fazem esse papel. Como toda habilidade,
  // estas acumulam — valem para a linhagem inteira, e os numeros das
  // habilidades de cima foram calibrados ja contando com elas.

  instinto: {
    nome: 'Instinto',
    emoji: '👣',
    resumo: 'Acha a brecha na guarda: +13% de crítico, ignora 16% da defesa e +13% de dano.',
    efeitos: { critico: 0.13, perfuracao: 0.16, danoExtra: 0.13 },
  },
  olhoDeAguia: {
    nome: 'Olho de Águia',
    emoji: '🔭',
    resumo: 'Mira no ponto certo: corta 10% da esquiva do alvo, ignora 14% da defesa e +8% de dano.',
    efeitos: { precisao: 0.1, perfuracao: 0.14, danoExtra: 0.08 },
  },
  cadencia: {
    nome: 'Cadência',
    emoji: '🥁',
    resumo: 'Luta no próprio ritmo: +11% de dano, +7% de esquiva e leva 4% menos dano.',
    efeitos: { danoExtra: 0.11, esquivaExtra: 0.07, reducaoDeDano: 0.04 },
  },
  focoArcano: {
    nome: 'Foco Arcano',
    emoji: '🔷',
    resumo: 'Magia concentrada atravessa armadura: ignora 16% da defesa e +13% de dano.',
    efeitos: { perfuracao: 0.16, danoExtra: 0.13 },
  },
  guardaAlta: {
    nome: 'Guarda Alta',
    emoji: '⚜️',
    resumo: 'Nunca baixa a guarda: 11% de chance de revidar, +6% de crítico e leva 4% menos dano.',
    efeitos: { contraAtaque: 0.11, critico: 0.06, reducaoDeDano: 0.04 },
  },

  // =================================================== nivel 50 (especialidade)

  luzSagrada: {
    nome: 'Luz Sagrada',
    emoji: '✨',
    resumo: 'Recupera 8% do dano causado, leva 13% menos dano e bate 9% mais forte.',
    efeitos: { vampirismo: 0.08, reducaoDeDano: 0.13, danoExtra: 0.09 },
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
    resumo:
      'Cada acerto tira 7% da defesa do alvo, até derreter metade dela. Ignora 12% da defesa e +12% de dano.',
    efeitos: { maldicao: { porAcerto: 0.07, teto: 0.5 }, perfuracao: 0.12, danoExtra: 0.12 },
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
    resumo: '12% de chance de prender o alvo no lugar, leva 10% menos dano e +8% de dano.',
    efeitos: { prender: 0.12, reducaoDeDano: 0.1, danoExtra: 0.08 },
  },
  armadilha: {
    nome: 'Armadilha',
    emoji: '🪤',
    resumo:
      '18% de chance por golpe de prender o alvo e fazê-lo perder a vez. Ignora 9% da defesa e +9% de dano.',
    efeitos: { prender: 0.18, perfuracao: 0.09, danoExtra: 0.09 },
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
    resumo: '38% de chance de encaixar um segundo golpe no mesmo turno, e +5% de dano.',
    efeitos: { golpeDuplo: 0.38, danoExtra: 0.05 },
  },
  contrato: {
    nome: 'Contrato',
    emoji: '🎯',
    resumo: 'Bate até +76% mais forte conforme o alvo perde vida, +5% de dano e +20% de gold.',
    efeitos: { progressivo: 0.76, saqueGold: 0.2, danoExtra: 0.05 },
  },
  balada: {
    nome: 'Balada de Guerra',
    emoji: '🎵',
    resumo: 'Recupera 3% da vida máxima por turno, leva 7% menos dano e +5% de dano.',
    efeitos: { regeneracao: 0.03, reducaoDeDano: 0.07, danoExtra: 0.05 },
  },
  presciencia: {
    nome: 'Presciência',
    emoji: '🔯',
    resumo: '+9% de esquiva, +15% de crítico e +9% de dano — já viu o golpe acontecer.',
    efeitos: { esquivaExtra: 0.09, critico: 0.15, danoExtra: 0.09 },
  },
  bencao: {
    nome: 'Bênção',
    emoji: '🕊️',
    resumo: 'Recupera 4% da vida máxima por turno e leva 5% menos dano.',
    efeitos: { regeneracao: 0.04, reducaoDeDano: 0.05 },
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
    resumo: 'Ignora 18% da defesa, +6% de esquiva, +9% de crítico e +12% de dano — some antes do revide.',
    efeitos: { perfuracao: 0.18, esquivaExtra: 0.06, critico: 0.09, danoExtra: 0.12 },
  },
  toxina: {
    nome: 'Toxina',
    emoji: '🧪',
    resumo:
      'Cada acerto corrói 4% da defesa do alvo (até −30%). +9% de dano, leva 9% menos e recupera 6% do que causa.',
    efeitos: { maldicao: { porAcerto: 0.04, teto: 0.3 }, danoExtra: 0.09, reducaoDeDano: 0.09, vampirismo: 0.06 },
  },
  duplicatas: {
    nome: 'Duplicatas',
    emoji: '🃏',
    resumo: '+17% de esquiva e +9% de dano: metade dos golpes acerta uma cópia.',
    efeitos: { esquivaExtra: 0.17, danoExtra: 0.09 },
  },
  sabotagem: {
    nome: 'Sabotagem',
    emoji: '💣',
    resumo: '+18% de dano, 8% de chance de prender e +15% de gold.',
    efeitos: { danoExtra: 0.18, prender: 0.08, saqueGold: 0.15 },
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
    resumo: '+19% de dano e recupera 12% do que causa.',
    efeitos: { danoExtra: 0.19, vampirismo: 0.12 },
  },
  sedeDeVitoria: {
    nome: 'Sede de Vitória',
    emoji: '🏆',
    resumo: '+6% de ataque por rodada (até +55%), +16% de crítico e +9% de dano.',
    efeitos: { furia: { porRodada: 0.06, teto: 0.55 }, critico: 0.16, danoExtra: 0.09 },
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
    resumo: '+12% de dano e leva 9% menos — o corpo virou elemento.',
    efeitos: { danoExtra: 0.12, reducaoDeDano: 0.09 },
  },
  legiao: {
    nome: 'Legião de Ossos',
    emoji: '🦴',
    resumo: 'Mais mortos na fila: +42% do seu ataque por turno.',
    efeitos: { servo: 0.42 },
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
    resumo: '18% de chance de revidar quando é atingido, leva 6% menos dano e +2% de dano.',
    efeitos: { contraAtaque: 0.18, reducaoDeDano: 0.06, danoExtra: 0.02 },
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
    resumo: 'Leva 13% menos dano, +7% de dano e +10% de chance de drop — veste o que abateu.',
    efeitos: { reducaoDeDano: 0.13, danoExtra: 0.07, saqueDrop: 0.1 },
  },
  contraGolpe: {
    nome: 'Contra-Golpe',
    emoji: '⚔️',
    resumo: '29% de chance de revidar quando é atingido, e +9% de dano.',
    efeitos: { contraAtaque: 0.29, danoExtra: 0.09 },
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
    resumo: 'Bate até +35% mais forte conforme o alvo perde vida, +12% de dano e +6% de crítico.',
    efeitos: { progressivo: 0.35, danoExtra: 0.12, critico: 0.06 },
  },
  arsenal: {
    nome: 'Arsenal',
    emoji: '🧰',
    resumo: '9% de chance de prender, ignora 18% da defesa, +6% de dano e +8% de drop.',
    efeitos: { prender: 0.09, perfuracao: 0.18, danoExtra: 0.06, saqueDrop: 0.08 },
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
    resumo: '10% de chance de atordoar, corta 13% da esquiva do alvo e +2% de dano.',
    efeitos: { prender: 0.1, precisao: 0.13, danoExtra: 0.02 },
  },
  fioDaSorte: {
    nome: 'Fio da Sorte',
    emoji: '🕯️',
    resumo: '+10% de esquiva, +9% de crítico e +4% de dano.',
    efeitos: { esquivaExtra: 0.1, critico: 0.09, danoExtra: 0.04 },
  },
  segredos: {
    nome: 'Segredos Perdidos',
    emoji: '📖',
    resumo: 'Ignora 24% da defesa, cada acerto derrete mais 3% (até −24%) e +8% de dano.',
    efeitos: { perfuracao: 0.24, maldicao: { porAcerto: 0.03, teto: 0.24 }, danoExtra: 0.08 },
  },
  graca: {
    nome: 'Graça',
    emoji: '☀️',
    resumo: 'Recupera 2% da vida máxima por turno e leva 6% menos dano.',
    efeitos: { regeneracao: 0.02, reducaoDeDano: 0.06 },
  },
  furiaSagrada: {
    nome: 'Fúria Sagrada',
    emoji: '⚖️',
    resumo: '+23% de dano, ignora 14% da defesa e +9% de crítico.',
    efeitos: { danoExtra: 0.23, perfuracao: 0.14, critico: 0.09 },
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
    resumo:
      '14% de chance de executar pela sombra do alvo: dano triplo ignorando 70% da defesa. +9% de dano, +5% de esquiva e leva 9% menos.',
    efeitos: { execucao: { chance: 0.14, mult: 3, perfuracao: 0.7 }, danoExtra: 0.09, esquivaExtra: 0.05, reducaoDeDano: 0.09 },
  },
  praga: {
    nome: 'Praga',
    emoji: '☣️',
    resumo:
      'Cada acerto apodrece 6% da defesa (até −45%). +17% de dano, leva 9% menos e recupera 6% do que causa.',
    efeitos: { maldicao: { porAcerto: 0.06, teto: 0.45 }, danoExtra: 0.17, reducaoDeDano: 0.09, vampirismo: 0.06 },
  },
  miragem: {
    nome: 'Miragem',
    emoji: '🎭',
    resumo: '+13% de esquiva, 17% de chance de revidar de onde não esperavam e +10% de dano.',
    efeitos: { esquivaExtra: 0.13, contraAtaque: 0.17, danoExtra: 0.1 },
  },
  redeDeContatos: {
    nome: 'Rede de Contatos',
    emoji: '👑',
    resumo:
      'Capangas atacam junto (25% do ataque), +9% de dano, +6% de esquiva, +30% de gold e +12% de drop.',
    efeitos: { servo: 0.25, danoExtra: 0.09, esquivaExtra: 0.06, saqueGold: 0.3, saqueDrop: 0.12 },
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
    resumo:
      '+7% de ataque por rodada, até +65%. +6% de dano, +5% de crítico, leva 9% menos e recupera 6% do que causa.',
    efeitos: { furia: { porRodada: 0.07, teto: 0.65 }, danoExtra: 0.06, critico: 0.05, reducaoDeDano: 0.09, vampirismo: 0.06 },
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
    resumo: 'Um avatar da entidade luta junto, com 50% do seu ataque, e leva 6% menos dano.',
    efeitos: { servo: 0.5, reducaoDeDano: 0.06 },
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
    resumo: 'A morte é temporária: regenera 5% por turno, leva 14% menos dano e +9% de dano.',
    efeitos: { regeneracao: 0.05, reducaoDeDano: 0.14, danoExtra: 0.09 },
  },
  sedeDeSangue: {
    nome: 'Sede de Sangue',
    emoji: '🍷',
    resumo: 'Recupera 12% de todo dano causado, bate +19% mais forte e +6% de crítico.',
    efeitos: { vampirismo: 0.12, danoExtra: 0.19, critico: 0.06 },
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
    resumo: 'Veste qualquer fera já abatida: +14% de dano, 11% menos dano recebido, +12% de drop.',
    efeitos: { danoExtra: 0.14, reducaoDeDano: 0.11, saqueDrop: 0.12 },
  },
  laminasEspectrais: {
    nome: 'Lâminas Espectrais',
    emoji: '🗡️',
    resumo: '34% de chance de um golpe extra, ignora 18% da defesa e +9% de dano.',
    efeitos: { golpeDuplo: 0.34, perfuracao: 0.18, danoExtra: 0.09 },
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
    resumo: 'Bate até +45% mais forte conforme o alvo cai, +14% de crítico, +9% de dano e leva 9% menos.',
    efeitos: { progressivo: 0.45, critico: 0.14, danoExtra: 0.09, reducaoDeDano: 0.09 },
  },
  carrasco: {
    nome: 'Execução Solitária',
    emoji: '🪓',
    resumo:
      '10% de chance de execução ignorando 60% da defesa, +12% de dano e +6% de crítico. Sozinho é onde ele é pior.',
    efeitos: { execucao: { chance: 0.1, mult: 2.6, perfuracao: 0.6 }, danoExtra: 0.12, critico: 0.06 },
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
    resumo: '+14% de esquiva, +13% de crítico e +9% de dano — o golpe fatal vira arranhão.',
    efeitos: { esquivaExtra: 0.14, critico: 0.13, danoExtra: 0.09 },
  },
  nomeVerdadeiro: {
    nome: 'Nome Verdadeiro',
    emoji: '🔇',
    resumo: 'Ignora 22% da defesa, cada acerto desfaz mais 4% (até −32%), +12% de dano e +6% de crítico.',
    efeitos: { perfuracao: 0.22, maldicao: { porAcerto: 0.04, teto: 0.32 }, danoExtra: 0.12, critico: 0.06 },
  },
  // A cura do grupo so age em raid e evento em grupo. A regeneracao propria e
  // pequena de proposito: somada a Bencao e a Graca, a linha do Sacerdote
  // chegava a 20% da vida por turno e nao morria para nada.
  milagre: {
    nome: 'Milagre',
    emoji: '🙌',
    resumo:
      'Regenera 2% da vida máxima por turno e leva 9% menos dano. Em raid e evento em grupo, cura todos que estão de pé em 5% da vida deles, a cada turno seu.',
    efeitos: { regeneracao: 0.02, reducaoDeDano: 0.09, curaDoGrupo: 0.05 },
  },
  julgamento: {
    nome: 'Julgamento',
    emoji: '⚔️',
    resumo: '+22% de dano, ignora 20% da defesa e +6% de crítico — proteção impura não conta.',
    efeitos: { danoExtra: 0.22, perfuracao: 0.2, critico: 0.06 },
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
