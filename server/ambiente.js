/**
 * Carrega o arquivo `.env` da raiz do projeto, se existir.
 *
 * Precisa ser o PRIMEIRO import de index.js: os imports de ES module rodam
 * na ordem em que aparecem, e db.js já lê DB_DIR quando é carregado.
 *
 * O `.env` fica fora do git (.gitignore). É onde mora o que é só daquele
 * servidor — ADMINS, por exemplo — sem editar um arquivo versionado, o que
 * faria o próximo `git pull` recusar. Variável que já veio do ambiente (PM2,
 * Docker, linha de comando) ganha do arquivo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const arquivo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')

if (fs.existsSync(arquivo)) {
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const achado = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!achado) continue
    const [, chave, bruto] = achado
    const valor = bruto.replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[chave] === undefined) process.env[chave] = valor
  }
}
