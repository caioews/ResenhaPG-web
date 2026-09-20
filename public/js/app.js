/**
 * O fio que amarra tudo: as três telas (entrada, personagens, jogo), a ficha
 * lateral, o menu de ações, o chat e os avisos que chegam pelo socket.
 */
import {
  $,
  abrirModal,
  aoMudarFicha,
  api,
  aplicarFicha,
  avisar,
  avisarBom,
  avisarErro,
  comBotao,
  confirmar,
  definirPersonagemAtivo,
  duracao,
  el,
  estado,
  fecharModal,
  hora,
  limpar,
  linhaDeBarra,
  linhaDeDado,
  mandar,
  modalAberto,
  nomeDoSlot,
  num,
  pct,
  pegar,
  personagemAtivo,
  recarregarPainel,
} from './nucleo.js'
import {
  definirCena,
  esperarNarracao,
  forte,
  limparNarrativa,
  linha,
  narrando,
  narrarLuta,
  rico,
  sussurro,
  tituloDeCena,
} from './narrativa.js'
import {
  abrirAbismo,
  abrirEvolucao,
  abrirExpedicao,
  abrirFerreiro,
  abrirFeiticeiro,
  abrirLoja,
  abrirMercado,
  abrirMochila,
  abrirPrestigio,
  abrirPvp,
  abrirRaid,
  abrirRanking,
  narrarDuelo,
  narrarRaidCompleta,
} from './paineis.js'
import { abrirEditorDeFoto, abrirFicha, abrirPerfil, retrato } from './perfil.js'
import {
  andarUmTrecho,
  entrarOMonstro,
  esperarEmPosicao,
  fimDaLuta,
  golpe,
  irCacar,
  mostrarTaberna,
  palcoEmBatalha,
  pessoasNaTaberna,
  prepararPalco,
} from './palco.js'
import {
  buscarEvento,
  configurarEventos,
  criarIndicador,
  eventoNaTela,
  fecharPopup,
  ouvirEventos,
} from './eventos.js'
import { alternarSom, destravarSom, somLigado, tocar } from './som.js'
import {
  abrirChefeMundial,
  abrirLeiloes,
  abrirMasmorra,
  abrirMissoes,
  buscarChefe,
  chefeAtual,
  configurarAventuras,
  ouvirAventuras,
} from './aventuras.js'

// ------------------------------------------------------------- telas

function mostrarTela(id) {
  for (const tela of document.querySelectorAll('.tela')) tela.classList.toggle('ativa', tela.id === id)
}

// =================================================== E N T R A D A

let modoDeEntrada = 'entrar'

function prepararEntrada() {
  const aviso = $('#aviso-entrada')

  for (const aba of document.querySelectorAll('#tela-entrada .aba')) {
    aba.addEventListener('click', () => {
      modoDeEntrada = aba.dataset.aba
      for (const outra of document.querySelectorAll('#tela-entrada .aba')) {
        outra.classList.toggle('ativa', outra === aba)
      }
      $('#campo-confirmar').hidden = modoDeEntrada === 'entrar'
      $('#botao-entrada').textContent = modoDeEntrada === 'entrar' ? 'Entrar' : 'Criar conta'
      $('#campo-senha').autocomplete = modoDeEntrada === 'entrar' ? 'current-password' : 'new-password'
      aviso.textContent = ''
    })
  }

  $('#form-entrada').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    aviso.className = 'aviso'
    aviso.textContent = ''

    const usuario = $('#campo-usuario').value.trim()
    const senha = $('#campo-senha').value

    if (modoDeEntrada === 'criar' && senha !== $('#campo-senha2').value) {
      aviso.className = 'aviso erro'
      aviso.textContent = 'As senhas não são iguais.'
      return
    }

    await comBotao($('#botao-entrada'), async () => {
      try {
        const caminho = modoDeEntrada === 'entrar' ? '/api/auth/entrar' : '/api/auth/registrar'
        const r = await api('POST', caminho, { usuario, senha })
        estado.usuario = r.usuario
        estado.personagens = r.personagens ?? []
        $('#campo-senha').value = ''
        $('#campo-senha2').value = ''
        await irParaPersonagens()
      } catch (e) {
        aviso.className = 'aviso erro'
        aviso.textContent = e.message
      }
    })
  })
}

// =============================================== P E R S O N A G E N S

async function irParaPersonagens() {
  const r = await pegar('/api/personagens')
  estado.personagens = r.personagens
  estado.maxPersonagens = r.maxPersonagens
  definirPersonagemAtivo(null)
  estado.p = null
  desenharPersonagens()
  mostrarTela('tela-personagens')
}

function desenharPersonagens() {
  $('#rotulo-conta').textContent = `Conta: ${estado.usuario?.nome ?? ''} · ${estado.personagens.length} de ${estado.maxPersonagens} personagens`

  const grade = limpar($('#grade-personagens'))

  for (const p of estado.personagens) {
    const carta = el(
      'button',
      {
        class: 'carta-personagem',
        type: 'button',
        onClick: () => entrarNoJogo(p.id),
      },
      retrato(p, { classe: 'carta' }),
      el(
        'div',
        { style: 'min-width:0' },
        el('div', { class: 'nome' }, p.nome),
        el(
          'div',
          { class: 'sub' },
          `${p.classe?.emoji ?? ''} ${p.classe?.nome ?? 'sem classe'} · nível ${p.nivel}`,
          p.prestigio ? el('span', { class: 'estrela-prestigio' }, ` ⭐${p.prestigio}`) : null,
        ),
        el(
          'div',
          { class: 'linha-dados' },
          el('span', {}, `❤️ ${num(p.hp)}/${num(p.hpMax)}`),
          el('span', {}, `💰 ${num(p.gold)}`),
          el('span', {}, `⚔️ ${num(p.vitorias)}V`),
          p.melhorAndar ? el('span', {}, `🕳️ andar ${p.melhorAndar}`) : null,
        ),
      ),
    )

    carta.append(
      el(
        'span',
        {
          class: 'apagar',
          title: 'Apagar personagem',
          role: 'button',
          onClick: (ev) => {
            ev.stopPropagation()
            pedirParaApagar(p)
          },
        },
        '✕',
      ),
    )

    grade.append(carta)
  }

  if (estado.personagens.length < estado.maxPersonagens) {
    grade.append(
      el(
        'button',
        { class: 'carta-personagem vazia', type: 'button', onClick: abrirCriacao },
        '+ Novo personagem',
      ),
    )
  }
}

