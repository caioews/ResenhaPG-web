/**
 * Os sistemas do dia a dia: missões diárias, chefe mundial, masmorra em
 * grupo e casa de leilões — os painéis, a narração e o que chega pelo socket.
 *
 * Como o resto do cliente, nada aqui decide coisa alguma: pede ao servidor,
 * mostra o que voltou.
 */
import {
  $,
  abasDoModal,
  abrirModal,
  avisar,
  avisarBom,
  barra,
  comBotao,
  confirmar,
  duracao,
  el,
  estado,
  fecharModal,
  linhaDeDado,
  linhaDeItem,
  mandar,
  nomeDoItem,
  num,
  pct,
  pegar,
  recarregarPainel,
  textoDeBonus,
  vazio,
} from './nucleo.js'
import {
  definirCena,
  esperarNarracao,
  forte,
  limparNarrativa,
  narrarLuta,
  narrarRaid,
  rico,
  sussurro,
  tituloDeCena,
} from './narrativa.js'
import { tocar } from './som.js'

/** O que o app.js empresta: sem isso este arquivo teria de importá-lo. */
const ganchos = {
  atualizarFicha: async () => {},
  mostrarCartao: () => {},
  aoMudarChefe: () => {},
}
export const configurarAventuras = (g) => Object.assign(ganchos, g)

const porcento = (v) => `${(Math.round(v * 1000) / 10).toLocaleString('pt-BR')}%`

// =================================================== M I S S Õ E S

export async function abrirMissoes() {
  const { missoes: d } = await pegar('/api/missoes')
  const r = d.recompensa

  const linhas = d.lista.map((m) =>
    el(
      'div',
      { class: `linha-item missao${m.resgatada ? ' feita' : ''}` },
      el('div', { class: 'icone' }, m.resgatada ? '✅' : m.emoji),
      el(
        'div',
        { class: 'corpo' },
        el('div', { class: 'nome' }, m.texto),
        barra('xp', m.progresso, m.alvo, `${num(m.progresso)} / ${num(m.alvo)}`),
      ),
      el(
        'div',
        { class: 'acoes-item' },
        m.resgatada
          ? el('span', { class: 'sussurro' }, 'resgatada')
          : el(
              'button',
              {
                class: 'btn pequeno primario',
                type: 'button',
                disabled: !m.concluida,
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    const feito = await mandar('/api/missoes/resgatar', { id: m.id })
                    tocar('mercado')
                    avisarBom(
                      `+${num(feito.recompensa.gold)} de gold, +${num(feito.recompensa.xp)} de XP e ` +
                        `${feito.recompensa.titanita.quantidade}× ${feito.recompensa.titanita.nome}.`,
                    )
                    abrirMissoes()
                  }),
              },
              m.concluida ? 'Resgatar' : 'Em andamento',
            ),
      ),
    ),
  )

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      `Três tarefas por dia, sorteadas para o seu personagem. Trocam à meia-noite — as de hoje vencem em ${duracao(d.viraEm)}.`,
    ),
    el('div', { class: 'lista' }, ...linhas),
    el(
      'div',
      { class: 'bloco', style: 'margin-top:14px' },
      el('h4', {}, 'Cada missão paga'),
      el(
        'p',
        { style: 'margin:0' },
        forte(`+${num(r.gold)} de gold`),
        ' · ',
        forte(`+${num(r.xp)} de XP`),
        ' · ',
        forte(`${r.titanita.quantidade}× ${r.titanita.emoji} ${r.titanita.nome}`),
      ),
    ),
    el(
      'div',
      { class: 'bloco bau', style: 'margin-top:10px' },
      el('h4', {}, '🎁 Baú do dia'),
      el(
        'p',
        { style: 'margin:0 0 10px' },
        d.bau.resgatado
          ? 'Aberto. Volte amanhã.'
          : `Feche as três e leve +${num(d.bau.gold)} de gold, 3× titanita e um feitiço garantido.`,
      ),
      d.bau.resgatado
        ? null
        : el(
            'button',
            {
              class: 'btn primario largo',
              type: 'button',
              disabled: !d.bau.disponivel,
              onClick: (ev) =>
                comBotao(ev.currentTarget, async () => {
                  const { bau } = await mandar('/api/missoes/bau')
                  tocar('evento')
                  avisarBom(
                    `Baú aberto: +${num(bau.gold)} de gold, ${bau.titanita.quantidade}× ${bau.titanita.nome}` +
                      (bau.feitico ? ` e um feitiço de ${bau.feitico.emoji} ${bau.feitico.nome}.` : '.'),
                  )
                  abrirMissoes()
                }),
            },
            d.bau.disponivel ? 'Abrir o baú' : 'Resgate as três para abrir',
          ),
    ),
  )

  abrirModal('Missões do dia', corpo, { nome: 'missoes', aoRecarregar: abrirMissoes })
}

