/**
 * As classes jogaveis e a arvore de evolucao.
 *
 * Sao quatro degraus:
 *
 *   base            nivel 1    sete classes, o ponto de partida
 *   especialidade   nivel 50   duas por base, a primeira bifurcacao
 *   maestria        nivel 150  duas por especialidade
 *   apoteose        nivel 200  uma por maestria, o fim da linha
 *
 * Evoluir nunca troca o personagem de lugar: mantem a base do nivel 1 e
 * passa a crescer mais rapido, destrava armas e ACUMULA uma habilidade
 * nova. Um Ceifador Noturno carrega as tres habilidades do caminho dele
 * (Assassino + Sicario + Ceifador), nao so a ultima — e o que faz o
 * caminho inteiro importar, e nao apenas o ultimo degrau.
 *
 * Os `ganho` das especialidades sairam de simulacao (npm run balance). Os
 * degraus de 150 e 200 nao repetem esses numeros: declaram `crescimento`,
 * um multiplicador sobre o ganho do degrau anterior. O perfil (quem vira
 * mais duro, quem vira mais rapido) fica legivel numa linha, e a forca
 * total de cada degrau se ajusta num knob so — config.rpg.evolucao.
 */
import { config } from '../config.js'

/** Classes base: e por onde todo mundo comeca. */
const BASES = {
  guerreiro: {
    nome: 'Guerreiro',
    emoji: '🛡️',
    resumo: 'Muita vida e defesa. Aguenta pancada e devolve.',
    // base = nivel 1, ganho = por nivel a mais
    base: { hp: 120, atq: 12, def: 10, agi: 6 },
    ganho: { hp: 14, atq: 2.2, def: 2.0, agi: 0.8 },
    usa: ['espada', 'martelo', 'escudo', 'manopla'],
  },
  mago: {
    nome: 'Mago',
    emoji: '🔮',
    resumo: 'Dano altissimo, corpo frágil. Mata antes de apanhar.',
    base: { hp: 80, atq: 18, def: 5, agi: 8 },
    ganho: { hp: 8, atq: 3.2, def: 1.0, agi: 1.2 },
    usa: ['cajado', 'magia', 'grimorio', 'totem'],
  },
  arqueiro: {
    nome: 'Arqueiro',
    emoji: '🏹',
    resumo: 'Rápido e constante. Ataca primeiro e erra pouco.',
    base: { hp: 95, atq: 14, def: 6, agi: 12 },
    ganho: { hp: 10, atq: 2.6, def: 1.2, agi: 2.0 },
    usa: ['arco', 'aljava', 'capa'],
  },
  ladino: {
    nome: 'Ladino',
    emoji: '🗡️',
    resumo: 'Crítico e esquiva. Vence quando a sorte ajuda.',
    base: { hp: 90, atq: 15, def: 6, agi: 14 },
    ganho: { hp: 9, atq: 2.8, def: 1.1, agi: 2.4 },
    usa: ['adaga', 'punhal', 'capa'],
  },
  duelista: {
    nome: 'Duelista',
    emoji: '⚔️',
    resumo: 'Equilibrado. Bom em tudo, excelente em nada.',
    base: { hp: 105, atq: 13, def: 8, agi: 10 },
    ganho: { hp: 11, atq: 2.4, def: 1.6, agi: 1.6 },
    usa: ['espada', 'rapieira', 'punhal', 'manopla'],
  },
  bardo: {
    nome: 'Bardo',
    emoji: '🎵',
    resumo: 'Luta no ritmo que ele mesmo impõe. Rápido, e nunca luta do jeito esperado.',
    base: { hp: 100, atq: 13, def: 6, agi: 13 },
    ganho: { hp: 10.5, atq: 2.5, def: 1.2, agi: 2.1 },
    usa: ['flauta', 'tambor', 'mascara', 'capa'],
  },
  clerigo: {
    nome: 'Clérigo',
    emoji: '✝️',
    resumo: 'Aguenta e se refaz. Ganha as lutas que os outros não terminam.',
    base: { hp: 115, atq: 13, def: 9, agi: 7 },
    ganho: { hp: 13, atq: 2.3, def: 1.8, agi: 1.0 },
    usa: ['maca', 'cajado', 'totem', 'escudo'],
  },
}

/**
 * Especialidades — nivel 50. Os `ganho` daqui sao os calibrados por
 * simulacao; nao mexa neles sem rodar `npm run balance` depois.
 */
