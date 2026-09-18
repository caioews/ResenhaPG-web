/**
 * Casa de leilões: anuncia um item, quem der mais leva.
 *
 * Diferente do mercado (oferta direta, nada retido), aqui as coisas ficam
 * presas de verdade — é o que faz um leilão funcionar:
 *
 *   o item   sai da mochila ao anunciar e fica guardado na tabela `leiloes`
 *   o lance  sai do gold de quem deu na hora; quem é superado recebe de volta
 *            no mesmo instante
 *
 * Por isso tudo mora no banco, não em memória: se o servidor reiniciar com
 * leilão aberto, ao voltar ele continua de onde estava e fecha na hora certa.
 *
 * Ao fechar: com lance, o vendedor recebe o valor menos a taxa da casa (que
 * some do jogo) e o comprador recebe o item; sem lance, o item volta. Item
 * que não cabe na mochila vai para as entregas (entregas.js).
 */
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { db } from './db.js'
import * as store from './store.js'
import { darGold, estaEquipado, removerItem } from './rpg/jogador.js'
import { nomeCompleto } from './rpg/itens.js'
import { guardarOuEntregar } from './entregas.js'
import { registrar } from './missoes.js'
import { anunciar as anunciarNoChat, emitirPara, emitirParaTodos } from './realtime.js'
import { verItem } from './visao.js'

const cfg = () => config.rpg.leilao

// ------------------------------------------------------------------ banco

const inserir = db.prepare(`
  INSERT INTO leiloes (id, vendedor_id, vendedor_nome, vendedor_conta, item, lance_minimo, compra_ja,
                       criado_em, termina_em)
  VALUES (@id, @vendedorId, @vendedorNome, @vendedorConta, @item, @lanceMinimo, @compraJa, @criadoEm, @terminaEm)
`)
const buscar = db.prepare('SELECT * FROM leiloes WHERE id = ?')
const abertos = db.prepare("SELECT * FROM leiloes WHERE estado = 'aberto' ORDER BY termina_em")
const vencidos = db.prepare("SELECT * FROM leiloes WHERE estado = 'aberto' AND termina_em <= ?")
const doVendedor = db.prepare(
  "SELECT * FROM leiloes WHERE vendedor_id = ? AND (estado = 'aberto' OR fechado_em > ?) ORDER BY criado_em DESC",
)
const contarAbertosDo = db.prepare("SELECT COUNT(*) AS n FROM leiloes WHERE vendedor_id = ? AND estado = 'aberto'")
const gravarLance = db.prepare(
  'UPDATE leiloes SET lance = ?, comprador_id = ?, comprador_nome = ?, lances = lances + 1, termina_em = ? WHERE id = ?',
)
const gravarFechamento = db.prepare('UPDATE leiloes SET estado = ?, fechado_em = ? WHERE id = ?')

const linhaParaLeilao = (l) => ({
  id: l.id,
  vendedorId: l.vendedor_id,
  vendedorNome: l.vendedor_nome,
  vendedorConta: l.vendedor_conta,
  item: JSON.parse(l.item),
  lanceMinimo: l.lance_minimo,
  compraJa: l.compra_ja,
  lance: l.lance,
  compradorId: l.comprador_id,
  compradorNome: l.comprador_nome,
  lances: l.lances,
  criadoEm: l.criado_em,
  terminaEm: l.termina_em,
  estado: l.estado,
  fechadoEm: l.fechado_em,
})

/** O menor lance que vale agora. */
export function proximoLance(leilao) {
  if (!leilao.lance) return leilao.lanceMinimo
  return Math.max(leilao.lance + 1, Math.ceil(leilao.lance * (1 + cfg().incrementoMinimo)))
}

export function verLeilao(leilao, quemVe = null) {
  return {
    id: leilao.id,
    item: verItem(leilao.item),
    vendedor: { id: leilao.vendedorId, nome: leilao.vendedorNome },
    lanceMinimo: leilao.lanceMinimo,
    compraJa: leilao.compraJa,
    lance: leilao.lance,
    lider: leilao.compradorId ? { id: leilao.compradorId, nome: leilao.compradorNome } : null,
    lances: leilao.lances,
    proximoLance: proximoLance(leilao),
    terminaEm: leilao.terminaEm,
    estado: leilao.estado,
    fechadoEm: leilao.fechadoEm,
    meu: quemVe ? leilao.vendedorId === quemVe.id : false,
    lidero: quemVe ? leilao.compradorId === quemVe.id : false,
    mesmaConta: quemVe ? leilao.vendedorConta === quemVe.usuarioId : false,
  }
}