// =========================================== C H E F E   M U N D I A L

/** O último estado conhecido do chefe — alimenta o botão do menu. */
let chefe = null
let aindaVemHoje = true
export const chefeAtual = () => chefe

function definirChefe(novo, { manterMeu = false } = {}) {
  // O aviso geral do socket não sabe quem está olhando: preserva o "eu".
  if (manterMeu && chefe?.eu && novo) novo = { ...novo, eu: chefe.eu }
  chefe = novo
  ganchos.aoMudarChefe(chefe)
}

export async function buscarChefe() {
  try {
    const r = await pegar('/api/chefe-mundial')
    aindaVemHoje = r.aindaVemHoje
    definirChefe(r.chefe)
  } catch {
    // Sem chefe é o normal.
  }
}

export async function abrirChefeMundial() {
  const r = await pegar('/api/chefe-mundial')
  aindaVemHoje = r.aindaVemHoje
  definirChefe(r.chefe)
  const c = r.chefe

  const tabela = c.ranking.length
    ? el(
        'table',
        { class: 'tabela' },
        el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Aventureiro'), el('th', { style: 'text-align:right' }, 'Dano'), el('th', { style: 'text-align:right' }, 'Ataques'))),
        el(
          'tbody',
          {},
          ...c.ranking.map((x) =>
            el(
              'tr',
              { class: x.id === estado.p.id ? 'eu' : '' },
              el('td', {}, `${x.posicao}.`),
              el('td', {}, x.nome),
              el('td', { class: 'num' }, `${porcento(x.fracao)}`),
              el('td', { class: 'num' }, num(x.ataques)),
            ),
          ),
        ),
      )
    : vazio('Ninguém bateu ainda.')

  let corpo
  if (c.ativo) {
    const botao = el(
      'button',
      {
        class: 'btn primario largo',
        type: 'button',
        disabled: c.eu.espera > 0,
        onClick: (ev) =>
          comBotao(ev.currentTarget, async () => {
            fecharModal()
            const feito = await mandar('/api/chefe-mundial/atacar')
            definirChefe(feito.chefe)
            await narrarInvestida(feito.investida, feito.chefe)
          }),
      },
      c.eu.espera > 0 ? `Recuperando o fôlego — ${duracao(c.eu.espera)}` : `Atacar ${c.chefe.nome}`,
    )

    corpo = el(
      'div',
      {},
      el('div', { class: 'chefe-emoji' }, c.chefe.emoji),
      el('h3', { class: 'chefe-nome' }, c.chefe.nome),
      el('p', { class: 'sussurro', style: 'text-align:center;margin-top:0' }, c.chefe.descricao),
      barra('vida', c.vida, c.vidaMax, `${porcento(c.vida / c.vidaMax)} de vida`),
      el(
        'div',
        { class: 'chefe-dados' },
        el('span', {}, `Foge em ${duracao(c.terminaEm - Date.now())}`),
        el('span', {}, `${c.participantes} aventureiro(s) bateram`),
      ),
      el(
        'div',
        { class: 'bloco', style: 'margin:12px 0' },
        el('h4', {}, 'Sua parte'),
        linhaDeDado('Dano causado', `${porcento(c.eu.fracao)} do total`),
        linhaDeDado('Ataques', num(c.eu.ataques)),
      ),
      botao,
      el(
        'p',
        { class: 'sussurro' },
        `Cada ataque é uma investida contra uma projeção dele no seu nível: o dano vale o mesmo para qualquer um. ` +
          `Cair só encerra a investida — ninguém sai ferido. ${c.esperaEntreAtaquesMinutos} min entre ataques. ` +
          'O espólio sai na proporção do dano; o maior dano leva um lendário, o segundo e o terceiro, épicos.',
      ),
      el('div', { class: 'rotulo-secao', style: 'margin-top:12px' }, 'Quem mais bateu'),
      tabela,
    )
  } else {
    const ultimo = c.estado && c.chefe
    corpo = el(
      'div',
      {},
      el('div', { class: 'chefe-emoji' }, '🌫️'),
      el(
        'p',
        { style: 'text-align:center' },
        aindaVemHoje
          ? `Nenhum chefe no ar. Ele aparece uma vez por dia, em algum momento entre ${c.janela.horaInicio}h e ${c.janela.horaFim}h, e fica ${c.janela.duracaoHoras}h.`
          : 'O chefe de hoje já passou. Amanhã tem outro.',
      ),
      ultimo
        ? el(
            'div',
            { class: 'bloco' },
            el('h4', {}, `Último: ${c.chefe.emoji} ${c.chefe.nome}`),
            el(
              'p',
              { style: 'margin:0 0 8px' },
              c.estado === 'derrotado' ? `Derrubado — golpe final de ${c.golpeFinal}.` : 'Fugiu antes de cair.',
            ),
            tabela,
          )
        : null,
    )
  }

  abrirModal('Chefe Mundial', corpo, { nome: 'chefeMundial', aoRecarregar: abrirChefeMundial })
}