const ESPECIALIDADES = {
  // ---------------------------------------------------------- guerreiro
  paladino: {
    nome: 'Paladino',
    emoji: '✨',
    evoluiDe: 'guerreiro',
    resumo: 'O muro que se cura sozinho. Quanto mais bate, mais aguenta.',
    ganho: { hp: 15.9, atq: 2.43, def: 2.34, agi: 0.84 },
    usa: ['espada', 'martelo', 'escudo', 'manopla'],
    habilidade: 'luzSagrada',
  },
  gladiador: {
    nome: 'Gladiador',
    emoji: '🏟️',
    evoluiDe: 'guerreiro',
    resumo: 'Vai esquentando durante a luta. Briga longa é briga dele.',
    ganho: { hp: 15.5, atq: 3, def: 2.1, agi: 1.3 },
    usa: ['espada', 'martelo', 'escudo', 'manopla', 'machado'],
    habilidade: 'furia',
  },

  // --------------------------------------------------------------- mago
  bruxo: {
    nome: 'Bruxo',
    emoji: '🧿',
    evoluiDe: 'mago',
    resumo: 'Amaldiçoa a armadura do inimigo até não sobrar nada dela.',
    ganho: { hp: 10.27, atq: 4.11, def: 1.3, agi: 1.51 },
    usa: ['cajado', 'magia', 'grimorio', 'totem'],
    habilidade: 'maldicao',
  },
  necromante: {
    nome: 'Necromante',
    emoji: '💀',
    evoluiDe: 'mago',
    resumo: 'Nunca luta sozinho: um servo bate junto todo turno.',
    ganho: { hp: 10.42, atq: 3.36, def: 1.39, agi: 1.29 },
    usa: ['cajado', 'magia', 'grimorio', 'totem', 'caveira'],
    habilidade: 'servo',
  },

  // ----------------------------------------------------------- arqueiro
  guardiao: {
    nome: 'Guardião',
    emoji: '🌿',
    evoluiDe: 'arqueiro',
    resumo: 'Extensão da terra que defende. Raízes prendem, espinhos cansam.',
    ganho: { hp: 12.6, atq: 2.92, def: 1.61, agi: 2.32 },
    usa: ['arco', 'aljava', 'capa', 'totem'],
    habilidade: 'raizes',
  },
  cacadorDeFeras: {
    nome: 'Caçador de Feras',
    emoji: '🪤',
    evoluiDe: 'arqueiro',
    resumo: 'Estuda a presa antes de matar. Quem cai na armadilha perde a vez.',
    ganho: { hp: 12.6, atq: 2.92, def: 1.61, agi: 2.32 },
    usa: ['arco', 'aljava', 'capa', 'rede'],
    habilidade: 'armadilha',
  },

  // ------------------------------------------------------------- ladino
  assassino: {
    nome: 'Assassino',
    emoji: '🩸',
    evoluiDe: 'ladino',
    resumo: 'Um golpe no lugar certo encerra a conversa.',
    ganho: { hp: 10.93, atq: 3.6, def: 1.31, agi: 2.95 },
    usa: ['adaga', 'punhal', 'capa'],
    habilidade: 'execucao',
  },
  ladrao: {
    nome: 'Ladrão',
    emoji: '🪙',
    evoluiDe: 'ladino',
    resumo: 'Luta com a mão no bolso alheio. Sai mais rico de toda briga.',
    ganho: { hp: 12.25, atq: 3.5, def: 1.52, agi: 3.38 },
    usa: ['adaga', 'punhal', 'capa'],
    habilidade: 'saque',
  },

  // ----------------------------------------------------------- duelista
  espadachim: {
    nome: 'Espadachim',
    emoji: '🤺',
    evoluiDe: 'duelista',
    resumo: 'Técnica pura: onde cabe um golpe, ele encaixa dois.',
    ganho: { hp: 11.68, atq: 2.71, def: 1.68, agi: 1.77 },
    usa: ['espada', 'rapieira', 'punhal', 'manopla'],
    habilidade: 'golpeDuplo',
  },
  cacadorDeRecompensas: {
    nome: 'Caçador de Recompensas',
    emoji: '🎯',
    evoluiDe: 'duelista',
    resumo: 'Fecha contrato e cobra. Bate mais forte em alvo machucado.',
    ganho: { hp: 11.9, atq: 3.07, def: 1.68, agi: 1.98 },
    usa: ['espada', 'rapieira', 'punhal', 'manopla', 'pistola'],
    habilidade: 'contrato',
  },

  // -------------------------------------------------------------- bardo
  trovador: {
    nome: 'Trovador',
    emoji: '🎻',
    evoluiDe: 'bardo',
    resumo: 'A canção certa levanta quem já ia cair. Recupera-se lutando.',
    ganho: { hp: 12.4, atq: 2.85, def: 1.45, agi: 2.4 },
    usa: ['flauta', 'tambor', 'mascara', 'capa'],
    habilidade: 'balada',
  },
  oraculo: {
    nome: 'Oráculo',
    emoji: '🔯',
    evoluiDe: 'bardo',
    resumo: 'Já viu esta luta acontecer. Desvia do golpe antes de ele sair.',
    ganho: { hp: 11.8, atq: 3.0, def: 1.35, agi: 2.6 },
    usa: ['flauta', 'tambor', 'mascara', 'capa'],
    habilidade: 'presciencia',
  },

  // ------------------------------------------------------------ clerigo
  sacerdote: {
    nome: 'Sacerdote',
    emoji: '🕊️',
    evoluiDe: 'clerigo',
    resumo: 'A fé fecha o que a lâmina abriu. Sangra devagar e se refaz sempre.',
    ganho: { hp: 15.2, atq: 2.5, def: 2.1, agi: 1.1 },
    usa: ['maca', 'cajado', 'totem', 'escudo'],
    habilidade: 'bencao',
  },
  xama: {
    nome: 'Xamã',
    emoji: '🪶',
    evoluiDe: 'clerigo',
    resumo: 'Nunca está só: os ancestrais brigam junto e revidam por ele.',
    ganho: { hp: 14.3, atq: 2.9, def: 1.95, agi: 1.35 },
    usa: ['maca', 'cajado', 'totem', 'escudo'],
    habilidade: 'ancestrais',
  },
}

