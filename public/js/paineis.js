/**
 * Os painéis que abrem por cima da tela: ficha, mochila, loja, ferreiro,
 * feiticeiro, o Rito, expedições, Abismo, raid, PvP e os rankings.
 *
 * Cada painel é uma função `abrirX()` que busca os dados na API e monta o
 * conteúdo. Nenhum deles guarda estado próprio: recarregar é sempre redesenhar
 * a partir do que o servidor respondeu.
 */
import {
  $,
  abasDoModal,
  abrirModal,
  avisar,
  avisarBom,
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
  nomeDoSlot,
  num,
  pegar,
  textoDeBonus,
  vazio,
} from './nucleo.js'
import {
  definirCena,
  forte,
  limparNarrativa,
  narrarLuta,
  narrarRaid,
  rico,
  sussurro,
  tituloDeCena,
} from './narrativa.js'
import { abrirPerfil, retrato } from './perfil.js'

const porcento = (v) => `${Math.round(v * 1000) / 10}%`

// ================================================== M O C H I L A

/**
 * As divisões da mochila, na ordem em que aparecem. `pega` decide se um item
 * cai na divisão; o que não cair em nenhuma vai para "Outros".
 */
const DIVISOES_DA_MOCHILA = [
  { id: 'usaveis', nome: 'Utilizáveis', pega: (i) => i.consumivel },
  { id: 'arma', nome: 'Armas', pega: (i) => i.slot === 'arma' },
  { id: 'secundario', nome: 'Secundárias', pega: (i) => i.slot === 'secundario' },
  { id: 'elmo', nome: 'Elmos', pega: (i) => i.slot === 'elmo' },
  { id: 'armadura', nome: 'Armaduras', pega: (i) => i.slot === 'armadura' },
  { id: 'anel', nome: 'Anéis', pega: (i) => i.slot === 'anel' },
]

export async function abrirMochila(filtro = 'tudo') {
  const p = estado.p
  const equipados = new Set(Object.values(p.equipado).filter(Boolean).map((i) => i.uid))

  const linha = (item) => {
    const acoes = []

    if (item.consumivel) {
      acoes.push(
        el(
          'button',
          {
            class: 'btn pequeno primario',
            type: 'button',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                const r = await mandar('/api/mochila/usar', { uid: item.uid })
                avisarBom(r.texto)
                abrirMochila(filtro)
              }),
          },
          'Usar',
        ),
      )
    } else if (equipados.has(item.uid)) {
      acoes.push(
        el(
          'button',
          {
            class: 'btn pequeno',
            type: 'button',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                await mandar('/api/mochila/desequipar', { slot: item.slot })
                abrirMochila(filtro)
              }),
          },
          'Tirar',
        ),
      )
    } else {
      acoes.push(
        el(
          'button',
          {
            class: 'btn pequeno primario',
            type: 'button',
            disabled: item.nivel > p.nivel,
            title: item.nivel > p.nivel ? `Precisa ser nível ${item.nivel}` : '',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                const r = await mandar('/api/mochila/equipar', { uid: item.uid })
                avisarBom(r.texto)
                abrirMochila(filtro)
              }),
          },
          'Equipar',
        ),
      )
    }

    acoes.push(
      el(
        'button',
        {
          class: 'btn pequeno perigo',
          type: 'button',
          title: 'Soltar',
          onClick: () =>
            confirmar(
              'Soltar item',
              `Largar ${nomeDoItem(item)} no chão? Isso não tem desfazer.`,
              async () => {
                await mandar('/api/mochila/soltar', { uid: item.uid, confirmar: true })
                avisar('Item deixado para trás.')
                abrirMochila(filtro)
              },
              'Soltar',
            ),
        },
        '✕',
      ),
    )

    return linhaDeItem(item, {
      acoes,
      detalhes: equipados.has(item.uid) ? [el('span', { class: 'reforco' }, 'equipado')] : [],
    })
  }

  // Em cada divisão o que está em uso vem primeiro; o resto na ordem em que
  // entrou na mochila. O servidor já manda assim, mas a tela não depende disso.
  const emUsoPrimeiro = (lista) =>
    lista
      .map((item, i) => ({ item, i }))
      .sort((a, b) => Number(equipados.has(b.item.uid)) - Number(equipados.has(a.item.uid)) || a.i - b.i)
      .map(({ item }) => item)

  const sobra = p.inventario.filter((i) => !DIVISOES_DA_MOCHILA.some((d) => d.pega(i)))
  const divisoes = [
    ...DIVISOES_DA_MOCHILA.map((d) => ({ ...d, itens: emUsoPrimeiro(p.inventario.filter(d.pega)) })),
    { id: 'outros', nome: 'Outros', itens: sobra },
  ].filter((d) => d.itens.length)

  if (filtro !== 'tudo' && !divisoes.some((d) => d.id === filtro)) filtro = 'tudo'

  const chips = el(
    'div',
    { class: 'filtros-mochila' },
    el(
      'button',
      { class: `chip${filtro === 'tudo' ? ' ativo' : ''}`, type: 'button', onClick: () => abrirMochila('tudo') },
      `Tudo · ${p.inventario.length}`,
    ),
    ...divisoes.map((d) =>
      el(
        'button',
        { class: `chip${filtro === d.id ? ' ativo' : ''}`, type: 'button', onClick: () => abrirMochila(d.id) },
        `${d.nome} · ${d.itens.length}`,
      ),
    ),
  )

  const visiveis = filtro === 'tudo' ? divisoes : divisoes.filter((d) => d.id === filtro)

  const corpo = el(
    'div',
    {},
    el(
      'div',
      { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' },
      el('span', {}, `${p.mochila.usado} de ${p.mochila.total} espaços`),
      el('span', { style: 'color:var(--ouro-claro)' }, `💰 ${num(p.gold)}`),
    ),
    p.inventario.length ? chips : null,
    p.inventario.length
      ? visiveis.map((d) =>
          el(
            'section',
            { class: 'divisao-mochila' },
            el('div', { class: 'rotulo-secao' }, `${d.nome} · ${d.itens.length}`),
            el('div', { class: 'lista' }, ...d.itens.map(linha)),
          ),
        )
      : vazio('Mochila vazia. Cace alguma coisa.'),
  )

  abrirModal('Mochila', corpo, { nome: 'mochila', aoRecarregar: () => abrirMochila(filtro) })
}

// ====================================================== L O J A

