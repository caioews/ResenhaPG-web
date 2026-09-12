# Imagem para hospedar em qualquer serviço que aceite container
# (Railway, Render, Fly.io, Coolify, Dokploy, ou Docker na sua própria VPS).
#
# Importante: o banco é um arquivo. Monte /dados num volume persistente, ou
# cada deploy começa com o servidor vazio.
FROM node:22-bookworm-slim

# better-sqlite3 tem binário pronto para linux/amd64 e arm64; o build-essential
# só entra em cena se o prebuilt não servir para a arquitetura da máquina.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_DIR=/dados

RUN mkdir -p /dados
VOLUME ["/dados"]

EXPOSE 3000

# Roda sem privilégio: o usuário `node` já vem na imagem.
RUN chown -R node:node /app /dados
USER node

CMD ["node", "server/index.js"]
