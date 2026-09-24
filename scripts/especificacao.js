/**
 * Gera a especificação técnica do jogo, em HTML pronto para virar PDF.
 *
 *   npm run especificacao                      → dados/especificacao.html
 *   npm run especificacao -- caminho/arq.html
 *
 * Para o PDF, imprima o HTML com um navegador em modo headless (é assim que
 * a versão distribuída é feita):
 *
 *   msedge --headless --disable-gpu --no-pdf-header-footer \
 *     --print-to-pdf="Especificacao.pdf" "file:///.../especificacao.html"
 *
 * Por que um gerador e não um documento escrito à mão: as tabelas deste
 * documento são o CÓDIGO EM EXECUÇÃO, não uma transcrição. Classes,
 * habilidades, itens, espécies, chefes, feitiços e a configuração inteira
 * saem dos mesmos módulos que o servidor carrega. Mudou o jogo, rode de
 * novo e o documento está certo — nenhuma tabela envelhece em silêncio.
 *
 * A prosa (as explicações, as fórmulas em pseudocódigo, o porquê de cada
 * decisão) mora aqui mesmo, ao lado dos dados que ela descreve.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Carregar os módulos do jogo acorda o depósito de personagens, que abre um
// banco. Aqui ele aponta para um arquivo descartável: gerar documentação não
// pode tocar nos dados de quem joga.
process.env.DB_PATH = path.join(os.tmpdir(), 'resenha-especificacao.db')

const { config } = await import('../server/config.js')
const { CLASSES, ARMAS_DE_TODOS, atributosBase } = await import('../server/rpg/classes.js')
const { HABILIDADES } = await import('../server/rpg/habilidades.js')
const { TIPOS, RARIDADES, SLOTS, NOME_DO_SLOT, criarItem } = await import('../server/rpg/itens.js')
const { ESPECIES, BOSSES, NIVEIS_DE_BOSS, atributosDeMonstro, escalaDeNivel } = await import(
  '../server/rpg/monstros.js'
)
const {
  ARCOS,
  ATOS,
  TOTAL_DE_ATOS,
  ato,
  chefeDoAto,
  ehFaseDeChefe,
  faseDoIndice,
  forcaDaFase,
  indiceDaFase,
  nivelDaFase,
  nomeDoArco,
  quantosInimigos,
} = await import('../server/rpg/rota.js')
const { FEITICOS, SLOTS_COM_FEITICO } = await import('../server/rpg/feiticos.js')
const { TITANITAS, custoDoReforco } = await import('../server/rpg/ferreiro.js')
const { TODOS_OS_CHEFES } = await import('../server/rpg/raid.js')
const { HABITANTES, nomeDaProfundidade, cenarioDaProfundidade } = await import('../server/rpg/abismo.js')
const { EXPEDICOES } = await import('../server/rpg/expedicao.js')
const { GUARDIOES, custoDoRito } = await import('../server/rpg/evolucao.js')
const { EVENTOS } = await import('../server/eventos.js')
const { CHEFES_MUNDIAIS } = await import('../server/chefeMundial.js')
const { TIPOS_DE_MISSAO } = await import('../server/missoes.js')

// ------------------------------------------------------------ ferramentas

const esc = (t) =>
  String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** Número no formato do documento: milhar com ponto, decimal com vírgula. */
const num = (n, casas = 0) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** Número solto, com até três casas, sem zeros à toa. */
const dec = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