function pedirParaApagar(p) {
  const campo = el('input', { type: 'text', placeholder: p.nome })

  const corpo = el(
    'div',
    {},
    el(
      'p',
      { style: 'margin-top:0' },
      `Apagar ${p.nome} (nível ${p.nivel}) apaga a mochila, o gold, os chefes vencidos e o ranking dele. Isso não tem desfazer.`,
    ),
    el('p', {}, 'Escreva o nome do personagem para confirmar:'),
    campo,
    el(
      'div',
      { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px' },
      el('button', { class: 'btn', type: 'button', onClick: fecharModal }, 'Cancelar'),
      el(
        'button',
        {
          class: 'btn perigo',
          type: 'button',
          onClick: (ev) =>
            comBotao(ev.currentTarget, async () => {
              const r = await api('DELETE', `/api/personagens/${p.id}`, { confirmacao: campo.value })
              estado.personagens = r.personagens
              desenharPersonagens()
              fecharModal()
              avisar('Personagem apagado.')
            }),
        },
        'Apagar para sempre',
      ),
    ),
  )

  abrirModal('Apagar personagem', corpo, { largura: 'estreito' })
}

async function abrirCriacao() {
  const { classes } = await pegar('/api/classes')
  let escolhida = null

  const campoNome = el('input', { type: 'text', maxlength: '18', placeholder: 'Nome do personagem' })
  const botaoCriar = el('button', { class: 'btn primario largo', type: 'button', disabled: true }, 'Criar personagem')
  const aviso = el('p', { class: 'aviso' })

  const cartas = classes.map((c) =>
    el(
      'button',
      {
        class: 'carta-classe',
        type: 'button',
        onClick: () => {
          escolhida = c.id
          for (const outra of cartas) outra.classList.toggle('escolhida', outra === cartas[classes.indexOf(c)])
          botaoCriar.disabled = !campoNome.value.trim()
        },
      },
      el('div', { class: 'cabeca' }, `${c.emoji} ${c.nome}`),
      el('div', { class: 'resumo' }, c.resumo),
      el(
        'div',
        { class: 'atributos-mini' },
        el('span', {}, `HP ${c.base.hp} (+${c.ganho.hp})`),
        el('span', {}, `ATQ ${c.base.atq} (+${c.ganho.atq})`),
        el('span', {}, `DEF ${c.base.def} (+${c.ganho.def})`),
        el('span', {}, `AGI ${c.base.agi} (+${c.ganho.agi})`),
      ),
      el('div', { class: 'atributos-mini', style: 'margin-top:6px' }, el('span', {}, `Usa: ${c.usa.join(', ')}`)),
      el(
        'div',
        { class: 'resumo', style: 'margin-top:8px;font-size:13px' },
        c.passiva
          ? [el('span', { style: 'color:var(--ouro-claro)' }, `${c.passiva.emoji} ${c.passiva.nome}: `), c.passiva.resumo]
          : el('span', { class: 'sussurro' }, 'Sem passiva: compensa em vida e defesa.'),
      ),
    ),
  )

  campoNome.addEventListener('input', () => {
    botaoCriar.disabled = !escolhida || !campoNome.value.trim()
  })

  botaoCriar.addEventListener('click', (ev) =>
    comBotao(ev.currentTarget, async () => {
      aviso.className = 'aviso'
      aviso.textContent = ''
      try {
        const r = await mandar('/api/personagens', { nome: campoNome.value.trim(), classe: escolhida })
        fecharModal()
        await entrarNoJogo(r.personagem.id, { novo: true })
      } catch (e) {
        aviso.className = 'aviso erro'
        aviso.textContent = e.message
      }
    }),
  )

  const corpo = el(
    'div',
    {},
    el('label', { class: 'campo' }, el('span', {}, 'Nome'), campoNome),
    el('div', { class: 'rotulo-secao' }, 'Escolha a classe inicial'),
    el(
      'p',
      { class: 'sussurro', style: 'margin-top:0' },
      'A classe define o ponto de partida e a inclinação do crescimento. Você poderá evoluir no nível 50 e, se quiser recomeçar o caminho, a Prova do Espelho leva de volta a qualquer classe inicial.',
    ),
    el('div', { class: 'grade-classes' }, ...cartas),
    el('div', { style: 'margin-top:16px' }, botaoCriar, aviso),
  )

  abrirModal('Novo personagem', corpo, { largura: 'amplo' })
}

// ========================================================= J O G O

let tickDeCooldown = null

async function entrarNoJogo(id, { novo = false } = {}) {
  definirPersonagemAtivo(id)

  try {
    const r = await pegar('/api/estado')
    aplicarFicha(r.personagem)
  } catch (e) {
    definirPersonagemAtivo(null)
    avisarErro(e)
    return irParaPersonagens()
  }

  mostrarTela('tela-jogo')
  montarMenuDeLugares()
  desenharFicha()

  limparNarrativa()
  definirCena('Taberna da Resenha')
  abrirOPalco()
  if (novo) {
    tituloDeCena(`${estado.p.classe.emoji} ${estado.p.nome}, ${estado.p.classe.nome}`)
    rico(
      'Você chega a Valkhar com ',
      forte(`${num(estado.p.gold)} de gold`),
      ' e nada mais. As ruínas não perguntam o seu nome — elas só contam quantos voltaram.',
    )
    // O gold inicial existe justamente para isso: sem uma arma, a primeira
    // caçada é cara ou coroa, e é frustrante descobrir isso perdendo.
    sussurro(
      'Passe na loja antes de sair. Sem arma nenhuma, a primeira criatura é cara ou coroa — ' +
        'um equipamento básico custa 40 de gold e muda a conta.',
    )
  } else {
    tituloDeCena('De volta à taberna')
    sussurro('A lareira está acesa e a mesa, posta. Descanse ou saia para caçar.')
  }

  conectarSocket()
  if (tickDeCooldown) clearInterval(tickDeCooldown)
  tickDeCooldown = setInterval(atualizarRelogios, 1000)
  buscarEvento()
  buscarChefe()
}

async function sairDoPersonagem() {
  if (tickDeCooldown) clearInterval(tickDeCooldown)
  fecharPopup()
  fecharChat()
  estado.socket?.disconnect()
  estado.socket = null
  await irParaPersonagens()
}

// ------------------------------------------------------------- palco

/** Liga o palco (cenário desenhado) e abre na taberna. */
async function abrirOPalco() {
  try {
    $('#palco').hidden = false
    await prepararPalco($('#palco'), { classe: classeBase() })
    await mostrarTaberna({ imediato: true })
    desenharAcoes()
  } catch (e) {
    // Sem arte o jogo continua inteiro: o palco é ilustração, não regra.
    $('#palco').hidden = true
    console.warn('palco indisponível:', e)
  }
}

/** A classe de origem do personagem — é o sprite que ele usa em cena. */
const classeBase = () => estado.p?.linhagem?.[0]?.id ?? estado.p?.classe?.id ?? null

// ------------------------------------------------------------- ficha

/** Se o botão de Prestígio estava no menu da última vez que ele foi montado. */
let menuComPrestigio = false

function desenharFicha() {
  const p = estado.p
  if (!p) return

  // O botão do Prestígio aparece no nível 250 e some depois do recomeço.
  if (Boolean(p.prestigio?.podeAgora) !== menuComPrestigio) montarMenuDeLugares()
  desenharSelos()

  const caixa = limpar($('#ficha'))

  caixa.append(
    el(
      'div',
      { class: 'ficha-cabeca' },
      // A foto abre direto o editor: é o jeito mais curto de trocar.
      el(
        'div',
        { class: 'ficha-cabeca-retrato' },
        retrato(p, {
          classe: 'medio',
          titulo: p.foto ? 'Trocar a foto' : 'Enviar uma foto',
          onClick: () => abrirEditorDeFoto(),
        }),
        p.foto ? el('span', { class: 'brasao-selo', title: p.classe?.nome ?? '' }, p.classe?.emoji ?? '⚔️') : null,
      ),
      el(
        'div',
        { style: 'min-width:0' },
        el('div', { class: 'nome' }, p.nome),
        el('div', { class: 'classe' }, `Nível ${p.nivel}`),
        el('div', { class: 'classe' }, `${p.classe?.emoji ?? ''} ${p.classe?.nome ?? 'sem classe'}`),
        p.prestigio?.contador
          ? el('div', { class: 'estrela-prestigio', title: `Prestígio ${p.prestigio.contador}` }, `⭐ Prestígio ${p.prestigio.contador}`)
          : null,
        p.foto ? null : el('div', { class: 'sussurro dica-foto' }, 'Toque no quadro para pôr uma foto'),
      ),
    ),
    linhaDeBarra('HP', 'vida', p.hp, p.hpMax),
    linhaDeBarra('XP', 'xp', p.xp, p.xpParaSubir, `${num(p.xp)} / ${num(p.xpParaSubir)}`),
    el('div', { class: 'separador' }),
    linhaDeDado('💰 Ouro', num(p.gold), 'ouro'),
    linhaDeDado('⚔️ Ataque', num(p.atributos.atq)),
    linhaDeDado('🛡️ Defesa', num(p.atributos.def)),
    linhaDeDado('🥾 Agilidade', num(p.atributos.agi)),
  )

  // Estados que mudam o que dá para fazer agora.
  const avisos = el('div', { style: 'display:flex;flex-direction:column;gap:5px' })
  if (p.boss.pendente) {
    avisos.append(
      el(
        'div',
        { class: 'aviso-estado boss' },
        `Nível travado no marco ${p.boss.pendente}. Derrube ${p.boss.chefe?.emoji ?? ''} ${p.boss.chefe?.nome ?? 'o chefe'} para voltar a subir.`,
      ),
    )
  }
  if (p.estados.ferido > 0) {
    avisos.append(el('div', { class: 'aviso-estado ferido', dataset: { relogio: 'ferido' } }, ''))
  }
  if (p.estados.descansando > 0) {
    avisos.append(el('div', { class: 'aviso-estado descanso', dataset: { relogio: 'descanso' } }, ''))
  }
  if (p.estados.expedicao) {
    avisos.append(el('div', { class: 'aviso-estado expedicao', dataset: { relogio: 'expedicao' } }, ''))
  }
  if (avisos.children.length) caixa.append(el('div', { class: 'separador' }), avisos)

  caixa.append(
    el('div', { class: 'separador' }),
    el('div', { class: 'rotulo-secao' }, 'Equipado'),
    ...Object.entries(p.equipado).map(([slot, item]) =>
      el(
        'div',
        { class: `slot-equipado${item ? '' : ' vazio'}` },
        el('div', { class: 'icone' }, item?.emoji ?? '·'),
        el(
          'div',
          { class: 'texto' },
          item ? `${item.nome}${item.reforco ? ` +${item.reforco}` : ''}` : `${nomeDoSlot(slot)} — vazio`,
        ),
      ),
    ),
  )

  const materiais = Object.values(p.titanitas).filter((t) => t.quantidade > 0)
  const feiticos = p.feiticos ?? []
  if (materiais.length || feiticos.length) {
    caixa.append(
      el('div', { class: 'separador' }),
      el('div', { class: 'rotulo-secao' }, 'Materiais'),
      el(
        'div',
        { style: 'font-size:13px;color:var(--texto-fraco);line-height:1.7' },
        [
          ...materiais.map((t) => `${t.emoji} ${t.quantidade}`),
          ...feiticos.map((f) => `${f.emoji} ${f.quantidade}`),
        ].join('   ') || '—',
      ),
    )
  }

  desenharAcoes()
  atualizarRelogios()
}

// ------------------------------------------------------------ ações

function desenharAcoes() {
  const p = estado.p
  const caixa = limpar($('#acoes'))

  const bloqueado =
    p.estados.expedicao
      ? 'em expedição'
      : p.estados.ferido > 0
        ? 'ferido'
        : null

  const itens = []

  if (p.boss.pendente) {
    itens.push({
      rotulo: `Enfrentar ${p.boss.chefe?.emoji ?? ''} ${p.boss.chefe?.nome ?? 'o chefe'}`,
      nota: `nível ${p.boss.chefe?.nivel ?? ''} · destrava o nível`,
      desabilitado: Boolean(bloqueado) || p.cooldowns.luta > 0,
      acao: enfrentarChefe,
    })
  }

  itens.push({
    rotulo: 'Caçar',
    nota: p.cooldowns.luta > 0 ? `${Math.ceil(p.cooldowns.luta / 1000)}s` : bloqueado ?? '',
    desabilitado: Boolean(bloqueado) || p.cooldowns.luta > 0,
    acao: cacar,
    relogio: 'luta',
  })

  if (palcoEmBatalha()) {
    itens.push({
      rotulo: 'Voltar para a taberna',
      nota: 'a lareira, a mesa e quem estiver on-line',
      acao: voltarParaTaberna,
    })
  }

  itens.push({
    rotulo: p.estados.descansando > 0 ? 'Levantar da fogueira' : 'Descansar na fogueira',
    nota: p.estados.descansando > 0 ? 'a vida está subindo' : 'a vida sobe até encher',
    desabilitado: Boolean(p.estados.expedicao) || (p.estados.descansando === 0 && p.hp >= p.hpMax),
    acao: p.estados.descansando > 0 ? levantar : descansar,
  })

  const pocao = p.inventario.find((i) => i.consumivel && i.cura)
  const bandagem = p.inventario.find((i) => i.consumivel && i.tiraFerimento)

  if (p.estados.ferido > 0 && bandagem) {
    itens.push({
      rotulo: `Usar ${bandagem.nome}`,
      nota: 'tira o ferimento na hora',
      acao: () => usarConsumivel(bandagem),
    })
  }
  if (pocao) {
    itens.push({
      rotulo: `Beber ${pocao.nome}`,
      nota: `recupera ${Math.round(pocao.cura * 100)}% da vida`,
      desabilitado: p.hp >= p.hpMax,
      acao: () => usarConsumivel(pocao),
    })
  }

  itens.push({
    rotulo: p.estados.expedicao ? 'Ver a expedição' : 'Partir em expedição',
    nota: p.estados.expedicao ? '' : 'ganha XP com o navegador fechado',
    acao: abrirExpedicao,
  })

  itens.push({
    rotulo: 'Descer o Abismo',
    nota:
      p.nivel < 40
        ? 'a partir do nível 40'
        : p.cooldowns.abismo > 0
          ? `fechado por ${duracao(p.cooldowns.abismo)}`
          : 'sem volta, só profundidade',
    desabilitado: p.nivel < 40 || p.cooldowns.abismo > 0 || Boolean(bloqueado),
    acao: abrirAbismo,
    relogio: 'abismo',
  })

  itens.forEach((item, i) => {
    caixa.append(
      el(
        'button',
        {
          class: 'acao',
          type: 'button',
          disabled: item.desabilitado,
          dataset: item.relogio
            ? { relogio: item.relogio, esperando: (p.cooldowns[item.relogio] ?? 0) > 0 ? '1' : '0' }
            : {},
          onClick: (ev) => comBotao(ev.currentTarget, item.acao),
        },
        el('span', { class: 'tecla' }, `[${i + 1}]`),
        el('span', { class: 'rotulo' }, item.rotulo),
        item.nota ? el('span', { class: 'nota' }, item.nota) : null,
      ),
    )
  })
}

/** Teclas 1..9 disparam a ação da mesma posição, como no menu de texto. */
function prepararTeclado() {
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      // Fecha o que está mais por cima: o pop-up de evento, o painel, o chat.
      if (eventoNaTela()) return fecharPopup()
      if (modalAberto()) return fecharModal()
      if (chatAberto()) return fecharChat()
    }
    if (ev.target.matches('input, textarea')) return
    if (!/^[1-9]$/.test(ev.key)) return
    if (modalAberto() || narrando()) return

    const botoes = document.querySelectorAll('#acoes .acao')
    const botao = botoes[Number(ev.key) - 1]
    if (botao && !botao.disabled) botao.click()
  })
}