async function narrarInvestida(inv, visao) {
  limparNarrativa()
  definirCena('Chefe Mundial')
  tituloDeCena(`${inv.chefe.emoji} ${inv.chefe.nome}`)
  sussurro('Você avança contra ele. A vida dele é do servidor inteiro — aqui conta o quanto você arranca antes de recuar.')

  await narrarLuta({
    nomeA: 'Você',
    hpA: inv.hpInicial,
    hpMaxA: inv.hpMax,
    nomeB: `${inv.chefe.emoji} ${inv.chefe.nome}`,
    hpB: inv.chefe.hpMax,
    hpMaxB: inv.chefe.hpMax,
    log: inv.log,
  })

  tituloDeCena(inv.derrubou ? 'Golpe final!' : 'Fim da investida')
  rico(
    inv.quebrouOEscudo ? 'Você atravessou a guarda dele inteira: ' : inv.caiu ? 'Ele te derrubou, mas não antes de você arrancar ' : 'Você recua depois de arrancar ',
    forte(`${(Math.round(inv.unidades * 10) / 10).toLocaleString('pt-BR')} unidades`),
    ` de vida — ${porcento(inv.unidades / (visao?.vidaMax || 1))} do total.`,
  )
  if (inv.derrubou) rico(forte(`${inv.chefe.nome} caiu com o seu golpe!`, 'cura'), ' O espólio sai agora para todo mundo que bateu.')
  else sussurro(`Ele ainda tem ${porcento((visao?.vida ?? 0) / (visao?.vidaMax || 1))} de vida. Próximo ataque em ${visao?.esperaEntreAtaquesMinutos ?? 10} min.`)
}

async function narrarEspolioDoChefe(r) {
  await esperarNarracao()
  limparNarrativa()
  definirCena('Chefe Mundial')
  tituloDeCena(r.como === 'derrotado' ? `${r.chefe.emoji} ${r.chefe.nome} caiu!` : `${r.chefe.emoji} ${r.chefe.nome} fugiu`)
  rico(
    `Você ficou em ${r.posicao}º, com ${porcento(r.fracao)} do dano. `,
    r.como === 'derrotado' ? '' : el('span', { class: 'sussurro' }, 'Ele fugiu: o espólio saiu pela metade. '),
  )
  rico('+', forte(num(r.xp)), ' de XP e +', forte(num(r.gold)), ' de gold.', r.subiu?.length ? el('span', { class: 'cura' }, `  Subiu para o nível ${r.subiu.at(-1)}!`) : '')
  if (r.item) {
    if (r.onde === 'vendido') {
      rico(nomeDoItem(r.item), ` (${r.item.raridadeNome}) vendido automaticamente por `, forte(`+${num(r.goldDoItem)}`), ' de gold.')
    } else {
      rico('Caiu ', forte(nomeDoItem(r.item)), ` (${r.item.raridadeNome}) — ${textoDeBonus(r.item)}.`)
      if (r.onde === 'entregas') sussurro('A mochila estava cheia: o item ficou em "Retirar", na Casa de Leilões.')
    }
  }
  if (r.titanita) sussurro(`Titanita: ${r.titanita.quantidade}× ${r.titanita.nome}.`)
  if (r.feitico) rico('E um feitiço de ', forte(`${r.feitico.emoji} ${r.feitico.nome}`), '.')
}

