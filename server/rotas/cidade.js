/**
 * A cidade: loja, ferreiro, feiticeiro, o Rito de evolução, a Prova do
 * Espelho e as expedições.
 */
import { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirClasse, exigirPersonagem, responder, rota } from '../contexto.js'
import * as store from '../store.js'
import {
  CLASSES,
  classe,
  classeRaiz,
  especialidadesDe,
  ehEspecialidade,
  nivelDoProximoDegrau,
} from '../rpg/classes.js'
import { habilidadesDaClasse } from '../rpg/habilidades.js'
import {
  atributos,
  darGold,
  desequiparIncompativeis,
  estaEquipado,
  vidaAtual,
  ganharXp,
  guardarItem,
  guardarLoot,
  mochilaCheia,
  removerItem,
} from '../rpg/jogador.js'
import { comoLutador } from '../rpg/encontro.js'
import { lutar } from '../rpg/combate.js'
import { ORDEM_RARIDADE, RARIDADES, criarItem, nomeCompleto, tiposDaClasse } from '../rpg/itens.js'
import {
  definirVendaAutomatica,
  itemDaLoja,
  limparOferta,
  prateleira,
  precoDeCompra,
  raridadesEmVendaAutomatica,
} from '../rpg/loja.js'
import { custoAteOMaximo, custoDoReforco, motivoParaNaoReforcar, quantasTitanitas, reforcar, TITANITAS } from '../rpg/ferreiro.js'
import {
  FEITICOS,
  SLOTS_COM_FEITICO,
  custoDaInfusao,
  infundir,
  motivoParaNaoInfundir,
  quantosFeiticos,
} from '../rpg/feiticos.js'
import {
  custoDoRito,
  desafiosDo,
  encarar,
  esperaDoRito,
  guardiaoDe,
  motivoParaNaoEvoluir,
  opcoesDe,
} from '../rpg/evolucao.js'
import {
  EXPEDICOES,
  emExpedicao,
  enviar,
  expedicaoTerminou,
  limpar,
  recompensasDe,
  sortearRaridade,
  tempoRestante,
} from '../rpg/expedicao.js'
import {
  escalaDeAtributos,
  escalaDeXp,
  motivoParaNaoPrestigiar,
  prestigiar,
  prestigioDe,
  xpComPrestigio,
} from '../rpg/prestigio.js'
import { verClasse, verHabilidade, verItem } from '../visao.js'
import { anunciar } from '../realtime.js'
import { registrar } from '../missoes.js'

export const cidade = Router()

cidade.use(exigirLogin, exigirPersonagem, exigirClasse)

// =========================================================== L O J A

cidade.get(
  '/loja',
  rota((req, res) => {
    const player = req.player

    const itens = prateleira(player).map((linha) =>
      linha.especial
        ? {
            id: linha.id,
            especial: true,
            preco: linha.preco,
            expiraEm: linha.expiraEm,
            descricao: 'Oferta do dia',
            item: verItem(linha.item),
          }
        : { id: linha.id, especial: false, nome: linha.nome, descricao: linha.descricao, preco: linha.preco },
    )

    res.json({
      gold: player.rpg.gold,
      itens,
      // Quanto a loja paga por cada peça da mochila. Ela compra barato de
      // propósito: vender para outro jogador quase sempre rende mais.
      revenda: player.rpg.inventario.map((item, i) => ({
        uid: item.uid,
        posicao: i + 1,
        preco: item.slot ? precoDeCompra(item) : 0,
        vendavel: Boolean(item.slot) && !estaEquipado(player, item.uid),
      })),
      // Venda automática: quais raridades de LOOT viram gold na hora em vez
      // de entrar na mochila. `raridades` é o catálogo, na ordem certa, para
      // a tela desenhar um botão por raridade sem precisar saber a lista.
      vendaAutomatica: {
        ativas: raridadesEmVendaAutomatica(player),
        raridades: ORDEM_RARIDADE.map((r) => ({ id: r, nome: RARIDADES[r].nome, emoji: RARIDADES[r].emoji })),
      },
    })
  }),
)

cidade.post(
  '/loja/venda-automatica',
  rota((req, res) => {
    const player = req.player
    const raridades = Array.isArray(req.body?.raridades) ? req.body.raridades.map(String) : []
    const ativas = definirVendaAutomatica(player, raridades)

    responder(res, player, {
      vendaAutomatica: ativas,
      texto: ativas.length
        ? `Venda automática ligada para: ${ativas.map((r) => RARIDADES[r].nome).join(', ')}.`
        : 'Venda automática desligada.',
    })
  }),
)