// ------------------------------------------------------- as ações em si

async function cacar() {
  const r = await mandar('/api/combate/cacar')
  await entrarEmCena(r.encontro)
  await mostrarEncontro(r.encontro, r.travado)
}

async function enfrentarChefe() {
  const r = await mandar('/api/combate/chefe')
  await entrarEmCena(r.encontro)
  await mostrarEncontro(r.encontro, false)
}

/**
 * A ida até o bicho: da taberna, o personagem atravessa a tela andando; já
 * nas ruínas, caminha só mais um trecho. Depois o monstro entra pela direita.
 */
async function entrarEmCena(encontro) {
  // O palco é ilustração: se algo nele falhar, a caçada acontece do mesmo
  // jeito — o log é que conta a história.
  try {
    if (!palcoEmBatalha()) {
      definirCena('Ruínas de Valkhar')
      await irCacar(classeBase())
      desenharAcoes()
    } else {
      andarUmTrecho()
    }
    await entrarOMonstro(encontro.monstro.id)
    await esperarEmPosicao()
  } catch (e) {
    console.warn('palco:', e)
  }
}

/** Volta para a taberna: o mesmo fade, no sentido contrário. */
async function voltarParaTaberna() {
  // No meio de uma luta a volta limparia o log do que ainda está sendo
  // contado. Espera acabar.
  if (narrando()) return avisar('Termine a luta primeiro.')
  await mostrarTaberna().catch((e) => console.warn('palco:', e))
  definirCena('Taberna da Resenha')
  limparNarrativa()
  tituloDeCena('De volta à taberna')
  sussurro('Você empurra a porta, o calor da lareira bate no rosto e alguém já pediu outra rodada.')
  desenharAcoes()
}