const pct = (n, casas = 0) => `${Number(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const hoje = new Date()
const DATA = `${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`

/** Uma tabela. `alinhar` marca com 'n' as colunas numéricas. */
function tabela(cabecalho, linhas, { alinhar = '', classe: cls = '' } = {}) {
  const th = cabecalho
    .map((c, i) => `<th${alinhar[i] === 'n' ? ' class="n"' : ''}>${c}</th>`)
    .join('')
  const tr = linhas
    .map(
      (linha) =>
        `<tr>${linha
          .map((c, i) => `<td${alinhar[i] === 'n' ? ' class="n"' : ''}>${c ?? ''}</td>`)
          .join('')}</tr>`,
    )
    .join('\n')
  return `<table class="t ${cls}"><thead><tr>${th}</tr></thead><tbody>\n${tr}\n</tbody></table>`
}

const cod = (texto) => `<pre class="cod">${esc(texto.replace(/^\n/, '').replace(/\s+$/, ''))}</pre>`
const nota = (html) => `<div class="nota">${html}</div>`
const lista = (itens) => `<ul>${itens.map((i) => `<li>${i}</li>`).join('')}</ul>`
const ordem = (itens) => `<ol>${itens.map((i) => `<li>${i}</li>`).join('')}</ol>`

const partes = []
/** Uma parte do documento. O título entra no sumário. */
const parte = (numero, titulo, ...blocos) => {
  partes.push({ numero, titulo, html: blocos.join('\n') })
}
const secao = (numero, titulo) => `<h2><span class="n2">${numero}</span> ${titulo}</h2>`

// ============================================================== 0. leitura

parte(
  0,
  'Como ler este documento',
  `<p>Este documento descreve um RPG por turnos, assíncrono e multijogador, que roda num
  navegador: um servidor Node.js serve a interface, a API e o tempo real, e guarda tudo num
  arquivo SQLite. Ele é a referência de <em>como o jogo funciona</em> — as fórmulas, as tabelas
  e, o que importa mais, as decisões de balanceamento que levaram a cada número.</p>`,

  `<h3>O que é normativo</h3>
  <p>Três coisas precisam ser reproduzidas exatamente por qualquer implementação:</p>`,
  ordem([
    `<strong>As fórmulas.</strong> Cada uma está em pseudocódigo, com a ordem de aplicação dos
     fatores explícita. A ordem importa: o dano é um produto de sete fatores, e trocar dois de
     lugar muda o resultado quando há arredondamento no meio.`,
    `<strong>As tabelas de dados.</strong> Classes, habilidades, espécies, chefes, itens,
     feitiços. Estão completas aqui, extraídas do código em execução.`,
    `<strong>Os parâmetros de configuração.</strong> Todos vivem num único objeto
     (<code>config</code>, em <code>server/config.js</code>), reproduzido integralmente na
     Parte 19. Nenhum número de balanceamento deve ficar espalhado pelo resto do código — foi
     essa disciplina que tornou o balanceamento por simulação possível.`,
  ]),

  `<h3>O que é livre</h3>
  <p>Tudo que é apresentação. O servidor devolve estado e <em>log estruturado</em>; desenhar
  isso é problema da interface, e ela pode mudar inteira sem tocar numa regra. É o que permite
  que a mesma resposta de combate vire texto narrado, barra de vida animada e bonecos trocando
  golpes no palco (Parte 27) ao mesmo tempo.</p>`,

  `<h3>Convenções de notação</h3>`,
  tabela(
    ['NOTAÇÃO', 'SIGNIFICADO'],
    [
      ['HP ATQ DEF AGI', 'Os quatro atributos: vida, ataque, defesa, agilidade. Sempre nessa ordem.'],
      [
        '<code>sorte()</code>',
        `Gerador aleatório uniforme em [0,1). É sempre um parâmetro injetável, nunca
         <code>Math.random</code> chamado direto — é o que permite testes determinísticos e
         simulação de balanceamento.`,
      ],
      ['<code>arred(x)</code>', 'Arredondamento para o inteiro mais próximo (meio para cima).'],
      ['<code>piso(x)</code> / <code>teto(x)</code>', 'Arredondamento para baixo / para cima.'],
      ['<code>agora()</code>', 'Timestamp em milissegundos (epoch).'],
      ['<code>config.rpg.x</code>', 'Parâmetro de configuração. Ver Parte 19.'],
    ],
  ),

  `<h3>Dois princípios de arquitetura que atravessam tudo</h3>`,
  `<p><strong>Todo cálculo acontece no servidor.</strong> O navegador nunca decide dano, drop,
  gold ou resultado de luta: ele recebe o que já aconteceu e desenha. Combate, recompensa e
  economia tocam em bens — se rodassem no cliente, o jogo viraria formulário de fraude. A
  interface pode animar, prever e enfeitar; o que vale é o que o servidor respondeu.</p>`,
  `<p><strong>Estado por timestamp, nunca por temporizador.</strong> Não existe
  <code>setTimeout</code> para curar o jogador, terminar uma expedição ou liberar um cooldown.
  O que existe é um instante guardado e uma função que recalcula na leitura. A vida, por
  exemplo, não é decrementada por um relógio: guarda-se <code>hp</code> e <code>hpEm</code>, e
  <code>vidaAtual()</code> calcula quanto regenerou desde então. O servidor pode cair e voltar
  no meio de qualquer coisa sem perder estado — e o navegador refaz a mesma conta a cada
  segundo só para a barra subir na tela.</p>`,
  nota(
    `<strong>As exceções à segunda regra são três, e todas persistidas:</strong> o chefe mundial
     (que fica horas no ar), os leilões (que fecham na hora marcada) e os eventos aleatórios
     (cuja chamada tem alguns minutos). Os dois primeiros guardam o estado no banco justamente
     para sobreviver a um reinício; o terceiro vive só em memória e, se o servidor reiniciar com
     a chamada aberta, o evento simplesmente some — ninguém perde nada, porque atender não custa
     nada.`,
  ),
)

// ========================================================== 1. visão geral

parte(
  1,
  'Visão geral do jogo',
  `<p>Cada pessoa tem uma conta e até ${config.web.maxPersonagens} personagens. Um personagem é
  uma classe, um nível, quatro atributos, uma mochila e um baú. O jogo é jogado em sessões
  curtas: entra, caça, gasta o que ganhou, sai.</p>`,

  secao('1.1', 'O laço principal'),
  cod(`
  andar na rota →  uma fase por vez, ${TOTAL_DE_ATOS} atos, ${TOTAL_DE_ATOS * config.rpg.cacada.fasesPorAto} fases
     ↓
  vencer        →  XP, gold, equipamento, titanita, feitiço — e a fase seguinte
     ↓
  cair          →  volta uma fase, e dali se repete até estar forte o bastante
     ↓
  gastar        →  loja, ferreiro (reforço), feiticeiro (infusão)
     ↓
  evoluir       →  nos níveis 50, 150 e 200 o Rito abre um degrau da árvore
     ↓
  repetir, mais adiante`),
  `<p>Em volta desse laço existe o que se faz junto ou por fora dele: expedições (rendem com o
  navegador fechado), raids, duelos, o Abismo, a masmorra em grupo, o chefe mundial, os eventos
  aleatórios, as missões do dia, o mercado, a casa de leilões e o chat. Nenhum deles é
  obrigatório; todos alimentam o mesmo laço.</p>`,

  secao('1.2', 'Dois XPs diferentes, de propósito'),
  `<p>O XP de combate sobe o nível do personagem. O ranking de PvP é outra coisa: pontos Elo,
  que não viram nível. Duelo é treino — mexe na tabela, não na ficha. É o que impede que a
  melhor forma de subir de nível seja duelar com um amigo combinado.</p>`,

  secao('1.3', 'Estados do personagem'),
  `<p>São dois, e nenhum deles é um relógio de recuperação. A vida fora de combate é sempre
  cheia (9.6), então não há estado ferido, fogueira, poção nem bandagem.</p>`,
  tabela(
    ['ESTADO', 'COMO SE ENTRA', 'O QUE BLOQUEIA', 'COMO SAI'],
    [
      [
        '<strong>Repetindo a rota</strong>',
        'Cair numa fase',
        'O <em>avanço automático</em>. A rota recua uma fase e fica lá',
        '"Ir para a próxima fase", quando o jogador achar que está na hora',
      ],
      [
        '<strong>Em expedição</strong>',
        'Partir em expedição',
        'Toda luta, inclusive PvP',
        'Voltar quando o tempo acabar (e coletar)',
      ],
      [
        '<strong>Em cooldown</strong>',
        'Acabou de duelar, descer o Abismo, atacar o chefe mundial…',
        'A ação específica',
        'Esperar o relógio daquela ação',
      ],
    ],
  ),
)

// ======================================================== 2. modelo de dados

parte(
  2,
  'Modelo de dados',
  secao('2.1', 'Onde cada coisa mora'),
  `<p>O SQLite guarda seis tabelas. A ficha de RPG inteira é um JSON numa coluna só — de
  propósito: o motor de jogo trabalha em cima de um objeto <code>player</code> inteiro, e
  quebrá-lo em tabelas só criaria trabalho de tradução nas duas pontas. Ganha tabela própria o
  que o SQL precisa mesmo indexar, e o que não pode se perder num reinício.</p>`,
  tabela(
    ['TABELA', 'O QUE GUARDA'],
    [
      ['<code>usuarios</code>', 'Conta: usuário, hash da senha (bcrypt), datas'],
      ['<code>sessoes</code>', 'Token de sessão → conta, com validade'],
      ['<code>personagens</code>', 'Um por linha: id, conta, nome único e a ficha em JSON'],
      ['<code>estado</code>', 'Estado do servidor que não é de ninguém: o chefe mundial e a agenda dele'],
      ['<code>leiloes</code>', 'Os anúncios abertos e fechados, com o item retido'],
      ['<code>entregas</code>', 'Itens esperando o dono ir buscar (arremate, devolução, prêmio)'],
      ['<code>fotos</code>', 'A foto de cada personagem, em BLOB, com cascata para o personagem'],
      ['<code>chat</code>', 'Histórico das mensagens, por canal'],
    ],
  ),
  `<p>Os personagens vivem <strong>em memória</strong> enquanto o servidor está no ar (são
  poucos KB cada). O banco é a cópia durável: <code>save()</code> agenda uma gravação com
  400 ms de debounce e só grava as fichas que realmente mudaram;
  <code>flush()</code> grava na hora, e é chamado ao fim de toda rota que altera alguma coisa.
  Uma caçada — que mexe em vida, XP, gold, drop e titanita — vira uma escrita só.</p>`,

  secao('2.2', 'A ficha do personagem'),
  cod(`
{
  classe: 'ladino',            // null até escolher
  nivel: 1,  xp: 0,  gold: 0,
  // Onde o personagem está na rota (Parte 9). A vida NÃO mora na ficha:
  // fora de combate ela é sempre cheia.
  cacada: {
    ato: 1, fase: 1,           // a posição
    repetindo: false,          // caiu: o avanço automático está desligado
    travada: null,             // { ato, fase } da fase que o derrubou
    maiorAto: 0, maiorFase: 0, // o recorde, para o mapa
    vitorias: 0, derrotas: 0, ultimaFaseEm: 0,
  },
  inventario: [ item, ... ],   // teto: config.rpg.tamanhoMochila
  bau: { itens: [], espacosComprados: 0 },
  equipado: { arma, secundario, elmo, armadura, anel },   // uids
  lojaOferta: { item, expiraEm },
  expedicao: { tipo, terminaEm },
  raid: { vitorias, derrotas, ultimaRaid },
  evolucao: { esperaAte, tentativas, evoluiuEm },
  titanitas: { estilhaco, grande, pedaco, placa },
  feiticos: { chama: 2, gelo: 1, ... },
  abismo: { melhorAndar, descidas, andaresTotais, ultimaDescida },
  masmorra: { melhorAndar, descidas, ultimaDescida },
  missoes: { dia: '2026-09-22', lista: [...], bauResgatado: false },
  pvp: { pontos, vitorias, derrotas, sequencia, melhorSequencia, goldGanho, ultimoDuelo },
  prestigio: 0,  prestigioEm: 0,
  foto: 0,                     // instante do envio; 0 = sem foto
  provaAte: 0,
  vitorias: 0,  derrotas: 0,
}`),
  nota(
    `<strong>Os cinco slots guardam <em>uid</em>, não o item.</strong> O item vive uma vez só,
     no inventário. Isso evita a classe inteira de bugs em que a peça equipada e a peça da
     mochila divergem depois de um reforço ou de uma infusão.`,
  ),

  secao('2.3', 'A ficha de um item'),
  cod(`
{
  uid: 'k3f9a2',               // aleatório, curto, único dentro da ficha
  tipo: 'espada',              // chave em TIPOS (6.2)
  slot: 'arma',
  nome: 'Espada de Mithril',   // tipo + material da faixa de nível
  raridade: 'raro',
  nivel: 22,                   // nível em que caiu; exigido para equipar
  bonus: { atq: 58 },          // atributos DE FÁBRICA
  reforco: 3,                  // opcional, 0..10 (Parte 15)
  feitico: 'chama',            // opcional (Parte 16)
}`),
  `<p>O <code>bonus</code> guardado é sempre o de fábrica. O reforço é um multiplicador aplicado
  na leitura (<code>bonusFinal()</code>), nunca gravado por cima: assim o mesmo item reforçado
  por dois caminhos diferentes jamais diverge, e mudar a tabela do ferreiro no config vale para
  todo mundo na hora, sem migração.</p>`,
  `<p>Todo item do inventário é equipamento: os consumíveis (poção, bandagem) saíram do jogo
  junto com o que resolviam — ver 9.6.</p>`,

  secao('2.4', 'Persistência e migração'),
  `<p>Toda ficha lida do banco passa por <code>migrar()</code>, que funde o que estava gravado
  com uma ficha em branco. Campo novo acrescentado depois aparece preenchido com o padrão, sem
  script de migração e sem <code>undefined</code> vazando para o cálculo.</p>`,
  `<p>Duas tabelas de renome moram no mesmo lugar, e valem para todos os itens do jogador —
  inclusive os que estão fora da mochila (baú, leilões, entregas, oferta da loja):</p>`,
  tabela(
    ['O QUE MUDOU', 'CONVERSÃO NA LEITURA'],
    [
      ['Classe renomeada', '<code>pistoleiro</code> → <code>guardiao</code>'],
      ['Tipo de item renomeado', '<code>tambor</code> → <code>banjo</code> (tipo e nome do item)'],
      [
        'Tipo de item aposentado',
        '<code>pocao</code> e <code>bandagem</code> somem da mochila, do baú e da oferta da loja',
      ],
      [
        'Campo aposentado',
        '<code>hp</code>, <code>hpEm</code>, <code>feridoAte</code>, <code>fogueiraAte</code>, ' +
          '<code>bossPendente</code>, <code>bossesVencidos</code> e <code>ultimaLuta</code> são apagados',
      ],
    ],
  ),
)

// =========================================================== 3. progressão

parte(
  3,
  'Progressão: níveis, XP, atributos e vida',
  secao('3.1', 'Custo de nível'),
  `<p>O XP de combate necessário para sair do nível <em>n</em> para o <em>n+1</em>:</p>`,
  cod(`xpParaSubir(n) = arred( 55 × n^1.15 )`),
  `<p>É uma curva suave, quase linear, de expoente baixo de propósito: com expoente 1,5 ou 2 o
  fim de jogo viraria moagem. Alguns valores:</p>`,
  (() => {
    const niveis = [1, 5, 10, 25, 50, 100, 150, 200, 250]
    return tabela(
      ['NÍVEL', ...niveis.map(String)],
      [['<strong>XP p/ subir</strong>', ...niveis.map((n) => num(Math.round(55 * Math.pow(n, 1.15))))]],
      { alinhar: 'nnnnnnnnnn' },
    )
  })(),

  secao('3.2', 'Ganho de XP'),
  `<p>XP entra por: vencer monstros e chefes, raids, eventos de luta, expedições, o Abismo, a
  masmorra em grupo, o chefe mundial e as missões do dia. Não entra por PvP.</p>`,
  `<p>Todo XP passa por <code>xpComPrestigio()</code> antes de entrar na ficha: quem já
  prestigiou (Parte 22) ganha uma fração a mais, para sempre. O número que a tela mostra é o
  número que entrou.</p>`,

  secao('3.3', 'A progressão não tem teto e não tem trava'),
  cod(`
funcao ganharXp(jogador, quanto):
  jogador.xp += quanto
  subiu = []
  enquanto jogador.xp >= xpParaSubir(jogador.nivel):
    jogador.xp -= xpParaSubir(jogador.nivel)
    jogador.nivel += 1
    subiu.adiciona(jogador.nivel)
  devolve subiu`),
  nota(
    `<strong>Os marcos de nível saíram do jogo.</strong> Antes, a cada 5 níveis o personagem
     travava até derrubar o chefe daquele marco. Quem trava a progressão agora é a
     <strong>fase</strong> (Parte 9), e os 19 chefes viraram os chefes de ato — um por ato,
     sempre na última fase. Dois portões para a mesma coisa seriam redundantes, e o da fase é o
     que mede o que importa: se o personagem dá conta do conteúdo à frente.`,
  ),

  secao('3.4', 'Atributos'),
  cod(`
atributosBase(classe, nivel).X = arred( classe.base.X + classe.ganho.X × (nivel − 1) )
atributosDaClasse(jogador).X   = arred( atributosBase(...).X × escalaDePrestigio(jogador) )
atributos(jogador).X           = atributosDaClasse(jogador).X + Σ bonusFinal(item equipado).X`),
  `<p>Linear no nível. Toda a diferença entre classes está em <code>base</code> (o ponto de
  partida no nível 1) e <code>ganho</code> (a inclinação). Evoluir de classe troca a inclinação,
  nunca o ponto de partida — a base é herdada intacta ao longo de toda a linhagem.</p>`,
  `<p>O bônus de prestígio multiplica <strong>só o que a classe dá</strong>, nunca o
  equipamento: quem prestigia com peças de fim de jogo não vira intocável.</p>`,
  nota(
    `<strong>O jogador cresce duas vezes, o monstro só uma.</strong> Os atributos do personagem
     sobem pelo nível e pelo equipamento, que por sua vez escala com o nível e ainda multiplica
     por até ${dec(RARIDADES.lendario.mult)} na raridade lendária. O monstro só sobe pelo nível.
     É exatamente por isso que existe a escala de fim de jogo da Parte 8.4.`,
  ),

  secao('3.5', 'Vida'),
  `<p>Fora de combate, a vida é sempre cheia:</p>`,
  cod('vidaAtual(jogador) = atributos(jogador).hp'),
  `<p>Não há valor de vida guardado na ficha, nem instante da última gravação, nem regeneração
  contada no relógio. É consequência direta da rota: a fase é que é a prova, e ela começa do
  zero toda vez. Vencer leva à fase seguinte com a vida inteira; cair devolve à anterior,
  também inteiro. Raid, Abismo, masmorra, evento, duelo e Rito entram cheios pelo mesmo
  motivo.</p>`,
  `<p>É por isso que não existem mais fogueira, poção, bandagem nem estado ferido: todos
  administravam a vida <em>entre</em> duas lutas, e entre duas lutas não há mais o que
  administrar. A vida continua decidindo o jogo — dentro da fase, onde ela só volta um respiro
  de <code>${dec(config.rpg.cacada.curaEntreInimigos)}</code> do máximo entre um inimigo e o
  seguinte, e o desgaste acumulado é o que diz se a horda cai (9.4).</p>`,

  secao('3.6', 'Atributos base por nível, por classe'),
  `<p>Sem equipamento, sem evolução, sem prestígio. É o piso de cada classe:</p>`,
  (() => {
    const niveis = [1, 10, 25, 50, 100, 150, 200, 250]
    const linhas = []
    for (const [id, c] of Object.entries(CLASSES)) {
      if (c.tier !== 1) continue
      niveis.forEach((n, i) => {
        const a = atributosBase(id, n)
        linhas.push([
          i === 0 ? `<strong>${c.emoji} ${c.nome}</strong>` : '',
          String(n),
          num(a.hp),
          num(a.atq),
          num(a.def),
          num(a.agi),
        ])
      })
    }
    return tabela(['CLASSE', 'NÍVEL', 'HP', 'ATQ', 'DEF', 'AGI'], linhas, { alinhar: '  nnnnn', classe: 'compacta' })
  })(),
)

// ============================================================== 4. classes

/** Um valor de efeito em texto: numero, booleano ou objeto de campos. */
const efeitoEmTexto = (v) =>
  typeof v === 'object'
    ? Object.entries(v)
        .map(([k, n]) => `${k} ${dec(n)}`)
        .join(', ')
    : typeof v === 'boolean'
      ? 'sim'
      : dec(v)

const porTier = (t) => Object.entries(CLASSES).filter(([, c]) => c.tier === t)
const nomeDe = (id) => (CLASSES[id] ? `${CLASSES[id].emoji} ${CLASSES[id].nome}` : id)
const ganhoEmTexto = (g) => `${dec(g.hp)} / ${dec(g.atq)} / ${dec(g.def)} / ${dec(g.agi)}`

parte(
  4,
  'Classes e a árvore de evolução',
  secao('4.1', 'A forma da árvore'),
  cod(`
  base           nível 1     ${porTier(1).length} classes, o ponto de partida
  especialidade  nível ${config.rpg.evolucao.niveis[2]}    ${porTier(2).length} (duas por base)
  maestria       nível ${config.rpg.evolucao.niveis[3]}   ${porTier(3).length} (duas por especialidade)
  apoteose       nível ${config.rpg.evolucao.niveis[4]}   ${porTier(4).length} (uma por maestria)
                             ${Object.keys(CLASSES).length} classes ao todo`),
  `<p>Evoluir nunca troca o personagem de lugar: mantém a base do nível 1, passa a crescer mais
  rápido, destrava armas e <strong>acumula</strong> uma habilidade nova. Um Ceifador Noturno
  carrega as quatro habilidades do caminho dele (Ladino + Assassino + Sicário + Ceifador), não
  só a última — e é isso que faz o caminho inteiro importar, não apenas o último degrau.</p>`,

  secao('4.2', 'As sete classes base'),
  tabela(
    ['CLASSE', 'BASE HP/ATQ/DEF/AGI', 'GANHO POR NÍVEL', 'ARMAS', 'PASSIVA'],
    porTier(1).map(([, c]) => [
      `<strong>${c.emoji} ${c.nome}</strong><br><span class="fraca">${c.resumo}</span>`,
      `${c.base.hp} / ${c.base.atq} / ${c.base.def} / ${c.base.agi}`,
      ganhoEmTexto(c.ganho),
      c.usa.join(', '),
      c.habilidade ? HABILIDADES[c.habilidade].nome : '—',
    ]),
  ),
  `<p>Guerreiro e Clérigo não nascem com passiva: a vida e a defesa deles valiam, sozinhas, o
  que as passivas dos outros agora compensam.</p>`,

  secao('4.3', 'Como o crescimento de cada degrau é calculado'),
  `<p>As ${porTier(2).length} especialidades declaram o próprio <code>ganho</code>, calibrado
  por simulação. Maestria e apoteose não repetem esses números: declaram um
  <code>crescimento</code> — um multiplicador sobre o ganho do degrau anterior — e o ganho sai
  daí:</p>`,
  cod(`
ganho[s] = max(
  pai.ganho[s] × crescimentoPorTier × crescimento[s],
  pai.ganho[s] × PISO_DE_CRESCIMENTO
)

crescimentoPorTier   = ${dec(config.rpg.evolucao.crescimentoPorTier)}
PISO_DE_CRESCIMENTO  = 1.03`),
  `<p>O piso não é detalhe. Um perfil enviesado (uma apoteose que abre mão de agilidade para ser
  muralha) pode ter <code>0,85 × ${dec(config.rpg.evolucao.crescimentoPorTier)} = 0,986</code>,
  menor que 1 — e evoluir pioraria o atributo. Com o piso, isso vira "cresce pouco" em vez de
  "cresce negativo". É correção estrutural, não caso a caso.</p>`,
  `<p>A força total de cada degrau se ajusta num parâmetro só
  (<code>crescimentoPorTier</code>), e o perfil de cada classe fica legível numa linha.</p>`,

  secao('4.4', 'Os caminhos completos'),
  (() => {
    const linhas = []
    for (const [idBase] of porTier(1)) {
      for (const [idEsp] of Object.entries(CLASSES).filter(([, c]) => c.evoluiDe === idBase)) {
        const maestrias = Object.entries(CLASSES).filter(([, c]) => c.evoluiDe === idEsp)
        maestrias.forEach(([idMae], i) => {
          const apoteose = Object.entries(CLASSES).find(([, c]) => c.evoluiDe === idMae)
          linhas.push([
            i === 0 ? `<strong>${nomeDe(idBase)}</strong>` : '',
            i === 0 ? nomeDe(idEsp) : '',
            nomeDe(idMae),
            apoteose ? nomeDe(apoteose[0]) : '—',
          ])
        })
      }
    }
    return tabela([`BASE`, `ESPECIALIDADE (${config.rpg.evolucao.niveis[2]})`, `MAESTRIA (${config.rpg.evolucao.niveis[3]})`, `APOTEOSE (${config.rpg.evolucao.niveis[4]})`], linhas, {
      classe: 'compacta',
    })
  })(),

  secao('4.5', `Tabela completa das ${Object.keys(CLASSES).length} classes`),
  `<p>Ganho por nível, na ordem HP / ATQ / DEF / AGI. A habilidade listada é a que o degrau
  <em>acrescenta</em>; as anteriores continuam valendo.</p>`,
  (() => {
    const linhas = []
    for (const tier of [1, 2, 3, 4]) {
      for (const [id, c] of porTier(tier)) {
        linhas.push([
          String(tier),
          `${c.emoji} ${c.nome}`,
          c.evoluiDe ? CLASSES[c.evoluiDe].nome : '—',
          ganhoEmTexto(c.ganho),
          c.habilidade ? HABILIDADES[c.habilidade].nome : '—',
        ])
      }
    }
    return tabela(['T', 'CLASSE', 'EVOLUI DE', 'GANHO POR NÍVEL', 'HABILIDADE QUE ACRESCENTA'], linhas, {
      alinhar: 'n',
      classe: 'compacta',
    })
  })(),

  secao('4.6', 'Quem pode usar o quê'),
  cod(`
funcao classePodeUsar(classe, tipo):
  se tipo em ['elmo', 'armadura', 'anel']: devolve verdadeiro
  se tipo em ARMAS_DE_TODOS:               devolve verdadeiro
  devolve tipo em classe.usa`),
  `<p>Elmo, armadura e anel servem para todas. <strong>${ARMAS_DE_TODOS.map(
    (t) => TIPOS[t].nome,
  ).join(', ')}</strong> também: é a arma que não pertence a caminho nenhum, cai para todo mundo
  e todo mundo equipa. Ela fica numa lista única em vez de repetida nos ${
    Object.keys(CLASSES).length
  } <code>usa</code> da árvore — assim uma arma nova para todos é uma linha só, e a invariante
  "nenhuma evolução perde uma arma do degrau anterior" continua olhando só o que é de
  classe.</p>`,
  (() => {
    const linhas = Object.entries(TIPOS).map(([id, t]) => {
      const quem = Object.entries(CLASSES)
        .filter(([cid]) => CLASSES[cid].tier === 1 && CLASSES[cid].usa.includes(id))
        .map(([, c]) => c.nome)
      const texto = ARMAS_DE_TODOS.includes(id)
        ? '<em>todas as classes</em>'
        : ['elmo', 'armadura', 'anel'].includes(id)
          ? '<em>todas as classes</em>'
          : quem.length
            ? quem.join(', ')
            : `<span class="fraca">só o caminho que a destrava</span>`
      return [`${t.emoji} ${t.nome}`, NOME_DO_SLOT[t.slot], t.exclusivo ? 'sim' : '—', texto]
    })
    return tabela(['TIPO', 'SLOT', 'EXCLUSIVO', 'QUEM USA DESDE O NÍVEL 1'], linhas, { classe: 'compacta' })
  })(),
)

// ========================================================== 5. habilidades

parte(
  5,
  'Habilidades',
  secao('5.1', 'O princípio: habilidades são dados, não código'),
  `<p>Cada habilidade é um punhado de números. O motor de combate lê esses campos e aplica;
  nenhuma habilidade é uma função. É o que permite mostrá-las na ficha, testá-las isoladamente e
  ajustá-las sem tocar no combate — e é o que faz feitiço e habilidade combinarem em vez de
  competirem, porque falam o mesmo vocabulário.</p>`,

  secao('5.2', 'Vocabulário de efeitos'),
  tabela(
    ['CAMPO', 'O QUE FAZ'],
    [
      ['<code>perfuracao</code>', 'Fração da DEF do alvo que o golpe ignora'],
      ['<code>execucao</code>', '<code>{ chance, mult, perfuracao }</code> — o golpe que encerra a luta'],
      ['<code>progressivo</code>', 'Quanto o dano cresce conforme o alvo perde vida'],
      ['<code>golpeDuplo</code>', 'Chance de atacar de novo no mesmo turno'],
      ['<code>servo</code>', 'Fração do ATQ que um segundo atacante bate todo turno'],
      ['<code>vampirismo</code>', 'Fração do dano causado que volta como vida'],
      ['<code>reducaoDeDano</code>', 'Fração do dano recebido que é cortada'],
      ['<code>furia</code>', '<code>{ porRodada, teto }</code> — ATQ que acumula durante a luta'],
      ['<code>maldicao</code>', '<code>{ porAcerto, teto }</code> — DEF que o alvo perde a cada acerto'],
      ['<code>prender</code>', 'Chance de o alvo perder o turno seguinte'],
      ['<code>esquivaExtra</code>', 'Esquiva somada à que a agilidade já dá'],
      ['<code>danoExtra</code>', 'Fração somada ao dano final (é o que os feitiços usam)'],
      ['<code>regeneracao</code>', 'Fração do HP máximo recuperada a cada turno próprio'],
      ['<code>contraAtaque</code>', 'Chance de revidar ao ser atingido'],
      ['<code>iniciativa</code>', 'Começa a luta independentemente da agilidade'],
      ['<code>precisao</code>', 'Quanto corta da esquiva do alvo'],
      ['<code>critico</code>', 'Crítico somado ao que a agilidade já dá'],
      ['<code>curaDoGrupo</code>', 'Cura cada aliado de pé a cada turno próprio — só em luta de grupo'],
      ['<code>saqueGold</code> · <code>saqueDrop</code>', 'Lidos fora do combate: prêmio e chance de drop'],
    ],
  ),

  secao('5.3', 'Acumulação e a regra de fusão'),
  `<p>As habilidades do caminho inteiro valem ao mesmo tempo, e ao combate chega um objeto só —
  classe mais os feitiços da arma e do secundário. A fusão tem três regras:</p>`,
  cod(`
funcao juntarEfeitos(a, b):
  numero   →  soma          (perfuração 20% + 22% = 42%)
  booleano →  OU            (iniciativa de qualquer um dos lados vale)
  objeto   →  o mais forte  (fica o de maior chance × mult; não somam)`),
  nota(
    `<strong>Objeto não soma, e isso tem consequência de projeto.</strong> Uma habilidade de
     degrau alto com <code>execucao</code> ou <code>furia</code> mais fraca que a de baixo
     simplesmente não faz nada. Foi o que aconteceu com a Fúria do Campeão e com a Execução
     Sombria, e é por isso que hoje toda habilidade de objeto supera a do degrau anterior.`,
  ),
  `<p>Como elas acumulam, as de nível ${config.rpg.evolucao.niveis[3]} e
  ${config.rpg.evolucao.niveis[4]} são individualmente mais modestas do que a descrição sugere:
  quem chega lá tem várias somadas, não uma.</p>`,

  secao('5.4', `As ${Object.keys(HABILIDADES).length} habilidades`),
  (() => {
    const donoDe = {}
    for (const [id, c] of Object.entries(CLASSES)) if (c.habilidade) donoDe[c.habilidade] = c
    const linhas = Object.entries(HABILIDADES).map(([id, h]) => [
      `${h.emoji} <strong>${h.nome}</strong>`,
      donoDe[id] ? `${donoDe[id].nome} <span class="fraca">(T${donoDe[id].tier})</span>` : '—',
      Object.entries(h.efeitos)
        .map(([k, v]) => `<code>${k}</code> ${efeitoEmTexto(v)}`)
        .join(' · '),
      h.resumo,
    ])
    return tabela(['HABILIDADE', 'CLASSE', 'EFEITOS', 'O QUE FAZ'], linhas, { classe: 'compacta' })
  })(),
)

// ========================================================= 6. equipamento

parte(
  6,
  'Equipamento',
  secao('6.1', 'Slots e raridades'),
  `<p>Cinco slots: ${SLOTS.map((s) => NOME_DO_SLOT[s].toLowerCase()).join(', ')}. Uma peça por
  slot, e o item precisa ser de nível menor ou igual ao do personagem.</p>`,
  tabela(
    ['RARIDADE', 'MULTIPLICADOR', 'PESO NO SORTEIO'],
    Object.entries(RARIDADES).map(([, r]) => [
      `${r.emoji} ${r.nome}`,
      `×${dec(r.mult)}`,
      `${dec(r.peso)}`,
    ]),
    { alinhar: ' nn' },
  ),
  `<p>O peso é relativo: a chance de cada raridade é o peso dela dividido pela soma de todos.</p>`,

  secao('6.2', `Os ${Object.keys(TIPOS).length} tipos`),
  `<p>Os nomes são todos com preposição ("de Ferro") para não dar problema de gênero: "Espada de
  Ferro" e "Escudo de Ferro" funcionam igual.</p>`,
  tabela(
    ['TIPO', 'SLOT', 'ATRIBUTOS DE FÁBRICA (FÓRMULA POR NÍVEL)', 'OBSERVAÇÃO'],
    Object.entries(TIPOS).map(([id, t]) => {
      const n50 = criarItem(id, 50, 'comum').bonus
      return [
        `${t.emoji} <strong>${t.nome}</strong>`,
        NOME_DO_SLOT[t.slot],
        Object.entries(n50)
          .map(([k, v]) => `${k.toUpperCase()} ${num(v)}`)
          .join('  '),
        t.exclusivo
          ? 'exclusivo: só cai para quem evoluiu no caminho que o usa'
          : ARMAS_DE_TODOS.includes(id)
            ? 'toda classe equipa'
            : '',
      ]
    }),
    { classe: 'compacta' },
  ),
  `<p class="fraca">Os atributos acima são os de uma peça <strong>comum de nível 50</strong> —
  é a régua de comparação. A fórmula completa está em 6.4.</p>`,

  secao('6.3', 'Nome do item: material por faixa de nível'),
  (() => {
    const faixas = [4, 9, 14, 19, 24, 29, 39, 49, 59, 69, 79, 89, 99, 120]
    const linhas = faixas.map((n, i) => [
      i === faixas.length - 1 ? `${faixas[i - 1] + 1}+` : `${i === 0 ? 1 : faixas[i - 1] + 1}–${n}`,
      criarItem('espada', n, 'comum').nome.replace('Espada ', ''),
    ])
    return tabela(['NÍVEL DO ITEM', 'MATERIAL'], linhas, { classe: 'compacta' })
  })(),

  secao('6.4', 'Atributos de fábrica'),
  cod(`
bonus[s] = max(1, arred( base(tipo, nivel)[s] × RARIDADES[raridade].mult ))

// armas de especialidade batem mais forte: é parte do prêmio de ter evoluído
pistola   atq = 4 + nivel × 1.8
machado   atq = 4 + nivel × 1.75
// armas com perfil próprio
martelo   atq = 3 + nivel × 1.5    def = 1 + nivel × 0.4
maca      atq = 3 + nivel × 1.5    def = 1 + nivel × 0.35
flauta    atq = 3 + nivel × 1.45   agi = 1 + nivel × 0.4
banjo     atq = 3 + nivel × 1.5    hp  = 3 + nivel × 1.1
foice     atq = 3 + nivel × 1.55   agi = 1 + nivel × 0.25
// qualquer outra arma
arma      atq = 3 + nivel × 1.6

escudo    def = 2 + nivel × 1.2    hp  = 5 + nivel × 2
magia     atq = 2 + nivel × 1.3
grimorio  atq = 1.5 + nivel × 1.0  hp  = 4 + nivel × 1.4
punhal    atq = 1.5 + nivel × 1.0  agi = 1 + nivel × 0.5
aljava    atq = 2 + nivel × 1.1    hp  = 3 + nivel × 1.0
manopla   def = 1.5 + nivel × 0.9  atq = 1 + nivel × 0.6
capa      agi = 1.5 + nivel × 0.8  hp  = 4 + nivel × 1.6
caveira   atq = 2 + nivel × 1.2    def = 1 + nivel × 0.4
rede      agi = 1 + nivel × 0.6    atq = 1.5 + nivel × 0.9
totem     atq = 1.5 + nivel × 1.0  def = 1 + nivel × 0.5
mascara   agi = 1.5 + nivel × 0.75 atq = 1 + nivel × 0.75

elmo      def = 1 + nivel × 0.6    hp  = 4 + nivel × 1.5
armadura  def = 2 + nivel × 1.1    hp  = 8 + nivel × 3
anel      agi = 1 + nivel × 0.5    atq = 1 + nivel × 0.4`),
  nota(
    `<strong>A foice serve a qualquer classe, então não pode ser a melhor arma de nenhuma.</strong>
     Ela bate um pouco menos que a arma comum (1,55 contra 1,6 por nível) e devolve a diferença
     em agilidade. Assim é sempre uma escolha — nunca a escolha óbvia que aposentaria as
     outras.`,
  ),

  secao('6.5', 'Preço de referência'),
  cod(`
precoDeReferencia(item) = max(20, arred( Σ bonusFinal(item) × 4 × RARIDADES[raridade].mult ))

a loja PAGA   = max(5,  arred(referencia × ${dec(config.rpg.lojaFracaoDeCompra)}))
a loja COBRA  = max(20, arred(referencia × ${dec(config.rpg.lojaMultiplicadorDeVenda)}))`),
  `<p>A margem entre os dois é deliberada: vender para outro jogador quase sempre rende mais do
  que despachar na loja, e é isso que faz o mercado e a casa de leilões existirem.</p>`,

  secao('6.6', 'Sorteio de drop'),
  cod(`
funcao sortearDrop(classe, nivel, sorte):
  daClasse = tipos que a classe usa
  lista    = sorte() < ${dec(config.rpg.chanceDropDaPropriaClasse)} ? daClasse : TIPOS_COMUNS
  tipo     = um da lista, uniforme
  devolve criarItem(tipo, max(1, nivel), sortearRaridade(sorte))`),
  `<p><code>TIPOS_COMUNS</code> é tudo que não é exclusivo. Os
  ${pct(1 - config.rpg.chanceDropDaPropriaClasse)} de drops fora da classe são de propósito: é
  o que dá assunto para a troca entre jogadores.</p>`,
)

