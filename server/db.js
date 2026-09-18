/**
 * Banco de dados: um arquivo SQLite em dados/resenha.db.
 *
 * A ficha de cada personagem e guardada como JSON numa coluna so. Isso e
 * de proposito: o motor de RPG portado do bot trabalha em cima de um objeto
 * `player` inteiro, e quebrar esse objeto em tabelas so criaria trabalho de
 * traducao nas duas pontas sem nenhum ganho — ninguem consulta o jogo por
 * "todos os itens epicos do servidor".
 *
 * O que ganha tabela propria e o que o SQL precisa mesmo indexar: contas,
 * sessoes e o historico do chat.
 */
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const aqui = path.dirname(fileURLToPath(import.meta.url))
export const raizDoProjeto = path.resolve(aqui, '..')

const pastaDeDados = process.env.DB_DIR || path.join(raizDoProjeto, 'dados')
if (!existsSync(pastaDeDados)) mkdirSync(pastaDeDados, { recursive: true })

export const db = new Database(process.env.DB_PATH || path.join(pastaDeDados, 'resenha.db'))

// WAL: leitura e escrita ao mesmo tempo sem travar uma na outra. Num jogo em
// que todo mundo esta caçando junto isso importa.
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario      TEXT NOT NULL COLLATE NOCASE UNIQUE,
    senha_hash   TEXT NOT NULL,
    criado_em    INTEGER NOT NULL,
    ultimo_login INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    token      TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em  INTEGER NOT NULL,
    expira_em  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);

  CREATE TABLE IF NOT EXISTS personagens (
    id         TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome       TEXT NOT NULL COLLATE NOCASE UNIQUE,
    dados      TEXT NOT NULL,
    criado_em  INTEGER NOT NULL,
    jogado_em  INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_personagens_usuario ON personagens(usuario_id);

  -- Estado do servidor que precisa sobreviver a um reinício e não é de
  -- personagem nenhum: o chefe mundial, a agenda dele.
  CREATE TABLE IF NOT EXISTS estado (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );

  -- Casa de leilões. O item anunciado sai da mochila e fica AQUI até o
  -- leilão fechar: é o único lugar do jogo que retém um bem, e por isso vive
  -- no banco e não em memória — um reinício não pode sumir com a peça.
  CREATE TABLE IF NOT EXISTS leiloes (
    id             TEXT PRIMARY KEY,
    vendedor_id    TEXT NOT NULL,
    vendedor_nome  TEXT NOT NULL,
    vendedor_conta INTEGER NOT NULL,
    item           TEXT NOT NULL,
    lance_minimo   INTEGER NOT NULL,
    compra_ja      INTEGER,
    lance          INTEGER,
    comprador_id   TEXT,
    comprador_nome TEXT,
    lances         INTEGER NOT NULL DEFAULT 0,
    criado_em      INTEGER NOT NULL,
    termina_em     INTEGER NOT NULL,
    estado         TEXT NOT NULL DEFAULT 'aberto',
    fechado_em     INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_leiloes_estado ON leiloes(estado, termina_em);

  -- Itens esperando o dono ir buscar: arrematados, devolvidos, prêmios que
  -- não couberam na mochila.
  CREATE TABLE IF NOT EXISTS entregas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    personagem_id TEXT NOT NULL,
    item          TEXT NOT NULL,
    motivo        TEXT NOT NULL,
    criado_em     INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_entregas_personagem ON entregas(personagem_id);

  -- A foto de cada personagem. Fica fora da ficha JSON de propósito: a ficha
  -- é regravada a cada caçada, e arrastar 60 KB de imagem junto seria
  -- desperdício. Apagar o personagem leva a foto junto (cascade).
  CREATE TABLE IF NOT EXISTS fotos (
    personagem_id TEXT PRIMARY KEY REFERENCES personagens(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL,
    dados         BLOB NOT NULL,
    atualizada_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    canal     TEXT NOT NULL,
    autor     TEXT NOT NULL DEFAULT '',
    texto     TEXT NOT NULL,
    criado_em INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chat_canal ON chat(canal, id);
`)

// -------------------------------------------------------------- usuarios

export const criarUsuario = db.prepare(
  'INSERT INTO usuarios (usuario, senha_hash, criado_em) VALUES (?, ?, ?)',
)
export const buscarUsuarioPorNome = db.prepare('SELECT * FROM usuarios WHERE usuario = ?')
export const buscarUsuarioPorId = db.prepare('SELECT * FROM usuarios WHERE id = ?')
export const marcarLogin = db.prepare('UPDATE usuarios SET ultimo_login = ? WHERE id = ?')

// -------------------------------------------------------------- sessoes

export const criarSessao = db.prepare(
  'INSERT INTO sessoes (token, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)',
)
export const buscarSessao = db.prepare('SELECT * FROM sessoes WHERE token = ?')
export const apagarSessao = db.prepare('DELETE FROM sessoes WHERE token = ?')
export const limparSessoesVencidas = db.prepare('DELETE FROM sessoes WHERE expira_em < ?')

// -------------------------------------------------------------- chat

export const gravarMensagem = db.prepare(
  'INSERT INTO chat (canal, autor, texto, criado_em) VALUES (?, ?, ?, ?)',
)

/** Ultimas N mensagens de um canal, da mais antiga para a mais nova. */
export function historicoDoChat(canal, limite) {
  const linhas = db
    .prepare('SELECT autor, texto, criado_em FROM chat WHERE canal = ? ORDER BY id DESC LIMIT ?')
    .all(canal, limite)
  return linhas.reverse()
}

/** Apaga mensagens antigas para o arquivo nao crescer para sempre. */
export function podarChat(canal, manter) {
  db.prepare(
    `DELETE FROM chat WHERE canal = ? AND id NOT IN (
       SELECT id FROM chat WHERE canal = ? ORDER BY id DESC LIMIT ?
     )`,
  ).run(canal, canal, manter)
}

/**
 * Fecha o banco. Quem chama é o store, na saída, DEPOIS de gravar o que está
 * pendente — fechar aqui num `process.on('exit')` próprio rodava antes da
 * última gravação (db.js carrega primeiro, então o ouvinte dele vinha antes)
 * e ela quebrava com o banco já fechado.
 */
export function fecharBanco() {
  try {
    db.close()
  } catch {
    // nada a fazer no caminho de saida
  }
}