export async function abrirLoja(aba = 'comprar') {
  const dados = await pegar('/api/loja')
  const p = estado.p

  const abas = abasDoModal(
    [
      { id: 'comprar', nome: 'Comprar' },
      { id: 'vender', nome: 'Vender' },
    ],
    aba,
    (id) => abrirLoja(id),
  )

  let corpo

  if (aba === 'comprar') {
    corpo = el(
      'div',
      { class: 'lista' },
      ...dados.itens.map((linhaDaLoja) => {
        const podePagar = p.gold >= linhaDaLoja.preco
        const botao = el(
          'button',
          {
            class: 'btn pequeno primario',
            type: 'button',
            disabled: !podePagar,
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                const r = await mandar('/api/loja/comprar', { id: linhaDaLoja.id })
                avisarBom(r.texto)
                abrirLoja('comprar')
              }),
          },
          `${num(linhaDaLoja.preco)} 💰`,
        )

        if (linhaDaLoja.especial) {
          return linhaDeItem(linhaDaLoja.item, {
            acoes: [botao],
            detalhes: [
              el('span', { style: 'color:var(--ouro-claro)' }, '✨ Oferta do dia'),
              `expira em ${duracao(linhaDaLoja.expiraEm - Date.now())}`,
            ],
          })
        }

        return el(
          'div',
          { class: 'linha-item' },
          el('div', { class: 'icone' }, linhaDaLoja.nome.split(' ')[0]),
          el(
            'div',
            { class: 'corpo' },
            el('div', { class: 'nome' }, linhaDaLoja.nome.replace(/^\S+\s/, '')),
            el('div', { class: 'detalhe' }, linhaDaLoja.descricao),
          ),
          el('div', { class: 'acoes-item' }, botao),
        )
      }),
    )
  } else {
    const escolhidos = new Set()
    const precoPorUid = new Map(dados.revenda.map((r) => [r.uid, r.preco]))

    const rodape = el('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:14px' })
    const total = el('span', { style: 'flex:1;color:var(--ouro-claro)' }, 'Nada selecionado')

    const botaoVender = el(
      'button',
      {
        class: 'btn primario',
        type: 'button',
        disabled: true,
        onClick: (ev) =>
          comBotao(ev.currentTarget, async () => {
            const r = await mandar('/api/loja/vender', {
              uids: [...escolhidos],
              confirmarPreciosos: true,
            })
            if (r.recusados.length) {
              avisar(`${r.recusados.length} item(ns) não puderam ser vendidos.`, 'erro')
            }
            if (r.total) avisarBom(`+${num(r.total)} de gold.`)
            abrirLoja('vender')
          }),
      },
      'Vender selecionados',
    )

    const atualizarRodape = () => {
      const soma = [...escolhidos].reduce((s, uid) => s + (precoPorUid.get(uid) ?? 0), 0)
      total.textContent = escolhidos.size
        ? `${escolhidos.size} item(ns) · ${num(soma)} de gold`
        : 'Nada selecionado'
      botaoVender.disabled = escolhidos.size === 0
    }

    const vendaveis = p.inventario.filter((i) => dados.revenda.find((r) => r.uid === i.uid && r.vendavel))

    const lista = el(
      'div',
      { class: 'lista' },
      ...vendaveis.map((item) => {
        const node = linhaDeItem(item, {
          detalhes: [el('span', { style: 'color:var(--ouro-claro)' }, `${num(precoPorUid.get(item.uid))} 💰`)],
          onClick: () => {
            if (escolhidos.has(item.uid)) escolhidos.delete(item.uid)
            else escolhidos.add(item.uid)
            node.classList.toggle('selecionada', escolhidos.has(item.uid))
            atualizarRodape()
          },
        })
        return node
      }),
    )

    rodape.append(total, botaoVender)

    corpo = el(
      'div',
      {},
      el(
        'p',
        { class: 'sussurro', style: 'margin-top:0' },
        'A loja compra por 70% do valor de referência e vende por 150%. Negociar com outro jogador quase sempre rende mais.',
      ),
      vendaveis.length ? lista : vazio('Nada para vender. Itens equipados não entram.'),
      vendaveis.length ? rodape : null,
    )
  }

  abrirModal('Loja de Arkan', corpo, { abas, nome: 'loja', aoRecarregar: () => abrirLoja(aba) })
}

// ================================================== F E R R E I R O

export async function abrirFerreiro() {
  const dados = await pegar('/api/ferreiro')

  const estoque = el(
    'div',
    { class: 'grade-tres', style: 'margin-bottom:14px' },
    ...dados.titanitas.map((t) =>
      el(
        'div',
        { class: 'bloco' },
        el('h4', {}, `${t.emoji} ${t.nome}`),
        el(
          'div',
          { style: 'display:flex;justify-content:space-between;font-size:14px' },
          el('span', { class: 'sussurro' }, `reforços +${t.de} a +${t.ate}`),
          el('span', { style: 'font-family:var(--mono);color:var(--ouro-claro)' }, `×${t.quantidade}`),
        ),
      ),
    ),
  )

  const linhas = dados.pecas.map((peca) => {
    if (!peca.custo) {
      return linhaDeItem(peca, {
        detalhes: [el('span', { class: 'reforco' }, 'no máximo (+10)')],
      })
    }

    const temMaterial = peca.impedimento !== 'semTitanita'
    const temGold = peca.impedimento !== 'semGold'

    return linhaDeItem(peca, {
      detalhes: [
        el(
          'span',
          { class: temGold ? 'reforco' : 'perigo', style: temGold ? '' : 'color:var(--erro)' },
          `${num(peca.custo.gold)} 💰`,
        ),
        el(
          'span',
          { style: temMaterial ? '' : 'color:var(--erro)' },
          `${peca.custo.grauEmoji} ${peca.custo.quantidade}× ${peca.custo.grauNome}`,
        ),
        el('span', { class: 'sussurro' }, `até o +10: ${num(peca.ateOMaximo.gold)} 💰`),
        peca.equipado ? el('span', { class: 'reforco' }, 'equipado') : null,
      ],
      acoes: [
        el(
          'button',
          {
            class: 'btn pequeno primario',
            type: 'button',
            disabled: !peca.podeReforcar,
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                const r = await mandar('/api/ferreiro/reforcar', { uid: peca.uid })
                avisarBom(r.texto)
                abrirFerreiro()
              }),
          },
          `+${peca.custo.para}`,
        ),
      ],
    })
  })

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      'O ferreiro nunca falha e nunca quebra equipamento — cobra e aplica. Cada +1 soma 3% nos atributos; o +10 vale quase uma raridade inteira.',
    ),
    estoque,
    linhas.length ? el('div', { class: 'lista' }, ...linhas) : vazio('Nenhum equipamento na mochila.'),
  )

  abrirModal('Forja de Thorin', corpo, { nome: 'ferreiro', aoRecarregar: abrirFerreiro })
}

// ================================================ F E I T I C E I R O

export async function abrirFeiticeiro(pecaEscolhida = null) {
  const dados = await pegar('/api/feiticeiro')
  const peca =
    dados.pecas.find((a) => a.uid === pecaEscolhida) ?? dados.pecas.find((a) => a.equipado) ?? dados.pecas[0]

  // A outra peça equipada: se ela já tem o feitiço, gravar o mesmo aqui não
  // soma nada na luta (o servidor conta feitiço repetido uma vez só).
  const outraEquipada = peca?.equipado
    ? Object.values(estado.p.equipado).find(
        (item) => item && item.uid !== peca.uid && ['arma', 'secundario'].includes(item.slot),
      )
    : null

  const linhaDePeca = (a) =>
    linhaDeItem(a, {
      selecionada: peca?.uid === a.uid,
      onClick: () => abrirFeiticeiro(a.uid),
      detalhes: [
        a.equipado ? el('span', { class: 'reforco' }, 'equipado') : null,
        el('span', { class: 'sussurro' }, `gravar: ${num(a.custo)} 💰`),
      ],
    })

  const grupos = [
    { nome: 'Armas', pecas: dados.pecas.filter((a) => a.slot === 'arma') },
    { nome: 'Secundárias', pecas: dados.pecas.filter((a) => a.slot === 'secundario') },
  ].filter((g) => g.pecas.length)

  const listaDePecas = el(
    'div',
    {},
    ...grupos.map((g, i) =>
      el(
        'div',
        { style: i ? 'margin-top:14px' : '' },
        el('div', { class: 'rotulo-secao' }, g.nome),
        el('div', { class: 'lista' }, ...g.pecas.map(linhaDePeca)),
      ),
    ),
  )

  const emUso = ['arma', 'secundario']
    .map((slot) => estado.p.equipado[slot])
    .filter((item) => item?.feitico)

  const listaDeFeiticos = el(
    'div',
    { class: 'lista' },
    ...dados.feiticos.map((f) => {
      const temEstoque = f.quantidade > 0
      const jaTem = peca?.feitico === f.id
      const repetido = !jaTem && outraEquipada?.feitico === f.id

      return el(
        'div',
        { class: 'linha-item', style: temEstoque ? '' : 'opacity:.45' },
        el('div', { class: 'icone' }, f.emoji),
        el(
          'div',
          { class: 'corpo' },
          el('div', { class: 'nome' }, f.nome, el('span', { class: 'sussurro' }, `  ×${f.quantidade}`)),
          el(
            'div',
            { class: 'detalhe' },
            el('span', {}, f.resumo),
            el('span', { class: 'sussurro' }, `cai do nível ${f.nivelMinimo}`),
            repetido
              ? el('span', { style: 'color:var(--erro)' }, `${nomeDoItem(outraEquipada)} já tem — não soma`)
              : null,
          ),
        ),
        el(
          'div',
          { class: 'acoes-item' },
          el(
            'button',
            {
              class: 'btn pequeno primario',
              type: 'button',
              disabled: !temEstoque || !peca || jaTem || estado.p.gold < (peca?.custo ?? 0),
              onClick: (ev) =>
                comBotao(ev.currentTarget, async () => {
                  const r = await mandar('/api/feiticeiro/infundir', { uid: peca.uid, feitico: f.id })
                  avisarBom(r.texto)
                  abrirFeiticeiro(peca.uid)
                }),
            },
            jaTem ? 'gravado' : 'Gravar',
          ),
        ),
      )
    }),
  )

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      'Arma e item secundário carregam um feitiço cada — gravar outro apaga o anterior, e por isso regravar custa 80% a mais. Os feitiços das duas peças equipadas valem juntos e somam com a habilidade da classe, mas o mesmo feitiço nas duas conta uma vez só.',
    ),
    el(
      'p',
      { style: 'margin-top:0' },
      'Em uso agora: ',
      emUso.length
        ? emUso.map((item, i) => [
            i ? ' + ' : '',
            forte(`${item.feiticoEmoji} ${item.feiticoNome}`),
            ` (${nomeDoSlot(item.slot).toLowerCase()})`,
          ])
        : el('span', { class: 'sussurro' }, 'nenhum feitiço nas peças equipadas.'),
    ),
    el(
      'div',
      { class: 'grade-dois' },
      el('div', {}, dados.pecas.length ? listaDePecas : vazio('Nenhuma arma ou item secundário na mochila.')),
      el(
        'div',
        {},
        el(
          'div',
          { class: 'rotulo-secao' },
          peca ? `Gravar em ${nomeDoItem(peca)} — ${num(peca.custo)} 💰` : 'Feitiços conhecidos',
        ),
        listaDeFeiticos,
      ),
    ),
  )

  abrirModal('Torre Arcana', corpo, { largura: 'amplo' })
}

