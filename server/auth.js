/**
 * Contas e sessoes.
 *
 * Uma conta tem um usuario, uma senha e ate `config.web.maxPersonagens`
 * personagens. A sessao e um token aleatorio guardado num cookie httpOnly —
 * nada de JWT, porque aqui a gente quer justamente poder revogar do servidor
 * (encerrar sessao) sem esperar token nenhum vencer.
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { config } from './config.js'
import {
  apagarSessao,
  buscarSessao,
  buscarUsuarioPorId,
  buscarUsuarioPorNome,
  criarSessao,
  criarUsuario,
  limparSessoesVencidas,
  marcarLogin,
} from './db.js'

export const COOKIE = 'resenha_sessao'

const DURACAO = config.web.sessaoDias * 24 * 60 * 60 * 1000

/** Regras do nome de usuario. Deixa passar acento, barra nada de espaco. */
export function validarUsuario(nome) {
  const limpo = String(nome ?? '').trim()
  if (limpo.length < 3) return { erro: 'O usuário precisa de pelo menos 3 caracteres.' }
  if (limpo.length > 20) return { erro: 'O usuário pode ter no máximo 20 caracteres.' }
  if (!/^[\p{L}\p{N}_.-]+$/u.test(limpo)) {
    return { erro: 'O usuário aceita apenas letras, números, ponto, hífen e underline.' }
  }
  return { valor: limpo }
}

export function validarSenha(senha) {
  const texto = String(senha ?? '')
  if (texto.length < 6) return { erro: 'A senha precisa de pelo menos 6 caracteres.' }
  if (texto.length > 200) return { erro: 'Essa senha é longa demais.' }
  return { valor: texto }
}

export function registrar(nome, senha) {
  const u = validarUsuario(nome)
  if (u.erro) return u
  const s = validarSenha(senha)
  if (s.erro) return s

  if (buscarUsuarioPorNome.get(u.valor)) return { erro: 'Esse usuário já existe.' }

  const hash = bcrypt.hashSync(s.valor, 10)
  const info = criarUsuario.run(u.valor, hash, Date.now())
  return { usuario: buscarUsuarioPorId.get(info.lastInsertRowid) }
}

export function entrar(nome, senha) {
  const usuario = buscarUsuarioPorNome.get(String(nome ?? '').trim())
  // A mesma mensagem para usuario inexistente e senha errada: nao vale
  // entregar de bandeja quais contas existem.
  const generico = { erro: 'Usuário ou senha incorretos.' }
  if (!usuario) return generico
  if (!bcrypt.compareSync(String(senha ?? ''), usuario.senha_hash)) return generico

  marcarLogin.run(Date.now(), usuario.id)
  return { usuario }
}

export function abrirSessao(usuarioId) {
  limparSessoesVencidas.run(Date.now())
  const token = randomBytes(32).toString('hex')
  const agora = Date.now()
  criarSessao.run(token, usuarioId, agora, agora + DURACAO)
  return token
}

export const fecharSessao = (token) => token && apagarSessao.run(token)

export function usuarioDaSessao(token) {
  if (!token) return null
  const sessao = buscarSessao.get(token)
  if (!sessao) return null
  if (sessao.expira_em < Date.now()) {
    apagarSessao.run(token)
    return null
  }
  return buscarUsuarioPorId.get(sessao.usuario_id) ?? null
}

export const opcoesDoCookie = () => ({
  httpOnly: true,
  sameSite: 'lax',
  // Em producao atras de HTTPS o cookie so viaja cifrado. Em
  // desenvolvimento (http://localhost) ele precisa continuar funcionando.
  secure: process.env.NODE_ENV === 'production',
  maxAge: DURACAO,
  path: '/',
})

/** Middleware: exige sessao valida e poe `req.usuario` no caminho. */
export function exigirLogin(req, res, next) {
  const usuario = usuarioDaSessao(req.cookies?.[COOKIE])
  if (!usuario) return res.status(401).json({ erro: 'Faça login para continuar.' })
  req.usuario = usuario
  next()
}