// -------------------------------------------------------------- consultas

export function listarAbertos() {
  fecharVencidos()
  return abertos.all().map(linhaParaLeilao)
}

/** Os anúncios do personagem: os abertos e os que fecharam nas últimas 24h. */
export const anunciosDe = (personagemId) =>
  doVendedor.all(personagemId, Date.now() - 24 * 3_600_000).map(linhaParaLeilao)

// ---------------------------------------------------------------- anunciar

export function anunciar(player, { uid, lanceMinimo, compraJa, horas }) {
  const item = player.rpg.inventario.find((i) => i.uid === String(uid ?? ''))
  const minimo = Math.floor(Number(lanceMinimo))
  const ja = compraJa === null || compraJa === undefined || compraJa === '' ? null : Math.floor(Number(compraJa))
  const duracao = Number(horas)

  if (!item) return { erro: 'Item não encontrado na mochila.' }
  if (!item.slot) return { erro: 'Só equipamento vai a leilão.' }
  if (estaEquipado(player, item.uid)) return { erro: `${item.nome} está equipado. Tire de uso antes de anunciar.` }
  if (!(minimo >= 1)) return { erro: 'O lance mínimo precisa ser de pelo menos 1 de gold.' }
  if (ja !== null && !(ja > minimo)) return { erro: 'O "compre já" precisa ser maior que o lance mínimo.' }
  if (!cfg().duracoesHoras.includes(duracao)) {
    return { erro: `Duração inválida. Escolha ${cfg().duracoesHoras.join(', ')} horas.` }
  }
  if (contarAbertosDo.get(player.id).n >= cfg().maxAnunciosPorPersonagem) {
    return { erro: `Você já tem ${cfg().maxAnunciosPorPersonagem} leilões abertos.` }
  }

  const agora = Date.now()
  const leilao = {
    id: randomUUID().slice(0, 8),
    vendedorId: player.id,
    vendedorNome: player.name,
    vendedorConta: player.usuarioId,
    item: JSON.stringify(item),
    lanceMinimo: minimo,
    compraJa: ja,
    criadoEm: agora,
    terminaEm: agora + duracao * 3_600_000,
  }

  // O item sai da mochila e entra no banco na mesma transação.
  db.transaction(() => {
    inserir.run(leilao)
    removerItem(player, item.uid)
  })()
  store.flush()

  registrar(player, 'leilao')
  emitirParaTodos('leilao:atualizou', {})
  return { leilao: linhaParaLeilao(buscar.get(leilao.id)) }
}

// ------------------------------------------------------------------ lance

export function darLance(player, id, valor, { compraJa = false } = {}) {
  fecharVencidos()
  const linha = buscar.get(String(id ?? ''))
  if (!linha || linha.estado !== 'aberto') return { erro: 'Esse leilão já fechou.' }
  const leilao = linhaParaLeilao(linha)

  if (leilao.vendedorId === player.id) return { erro: 'Você não pode dar lance no próprio anúncio.' }
  if (leilao.vendedorConta === player.usuarioId) {
    return { erro: 'Esse anúncio é de outro personagem da sua conta.' }
  }
  if (leilao.compradorId === player.id) return { erro: 'Você já tem o maior lance.' }

  let lance = compraJa ? leilao.compraJa : Math.floor(Number(valor))
  if (compraJa && !leilao.compraJa) return { erro: 'Esse anúncio não tem "compre já".' }
  if (!compraJa && !(lance >= proximoLance(leilao))) {
    return { erro: `O lance precisa ser de pelo menos ${proximoLance(leilao)} de gold.` }
  }
  // Lance que alcança o "compre já" vira compra: paga o preço fixado, não mais.
  const arremate = Boolean(leilao.compraJa) && lance >= leilao.compraJa
  if (arremate) lance = leilao.compraJa

  if (player.rpg.gold < lance) return { erro: `Você tem ${player.rpg.gold} de gold e o lance é de ${lance}.` }

  // Lance nos últimos minutos empurra o fim: sem isso, ganha quem clica no
  // último segundo, não quem paga mais.
  const agora = Date.now()
  const prorrogacao = cfg().prorrogacaoMinutos * 60_000
  const terminaEm = leilao.terminaEm - agora < prorrogacao ? agora + prorrogacao : leilao.terminaEm

  const anterior = leilao.compradorId ? store.buscarPersonagem(leilao.compradorId) : null

  darGold(player, -lance)
  if (anterior) darGold(anterior, leilao.lance)
  gravarLance.run(lance, player.id, player.name, terminaEm, leilao.id)
  store.flush()

  registrar(player, 'leilao')

  if (anterior) {
    emitirPara(anterior.id, 'leilao:superado', {
      leilao: verLeilao(linhaParaLeilao(buscar.get(leilao.id)), anterior),
      devolvido: leilao.lance,
      quem: player.name,
    })
  }

  if (arremate) fechar(linhaParaLeilao(buscar.get(leilao.id)))
  emitirParaTodos('leilao:atualizou', {})

  return { leilao: linhaParaLeilao(buscar.get(leilao.id)), arremate, lance }
}