// ================================================== E V O L U Ç Ã O

export async function abrirEvolucao(aba = 'rito') {
  const dados = await pegar('/api/evolucao')

  const abas = abasDoModal(
    [
      { id: 'rito', nome: 'O Rito' },
      { id: 'espelho', nome: 'Prova do Espelho' },
    ],
    aba,
    (id) => abrirEvolucao(id),
  )

  let corpo

  if (aba === 'rito') {
    const cabecalho = el(
      'div',
      { style: 'margin-bottom:14px' },
      el('p', { class: 'sussurro', style: 'margin-top:0' },
        'O Rito são três provas em sequência, todas espelhos de você mesmo — com até 90% dos seus atributos, mas sem as suas habilidades. A vida carrega de uma para a outra: só 25% do máximo volta entre elas.'),
      dados.motivoTexto ? el('p', { style: 'color:var(--erro)' }, dados.motivoTexto) : null,
      dados.custo
        ? el('p', {}, 'Custo: ', forte(`${num(dados.custo)} de gold`), ' — cobrado mesmo se você perder.')
        : null,
    )

    corpo = el(
      'div',
      {},
      cabecalho,
      dados.opcoes.length
        ? el(
            'div',
            { class: 'grade-dois' },
            ...dados.opcoes.map((op) =>
              el(
                'div',
                { class: 'bloco' },
                el('h4', {}, `${op.emoji} ${op.nome}`),
                op.habilidadeNova
                  ? el(
                      'p',
                      { style: 'margin:0 0 8px;font-size:14px' },
                      forte(`${op.habilidadeNova.emoji} ${op.habilidadeNova.nome}`),
                      ' — ',
                      op.habilidadeNova.resumo,
                    )
                  : null,
                el(
                  'div',
                  { style: 'font-size:13px;color:var(--texto-fraco);margin-bottom:10px' },
                  `Crescimento por nível: ${op.ganho.hp} HP · ${op.ganho.atq} ATQ · ${op.ganho.def} DEF · ${op.ganho.agi} AGI`,
                ),
                el(
                  'div',
                  { class: 'rotulo-secao' },
                  `As três provas (guardião: ${op.guardiao.emoji} ${op.guardiao.nome})`,
                ),
                el(
                  'div',
                  { style: 'font-size:13px;font-family:var(--mono);color:var(--texto-fraco);margin-bottom:12px' },
                  ...op.desafios.map((d) =>
                    el('div', {}, `nv${d.nivel} · ${num(d.hp)} HP · ${num(d.atq)} ATQ · ${num(d.def)} DEF`),
                  ),
                ),
                el(
                  'button',
                  {
                    class: 'btn primario largo',
                    type: 'button',
                    disabled: !dados.podeEncarar,
                    onClick: (ev) =>
                      comBotao(ev.currentTarget, async () => {
                        fecharModal()
                        const r = await mandar('/api/evolucao/encarar', { alvo: op.id })
                        await narrarRito(r.rito)
                      }),
                  },
                  'Encarar o Rito',
                ),
              ),
            ),
          )
        : vazio('Você chegou ao fim da árvore. Não há degrau acima deste.'),
    )
  } else {
    const e = dados.espelho
    corpo = el(
      'div',
      {},
      el(
        'p',
        { class: 'sussurro', style: 'margin-top:0' },
        'A Prova do Espelho leva de volta a uma classe inicial. Você mantém nível, XP, gold, mochila, chefes vencidos, titanitas, feitiços e os rankings — mas perde a árvore inteira e todas as habilidades acumuladas. Itens que a nova classe não sabe usar saem de uso, mas continuam na mochila.',
      ),
      el(
        'p',
        {},
        'Custo: ',
        forte(`${num(e.custo)} de gold`),
        ' (cobrado mesmo perdendo). Você luta contra um espectro seu — mesmos atributos, mesmas habilidades, e ele entra com a vida cheia.',
      ),
      e.espera > 0
        ? el('p', { style: 'color:var(--erro)' }, `O espelho ainda está trincado. Volte em ${duracao(e.espera)}.`)
        : null,
      el(
        'div',
        { class: 'grade-tres', style: 'margin-top:14px' },
        ...e.bases.map((c) =>
          el(
            'div',
            { class: 'bloco' },
            el('h4', {}, `${c.emoji} ${c.nome}`),
            el('p', { style: 'margin:0 0 10px;font-size:13.5px;color:var(--texto-fraco);font-style:italic' }, c.resumo),
            el(
              'button',
              {
                class: 'btn largo',
                type: 'button',
                disabled: e.espera > 0 || estado.p.gold < e.custo,
                onClick: () =>
                  confirmar(
                    'A Prova do Espelho',
                    `Virar ${c.nome} custa ${num(e.custo)} de gold e apaga todo o caminho de classe que você percorreu. Encarar o espectro?`,
                    async () => {
                      fecharModal()
                      const r = await mandar('/api/evolucao/espelho', { classe: c.id, confirmar: true })
                      await narrarEspelho(r.espelho)
                    },
                    'Encarar o espectro',
                  ),
              },
              'Virar ' + c.nome,
            ),
          ),
        ),
      ),
    )
  }

  abrirModal('O Rito de Evolução', corpo, { largura: 'amplo', abas })
}

async function narrarRito(rito) {
  limparNarrativa()
  definirCena('O Rito de Evolução')
  tituloDeCena(`O caminho de ${rito.alvo.emoji} ${rito.alvo.nome}`)
  sussurro(`Três provas em sequência. A vida carrega de uma para a outra. Custo pago: ${num(rito.custo)} de gold.`)

  for (const etapa of rito.etapas) {
    tituloDeCena(`${etapa.emoji ?? '🕯️'} ${etapa.nome} — nível ${etapa.nivel}`)
    await narrarLuta({
      nomeA: 'Você',
      hpA: etapa.hpInicial ?? etapa.hpMax,
      hpMaxA: etapa.hpMax,
      nomeB: etapa.nome,
      hpB: etapa.hpMaxInimigo,
      hpMaxB: etapa.hpMaxInimigo,
      log: etapa.log,
    })
    if (!etapa.venceu) {
      rico(forte('O Rito rejeitou você.', 'perigo'), ' Meia hora até poder tentar de novo.')
      break
    }
    rico(forte('Prova vencida.', 'cura'), ` Restaram ${num(etapa.hpFinal)} de vida.`)
  }

  if (rito.venceu) {
    tituloDeCena('Ascensão')
    rico(
      'Você não é mais ',
      forte(rito.anterior.nome),
      '. A partir de agora, ',
      forte(`${rito.alvo.emoji} ${rito.alvo.nome}`),
      '.',
    )
    avisarBom(`Você evoluiu para ${rito.alvo.nome}!`)
  }
}