cidade.post(
  '/loja/comprar',
  rota((req, res) => {
    const player = req.player
    const linha = itemDaLoja(player, req.body?.id)
    if (!linha) return res.status(404).json({ erro: 'Esse item não está na prateleira.' })
    if (player.rpg.gold < linha.preco) {
      return res.status(409).json({ erro: `Faltam ${linha.preco - player.rpg.gold} de gold.` })
    }
    if (mochilaCheia(player)) return res.status(409).json({ erro: 'Sua mochila está cheia.' })

    const item = linha.criar()
    darGold(player, -linha.preco)
    guardarItem(player, item)
    // A oferta especial é única: comprada, sai da prateleira.
    if (linha.especial) limparOferta(player)

    responder(res, player, {
      texto: `Comprou ${nomeCompleto(item)} por ${linha.preco} de gold.`,
      comprado: verItem(item),
    })
  }),
)

cidade.post(
  '/loja/vender',
  rota((req, res) => {
    const player = req.player
    const uids = Array.isArray(req.body?.uids) ? req.body.uids.map(String) : []
    if (!uids.length) return res.status(400).json({ erro: 'Escolha o que vender.' })

    // Resolve TODAS as buscas antes de remover qualquer coisa: removendo item
    // a item, as posições da mochila mudariam no meio do caminho.
    const aceitos = []
    const recusados = []
    const jaEscolhidos = new Set()

    for (const uid of uids) {
      if (jaEscolhidos.has(uid)) continue // pedido repetido vende uma vez só
      const item = player.rpg.inventario.find((it) => it.uid === uid)

      if (!item) {
        recusados.push({ uid, motivo: 'Não está na mochila.' })
        continue
      }
      if (!item.slot) {
        recusados.push({ uid, nome: item.nome, motivo: 'A loja não compra consumível.' })
        continue
      }
      if (estaEquipado(player, uid)) {
        recusados.push({ uid, nome: item.nome, motivo: 'Está equipado.' })
        continue
      }
      if (['epico', 'lendario'].includes(item.raridade) && !req.body?.confirmarPreciosos) {
        recusados.push({ uid, nome: item.nome, motivo: `É ${item.raridade} — confirme para vender.` })
        continue
      }

      jaEscolhidos.add(uid)
      aceitos.push(item)
    }

    let total = 0
    const vendidos = []
    for (const item of aceitos) {
      total += precoDeCompra(item)
      vendidos.push({ nome: nomeCompleto(item), preco: precoDeCompra(item) })
      removerItem(player, item.uid)
    }

    if (total) darGold(player, total)

    responder(res, player, {
      total,
      vendidos,
      recusados,
      precisaConfirmar: recusados.some((r) => r.motivo?.includes('confirme')),
    })
  }),
)

// ====================================================== F E R R E I R O

const verCusto = (custo) =>
  custo && {
    ...custo,
    grauNome: TITANITAS[custo.grau]?.nome,
    grauEmoji: TITANITAS[custo.grau]?.emoji,
  }

cidade.get(
  '/ferreiro',
  rota((req, res) => {
    const player = req.player

    const pecas = player.rpg.inventario
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.slot)
      .map(({ item, i }) => {
        const custo = custoDoReforco(item)
        return {
          ...verItem(item, i),
          equipado: estaEquipado(player, item.uid),
          custo: verCusto(custo),
          ateOMaximo: custoAteOMaximo(item),
          podeReforcar: !motivoParaNaoReforcar(player, item),
          impedimento: motivoParaNaoReforcar(player, item)?.erro ?? null,
        }
      })

    res.json({
      gold: player.rpg.gold,
      maxReforco: config.rpg.ferreiro.maxReforco,
      ganhoPorNivel: config.rpg.ferreiro.ganhoPorNivel,
      titanitas: Object.entries(TITANITAS).map(([grau, t]) => ({
        grau,
        nome: t.nome,
        emoji: t.emoji,
        de: t.de,
        ate: t.ate,
        quantidade: quantasTitanitas(player, grau),
      })),
      pecas,
    })
  }),
)

