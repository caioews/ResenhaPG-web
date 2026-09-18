/**
 * O servidor.
 *
 * Um processo só: serve a interface estática, a API e o socket do chat.
 * Não precisa de nginx, banco externo nem fila — dá para subir numa VPS de
 * 1 GB e deixar rodando.
 */
import './ambiente.js'
import http from 'node:http'
import path from 'node:path'
import express from 'express'
import cookieParser from 'cookie-parser'
import { raizDoProjeto } from './db.js'
import { config } from './config.js'
import { contas } from './rotas/contas.js'
import { combate } from './rotas/combate.js'
import { mochila } from './rotas/mochila.js'
import { cidade } from './rotas/cidade.js'
import { social } from './rotas/social.js'
import { mercadoRotas } from './rotas/mercado.js'
import { eventosRotas } from './rotas/eventos.js'
import { missoesRotas } from './rotas/missoes.js'
import { leilaoRotas } from './rotas/leilao.js'
import { chefeMundialRotas } from './rotas/chefeMundial.js'
import { masmorraRotas } from './rotas/masmorra.js'
import { aoComando, iniciarRealtime } from './realtime.js'
import { iniciarEventos } from './eventos.js'
import { iniciarLeiloes } from './leilao.js'
import { iniciarChefeMundial } from './chefeMundial.js'
import { comandoDeAdmin } from './admin.js'

const app = express()

// Atrás de um proxy (Nginx, Caddy, Railway, Render) é o proxy que sabe se a
// conexão original era HTTPS. Sem isso o cookie `secure` nunca seria aceito.
app.set('trust proxy', 1)

app.use(express.json({ limit: '64kb' }))
app.use(cookieParser())

app.use('/api', contas)
app.use('/api/combate', combate)
app.use('/api/mochila', mochila)
app.use('/api', cidade)
app.use('/api', social)
app.use('/api', mercadoRotas)
app.use('/api', eventosRotas)
app.use('/api', missoesRotas)
app.use('/api', leilaoRotas)
app.use('/api', chefeMundialRotas)
app.use('/api', masmorraRotas)

app.use(
  express.static(path.join(raizDoProjeto, 'public'), {
    // O HTML muda a cada deploy; o resto pode ficar em cache.
    setHeaders: (res, caminho) => {
      if (caminho.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }),
)

app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }))

// Qualquer outra rota devolve a interface: a navegação é do lado do cliente.
app.get('*', (_req, res) => res.sendFile(path.join(raizDoProjeto, 'public', 'index.html')))

// eslint-disable-next-line no-unused-vars -- o Express exige os quatro argumentos
app.use((err, _req, res, _next) => {
  console.error('[erro]', err)
  res.status(500).json({ erro: 'Algo quebrou no servidor. Tente de novo.' })
})

const servidor = http.createServer(app)
iniciarRealtime(servidor)
aoComando(comandoDeAdmin)
iniciarEventos()
iniciarLeiloes()
iniciarChefeMundial()

const porta = Number(process.env.PORT) || 3000
const host = process.env.HOST || '0.0.0.0'

servidor.listen(porta, host, () => {
  console.log(`\n  ⚔️  Resenha RPG no ar em http://localhost:${porta}`)
  console.log(`      ${config.web.maxPersonagens} personagens por conta · Ctrl+C para parar\n`)
})