/**
 * Maestrias — nivel 150. Duas por especialidade.
 *
 * `crescimento` multiplica o ganho do degrau anterior. Os valores giram em
 * torno de 1: acima de 1 o atributo cresce mais que a media do degrau,
 * abaixo cresce menos. A forca total do degrau vem de
 * config.rpg.evolucao.crescimentoPorTier, nao daqui — assim da para deixar
 * todos os caminhos mais fortes ou mais fracos de uma vez.
 */
const MAESTRIAS = {
  // ----------------------------------------------------- ladino/assassino
  sicario: {
    nome: 'Sicário das Sombras',
    emoji: '🌘',
    evoluiDe: 'assassino',
    resumo: 'Some entre as sombras e reaparece atrás. Quem não o vê não se defende.',
    crescimento: { hp: 0.95, atq: 1.1, def: 0.9, agi: 1.15 },
    habilidade: 'sombras',
  },
  mestreDosVenenos: {
    nome: 'Mestre dos Venenos',
    emoji: '🧪',
    evoluiDe: 'assassino',
    resumo: 'Trocou a força pela toxina. O inimigo apodrece enquanto luta.',
    crescimento: { hp: 1.05, atq: 1.0, def: 1.0, agi: 1.05 },
    habilidade: 'toxina',
  },

  // -------------------------------------------------------- ladino/ladrao
  ilusionista: {
    nome: 'Ilusionista',
    emoji: '🃏',
    evoluiDe: 'ladrao',
    resumo: 'Duplicatas, disfarces e mentiras. Bater nele é bater no lugar errado.',
    crescimento: { hp: 1.0, atq: 0.95, def: 1.0, agi: 1.2 },
    habilidade: 'duplicatas',
  },
  mercenario: {
    nome: 'Mercenário das Sombras',
    emoji: '💣',
    evoluiDe: 'ladrao',
    resumo: 'Explosivos, armadilhas e contatos no submundo. Chega com o terreno pronto.',
    crescimento: { hp: 1.1, atq: 1.1, def: 1.05, agi: 0.95 },
    habilidade: 'sabotagem',
  },

  // --------------------------------------------------- guerreiro/paladino
  guardiaoDoJuramento: {
    nome: 'Guardião do Juramento',
    emoji: '🛡️',
    evoluiDe: 'paladino',
    resumo: 'Escudos que não quebram. O que ele protege não cai.',
    crescimento: { hp: 1.2, atq: 0.9, def: 1.2, agi: 0.9 },
    habilidade: 'juramento',
  },
  chamaSagrada: {
    nome: 'Portador da Chama Sagrada',
    emoji: '🕯️',
    evoluiDe: 'paladino',
    resumo: 'Fé virada em fogo que purifica. Queima a corrupção e fecha feridas.',
    crescimento: { hp: 1.05, atq: 1.15, def: 1.0, agi: 1.0 },
    habilidade: 'chamaPurificadora',
  },

  // -------------------------------------------------- guerreiro/gladiador
  campeaoDaArena: {
    nome: 'Campeão da Arena',
    emoji: '🏆',
    evoluiDe: 'gladiador',
    resumo: 'Duelista de multidão. Cada golpe sofrido afia o próximo dele.',
    crescimento: { hp: 1.05, atq: 1.2, def: 0.95, agi: 1.05 },
    habilidade: 'sedeDeVitoria',
  },
  portadorDeCorrentes: {
    nome: 'Portador de Correntes',
    emoji: '⛓️',
    evoluiDe: 'gladiador',
    resumo: 'Correntes como extensão do corpo. Puxa o inimigo para o alcance dele.',
    crescimento: { hp: 1.15, atq: 1.05, def: 1.15, agi: 0.85 },
    habilidade: 'grilhoes',
  },

  // --------------------------------------------------------- mago/bruxo
  arcano: {
    nome: 'Arcano',
    emoji: '👁️',
    evoluiDe: 'bruxo',
    resumo: 'Firma pactos com o que não devia ser chamado. E o que vem atende.',
    crescimento: { hp: 1.05, atq: 1.15, def: 1.0, agi: 1.0 },
    habilidade: 'pacto',
  },
  avatarElemental: {
    nome: 'Avatar Elemental',
    emoji: '🌊',
    evoluiDe: 'bruxo',
    resumo: 'O elemento deixou de ser magia e virou corpo.',
    crescimento: { hp: 1.15, atq: 1.1, def: 1.1, agi: 0.95 },
    habilidade: 'formaElemental',
  },

    // ---------------------------------------------------- mago/necromante
  mestreDosOssos: {
    nome: 'Mestre dos Ossos',
    emoji: '🦴',
    evoluiDe: 'necromante',
    resumo: 'Não invoca um servo: invoca a fila inteira.',
    crescimento: { hp: 1.1, atq: 1.05, def: 1.1, agi: 0.95 },
    habilidade: 'legiao',
  },
  hemomante: {
    nome: 'Hemomante',
    emoji: '🩸',
    evoluiDe: 'necromante',
    resumo: 'Paga em sangue — o próprio, se precisar — e recebe poder em troca.',
    crescimento: { hp: 1.15, atq: 1.2, def: 0.9, agi: 1.0 },
    habilidade: 'tributoDeSangue',
  },

  // ------------------------------------------------------ arqueiro/guardiao
  sentinelaEspinhaVerde: {
    nome: 'Sentinela da Espinha Verde',
    emoji: '🌱',
    evoluiDe: 'guardiao',
    resumo: 'O terreno inteiro é aliado dele. Raízes prendem, espinhos envenenam.',
    crescimento: { hp: 1.15, atq: 0.95, def: 1.2, agi: 0.95 },
    habilidade: 'espinhos',
  },
  vinculoDaAlcateia: {
    nome: 'Vínculo da Alcateia',
    emoji: '🐺',
    evoluiDe: 'guardiao',
    resumo: 'A fera companheira e o arqueiro já quase não são dois.',
    crescimento: { hp: 1.05, atq: 1.15, def: 0.95, agi: 1.1 },
    habilidade: 'alcateia',
  },

  // ------------------------------------------------- arqueiro/cacadorDeFeras
  rastreadorDeSangue: {
    nome: 'Rastreador de Sangue',
    emoji: '🔎',
    evoluiDe: 'cacadorDeFeras',
    resumo: 'Conhece o ponto fraco antes de a luta começar. Couro não segura a flecha.',
    crescimento: { hp: 1.0, atq: 1.15, def: 1.0, agi: 1.1 },
    habilidade: 'pontoFraco',
  },
  coletorDeTrofeus: {
    nome: 'Coletor de Troféus',
    emoji: '🦴',
    evoluiDe: 'cacadorDeFeras',
    resumo: 'Veste o que abateu. Cada presa virou parte do equipamento.',
    crescimento: { hp: 1.15, atq: 1.05, def: 1.15, agi: 0.95 },
    habilidade: 'trofeus',
  },

  // -------------------------------------------------- duelista/espadachim
  mestreDasLaminas: {
    nome: 'Mestre das Lâminas',
    emoji: '⚔️',
    evoluiDe: 'espadachim',
    resumo: 'Técnica levada ao fim: combo, contra-ataque, e nenhum movimento perdido.',
    crescimento: { hp: 1.0, atq: 1.15, def: 1.05, agi: 1.1 },
    habilidade: 'contraGolpe',
  },
  duelistaReal: {
    nome: 'Duelista Real',
    emoji: '👑',
    evoluiDe: 'espadachim',
    resumo: 'Duelo formal, postura impecável, provocação na medida. Intimida antes de tocar.',
    crescimento: { hp: 1.1, atq: 1.05, def: 1.1, agi: 1.0 },
    habilidade: 'postura',
  },

  // ------------------------------------------ duelista/cacadorDeRecompensas
  batedorDeElite: {
    nome: 'Batedor de Elite',
    emoji: '🎯',
    evoluiDe: 'cacadorDeRecompensas',
    resumo: 'Marca o alvo e o dano só cresce a partir dali.',
    crescimento: { hp: 1.0, atq: 1.2, def: 0.95, agi: 1.1 },
    habilidade: 'marcado',
  },
  arsenalTatico: {
    nome: 'Arsenal Tático',
    emoji: '🧰',
    evoluiDe: 'cacadorDeRecompensas',
    resumo: 'Rede, corrente, gancho e pólvora. Sempre tem a ferramenta para aquele alvo.',
    crescimento: { hp: 1.1, atq: 1.05, def: 1.15, agi: 1.0 },
    habilidade: 'arsenal',
  },

  // --------------------------------------------------------- bardo/trovador
  mestreDasBaladas: {
    nome: 'Mestre das Baladas',
    emoji: '🎶',
    evoluiDe: 'trovador',
    resumo: 'Cada melodia serve a um momento. Fecha ferida no meio da briga.',
    crescimento: { hp: 1.15, atq: 1.0, def: 1.1, agi: 1.0 },
    habilidade: 'melodiaCurativa',
  },
  regenteDoCaos: {
    nome: 'Regente do Caos Sonoro',
    emoji: '📢',
    evoluiDe: 'trovador',
    resumo: 'Dissonância como arma. Quebra concentração e atordoa quem escuta.',
    crescimento: { hp: 0.95, atq: 1.2, def: 0.95, agi: 1.15 },
    habilidade: 'dissonancia',
  },
  // ---------------------------------------------------------- bardo/oraculo
  videnteDosVeus: {
    nome: 'Vidente dos Véus',
    emoji: '🕯️',
    evoluiDe: 'oraculo',
    resumo: 'Enxerga o golpe antes de ele existir. Esquiva do impossível.',
    crescimento: { hp: 1.0, atq: 1.0, def: 1.05, agi: 1.25 },
    habilidade: 'fioDaSorte',
  },
  arquivista: {
    nome: 'Arquivista dos Segredos Perdidos',
    emoji: '📖',
    evoluiDe: 'oraculo',
    resumo: 'Sabe o que ninguém devia saber — e usa isso para desfazer defesas.',
    crescimento: { hp: 1.05, atq: 1.15, def: 1.05, agi: 1.0 },
    habilidade: 'segredos',
  },

  // ------------------------------------------------------- clerigo/sacerdote
  ministroDaLuz: {
    nome: 'Ministro da Luz',
    emoji: '☀️',
    evoluiDe: 'sacerdote',
    resumo: 'Cura contínua e bênção que não sai. Difícil de derrubar, mais ainda de manter no chão.',
    crescimento: { hp: 1.2, atq: 0.95, def: 1.15, agi: 0.95 },
    habilidade: 'graca',
  },
  zeloteDaFe: {
    nome: 'Zelote da Fé Inflexível',
    emoji: '⚖️',
    evoluiDe: 'sacerdote',
    resumo: 'Fé virada em fúria. Golpe abençoado não pede licença para a armadura.',
    crescimento: { hp: 1.0, atq: 1.25, def: 1.0, agi: 1.05 },
    habilidade: 'furiaSagrada',
  },

  // ------------------------------------------------------------ clerigo/xama
  guardiaoDosAncestrais: {
    nome: 'Guardião dos Ancestrais',
    emoji: '🗿',
    evoluiDe: 'xama',
    resumo: 'Chama guerreiros mortos há séculos, e eles vêm.',
    crescimento: { hp: 1.1, atq: 1.1, def: 1.1, agi: 0.95 },
    habilidade: 'espiritosDeGuerra',
  },
  eloComOAlem: {
    nome: 'Elo com o Além',
    emoji: '👻',
    evoluiDe: 'xama',
    resumo: 'Meio aqui, meio do outro lado. Golpe atravessa quem já não está inteiro.',
    crescimento: { hp: 1.0, atq: 1.1, def: 1.0, agi: 1.2 },
    habilidade: 'meioEtereo',
  },
}