cidade.post(
  '/ferreiro/reforcar',
  rota((req, res) => {
    const player = req.player
    const item = player.rpg.inventario.find((it) => it.uid === String(req.body?.uid ?? ''))
    if (!item) return res.status(404).json({ erro: 'Item não encontrado na mochila.' })

    const motivo = motivoParaNaoReforcar(player, item)
    if (motivo) {
      const custo = motivo.custo
      const texto = {
        naoEquipamento: 'Só dá para reforçar equipamento.',
        noMaximo: 'Esse item já está no +10.',
        semTitanita: custo
          ? `Faltam ${custo.quantidade - quantasTitanitas(player, custo.grau)}× ${TITANITAS[custo.grau].nome}.`
          : 'Falta titanita.',
        semGold: custo ? `Faltam ${custo.gold - player.rpg.gold} de gold.` : 'Falta gold.',
      }[motivo.erro]
      return res.status(409).json({ erro: texto ?? 'O ferreiro não pode trabalhar nessa peça.' })
    }

    const feito = reforcar(player, item)
    registrar(player, 'reforco')

    responder(res, player, {
      texto: `${item.nome} agora é +${feito.custo.para}.`,
      reforco: { ...feito, custo: verCusto(feito.custo), item: verItem(item) },
    })
  }),
)

// ==================================================== F E I T I C E I R O

cidade.get(
  '/feiticeiro',
  rota((req, res) => {
    const player = req.player

    // Armas e secundários: o que aceita feitiço. Equipado primeiro, porque é
    // o que vale na luta.
    const pecas = player.rpg.inventario
      .map((item, i) => ({ item, i, equipado: estaEquipado(player, item.uid) }))
      .filter(({ item }) => SLOTS_COM_FEITICO.includes(item.slot))
      .sort((a, b) => Number(b.equipado) - Number(a.equipado) || a.i - b.i)
      .map(({ item, i, equipado }) => ({
        ...verItem(item, i),
        equipado,
        custo: custoDaInfusao(item),
      }))

    res.json({
      gold: player.rpg.gold,
      multiplicadorDeRegravar: config.rpg.feiticeiro.multiplicadorDeRegravar,
      pecas,
      feiticos: Object.entries(FEITICOS).map(([id, f]) => ({
        id,
        nome: f.nome,
        emoji: f.emoji,
        resumo: f.resumo,
        nivelMinimo: f.nivelMinimo,
        quantidade: quantosFeiticos(player, id),
      })),
    })
  }),
)

cidade.post(
  '/feiticeiro/infundir',
  rota((req, res) => {
    const player = req.player
    const item = player.rpg.inventario.find((it) => it.uid === String(req.body?.uid ?? ''))
    const id = String(req.body?.feitico ?? '')
    if (!item) return res.status(404).json({ erro: 'Item não encontrado na mochila.' })

    const motivo = motivoParaNaoInfundir(player, item, id)
    if (motivo) {
      const texto = {
        naoAceitaFeitico: 'O feitiço só se grava em arma ou em item secundário.',
        feiticoInexistente: 'Esse feitiço não existe.',
        jaTemEsse: `${item.nome} já carrega esse feitiço.`,
        semFeitico: 'Você não tem esse feitiço no estoque.',
        semGold: `Faltam ${custoDaInfusao(item) - player.rpg.gold} de gold.`,
      }[motivo.erro]
      return res.status(409).json({ erro: texto ?? 'Não dá para gravar esse feitiço.' })
    }

    const feito = infundir(player, item, id)

    responder(res, player, {
      texto: feito.anterior
        ? `${FEITICOS[feito.anterior].nome} foi apagado. ${item.nome} agora carrega ${FEITICOS[id].nome}.`
        : `${item.nome} agora carrega ${FEITICOS[id].nome}.`,
      infusao: { ...feito, item: verItem(item) },
    })
  }),
)

// ================================================== E V O L U Ç Ã O

const MOTIVOS = {
  semClasse: 'Escolha uma classe primeiro.',
  fimDaLinha: 'Você chegou ao fim da árvore. Não há degrau acima deste.',
  nivelBaixo: null, // montado com o nível exigido
  semGold: null, // montado com o custo
  esperando: null, // montado com a espera
}