async function mostrarEncontro(e, travado) {
  limparNarrativa()

  const m = e.monstro
  const titulo = m.boss ? `${m.emoji} ${m.nome}` : `${m.emoji} ${m.nome}${m.elite ? ' (elite)' : ''}`
  tituloDeCena(`${titulo} — nível ${m.nivel}`)

  if (m.boss) {
    sussurro('O chefe do marco espera. Ele luta três níveis acima de você, e não é um saco de pancada.')
  } else if (m.elite) {
    sussurro('Esse veio diferente: três níveis acima e um quarto mais forte em tudo.')
  } else {
    sussurro('Surge das sombras, pronto para atacar.')
  }

  await narrarLuta({
    // No PvE o log chama o jogador de "Você" — o placar acompanha, senão a
    // barra diria "Sombra" e o texto logo abaixo diria outra coisa.
    nomeA: 'Você',
    hpA: e.hpInicial,
    hpMaxA: e.hpMax,
    nomeB: `${m.emoji} ${m.nome}`,
    hpB: m.hpMax,
    hpMaxB: m.hpMax,
    log: e.log,
    aoEntrada: golpe,
  })

  fimDaLuta({ venceu: e.venceu })
  tituloDeCena(e.venceu ? 'Vitória' : 'Derrota')

  if (!e.venceu) {
    rico(
      forte(`${m.nome} venceu.`, 'perigo'),
      e.goldPerdido ? ` Você perdeu ${num(e.goldPerdido)} de gold no caminho de volta.` : '',
    )
    sussurro('Ferido por 5 minutos. Uma bandagem resolve na hora; a fogueira, com paciência.')
    return
  }

  rico('+', forte(num(e.xp)), ' de XP e +', forte(num(e.gold)), ' de gold.',
    e.goldDeSaque > 0 ? el('span', { class: 'sussurro' }, `  (${num(e.goldDeSaque)} vieram do saque)`) : '')

  if (e.porDecisao) sussurro('Venceu por decisão: as 30 rodadas acabaram e você tinha mais vida proporcional.')
  if (e.bossVencido) rico(forte('O marco caiu.', 'cura'), ' Seu nível voltou a subir.')
  if (e.subiuPara.length) rico(forte(`Subiu para o nível ${e.subiuPara.at(-1)}!`, 'cura'))
  else if (travado) sussurro('O XP entrou, mas o nível continua travado até o chefe cair.')

  if (e.drop) {
    if (e.mochilaCheia) sussurro(`${e.drop.nome} caiu, mas a mochila está cheia — perdido.`)
    else rico('Caiu ', forte(e.drop.nomeCompleto ?? e.drop.nome), '.')
  }
  if (e.titanita) sussurro(`Titanita: ${e.titanita.quantidade}× ${e.titanita.grau}.`)
  if (e.feitico) rico('Encontrou um feitiço de ', forte(e.feitico), '.')
}