/**
 * Apoteoses — nivel 200. Uma por maestria: aqui nao ha bifurcacao, so o
 * fim do caminho. Sao as habilidades mais fortes do jogo, mas note que
 * elas SOMAM com as duas anteriores em vez de substituir — por isso cada
 * uma sozinha e mais modesta do que a descricao sugere.
 */
const APOTEOSES = {
  ceifadorNoturno: {
    nome: 'Ceifador Noturno',
    emoji: '🌑',
    evoluiDe: 'sicario',
    resumo: 'Existe entre este mundo e o plano sombrio. Executa pela sombra que o alvo projeta.',
    crescimento: { hp: 1.0, atq: 1.15, def: 0.95, agi: 1.15 },
    habilidade: 'execucaoSombria',
  },
  arautoDaPeste: {
    nome: 'Arauto da Peste',
    emoji: '☣️',
    evoluiDe: 'mestreDosVenenos',
    resumo: 'Espalha praga em área. O que respira perto dele já perdeu.',
    crescimento: { hp: 1.1, atq: 1.1, def: 1.05, agi: 1.0 },
    habilidade: 'praga',
  },
  senhorDosEnganos: {
    nome: 'Senhor dos Enganos',
    emoji: '🎭',
    evoluiDe: 'ilusionista',
    resumo: 'Clones que enganam até detecção mágica. Ninguém sabe onde ele está.',
    crescimento: { hp: 1.05, atq: 1.0, def: 1.05, agi: 1.25 },
    habilidade: 'miragem',
  },
  reiDoSubmundo: {
    nome: 'Rei do Submundo',
    emoji: '👑',
    evoluiDe: 'mercenario',
    resumo: 'Comanda informantes e capangas. Sabota o campo antes de entrar nele.',
    crescimento: { hp: 1.1, atq: 1.1, def: 1.1, agi: 1.0 },
    habilidade: 'redeDeContatos',
  },

  punhoDaLei: {
    nome: 'Punho da Lei Divina',
    emoji: '⚖️',
    evoluiDe: 'guardiaoDoJuramento',
    resumo: 'Veredito vivo. A presença dele já pune quem merece punição.',
    crescimento: { hp: 1.2, atq: 1.0, def: 1.2, agi: 0.9 },
    habilidade: 'veredito',
  },
  arautoDaRedencao: {
    nome: 'Arauto da Redenção',
    emoji: '🌟',
    evoluiDe: 'chamaSagrada',
    resumo: 'Farol vivo. Reergue o que caiu e queima o que não devia existir.',
    crescimento: { hp: 1.15, atq: 1.1, def: 1.05, agi: 1.0 },
    habilidade: 'redencao',
  },
  imperadorDoCombate: {
    nome: 'Imperador do Combate',
    emoji: '🔥',
    evoluiDe: 'campeaoDaArena',
    resumo: 'Cada golpe sofrido alimenta a fúria. Briga longa contra ele não se ganha.',
    crescimento: { hp: 1.1, atq: 1.2, def: 1.0, agi: 1.05 },
    habilidade: 'imperioDaArena',
  },
  titaAcorrentado: {
    nome: 'Titã Acorrentado',
    emoji: '⛓️',
    evoluiDe: 'portadorDeCorrentes',
    resumo: 'As correntes cobrem o campo inteiro. Prende, arrasta e esmaga.',
    crescimento: { hp: 1.2, atq: 1.1, def: 1.15, agi: 0.85 },
    habilidade: 'correntesSemFim',
  },

  senhorDasEntidades: {
    nome: 'Senhor das Entidades',
    emoji: '🌀',
    evoluiDe: 'arcano',
    resumo: 'Manifesta avatares dos pactuários. O que vem com ele responde só a ele.',
    crescimento: { hp: 1.05, atq: 1.2, def: 1.0, agi: 1.05 },
    habilidade: 'avatarDoPacto',
  },
  supremoElemental: {
    nome: 'Supremo Elemental',
    emoji: '🌋',
    evoluiDe: 'avatarElemental',
    resumo: 'Abandonou a forma humana. Controla o clima e o terreno onde pisa.',
    crescimento: { hp: 1.15, atq: 1.15, def: 1.1, agi: 0.95 },
    habilidade: 'formaPrimordial',
  },
  lich: {
    nome: 'Lich',
    emoji: '☠️',
    evoluiDe: 'mestreDosOssos',
    resumo: 'Selou a alma num phylactery. Enquanto ele existir, a morte é temporária.',
    crescimento: { hp: 1.15, atq: 1.1, def: 1.1, agi: 0.95 },
    habilidade: 'phylactery',
  },
  arautoDoSangue: {
    nome: 'Arauto do Sangue',
    emoji: '🍷',
    evoluiDe: 'hemomante',
    resumo: 'Drena vitalidade à distância e converte a própria ferida em poder.',
    crescimento: { hp: 1.15, atq: 1.2, def: 0.95, agi: 1.0 },
    habilidade: 'sedeDeSangue',
  },

  ceifadorDaFloresta: {
    nome: 'Ceifador da Floresta Eterna',
    emoji: '🌳',
    evoluiDe: 'sentinelaEspinhaVerde',
    resumo: 'Fundido ao solo onde luta. O campo inteiro obedece a ele.',
    crescimento: { hp: 1.2, atq: 1.0, def: 1.2, agi: 0.95 },
    habilidade: 'dominioVerde',
  },
  avatarDaFera: {
    nome: 'Avatar da Fera Primordial',
    emoji: '🐾',
    evoluiDe: 'vinculoDaAlcateia',
    resumo: 'Fundiu-se ao companheiro. Precisão de arco com ferocidade de fera ancestral.',
    crescimento: { hp: 1.1, atq: 1.2, def: 1.0, agi: 1.1 },
    habilidade: 'formaHibrida',
  },
  flageloDasBestas: {
    nome: 'Flagelo das Grandes Bestas',
    emoji: '🐉',
    evoluiDe: 'rastreadorDeSangue',
    resumo: 'Enxerga a fraqueza de qualquer ser vivo. Escama e carapaça não contam.',
    crescimento: { hp: 1.05, atq: 1.2, def: 1.0, agi: 1.1 },
    habilidade: 'olhoDoFlagelo',
  },
  bestiarioVivo: {
    nome: 'Portador do Bestiário Vivo',
    emoji: '📕',
    evoluiDe: 'coletorDeTrofeus',
    resumo: 'Carrega dentro de si toda fera que abateu, e pode vestir qualquer uma.',
    crescimento: { hp: 1.2, atq: 1.1, def: 1.15, agi: 0.95 },
    habilidade: 'bestiario',
  },

  espiritoDaEspada: {
    nome: 'Espírito da Espada',
    emoji: '🗡️',
    evoluiDe: 'mestreDasLaminas',
    resumo: 'Fundiu-se à arma. Manifesta lâminas espectrais e corta defesa mágica.',
    crescimento: { hp: 1.0, atq: 1.2, def: 1.05, agi: 1.15 },
    habilidade: 'laminasEspectrais',
  },
  imperadorDaLamina: {
    nome: 'Imperador da Lâmina',
    emoji: '👑',
    evoluiDe: 'duelistaReal',
    resumo: 'Impõe o duelo. Quanto mais honrosa a vitória, mais pesado o golpe.',
    crescimento: { hp: 1.1, atq: 1.15, def: 1.1, agi: 1.0 },
    habilidade: 'dueloImposto',
  },
  predadorApex: {
    nome: 'Predador Apex',
    emoji: '🦅',
    evoluiDe: 'batedorDeElite',
    resumo: 'Topo da cadeia. Marca vários alvos, e cada um apanha mais que o anterior.',
    crescimento: { hp: 1.05, atq: 1.25, def: 0.95, agi: 1.1 },
    habilidade: 'apex',
  },
  carrascoSolitario: {
    nome: 'Carrasco Solitário',
    emoji: '🪓',
    evoluiDe: 'arsenalTatico',
    resumo: 'Opera sozinho. Quanto mais isolado, mais perigoso — e a execução ignora resistência.',
    crescimento: { hp: 1.15, atq: 1.15, def: 1.1, agi: 1.0 },
    habilidade: 'carrasco',
  },

  vozDaLenda: {
    nome: 'Voz da Lenda Eterna',
    emoji: '🎼',
    evoluiDe: 'mestreDasBaladas',
    resumo: 'O verso vira realidade por instantes. Ferida fecha ao som da voz.',
    crescimento: { hp: 1.2, atq: 1.05, def: 1.1, agi: 1.0 },
    habilidade: 'versoQueCura',
  },
  maestroDaDiscordia: {
    nome: 'Maestro da Discórdia',
    emoji: '🎺',
    evoluiDe: 'regenteDoCaos',
    resumo: 'Uma nota despedaça mentes e vira exércitos inteiros uns contra os outros.',
    crescimento: { hp: 1.0, atq: 1.25, def: 1.0, agi: 1.1 },
    habilidade: 'notaFinal',
  },
  guardiaoDoDestino: {
    nome: 'Guardião do Fio do Destino',
    emoji: '🧵',
    evoluiDe: 'videnteDosVeus',
    resumo: 'Vê várias linhas do tempo ao mesmo tempo e reescreve as pequenas.',
    crescimento: { hp: 1.05, atq: 1.05, def: 1.1, agi: 1.2 },
    habilidade: 'reescrever',
  },
  sussurroDaVerdade: {
    nome: 'Sussurro da Verdade Absoluta',
    emoji: '🔇',
    evoluiDe: 'arquivista',
    resumo: 'Conhece o nome verdadeiro das coisas. Ao dizê-lo, desfaz o que elas são.',
    crescimento: { hp: 1.05, atq: 1.2, def: 1.05, agi: 1.05 },
    habilidade: 'nomeVerdadeiro',
  },

  maoVivaDoDivino: {
    nome: 'Mão Viva do Divino',
    emoji: '🙌',
    evoluiDe: 'ministroDaLuz',
    resumo: 'Canal direto do deus dele. Ergue o morto recente e fecha o que era fatal.',
    crescimento: { hp: 1.25, atq: 1.0, def: 1.15, agi: 0.95 },
    habilidade: 'maoDivina',
  },
  espadaDaVontade: {
    nome: 'Espada da Vontade Divina',
    emoji: '⚔️',
    evoluiDe: 'zeloteDaFe',
    resumo: 'Instrumento do julgamento. Queima a alma do profano e ignora proteção impura.',
    crescimento: { hp: 1.05, atq: 1.25, def: 1.05, agi: 1.0 },
    habilidade: 'julgamento',
  },
  vozDeMilEspiritos: {
    nome: 'Voz de Mil Espíritos',
    emoji: '🌬️',
    evoluiDe: 'guardiaoDosAncestrais',
    resumo: 'Incorpora qualquer ancestral que já chamou. Um compêndio vivo de gerações.',
    crescimento: { hp: 1.15, atq: 1.15, def: 1.1, agi: 1.0 },
    habilidade: 'milEspiritos',
  },
  ponteEntreMundos: {
    nome: 'Ponte Entre Mundos',
    emoji: '🌉',
    evoluiDe: 'eloComOAlem',
    resumo: 'Já não pertence inteiramente a este plano. Fica intocável e arrasta inimigos para o outro lado.',
    crescimento: { hp: 1.1, atq: 1.1, def: 1.05, agi: 1.2 },
    habilidade: 'travessia',
  },
}