// ============================================================== 7. combate

parte(
  7,
  'O motor de combate',
  `<p>O coração do jogo. É uma função pura: recebe dois lados já com os atributos somados,
  devolve quem venceu e o log. Não toca no banco, não faz rede, e recebe o gerador aleatório por
  parâmetro.</p>`,

  secao('7.1', 'Forma de um lutador'),
  cod(`
{
  nome:  'Você',
  nivel: 152,          // usado só para a defesa de referência (7.3)
  atq: 1603, def: 793, agi: 361,
  hp: 3200,            // vida ATUAL ao entrar
  hpMax: 3809,
  hab: { ... }         // efeitos: habilidades da linhagem + feitiços equipados
}`),
  `<p>Monstros e chefes entram com <code>hab</code> vazio — passam batido por todo o código de
  habilidades.</p>`,
  cod(`
funcao efeitosDe(jogador):
  devolve juntarEfeitos(
    efeitosDaClasse(jogador.classe),        // as 1..4 habilidades da linhagem
    efeitosDosFeiticos([arma, secundario])  // os feitiços das duas peças
  )`),

  secao('7.2', 'Chances derivadas da agilidade'),
  cod(`
chanceDeCritico(agi) = min( 0.35, agi / 200 )
chanceDeEsquiva(agi) = min( 0.25, agi / 280 )`),
  `<p>Ambas saturam. A agilidade continua valendo acima do teto para a ordem de turno, mas não
  vira esquiva infinita.</p>`,

  secao('7.3', 'Mitigação: a defesa reduz por porcentagem'),
  cod(`
defesaDeReferencia(nivel) = ${config.rpg.mitigacao.referenciaBase} + max(0, nivel − ${config.rpg.mitigacao.desde}) × ${config.rpg.mitigacao.porNivel}
mitigacao                 = referencia / (referencia + defEfetiva × 1.5)`),
  `<p><strong>Por que porcentagem e não subtração.</strong> Subtraindo, bastava a defesa passar
  do ataque do inimigo para todo golpe virar o mínimo de 1, e o jogador ficava invencível com
  umas poucas peças.</p>`,
  `<p><strong>Por que a referência cresce com o nível.</strong> Esta foi a correção mais
  importante do fim de jogo. Com o "100" fixo, um personagem nível 100 com DEF 700 cortava 91%
  de todo dano recebido: as lutas viravam atrito de 46 rodadas, decididas por quem tinha mais
  DEF. Com a referência crescendo, 1 ponto de DEF vale proporcionalmente o mesmo no nível 5 e no
  nível 200. O limiar <code>desde = ${config.rpg.mitigacao.desde}</code> garante que a faixa de
  1 a ${config.rpg.mitigacao.desde} continue idêntica ao jogo original, byte por byte.</p>`,

  secao('7.4', 'Um golpe, passo a passo'),
  `<p>Esta é a função mais sensível do documento. <strong>A ordem dos fatores é
  normativa.</strong></p>`,
  cod(`
funcao golpe(atacante, defensor, sorte):
  meu  = atacante.hab
  dele = defensor.hab

  // 1. ESQUIVA — antes de qualquer coisa. Esquivou, o golpe não aconteceu.
  esquiva = max(0, chanceDeEsquiva(defensor.agi) + dele.esquivaExtra − meu.precisao)
  se sorte() < esquiva:
    devolve { dano: 0, esquivou: verdadeiro }

  // 2. SORTEIOS do golpe
  variacao = 0.85 + sorte() × 0.30                       // 0.85 .. 1.15
  critico  = sorte() < min(0.60, chanceDeCritico(atacante.agi) + meu.critico)
  executou = meu.execucao existe E sorte() < meu.execucao.chance

  // 3. DEFESA EFETIVA — o que a maldição derreteu, menos o que a perfuração atravessa
  perfuracao = min(0.80, meu.perfuracao + (executou ? meu.execucao.perfuracao : 0))
  defEfetiva = max(0, defensor.def × (1 − defensor.maldicao) × (1 − perfuracao))

  // 4. FATORES DE CONTEXTO
  faltando    = 1 − defensor.hp / defensor.hpMax          // 0 = inteiro, 1 = morto
  progressivo = 1 + meu.progressivo × faltando
  atqEfetivo  = atacante.atq × (1 + atacante.furia)
  mitigacao   = defesaDeReferencia(defensor.nivel) / (referencia + defEfetiva × 1.5)

  // 5. O PRODUTO — sete fatores, nesta ordem
  bruto = atqEfetivo
        × variacao
        × (critico  ? 1.8 : 1)
        × (executou ? meu.execucao.mult : 1)
        × progressivo
        × mitigacao
        × (1 + meu.danoExtra)
        × (1 − dele.reducaoDeDano)

  dano = max(1, arred(bruto))                             // nunca zero

  // 6. EFEITO COLATERAL: a maldição acumula NO DEFENSOR e sobrevive ao golpe
  se meu.maldicao existe:
    defensor.maldicao = min(meu.maldicao.teto, defensor.maldicao + meu.maldicao.porAcerto)

  devolve {
    dano, esquivou: falso, critico, executou,
    cura:    meu.vampirismo ? arred(dano × meu.vampirismo) : 0,
    prendeu: meu.prender existe E sorte() < meu.prender
  }`),
  `<p>Pontos de atenção:</p>`,
  lista([
    `São exatamente <strong>quatro chamadas a <code>sorte()</code></strong> no caminho feliz,
     nesta ordem: esquiva, variação, crítico, execução — e uma quinta para prender. Para
     reproduzir lutas idênticas a partir de uma semente, a ordem precisa ser a mesma.`,
    `A <code>maldicao</code> é o único estado que sobrevive de um golpe para o outro dentro de
     uma luta, e mora no <strong>defensor</strong>.`,
    `O dano mínimo é 1, nunca 0. Um golpe que acerta sempre machuca.`,
    `<code>reducaoDeDano</code> é do defensor; todos os outros campos lidos são do atacante.`,
  ]),

  secao('7.5', 'A luta inteira'),
  cod(`
MAX_RODADAS = 30      // o laço roda até MAX_RODADAS × 2 meios-turnos

funcao lutar(a, b, sorte):
  prepara os dois lados: copia, fixa hpMax, zera maldicao/furia/preso

  // ORDEM DE TURNO
  vez = (a.agi >= b.agi) ? 'a' : 'b'                    // empate favorece o lado A
  se a.hab.iniciativa E nao b.hab.iniciativa: vez = 'a'
  se b.hab.iniciativa E nao a.hab.iniciativa: vez = 'b'
  // se os DOIS têm iniciativa, volta a valer a agilidade

  enquanto ambos vivos E rodadas < MAX_RODADAS × 2:
    rodadas += 1
    atacante = lado[vez];  alvo = lado[outro]

    // A. PRESO — perde a vez, e o estado se limpa
    se atacante.preso:
      atacante.preso = falso;  registra;  passa a vez;  continua

    // B. FÚRIA acumula ANTES de atacar
    atacante.furia = min(teto, atacante.furia + porRodada)

    // C. REGENERAÇÃO no início do próprio turno
    atacante.hp = min(hpMax, hp + arred(hpMax × regeneracao))

    // D. OS GOLPES DO TURNO
    golpes = [ atacante ]
    se atacante.hab.golpeDuplo E sorte() < golpeDuplo:  golpes += [ atacante ]
    se atacante.hab.servo:                              golpes += [ servoDe(atacante) ]

    para cada g em golpes:
      se alvo morreu: interrompe
      r = golpe(g, alvo, sorte)
      alvo.hp -= r.dano
      se r.cura > 0: atacante.hp = min(hpMax, hp + r.cura)   // vampirismo cura o DONO
      se r.prendeu E alvo vivo: alvo.preso = verdadeiro

      // E. CONTRA-ATAQUE — imediato, e NUNCA encadeia
      se alvo vivo E r.dano > 0 E alvo.hab.contraAtaque E sorte() < contraAtaque:
        revide = golpe(alvo, atacante, sorte);  aplica
        se atacante morreu: interrompe

    vez = outro lado

  // DESFECHO
  se os dois continuam vivos (bateu o limite de rodadas):
    porDecisao = verdadeiro
    vence quem tem maior hp/hpMax                     // vida PROPORCIONAL
  senao:
    vence quem está vivo

servoDe(dono, fracao) = { atq: dono.atq × fracao, def: dono.def, agi: dono.agi × 0.5, hab: {} }`),
  `<p><strong>Por que o contra-ataque não encadeia.</strong> Se o revide pudesse provocar outro
  revide, dois lutadores com a habilidade trocariam golpes para sempre dentro do mesmo turno. O
  revide é resolvido com uma chamada direta a <code>golpe()</code>, fora do laço, e ponto.</p>`,
  `<p><strong>Por que vitória por decisão usa vida proporcional.</strong> Comparar HP absoluto
  faria o tanque vencer todo empate técnico só por ter a barra maior. Proporcional mede quem
  estava efetivamente mais perto de cair.</p>`,

  secao('7.6', 'O log estruturado'),
  `<p>Cada evento vira uma entrada. É daqui que sai <em>toda</em> a apresentação de combate: o
  texto narrado, as barras de vida e o palco (Parte 27) desenham o mesmo log, linha a linha.</p>`,
  tabela(
    ['TIPO', 'CAMPOS', 'SIGNIFICADO'],
    [
      [
        '<code>ataque</code>',
        '<code>quem, nome, alvo, marca, dano, esquivou, critico, executou, hpAlvo, hpMaxAlvo, hpQuemAtaca</code>',
        'um golpe',
      ],
      ['<code>regenerou</code>', '<code>quem, nome, cura, hpQuemAtaca</code>', 'cura de início de turno'],
      ['<code>preso</code>', '<code>quem, nome, alvo</code>', 'perdeu a vez'],
    ],
  ),
  `<p>O campo <code>marca</code> qualifica o golpe: <code>null</code> (normal),
  <code>'duplo'</code>, <code>'servo'</code>, <code>'revide'</code>.</p>`,

  secao('7.7', 'Combate em grupo'),
  `<p>Variação do motor para N jogadores contra um chefe. É o que raid, masmorra em grupo e
  eventos de grupo usam.</p>`,
  cod(`
funcao lutarEmGrupo(jogadores, chefe, sorte):
  enquanto chefe vivo E algum jogador de pé E rodada < 30:
    rodada += 1

    // 1. TODOS OS JOGADORES DE PÉ ATACAM, em ordem decrescente de agilidade
    para cada jogador de pé:
      acumula fúria; regenera; cura o grupo (se tiver curaDoGrupo)
      golpes = [próprio] (+ duplo, + servo, como no combate individual)
      aplica cada um contra o chefe
      se chefe morreu: interrompe

    // 2. O CHEFE REVIDA
    se chefe.preso: limpa e pula a vez
    ehArea = (chefe.areaCada > 0) E (rodada mod chefe.areaCada == 0)
    se ehArea:
      para cada jogador de pé:
        dano = max(1, arred( golpe(chefe, jogador).dano × chefe.areaMultiplicador ))
        aplica; quem chega a 0 fica CAÍDO
    senao:
      alvo = jogador de pé sorteado uniformemente
      aplica golpe(chefe, alvo); se chega a 0, fica CAÍDO

  devolve { venceu: chefe.hp <= 0, rodadas, log, time, dePe }`),
  `<p><strong>O golpe em área é o que impede "quanto mais gente, melhor" sem limite.</strong>
  Com dano só de alvo único, chamar dez pessoas diluiria o dano do chefe a ponto de tornar a
  vitória garantida. Quem cai para de atacar, mas a luta continua — e ainda recebe 60% da
  recompensa se o grupo vencer.</p>`,
)

// ============================================================= 8. inimigos

