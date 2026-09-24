/**
 * Configuracao do RPG — a fonte unica de verdade para todos os numeros do jogo.
 *
 * Portado sem alteracao do bot de WhatsApp (src/config.js, bloco `rpg`). Os
 * valores foram calibrados por simulacao; mexer aqui muda o balanceamento
 * inteiro. Nenhum numero magico deve ficar espalhado pelo resto do codigo.
 */
export const config = {
  rpg: {
    // Gold que o jogador recebe ao escolher a classe. Sem isso o novato
    // entra sem equipamento nenhum e sem como comprar a primeira peca.
    goldInicial: 200,
    // Chance do monstro vir elite (tres niveis acima e bem mais forte)
    chanceElite: 0.12,
    // Itens que cabem na mochila
    tamanhoMochila: 40,

    // ------------------------------------------------------------ a rota
    //
    // A caçada (server/rpg/cacada.js) percorre a rota de rpg/rota.js: cinco
    // arcos, dez atos cada, dez fases cada ato, mais o ato final. Quem
    // decide a dificuldade e a FASE, nunca o nivel do jogador — e por isso
    // que da para empacar.
    cacada: {
      // Fases em cada ato. A ultima e sempre o chefe do ato.
      fasesPorAto: 10,
      // Quanto o nivel do inimigo sobe por fase. Em 0.5 a fase 1 nasce no
      // nivel 1 e a ultima (510) no 255, que e onde o prestigio abre.
      nivelPorFase: 0.5,
      // Quantos niveis acima da propria fase o chefe do ato luta.
      chefeNiveisAcima: 2,

      // A horda de uma fase comum: quantos inimigos entram, um atras do
      // outro, sem parar.
      inimigos: { base: 3, porFase: 0.25, porAto: 0.04, maximo: 6 },
      // Vida devolvida entre um inimigo e outro DA MESMA horda: o respiro
      // entre uma onda e a seguinte. O que sobra da luta anterior e o que
      // entra na proxima, e e esse desgaste acumulado que faz a fase ser uma
      // prova, e nao tres lutas soltas.
      //
      // Em 0 a horda vira execucao: medido por simulacao (npm run rota), tres
      // inimigos seguidos sem respiro nenhum exigem o personagem tres vezes
      // acima do nivel da fase, e como o XP sai do nivel do INIMIGO, quem
      // fica tres vezes acima nunca mais alcanca a rota. 0.35 e o ponto em
      // que a fase continua dura e o jogador continua subindo.
      curaEntreInimigos: 0.15,

      // ------------------------------------------------ a rampa e o botao
      //
      // O inimigo ganha, alem do nivel, um multiplicador que cresce a cada
      // fase: forca = 1 + (fase - 1) x forcaPorFase x escalaDeDificuldade.
      //
      // escalaDeDificuldade e o botao: 1 e a rampa calibrada, 1.5 deixa o
      // excedente 50% maior, 0 desliga a rampa e deixa so o nivel. E o
      // unico numero que se precisa mexer para a rota inteira ficar mais
      // dura ou mais mansa.
      escalaDeDificuldade: 2,
      // Calibrado em npm run rota: com 0.001 a rota inteira sai em ~1.800
      // fases, do nivel 1 ao 506, com os oito primeiros atos passando quase
      // sem tropeco e a friccao aparecendo do nono em diante.
      forcaPorFase: 0.001,
      // Quanto da rampa vira recompensa: o que endurece tambem paga melhor.
      bonusDeRecompensa: 0.6,

      // Piso entre duas fases resolvidas pelo servidor, em segundos. Nao e
      // mecanica: a animacao de uma fase leva bem mais que isto. E so uma
      // trava para o laco automatico nao virar torneira aberta se alguem
      // chamar a rota direto.
      esperaEntreFasesSegundos: 2,
    },

    // O bau (server/rpg/bau.js): um deposito que nao ocupa a mochila. Comeca
    // com `espacos` e cada espaco a mais e comprado um a um, cada vez mais
    // caro: precoPorEspaco x (espacos ja comprados + 1) — 50 mil o primeiro,
    // 100 mil o segundo, 150 mil o terceiro. Sem teto de proposito: o preco
    // e o teto, e e um ralo de gold que cresce junto com quem joga muito.
    bau: {
      espacos: 20,
      precoPorEspaco: 50_000,
    },

    // Dificuldade de fim de jogo. Ate o nivel "desde" a conta de monstro
    // e a original; dali para cima cada nivel soma esta fracao aos
    // atributos. Sao os numeros que seguram o jogo em pe depois do 40 —
    // mexa aqui se achar duro ou mole demais (0 desliga a escala).
    // A curva satura de proposito: ela sobe rapido nos primeiros niveis
    // depois do limiar e entao estabiliza. Acima disso jogador e monstro ja
    // crescem no mesmo ritmo (os dois sao lineares no nivel), entao um
    // multiplicador que nao para de subir viraria parede intransponivel.
    // "meia" e em quantos niveis a escala chega a ~63% do teto.
    escalaEndgame: {
      desde: 40,
      meia: 8,
      teto: { hp: 0.45, atq: 0.4, def: 0.42, agi: 0.14 },
      // Quanto o mundo endurece quando cada degrau da árvore de classes
      // abre. Os degraus dão habilidades que ACUMULAM, e é daí que vem o
      // salto de poder — estes números são o contrapeso. Ver escalaDeNivel.
      degrausDeClasse: { 150: 0.3, 200: 0.55 },
    },

    // A defesa reduz dano por porcentagem: 100 / (100 + def * 1.5). Esse
    // "100" e a defesa de referencia, e ele precisa crescer com o nivel.
    // Com ele fixo, defesa 700 no nivel 100 corta 91% do dano e a luta
    // vira atrito de 46 rodadas — quem tem DEF alta ganha sempre e quem
    // nao tem nao arranha. Crescendo junto, a defesa vale o mesmo em
    // qualquer faixa. Ate "desde" a conta e a original, byte por byte.
    mitigacao: {
      desde: 40,
      referenciaBase: 100,
      porNivel: 15,
    },

    // Evolucao de classe (/evoluir): a partir do nivel 40, tres desafios
    // em sequencia sem cura no meio. Vencer os tres destrava a especialidade.
    evolucao: {
      // Em que nível cada degrau da árvore abre.
      //   2 = especialidade · 3 = maestria · 4 = apoteose
      niveis: { 2: 50, 3: 150, 4: 200 },
      // Quanto o ganho por nível cresce a cada degrau acima da
      // especialidade. As especialidades têm ganho próprio (calibrado por
      // simulação); maestria e apoteose derivam do degrau anterior.
      crescimentoPorTier: 1.16,
      // Quanto custa tentar o Rito de cada degrau, ganhando ou perdendo
      custoGold: { 2: 5000, 3: 80000, 4: 400000 },
      // O quanto o espelho do Rito vale dos seus próprios atributos. Sobe
      // com o degrau: o Rito de apoteose é uma luta contra quase você.
      espelhoPorTier: { 2: 0.82, 3: 0.86, 4: 0.9 },
      // Quantos niveis acima do jogador vem cada desafio do rito
      degraus: [0, 2, 4],
      // Vida recuperada entre um desafio e outro (0.25 = 25% do maximo)
      curaEntreDesafios: 0.25,
      // Espera antes de tentar o rito de novo, em horas
      esperaHoras: 0.5,
    },

    // O Abismo (/abismo): fim de jogo. O personagem desce enfrentando um
    // chefe por andar, sem cura cheia, ate cair. Quanto mais fundo, melhor
    // a recompensa — e cada andar e mais duro que o anterior.
    abismo: {
      nivelMinimo: 40,
      // Espera entre uma descida e outra, em minutos
      cooldownMinutos: 30,
      // Teto de andares numa descida (ninguem chega perto, e uma trava
      // de seguranca para a simulacao nao rodar para sempre)
      maxAndares: 50,
      // O nivel de cada andar e uma fracao do nivel do jogador: o andar 1
      // sai em fracaoInicial e cada andar soma fracaoPorAndar. Em 0.55 e
      // 0.05, o andar 1 e metade do jogador e o andar 10 empata com ele.
      // Calibrado por simulacao: com equipamento comum se chega perto do
      // andar 5, com raro perto do 9 e com lendario passa do 15. Mexer
      // nestes tres numeros e o jeito de deixar o Abismo mais raso ou mais
      // fundo — sao eles que decidem a profundidade tipica.
      fracaoInicial: 0.45,
      fracaoPorAndar: 0.04,
      // Dificuldade extra que cada andar acumula em cima do monstro
      forcaPorAndar: 0.02,
      // Vida devolvida ao fim de cada andar vencido, e o piso abaixo do
      // qual ninguem entra no andar seguinte. O piso e o que faz a descida
      // terminar pela dificuldade e nao por sangramento acumulado.
      curaPorAndar: 0.22,
      pisoDeVida: 0.6,
      // Recompensa por andar vencido: cresce com o andar e com o nivel
      xpPorAndar: 140,
      xpPorAndarAoQuadrado: 12,
      goldPorAndar: 100,
      goldPorAndarAoQuadrado: 8,
      // Um item a cada N andares vencidos, com piso de 1 para quem passou
      // do primeiro. A raridade melhora conforme a descida.
      andaresPorItem: 4,
      maxItens: 6,
      // Um sorteio de feitiço a cada N andares vencidos
      andaresPorFeitico: 6,
    },

    // Chance do drop ser de um tipo que a sua classe usa. O resto cai fora
    // da classe de proposito: e o que da assunto para a troca entre jogadores.
    chanceDropDaPropriaClasse: 0.6,
    // Prova do Espelho (mudanca de classe): custo por nivel e espera apos falhar
    provaCustoPorNivel: 120,
    provaEsperaHoras: 24,
    // Loja
    precoEquipamentoPorNivel: 40,
    // A loja compra barato e vende caro — a diferenca entre os dois precos
    // e o que faz valer a pena negociar com outro jogador em vez de
    // simplesmente despachar tudo aqui.
    lojaFracaoDeCompra: 0.7,
    lojaMultiplicadorDeVenda: 1.5,
    // Oferta especial: chance de ter alguma na prateleira, e de quanto em
    // quanto tempo ela e sorteada de novo (em minutos)
    lojaChanceDeOferta: 0.6,
    lojaOfertaMinutos: 20,
    // Expedicoes (/expedicao): rendimento por minuto fora.
    // Fica de proposito abaixo do que se ganha cacando ativamente — a
    // expedicao e para quem vai fechar o WhatsApp, nao um atalho.
    expedicao: {
      xpPorMinuto: { base: 3, porNivel: 0.6 },
      goldPorMinuto: { base: 1.5, porNivel: 0.35 },
    },

    // Raids (/raid): chefes grandes demais para uma pessoa so.
    raid: {
      // Tempo que a sala fica aberta esperando gente entrar, em minutos
      salaMinutos: 10,
      // Acima deste nivel, quem abre a sala convoca os chefes do segundo
      // escalao (CHEFES_DUROS em raid.js) em vez dos originais.
      nivelParaChefesDuros: 30,
      minJogadores: 3,
      maxJogadores: 10,
      // Espera entre uma raid e outra por jogador, em minutos
      cooldownMinutos: 10,
      // Atributos do chefe (a vida ainda cresce com o tamanho do grupo)
      // Estes numeros sairam de simulacao, nao de chute: com equipamento
      // comum, 2 jogadores quase nao passam, 4 ficam perto de meio a meio
      // e 8 vencem com folga. Ver o README para a tabela completa.
      hpBase: 143,
      hpPorNivel: 52,
      // A vida do chefe cresce com o numero de jogadores elevado a isto.
      // Em 1.0 (linear), entrar mais gente ajuda porque o dano do chefe se
      // espalha — sem virar vitoria garantida por juntar meio grupo.
      escalaPorJogador: 1.0,
      atqBase: 12,
      atqPorNivel: 4.4,
      defBase: 6,
      defPorNivel: 2.4,
      agiBase: 8,
      agiPorNivel: 1.4,
      // Recompensa por participante que sobreviveu a raid vitoriosa
      xpBase: 400,
      xpPorNivel: 90,
      goldBase: 250,
      goldPorNivel: 55,
      // Quantos itens caem: por jogador, com um piso
      itensPorJogador: 0.6,
      itensMinimos: 2,
    },

    // Ferreiro (/ferreiro): reforça um equipamento do +1 ao +10 pagando gold
    // e titanitas. Titanita cai de monstro, chefe e raid — é um contador no
    // perfil, não ocupa espaço na mochila.
    ferreiro: {
      maxReforco: 10,
      // Quanto cada +1 soma nos atributos do item.
      //
      // Em 0.03 o +10 dá +30%, que é quase exatamente a distância entre uma
      // raridade e a seguinte (raro 1.6 × 1.3 = 2.08 ≈ épico 2.1). Ou seja:
      // levar uma peça ao máximo vale uma raridade. É o que faz o ferreiro
      // competir com o drop em vez de anulá-lo — vale reforçar o que você
      // tem, e vale trocar quando cai algo melhor.
      ganhoPorNivel: 0.03,
      // Gold = goldBase × nível do item × (reforço atual + 1) ^ goldExpoente
      goldBase: 14,
      goldExpoente: 1.45,
      // Titanitas exigidas para sair de cada reforço para o seguinte
      // (índice 0 = do +0 para o +1, índice 9 = do +9 para o +10)
      titanitasPorReforco: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6],
      // Chance de cair titanita, por tipo de inimigo
      chanceDrop: { comum: 0.2, elite: 0.45, boss: 1, raid: 1, abismo: 1 },
      // Quantas caem de uma vez (sorteado entre min e max)
      quantidadeDrop: { min: 1, max: 3 },
    },

    // Feiticeiro (/feiticeiro): grava um feitiço na arma ou no secundário. Os feitiços caem
    // no Abismo e de chefes — também são contadores no perfil.
    feiticeiro: {
      // Gold para gravar = goldPorNivel × nível da arma
      goldPorNivel: 70,
      // Regravar por cima de um feitiço existente custa mais (e apaga o antigo)
      multiplicadorDeRegravar: 1.8,
      // Chance de cair um feitiço
      chanceDrop: { boss: 0.35, raid: 0.5, abismo: 0.7 },
    },

    // Duelos entre jogadores (/pvp)
    pvp: {
      // Espera entre um duelo e outro, em minutos
      cooldownMinutos: 1,
      // Quanto tempo um desafio fica de pe esperando resposta, em minutos
      desafioMinutos: 3,
      // Pontuacao com que todo mundo comeca no ranking
      pontosIniciais: 1000,
      // O quanto cada duelo mexe na pontuacao (K do Elo). Maior = ranking
      // mais volatil; menor = mais dificil subir e cair.
      k: 32,
    },
    // Quanto tempo uma oferta de venda fica de pe, em minutos
    ofertaMinutos: 5,

    // Prestigio: no nivel `nivelMinimo` o personagem pode recomecar do 1,
    // voltando a classe base e perdendo a arvore de evolucao, mas somando um
    // no contador. Cada ponto de prestigio vale para sempre:
    //   bonusAtributos  fracao somada aos atributos que a CLASSE da (nao ao
    //                   equipamento) — 0.12 = +12% por prestigio
    //   bonusXp         fracao somada a todo XP ganho — 0.3 = +30% por prestigio
    prestigio: {
      nivelMinimo: 250,
      bonusAtributos: 0.12,
      bonusXp: 0.3,
    },

    // Missoes diarias (server/missoes.js): sorteadas por personagem, trocam a
    // meia-noite no fuso de config.eventos.fusoHorario. Cada uma paga gold,
    // XP (uma fracao do que o nivel pede para subir) e titanita; fechar
    // todas do dia abre o bau, que garante um feitico.
    missoes: {
      porDia: 3,
      goldBase: 200,
      goldPorNivel: 40,
      fracaoDoNivelEmXp: 0.35,
      bauMultiplicadorDeGold: 2,
    },

    // Chefe mundial (server/chefeMundial.js): aparece uma vez por dia, numa
    // hora sorteada entre horaInicio e horaFim, e fica duracaoHoras. A vida e
    // de todo o servidor; cada ataque e uma investida contra uma projecao
    // dele no nivel de quem ataca, e o dano conta em "unidades" — a vida de
    // um monstro comum daquele nivel. Assim iniciante e veterano contribuem
    // em pe de igualdade, cada um na sua faixa.
    //
    // Medido por simulacao: uma investida tira ~3 unidades com equipamento
    // raro e ~6 com lendario. Cair so encerra a investida (nao fere).
    chefeMundial: {
      ligado: true,
      horaInicio: 12,
      horaFim: 21,
      duracaoHoras: 3,
      esperaEntreAtaquesMinutos: 10,
      // Vida total = unidadesPorJogador x contas ativas (com piso)
      unidadesPorJogador: 15,
      unidadesMinimas: 30,
      // Conta como ativa quem jogou nos ultimos N dias
      diasParaContarAtivo: 3,
      projecao: { escudo: 8, atq: 0.65, def: 1.0, agi: 1.0 },
      // Recompensa: a de uma raid do nivel do jogador, vezes
      // (base + porFracao x fracao do dano que ele causou)
      recompensa: { base: 0.6, porFracao: 3, seFugir: 0.5 },
      // Fracao minima do dano total para entrar no sorteio de item
      fracaoParaItem: 0.03,
    },

    // Masmorra em grupo (server/masmorra.js): o Abismo em grupo. De 2 a 4
    // jogadores descem juntos; cada andar e uma luta de grupo contra o
    // habitante do Abismo com a vida multiplicada pelo tamanho do grupo.
    // Por simulacao (equipamento raro), o grupo desce 2 a 5 andares a mais
    // que o Abismo solo: 2 pessoas +2 a 3, 3 pessoas +3 a 5, 4 pessoas +4 a 6.
    masmorra: {
      nivelMinimo: 40,
      minJogadores: 2,
      maxJogadores: 4,
      salaMinutos: 10,
      cooldownMinutos: 30,
      vidaPorJogador: 1.0,
      ataque: 1.12,
      areaCada: 3,
      areaMultiplicador: 0.55,
      // Fracao da recompensa do Abismo que cada membro recebe por andar
      recompensa: 0.85,
    },

    // Casa de leiloes (server/leilao.js)
    leilao: {
      duracoesHoras: [1, 6, 24],
      maxAnunciosPorPersonagem: 5,
      // Um lance precisa superar o anterior em pelo menos esta fracao
      incrementoMinimo: 0.05,
      // O que a casa cobra do vendedor sobre o valor final. Some do jogo:
      // e um dos poucos ralos de gold que existem.
      taxaDeVenda: 0.05,
      // Lance nos ultimos N minutos empurra o fim para N minutos adiante
      prorrogacaoMinutos: 2,
    },

  },


  // ------------------------------------------------------- so da versao web
  web: {
    // Quantos personagens cada conta pode ter
    maxPersonagens: 10,
    // Mensagens de chat guardadas no historico
    chatHistorico: 200,
    // Tamanho maximo de uma mensagem de chat
    chatMaxCaracteres: 300,
    // Espera entre duas mensagens de chat da mesma pessoa, em segundos
    chatCooldownSegundos: 1,
    // Tempo que uma sessao de login dura, em dias
    sessaoDias: 30,
    // Foto do personagem (server/fotos.js). O navegador já recorta e reduz
    // para fotoLargura x fotoAltura antes de mandar; o limite em KB é só a
    // trava do servidor para quem mandar outra coisa.
    fotoLargura: 480,
    fotoAltura: 640,
    fotoMaxKb: 400,
    fotoEsperaSegundos: 10,
  },

  // Eventos aleatorios (server/eventos.js): de tempos em tempos o servidor
  // chama todo mundo on-line para uma horda, um dragao, uma festa. O catalogo
  // dos eventos fica no proprio eventos.js; aqui so o ritmo.
  eventos: {
    ligado: true,
    // So acontecem dentro desta janela, no horario deste fuso. horaFim 24 =
    // meia-noite. Fora dela o proximo fica marcado para depois que abrir.
    fusoHorario: 'America/Sao_Paulo',
    horaInicio: 9,
    horaFim: 24,
    // Intervalo sorteado entre um evento e o proximo, em minutos. Em 60-180
    // sao uns sete por dia dentro da janela.
    intervaloMinimo: 60,
    intervaloMaximo: 180,
    // Quanto tempo a chamada fica aberta esperando gente, em minutos
    inscricaoMinutos: 3,
    // Com menos gente on-line do que isto, o evento espera e tenta de novo
    // em vez de disparar para uma taverna vazia.
    minimoOnline: 1,
    esperaSemGenteMinutos: 15,
    // Teto de participantes num evento de luta em grupo
    maxParticipantes: 10,
  },
}