// ------------------------------------------------------------- montagem

/** Em que degrau da arvore cada classe esta. */
const TIER = { especialidade: 2, maestria: 3, apoteose: 4 }

/** Quanto um atributo cresce, no minimo, ao subir de degrau. */
const PISO_DE_CRESCIMENTO = 1.03

for (const c of Object.values(ESPECIALIDADES)) c.tier = TIER.especialidade
for (const c of Object.values(MAESTRIAS)) c.tier = TIER.maestria
for (const c of Object.values(APOTEOSES)) c.tier = TIER.apoteose
for (const c of Object.values(BASES)) c.tier = 1

export const CLASSES = { ...BASES, ...ESPECIALIDADES, ...MAESTRIAS, ...APOTEOSES }

/**
 * Cada degrau herda do anterior a base do nivel 1, a lista de armas e,
 * quando nao declara `ganho` proprio, o crescimento derivado do pai.
 *
 * A ordem importa: maestria depende de especialidade, apoteose depende de
 * maestria. Por isso os dois ultimos degraus sao resolvidos em sequencia.
 */
for (const grupo of [ESPECIALIDADES, MAESTRIAS, APOTEOSES]) {
  for (const c of Object.values(grupo)) {
    const pai = CLASSES[c.evoluiDe]
    if (!pai) throw new Error(`classe ${c.nome} evolui de ${c.evoluiDe}, que nao existe`)

    c.base = pai.base
    c.usa = c.usa ?? [...pai.usa]

    if (!c.ganho) {
      const fator = config.rpg.evolucao.crescimentoPorTier
      c.ganho = {}

      for (const s of ['hp', 'atq', 'def', 'agi']) {
        // Piso obrigatorio: evoluir NUNCA pode piorar um atributo. Um tilt
        // muito baixo (um Tita que abre mao de agilidade, por exemplo)
        // poderia derrubar o ganho abaixo do degrau anterior; aqui isso
        // vira "cresce pouco" em vez de "cresce negativo".
        const derivado = pai.ganho[s] * fator * c.crescimento[s]
        c.ganho[s] = +Math.max(derivado, pai.ganho[s] * PISO_DE_CRESCIMENTO).toFixed(3)
      }
    }
  }
}