// ================================================== M A S M O R R A

export async function abrirMasmorra() {
  const d = await pegar('/api/masmorra')
  const p = estado.p

  const cartaoDaSala = (sala, minha) =>
    el(
      'div',
      { class: 'bloco', style: 'margin-bottom:10px' },
      el('h4', {}, `Grupo de ${sala.liderNome}`),
      linhaDeDado('Jogadores', `${sala.participantes.length} / ${sala.maxJogadores} (mínimo ${sala.minJogadores})`),
      linhaDeDado('Nível da masmorra', sala.nivelMedio),
      linhaDeDado('Fecha em', duracao(sala.expiraEm - Date.now())),
      el(
        'div',
        { style: 'margin:10px 0;font-size:13.5px;color:var(--texto-fraco)' },
        sala.participantes.map((x) => `${x.classe?.emoji ?? ''} ${x.nome} (nv ${x.nivel})`).join(' · '),
      ),
      el(
        'div',
        { style: 'display:flex;gap:8px' },
        minha
          ? el(
              'button',
              {
                class: 'btn primario',
                type: 'button',
                disabled: sala.liderId !== p.id || sala.participantes.length < sala.minJogadores,
                title: sala.liderId !== p.id ? 'Só quem abriu decide a hora de descer' : '',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    fecharModal()
                    // Chega pela resposta e pelo socket: narra só a resposta.
                    estado.iniciandoMasmorra = true
                    try {
                      const r = await mandar('/api/masmorra/iniciar')
                      await narrarMasmorra(r.descida)
                    } finally {
                      estado.iniciandoMasmorra = false
                    }
                  }),
              },
              'Descer',
            )
          : el(
              'button',
              {
                class: 'btn primario',
                type: 'button',
                disabled: Boolean(d.impedimento),
                title: d.impedimento ?? '',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    await mandar('/api/masmorra/entrar', { id: sala.id })
                    abrirMasmorra()
                  }),
              },
              'Entrar',
            ),
        minha
          ? el(
              'button',
              {
                class: 'btn',
                type: 'button',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    await mandar('/api/masmorra/sair')
                    abrirMasmorra()
                  }),
              },
              'Sair do grupo',
            )
          : null,
      ),
    )

  const outras = d.salas.filter((s) => s.id !== d.minhaSala?.id)

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      `O Abismo em grupo: de ${d.minJogadores} a ${d.maxJogadores} jogadores (um por conta) descem juntos, andar por andar. ` +
        'A vida de cada um carrega de um andar para o outro, e quem cai fica caído até o fim. Todos levam o espólio de ' +
        'todos os andares que o grupo venceu. A partir do nível ' +
        `${d.nivelMinimo}.`,
    ),
    d.impedimento && !d.minhaSala ? el('p', { style: 'color:var(--erro)' }, d.impedimento) : null,
    d.melhorAndar ? el('p', {}, 'Seu recorde: ', forte(`andar ${d.melhorAndar}`)) : null,
    d.minhaSala ? el('div', { class: 'rotulo-secao' }, 'Seu grupo') : null,
    d.minhaSala ? cartaoDaSala(d.minhaSala, true) : null,
    el('div', { class: 'rotulo-secao', style: 'margin-top:14px' }, 'Grupos abertos'),
    outras.length ? el('div', {}, ...outras.map((s) => cartaoDaSala(s, false))) : vazio('Nenhum outro grupo montado.'),
    d.minhaSala
      ? null
      : el(
          'button',
          {
            class: 'btn primario largo',
            type: 'button',
            style: 'margin-top:12px',
            disabled: Boolean(d.impedimento),
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                await mandar('/api/masmorra/abrir')
                abrirMasmorra()
              }),
          },
          'Montar um grupo',
        ),
    d.ranking.length
      ? el(
          'div',
          { style: 'margin-top:16px' },
          el('div', { class: 'rotulo-secao' }, 'Mais fundo em grupo'),
          el(
            'div',
            { style: 'font-size:13.5px;color:var(--texto-fraco);line-height:1.7' },
            d.ranking.map((x) => `${x.posicao}. ${x.nome} — andar ${x.melhorMasmorra}`).join('  ·  '),
          ),
        )
      : null,
  )

  abrirModal('Masmorra', corpo, { nome: 'masmorra', aoRecarregar: abrirMasmorra })
}