async function narrarEspelho(espelho) {
  limparNarrativa()
  definirCena('A Prova do Espelho')
  tituloDeCena('🪞 O espectro')
  sussurro('Ele tem os seus atributos, as suas habilidades, e entra inteiro. Você entra como está.')

  await narrarLuta({
    nomeA: 'Você',
    hpA: espelho.hpInicial ?? estado.p.hpMax,
    hpMaxA: estado.p.hpMax,
    nomeB: 'Espectro',
    hpB: estado.p.hpMax,
    hpMaxB: estado.p.hpMax,
    log: espelho.log,
  })

  if (espelho.venceu) {
    rico('Você derrotou o próprio espectro. Agora é ', forte(`${espelho.atual.emoji} ${espelho.atual.nome}`), '.')
    if (espelho.tirados?.length) {
      sussurro(`Saiu de uso (mas continua na mochila): ${espelho.tirados.map(nomeDoItem).join(', ')}.`)
    }
    avisarBom(`Você agora é ${espelho.atual.nome}.`)
  } else {
    rico(forte('O espectro venceu.', 'perigo'), ` Você continua o que era. 24 horas até o espelho se refazer.`)
  }
}

// ================================================ E X P E D I Ç Ã O

export async function abrirExpedicao() {
  const dados = await pegar('/api/expedicao')

  let corpo

  if (dados.atual) {
    corpo = el(
      'div',
      {},
      el(
        'p',
        {},
        dados.atual.terminou
          ? 'Seu personagem voltou. Recolha o que ele trouxe.'
          : `Seu personagem está fora. Volta em ${duracao(dados.atual.restante)}.`,
      ),
      el(
        'button',
        {
          class: 'btn primario largo',
          type: 'button',
          disabled: !dados.atual.terminou,
          onClick: (ev) =>
            comBotao(ev.currentTarget, async () => {
              const r = await mandar('/api/expedicao/coletar')
              fecharModal()
              mostrarColeta(r.coleta)
            }),
        },
        dados.atual.terminou ? 'Recolher' : 'Ainda fora',
      ),
    )
  } else {
    corpo = el(
      'div',
      {},
      el(
        'p',
        { class: 'sussurro', style: 'margin-top:0' },
        'Rende menos por minuto do que caçar ativamente — a expedição é para quando você vai fechar o navegador, não um atalho. Enquanto está fora, o personagem não luta, não duela e não desce o Abismo.',
      ),
      el(
        'div',
        { class: 'grade-tres' },
        ...dados.opcoes.map((op) =>
          el(
            'div',
            { class: 'bloco' },
            el('h4', {}, `${op.emoji} ${op.nome}`),
            el('p', { style: 'margin:0 0 8px;font-size:13.5px;color:var(--texto-fraco);font-style:italic' }, op.resumo),
            linhaDeDado('Duração', duracao(op.minutos * 60000)),
            linhaDeDado('XP', `~${num(op.premio.xp)}`),
            linhaDeDado('Gold', `~${num(op.premio.gold)}`),
            linhaDeDado('Chance de item', `${Math.round(op.chanceDrop * 100)}%`),
            el(
              'button',
              {
                class: 'btn primario largo',
                type: 'button',
                style: 'margin-top:10px',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    const r = await mandar('/api/expedicao/enviar', { tipo: op.id })
                    avisarBom(r.texto)
                    fecharModal()
                  }),
              },
              'Partir',
            ),
          ),
        ),
      ),
    )
  }

  abrirModal('Expedições', corpo, { largura: 'amplo' })
}

function mostrarColeta(coleta) {
  limparNarrativa()
  definirCena('De volta')
  tituloDeCena(`${coleta.expedicao.emoji} ${coleta.expedicao.nome} concluída`)
  rico('Trouxe ', forte(`${num(coleta.premio.xp)} de XP`), ' e ', forte(`${num(coleta.premio.gold)} de gold`), '.')
  if (coleta.drop) {
    if (coleta.perdido) sussurro(`${nomeDoItem(coleta.drop)} veio junto, mas a mochila estava cheia — perdido.`)
    else rico('Trouxe também ', forte(nomeDoItem(coleta.drop)), ` — ${textoDeBonus(coleta.drop)}.`)
  }
  if (coleta.subiu?.length) rico(forte(`Subiu para o nível ${coleta.subiu.at(-1)}!`, 'cura'))
}

// ==================================================== A B I S M O

export async function abrirAbismo() {
  const dados = await pegar('/api/combate/abismo')
  const p = estado.p

  const bloqueio =
    p.nivel < dados.nivelMinimo
      ? `O Abismo só se abre a partir do nível ${dados.nivelMinimo}. Você é nível ${p.nivel}.`
      : dados.espera > 0
        ? `O Abismo se fecha por mais ${duracao(dados.espera)}.`
        : p.estados.ferido > 0
          ? 'Ninguém desce o Abismo ferido.'
          : null

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      'Um chefe por andar, sem cura cheia entre eles, até você cair — e você sempre cai. O que se mede é a profundidade. Cada andar é mais fundo e mais duro; ninguém entra num andar abaixo de 60% da vida. No fim, você sai ferido de qualquer jeito.',
    ),
    el(
      'div',
      { class: 'grade-dois', style: 'margin-bottom:14px' },
      el(
        'div',
        { class: 'bloco' },
        el('h4', {}, 'Seu recorde'),
        linhaDeDado('Andar mais fundo', dados.melhorAndar || '—'),
        linhaDeDado('Profundidade', dados.melhorAndar ? dados.profundidade : '—'),
        linhaDeDado('Descidas', num(p.abismo.descidas)),
        linhaDeDado('Andares no total', num(p.abismo.andaresTotais)),
      ),
      el(
        'div',
        { class: 'bloco' },
        el('h4', {}, 'Os mais fundos'),
        dados.ranking.length
          ? el(
              'table',
              { class: 'tabela' },
              el('tbody', {},
                ...dados.ranking.slice(0, 8).map((r, i) =>
                  el(
                    'tr',
                    { class: r.id === p.id ? 'eu' : '' },
                    el('td', {}, `${i + 1}.`),
                    el('td', {}, r.nome),
                    el('td', { class: 'num' }, `andar ${r.melhorAndar}`),
                  ),
                ),
              ),
            )
          : vazio('Ninguém desceu ainda.'),
      ),
    ),
    bloqueio
      ? el('p', { style: 'color:var(--erro);text-align:center' }, bloqueio)
      : el(
          'button',
          {
            class: 'btn primario largo',
            type: 'button',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                fecharModal()
                const r = await mandar('/api/combate/abismo')
                await narrarDescida(r.descida)
              }),
          },
          'Descer o Abismo',
        ),
  )

  abrirModal('O Abismo', corpo)
}

