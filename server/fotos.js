/**
 * A foto do personagem.
 *
 * O navegador faz o trabalho pesado: a pessoa escolhe a imagem, enquadra, e
 * a página recorta e reduz num canvas antes de mandar. Reencodar no canvas
 * também joga fora os metadados da câmera (GPS, modelo do celular), então o
 * servidor não precisa de biblioteca de imagem nenhuma.
 *
 * Do lado de cá só conferimos que o que chegou é mesmo uma imagem — pelos
 * primeiros bytes, nunca pelo cabeçalho que o cliente mandou — e que cabe no
 * limite. SVG fica de fora de propósito: é texto e pode carregar script.
 */
import { db } from './db.js'
import { config } from './config.js'
import * as store from './store.js'

const gravar = db.prepare(`
  INSERT INTO fotos (personagem_id, tipo, dados, atualizada_em) VALUES (?, ?, ?, ?)
  ON CONFLICT(personagem_id) DO UPDATE SET tipo = excluded.tipo, dados = excluded.dados,
    atualizada_em = excluded.atualizada_em
`)
const ler = db.prepare('SELECT tipo, dados, atualizada_em FROM fotos WHERE personagem_id = ?')
const apagar = db.prepare('DELETE FROM fotos WHERE personagem_id = ?')

/** personagem -> quando mandou a última foto (só em memória: é um freio, não um registro) */
const ultimoEnvio = new Map()

/** O tipo da imagem pelos primeiros bytes, ou null se não for uma que aceitamos. */
export function tipoDaImagem(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** O endereço da foto, com a versão junto para o cache saber quando ela muda. */
export const urlDaFoto = (player) =>
  player?.rpg?.foto ? `/api/fotos/${encodeURIComponent(player.id)}?v=${player.rpg.foto}` : null

export function salvarFoto(player, buf) {
  const espera = (ultimoEnvio.get(player.id) ?? 0) + config.web.fotoEsperaSegundos * 1000 - Date.now()
  if (espera > 0) return { erro: `Calma: dá para trocar de novo em ${Math.ceil(espera / 1000)}s.` }

  if (!Buffer.isBuffer(buf) || !buf.length) return { erro: 'Nenhuma imagem chegou.' }
  if (buf.length > config.web.fotoMaxKb * 1024) {
    return { erro: `A imagem passou de ${config.web.fotoMaxKb} KB.` }
  }

  const tipo = tipoDaImagem(buf)
  if (!tipo) return { erro: 'Formato não aceito. Use JPG, PNG ou WebP.' }

  const agora = Date.now()
  gravar.run(player.id, tipo, buf, agora)
  ultimoEnvio.set(player.id, agora)
  player.rpg.foto = agora
  store.save()
  return { ok: true }
}

export function removerFoto(player) {
  apagar.run(player.id)
  const tinha = Boolean(player.rpg.foto)
  player.rpg.foto = 0
  store.save()
  return { ok: true, tinha }
}

/** A imagem guardada, para a rota que serve o arquivo. */
export const lerFoto = (personagemId) => ler.get(personagemId) ?? null