async function descansar() {
  const r = await mandar('/api/combate/fogueira')
  linha(
    `Você acende uma fogueira. A vida sobe aos poucos e enche em ${duracao(r.terminaEm - Date.now())} — ` +
      'levantar antes da hora não perde o que já subiu, só para de subir.',
    'sussurro',
  )
}

async function levantar() {
  const r = await mandar('/api/combate/levantar')
  linha(
    r.descansoCompleto
      ? 'Você levanta inteiro. A fogueira apaga sozinha.'
      : `Você levanta antes da hora, com ${num(estado.p.hp)} de ${num(estado.p.hpMax)} de vida.`,
    'sussurro',
  )
}

async function usarConsumivel(item) {
  const r = await mandar('/api/mochila/usar', { uid: item.uid })
  linha(r.texto, 'sussurro')
}

// ------------------------------------------------------ menu de lugares

/** Acrescenta um selo (contador) vazio a um botão do menu. */
function comSelo(botao, id) {
  botao.append(el('span', { class: 'selo', id, hidden: true }, ''))
  return botao
}

/**
 * O botão do chefe mundial: sempre no menu, e aceso (com a vida que falta)
 * enquanto ele está no ar.
 */
function botaoDoChefe() {
  const botao = el(
    'button',
    { class: 'lugar', id: 'botao-chefe', type: 'button', onClick: (ev) => comBotao(ev.currentTarget, abrirChefeMundial) },
    el('span', { class: 'icone' }, '👹'),
    el('span', { class: 'rotulo-chefe' }, 'Chefe Mundial'),
    el('span', { class: 'selo', hidden: true }, ''),
  )
  queueMicrotask(() => desenharBotaoDoChefe(chefeAtual()))
  return botao
}

function desenharBotaoDoChefe(c) {
  const botao = $('#botao-chefe')
  if (!botao) return
  const ativo = Boolean(c?.ativo)
  botao.classList.toggle('lugar-evento', ativo)
  botao.querySelector('.rotulo-chefe').textContent = ativo ? `${c.chefe.emoji} ${c.chefe.nome}` : 'Chefe Mundial'
  const selo = botao.querySelector('.selo')
  selo.hidden = !ativo
  if (ativo) selo.textContent = `${Math.ceil((c.vida / c.vidaMax) * 100)}%`
}

/** Os contadores do menu que dependem da ficha. */
function desenharSelos() {
  const p = estado.p
  const missoes = $('#selo-missoes')
  if (missoes) {
    missoes.hidden = !p?.missoes?.prontas
    missoes.textContent = String(p?.missoes?.prontas ?? '')
  }
  const leilao = $('#selo-leilao')
  if (leilao) {
    leilao.hidden = !p?.entregas
    leilao.textContent = String(p?.entregas ?? '')
    leilao.title = 'Itens esperando para retirar'
  }
}