export async function narrarMasmorra(descida) {
  limparNarrativa()
  definirCena('Masmorra')
  tituloDeCena(`🏰 A descida — masmorra de nível ${descida.nivelMedio}`)
  sussurro(`${descida.porJogador.map((j) => j.personagem.nome).join(', ')} descem juntos. A vida carrega de andar em andar.`)

  for (const a of descida.andares) {
    if (a.log) {
      // O último andar, o da queda, vai narrado golpe a golpe.
      tituloDeCena(`Andar ${a.andar} — ${a.inimigo.nome}`)
      await narrarRaid({ nomeDoChefe: a.inimigo.nome, hpMaxDoChefe: a.inimigo.hpMax, log: a.log })
      if (a.venceu) rico(forte(`Andar ${a.andar} vencido.`, 'cura'))
      else rico(forte(`O grupo caiu no andar ${a.andar}.`, 'perigo'))
    } else {
      rico(
        forte(`Andar ${a.andar}`),
        ` — ${a.inimigo.nome} (nv ${a.inimigo.nivel}) caiu em ${a.rodadas} rodadas`,
        a.caidos.length ? el('span', { class: 'perigo' }, `; ${a.caidos.join(', ')} ${a.caidos.length > 1 ? 'caíram' : 'caiu'}`) : '',
        '.',
      )
    }
  }

  tituloDeCena(`${descida.vencidos} andar(es) — ${descida.profundidade}`)
  for (const j of descida.porJogador) {
    rico(
      forte(j.personagem.nome),
      `: +${num(j.xp)} XP, +${num(j.gold)} gold`,
      j.recorde ? el('span', { class: 'cura' }, '  novo recorde!') : '',
      j.subiu?.length ? el('span', { class: 'cura' }, `  subiu para o nível ${j.subiu.at(-1)}`) : '',
    )
    for (const x of j.itens) {
      if (x.onde === 'vendido') {
        sussurro(`${j.personagem.nome} vendeu automaticamente ${nomeDoItem(x.item)} (${x.item.raridadeNome}) por +${num(x.goldDoItem)} de gold.`)
      } else {
        sussurro(`${j.personagem.nome} recebeu ${nomeDoItem(x.item)} (${x.item.raridadeNome})${x.onde === 'entregas' ? ' — em "Retirar", a mochila estava cheia' : ''}.`)
      }
    }
    const extras = [j.titanita ? `${j.titanita.quantidade}× ${j.titanita.nome}` : null, j.feitico ? `feitiço de ${j.feitico.nome}` : null].filter(Boolean)
    if (extras.length) sussurro(`${j.personagem.nome}: ${extras.join(' e ')}.`)
  }
  sussurro('Todo mundo sai carregado da masmorra: ferido, como no Abismo.')
}

// ==================================================== L E I L Ã O

