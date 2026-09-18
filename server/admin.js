/**
 * Comandos de administrador, digitados no chat do jogo.
 *
 * Quem é administrador vem da variável de ambiente ADMINS: nomes de usuário
 * (da conta, não do personagem) separados por vírgula.
 *
 *   ADMINS=caio,outro
 *
 * Comandos:
 *   /evento                     sorteia um evento e abre a chamada
 *   /evento <nome> [segundos]   abre um evento específico (ex.: /evento dragao 30)
 *   /evento lista               mostra os nomes dos eventos
 *   /evento encerrar            fecha a chamada aberta e resolve agora
 *   /evento proximo             diz quando sai o próximo evento sorteado
 *   /chefe                      faz o chefe mundial aparecer agora
 *   /chefe <nome>               um chefe específico (ex.: /chefe kraken)
 *   /chefe lista                mostra os nomes dos chefes
 *   /chefe encerrar             o chefe no ar foge agora (espólio pela metade)
 */
import { EVENTOS, dispararEvento, encerrarEvento, proximoEvento } from './eventos.js'
import { CHEFES_MUNDIAIS, encerrar as encerrarChefe, surgir } from './chefeMundial.js'

// Lido na hora, e não quando o arquivo carrega: assim o .env (ambiente.js)
// já está aplicado, qualquer que seja a ordem dos imports.
export function ehAdmin(usuario) {
  const nome = String(usuario?.usuario ?? '').toLowerCase()
  return (
    Boolean(nome) &&
    String(process.env.ADMINS ?? '')
      .split(',')
      .some((admin) => admin.trim().toLowerCase() === nome)
  )
}

function comandoDoChefe(args) {
  const alvo = (args[0] ?? '').trim()
  if (alvo === 'lista') {
    return `Chefes: ${Object.entries(CHEFES_MUNDIAIS)
      .map(([chave, c]) => `${chave} (${c.emoji} ${c.nome})`)
      .join(' · ')}`
  }
  if (alvo === 'encerrar') {
    const feito = encerrarChefe('fugiu')
    return feito.erro ?? 'O chefe fugiu.'
  }
  const feito = surgir(alvo || null)
  return feito.erro ?? `${feito.chefe.chefe.emoji} ${feito.chefe.chefe.nome} apareceu.`
}

export function comandoDeAdmin({ usuario, texto }) {
  const [comando, ...args] = texto.slice(1).split(' ')
  const qual = comando.toLowerCase()
  if (qual !== 'evento' && qual !== 'chefe') return null
  if (!ehAdmin(usuario)) return 'Só administradores usam esse comando.'
  if (qual === 'chefe') return comandoDoChefe(args)

  const alvo = (args[0] ?? '').trim()

  if (alvo === 'lista') {
    return `Eventos: ${Object.entries(EVENTOS)
      .map(([chave, e]) => `${chave} (${e.emoji} ${e.nome})`)
      .join(' · ')}`
  }

  if (alvo === 'encerrar') {
    const feito = encerrarEvento()
    return feito.erro ?? 'Chamada encerrada.'
  }

  if (alvo === 'proximo') {
    const falta = proximoEvento() - Date.now()
    return falta > 0 ? `O próximo evento sorteado sai em ${Math.ceil(falta / 60_000)} min.` : 'Nenhum evento agendado.'
  }

  const segundos = Math.max(10, Math.min(3600, Number(args[1]) || 0)) || null
  const feito = dispararEvento(alvo || undefined, { segundos: args[1] ? segundos : null })
  return feito.erro ?? `${feito.evento.emoji} ${feito.evento.nome} aberto.`
}