function montarMenuDeLugares() {
  const menu = limpar($('#menu-lugares'))

  const lugar = (icone, nome, acao, selo = null) =>
    el(
      'button',
      { class: 'lugar', type: 'button', onClick: (ev) => comBotao(ev.currentTarget, acao) },
      el('span', { class: 'icone' }, icone),
      el('span', {}, nome),
      selo ? el('span', { class: 'selo' }, selo) : null,
    )

  const botaoDeSom = el(
    'button',
    {
      class: 'lugar',
      type: 'button',
      title: 'Liga e desliga os alertas sonoros',
      onClick: () => {
        alternarSom()
        desenharBotaoDeSom()
      },
    },
    el('span', { class: 'icone' }),
    el('span', {}, 'Som'),
  )
  const desenharBotaoDeSom = () => {
    botaoDeSom.querySelector('.icone').textContent = somLigado() ? '🔊' : '🔇'
    botaoDeSom.classList.toggle('desligado', !somLigado())
  }
  desenharBotaoDeSom()

  menuComPrestigio = Boolean(estado.p?.prestigio?.podeAgora)

  // O filtro tira o botão do Prestígio quando ele não existe: `append(null)`
  // escreveria "null" na tela.
  const itens = [
    criarIndicador(),
    // Só existe quando o personagem chega ao teto: é o botão do recomeço.
    menuComPrestigio
      ? el(
          'button',
          { class: 'lugar lugar-prestigio', type: 'button', onClick: (ev) => comBotao(ev.currentTarget, abrirPrestigio) },
          el('span', { class: 'icone' }, '⭐'),
          el('span', {}, 'Prestígio'),
        )
      : null,
    lugar('📜', 'Status do personagem', abrirFicha),
    comSelo(lugar('📋', 'Missões do dia', abrirMissoes), 'selo-missoes'),
    botaoDoChefe(),
    lugar('🎒', 'Mochila', abrirMochila),
    lugar('💰', 'Loja', () => abrirLoja()),
    el(
      'div',
      { class: 'dupla-lugares' },
      lugar('🤝', 'Mercado', () => abrirMercado()),
      comSelo(lugar('⚖️', 'Leilões', () => abrirLeiloes()), 'selo-leilao'),
    ),
    lugar('⚒️', 'Ferreiro', abrirFerreiro),
    lugar('🔮', 'Feiticeiro', () => abrirFeiticeiro()),
    lugar('✨', 'O Rito', () => abrirEvolucao()),
    lugar('🏆', 'Ranking', () => abrirRanking()),
    el(
      'div',
      { class: 'dupla-lugares' },
      lugar('💀', 'Raid', abrirRaid),
      lugar('⚔️', 'PvP', () => abrirPvp()),
    ),
    lugar('🏰', 'Masmorra em grupo', abrirMasmorra),
    el(
      'div',
      { class: 'fileira-lugares', style: 'margin-top:4px' },
      el(
        'button',
        { class: 'lugar', id: 'botao-chat', type: 'button', onClick: abrirChat },
        el('span', { class: 'icone' }, '💬'),
        el('span', {}, 'Chat'),
        el('span', { class: 'selo', id: 'selo-chat', hidden: true }, ''),
      ),
      botaoDeSom,
      el(
        'button',
        { class: 'lugar', type: 'button', onClick: sairDoPersonagem },
        el('span', { class: 'icone' }, '🚪'),
        el('span', {}, 'Trocar'),
      ),
    ),
  ]
  menu.append(...itens.filter(Boolean))
}

// ------------------------------------------------ chat por cima (celular)

/**
 * Em tela estreita o chat não cabe ao lado do jogo: ele abre por cima, e o
 * botão que o abriu fica escondido embaixo. Por isso o chat tem o próprio
 * botão de fechar (e o Esc) — e o botão do menu conta as mensagens que
 * chegaram enquanto ele estava fechado.
 */
let naoLidas = 0

/** O chat está visível? Na tela larga ele sempre está, na estreita só aberto. */
const chatVisivel = () => getComputedStyle($('#coluna-chat')).display !== 'none'
const chatAberto = () => $('#coluna-chat').classList.contains('visivel')

function marcarNaoLidas(n) {
  naoLidas = n
  const selo = $('#selo-chat')
  if (!selo) return
  selo.hidden = naoLidas === 0
  selo.textContent = naoLidas > 99 ? '99+' : String(naoLidas)
}

function abrirChat() {
  $('#coluna-chat').classList.add('visivel')
  marcarNaoLidas(0)
  const caixa = $('#chat-corpo')
  caixa.scrollTop = caixa.scrollHeight
}

function fecharChat() {
  $('#coluna-chat').classList.remove('visivel')
}

// ---------------------------------------------------------- relógios

/**
 * Os cooldowns e os estados são timestamps, não temporizadores — o servidor
 * manda quanto falta e a tela só conta para trás. Se a aba ficar horas
 * aberta, o próximo pedido corrige tudo sozinho.
 */
function atualizarRelogios() {
  const p = estado.p
  if (!p) return

  const passo = 1000
  p.estados.ferido = Math.max(0, p.estados.ferido - passo)
  p.estados.descansando = Math.max(0, p.estados.descansando - passo)
  p.cooldowns.luta = Math.max(0, p.cooldowns.luta - passo)
  p.cooldowns.abismo = Math.max(0, p.cooldowns.abismo - passo)
  p.cooldowns.pvp = Math.max(0, p.cooldowns.pvp - passo)
  p.cooldowns.raid = Math.max(0, p.cooldowns.raid - passo)
  if (p.estados.expedicao) {
    p.estados.expedicao.restante = Math.max(0, p.estados.expedicao.restante - passo)
  }

  // A fogueira sobe em rampa: a mesma conta que o servidor faz em
  // vidaAtual(), refeita a cada segundo para a barra subir na tela em vez de
  // dar um salto no fim.
  const fogueira = p.estados.fogueira
  if (fogueira && fogueira.duracao > 0) {
    const andado = Math.min(1, (fogueira.duracao - p.estados.descansando) / fogueira.duracao)
    p.hp = Math.round(fogueira.hpNoInicio + (p.hpMax - fogueira.hpNoInicio) * andado)
    atualizarBarraDeVida()
  }

  // O que precisa ser refeito depois da volta, não no meio dela: redesenhar
  // ou buscar a ficha aqui dentro abortaria o resto dos avisos.
  let redesenharMenu = false

  for (const node of document.querySelectorAll('[data-relogio]')) {
    const tipo = node.dataset.relogio

    if (tipo === 'ferido') {
      node.textContent = `Ferido — se recupera em ${duracao(p.estados.ferido)}.`
    } else if (tipo === 'descanso') {
      node.textContent =
        `Descansando na fogueira — ${num(p.hp)}/${num(p.hpMax)} de vida, ` +
        `cheia em ${duracao(p.estados.descansando)}.`
    } else if (tipo === 'expedicao') {
      const e = p.estados.expedicao
      node.textContent = e?.restante
        ? `${e.emoji} ${e.nome} — volta em ${duracao(e.restante)}.`
        : `${e?.emoji ?? '🗺️'} Voltou da expedição. Recolha o que trouxe.`
    } else if (node.classList.contains('acao')) {
      const falta = p.cooldowns[tipo] ?? 0
      const nota = node.querySelector('.nota')

      if (falta > 0) {
        node.disabled = true
        if (nota) nota.textContent = duracao(falta)
      } else if (node.dataset.esperando === '1') {
        // A espera DESTA ação acabou — e só dela. Um botão desabilitado por
        // outro motivo (nível baixo, sem gold) não significa nada aqui.
        node.dataset.esperando = '0'
        redesenharMenu = true
      }
    }
  }

  // Estado que acabou muda o menu inteiro, e o valor que vale é o do
  // servidor: melhor buscar a ficha do que adivinhar.
  const estadoAcabou =
    (p.estados.ferido === 0 && document.querySelector('[data-relogio="ferido"]')) ||
    (p.estados.descansando === 0 && document.querySelector('[data-relogio="descanso"]'))

  if (estadoAcabou) atualizarFicha()
  else if (redesenharMenu) desenharAcoes()
}

