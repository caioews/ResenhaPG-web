/**
 * A foto do personagem vista pela API: servir, enviar e remover.
 *
 * Este roteador sobe ANTES dos outros no index.js: eles exigem personagem (e
 * alguns, classe) para qualquer coisa que passe por /api, e uma <img> não
 * manda o cabeçalho X-Personagem — só o cookie da sessão.
 */
import express, { Router } from 'express'
import { config } from '../config.js'
import { exigirLogin } from '../auth.js'
import { exigirPersonagem, responder, rota } from '../contexto.js'
import { lerFoto, removerFoto, salvarFoto } from '../fotos.js'

export const fotosRotas = Router()

// A imagem em si. Só para quem está logado: é um jogo entre amigos, não uma
// galeria pública. O `?v=` do endereço muda a cada troca, então o navegador
// pode guardar para sempre.
fotosRotas.get(
  '/fotos/:id',
  exigirLogin,
  rota((req, res) => {
    const foto = lerFoto(String(req.params.id))
    if (!foto) return res.status(404).json({ erro: 'Sem foto.' })

    res.set({
      'Content-Type': foto.tipo,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    })
    res.send(foto.dados)
  }),
)

// O corpo chega cru (os bytes da imagem), não em JSON. O tipo que o cliente
// declara não importa: quem decide é o começo do arquivo (fotos.js).
fotosRotas.post(
  '/foto',
  exigirLogin,
  exigirPersonagem,
  express.raw({ type: () => true, limit: `${config.web.fotoMaxKb}kb` }),
  rota((req, res) => {
    const feito = salvarFoto(req.player, req.body)
    if (feito.erro) return res.status(400).json({ erro: feito.erro })
    responder(res, req.player)
  }),
)

fotosRotas.post(
  '/foto/remover',
  exigirLogin,
  exigirPersonagem,
  rota((req, res) => {
    removerFoto(req.player)
    responder(res, req.player)
  }),
)

// Imagem grande demais estoura no express.raw antes da rota: responde com a
// mensagem certa em vez do "algo quebrou" genérico.
// eslint-disable-next-line no-unused-vars -- o Express exige os quatro argumentos
fotosRotas.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ erro: `A imagem passou de ${config.web.fotoMaxKb} KB.` })
  }
  next(err)
})