export async function abrirLeiloes(aba = 'abertos') {
  const d = await pegar('/api/leilao')
  const p = estado.p

  const abas = abasDoModal(
    [
      { id: 'abertos', nome: `Leilões (${d.abertos.length})` },
      { id: 'vender', nome: 'Anunciar' },
      { id: 'meus', nome: 'Meus anúncios e lances' },
      { id: 'retirar', nome: `Retirar (${d.entregas.length})` },
    ],
    aba,
    (id) => abrirLeiloes(id),
  )

  const detalhesDoLeilao = (l) => [
    el('span', { class: 'sussurro' }, `de ${l.vendedor.nome}`),
    l.lance
      ? el('span', { style: 'color:var(--ouro-claro)' }, `lance ${num(l.lance)} 💰 (${l.lider?.nome ?? '—'})`)
      : el('span', {}, `mínimo ${num(l.lanceMinimo)} 💰`),
    l.compraJa ? el('span', { class: 'sussurro' }, `compre já ${num(l.compraJa)} 💰`) : null,
    el('span', { class: 'sussurro' }, l.estado === 'aberto' ? `fecha em ${duracao(l.terminaEm - Date.now())}` : ''),
  ]

  let corpo

  if (aba === 'abertos') {
    corpo = d.abertos.length
      ? el(
          'div',
          { class: 'lista' },
          ...d.abertos.map((l) => {
            const bloqueado = l.meu || l.mesmaConta
            const campo = el('input', { type: 'number', min: String(l.proximoLance), value: String(l.proximoLance), style: 'max-width:110px' })
            const acoes = bloqueado
              ? [el('span', { class: 'sussurro' }, l.meu ? 'seu anúncio' : 'da sua conta')]
              : l.lidero
                ? [el('span', { class: 'reforco' }, 'você lidera')]
                : [
                    campo,
                    el(
                      'button',
                      {
                        class: 'btn pequeno primario',
                        type: 'button',
                        onClick: (ev) =>
                          comBotao(ev.currentTarget, async () => {
                            const r = await mandar('/api/leilao/lance', { id: l.id, valor: Number(campo.value) })
                            avisarBom(r.texto)
                            abrirLeiloes('abertos')
                          }),
                      },
                      'Dar lance',
                    ),
                    l.compraJa
                      ? el(
                          'button',
                          {
                            class: 'btn pequeno',
                            type: 'button',
                            onClick: () =>
                              confirmar(
                                'Compre já',
                                `Comprar ${nomeDoItem(l.item)} agora por ${num(l.compraJa)} de gold?`,
                                async () => {
                                  const r = await mandar('/api/leilao/comprar', { id: l.id })
                                  avisarBom(r.texto)
                                },
                                'Comprar',
                              ),
                          },
                          'Compre já',
                        )
                      : null,
                  ]
            return linhaDeItem(l.item, { detalhes: detalhesDoLeilao(l), acoes: acoes.filter(Boolean) })
          }),
        )
      : vazio('Nenhum leilão aberto. Que tal anunciar alguma coisa?')
  } else if (aba === 'vender') {
    let escolhido = null
    const minimo = el('input', { type: 'number', min: '1', value: '', placeholder: 'lance mínimo', style: 'max-width:140px' })
    const ja = el('input', { type: 'number', min: '1', value: '', placeholder: 'opcional', style: 'max-width:140px' })
    const horas = el('select', { style: 'max-width:120px' }, ...d.regras.duracoesHoras.map((h) => el('option', { value: String(h) }, `${h}h`)))
    const botao = el(
      'button',
      {
        class: 'btn primario',
        type: 'button',
        disabled: true,
        onClick: (ev) =>
          comBotao(ev.currentTarget, async () => {
            const r = await mandar('/api/leilao/anunciar', {
              uid: escolhido,
              lanceMinimo: Number(minimo.value),
              compraJa: ja.value ? Number(ja.value) : null,
              horas: Number(horas.value),
            })
            avisarBom(r.texto)
            abrirLeiloes('meus')
          }),
      },
      'Anunciar',
    )

    const lista = el(
      'div',
      { class: 'lista' },
      ...d.vendaveis.map((item) => {
        const node = linhaDeItem(item, {
          detalhes: [
            el('span', { class: 'sussurro' }, `referência ~${num(item.referencia)} 💰`),
            el('span', { class: 'sussurro' }, `a loja pagaria ${num(item.naLoja)} 💰`),
          ],
          onClick: () => {
            escolhido = item.uid
            for (const outro of lista.children) outro.classList.remove('selecionada')
            node.classList.add('selecionada')
            if (!Number(minimo.value)) minimo.value = String(item.naLoja)
            botao.disabled = false
          },
        })
        return node
      }),
    )

    corpo = el(
      'div',
      {},
      el(
        'p',
        { class: 'sussurro', style: 'margin-top:0' },
        `O item sai da sua mochila e fica guardado na casa até o leilão fechar. Quem der mais leva; cada lance precisa ` +
          `superar o anterior em ${porcento(d.regras.incrementoMinimo)}, e lance nos últimos ${d.regras.prorrogacaoMinutos} min estende o fim. ` +
          `Sem lance, o item volta. A casa fica com ${porcento(d.regras.taxaDeVenda)} do valor final. Até ${d.regras.maxAnuncios} anúncios abertos.`,
      ),
      el(
        'div',
        { style: 'display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px' },
        el('label', { class: 'campo', style: 'margin:0' }, el('span', {}, 'Lance mínimo'), minimo),
        el('label', { class: 'campo', style: 'margin:0' }, el('span', {}, 'Compre já'), ja),
        el('label', { class: 'campo', style: 'margin:0' }, el('span', {}, 'Duração'), horas),
        botao,
      ),
      el('div', { class: 'rotulo-secao' }, 'Escolha a peça'),
      d.vendaveis.length ? lista : vazio('Nada para anunciar. Só equipamento fora de uso vai a leilão.'),
    )
  } else if (aba === 'meus') {
    const meusAbertos = d.meus.filter((l) => l.estado === 'aberto')
    const fechados = d.meus.filter((l) => l.estado !== 'aberto')
    const textoDoFim = { vendido: 'vendido', expirado: 'sem lance — voltou', cancelado: 'cancelado' }

    corpo = el(
      'div',
      {},
      el('div', { class: 'rotulo-secao' }, 'Onde você lidera'),
      d.lidero.length
        ? el('div', { class: 'lista' }, ...d.lidero.map((l) => linhaDeItem(l.item, { detalhes: detalhesDoLeilao(l) })))
        : vazio('Nenhum lance seu na frente agora.'),
      el('div', { class: 'rotulo-secao', style: 'margin-top:16px' }, 'Seus anúncios abertos'),
      meusAbertos.length
        ? el(
            'div',
            { class: 'lista' },
            ...meusAbertos.map((l) =>
              linhaDeItem(l.item, {
                detalhes: detalhesDoLeilao(l),
                acoes: l.lance
                  ? [el('span', { class: 'sussurro' }, `${l.lances} lance(s)`)]
                  : [
                      el(
                        'button',
                        {
                          class: 'btn pequeno perigo',
                          type: 'button',
                          onClick: (ev) =>
                            comBotao(ev.currentTarget, async () => {
                              const r = await mandar('/api/leilao/cancelar', { id: l.id })
                              avisar(r.texto)
                              abrirLeiloes('meus')
                            }),
                        },
                        'Cancelar',
                      ),
                    ],
              }),
            ),
          )
        : vazio('Nenhum anúncio aberto.'),
      fechados.length ? el('div', { class: 'rotulo-secao', style: 'margin-top:16px' }, 'Fechados nas últimas 24h') : null,
      fechados.length
        ? el(
            'div',
            { class: 'lista' },
            ...fechados.map((l) =>
              linhaDeItem(l.item, {
                detalhes: [
                  el('span', { class: l.estado === 'vendido' ? 'cura' : 'sussurro' }, textoDoFim[l.estado] ?? l.estado),
                  l.estado === 'vendido' ? el('span', {}, `por ${num(l.lance)} 💰 para ${l.lider?.nome ?? '—'}`) : null,
                ],
              }),
            ),
          )
        : null,
    )
  } else {
    corpo = d.entregas.length
      ? el(
          'div',
          {},
          el('p', { class: 'sussurro', style: 'margin-top:0' }, 'Itens que chegaram quando a mochila estava cheia. Abra espaço e retire.'),
          el(
            'div',
            { class: 'lista' },
            ...d.entregas.map((e) =>
              linhaDeItem(e.item, {
                detalhes: [el('span', { class: 'sussurro' }, e.motivo)],
                acoes: [
                  el(
                    'button',
                    {
                      class: 'btn pequeno primario',
                      type: 'button',
                      onClick: (ev) =>
                        comBotao(ev.currentTarget, async () => {
                          const r = await mandar('/api/leilao/retirar', { id: e.id })
                          avisarBom(r.texto)
                          abrirLeiloes('retirar')
                        }),
                    },
                    'Retirar',
                  ),
                ],
              }),
            ),
          ),
        )
      : vazio('Nada esperando você.')
  }

  abrirModal('Casa de Leilões', el('div', {}, el('p', { style: 'margin:0 0 10px;color:var(--ouro-claro)' }, `💰 ${num(p.gold)}`), corpo), {
    abas,
    largura: 'amplo',
    nome: 'leilao',
    aoRecarregar: () => abrirLeiloes(aba),
  })
}