/**
 * Atualiza a barra de vida no lugar, sem redesenhar a ficha inteira — que
 * perderia a rolagem e piscaria a cada segundo do descanso.
 */
function atualizarBarraDeVida() {
  const p = estado.p
  const alvo = document.querySelector('#ficha .barra.vida')
  if (!alvo || !p) return
  alvo.querySelector('.preenchida').style.width = `${pct(p.hp, p.hpMax)}%`
  alvo.querySelector('.rotulo').textContent = `${num(p.hp)} / ${num(p.hpMax)}`
}

async function atualizarFicha() {
  try {
    const r = await pegar('/api/estado')
    aplicarFicha(r.personagem)
  } catch {
    // Rede oscilou: a próxima ação corrige.
  }
}

// ------------------------------------------------------------- chat

function conectarSocket() {
  if (estado.socket) {
    estado.socket.emit('entrar', estado.p.id)
    return
  }

  const socket = io()
  estado.socket = socket

  socket.on('connect', () => socket.emit('entrar', estado.p.id))

  socket.on('chat:historico', (mensagens) => {
    const caixa = limpar($('#chat-corpo'))
    for (const m of mensagens) caixa.append(linhaDeChat(m))
    caixa.scrollTop = caixa.scrollHeight
  })

  socket.on('chat:mensagem', (m) => {
    const caixa = $('#chat-corpo')
    const perto = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 80
    caixa.append(linhaDeChat(m))
    if (perto) caixa.scrollTop = caixa.scrollHeight
    if (!chatVisivel() && m.autor !== estado.p?.nome) marcarNaoLidas(naoLidas + 1)
  })

  socket.on('jogadores:online', (lista) => {
    pessoasNaTaberna(
      lista.map((j) => ({ id: j.id, nome: j.nome, classe: j.classeBase, eu: j.id === estado.p?.id })),
    )
    const caixa = limpar($('#lista-online'))
    if (!lista.length) return caixa.append(el('div', { class: 'sussurro' }, 'Ninguém por aqui agora.'))
    for (const j of lista) {
      // Clicar num nome da taverna abre o perfil, como no ranking.
      caixa.append(
        el(
          'button',
          {
            class: 'quem',
            type: 'button',
            title: `Ver o perfil de ${j.nome}`,
            onClick: () => (j.classe ? abrirPerfil(j.id) : null),
          },
          el('span', { class: 'ponto' }),
          el('span', { class: 'nome' }, `${j.classe?.emoji ?? ''} ${j.nome}`),
          el('span', { class: 'nv' }, `nv ${j.nivel}`),
        ),
      )
    }
  })

  socket.on('pvp:desafio', ({ desafio }) => {
    tocar('pvp')
    mostrarConvite(desafio)
    recarregarPainel('pvp')
  })

  socket.on('pvp:recusado', ({ desafio }) => {
    tocar('aviso')
    avisar(`${desafio.desafiado.nome} recusou o duelo.`)
    recarregarPainel('pvp')
  })

  socket.on('pvp:resultado', async ({ duelo }) => {
    tocar('pvp')
    await atualizarFicha()
    await esperarNarracao()
    await narrarDuelo(duelo)
  })

  socket.on('raid:resultado', async ({ raid }) => {
    // Quem apertou "começar" já está vendo pela resposta da própria chamada.
    if (estado.iniciandoRaid) return
    tocar('raid')
    await atualizarFicha()
    await esperarNarracao()
    await narrarRaidCompleta(raid)
  })

  // Alguém abriu, entrou ou saiu de uma sala: se o lobby está na tela,
  // ele se refaz. Sem isso a pessoa ficaria olhando uma lista velha.
  socket.on('raid:atualizou', () => recarregarPainel('raid'))

  socket.on('raid:aberta', ({ sala }) => {
    if (sala.criadorId === estado.p?.id) return
    tocar('raid')
    mostrarCartao({
      titulo: 'Raid aberta',
      texto: `${sala.criadorNome} abriu uma raid contra ${sala.chefe.emoji} ${sala.chefe.nome}.`,
      // O cartão sai antes da sala: é um chamado, não um lembrete de dez minutos.
      expiraEm: Math.min(sala.expiraEm, Date.now() + 60_000),
      botoes: [
        { rotulo: 'Ver a raid', classe: 'btn pequeno primario', acao: abrirRaid },
        { rotulo: 'Fechar', acao: () => {} },
      ],
    })
  })

  socket.on('raid:entrou', ({ nome, sala }) => {
    tocar('aviso')
    avisar(`${nome} entrou na sua raid (${sala.participantes.length}/${sala.maxJogadores}).`)
  })

  ouvirEventos(socket)
  ouvirAventuras(socket)

  socket.on('mercado:oferta', ({ oferta }) => {
    tocar('mercado')
    mostrarOferta(oferta)
    recarregarPainel('mercado')
  })

  socket.on('mercado:resposta', async ({ oferta, aceitou, cancelada, quem, negocio }) => {
    tocar(aceitou ? 'mercado' : 'aviso')
    if (aceitou) {
      avisarBom(
        negocio?.preco
          ? `${quem} comprou ${oferta.itemNome} por ${num(negocio.preco)} de gold.`
          : `${quem} aceitou ${oferta.itemNome}.`,
      )
    } else {
      avisar(cancelada ? `A oferta de ${oferta.itemNome} foi cancelada.` : `${quem} recusou ${oferta.itemNome}.`)
    }
    await atualizarFicha()
    recarregarPainel('mercado')
  })

  socket.on('mercado:pagamento', async ({ de, quanto }) => {
    tocar('mercado')
    avisarBom(`${de} te enviou ${num(quanto)} de gold.`)
    await atualizarFicha()
  })

  // Um administrador tirou a foto (moderação, /foto no chat).
  socket.on('foto:removida', async () => {
    avisar('Sua foto foi removida por um administrador.')
    await atualizarFicha()
  })

  socket.on('erro', (texto) => avisar(texto, 'erro'))
}