/** Só as classes base — é o que o /classe oferece para quem está começando. */
export const NOMES_DE_CLASSE = Object.keys(BASES)

/** Toda classe que se alcança evoluindo, de qualquer degrau. */
export const NOMES_DE_ESPECIALIDADE = [
  ...Object.keys(ESPECIALIDADES),
  ...Object.keys(MAESTRIAS),
  ...Object.keys(APOTEOSES),
]

export const classe = (id) => CLASSES[id] ?? null

export const ehEspecialidade = (id) => Boolean(CLASSES[id]?.evoluiDe)

export const tierDe = (id) => CLASSES[id]?.tier ?? 1

/** O nível que o próximo degrau exige, ou null se já chegou ao fim. */
export function nivelDoProximoDegrau(classeId) {
  const proximo = tierDe(classeId) + 1
  return config.rpg.evolucao.niveis[proximo] ?? null
}

/** Os caminhos abertos a partir de uma classe. Vazio no fim da linha. */
export const especialidadesDe = (classeId) =>
  NOMES_DE_ESPECIALIDADE.filter((id) => CLASSES[id].evoluiDe === classeId)

/** A classe base de onde alguém veio — ou ela mesma, se ainda não evoluiu. */
export function classeRaiz(classeId) {
  let atual = classeId
  while (CLASSES[atual]?.evoluiDe) atual = CLASSES[atual].evoluiDe
  return atual
}