// ====================================================== S O C K E T

export function ouvirAventuras(socket) {
  socket.on('missao:concluida', async ({ missao }) => {
    tocar('mercado')
    avisarBom(`Missão concluída: ${missao.texto}. Resgate em Missões.`)
    await ganchos.atualizarFicha()
    recarregarPainel('missoes')
  })

  socket.on('chefeMundial:surgiu', ({ chefe: c }) => {
    tocar('raid')
    definirChefe(c)
    ganchos.mostrarCartao({
      titulo: 'Chefe mundial',
      texto: `${c.chefe.emoji} ${c.chefe.chamada}`,
      expiraEm: Date.now() + 90_000,
      botoes: [
        { rotulo: 'Ver', classe: 'btn pequeno primario', acao: abrirChefeMundial },
        { rotulo: 'Fechar', acao: () => {} },
      ],
    })
  })

  socket.on('chefeMundial:atualizou', ({ chefe: c }) => {
    definirChefe(c, { manterMeu: true })
    recarregarPainel('chefeMundial')
  })

  socket.on('chefeMundial:fim', ({ chefe: c }) => {
    definirChefe(c, { manterMeu: true })
    aindaVemHoje = false
    recarregarPainel('chefeMundial')
  })

  socket.on('chefeMundial:recompensa', async (r) => {
    tocar('evento')
    await ganchos.atualizarFicha()
    await narrarEspolioDoChefe(r)
  })

  socket.on('masmorra:atualizou', () => recarregarPainel('masmorra'))

  socket.on('masmorra:entrou', ({ nome, sala }) => {
    tocar('aviso')
    avisar(`${nome} entrou no seu grupo da masmorra (${sala.participantes.length}/${sala.maxJogadores}).`)
  })

  socket.on('masmorra:resultado', async ({ descida }) => {
    if (estado.iniciandoMasmorra) return
    tocar('raid')
    await ganchos.atualizarFicha()
    await esperarNarracao()
    await narrarMasmorra(descida)
  })

  socket.on('leilao:atualizou', () => recarregarPainel('leilao'))

  socket.on('leilao:superado', async ({ leilao, devolvido, quem }) => {
    tocar('mercado')
    avisar(`${quem} cobriu seu lance em ${leilao.item.nome}. Seus ${num(devolvido)} de gold voltaram.`)
    await ganchos.atualizarFicha()
  })

  socket.on('leilao:vendido', async ({ itemNome, valor, liquido, comprador }) => {
    tocar('mercado')
    avisarBom(`${comprador} arrematou ${itemNome} por ${num(valor)}. Você recebeu ${num(liquido)} de gold.`)
    await ganchos.atualizarFicha()
  })

  socket.on('leilao:ganhou', async ({ item, valor, onde }) => {
    tocar('mercado')
    avisarBom(
      `Você arrematou ${item.nome} por ${num(valor)} de gold!` +
        (onde === 'entregas' ? ' A mochila estava cheia: ele está em "Retirar".' : ''),
    )
    await ganchos.atualizarFicha()
  })

  socket.on('leilao:expirou', async ({ item, onde }) => {
    tocar('aviso')
    avisar(`${item.nome} saiu do leilão sem lance${onde === 'entregas' ? ' — está em "Retirar".' : ' e voltou para a mochila.'}`)
    await ganchos.atualizarFicha()
  })
}