async function narrarDescida(descida) {
  limparNarrativa()
  definirCena('O Abismo')
  tituloDeCena('A descida')
  sussurro('Não há volta pelo mesmo caminho. Só se mede até onde deu.')

  for (const andar of descida.andares) {
    tituloDeCena(`Andar ${andar.andar} — ${andar.profundidade}`)
    await narrarLuta({
      nomeA: 'Você',
      hpA: andar.hpInicial,
      hpMaxA: andar.hpMax,
      nomeB: `${andar.inimigo.emoji} ${andar.inimigo.nome}`,
      hpB: andar.inimigo.hpMax,
      hpMaxB: andar.inimigo.hpMax,
      log: andar.log,
    })
    if (!andar.venceu) {
      rico(forte('Você caiu.', 'perigo'), ` O Abismo ficou com o andar ${andar.andar}.`)
      break
    }
  }

  tituloDeCena('O que sobe do fundo')
  rico(
    'Andares vencidos: ',
    forte(String(descida.vencidos)),
    descida.recorde ? el('span', { class: 'cura' }, '  — novo recorde!') : '',
  )
  rico('+', forte(num(descida.premio.xp)), ' de XP e +', forte(num(descida.premio.gold)), ' de gold.')

  for (const { item, perdido } of descida.itens) {
    if (perdido) sussurro(`${nomeDoItem(item)} ficou para trás — mochila cheia.`)
    else rico('Trouxe ', forte(nomeDoItem(item)), ` — ${textoDeBonus(item)}.`)
  }
  if (descida.materiais.titanitas.length) {
    sussurro(`Titanitas: ${descida.materiais.titanitas.map((t) => `${t.quantidade}× ${t.grau}`).join(', ')}.`)
  }
  if (descida.materiais.feiticos.length) {
    sussurro(`Feitiços encontrados: ${descida.materiais.feiticos.join(', ')}.`)
  }
  if (descida.subiu?.length) rico(forte(`Subiu para o nível ${descida.subiu.at(-1)}!`, 'cura'))
  sussurro('Você sai do Abismo carregado nos braços. Ferido, como sempre.')
}

// ======================================================== R A I D

export async function abrirRaid() {
  const dados = await pegar('/api/raid')
  const p = estado.p

  const corpoSala = (sala, minha) =>
    el(
      'div',
      { class: 'bloco', style: 'margin-bottom:10px' },
      el('h4', {}, `${sala.chefe.emoji} ${sala.chefe.nome}${sala.chefe.duro ? ' (escalão duro)' : ''}`),
      el('p', { style: 'margin:0 0 8px;font-size:13.5px;color:var(--texto-fraco);font-style:italic' }, sala.chefe.descricao ?? ''),
      linhaDeDado('Aberta por', sala.criadorNome),
      linhaDeDado('Jogadores', `${sala.participantes.length} / ${sala.maxJogadores} (mínimo ${sala.minJogadores})`),
      linhaDeDado('Nível médio', sala.nivelMedio),
      linhaDeDado('Expira em', duracao(sala.expiraEm - Date.now())),
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
                disabled: sala.criadorId !== p.id || sala.participantes.length < sala.minJogadores,
                title: sala.criadorId !== p.id ? 'Só quem abriu pode começar' : '',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    fecharModal()
                    // O resultado chega duas vezes nesta aba: pelo socket (que
                    // avisa todo o grupo) e pela resposta. Narra só a resposta.
                    estado.iniciandoRaid = true
                    try {
                      const r = await mandar('/api/raid/iniciar')
                      await narrarRaidCompleta(r.raid)
                    } finally {
                      estado.iniciandoRaid = false
                    }
                  }),
              },
              'Começar a raid',
            )
          : el(
              'button',
              {
                class: 'btn primario',
                type: 'button',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    await mandar('/api/raid/entrar', { id: sala.id })
                    abrirRaid()
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
                    await mandar('/api/raid/sair')
                    abrirRaid()
                  }),
              },
              'Sair da sala',
            )
          : null,
      ),
    )

  const outras = dados.salas.filter((s) => s.id !== dados.minhaSala?.id)

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      `De ${dados.minJogadores} a ${dados.maxJogadores} jogadores contra um chefe grande, resolvido de uma vez. Entrar não custa nada e a sala não retém nada de ninguém. Só a vida do chefe cresce com o tamanho do grupo — chamar mais gente ajuda porque o dano dele se espalha. De tempos em tempos ele acerta o grupo inteiro.`,
    ),
    dados.espera > 0
      ? el('p', { style: 'color:var(--erro)' }, `Você ainda se refaz da última raid: ${duracao(dados.espera)}.`)
      : null,
    dados.minhaSala ? el('div', { class: 'rotulo-secao' }, 'Sua sala') : null,
    dados.minhaSala ? corpoSala(dados.minhaSala, true) : null,
    el('div', { class: 'rotulo-secao', style: 'margin-top:14px' }, 'Salas abertas'),
    outras.length ? el('div', {}, ...outras.map((s) => corpoSala(s, false))) : vazio('Nenhuma outra sala aberta.'),
    dados.minhaSala
      ? null
      : el(
          'button',
          {
            class: 'btn primario largo',
            type: 'button',
            style: 'margin-top:12px',
            disabled: dados.espera > 0,
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                await mandar('/api/raid/abrir')
                abrirRaid()
              }),
          },
          'Abrir uma sala',
        ),
  )

  abrirModal('Raides', corpo, { nome: 'raid', aoRecarregar: abrirRaid })
}

/**
 * Narra uma luta de grupo inteira. Serve à raid e aos eventos de grupo, que
 * chegam no mesmo formato; o evento só troca o nome da cena e a abertura.
 */
export async function narrarRaidCompleta(raid, { cena = 'Raid', abertura = null } = {}) {
  limparNarrativa()
  definirCena(cena)
  tituloDeCena(`${raid.chefe.emoji} ${raid.chefe.nome}`)
  if (abertura) rico(abertura)
  sussurro(
    `${raid.participantes.length} ${raid.participantes.length > 1 ? 'aventureiros' : 'aventureiro'} · nível médio ${raid.nivelMedio} · o inimigo entra com ${num(raid.chefe.hpMax)} de vida e acerta o grupo inteiro a cada ${raid.chefe.areaCada} rodadas.`,
  )

  await narrarRaid({
    nomeDoChefe: `${raid.chefe.emoji} ${raid.chefe.nome}`,
    hpMaxDoChefe: raid.chefe.hpMax,
    log: raid.log,
  })

  if (!raid.venceu) {
    tituloDeCena('Derrota')
    rico(forte('O grupo foi derrotado.', 'perigo'), ` ${raid.chefe.nome} terminou com ${raid.hpRestanteDoChefe}% de vida.`)
    sussurro(
      raid.feridos === false
        ? 'Sem recompensa — voltem mais fortes.'
        : 'Todos ficaram feridos. Sem recompensa — voltem mais fortes.',
    )
    return
  }

  tituloDeCena('Espólio')
  for (const j of raid.porJogador) {
    rico(
      forte(j.personagem.nome),
      j.caiu ? el('span', { class: 'perigo' }, ' (caiu — 60%)') : '',
      `: +${num(j.xp)} XP, +${num(j.gold)} gold`,
      j.subiu?.length ? el('span', { class: 'cura' }, `  subiu para o nível ${j.subiu.at(-1)}`) : '',
    )
  }
  for (const d of raid.itens) {
    if (d.perdido) sussurro(`${d.personagem.nome} perdeu ${nomeDoItem(d.item)} — mochila cheia.`)
    else rico(forte(d.personagem.nome), ' recebeu ', forte(nomeDoItem(d.item)), ` — ${textoDeBonus(d.item)}.`)
  }
  for (const m of raid.materiais) {
    const partes = []
    if (m.titanita) partes.push(`${m.titanita.quantidade}× ${m.titanita.nome}`)
    if (m.feitico) partes.push(`feitiço de ${m.feitico.nome}`)
    if (partes.length) sussurro(`${m.personagem.nome}: ${partes.join(' e ')}.`)
  }
}

// ========================================================== P V P