function linhaDeChat(m) {
  const sistema = !m.autor
  return el(
    'div',
    { class: `msg${sistema ? ' sistema' : ''}${m.privado ? ' privado' : ''}` },
    el('span', { class: 'hora' }, hora(m.criado_em)),
    el('span', { class: 'autor' }, m.privado ? '[Só você vê] ' : sistema ? '[Sistema] ' : `${m.autor}: `),
    m.texto,
  )
}

function prepararChat() {
  $('#form-chat').addEventListener('submit', (ev) => {
    ev.preventDefault()
    const campo = $('#campo-chat')
    const texto = campo.value.trim()
    if (!texto) return
    estado.socket?.emit('chat:enviar', texto)
    campo.value = ''
  })
}

/**
 * Um cartão no canto para o que chega com prazo e precisa de resposta: um
 * desafio de duelo, uma oferta de item. Um aviso flutuante de três segundos
 * não serve aqui — a pessoa pode estar de olho na luta e perder o prazo.
 */
function mostrarCartao({ titulo, texto, expiraEm, botoes }) {
  const caixa = el(
    'div',
    { class: 'moldura convite' },
    el('div', { class: 'cantos' }),
    el('h4', {}, titulo),
    el('p', {}, texto),
    el(
      'div',
      { class: 'botoes' },
      ...botoes.map(({ rotulo, classe = 'btn pequeno', acao }) =>
        el(
          'button',
          {
            class: classe,
            type: 'button',
            onClick: (ev) =>
              comBotao(ev.currentTarget, async () => {
                caixa.remove()
                await acao()
              }),
          },
          rotulo,
        ),
      ),
    ),
  )

  $('#convites').append(caixa)
  // O prazo é do servidor; o cartão some junto com ele.
  setTimeout(() => caixa.remove(), Math.max(1000, expiraEm - Date.now()))
}

function mostrarConvite(desafio) {
  mostrarCartao({
    titulo: 'Desafio de duelo',
    texto:
      `${desafio.desafiante.nome} desafiou você` +
      (desafio.aposta > 0 ? ` valendo ${num(desafio.aposta)} de gold` : '') +
      '.',
    expiraEm: desafio.expiraEm,
    botoes: [
      {
        rotulo: 'Aceitar',
        classe: 'btn pequeno primario',
        acao: async () => {
          const r = await mandar('/api/pvp/responder', { id: desafio.id, aceitar: true })
          await narrarDuelo(r.duelo)
        },
      },
      {
        rotulo: 'Recusar',
        acao: () => mandar('/api/pvp/responder', { id: desafio.id, aceitar: false }),
      },
    ],
  })
}

function mostrarOferta(oferta) {
  mostrarCartao({
    titulo: oferta.presente ? 'Presente' : 'Oferta de item',
    texto:
      `${oferta.vendedor.nome} oferece ${oferta.itemNome}` +
      (oferta.presente ? ' de presente' : ` por ${num(oferta.preco)} de gold`) +
      '.',
    expiraEm: oferta.expiraEm,
    botoes: [
      {
        rotulo: 'Aceitar',
        classe: 'btn pequeno primario',
        acao: async () => {
          const r = await mandar('/api/mercado/responder', { id: oferta.id, aceitar: true })
          avisarBom(r.texto)
          recarregarPainel('mercado')
        },
      },
      {
        rotulo: 'Ver no mercado',
        acao: () => abrirMercado('recebidas'),
      },
      {
        rotulo: 'Recusar',
        acao: () => mandar('/api/mercado/responder', { id: oferta.id, aceitar: false }),
      },
    ],
  })
}

// ======================================================== I N Í C I O

async function iniciar() {
  prepararEntrada()
  prepararChat()
  prepararTeclado()
  destravarSom()
  configurarEventos({ mostrarEncontro, atualizarFicha })
  configurarAventuras({ atualizarFicha, mostrarCartao, aoMudarChefe: desenharBotaoDoChefe })

  $('#fechar-modal').addEventListener('click', fecharModal)
  $('#fundo-modal').addEventListener('click', (ev) => {
    if (ev.target === $('#fundo-modal')) fecharModal()
  })
  $('#fechar-chat').addEventListener('click', fecharChat)
  $('#fechar-evento').addEventListener('click', fecharPopup)
  $('#fundo-evento').addEventListener('click', (ev) => {
    if (ev.target === $('#fundo-evento')) fecharPopup()
  })
  $('#botao-sair').addEventListener('click', async () => {
    await mandar('/api/auth/sair')
    estado.usuario = null
    definirPersonagemAtivo(null)
    mostrarTela('tela-entrada')
  })

  aoMudarFicha(() => {
    if ($('#tela-jogo').classList.contains('ativa')) desenharFicha()
  })

  const r = await pegar('/api/auth/eu')
  if (!r.usuario) return mostrarTela('tela-entrada')

  estado.usuario = r.usuario
  estado.personagens = r.personagens
  estado.maxPersonagens = r.maxPersonagens ?? 10

  // Volta direto para o último personagem, se ele ainda existe.
  const ultimo = personagemAtivo()
  if (ultimo && estado.personagens.some((p) => p.id === ultimo)) return entrarNoJogo(ultimo)

  desenharPersonagens()
  mostrarTela('tela-personagens')
}

iniciar().catch((e) => {
  console.error(e)
  avisarErro(e)
  mostrarTela('tela-entrada')
})