parte(
  8,
  'Inimigos: monstros, elites e chefes',
  secao('8.1', 'A fórmula base de um monstro'),
  cod(`
atributosDeMonstro(nivel, mult).hp  = arred( (56   + nivel × 20.8) × mult.hp  × escala.hp  )
atributosDeMonstro(nivel, mult).atq = arred( (8.8  + nivel × 4.16) × mult.atq × escala.atq )
atributosDeMonstro(nivel, mult).def = arred( (4    + nivel × 1.92) × mult.def × escala.def )
atributosDeMonstro(nivel, mult).agi = arred( (5    + nivel × 1.4)  × mult.agi × escala.agi )`),
  `<p>Monstro neutro (todos os multiplicadores em 1), sem escala:</p>`,
  (() => {
    const niveis = [10, 25, 50, 100, 150, 200]
    const linhas = niveis.map((n) => {
      const m = atributosDeMonstro(n, { hp: 1, atq: 1, def: 1, agi: 1 })
      return [String(n), num(m.hp), num(m.atq), num(m.def), num(m.agi)]
    })
    return tabela(['NÍVEL', 'HP', 'ATQ', 'DEF', 'AGI'], linhas, { alinhar: 'nnnnn' })
  })(),

  secao('8.2', `As ${ESPECIES.length} espécies`),
  `<p><code>desde</code> é o nível de jogador a partir do qual a espécie começa a aparecer: um
  Slime nível 70 não assusta ninguém, e o bestiário precisava crescer junto.</p>`,
  tabela(
    ['ESPÉCIE', 'DESDE', 'HP', 'ATQ', 'DEF', 'AGI'],
    ESPECIES.map((e) => [
      `${e.emoji} ${e.nome}`,
      e.desde ? String(e.desde) : '1',
      dec(e.mult.hp),
      dec(e.mult.atq),
      dec(e.mult.def),
      dec(e.mult.agi),
    ]),
    { alinhar: ' nnnnn', classe: 'compacta' },
  ),

  secao('8.3', 'Elites'),
  cod(`
elite = sorte() < ${dec(config.rpg.chanceElite)}
nivel = nivelDoJogador + (−1, 0 ou +1) + (elite ? 3 : 0)
se elite: todos os multiplicadores × 1.25, e o nome ganha um título`),
  `<p>Os títulos: Veterano, Sombrio, Ancião, Sanguinário, Amaldiçoado.</p>`,

  secao('8.4', 'A escala de fim de jogo'),
  `<p>Até o limiar a conta é a original. Dali para cima entra um termo por nível, porque o
  jogador cresce duas vezes e o monstro só uma:</p>`,
  cod(`
passos = max(0, nivel − ${config.rpg.escalaEndgame.desde})
curva  = 1 − e^(−passos / ${config.rpg.escalaEndgame.meia})
degrau = Σ degrausDeClasse[n] para todo n <= nivel     // ${Object.entries(config.rpg.escalaEndgame.degrausDeClasse).map(([n, q]) => `${n}: +${pct(q)}`).join(', ')}

escala.hp  = 1 + ${dec(config.rpg.escalaEndgame.teto.hp)} × curva + degrau
escala.atq = 1 + ${dec(config.rpg.escalaEndgame.teto.atq)} × curva + degrau
escala.def = 1 + ${dec(config.rpg.escalaEndgame.teto.def)} × curva + degrau
escala.agi = 1 + ${dec(config.rpg.escalaEndgame.teto.agi)} × curva + degrau × 0.3`),
  (() => {
    const niveis = [1, 40, 45, 50, 100, 149, 150, 199, 200, 250]
    const linhas = niveis.map((n) => {
      const e = escalaDeNivel(n)
      return [String(n), dec(e.hp), dec(e.atq), dec(e.def), dec(e.agi)]
    })
    return tabela(['NÍVEL', 'HP', 'ATQ', 'DEF', 'AGI'], linhas, { alinhar: 'nnnnn' })
  })(),
  `<p><strong>A curva satura de propósito</strong>: sobe rápido nos primeiros níveis depois do
  limiar e então estabiliza, porque acima disso jogador e monstro já crescem no mesmo ritmo. Um
  multiplicador que não parasse de subir viraria parede intransponível.</p>`,
  `<p><strong>Os degraus de classe endurecem o mundo exatamente onde o jogador ganha uma
  habilidade nova.</strong> Medindo, o salto de poder de maestria e apoteose vem das habilidades
  acumuladas (~25 pontos por degrau), não do crescimento de atributo. Uma rampa linear desde o
  ${config.rpg.escalaEndgame.desde} foi testada e rejeitada: punia quem ainda está no degrau de
  baixo.</p>`,

  secao('8.5', 'A tabela de chefes'),
  `<p>Os ${NIVEIS_DE_BOSS.length} chefes nomeados, na ordem em que foram escritos — que já é a
  ordem de dificuldade. A chave é o nível de marco para o qual cada um foi calibrado, e é por
  isso que a tabela continua indexada assim mesmo depois de os marcos terem saído do jogo.
  Quem os distribui hoje é a rota: um por ato, na última fase de cada um (9.3).</p>`,
  tabela(
    ['CALIBRADO PARA', 'ATO', 'CHEFE', 'HP', 'ATQ', 'DEF', 'AGI'],
    NIVEIS_DE_BOSS.map((marco, i) => {
      const b = BOSSES[marco]
      return [
        String(marco),
        String(i + 1),
        `${b.emoji} ${b.nome}`,
        dec(b.mult.hp),
        dec(b.mult.atq),
        dec(b.mult.def),
        dec(b.mult.agi),
      ]
    }),
    { alinhar: 'nn nnnn', classe: 'compacta' },
  ),
  `<p class="fraca">HP/ATQ/DEF/AGI são multiplicadores sobre a fórmula base. A vida baixa é de
  propósito: chefe é para bater forte, não para ser saco de pancada.</p>`,

  secao('8.6', 'Chefes infinitos: o rodízio de ecos'),
  `<p>A rota tem ${TOTAL_DE_ATOS} atos e chefes nomeados só há ${NIVEIS_DE_BOSS.length}. Do ato
  ${NIVEIS_DE_BOSS.length + 1} em diante eles voltam como <strong>eco</strong>, com os
  atributos do ato novo — e só os de fim de jogo entram no rodízio: um Rei Goblin no ato 30 não
  assusta ninguém, mesmo com os atributos daquela faixa.</p>`,
  cod(`
passos = ato − ${NIVEIS_DE_BOSS.length} − 1
origem = RODIZIO[passos mod |RODIZIO|]          // RODIZIO = os calibrados para >= 35
volta  = piso(passos / |RODIZIO|)
nome   = "<original> Ecoado" + " " + "★" × min(3, volta)`),
  (() => {
    const linhas = [20, 25, 34, 48, TOTAL_DE_ATOS].map((a) => {
      const c = chefeDoAto(a)
      const g = indiceDaFase(a, config.rpg.cacada.fasesPorAto)
      return [
        String(a),
        `${c.emoji} ${c.nome}`,
        String(nivelDaFase(g) + config.rpg.cacada.chefeNiveisAcima),
      ]
    })
    return tabela(['ATO', 'QUEM APARECE', 'NÍVEL'], linhas, { alinhar: 'n n' })
  })(),
  `<p>O ato ${TOTAL_DE_ATOS} é a exceção: ele tem chefe próprio, porque nenhum eco serve de
  último chefe do jogo.</p>`,

  secao('8.7', 'Recompensas de um inimigo derrotado'),
  cod(`
multXp   = boss ? 6 : elite ? 2.2 : 1
multGold = boss ? 8 : elite ? 2.5 : 1
bonusEndgame = 1 + (escala.hp − 1) × 0.5
bonusDaFase  = 1 + (forca − 1) × ${dec(config.rpg.cacada.bonusDeRecompensa)}   // 1 fora da rota

xp    = arred( (18 + nivel × 8) × multXp × bonusEndgame × bonusDaFase )
gold  = arred( (8 + nivel × 4) × multGold × bonusEndgame × bonusDaFase × (0.7 + sorte() × 0.6) )
drop  = sorte() < (boss ? 1 : elite ? 0.7 : 0.35) + hab.saqueDrop`),
  `<p>Acima do limiar o bicho dá mais trabalho, então paga melhor — senão subir de nível no fim
  de jogo viraria moagem pura. <code>bonusDaFase</code> faz o mesmo pela rampa da rota (9.2):
  o que endurece também paga melhor, senão a rota seria um caminho em que cada passo custa
  mais e rende o mesmo.</p>`,
)

// =========================================================== 9. encontros

parte(
  9,
  'A rota: arcos, atos e fases',
  `<p>O caminho que o personagem percorre do começo ao fim do jogo, e a única coisa que
  decide o que ele enfrenta. São <strong>${ARCOS.length - 1} arcos de dez atos</strong>, mais
  o ato final: ${TOTAL_DE_ATOS} atos, ${config.rpg.cacada.fasesPorAto} fases cada,
  <strong>${TOTAL_DE_ATOS * config.rpg.cacada.fasesPorAto} fases</strong> em linha reta.</p>`,
  nota(
    `<strong>A inversão que define o jogo.</strong> O nível do inimigo, quantos vêm e quanto
     batem saem da FASE, nunca do nível de quem joga. No modelo anterior o monstro nascia no
     nível do jogador: subir de nível não deixava a caçada mais fácil, só trocava os números
     dos dois lados, e não havia como empacar. Aqui a fase 120 é a fase 120 para todo mundo —
     quem não dá conta volta uma fase, repete o que consegue vencer e sobe de nível até
     passar. A parede é o conteúdo.`,
  ),

  secao('9.1', 'Os arcos'),
  tabela(
    ['ARCO', 'ATOS', 'DO PRIMEIRO AO ÚLTIMO'],
    ARCOS.map((a, i) => {
      const primeiro = ATOS.find((x) => x.arco === i + 1)
      const ultimo = [...ATOS].reverse().find((x) => x.arco === i + 1)
      return [
        nomeDoArco(a),
        primeiro.numero === ultimo.numero ? String(primeiro.numero) : `${primeiro.numero} a ${ultimo.numero}`,
        primeiro.numero === ultimo.numero ? primeiro.nome : `${primeiro.nome} → ${ultimo.nome}`,
      ]
    }),
  ),
  `<p>A lista completa dos ${TOTAL_DE_ATOS} atos está em <code>server/rpg/rota.js</code>. O nome
  de cada um é normativo em dois sentidos: é o que a tela escreve e é o que casa o ato com a
  pasta de cenário (Parte 27).</p>`,

  secao('9.2', 'A conta da fase'),
  `<p>Tudo que escala usa o <strong>índice global</strong> da fase, de 1 a
  ${TOTAL_DE_ATOS * config.rpg.cacada.fasesPorAto}; o par <code>{ ato, fase }</code> é só a
  forma de mostrar.</p>`,
  cod(`
indice(ato, fase) = (ato − 1) × ${config.rpg.cacada.fasesPorAto} + fase

nivelDaFase(g)    = max(1, 1 + piso( (g − 1) × ${dec(config.rpg.cacada.nivelPorFase)} ))
forcaDaFase(g)    = 1 + (g − 1) × ${config.rpg.cacada.forcaPorFase} × escalaDeDificuldade

ehFaseDeChefe(f)  = f == ${config.rpg.cacada.fasesPorAto}
quantosInimigos(ato, fase) =
  limitar( ${config.rpg.cacada.inimigos.base}
           + (fase − 1) × ${config.rpg.cacada.inimigos.porFase}
           + (ato  − 1) × ${config.rpg.cacada.inimigos.porAto},
           1, ${config.rpg.cacada.inimigos.maximo} )`),
  tabela(
    ['FASE', 'NÍVEL DO INIMIGO', 'FORÇA', 'HORDA'],
    [1, 50, 100, 200, 300, 400, 510].map((g) => {
      const { ato: a, fase: f } = faseDoIndice(g)
      return [
        `${a}-${String(f).padStart(2, '0')} (g=${g})`,
        String(nivelDaFase(g)),
        dec(forcaDaFase(g)),
        ehFaseDeChefe(f) ? 'o chefe do ato' : String(quantosInimigos(a, f)),
      ]
    }),
  ),
  nota(
    `<strong>Os inimigos da rota não recebem a escala de fim de jogo (8.4).</strong> Aquela
     escala existe para compensar o jogador crescer duas vezes (nível e equipamento) contra um
     monstro que nasce no nível dele. Na rota o nível do inimigo é uma régua fixa: aplicar os
     dois termos multiplicaria uma compensação que ali não existe, e a dificuldade deixaria de
     ser linear na fase. Medido, a rota virava parede por volta do ato 9 e não saía mais de
     lá. Abismo, raid, masmorra e chefe mundial continuam com a escala.`,
  ),

  secao('9.3', 'Os chefes de ato'),
  `<p>A fase ${config.rpg.cacada.fasesPorAto} de cada ato é o chefe dele, lutando
  <code>${config.rpg.cacada.chefeNiveisAcima}</code> níveis acima da própria fase. São os
  ${NIVEIS_DE_BOSS.length} chefes nomeados da Parte 8, na ordem em que a tabela os escreve —
  que já é a ordem de dificuldade.</p>`,
  tabela(
    ['ATO', 'CHEFE', 'NÍVEL'],
    [1, 5, 10, 15, 19, 20, 33, 47, TOTAL_DE_ATOS].map((a) => {
      const g = indiceDaFase(a, config.rpg.cacada.fasesPorAto)
      const c = chefeDoAto(a)
      return [`${a} — ${ato(a).nome}`, `${c.emoji} ${c.nome}`, String(nivelDaFase(g) + config.rpg.cacada.chefeNiveisAcima)]
    }),
  ),
  `<p>Passado o último nomeado (ato ${NIVEIS_DE_BOSS.length}), eles voltam como
  <strong>eco</strong>: só os de fim de jogo entram no rodízio, com os atributos do ato novo e
  uma estrela a cada volta completa. O ato ${TOTAL_DE_ATOS} tem chefe próprio.</p>`,

  secao('9.4', 'Uma fase, do começo ao fim'),
  `<p>Uma chamada resolve a fase inteira, como a descida do Abismo. Não há estado pendurado
  esperando o próximo clique.</p>`,
  cod(`
funcao enfrentar(jogador, sorte):
  onde = posicao(jogador)                     // { ato, fase } da ficha
  fase = montarFase(onde.ato, onde.fase, sorte)
  hp   = atributos(jogador).hp                // entra SEMPRE com a vida cheia

  para cada inimigo em fase.inimigos:
    luta = lutar( comoLutador(jogador, hp), inimigo, sorte )

    se PERDEU:
      venceu = falso
      interrompe                              // o resto da horda nunca entra em cena

    premiar(jogador, inimigo, forca: fase.forca)        // XP, gold, titanita, feitiço, drop
    hp = min( hpMax, luta.hpA + hpMax × ${dec(config.rpg.cacada.curaEntreInimigos)} )

  andarNaRota(jogador, onde, venceu)`),
  nota(
    `<strong>A vida não volta entre os inimigos da mesma horda</strong> — só o respiro de
     <code>${dec(config.rpg.cacada.curaEntreInimigos)}</code> do máximo. É esse desgaste
     acumulado que faz a fase ser uma prova, e não três lutas soltas. Em 0 a horda vira
     execução: medido por simulação, três inimigos seguidos sem respiro nenhum exigem o
     personagem três vezes acima do nível da fase, e como o XP sai do nível do INIMIGO, quem
     fica três vezes acima nunca mais alcança a rota.`,
  ),

  secao('9.5', 'Andar na rota'),
  cod(`
funcao andarNaRota(jogador, onde, venceu):
  se PERDEU:
    ficha.cacada.posicao  = faseAnterior(onde)     // no ato 1 fase 1, fica onde está
    ficha.cacada.repetindo = verdadeiro            // o avanço automático DESLIGA
    ficha.cacada.travada   = onde                  // a fase que derrubou
    devolve

  marcaRecorde(onde)                               // maiorAto / maiorFase
  se travada existe E onde >= travada: travada = nulo

  // Repetindo, fica onde está: é o jogador que manda seguir.
  destino = (repetindo OU ehOFim(onde)) ? onde : proximaFase(onde)
  ficha.cacada.posicao = destino
  novoAto = destino.ato != onde.ato                // dispara o nome do lugar na tela`),
  `<p>E o botão que religa o avanço:</p>`,
  cod(`
funcao avancar(jogador):
  exige: repetindo == verdadeiro
  ficha.cacada.posicao   = travada ?? proximaFase(posicao)
  ficha.cacada.repetindo = falso`),
  nota(
    `<strong>Por que guardar a fase travada.</strong> Na fase 1 do ato 1 não há para onde
     recuar: sem ela, "ir para a próxima fase" empurraria o personagem para a fase 2 sem ele
     ter vencido a 1.`,
  ),

  secao('9.6', 'A vida, fora e dentro da fase'),
  `<p>Fora de combate a vida é <strong>sempre cheia</strong>:</p>`,
  cod('vidaAtual(jogador) = atributos(jogador).hp'),
  `<p>Vencer uma fase leva à seguinte inteiro; perder devolve à anterior, também inteiro. Raid,
  Abismo, masmorra, evento, duelo e Rito entram cheios pelo mesmo motivo. Por isso não há
  regeneração com relógio, fogueira, poção, bandagem nem estado ferido: eles administravam a
  vida ENTRE duas lutas, e entre duas lutas não há mais o que administrar. A vida continua
  decidindo o jogo — dentro da fase, onde o desgaste de uma onda para a outra é o que diz se a
  horda cai.</p>`,

  secao('9.7', 'O botão de dificuldade'),
  `<p><code>config.rpg.cacada.escalaDeDificuldade</code> multiplica o excedente da rampa e
  <strong>só ele</strong> precisa ser mexido para a rota inteira ficar mais dura ou mais
  mansa. Em <code>1</code> vale a rampa calibrada; em <code>0</code> a rota vira nível puro.</p>`,
  `<p>A calibragem de hoje (<code>forcaPorFase = ${config.rpg.cacada.forcaPorFase}</code>),
  medida jogando a rota inteira por simulação com equipamento incomum: a rota sai em
  <strong>~1.800 fases</strong>, do nível 1 ao 506; os oito primeiros atos passam quase sem
  tropeço e a fricção aparece do nono em diante, entre 30 e 70 fases por ato.</p>`,
)

// =============================================================== 10. abismo