export async function abrirPvp(aba = 'desafiar') {
  const dados = await pegar('/api/pvp')
  const p = estado.p

  const abas = abasDoModal(
    [
      { id: 'desafiar', nome: 'Desafiar' },
      { id: 'convites', nome: `Desafios (${dados.recebidos.length})` },
      { id: 'ranking', nome: 'Ranking' },
    ],
    aba,
    (id) => abrirPvp(id),
  )

  let corpo

  if (aba === 'desafiar') {
    const campoAposta = el('input', { type: 'number', min: '0', value: '0', style: 'max-width:130px' })

    corpo = el(
      'div',
      {},
      el(
        'p',
        { class: 'sussurro', style: 'margin-top:0' },
        'Duelo é treino: os dois entram com a vida cheia e ninguém sai ferido. Não dá XP nem item — mexe só no ranking e na aposta. Quem desafia vence o empate de agilidade na ordem de turno.',
      ),
      el(
        'div',
        { style: 'display:flex;align-items:center;gap:10px;margin-bottom:14px' },
        el('span', {}, 'Apostar:'),
        campoAposta,
        el('span', { class: 'sussurro' }, `você tem ${num(p.gold)} de gold`),
      ),
      el(
        'div',
        { class: 'lista' },
        ...dados.oponentes.map((o) =>
          el(
            'div',
            { class: 'linha-item' },
            el('div', { class: 'icone' }, o.classe?.emoji ?? '⚔️'),
            el(
              'div',
              { class: 'corpo' },
              el('div', { class: 'nome' }, o.nome),
              el(
                'div',
                { class: 'detalhe' },
                el('span', {}, `${o.classe?.nome ?? ''} nv ${o.nivel}`),
                el('span', {}, `${num(o.pontosPvp)} pts`),
                el('span', { class: 'sussurro' }, `sua chance: ~${o.chance}%`),
              ),
            ),
            el(
              'div',
              { class: 'acoes-item' },
              el(
                'button',
                {
                  class: 'btn pequeno primario',
                  type: 'button',
                  disabled: dados.espera > 0,
                  onClick: (ev) =>
                    comBotao(ev.currentTarget, async () => {
                      await mandar('/api/pvp/desafiar', {
                        alvo: o.id,
                        aposta: Number(campoAposta.value) || 0,
                      })
                      avisarBom(`Desafio enviado a ${o.nome}. Ele tem 3 minutos para responder.`)
                      abrirPvp('desafiar')
                    }),
                },
                'Desafiar',
              ),
            ),
          ),
        ),
      ),
    )
  } else if (aba === 'convites') {
    corpo = el(
      'div',
      {},
      el('div', { class: 'rotulo-secao' }, 'Desafios que chegaram'),
      dados.recebidos.length
        ? el(
            'div',
            { class: 'lista' },
            ...dados.recebidos.map((d) =>
              el(
                'div',
                { class: 'linha-item' },
                el('div', { class: 'icone' }, '⚔️'),
                el(
                  'div',
                  { class: 'corpo' },
                  el('div', { class: 'nome' }, `${d.desafiante.nome} desafiou você`),
                  el(
                    'div',
                    { class: 'detalhe' },
                    el('span', {}, d.aposta > 0 ? `valendo ${num(d.aposta)} de gold` : 'sem aposta'),
                    el('span', {}, `expira em ${duracao(d.expiraEm - Date.now())}`),
                  ),
                ),
                el(
                  'div',
                  { class: 'acoes-item' },
                  el(
                    'button',
                    {
                      class: 'btn pequeno primario',
                      type: 'button',
                      onClick: (ev) =>
                        comBotao(ev.currentTarget, async () => {
                          fecharModal()
                          const r = await mandar('/api/pvp/responder', { id: d.id, aceitar: true })
                          await narrarDuelo(r.duelo)
                        }),
                    },
                    'Aceitar',
                  ),
                  el(
                    'button',
                    {
                      class: 'btn pequeno',
                      type: 'button',
                      onClick: (ev) =>
                        comBotao(ev.currentTarget, async () => {
                          await mandar('/api/pvp/responder', { id: d.id, aceitar: false })
                          abrirPvp('convites')
                        }),
                    },
                    'Recusar',
                  ),
                ),
              ),
            ),
          )
        : vazio('Nenhum desafio esperando.'),
      el('div', { class: 'rotulo-secao', style: 'margin-top:16px' }, 'Desafios que você mandou'),
      dados.enviados.length
        ? el(
            'div',
            { class: 'lista' },
            ...dados.enviados.map((d) =>
              el(
                'div',
                { class: 'linha-item' },
                el('div', { class: 'icone' }, '⏳'),
                el(
                  'div',
                  { class: 'corpo' },
                  el('div', { class: 'nome' }, `Esperando ${d.desafiado.nome}`),
                  el('div', { class: 'detalhe' }, `expira em ${duracao(d.expiraEm - Date.now())}`),
                ),
              ),
            ),
          )
        : vazio('Você não mandou nenhum desafio.'),
    )
  } else {
    corpo = tabelaDeRanking(dados.ranking, 'pontosPvp', 'pts', p.id, () => abrirPvp(aba))
  }

  abrirModal('Arena dos Campeões', corpo, {
    abas,
    nome: 'pvp',
    aoRecarregar: () => abrirPvp(aba),
  })
}

export async function narrarDuelo(duelo) {
  limparNarrativa()
  definirCena('Arena dos Campeões')
  tituloDeCena('Duelo')
  sussurro(duelo.aposta > 0 ? `Valendo ${num(duelo.aposta)} de gold.` : 'Sem aposta — só orgulho e pontos.')

  await narrarLuta({
    nomeA: duelo.lados.a.nome,
    hpA: duelo.lados.a.hpMax,
    hpMaxA: duelo.lados.a.hpMax,
    nomeB: duelo.lados.b.nome,
    hpB: duelo.lados.b.hpMax,
    hpMaxB: duelo.lados.b.hpMax,
    log: duelo.log,
  })

  rico(
    forte(duelo.vencedor.nome, 'cura'),
    ' venceu',
    duelo.porDecisao ? ' por decisão (mais vida proporcional ao fim das 30 rodadas)' : '',
    ` e levou ${duelo.pontos} ponto(s).`,
  )
  if (duelo.aposta > 0) rico(forte(`+${num(duelo.aposta)} de gold`), ' para o vencedor.')
  if (duelo.sequencia > 1) sussurro(`${duelo.vencedor.nome} está em uma sequência de ${duelo.sequencia} vitórias.`)
}

// ==================================================== R A N K I N G S

/**
 * A tabela de um ranking. Cada linha abre o perfil do jogador; `voltar`
 * redesenha o painel de onde a pessoa saiu (o modal é um só).
 */
function tabelaDeRanking(lista, campo, sufixo, meuId, voltar = null) {
  if (!lista.length) return vazio('Ninguém por aqui ainda.')

  const tabela = el(
    'table',
    { class: 'tabela ranking' },
    el('thead', {}, el('tr', {},
      el('th', {}, '#'),
      el('th', {}, 'Aventureiro'),
      el('th', {}, 'Classe'),
      el('th', { style: 'text-align:right' }, sufixo),
    )),
    el('tbody', {},
      ...lista.map((r) =>
        el(
          'tr',
          {
            class: `clicavel${r.id === meuId ? ' eu' : ''}`,
            title: `Ver o perfil de ${r.nome}`,
            tabIndex: 0,
            onClick: () => abrirPerfil(r.id, { voltar, rotuloVoltar: 'Voltar ao ranking' }),
            onKeydown: (ev) => {
              if (ev.key === 'Enter') abrirPerfil(r.id, { voltar, rotuloVoltar: 'Voltar ao ranking' })
            },
          },
          el('td', {}, `${r.posicao}.`),
          // A estrela acompanha o nome em todos os rankings: quem prestigiou
          // está no nível 1 de novo, e sem ela a linha não faria sentido.
          el(
            'td',
            {},
            el(
              'span',
              { class: 'quem-ranking' },
              retrato(r, { classe: 'mini' }),
              el('span', { class: 'nome-link' }, r.nome),
              r.prestigio ? el('span', { class: 'estrela-prestigio' }, ` ⭐${r.prestigio}`) : null,
            ),
          ),
          el('td', {}, `${r.classe?.emoji ?? ''} ${r.classe?.nome ?? '—'} nv ${r.nivel}`),
          el('td', { class: 'num' }, num(r[campo] ?? r.nivel)),
        ),
      ),
    ),
  )

  return el('div', {}, el('p', { class: 'sussurro dica-ranking' }, 'Toque num aventureiro para ver o perfil dele.'), tabela)
}