cidade.get(
  '/evolucao',
  rota((req, res) => {
    const player = req.player
    const atual = classe(player.rpg.classe)
    const opcoes = opcoesDe(player)
    const exigido = nivelDoProximoDegrau(player.rpg.classe)
    const motivo = motivoParaNaoEvoluir(player)

    res.json({
      atual: verClasse(player.rpg.classe),
      nivelExigido: exigido,
      custo: opcoes.length ? custoDoRito(opcoes[0]) : null,
      espera: esperaDoRito(player),
      podeEncarar: !motivo,
      motivo,
      motivoTexto:
        motivo === 'nivelBaixo'
          ? `O próximo degrau abre no nível ${exigido}.`
          : motivo === 'semGold'
            ? `O Rito custa ${custoDoRito(opcoes[0])} de gold (cobrado mesmo se você perder).`
            : motivo === 'esperando'
              ? `O Rito rejeitou você há pouco. Volte em ${Math.ceil(esperaDoRito(player) / 60_000)} min.`
              : (MOTIVOS[motivo] ?? null),
      opcoes: opcoes.map((id) => ({
        ...verClasse(id),
        // A habilidade nova ACUMULA com as que a linhagem já carrega — é daí
        // que vem o salto de poder de evoluir, não do crescimento de atributo.
        habilidadeNova: verHabilidade(CLASSES[id].habilidade),
        guardiao: guardiaoDe(id),
        desafios: desafiosDo(id, player),
      })),
      // A Prova do Espelho mora na mesma tela: é o caminho de volta.
      espelho: {
        custo: config.rpg.provaCustoPorNivel * player.rpg.nivel,
        espera: Math.max(0, (player.rpg.provaAte ?? 0) - Date.now()),
        precisaConfirmar: ehEspecialidade(player.rpg.classe),
        bases: Object.keys(CLASSES)
          .filter((id) => CLASSES[id].tier === 1 && id !== player.rpg.classe)
          .map(verClasse),
      },
      atualEmoji: atual?.emoji ?? '',
    })
  }),
)

cidade.post(
  '/evolucao/encarar',
  rota((req, res) => {
    const player = req.player
    const alvo = String(req.body?.alvo ?? '')

    const motivo = motivoParaNaoEvoluir(player)
    if (motivo) return res.status(409).json({ erro: 'O Rito não se abre para você agora.', motivo })
    if (!opcoesDe(player).includes(alvo)) {
      return res.status(400).json({ erro: 'Esse caminho não sai da sua classe atual.' })
    }
    if (emExpedicao(player)) return res.status(409).json({ erro: 'Seu personagem está em expedição.' })

    const rito = encarar(player, alvo)

    responder(res, player, {
      rito: {
        venceu: rito.venceu,
        alvo: verClasse(alvo),
        anterior: rito.anterior ? verClasse(rito.anterior) : null,
        custo: rito.custo,
        tier: rito.tier,
        // A vida carrega de uma prova para a outra: só `curaEntreDesafios` do
        // máximo volta entre elas. A animação precisa começar de onde parou.
        etapas: rito.etapas.map((e, i) => ({
          hpInicial:
            i === 0
              ? e.hpMax
              : Math.min(
                  e.hpMax,
                  rito.etapas[i - 1].hpFinal +
                    Math.round(e.hpMax * config.rpg.evolucao.curaEntreDesafios),
                ),
          nome: e.desafio.nome,
          emoji: e.desafio.emoji,
          nivel: e.desafio.nivel,
          final: e.desafio.final,
          hpMaxInimigo: e.desafio.hp,
          venceu: e.venceu,
          hpFinal: e.hpFinal,
          hpMax: e.hpMax,
          rodadas: e.luta.rodadas,
          log: e.luta.log,
        })),
        tirados: (rito.tirados ?? []).map((i) => verItem(i)),
      },
    })
  }),
)