parte(
  10,
  'O Abismo',
  `<p>O fim de jogo solo. O personagem desce enfrentando um chefe por andar, sem cura cheia
  entre eles — só um respiro. Cada andar vem mais forte que o anterior, então a descida sempre
  termina em morte; a graça é ver até onde dá. Abre no nível
  ${config.rpg.abismo.nivelMinimo}.</p>`,

  secao('10.1', 'Estrutura'),
  cod(`
funcao descer(jogador, sorte):
  entra com a vida CHEIA (o Abismo já é duro o bastante)
  para andar = 1 .. ${config.rpg.abismo.maxAndares}:
    inimigo = criarHabitante(nivelDoJogador, andar)
    luta    = lutar(eu, inimigo, sorte)
    registra o andar
    se perdeu: interrompe
    eu.hp = vidaEntreAndares(luta.hpA, maximo)
  premio = recompensaDaDescida(nivel, andaresVencidos)
  ferir(jogador)                    // sai do Abismo carregado nos braços`),
  `<p>A descida inteira é resolvida de uma vez e devolvida junto — nada fica pendurado
  esperando o jogador responder andar por andar. Elimina estado intermediário, elimina timeout,
  elimina o jogador que fecha o navegador no andar 7. A interface anima a descida a partir do
  log.</p>`,

  secao('10.2', 'O habitante de cada andar'),
  cod(`
habitante = HABITANTES[(andar − 1) mod ${HABITANTES.length}]
fracao    = ${dec(config.rpg.abismo.fracaoInicial)} + (andar − 1) × ${dec(config.rpg.abismo.fracaoPorAndar)}
nivel     = max(1, arred(nivelDoJogador × fracao))
forca     = 1 + (andar − 1) × ${dec(config.rpg.abismo.forcaPorAndar)}
mult      = { hp, atq, def } do habitante × forca   (agi não escala)
volta     = piso((andar − 1) / ${HABITANTES.length})    → sufixo "★" × min(3, volta)`),
  `<p><strong>O nível do andar é uma fração do nível do jogador, não um degrau fixo.</strong>
  "Dez níveis abaixo" vale muito mais para quem é nível 45 do que para quem é 100, e a descida
  ficava com profundidades incomparáveis.</p>`,
  tabela(
    ['#', 'HABITANTE', 'HP', 'ATQ', 'DEF', 'AGI'],
    HABITANTES.map((h, i) => [
      String(i + 1),
      `${h.emoji} ${h.nome}`,
      dec(h.mult.hp),
      dec(h.mult.atq),
      dec(h.mult.def),
      dec(h.mult.agi),
    ]),
    { alinhar: 'n nnnn' },
  ),
  `<p>As faixas de profundidade dão nome ao andar — e, na versão web, também o cenário
  (Parte 27):</p>`,
  (() => {
    const marcos = [1, 4, 8, 13, 19, 26]
    return tabela(
      ['ANDARES', 'PROFUNDIDADE', 'CHAVE DA ARTE'],
      marcos.map((a, i) => [
        i === marcos.length - 1 ? `${a}+` : `${a}–${marcos[i + 1] - 1}`,
        nomeDaProfundidade(a),
        `<code>${cenarioDaProfundidade(a)}</code>`,
      ]),
    )
  })(),

  secao('10.3', 'Vida entre andares'),
  cod(`
vidaEntreAndares(hp, maximo) = min(maximo, arred(max(
  hp + maximo × ${dec(config.rpg.abismo.curaPorAndar)},     // o respiro
  maximo × ${dec(config.rpg.abismo.pisoDeVida)}              // o piso
)))`),
  `<p>O piso é o que faz a descida terminar <strong>pela dificuldade</strong>, e não por
  sangramento acumulado. Sem ele, a descida acabava em dois ou três andares — e pior, acabava
  mais cedo para as classes de corpo mole, que perdiam metade da vida em cada luta ganha. Com o
  piso, o que encerra a descida é a rampa de dificuldade alcançar o personagem, que é o que se
  quer medir.</p>`,
  nota(
    `<strong>Lições que custaram caro:</strong> lutas independentes em sequência dão
     profundidade <code>p/(1−p)</code>. Aumentar a cura entre andares não muda praticamente
     nada — o que muda é o nível do andar ser proporcional ao do jogador.`,
  ),

  secao('10.4', 'Recompensa'),
  cod(`
fator = 1 + nivel × 0.03
para i = 1 .. andaresVencidos:
  xp   += (${config.rpg.abismo.xpPorAndar} + ${config.rpg.abismo.xpPorAndarAoQuadrado} × (i−1)) × fator
  gold += (${config.rpg.abismo.goldPorAndar} + ${config.rpg.abismo.goldPorAndarAoQuadrado} × (i−1)) × fator

itens     = min(${config.rpg.abismo.maxItens}, max(1, piso(andares / ${config.rpg.abismo.andaresPorItem})))
titanitas = max(1, piso(andares / ${config.rpg.abismo.andaresPorItem})) sorteios
feitiços  = max(1, piso(andares / ${config.rpg.abismo.andaresPorFeitico})) sorteios, chance ${dec(config.rpg.feiticeiro.chanceDrop.abismo)}

raridade = melhor de (1 + piso(andar / 5)) sorteios, com piso em "incomum"`),
  `<p>Quem desceu o Abismo não volta com item comum. E é a melhor fonte de feitiço do jogo: os
  mais fortes só aparecem para quem desce fundo, porque o nível do sorteio é o do andar
  alcançado.</p>`,
)

// ================================================================ 11. raids

parte(
  11,
  'Raids',
  `<p>De ${config.rpg.raid.minJogadores} a ${config.rpg.raid.maxJogadores} jogadores contra um
  chefe grande. A sala vive em memória e não retém nada: entrar não custa, e um reinício no meio
  da formação não cobra de ninguém.</p>`,

  secao('11.1', 'O ciclo de uma sala'),
  cod(`
abrir   →  quem abre escolhe o chefe (sorteado entre os liberados para o nível)
entrar  →  até ${config.rpg.raid.maxJogadores}; a sala vence em ${config.rpg.raid.salaMinutos} min sem começar
iniciar →  só quem abriu, com pelo menos ${config.rpg.raid.minJogadores}; resolve tudo de uma vez
           e devolve o log de grupo inteiro`),

  secao('11.2', `Os ${Object.keys(TODOS_OS_CHEFES).length} chefes`),
  tabela(
    ['CHEFE', 'HP', 'ATQ', 'DEF', 'AGI', 'ÁREA', 'DURO'],
    Object.values(TODOS_OS_CHEFES).map((c) => [
      `${c.emoji} ${c.nome}`,
      dec(c.mult.hp),
      dec(c.mult.atq),
      dec(c.mult.def),
      dec(c.mult.agi),
      `a cada ${c.areaCada} (×${dec(c.areaMultiplicador)})`,
      c.duro ? `nível ${config.rpg.raid.nivelParaChefesDuros}+` : '—',
    ]),
    { alinhar: ' nnnn', classe: 'compacta' },
  ),

  secao('11.3', 'Montagem do chefe'),
  cod(`
escala = |jogadores| ^ ${dec(config.rpg.raid.escalaPorJogador)}
fim    = escalaDeNivel(nivelMedioDoGrupo)          // a mesma escala dos monstros (8.4)

hp  = arred( (${config.rpg.raid.hpBase} + nivel × ${dec(config.rpg.raid.hpPorNivel)}) × mult.hp × escala × fim.hp )
atq = arred( (${config.rpg.raid.atqBase} + nivel × ${dec(config.rpg.raid.atqPorNivel)}) × mult.atq × fim.atq )
def = arred( (${config.rpg.raid.defBase} + nivel × ${dec(config.rpg.raid.defPorNivel)}) × mult.def × fim.def )
agi = arred( (${config.rpg.raid.agiBase} + nivel × ${dec(config.rpg.raid.agiPorNivel)}) × mult.agi × fim.agi )

areaCada = max(3, chefe.areaCada − piso(|jogadores| / 6))`),
  nota(
    `<strong>O piso de área é 3, e não 2.</strong> Com 2, o chefe acertava o grupo inteiro em
     metade das rodadas e chamar mais gente virava desvantagem — o Leviatã caía de 45% de
     vitória com 4 jogadores para 11% com 6, exatamente o oposto do que uma raid quer.`,
  ),

  secao('11.4', 'Recompensa'),
  cod(`
xp   = (${config.rpg.raid.xpBase} + nivel × ${config.rpg.raid.xpPorNivel}) por participante   (quem caiu recebe 60%)
gold = (${config.rpg.raid.goldBase} + nivel × ${config.rpg.raid.goldPorNivel}) por participante
itens    = max(${config.rpg.raid.itensMinimos}, teto(|participantes| × ${dec(config.rpg.raid.itensPorJogador)})), dono sorteado por item
titanita = um sorteio para cada participante   (chance ${dec(config.rpg.ferreiro.chanceDrop.raid)})
feitiço  = chance ${dec(config.rpg.feiticeiro.chanceDrop.raid)} por participante`),
  `<p>O item sai no nível de quem recebe, para dar de equipar na hora. Raid é a fonte mais
  confiável de titanita de grau alto — é o que dá motivo para juntar o grupo mesmo quando
  ninguém precisa de arma nova.</p>`,
)

// ================================================================== 12. pvp

parte(
  12,
  'Duelos (PvP)',
  secao('12.1', 'Regras do duelo'),
  lista([
    'Os dois lados entram com a vida cheia — duelo é treino, não emboscada.',
    'Aposta opcional em gold: o vencedor leva. Sem aposta, o duelo vale só pontos.',
    `O desafio fica de pé por ${config.rpg.pvp.desafioMinutos} min esperando resposta, e não retém a aposta: o gold só muda de mão no aceite.`,
    `Espera de ${config.rpg.pvp.cooldownMinutos} min entre um duelo e outro.`,
    'Perder um duelo não fere e não custa vida: sai-se com a mesma vida com que se entrou.',
    'Duelo não dá XP.',
  ]),

  secao('12.2', 'Ranking Elo'),
  cod(`
esperado(A, B) = 1 / (1 + 10 ^ ((pontosB − pontosA) / 400))
pontosA += arred( ${config.rpg.pvp.k} × (1 − esperado(A, B)) )    // vencedor
pontosB −= o mesmo tanto                                  // perdedor, com piso em 0

todo mundo começa em ${num(config.rpg.pvp.pontosIniciais)}`),
  `<p><strong>Por que Elo e não contagem de vitórias.</strong> Contando vitórias, bastava
  desafiar sempre o mais fraco do grupo para liderar. Com Elo, ganhar de quem está muito abaixo
  rende quase nada, e perder para quem está muito acima custa quase nada.</p>`,
)

// ================================================================ 13. rito

parte(
  13,
  'O Rito de evolução',
  `<p>Três provas em sequência, sem cura entre elas. Vencer as três sobe o personagem para o
  degrau seguinte da árvore.</p>`,

  secao('13.1', 'Pré-condições'),
  tabela(
    ['DEGRAU', 'NÍVEL EXIGIDO', 'CUSTO (COBRADO AO TENTAR)', 'ESPELHO'],
    [2, 3, 4].map((t) => [
      ['—', 'especialidade', 'maestria', 'apoteose'][t - 1],
      String(config.rpg.evolucao.niveis[t]),
      `${num(config.rpg.evolucao.custoGold[t])} de gold`,
      pct(config.rpg.evolucao.espelhoPorTier[t]),
    ]),
    { alinhar: ' nnn' },
  ),
  `<p>Mais: não estar em expedição, ter caminho aberto (apoteose é fim de linha) e não estar na
  espera de ${dec(config.rpg.evolucao.esperaHoras)} h desde a última tentativa.</p>`,

  secao('13.2', 'As três provas'),
  `<p>Os desafios são <strong>espelhos dos seus próprios atributos</strong>, não monstros:</p>`,
  cod(`
espelho = espelhoPorTier[tier do alvo]

prova 1  Aspirante do Rito   nivel + ${config.rpg.evolucao.degraus[0]}   peso hp 0.76 · atq 0.85 · def 0.85 · agi 0.90
prova 2  Executor do Rito    nivel + ${config.rpg.evolucao.degraus[1]}   peso hp 0.85 · atq 0.95 · def 0.95 · agi 1.00
prova 3  <guardião do alvo>  nivel + ${config.rpg.evolucao.degraus[2]}   peso hp 1.00 · atq 1.05 · def 1.05 · agi 1.10

atributo do desafio = seu atributo × peso × espelho
entre uma prova e outra: cura de ${pct(config.rpg.evolucao.curaEntreDesafios)} do máximo`),
  nota(
    `<strong>Por que espelho e não monstro.</strong> Com atributos de monstro, o Rito dava 72%
     de sucesso para Guerreiro e 8% para Ladino, e piorava com o nível: a fórmula de monstro não
     acompanha o perfil de quem tenta. Com espelhos, o resultado ficou entre 54% e 88% para
     todas as classes.`,
  ),

  secao('13.3', 'Os guardiões da terceira prova'),
  tabela(
    ['CAMINHO', 'GUARDIÃO'],
    Object.entries(GUARDIOES).map(([alvo, g]) => [
      CLASSES[alvo] ? `${CLASSES[alvo].emoji} ${CLASSES[alvo].nome}` : alvo,
      `${g.emoji} ${g.nome}`,
    ]),
    { classe: 'compacta' },
  ),

  secao('13.4', 'Execução'),
  cod(`
cobra o gold ANTES de começar          // tentar já custa
entra com a vida cheia
para cada uma das três provas:
  luta; se perdeu: marca a espera de ${dec(config.rpg.evolucao.esperaHoras)}h e devolve o que aconteceu
  cura ${pct(config.rpg.evolucao.curaEntreDesafios)} entre uma e outra
venceu as três: classe = alvo, e a habilidade nova passa a acumular`),
)

// ============================================================= 14. espelho

parte(
  14,
  'A Prova do Espelho (trocar de classe)',
  secao('14.1', 'O que muda e o que não muda'),
  `<p>A Prova leva de volta a uma <strong>classe inicial</strong> — qualquer uma das
  ${porTier(1).length}. O nível, o XP, o gold, os itens, os chefes vencidos e os rankings ficam
  como estão; o que muda é a classe e, com ela, os atributos que ela dá.</p>`,
  `<p>Quem já evoluiu perde a árvore inteira: a habilidade e o crescimento extra vão junto, e o
  Rito teria de ser refeito do zero. Por isso a troca exige confirmação explícita para quem tem
  especialidade.</p>`,
  `<p>Ao trocar, o que a classe nova não sabe usar é desequipado automaticamente — os itens
  continuam na mochila.</p>`,

  secao('14.2', 'Mecânica'),
  cod(`
custo  = ${config.rpg.provaCustoPorNivel} × nivel  (cobrado ao tentar)
espera = ${config.rpg.provaEsperaHoras}h após uma derrota

você       entra com a vida que tem AGORA
o espectro entra inteiro, com os seus atributos e as suas habilidades
vencer     → a classe é trocada na hora
perder     → o gold foi, o espelho trinca por ${config.rpg.provaEsperaHoras}h`),
  `<p>Entrar machucado na Prova do Espelho é jogar gold fora.</p>`,
)

// ============================================================ 15. ferreiro

parte(
  15,
  'O ferreiro: reforço de +1 a +10',
  `<p>O ferreiro nunca falha e nunca quebra equipamento: cobra e aplica. Pagamento em gold e
  titanita.</p>`,

  secao('15.1', 'Titanitas'),
  `<p>Titanita não ocupa espaço na mochila — é um contador na ficha, como os feitiços. A
  alternativa (item empilhável) levaria a uma mochila entupida de pedra.</p>`,
  tabela(
    ['GRAU', 'SERVE PARA OS REFORÇOS'],
    Object.values(TITANITAS).map((t) => [`${t.emoji} ${t.nome}`, `+${t.de} a +${t.ate}`]),
  ),

  secao('15.2', 'Onde caem'),
  tabela(
    ['ORIGEM', 'CHANCE', 'QUANTIDADE'],
    Object.entries(config.rpg.ferreiro.chanceDrop).map(([origem, chance]) => [
      origem,
      pct(chance),
      `${config.rpg.ferreiro.quantidadeDrop.min} a ${config.rpg.ferreiro.quantidadeDrop.max}`,
    ]),
    { alinhar: ' n' },
  ),

  secao('15.3', 'Custo do reforço'),
  cod(`
gold(item) = arred( ${config.rpg.ferreiro.goldBase} × nivelDoItem × (reforcoAtual + 1) ^ ${dec(config.rpg.ferreiro.goldExpoente)} )
titanitas  = titanitasPorReforco[reforcoAtual]   // ${JSON.stringify(config.rpg.ferreiro.titanitasPorReforco)}
grau       = o que cobre o reforço ALVO (15.1)`),
  (() => {
    const item = criarItem('espada', 50, 'raro')
    const linhas = []
    let total = 0
    for (let r = 0; r < config.rpg.ferreiro.maxReforco; r++) {
      const custo = custoDoReforco({ ...item, reforco: r })
      total += custo.gold
      linhas.push([`+${r} → +${r + 1}`, num(custo.gold), `${custo.quantidade}× ${TITANITAS[custo.grau].nome}`, num(total)])
    }
    return tabela(['PASSO', 'GOLD', 'TITANITA', 'GOLD ACUMULADO'], linhas, { alinhar: ' n n', classe: 'compacta' })
  })(),
  `<p class="fraca">Exemplo para uma peça de nível 50. O custo é proporcional ao nível do
  item.</p>`,

  secao('15.4', 'O que o reforço vale'),
  cod(`
bonusFinal(item)[s] = max(1, arred( item.bonus[s] × (1 + reforco × ${dec(config.rpg.ferreiro.ganhoPorNivel)}) ))`),
  `<p>Em ${dec(config.rpg.ferreiro.ganhoPorNivel)}, o +10 dá +30% — que é quase exatamente a
  distância entre uma raridade e a seguinte (raro ${dec(RARIDADES.raro.mult)} × 1,3 =
  ${dec(RARIDADES.raro.mult * 1.3)} ≈ épico ${dec(RARIDADES.epico.mult)}). Ou seja: levar uma
  peça ao máximo vale uma raridade. É o que faz o ferreiro competir com o drop em vez de
  anulá-lo — vale reforçar o que você tem, e vale trocar quando cai algo melhor.</p>`,
)

// ========================================================== 16. feiticeiro

parte(
  16,
  'O feiticeiro: infusão',
  secao('16.1', `Os ${Object.keys(FEITICOS).length} feitiços`),
  tabela(
    ['FEITIÇO', 'EFEITO', 'PESO', 'NÍVEL MÍN.'],
    Object.values(FEITICOS).map((f) => [
      `${f.emoji} <strong>${f.nome}</strong>`,
      f.resumo,
      String(f.peso),
      String(f.nivelMinimo),
    ]),
    { alinhar: '  nn' },
  ),

  secao('16.2', 'Como funcionam'),
  `<p>O feitiço usa o mesmo vocabulário das habilidades (5.2), então ele <em>soma</em> com a
  classe em vez de competir: um Rastreador de Sangue (perfuração 20%) com uma arma de Relâmpago
  (perfuração 22%) perfura 42%.</p>`,
  `<p>A infusão vale em <strong>${SLOTS_COM_FEITICO.length} slots</strong>:
  ${SLOTS_COM_FEITICO.map((s) => NOME_DO_SLOT[s].toLowerCase()).join(' e ')}. Os das duas peças
  equipadas valem juntos; o mesmo feitiço nas duas conta uma vez só (a regra de fusão escolhe o
  mais forte entre iguais).</p>`,

  secao('16.3', 'Regras da infusão'),
  cod(`
custo = ${config.rpg.feiticeiro.goldPorNivel} × nivelDoItem
       × ${dec(config.rpg.feiticeiro.multiplicadorDeRegravar)} se a peça JÁ tem feitiço (e o antigo é apagado)

exige: a peça equipada estar num slot com feitiço, ter o feitiço no estoque e gold`),

  secao('16.4', 'Sorteio de feitiço'),
  cod(`
pool  = feitiços com nivelMinimo <= nivel do inimigo
sorteio por peso dentro do pool

de chefe de ato    chance ${dec(config.rpg.feiticeiro.chanceDrop.boss)}
de raid            chance ${dec(config.rpg.feiticeiro.chanceDrop.raid)} por participante
do Abismo          chance ${dec(config.rpg.feiticeiro.chanceDrop.abismo)} a cada ${config.rpg.abismo.andaresPorFeitico} andares`),
)