export async function abrirRanking(aba = 'nivel') {
  const dados = await pegar('/api/ranking')
  const meuId = estado.p.id

  const abas = abasDoModal(
    [
      { id: 'nivel', nome: 'Nível' },
      { id: 'gold', nome: 'Gold' },
      { id: 'abismo', nome: 'Abismo' },
      { id: 'pvp', nome: 'PvP' },
      { id: 'prestigio', nome: 'Prestígio' },
      { id: 'masmorra', nome: 'Masmorra' },
    ],
    aba,
    (id) => abrirRanking(id),
  )

  const campos = {
    nivel: ['nivel', 'nível'],
    gold: ['gold', 'gold'],
    abismo: ['melhorAndar', 'andar'],
    pvp: ['pontosPvp', 'pontos'],
    prestigio: ['prestigio', '⭐'],
    masmorra: ['melhorMasmorra', 'andar'],
  }

  const [campo, sufixo] = campos[aba]
  abrirModal('Ranking do servidor', tabelaDeRanking(dados[aba], campo, sufixo, meuId, () => abrirRanking(aba)), {
    abas,
  })
}

// ================================================== P R E S T Í G I O

/**
 * O painel do prestígio: o que se ganha, o que se perde e o botão que não
 * tem volta. Tudo fica na tela antes do clique, de propósito.
 */
export async function abrirPrestigio() {
  const { prestigio: d } = await pegar('/api/prestigio')

  const linhaDeBonus = (rotulo, agora, depois) =>
    el(
      'div',
      { class: 'linha-dado' },
      el('div', { class: 'rotulo' }, rotulo),
      el(
        'div',
        { class: 'valor ouro' },
        `+${porcento(agora)}`,
        el('span', { class: 'sussurro' }, '  →  '),
        forte(`+${porcento(depois)}`, 'cura'),
      ),
    )

  const botao = el(
    'button',
    {
      class: 'btn primario largo',
      type: 'button',
      disabled: !d.pode,
      onClick: () =>
        confirmar(
          `Prestígio ${d.contador + 1}`,
          (d.classeAtual?.nome === d.classeDeVolta?.nome
            ? `Seu ${d.classeAtual?.nome ?? 'personagem'} volta ao nível 1. `
            : `Seu ${d.classeAtual?.nome ?? 'personagem'} volta ao nível 1 como ${d.classeDeVolta?.nome ?? 'classe base'}, perdendo a árvore de evolução e as habilidades dela. `) +
            'Itens, gold, titanitas, feitiços e os chefes já derrubados continuam com você — e o bônus de prestígio é ' +
            'para sempre. Isso não tem desfazer.',
          async () => {
            const r = await mandar('/api/prestigio')
            await narrarPrestigio(r.prestigiado)
          },
          'Prestigiar',
        ),
    },
    d.pode ? `Prestigiar — virar Prestígio ${d.contador + 1}` : 'Ainda não dá para prestigiar',
  )

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      `No nível ${num(d.nivelMinimo)} o caminho se fecha e recomeça: o personagem volta ao nível 1 e à classe base, e o ` +
        'contador de prestígio sobe. Cada ponto de prestígio vale para sempre, em todos os personagens que você prestigiar.',
    ),
    el(
      'div',
      { class: 'grade-dois' },
      el(
        'div',
        { class: 'bloco' },
        el('h4', {}, 'O que você mantém'),
        el(
          'ul',
          { class: 'lista-simples' },
          el('li', {}, 'Todos os itens, equipados e na mochila'),
          el('li', {}, 'Gold, titanitas e feitiços'),
          el('li', {}, 'Os chefes de marco já derrubados — a subida de volta não trava em nenhum'),
          el('li', {}, 'Ranking de PvP, recorde do Abismo e o histórico de vitórias'),
        ),
      ),
      el(
        'div',
        { class: 'bloco' },
        el('h4', {}, 'O que você perde'),
        el(
          'ul',
          { class: 'lista-simples' },
          // Quem chegou ao 250 sem evoluir não perde classe nenhuma.
          d.classeAtual?.nome === d.classeDeVolta?.nome
            ? el('li', {}, `Nada da árvore: você continua ${d.classeDeVolta?.nome ?? 'na classe base'}, porque nunca evoluiu`)
            : el('li', {}, `A classe ${d.classeAtual?.nome ?? ''}: você volta a ser ${d.classeDeVolta?.nome ?? 'a classe base'}`),
          el('li', {}, 'O nível, que volta para 1'),
          ...d.habilidadesPerdidas.map((h) => el('li', {}, `${h.emoji} ${h.nome}`)),
          el('li', { class: 'sussurro' }, 'Armas exclusivas da especialidade saem de uso, mas continuam na mochila'),
        ),
      ),
    ),
    el(
      'div',
      { class: 'bloco', style: 'margin-top:14px' },
      el('h4', {}, `Prestígio ${d.contador} → ${d.contador + 1}`),
      linhaDeBonus('Atributos da classe', d.agora.atributos, d.depois.atributos),
      linhaDeBonus('XP de tudo que você fizer', d.agora.xp, d.depois.xp),
      el(
        'p',
        { class: 'sussurro', style: 'margin-bottom:0' },
        'O bônus de atributos vale sobre o que a classe dá por nível — o equipamento continua valendo o que vale.',
      ),
    ),
    d.motivo ? el('p', { style: 'color:var(--erro)' }, d.motivo) : null,
    el('div', { style: 'margin-top:14px' }, botao),
  )

  abrirModal(
    d.contador ? `Prestígio ⭐${d.contador}` : 'Prestígio',
    corpo,
    { nome: 'prestigio', aoRecarregar: abrirPrestigio },
  )
}

/** A cena do recomeço, na coluna da aventura. */
export async function narrarPrestigio(feito) {
  fecharModal()
  limparNarrativa()
  definirCena('O Recomeço')
  tituloDeCena(`⭐ Prestígio ${feito.contador}`)
  rico(
    'O caminho de ',
    forte(feito.classeAntiga),
    ' chega ao fim. O que você aprendeu se desfaz, e o que você carrega continua nas suas mãos.',
  )
  rico(
    'Você volta a ser ',
    forte(feito.classe),
    ' no nível 1 — agora com ',
    forte(`+${porcento(feito.bonus.atributos)} de atributos`, 'cura'),
    ' e ',
    forte(`+${porcento(feito.bonus.xp)} de XP`, 'cura'),
    ', para sempre.',
  )
  if (feito.tirados.length) {
    sussurro(`Saiu de uso: ${feito.tirados.map((i) => i.nome).join(', ')} — a classe base não usa, mas continua na mochila.`)
  }
  sussurro('Os chefes que você já derrubou continuam derrubados: a subida de volta não trava em nenhum marco.')
}

// ==================================================== M E R C A D O

/**
 * A negociação entre jogadores.
 *
 * A loja compra por 70% e vende por 150% do valor de referência — é essa
 * margem que faz este painel valer a pena. Por isso cada linha mostra as duas
 * contas lado a lado: o valor de referência e o que a loja pagaria.
 */