cidade.post(
  '/evolucao/espelho',
  rota((req, res) => {
    const player = req.player
    const alvo = String(req.body?.classe ?? '')
    const alvoInfo = classe(alvo)

    if (!alvoInfo || alvoInfo.tier !== 1) {
      return res.status(400).json({ erro: 'A Prova do Espelho só leva de volta a uma classe inicial.' })
    }
    if (alvo === player.rpg.classe) return res.status(409).json({ erro: 'Você já é dessa classe.' })

    // Quem evoluiu perde a árvore inteira: exige uma confirmação explícita.
    if (ehEspecialidade(player.rpg.classe) && !req.body?.confirmar) {
      return res.status(409).json({
        erro:
          `Você é ${CLASSES[player.rpg.classe].nome}. A Prova apaga a especialidade — ` +
          `a habilidade e o crescimento extra vão junto, e o Rito teria de ser refeito do zero.`,
        precisaConfirmar: true,
      })
    }

    const espera = (player.rpg.provaAte ?? 0) - Date.now()
    if (espera > 0) {
      return res
        .status(409)
        .json({ erro: `O espelho ainda está trincado. Volte em ${Math.ceil(espera / 3_600_000)}h.` })
    }
    if (emExpedicao(player)) return res.status(409).json({ erro: 'Seu personagem está em expedição.' })

    const custo = config.rpg.provaCustoPorNivel * player.rpg.nivel
    if (player.rpg.gold < custo) {
      return res.status(409).json({ erro: `A Prova custa ${custo} de gold. Você tem ${player.rpg.gold}.` })
    }

    darGold(player, -custo)

    // Os dois entram inteiros: a Prova é um espelho, e espelho não tem
    // vantagem de vida.
    const hpInicial = vidaAtual(player)
    const eu = comoLutador(player, player.name)
    const espectro = comoLutador(player, `Espectro ${CLASSES[player.rpg.classe].nome}`)
    espectro.hp = atributos(player).hp

    const luta = lutar(eu, espectro)

    if (luta.vencedor !== 'a') {
      player.rpg.provaAte = Date.now() + config.rpg.provaEsperaHoras * 3_600_000
      store.save()
      return responder(res, player, {
        espelho: { venceu: false, custo, hpInicial, log: luta.log, rodadas: luta.rodadas },
      })
    }

    const anterior = player.rpg.classe
    player.rpg.classe = alvo
    const tirados = desequiparIncompativeis(player)
    store.save()

    responder(res, player, {
      espelho: {
        venceu: true,
        custo,
        hpInicial,
        log: luta.log,
        rodadas: luta.rodadas,
        anterior: verClasse(anterior),
        atual: verClasse(alvo),
        tirados: tirados.map((i) => verItem(i)),
      },
    })
  }),
)

// ================================================== P R E S T Í G I O

/**
 * O prestígio: recomeçar do nível 1 para ficar mais forte para sempre.
 *
 * O painel mostra o que se ganha e o que se perde antes de qualquer clique —
 * é o botão mais irreversível do jogo, e a pessoa tem que saber disso.
 */
const MOTIVOS_DO_PRESTIGIO = {
  semClasse: 'Escolha uma classe primeiro.',
  emExpedicao: 'Seu personagem está em expedição. Traga ele de volta primeiro.',
  nivelBaixo: null, // montado com o nível exigido
}

const verPrestigio = (player) => {
  const n = prestigioDe(player)
  const motivo = motivoParaNaoPrestigiar(player)
  const c = classe(player.rpg.classe)
  const raiz = classe(classeRaiz(player.rpg.classe))

  return {
    contador: n,
    desde: player.rpg.prestigioEm ?? 0,
    nivel: player.rpg.nivel,
    nivelMinimo: config.rpg.prestigio.nivelMinimo,
    pode: motivo === null,
    motivo:
      motivo?.erro === 'nivelBaixo'
        ? `O prestígio abre no nível ${config.rpg.prestigio.nivelMinimo}. Faltam ${config.rpg.prestigio.nivelMinimo - player.rpg.nivel} níveis.`
        : (MOTIVOS_DO_PRESTIGIO[motivo?.erro] ?? null),

    agora: { atributos: escalaDeAtributos(n) - 1, xp: escalaDeXp(n) - 1 },
    depois: { atributos: escalaDeAtributos(n + 1) - 1, xp: escalaDeXp(n + 1) - 1 },

    classeAtual: c ? { nome: c.nome, emoji: c.emoji } : null,
    classeDeVolta: raiz ? { nome: raiz.nome, emoji: raiz.emoji } : null,
    // O que a pessoa perde: a linhagem acima da base e as habilidades dela.
    habilidadesPerdidas: (classe(player.rpg.classe) ? habilidadesDaClasse(classe(player.rpg.classe)) : [])
      .filter((id) => id !== CLASSES[classeRaiz(player.rpg.classe)]?.habilidade)
      .map(verHabilidade),
  }
}

cidade.get(
  '/prestigio',
  rota((req, res) => res.json({ prestigio: verPrestigio(req.player) })),
)