// ============================================================ 17. economia

parte(
  17,
  'Economia',
  secao('17.1', 'De onde vem e para onde vai o gold'),
  tabela(
    ['ENTRA', 'SAI'],
    [
      [
        'A rota, raids, eventos, Abismo, masmorra, chefe mundial, expedições, missões do dia, vender na loja, vender no mercado, arremate de leilão',
        `Loja, ferreiro, feiticeiro, o Rito (${num(config.rpg.evolucao.custoGold[2])} / ${num(
          config.rpg.evolucao.custoGold[3],
        )} / ${num(config.rpg.evolucao.custoGold[4])}), a Prova do Espelho, espaços do baú, taxa da casa de leilões`,
      ],
    ],
  ),
  `<p>Os <strong>ralos</strong> importam tanto quanto as fontes: sem eles o gold só cresce e
  tudo vira barato. Os que somem do jogo de verdade são a taxa da casa de leilões, os espaços
  do baú e o custo do Rito. Cair numa fase não custa gold: custa a fase, que já é o preço mais
  caro que a rota cobra.</p>`,


  secao('17.2', 'A loja'),
  tabela(
    ['ITEM', 'PREÇO', 'O QUE FAZ'],
    [
      [
        '⚒️ Equipamento básico',
        `${config.rpg.precoEquipamentoPorNivel} × nível`,
        'Uma peça comum, do seu nível, sorteada entre as que sua classe usa',
      ],
      ['✨ Oferta do dia', 'ver 17.3', 'Uma peça sorteada, com raridade melhor que a do drop comum'],
    ],
    { alinhar: ' n' },
  ),
  `<p class="fraca">Poção e bandagem saíram da prateleira junto com o que elas resolviam: a
  vida fora de combate é sempre cheia (3.5), e não há mais nada para curar entre duas
  lutas.</p>`,
  `<p>Vender é em lote, com seleção múltipla; a loja paga
  ${pct(config.rpg.lojaFracaoDeCompra)} do valor de referência. Épico e lendário exigem
  confirmação — não existe desfazer.</p>`,

  secao('17.3', 'A oferta especial'),
  cod(`
a cada ${config.rpg.lojaOfertaMinutos} min sorteia-se uma oferta nova para o jogador
com chance ${dec(config.rpg.lojaChanceDeOferta)} existe oferta; senão a prateleira fica sem
tipo     = um dos que a classe usa
raridade = pesos próprios (mais generosos que o drop): ${Object.entries({
    comum: 30,
    incomum: 33,
    raro: 24,
    epico: 10,
    lendario: 3,
  })
    .map(([r, p]) => `${r} ${p}`)
    .join(' · ')}
preco    = precoDeReferencia × ${dec(config.rpg.lojaMultiplicadorDeVenda)}`),
  `<p>A oferta fica de pé até vencer: sem isso bastava reabrir a loja até aparecer um
  lendário.</p>`,

  secao('17.4', 'Expedições'),
  `<p>O personagem parte e volta sozinho — rende com o navegador fechado. Enquanto está fora,
  não luta.</p>`,
  tabela(
    ['EXPEDIÇÃO', 'DURAÇÃO', 'MULTIPLICADOR', 'CHANCE DE ITEM', 'SORTEIOS DE RARIDADE'],
    Object.values(EXPEDICOES).map((e) => [
      `${e.emoji} <strong>${e.nome}</strong><br><span class="fraca">${e.resumo}</span>`,
      `${e.minutos} min`,
      `×${dec(e.bonus)}`,
      pct(e.chanceDrop),
      String(e.tentativasDeRaridade),
    ]),
    { alinhar: ' nnnn' },
  ),
  cod(`
xp   = (${config.rpg.expedicao.xpPorMinuto.base} + nivel × ${dec(config.rpg.expedicao.xpPorMinuto.porNivel)}) × minutos × multiplicador da expedição
gold = (${dec(config.rpg.expedicao.goldPorMinuto.base)} + nivel × ${dec(config.rpg.expedicao.goldPorMinuto.porNivel)}) × minutos × multiplicador da expedição`),

  secao('17.5', 'Negociação direta entre jogadores'),
  `<p>Uma oferta é um item por um preço, dirigida a alguém. <strong>Nada é retido</strong>: o
  item continua na mochila de quem vende, o gold continua com quem compra, e a troca só acontece
  no instante do aceite. Se o servidor cair no meio, ninguém perde nada — no máximo a oferta
  precisa ser refeita.</p>`,
  lista([
    `A oferta vence em ${config.rpg.ofertaMinutos} min.`,
    'Guarda-se só o <code>uid</code> do item, nunca uma cópia: no aceite se confere se a peça ainda está com quem ofereceu.',
    'Preço 0 é presente — e ainda assim precisa ser aceito, para ninguém receber item com a mochila cheia.',
    'Transferir gold avulso vai direto, sem aceite.',
  ]),
)

// ======================================================= 18. balanceamento

parte(
  18,
  'Balanceamento',
  secao('18.1', 'Como os números foram obtidos'),
  `<p>Nenhum número deste jogo saiu de palpite. Existem três réguas, todas reproduzíveis:</p>`,
  tabela(
    ['RÉGUA', 'O QUE MEDE'],
    [
      [
        '<code>npm run balance</code>',
        'Monta jogadores de referência (classe × nível × raridade) e roda milhares de lutas contra monstro comum, elite e chefe, imprimindo a taxa de vitória de cada cruzamento.',
      ],
      [
        '<code>npm run classes</code>',
        'Mede a força relativa das classes de um mesmo degrau, juntando PvP e PvE numa nota.',
      ],
      [
        '<code>npm run rota</code>',
        'Joga a rota inteira, do ato 1 nível 1 até onde der: uma fase por vez, a horda completa, XP entrando e voltando uma fase toda vez que cai. Diz quantas fases cada ato custa. É a régua do <code>escalaDeDificuldade</code>.',
      ],
    ],
  ),

  secao('18.2', 'Os alvos que o jogo persegue'),
  tabela(
    ['INIMIGO', 'TAXA DE VITÓRIA ALVO (EQUIPAMENTO RARO, ACIMA DO NÍVEL 40)'],
    [
      ['monstro comum', '~70%'],
      ['elite', '~55%'],
      ['chefe', '~50%'],
    ],
  ),
  `<p>E, para a rota, o alvo não é uma taxa de vitória e sim um <strong>ritmo</strong>: a rota
  inteira em torno de 1.800 fases, do nível 1 ao 506, com os primeiros oito atos passando quase
  sem tropeço e a fricção aparecendo do nono em diante, entre 30 e 70 fases por ato. Acima
  disso é parede; muito abaixo, o jogo acaba numa tarde.</p>`,

  secao('18.3', 'Estado medido'),
  `<p>Com equipamento raro, depois de todos os ajustes:</p>`,
  tabela(
    ['DEGRAU', 'NÍVEL', 'VS. COMUM', 'VS. CHEFE'],
    [
      ['base', '20', '67–99% conforme a classe', '— (faixa inicial, ainda sem escala)'],
      ['especialidade', '100', '74%', '29%'],
      ['especialidade', '145', '71%', '43%'],
      ['maestria', '150', '78%', '52%'],
      ['maestria', '195', '70%', '55%'],
      ['apoteose', '200', '75%', '43%'],
      ['apoteose', '250', '67%', '54%'],
    ],
    { alinhar: ' nnn' },
  ),
  `<p><strong>O desenho que esses números descrevem:</strong> evoluir dá um fôlego real, e o
  mundo alcança você de novo antes do degrau seguinte. Quem não evolui sente — a partir do 150 os
  monstros sobem de qualquer jeito, porque os degraus de classe são função do nível do jogador,
  não da classe dele.</p>`,

  secao('18.4', 'Erros de balanceamento já cometidos'),
  `<p>Esta seção existe porque os mesmos erros são fáceis de reintroduzir.</p>`,
  tabela(
    ['SINTOMA', 'CAUSA REAL', 'CORREÇÃO'],
    [
      [
        'Fim de jogo fácil; lutas de 46 rodadas decididas por quem tinha mais DEF',
        'A constante 100 na mitigação: no nível 100 com DEF 700, cortava 91% de todo dano',
        'Defesa de referência cresce com o nível (7.3). Faixa 1–40 preservada byte a byte',
      ],
      [
        'Passar do nível 41 ficou desproporcionalmente duro',
        'As espécies de fim de jogo tinham +36% de ATQ médio — uma segunda rampa invisível',
        'Multiplicadores reescalados para que as médias batam',
      ],
      [
        'Abismo rendia sempre 1 a 3 andares, com qualquer equipamento',
        'Lutas independentes em sequência dão profundidade p/(1−p). Aumentar a cura não muda nada',
        'Nível do andar proporcional ao do jogador + piso de vida (10.3)',
      ],
      [
        'Rito: 72% de sucesso para Guerreiro, 8% para Ladino',
        'Os desafios usavam atributos de monstro, que não acompanham o perfil do aspirante',
        'Espelhos dos próprios atributos (13.2). Resultado: 54–88% para todos',
      ],
      [
        'Raids duras mesmo com 8 jogadores; e o Leviatã piorava com mais gente',
        'Golpe em área frequente demais: com piso 2, o chefe acertava o grupo inteiro em metade das rodadas',
        'Piso de área subido para 3 rodadas; escalões retunados por busca binária',
      ],
      [
        'Maestria e apoteose muito mais fortes que o previsto (96% contra chefes)',
        'O salto vinha das habilidades acumuladas (~25 pontos por degrau), não do crescimento de atributo',
        `<code>degrausDeClasse</code>: o mundo endurece +${pct(
          config.rpg.escalaEndgame.degrausDeClasse[150],
        )} no 150 e +${pct(config.rpg.escalaEndgame.degrausDeClasse[200])} no 200 (8.4)`,
      ],
      [
        'Duas apoteoses com agilidade menor que a maestria de origem',
        'Perfil enviesado: 0,85 × 1,16 = 0,986 < 1',
        'PISO_DE_CRESCIMENTO = 1,03 na derivação (4.3) — correção estrutural, não caso a caso',
      ],
    ],
  ),

  secao('18.5', 'Invariantes verificadas por teste'),
  `<p><code>npm run conformidade</code> confere, a cada execução, que:</p>`,
  lista([
    'Os atributos base de cada classe e nível batem com a tabela de 3.6.',
    'A escala de fim de jogo bate com 8.4, e os atributos de monstro com 8.1.',
    'Os bônus de item batem com 6.4, e os multiplicadores de raridade com 6.1.',
    'Nenhuma evolução reduz nenhum atributo.',
    'Nenhuma evolução perde um tipo de arma em relação ao degrau anterior.',
    'Nenhuma habilidade aparece em duas classes.',
    'Toda arma referenciada por alguma classe existe na tabela de tipos.',
    'Todo caminho leva a exatamente uma apoteose, e a árvore não tem ciclos.',
  ]),
)

// ============================================================= 19. config

parte(
  19,
  'Referência completa de configuração',
  `<p>Tudo abaixo vem de um único objeto (<code>server/config.js</code>). Nenhum desses valores
  deve ser duplicado em outro lugar do código — foi essa disciplina que tornou o balanceamento
  por simulação possível.</p>`,
  (() => {
    const linhas = []
    const anda = (obj, prefixo) => {
      for (const [chave, valor] of Object.entries(obj)) {
        const caminho = prefixo ? `${prefixo}.${chave}` : chave
        if (valor && typeof valor === 'object' && !Array.isArray(valor)) anda(valor, caminho)
        else linhas.push([`<code>${caminho}</code>`, Array.isArray(valor) ? `[${valor.join(', ')}]` : String(valor)])
      }
    }
    anda(config, '')
    return tabela(['PARÂMETRO', 'VALOR'], linhas, { alinhar: ' n', classe: 'compacta config' })
  })(),
)

// ========================================================= 20. arquitetura

parte(
  20,
  'Arquitetura da versão web',
  secao('20.1', 'Um processo só'),
  `<p>O servidor é um processo Node.js que serve três coisas ao mesmo tempo: os arquivos
  estáticos da interface, a API HTTP e o socket do tempo real. Não precisa de nginx, banco
  externo nem fila — sobe numa VPS de 1 GB e fica.</p>`,
  cod(`
navegador ──HTTP──▶ Express ──▶ rotas ──▶ motor de RPG ──▶ store (memória)
    ▲                                                          │
    └──WebSocket──  Socket.IO  ◀── realtime ◀──────────────────┘
                                                        SQLite (WAL)`),
  tabela(
    ['CAMADA', 'ARQUIVOS', 'RESPONSABILIDADE'],
    [
      ['<strong>Motor</strong>', '<code>server/rpg/*</code>', 'As regras do jogo. Funções puras sempre que possível; recebem <code>sorte()</code> por parâmetro.'],
      ['<strong>Estado</strong>', '<code>server/store.js</code>, <code>server/db.js</code>', 'Personagens em memória, gravação com debounce, SQLite.'],
      ['<strong>Sistemas</strong>', '<code>server/*.js</code>', 'O que é da versão web: missões, chefe mundial, masmorra, leilões, eventos, mercado, entregas, fotos, chat.'],
      ['<strong>Rotas</strong>', '<code>server/rotas/*</code>', 'Traduzem HTTP em chamadas ao motor. Nenhuma regra de jogo mora aqui.'],
      ['<strong>Visão</strong>', '<code>server/visao.js</code>', 'A ficha como o navegador a enxerga: tudo já calculado.'],
      ['<strong>Interface</strong>', '<code>public/*</code>', 'HTML, CSS e módulos ES nativos. Sem framework, sem build.'],
    ],
  ),

  secao('20.2', 'O ciclo de uma requisição'),
  cod(`
POST /api/combate/cacar
  cookie de sessão  ─▶ exigirLogin      → req.usuario
  cabeçalho X-Personagem ─▶ exigirPersonagem → req.player (e confere o dono)
                     ─▶ exigirClasse
  rota chama o motor (resolver / descer / atacar…)
  responder(res, player, { ...oQueAconteceu })
     └─ store.flush()            grava agora
     └─ devolve { ..., personagem: verPersonagem(player) }`),
  `<p>Duas decisões que valem explicação:</p>`,
  lista([
    `<strong>A conta vem do cookie; o personagem, de um cabeçalho.</strong> Separar os dois é o
     que deixa a mesma pessoa abrir duas abas com dois personagens da mesma conta sem uma
     derrubar a outra.`,
    `<strong>Toda rota que altera algo devolve a ficha nova junto.</strong> O navegador nunca
     precisa de uma segunda chamada para saber como o personagem ficou, e nunca mostra um estado
     que ele próprio calculou.`,
  ]),

  secao('20.3', 'A visão: o que o navegador recebe'),
  `<p><code>verPersonagem()</code> devolve a ficha com <strong>tudo já resolvido</strong>:
  atributos somados, vida do instante, cooldowns em milissegundos restantes, preços, contadores
  de mochila e baú, e os selos do menu (missões prontas, itens esperando no leilão). O cliente
  não recalcula nada que decida alguma coisa — se ele calculasse gold ou dano, viraria
  formulário de fraude.</p>`,
  `<p>Um encontro devolve, além disso, o <strong>log estruturado</strong> (7.6) e a identidade
  do monstro (espécie), que é o que o palco usa para escolher o sprite.</p>`,

  secao('20.4', 'Tempo real'),
  tabela(
    ['O QUE CHEGA SOZINHO', 'COMO'],
    [
      ['Chat da guilda, com histórico', '<code>chat:mensagem</code>'],
      ['Quem está on-line (e a classe de cada um)', '<code>jogadores:online</code>'],
      ['Avisos do sistema: subiu de nível, derrubou chefe, achou lendário, desceu fundo', '<code>chat:sistema</code>'],
      ['Salas de raid e de masmorra se formando', '<code>sala:*</code>'],
      ['Desafio de PvP, oferta de item, pagamento recebido', '<code>pvp:*</code>, <code>mercado:*</code>'],
      ['Evento aleatório abrindo, e o resultado dele', '<code>evento:*</code>'],
      ['Chefe mundial aparecendo, apanhando e caindo', '<code>chefe:*</code>'],
      ['Leilão superado, arrematado, encerrado', '<code>leilao:*</code>'],
      ['Missão do dia concluída', '<code>missoes:*</code>'],
    ],
  ),
  `<p>Os painéis abertos se redesenham sozinhos quando um desses eventos chega: quem está
  olhando a lista de salas vê a sala nova aparecer sem recarregar nada.</p>`,

  secao('20.5', 'Segurança'),
  lista([
    'Senha com <strong>bcrypt</strong>; o hash nunca sai do servidor.',
    `Sessão em <strong>cookie httpOnly</strong>, <code>sameSite=lax</code>, <code>secure</code> atrás de HTTPS, válida por ${config.web.sessaoDias} dias e revogável (sair apaga a linha).`,
    'Toda rota de jogo confere que o personagem pertence à conta logada.',
    'Todo cálculo no servidor; o cliente só desenha.',
    'Limites de corpo em todas as entradas (JSON 64 KB, foto 400 KB), e cooldown próprio no chat.',
    'A foto é validada pelos <em>bytes</em> (assinatura do arquivo), não pelo que o navegador diz que é, e servida com <code>X-Content-Type-Options: nosniff</code>.',
  ]),
)

// ============================================================== 21. contas

parte(
  21,
  'Contas, personagens e sessões',
  secao('21.1', 'A conta'),
  `<p>Usuário e senha. Uma conta pode ter até <strong>${config.web.maxPersonagens}
  personagens</strong>, cada um com nome único no servidor inteiro. Trocar de personagem é
  trocar o cabeçalho <code>X-Personagem</code> — nada é recarregado do zero.</p>`,

  secao('21.2', 'Criar um personagem'),
  `<p>Escolhe-se o nome e uma das ${porTier(1).length} classes base. O personagem nasce no nível
  1 com ${num(config.rpg.goldInicial)} de gold — sem isso o novato entra sem equipamento e sem
  como comprar a primeira peça.</p>`,

  secao('21.3', 'Apagar'),
  `<p>Apagar um personagem apaga a mochila, o baú, o gold, os chefes vencidos, a foto e o lugar
  dele nos rankings; as ofertas e salas em que ele estava são esquecidas. Não tem desfazer, e
  por isso exige digitar o nome.</p>`,
)