/** O caminho inteiro, da base até a classe atual. */
export function linhagemDe(classeId) {
  const caminho = []
  let atual = classeId
  while (CLASSES[atual]) {
    caminho.unshift(atual)
    atual = CLASSES[atual].evoluiDe
  }
  return caminho
}

export function rotuloClasse(id) {
  const c = classe(id)
  return c ? `${c.emoji} ${c.nome}` : 'sem classe'
}

/** Aceita nome, id ou id sem acento/camelCase: "cacador de feras" acha. */
export function acharClasse(busca, lista = Object.keys(CLASSES)) {
  const limpo = (t) =>
    String(t ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '')

  const texto = limpo(busca)
  if (!texto) return null

  return (
    lista.find((id) => limpo(id) === texto) ??
    lista.find((id) => limpo(CLASSES[id].nome) === texto) ??
    lista.find((id) => limpo(CLASSES[id].nome).startsWith(texto) && texto.length >= 3) ??
    null
  )
}

/** Atributos que a classe sozinha da, sem contar equipamento. */
export function atributosBase(classeId, nivel) {
  const c = classe(classeId)
  if (!c) return { hp: 80, atq: 10, def: 5, agi: 8 }

  const passos = Math.max(0, nivel - 1)
  return {
    hp: Math.round(c.base.hp + c.ganho.hp * passos),
    atq: Math.round(c.base.atq + c.ganho.atq * passos),
    def: Math.round(c.base.def + c.ganho.def * passos),
    agi: Math.round(c.base.agi + c.ganho.agi * passos),
  }
}

/** A classe sabe usar esse tipo de item? Elmo, armadura e anel servem para todas. */
export function classePodeUsar(classeId, tipo) {
  if (['elmo', 'armadura', 'anel'].includes(tipo)) return true
  return classe(classeId)?.usa.includes(tipo) ?? false
}