cidade.post(
  '/prestigio',
  rota((req, res) => {
    const player = req.player
    const motivo = motivoParaNaoPrestigiar(player)
    if (motivo) {
      const texto =
        motivo.erro === 'nivelBaixo'
          ? `O prestígio abre no nível ${config.rpg.prestigio.nivelMinimo}.`
          : (MOTIVOS_DO_PRESTIGIO[motivo.erro] ?? 'Não dá para prestigiar agora.')
      return res.status(409).json({ erro: texto })
    }

    const feito = prestigiar(player)
    const nomeAntigo = classe(feito.classeAntiga)?.nome ?? ''

    anunciar(
      `${player.name} alcançou o Prestígio ${feito.prestigio} — deixou de ser ${nomeAntigo} e recomeçou do nível 1.`,
    )

    responder(res, player, {
      texto: `Prestígio ${feito.prestigio}. Você recomeça do nível 1 com tudo o que juntou.`,
      prestigiado: {
        contador: feito.prestigio,
        classeAntiga: nomeAntigo,
        classe: classe(feito.classe)?.nome ?? '',
        tirados: feito.tirados.map((item) => verItem(item)),
        bonus: { atributos: feito.escalaDeAtributos - 1, xp: feito.escalaDeXp - 1 },
      },
      prestigio: verPrestigio(player),
    })
  }),
)

// ================================================== E X P E D I Ç Ã O

cidade.get(
  '/expedicao',
  rota((req, res) => {
    const player = req.player
    res.json({
      atual: emExpedicao(player)
        ? {
            tipo: player.rpg.expedicao.tipo,
            restante: tempoRestante(player),
            terminou: expedicaoTerminou(player),
          }
        : null,
      opcoes: Object.values(EXPEDICOES).map((e) => ({
        ...e,
        premio: recompensasDe(e, player.rpg.nivel),
      })),
    })
  }),
)

cidade.post(
  '/expedicao/enviar',
  rota((req, res) => {
    const player = req.player
    const expedicao = EXPEDICOES[String(req.body?.tipo ?? '')]
    if (!expedicao) return res.status(400).json({ erro: 'Essa expedição não existe.' })
    if (emExpedicao(player)) return res.status(409).json({ erro: 'Seu personagem já está fora.' })

    enviar(player, expedicao)

    responder(res, player, {
      texto: `${expedicao.nome}: seu personagem partiu.`,
      premioEsperado: recompensasDe(expedicao, player.rpg.nivel),
    })
  }),
)

cidade.post(
  '/expedicao/coletar',
  rota((req, res) => {
    const player = req.player
    if (!emExpedicao(player)) return res.status(409).json({ erro: 'Não há expedição para receber.' })
    if (!expedicaoTerminou(player)) {
      return res
        .status(409)
        .json({ erro: `Seu personagem volta em ${Math.ceil(tempoRestante(player) / 60_000)} min.` })
    }

    const expedicao = EXPEDICOES[player.rpg.expedicao.tipo]
    limpar(player)

    if (!expedicao) {
      return responder(res, player, {
        texto: 'A expedição terminou, mas eu não consegui identificar qual era. Nada perdido — mande outra.',
      })
    }

    const premio = recompensasDe(expedicao, player.rpg.nivel)
    darGold(player, premio.gold)
    premio.xp = xpComPrestigio(player, premio.xp)
    const subiu = ganharXp(player, premio.xp)
    registrar(player, 'expedicao')

    let drop = null
    let perdido = false
    let vendido = false
    let goldDoDrop = 0
    if (Math.random() < expedicao.chanceDrop) {
      const tipos = tiposDaClasse(player.rpg.classe)
      const tipo = tipos[Math.floor(Math.random() * tipos.length)]
      const item = criarItem(tipo, player.rpg.nivel, sortearRaridade(expedicao.tentativasDeRaridade))
      const loot = guardarLoot(player, item)
      vendido = loot.vendido
      goldDoDrop = loot.gold
      perdido = !loot.vendido && !loot.coube
      drop = verItem(item)
    }

    responder(res, player, {
      coleta: {
        expedicao: { nome: expedicao.nome, emoji: expedicao.emoji },
        premio,
        subiu,
        drop,
        perdido,
        vendido,
        gold: goldDoDrop,
      },
    })
  }),
)
