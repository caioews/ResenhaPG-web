#!/usr/bin/env bash
#
# Atualiza o jogo no servidor.
#
#   ~/jogo/scripts/atualizar.sh
#
# Roda como o usuário `resenha`, não como root. Pega o código novo do
# GitHub, reinstala as dependências só se elas mudaram, reinicia o processo
# e mostra o log para você conferir que subiu.
#
# O banco de dados (dados/resenha.db) não é tocado: ele está no .gitignore,
# então vive só no servidor e nenhum `git pull` passa por cima dele.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Buscando o código novo"
antes=$(git rev-parse HEAD)

# --ff-only de propósito: se alguém editou arquivo direto no servidor, o pull
# falha aqui em vez de abrir um merge no meio do deploy.
git pull --ff-only

depois=$(git rev-parse HEAD)

if [ "$antes" = "$depois" ]; then
  echo "==> Nada novo para aplicar."
  exit 0
fi

echo "==> Mudou:"
git log --oneline "$antes..$depois"

# `npm ci` apaga e reinstala o node_modules inteiro — demora. Só vale a pena
# quando a lista de dependências mudou de verdade.
if git diff --name-only "$antes" "$depois" | grep -qE '^package(-lock)?\.json$'; then
  echo "==> As dependências mudaram: reinstalando"
  npm ci --omit=dev
fi

echo "==> Reiniciando"
pm2 restart resenha --update-env

echo "==> Últimas linhas do log:"
sleep 2
pm2 logs resenha --lines 15 --nostream