// =========================================================== 22. prestígio

parte(
  22,
  'Prestígio',
  `<p>Chegar ao teto e recomeçar mais forte. No nível
  <strong>${config.rpg.prestigio.nivelMinimo}</strong> o personagem pode prestigiar.</p>`,

  secao('22.1', 'O que se perde e o que fica'),
  tabela(
    ['PERDE', 'MANTÉM'],
    [
      [
        'O nível (volta ao 1), o XP acumulado, a árvore de evolução inteira — volta à classe base — e a posição na rota, que volta ao ato 1, fase 1',
        'Itens, gold, titanitas, feitiços, os rankings, o recorde da rota e os do Abismo e da masmorra',
      ],
    ],
  ),
  `<p>A rota recomeça junto: um personagem de nível 1 não tem o que fazer no ato 40. O recorde
  de até onde ele já chegou fica — é a lembrança do ciclo anterior, e o prestígio não apaga
  isso. A subida de volta é bem mais rápida mesmo assim: equipamento de fim de jogo na mochila
  desde a primeira fase, e XP aumentado.</p>`,

  secao('22.2', 'O que o contador vale'),
  cod(`
escalaDeAtributos(n) = 1 + n × ${dec(config.rpg.prestigio.bonusAtributos)}     // só sobre o que a CLASSE dá
escalaDeXp(n)        = 1 + n × ${dec(config.rpg.prestigio.bonusXp)}      // sobre todo XP ganho`),
  `<p>O bônus de atributos <strong>não</strong> multiplica o equipamento. Se multiplicasse, quem
  prestigia com peças de fim de jogo viraria intocável — o prestígio deixaria de ser um recomeço
  e viraria um botão de poder.</p>`,
  (() => {
    const linhas = [0, 1, 2, 3, 5].map((n) => [
      String(n),
      `+${pct(n * config.rpg.prestigio.bonusAtributos)}`,
      `+${pct(n * config.rpg.prestigio.bonusXp)}`,
    ])
    return tabela(['PRESTÍGIOS', 'ATRIBUTOS DE CLASSE', 'XP GANHO'], linhas, { alinhar: 'nnn' })
  })(),

  secao('22.3', 'Condições'),
  lista([
    `Nível ${config.rpg.prestigio.nivelMinimo}.`,
    'Não estar em expedição.',
    'Confirmação explícita: não tem desfazer.',
  ]),
  `<p>O prestígio tem ranking próprio, e a ficha guarda quando foi o último.</p>`,
)

// ================================================================ 23. baú

parte(
  23,
  'O baú',
  `<p>Um depósito que não ocupa a mochila. Começa com
  <strong>${config.rpg.bau.espacos} espaços</strong>.</p>`,

  secao('23.1', 'O que está guardado está fora de jogo'),
  `<p>Item no baú não equipa, não vende na loja, não vai ao mercado nem ao leilão — nada disso o
  encontra, porque todos esses caminhos procuram na mochila. Guardar é arrumação, nunca um
  atalho para carregar mais.</p>`,
  lista([
    'Item <strong>equipado</strong> não entra: a recusa é explícita. Perder a arma sem ter pedido, e descobrir na caçada seguinte, seria pior que o aviso.',
    'Retirar exige espaço na mochila.',
    'Os itens ficam na própria ficha — aqui o servidor não retém bem nenhum, é o mesmo personagem segurando as mesmas peças na outra mão.',
  ]),

  secao('23.2', 'Comprar espaço'),
  cod(`
preco(n-ésimo espaço) = ${num(config.rpg.bau.precoPorEspaco)} × (espaços já comprados + 1)`),
  (() => {
    const linhas = [1, 2, 3, 4, 5].map((n) => [
      `${n}º`,
      num(config.rpg.bau.precoPorEspaco * n),
      String(config.rpg.bau.espacos + n),
    ])
    return tabela(['COMPRA', 'CUSTO', 'ESPAÇOS DEPOIS'], linhas, { alinhar: ' nn' })
  })(),
  `<p>Um de cada vez, e sem teto: o preço é o teto. É um ralo de gold que cresce junto com quem
  joga muito.</p>`,
)

// =========================================================== 24. dia a dia

parte(
  24,
  'O dia a dia: missões, chefe mundial, masmorra e leilões',
  `<p>Quatro sistemas com um objetivo comum: dar motivo de entrar todo dia e de jogar junto.</p>`,

  secao('24.1', 'Missões diárias'),
  `<p><strong>${config.rpg.missoes.porDia} por personagem, por dia.</strong> O dia vira à
  meia-noite no fuso do jogo. Não há agendador: a lista é gerada na primeira vez que alguém olha
  ou faz alguma coisa no dia novo, comparando a data guardada com a de hoje.</p>`,
  tabela(
    ['MISSÃO', 'PESO', 'ALVO', 'EXIGE'],
    Object.entries(TIPOS_DE_MISSAO).map(([, m]) => [
      `${m.emoji} ${m.texto(m.alvo(50))}`,
      String(m.peso),
      num(m.alvo(50)),
      m.nivelMinimo ? `nível ${m.nivelMinimo}` : '—',
    ]),
    { alinhar: ' nn', classe: 'compacta' },
  ),
  `<p class="fraca">Alvos calculados para um personagem de nível 50; alguns dependem do
  nível.</p>`,
  cod(`
recompensa de cada missão:
  gold = ${config.rpg.missoes.goldBase} + nivel × ${config.rpg.missoes.goldPorNivel}
  xp   = xpParaSubir(nivel) × ${dec(config.rpg.missoes.fracaoDoNivelEmXp)}
  titanita do grau que combina com o nível

fechar as ${config.rpg.missoes.porDia} abre o baú do dia:
  gold × ${config.rpg.missoes.bauMultiplicadorDeGold}, titanita em triplo e um feitiço garantido`),
  `<p>Quem move o progresso é o próprio jogo, no instante em que a coisa acontece — venceu uma
  caçada, desceu andares, deu um lance. A recompensa só entra quando a pessoa resgata.</p>`,

  secao('24.2', 'Chefe mundial'),
  `<p>Um por dia, com a <strong>vida compartilhada pelo servidor inteiro</strong>. Aparece numa
  hora sorteada entre ${config.rpg.chefeMundial.horaInicio}h e ${config.rpg.chefeMundial.horaFim}h
  e fica ${config.rpg.chefeMundial.duracaoHoras} horas no ar.</p>`,
  cod(`
vida total = max(${config.rpg.chefeMundial.unidadesMinimas}, ${config.rpg.chefeMundial.unidadesPorJogador} × contas ativas nos últimos ${config.rpg.chefeMundial.diasParaContarAtivo} dias)   [em UNIDADES]

uma investida:
  projeção do chefe NO SEU NÍVEL:
    hp  = escudo ${config.rpg.chefeMundial.projecao.escudo} × vida de um monstro comum do seu nível
    atq/def/agi = monstro comum × { ${Object.entries(config.rpg.chefeMundial.projecao).filter(([k]) => k !== 'escudo').map(([k, v]) => `${k} ${dec(v)}`).join(', ')} }
  luta normal (7.5); o dano causado vira UNIDADES:
    unidades = dano total / vida de um monstro comum do seu nível
  cair só encerra a investida — e não custa nada
  espera de ${config.rpg.chefeMundial.esperaEntreAtaquesMinutos} min entre um ataque e outro`),
  `<p><strong>A régua de unidades é o que faz um nível 20 e um nível 220 contribuírem na mesma
  tabela.</strong> Cada um bate e apanha na própria faixa, e o placar mede esforço, não
  nível.</p>`,
  `<p>Quando a vida zera, o espólio sai para todo mundo que bateu, na proporção do dano: a
  recompensa de uma raid do nível de cada um, vezes
  (${dec(config.rpg.chefeMundial.recompensa.base)} +
  ${dec(config.rpg.chefeMundial.recompensa.porFracao)} × fração do dano). Quem causou pelo menos
  ${pct(config.rpg.chefeMundial.fracaoParaItem)} do total entra no sorteio de item. Se o tempo
  acabar antes, o chefe foge e o espólio sai pela metade.</p>`,
  tabela(
    ['OS CHEFES MUNDIAIS', ''],
    Object.values(CHEFES_MUNDIAIS).map((c) => [`${c.emoji} <strong>${c.nome}</strong>`, c.descricao]),
  ),

  secao('24.3', 'Masmorra em grupo'),
  `<p>O Abismo descido junto. De ${config.rpg.masmorra.minJogadores} a
  ${config.rpg.masmorra.maxJogadores} jogadores, um por conta, a partir do nível
  ${config.rpg.masmorra.nivelMinimo}.</p>`,
  cod(`
cada andar = luta de GRUPO (7.7) contra o habitante daquele andar do Abismo
  vida do habitante × ${dec(config.rpg.masmorra.vidaPorJogador)} por jogador
  ataque × ${dec(config.rpg.masmorra.ataque)}
  golpe em área a cada ${config.rpg.masmorra.areaCada} rodadas, com ×${dec(config.rpg.masmorra.areaMultiplicador)}
a vida de cada um carrega de um andar para o outro (mesmo respiro e piso do Abismo)
quem cai fica caído até o fim; a descida termina quando o grupo inteiro cai
recompensa = ${pct(config.rpg.masmorra.recompensa)} da do Abismo por andar, para TODO MUNDO que entrou`),
  `<p>Por simulação, o grupo desce de 2 a 6 andares a mais que o Abismo solo — quanto maior o
  grupo, mais fundo. Todo mundo recebe pelos andares que o <em>grupo</em> venceu: quem caiu cedo
  também ajudou a chegar até ali.</p>`,

  secao('24.4', 'Casa de leilões'),
  `<p>Diferente do mercado (oferta direta, nada retido), <strong>aqui as coisas ficam presas de
  verdade</strong> — é o que faz um leilão funcionar:</p>`,
  lista([
    'O <strong>item</strong> sai da mochila ao anunciar e fica guardado no banco até o leilão fechar.',
    'O <strong>lance</strong> sai do gold de quem deu, na hora; quem é superado recebe de volta no mesmo instante.',
  ]),
  cod(`
durações        ${config.rpg.leilao.duracoesHoras.join('h, ')}h
anúncios        até ${config.rpg.leilao.maxAnunciosPorPersonagem} por personagem
lance mínimo    supera o anterior em pelo menos ${pct(config.rpg.leilao.incrementoMinimo)}
prorrogação     lance nos últimos ${config.rpg.leilao.prorrogacaoMinutos} min empurra o fim para ${config.rpg.leilao.prorrogacaoMinutos} min adiante
taxa da casa    ${pct(config.rpg.leilao.taxaDeVenda)} sobre o valor final — some do jogo
compra já       opcional: encerra o leilão na hora`),
  `<p>Por isso tudo mora no banco, e não em memória: se o servidor reiniciar com leilão aberto,
  ao voltar ele continua de onde estava e fecha na hora certa. Item que não cabe na mochila de
  quem recebe vai para as <strong>entregas</strong> — uma fila de itens esperando o dono ir
  buscar, que também é onde caem prêmios e devoluções.</p>`,
)

// ============================================================= 25. eventos

parte(
  25,
  'Eventos aleatórios',
  `<p>De tempos em tempos o servidor chama todo mundo que está on-line — "uma horda de goblins
  apareceu na estrada!" — e cada um decide se atende. A chamada fica aberta
  ${config.eventos.inscricaoMinutos} min.</p>`,

  secao('25.1', 'O ritmo'),
  cod(`
janela          ${config.eventos.horaInicio}h às ${config.eventos.horaFim}h (fuso ${config.eventos.fusoHorario})
intervalo       sorteado entre ${config.eventos.intervaloMinimo} e ${config.eventos.intervaloMaximo} min — uns sete por dia dentro da janela
mínimo on-line  ${config.eventos.minimoOnline}; com menos gente, espera ${config.eventos.esperaSemGenteMinutos} min e tenta de novo
teto            ${config.eventos.maxParticipantes} participantes num evento de grupo`),

  secao('25.2', 'Os três formatos'),
  tabela(
    ['TIPO', 'COMO SE RESOLVE'],
    [
      ['<strong>grupo</strong>', 'Uma luta de grupo (7.7) contra o inimigo do evento, igual à raid'],
      ['<strong>individual</strong>', 'Cada um enfrenta sozinho uma criatura de elite do próprio nível'],
      ['<strong>bênção</strong>', 'Sem luta: quem atendeu recebe o presente'],
    ],
  ),
  `<p>Mesma regra das salas de raid: <strong>nada fica retido</strong>. Atender não cobra nada,
  e se o servidor reiniciar com a chamada aberta o evento só some — ninguém perde coisa
  alguma.</p>`,

  secao('25.3', 'O catálogo'),
  tabela(
    ['EVENTO', 'TIPO', 'DIFICULDADE', 'PESO', 'O QUE É'],
    Object.values(EVENTOS).map((e) => [
      `${e.emoji} <strong>${e.nome}</strong>`,
      e.tipo,
      e.dificuldade ?? '—',
      String(e.peso),
      e.descricao,
    ]),
    { alinhar: '   n', classe: 'compacta' },
  ),
)

// ================================================== 26. foto e perfil

parte(
  26,
  'Foto e perfil público',
  secao('26.1', 'A foto'),
  `<p>Cada personagem pode ter uma foto. O navegador <strong>recorta e reduz antes de
  mandar</strong> — o editor tem arrastar, zoom e soltar o arquivo em cima — e envia um JPEG de
  ${config.web.fotoLargura}×${config.web.fotoAltura}. Recortar no cliente também elimina os
  metadados EXIF de origem.</p>`,
  tabela(
    ['REGRA', 'VALOR'],
    [
      ['Tamanho do recorte', `${config.web.fotoLargura} × ${config.web.fotoAltura}`],
      ['Teto no servidor', `${config.web.fotoMaxKb} KB`],
      ['Espera entre envios', `${config.web.fotoEsperaSegundos} s`],
      ['Tipos aceitos', 'JPEG, PNG, WebP e GIF — <strong>decididos pelos bytes</strong>, não pelo que o navegador declara'],
    ],
  ),
  `<p>A foto fica numa tabela própria, em BLOB, e não na ficha JSON: a ficha é regravada a cada
  caçada, e arrastar 60 KB de imagem junto seria desperdício. Apagar o personagem leva a foto
  junto (cascata).</p>`,
  cod(`
GET /api/fotos/:id?v=<instante do envio>
  exige login (mas NÃO exige X-Personagem: quem pede é uma tag <img>)
  Cache-Control: immutable    — o "?v=" muda quando a foto muda
  X-Content-Type-Options: nosniff`),

  secao('26.2', 'O perfil de outro jogador'),
  `<p>Clicar num nome no ranking abre a ficha daquela pessoa: foto, classe e linhagem,
  habilidades, atributos, o que está equipado, prestígio, recordes do Abismo e da masmorra,
  placar de PvP e a chance estimada de duelo contra você. Fica de fora o que é só do dono —
  mochila, baú, materiais, cooldowns e missões.</p>`,
  `<p>Um comando de administrador (<code>/foto &lt;personagem&gt;</code> no chat) remove a foto
  de alguém; a tela da pessoa se atualiza na hora.</p>`,
)

// ============================================================== 27. palco

parte(
  27,
  'O palco: cenários, personagens e animações',
  `<p>Ao lado do log existe um <code>&lt;canvas&gt;</code> de ${640}×${360} (o CSS estica) que
  mostra onde o personagem está. <strong>Ele não decide nada</strong>: desenha o log que o
  servidor já resolveu, uma linha de cada vez.</p>`,

  secao('27.1', 'As três cenas'),
  tabela(
    ['CENA', 'QUANDO', 'O QUE MOSTRA'],
    [
      [
        '<strong>Taberna</strong>',
        'Ao entrar, e quando ninguém está na rota',
        'Quem está on-line, sentado pelas mesas, com o sprite da classe de origem e o nome por cima',
      ],
      [
        '<strong>A rota</strong>',
        'Ao ir à caçada',
        'Um cenário por ato. O personagem entra pela esquerda; os inimigos da horda, um atrás do outro, pela direita. Mudou de ato, o cenário novo entra por cima do velho e o nome do lugar aparece e some',
      ],
      [
        '<strong>Abismo</strong>',
        'Ao descer',
        'O mesmo palco, com uma imagem por profundidade. Os sete habitantes têm sprite próprio',
      ],
    ],
  ),
  `<p>As duas cenas de luta desenham a mesma coisa, e o manifesto diz qual das duas formas o
  cenário tem: <strong>em camadas</strong> (várias imagens em velocidades diferentes — o
  parallax, como as Ruínas de Valkhar do ato 1) ou <strong>inteiriço</strong> (uma imagem só,
  como os andares do Abismo). Nos dois casos o panorama se repete em espelho enquanto o
  personagem anda, e é a repetição que dá a sensação de movimento.</p>`,
  tabela(
    ['O QUE', 'ONDE A ARTE FICA', 'VIRA'],
    [
      ['O cenário de um ato', '<code>Assets/CENARIOS/Ruínas de Valkhar/</code>', '<code>ruinas-de-valkhar</code>'],
      ['Um andar do Abismo', '<code>Assets/CENARIOS/abismo/raiz do mundo.jfif</code>', '<code>raiz-do-mundo</code>'],
      [
        'Um habitante do Abismo',
        '<code>Assets/inimigos/chefes abismo/Vigia do Poço.jfif</code>',
        '<code>vigia-do-poco</code>',
      ],
    ],
  ),
  `<p>Um inimigo atrás do outro dentro da fase: o corpo do anterior fica para trás até a câmera
  passar. Pôr a imagem numa pasta com o nome exato do ato e rodar <code>npm run arte</code>
  basta para o ato ganhar cenário — ato sem pasta simplesmente não entra no manifesto, e o
  palco segue desenhando o que já estava em cena.</p>`,

  secao('27.2', 'Duas regras do palco'),
  ordem([
    `<strong>O palco não decide nada.</strong> Quem diz quem bateu, quanto tirou e quem caiu é o
     servidor. Se qualquer chamada ao palco falhar, a caçada acontece do mesmo jeito — toda
     integração é tolerante a erro, porque o log é que conta a história.`,
    `<strong>Todo tempo é relógio de parede, nunca contagem de quadros.</strong> Aba escondida
     congela o <code>requestAnimationFrame</code>: se a caminhada dependesse dele, quem trocasse
     de aba no meio da caçada ficaria esperando para sempre. Com relógio, o desenho pausa e a
     história continua.`,
  ]),

  secao('27.3', 'O pipeline de arte'),
  `<p>A arte crua (as folhas como saíram do gerador: título, três faixas rotuladas e vários
  quadros em cada uma) fica em <code>Assets/</code>, que não vai para o Git — é fonte, não
  produto. <code>npm run arte</code> mede a própria imagem, recorta e escreve
  <code>public/arte/</code>: atlas em WebP com fundo transparente, os cenários e um
  <code>arte.json</code> com a geometria.</p>`,
  cod(`
1. fundo      inundação a partir das bordas, numa cópia SEM o granulado do JPEG
              (senão a tolerância necessária come o contorno de um bicho escuro)
2. camadas    descasca fundo desenhado (painel, cartela, moldura), com rollback
              se a volta deixar quase nada — era o corpo do bicho
3. faixas     acha as três linhas (andar, atacar, defender) pelos vãos horizontais
4. quadros    mede os centros por massa e corta na coluna mais vazia entre eles
5. âncora     alinha todos os quadros pelos PÉS e normaliza a altura
6. saída      atlas WebP + manifesto com célula, âncora, linhas e quadros por linha`),
  `<p>O manifesto guarda <strong>quantos quadros cada faixa tem</strong>, porque as folhas não
  são iguais: o golem tem quatro, o orc anda em sete, o esqueleto defende em quatro.</p>`,
  `<p>Quando a medição erra, existem tabelas no começo do script — cada uma com o caso que a
  motivou: altura relativa de cada bicho, contagem de quadros à mão, grade regular (para as
  folhas com efeito grande no meio, que desloca o centro de massa), quantos quadros aproveitar
  do começo da faixa, quantas camadas descascar, folhas de baixo contraste e folhas desenhadas
  viradas para a esquerda.</p>`,

  secao('27.4', 'Como o palco acha a arte certa'),
  `<p>Pelo <strong>id da espécie</strong>, no caso dos monstros comuns — o mesmo id de 8.2. Para
  tudo o mais, pelo <strong>nome</strong>, com a mesma conta dos dois lados
  (<code>chaveDeArte</code>): minúsculo, sem acento, hífen no lugar do espaço. O servidor manda
  a chave junto com a fase ou o andar, e o cliente pede o arquivo. Renomear um ato, um
  habitante ou uma profundidade no código pede renomear a pasta ou o arquivo — senão a cena
  entra com a arte de reserva.</p>`,
)