// --------------------------------------------------------------- cancelar

export function cancelar(player, id) {
  const linha = buscar.get(String(id ?? ''))
  if (!linha || linha.estado !== 'aberto') return { erro: 'Esse leilão já fechou.' }
  const leilao = linhaParaLeilao(linha)
  if (leilao.vendedorId !== player.id) return { erro: 'Só quem anunciou pode cancelar.' }
  if (leilao.lance) return { erro: 'Já tem lance nesse anúncio: agora ele vai até o fim.' }

  gravarFechamento.run('cancelado', Date.now(), leilao.id)
  const onde = guardarOuEntregar(player, leilao.item, 'Anúncio cancelado')
  store.flush()
  emitirParaTodos('leilao:atualizou', {})
  return { onde, item: leilao.item }
}

// ------------------------------------------------------------------ fechar

function fechar(leilao) {
  const agora = Date.now()
  const vendedor = store.buscarPersonagem(leilao.vendedorId)
  const comprador = leilao.compradorId ? store.buscarPersonagem(leilao.compradorId) : null

  // Comprador que deixou de existir (personagem apagado): o lance dele já
  // saiu, e não há para quem devolver — o item volta ao vendedor.
  if (leilao.lance && comprador) {
    const taxa = Math.floor(leilao.lance * cfg().taxaDeVenda)
    const liquido = leilao.lance - taxa
    gravarFechamento.run('vendido', agora, leilao.id)

    if (vendedor) darGold(vendedor, liquido)
    const onde = guardarOuEntregar(comprador, leilao.item, `Arremate de ${nomeCompleto(leilao.item)}`)
    store.flush()

    if (vendedor) {
      emitirPara(vendedor.id, 'leilao:vendido', {
        itemNome: leilao.item.nome,
        valor: leilao.lance,
        taxa,
        liquido,
        comprador: comprador.name,
      })
    }
    emitirPara(comprador.id, 'leilao:ganhou', { item: verItem(leilao.item), valor: leilao.lance, onde })

    if (['epico', 'lendario'].includes(leilao.item.raridade)) {
      anunciarNoChat(
        `${comprador.name} arrematou ${nomeCompleto(leilao.item)} de ${leilao.vendedorNome} por ${leilao.lance.toLocaleString('pt-BR')} de gold.`,
      )
    }
    return
  }

  gravarFechamento.run('expirado', agora, leilao.id)
  if (vendedor) {
    const onde = guardarOuEntregar(vendedor, leilao.item, 'Leilão sem lance')
    store.flush()
    emitirPara(vendedor.id, 'leilao:expirou', { item: verItem(leilao.item), onde })
  }
}

/** Fecha tudo que passou da hora. Roda num intervalo e antes de cada consulta. */
export function fecharVencidos() {
  const lista = vencidos.all(Date.now()).map(linhaParaLeilao)
  for (const leilao of lista) {
    try {
      fechar(leilao)
    } catch (err) {
      console.error('[leilao] falhou ao fechar', leilao.id, err)
    }
  }
  if (lista.length) emitirParaTodos('leilao:atualizou', {})
}

let relogio = null
export function iniciarLeiloes() {
  fecharVencidos()
  clearInterval(relogio)
  relogio = setInterval(fecharVencidos, 15_000)
}