export async function abrirMercado(aba = 'oferecer') {
  const dados = await pegar('/api/mercado')
  const p = estado.p

  const abas = abasDoModal(
    [
      { id: 'oferecer', nome: 'Oferecer' },
      { id: 'recebidas', nome: `Recebidas (${dados.recebidas.length})` },
      { id: 'enviadas', nome: `Enviadas (${dados.enviadas.length})` },
      { id: 'gold', nome: 'Enviar gold' },
    ],
    aba,
    (id) => abrirMercado(id),
  )

  const opcoesDeJogador = () =>
    el(
      'select',
      {},
      ...dados.jogadores.map((j) =>
        el('option', { value: j.id }, `${j.classe?.emoji ?? ''} ${j.nome} — ${j.classe?.nome ?? ''} nv ${j.nivel}`),
      ),
    )

  let corpo

  if (aba === 'oferecer') {
    if (!dados.jogadores.length) {
      corpo = vazio('Ninguém mais criou personagem neste servidor ainda.')
    } else {
      let escolhido = null
      const alvo = opcoesDeJogador()
      const preco = el('input', { type: 'number', min: '0', value: '0', style: 'max-width:150px' })

      const botao = el(
        'button',
        {
          class: 'btn primario',
          type: 'button',
          disabled: true,
          onClick: (ev) =>
            comBotao(ev.currentTarget, async () => {
              const r = await mandar('/api/mercado/oferecer', {
                alvo: alvo.value,
                uid: escolhido,
                preco: Number(preco.value) || 0,
              })
              avisarBom(r.texto)
              abrirMercado('enviadas')
            }),
        },
        'Oferecer',
      )

      const lista = el(
        'div',
        { class: 'lista' },
        ...dados.meusItens.map((item) => {
          const node = linhaDeItem(item, {
            detalhes: [
              el('span', { class: 'sussurro' }, `referência ~${num(item.referencia)} 💰`),
              el('span', { class: 'sussurro' }, `a loja pagaria ${num(item.naLoja)} 💰`),
            ],
            onClick: () => {
              escolhido = item.uid
              for (const outro of lista.children) outro.classList.remove('selecionada')
              node.classList.add('selecionada')
              // Sugere o valor de referência: é o número que os dois lados
              // conseguem conferir, e sai melhor que os 70% da loja.
              if (!Number(preco.value)) preco.value = String(item.referencia)
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
          `Escolha uma peça, diga para quem e por quanto. A oferta fica de pé por ${dados.ofertaMinutos} minutos e nada é retido: o item continua com você e o gold com a outra pessoa até o aceite. Preço 0 é presente — mas ainda precisa ser aceito, para ninguém receber item com a mochila cheia.`,
        ),
        el(
          'div',
          { style: 'display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px' },
          el('label', { class: 'campo', style: 'flex:1;min-width:200px;margin:0' }, el('span', {}, 'Para quem'), alvo),
          el('label', { class: 'campo', style: 'margin:0' }, el('span', {}, 'Preço em gold'), preco),
          botao,
        ),
        el('div', { class: 'rotulo-secao' }, 'O que você pode oferecer'),
        dados.meusItens.length
          ? lista
          : vazio('Nada para oferecer. Só equipamento que não está em uso entra em negociação.'),
      )
    }
  } else if (aba === 'recebidas') {
    corpo = dados.recebidas.length
      ? el(
          'div',
          { class: 'lista' },
          ...dados.recebidas.map((o) => {
            const detalhes = [
              el('span', { class: 'sussurro' }, `de ${o.vendedor.nome}`),
              el(
                'span',
                { style: o.presente ? 'color:var(--ok)' : 'color:var(--ouro-claro)' },
                o.presente ? 'presente' : `${num(o.preco)} 💰`,
              ),
              el('span', { class: 'sussurro' }, `expira em ${duracao(o.expiraEm - Date.now())}`),
            ]

            if (o.item) {
              detalhes.push(
                el('span', { class: 'sussurro' }, `referência ~${num(o.referencia)} 💰`),
                o.usavel
                  ? el('span', { class: 'sussurro' }, 'sua classe usa')
                  : el('span', { style: 'color:var(--erro)' }, 'sua classe não usa'),
              )
            }

            const aceitar = el(
              'button',
              {
                class: 'btn pequeno primario',
                type: 'button',
                disabled: !o.disponivel || p.gold < o.preco,
                title: !o.disponivel
                  ? 'O item não está mais disponível'
                  : p.gold < o.preco
                    ? 'Gold insuficiente'
                    : '',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    const r = await mandar('/api/mercado/responder', { id: o.id, aceitar: true })
                    avisarBom(r.texto)
                    abrirMercado('recebidas')
                  }),
              },
              'Aceitar',
            )

            const recusar = el(
              'button',
              {
                class: 'btn pequeno',
                type: 'button',
                onClick: (ev) =>
                  comBotao(ev.currentTarget, async () => {
                    await mandar('/api/mercado/responder', { id: o.id, aceitar: false })
                    abrirMercado('recebidas')
                  }),
              },
              'Recusar',
            )

            // O item pode ter sido vendido ou equipado depois da oferta: aí só
            // resta recusar, e a tela diz por quê antes de alguém tentar.
            return o.item
              ? linhaDeItem(o.item, { detalhes, acoes: [aceitar, recusar] })
              : el(
                  'div',
                  { class: 'linha-item' },
                  el('div', { class: 'icone' }, '❓'),
                  el(
                    'div',
                    { class: 'corpo' },
                    el('div', { class: 'nome' }, o.itemNome),
                    el(
                      'div',
                      { class: 'detalhe' },
                      el('span', { class: 'sussurro' }, `de ${o.vendedor.nome}`),
                      el('span', { style: 'color:var(--erro)' }, 'não está mais com quem ofereceu'),
                    ),
                  ),
                  el('div', { class: 'acoes-item' }, recusar),
                )
          }),
        )
      : vazio('Nenhuma oferta esperando você.')
  } else if (aba === 'enviadas') {
    corpo = dados.enviadas.length
      ? el(
          'div',
          { class: 'lista' },
          ...dados.enviadas.map((o) =>
            el(
              'div',
              { class: 'linha-item' },
              el('div', { class: 'icone' }, o.item?.emoji ?? '⏳'),
              el(
                'div',
                { class: 'corpo' },
                el('div', { class: 'nome' }, o.item ? nomeDoItem(o.item) : o.itemNome),
                el(
                  'div',
                  { class: 'detalhe' },
                  el('span', { class: 'sussurro' }, `esperando ${o.comprador.nome}`),
                  el(
                    'span',
                    { style: o.presente ? 'color:var(--ok)' : 'color:var(--ouro-claro)' },
                    o.presente ? 'presente' : `${num(o.preco)} 💰`,
                  ),
                  el('span', { class: 'sussurro' }, `expira em ${duracao(o.expiraEm - Date.now())}`),
                ),
              ),
              el(
                'div',
                { class: 'acoes-item' },
                el(
                  'button',
                  {
                    class: 'btn pequeno perigo',
                    type: 'button',
                    onClick: (ev) =>
                      comBotao(ev.currentTarget, async () => {
                        await mandar('/api/mercado/responder', { id: o.id, aceitar: false })
                        avisar('Oferta cancelada.')
                        abrirMercado('enviadas')
                      }),
                  },
                  'Cancelar',
                ),
              ),
            ),
          ),
        )
      : vazio('Você não tem oferta nenhuma de pé.')
  } else {
    const alvo = opcoesDeJogador()
    const quanto = el('input', { type: 'number', min: '1', value: '100', style: 'max-width:150px' })

    corpo = el(
      'div',
      {},
      el(
        'p',
        { class: 'sussurro', style: 'margin-top:0' },
        'Gold vai direto, sem aceite — ao contrário de um item, que ocupa espaço na mochila de quem recebe. Serve para acertar uma dívida, dividir o espólio de uma raid ou pagar por algo combinado no chat.',
      ),
      el(
        'div',
        { style: 'display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap' },
        el('label', { class: 'campo', style: 'flex:1;min-width:200px;margin:0' }, el('span', {}, 'Para quem'), alvo),
        el('label', { class: 'campo', style: 'margin:0' }, el('span', {}, 'Quanto'), quanto),
        el(
          'button',
          {
            class: 'btn primario',
            type: 'button',
            disabled: !dados.jogadores.length,
            onClick: () => {
              const valor = Number(quanto.value) || 0
              const nome = dados.jogadores.find((j) => j.id === alvo.value)?.nome ?? 'esse jogador'
              confirmar(
                'Enviar gold',
                `Enviar ${num(valor)} de gold para ${nome}? Transferência de gold não tem desfazer.`,
                async () => {
                  const r = await mandar('/api/mercado/pagar', { alvo: alvo.value, quanto: valor })
                  avisarBom(r.texto)
                },
                'Enviar',
              )
            },
          },
          'Enviar',
        ),
      ),
      el('p', { style: 'margin-top:14px' }, 'Você tem ', forte(`${num(p.gold)} de gold`), '.'),
    )
  }

  abrirModal('Mercado', corpo, {
    abas,
    largura: 'amplo',
    nome: 'mercado',
    aoRecarregar: () => abrirMercado(aba),
  })
}