// =========================================================== 28. interface

parte(
  28,
  'Interface',
  secao('28.1', 'A tela'),
  `<p>Três colunas em tela larga: a aventura (narrativa, palco, mapa e o menu de ações
  numerado), a ficha do personagem com os botões dos outros lugares, e o chat. Abaixo de 860 px
  vira uma coluna só, reordenada — ficha, aventura, menu —, e o chat abre por cima.</p>`,

  secao('28.2', 'O mapa da rota'),
  `<p>Logo abaixo do palco: o arco, o nome do ato, as
  ${config.rpg.cacada.fasesPorAto} fases dele (a última com a caveira do chefe) e o contador
  <code>05-10</code>. As vencidas ficam acesas, a atual pulsa, a que derrubou o personagem fica
  marcada em vermelho. É só leitura — quem anda na rota é a caçada.</p>`,
  nota(
    `<strong>Enquanto uma fase é contada, o mapa fica congelado no estado de antes dela.</strong>
     A resposta do servidor chega com a rota já andada; desenhar isso direto faria a luz pular
     para a fase seguinte antes de a luta ser narrada, entregando o resultado.`,
  ),
  `<p>E, ao chegar a um ato novo, o nome do lugar aparece por cima do palco e some — fade in,
  um segundo de pausa, fade out.</p>`,

  secao('28.3', 'Teclado'),
  tabela(
    ['TECLA', 'O QUE FAZ'],
    [
      ['<kbd>L</kbd> <kbd>M</kbd> <kbd>J</kbd>', 'Abrem loja, mochila e missões, de qualquer lugar'],
      [
        '<kbd>1</kbd>…<kbd>9</kbd>',
        'Agem no que está na tela: com um painel aberto, na linha de mesmo número (comprar na loja, usar ou equipar na mochila); sem painel, no menu de ações',
      ],
      ['<kbd>Esc</kbd>', 'Fecha o que estiver por cima: o pop-up de evento, o painel, o chat'],
    ],
  ),
  `<p>O número faz o que a linha mostra, e a linha mostra o número — o <code>[n]</code>
  desenhado nela é quem define o atalho, não uma lista no código do teclado. No celular as dicas
  somem: sem teclado elas só roubariam a largura que o nome do item precisa.</p>`,

  secao('28.4', 'Som e avisos'),
  `<p>Alertas sonoros para o que chega sem pedir — evento, raid aberta, desafio de duelo, oferta
  e pagamento. São sintetizados no navegador, sem arquivo de áudio, e o botão <strong>Som</strong>
  liga e desliga.</p>`,
)

// ================================================================= 29. api

parte(
  29,
  'A API HTTP',
  `<p>Extraída dos próprios arquivos de rota. Toda rota exige sessão; quase todas exigem também
  o cabeçalho <code>X-Personagem</code> e classe escolhida. Toda rota que altera alguma coisa
  devolve <code>{ ..., personagem }</code> com a ficha nova.</p>`,
  (() => {
    const mapa = [
      ['contas.js', '/api', 'Contas, sessão e personagens'],
      ['fotos.js', '/api', 'Foto do personagem'],
      ['combate.js', '/api/combate', 'A rota (caçada) e o Abismo'],
      ['mochila.js', '/api/mochila', 'Equipar, desequipar, soltar'],
      ['bau.js', '/api', 'O baú'],
      ['cidade.js', '/api', 'Loja, ferreiro, feiticeiro, Rito, Espelho, expedições, prestígio'],
      ['social.js', '/api', 'Rankings, perfis, chat, PvP'],
      ['mercado.js', '/api', 'Ofertas entre jogadores'],
      ['eventos.js', '/api', 'Eventos aleatórios'],
      ['missoes.js', '/api', 'Missões do dia'],
      ['leilao.js', '/api', 'Casa de leilões e entregas'],
      ['chefeMundial.js', '/api', 'Chefe mundial'],
      ['masmorra.js', '/api', 'Masmorra em grupo'],
    ]
    const linhas = []
    for (const [arquivo, prefixo, assunto] of mapa) {
      const fonte = readFileSync(path.join(raiz, 'server', 'rotas', arquivo), 'utf8')
      const achados = [...fonte.matchAll(/\.(get|post|delete|put)\(\s*'([^']+)'/g)]
      const caminhos = achados.map((m) => `${m[1].toUpperCase()} ${prefixo}${m[2] === '/' ? '' : m[2]}`)
      linhas.push([
        `<strong>${assunto}</strong><br><span class="fraca">server/rotas/${arquivo}</span>`,
        `<code>${caminhos.join('</code><br><code>')}</code>`,
      ])
    }
    return tabela(['ASSUNTO', 'ROTAS'], linhas, { classe: 'compacta' })
  })(),
  nota(
    `<strong>Uma fase, uma raid, uma descida do Abismo: cada uma resolve tudo de uma vez e
     devolve o log completo.</strong> Nada fica pendurado esperando o jogador responder golpe a
     golpe. Elimina estado intermediário, elimina timeout, elimina o jogador que fecha o
     navegador no meio. A interface anima a partir do log — a experiência é a mesma e o servidor
     não guarda nada. O laço automático da caçada é só o cliente pedindo a fase seguinte quando
     a animação da anterior acaba; o ritmo é a animação, e um piso de
     <code>${config.rpg.cacada.esperaEntreFasesSegundos}s</code> no servidor impede que chamar a
     rota direto vire torneira aberta.`,
  ),
)

// =========================================================== 30. operação

parte(
  30,
  'Operação',
  secao('30.1', 'Comandos'),
  tabela(
    ['COMANDO', 'O QUE FAZ'],
    [
      ['<code>npm start</code>', 'Sobe o servidor'],
      ['<code>npm run dev</code>', 'Sobe com recarga automática'],
      ['<code>npm run balance</code>', 'Simulador de taxas de vitória (18.1)'],
      ['<code>npm run classes</code>', 'Força relativa das classes, PvP + PvE'],
      ['<code>npm run conformidade</code>', 'Confere as tabelas e as invariantes (18.4)'],
      ['<code>npm run arte</code>', 'Gera <code>public/arte/</code> a partir de <code>Assets/</code> (27.3)'],
      ['<code>npm run especificacao</code>', 'Gera este documento'],
    ],
  ),

  secao('30.2', 'Variáveis de ambiente'),
  `<p>O servidor lê o <code>.env</code> da raiz ao subir; variável que já venha do ambiente
  (PM2, Docker) ganha do arquivo.</p>`,
  tabela(
    ['VARIÁVEL', 'PARA QUÊ'],
    [
      ['<code>PORT</code> · <code>HOST</code>', 'Onde escutar. <code>127.0.0.1</code> quando houver Nginx na frente'],
      ['<code>NODE_ENV</code>', 'Em <code>production</code>, o cookie de sessão só viaja por HTTPS'],
      ['<code>DB_DIR</code> · <code>DB_PATH</code>', 'Onde fica o banco (padrão: <code>dados/</code> no projeto)'],
      ['<code>ADMINS</code>', 'Contas que podem usar os comandos de administrador no chat'],
    ],
  ),

  secao('30.3', 'Backup'),
  `<p>O estado inteiro do jogo é <strong>um arquivo</strong>. Backup é copiar
  <code>dados/resenha.db</code> — com o banco em WAL, o jeito certo é
  <code>sqlite3 resenha.db ".backup destino.db"</code>, que pode rodar com o servidor no ar.</p>`,

  secao('30.4', 'Atualizar'),
  cod(`
no PC       git add -A && git commit && git push
no servidor ~/jogo/scripts/atualizar.sh
              git pull
              npm ci --omit=dev        (sharp não vai para o servidor)
              pm2 restart resenha`),
  `<p>A arte já vai pronta no repositório: o servidor não gera imagem nenhuma, só serve.</p>`,
)

// =============================================================== o documento

const ESTILO = `
@page { size: A4; margin: 17mm 15mm 15mm; }

* { box-sizing: border-box; }
body {
  margin: 0;
  font: 10.4pt/1.55 Georgia, 'Times New Roman', serif;
  color: #17171b;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
p { margin: 0 0 .7em; text-align: justify; }
em { color: #2a2a30; }
strong { color: #0f0f13; }

code, kbd, pre {
  font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace;
}
code {
  font-size: .9em;
  background: #f2f1ec;
  padding: 0 3px;
  border-radius: 2px;
  color: #4a3a17;
}
kbd {
  font-size: .82em;
  border: 1px solid #cfcabd;
  border-bottom-width: 2px;
  border-radius: 3px;
  padding: 0 4px;
  background: #faf9f6;
}
pre.cod {
  font-size: 8.3pt;
  line-height: 1.45;
  background: #f7f6f2;
  border-left: 2.5px solid #8a6a2f;
  padding: 8px 11px;
  margin: .5em 0 .9em;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  break-inside: avoid;
  color: #24242a;
}

h1, h2, h3, th, .rotulo, .capa .campos, .sumario h2 {
  font-family: 'Segoe UI', system-ui, sans-serif;
}

h1 {
  break-before: page;
  margin: 0 0 1.1em;
  padding-bottom: .35em;
  border-bottom: 1.5px solid #8a6a2f;
  font-size: 19pt;
  font-weight: 600;
  letter-spacing: -.01em;
  color: #11111a;
}
h1 .n1 {
  display: inline-block;
  min-width: 1.5em;
  color: #8a6a2f;
  font-variant-numeric: tabular-nums;
}
h2 {
  margin: 1.5em 0 .5em;
  font-size: 12pt;
  font-weight: 600;
  color: #1d1d24;
  break-after: avoid;
}
h2 .n2 { color: #8a6a2f; font-variant-numeric: tabular-nums; margin-right: .35em; }
h3 {
  margin: 1.2em 0 .45em;
  font-size: 8.6pt;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: #6d5623;
  break-after: avoid;
}

ul, ol { margin: 0 0 .8em; padding-left: 1.25em; }
li { margin-bottom: .32em; text-align: justify; }

table.t {
  width: 100%;
  border-collapse: collapse;
  margin: .4em 0 1em;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 8.6pt;
  line-height: 1.4;
}
table.compacta { font-size: 7.9pt; }
table.t th {
  text-align: left;
  font-size: 7.1pt;
  font-weight: 700;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: #6d5623;
  border-bottom: 1px solid #8a6a2f;
  padding: 0 6px 4px;
}
table.t td {
  border-bottom: .75px solid #e7e4dc;
  padding: 4px 6px;
  vertical-align: top;
}
table.t tr { break-inside: avoid; }
table.t .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
table.config td:first-child { width: 58%; }

.nota {
  background: #fbf8ef;
  border: .75px solid #e3d8b8;
  border-left: 3px solid #b99b46;
  padding: 8px 11px;
  margin: .6em 0 1em;
  font-size: 9.6pt;
  break-inside: avoid;
}
.nota p:last-child { margin-bottom: 0; }
.fraca { color: #6a6a73; }

/* ------------------------------------------------------------------ capa */
.capa { height: 252mm; display: flex; flex-direction: column; justify-content: center; }
.capa .selo {
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 8pt;
  letter-spacing: .42em;
  text-transform: uppercase;
  color: #8a6a2f;
  margin-bottom: 14px;
}
.capa h1 {
  break-before: auto;
  border: 0;
  margin: 0;
  padding: 0;
  font-family: Georgia, serif;
  font-size: 34pt;
  font-weight: 700;
  letter-spacing: -.02em;
  line-height: 1.1;
}
.capa .sub {
  font-size: 13pt;
  color: #4b4b54;
  margin: 10px 0 30px;
  font-style: italic;
}
.capa .campos { font-size: 8.8pt; border-top: 1.5px solid #8a6a2f; padding-top: 14px; }
.capa .campos div { display: flex; gap: 14px; margin-bottom: 7px; }
.capa .campos .rotulo {
  flex: none;
  width: 78px;
  font-size: 7.1pt;
  font-weight: 700;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: #6d5623;
  padding-top: 2px;
}
.capa .campos .valor { flex: 1; }
.capa .rodape { margin-top: 26px; font-size: 9.4pt; color: #55555e; font-style: italic; }

/* --------------------------------------------------------------- sumário */
.sumario { break-before: page; }
.sumario h2 {
  margin: 0 0 1em;
  font-size: 15pt;
  border-bottom: 1.5px solid #8a6a2f;
  padding-bottom: .3em;
}
.sumario ol { list-style: none; padding: 0; column-count: 2; column-gap: 26px; font-size: 9.6pt; }
.sumario li { margin-bottom: .45em; break-inside: avoid; }
.sumario .n { display: inline-block; width: 1.9em; color: #8a6a2f; font-variant-numeric: tabular-nums; }

.fim {
  break-before: page;
  margin-top: 2em;
  border-top: 1.5px solid #8a6a2f;
  padding-top: 12px;
  font-size: 9pt;
  color: #55555e;
}
`

const TITULO = 'O RPG da Resenha'
const SUBTITULO = 'Especificação técnica da versão web'

const capa = `
<section class="capa">
  <div class="selo">Especificação técnica</div>
  <h1>${TITULO}</h1>
  <div class="sub">${SUBTITULO}</div>
  <div class="campos">
    <div><span class="rotulo">Implementação</span><span class="valor">Node.js (ESM) · Express · Socket.IO · SQLite · interface em HTML, CSS e módulos ES nativos, sem framework e sem build</span></div>
    <div><span class="rotulo">Escopo</span><span class="valor">Todos os sistemas do jogo: progressão, classes, habilidades, equipamento, combate, inimigos, a rota de 5 arcos, o Abismo, raids, PvP, evolução, forja, infusão e economia — e o que é próprio da versão web: contas, tempo real, missões diárias, chefe mundial, masmorra em grupo, casa de leilões, eventos, prestígio, baú, perfis com foto e o palco desenhado</span></div>
    <div><span class="rotulo">Gerado em</span><span class="valor">${DATA}</span></div>
    <div><span class="rotulo">Conteúdo</span><span class="valor">${TOTAL_DE_ATOS} atos em ${
      TOTAL_DE_ATOS * config.rpg.cacada.fasesPorAto
    } fases · ${Object.keys(CLASSES).length} classes · ${
      Object.keys(HABILIDADES).length
    } habilidades · ${Object.keys(TIPOS).length} tipos de equipamento · ${ESPECIES.length} espécies · ${
      Object.keys(BOSSES).length
    } chefes de ato nomeados · ${Object.keys(TODOS_OS_CHEFES).length} chefes de raid · ${
      HABITANTES.length
    } habitantes do Abismo · ${Object.keys(CHEFES_MUNDIAIS).length} chefes mundiais · ${
      Object.keys(FEITICOS).length
    } feitiços · ${Object.keys(EVENTOS).length} eventos</span></div>
  </div>
  <div class="rodape">
    Todas as tabelas numéricas deste documento são extraídas do código em execução, não
    transcritas à mão. As fórmulas estão em pseudocódigo neutro de linguagem.
  </div>
</section>`

const sumario = `
<section class="sumario">
  <h2>Sumário</h2>
  <ol>
    ${partes.map((p) => `<li><span class="n">${p.numero}.</span>${p.titulo}</li>`).join('\n    ')}
  </ol>
</section>`

const corpo = partes
  .map((p) => `<section><h1><span class="n1">${p.numero}.</span> ${p.titulo}</h1>\n${p.html}\n</section>`)
  .join('\n')

const fim = `
<div class="fim">
  <strong>Fim da especificação.</strong> Tabelas extraídas do código-fonte em ${DATA}.
  Fórmulas e decisões de projeto transcritas de <code>server/</code> e <code>public/</code>.
  Para regenerar: <code>npm run especificacao</code>.
</div>`

const documento = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${TITULO} — ${SUBTITULO}</title>
<style>${ESTILO}</style>
</head>
<body>
${capa}
${sumario}
${corpo}
${fim}
</body>
</html>
`

const saida = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(raiz, 'dados', 'especificacao.html')

mkdirSync(path.dirname(saida), { recursive: true })
writeFileSync(saida, documento)

console.log(`\n  ${partes.length} partes · ${(documento.length / 1024).toFixed(0)} KB`)
console.log(`  ${saida}\n`)
process.exit(0)
