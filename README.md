# Resenha RPG — versão web

O RPG que rodava dentro do bot de WhatsApp, agora no navegador: com contas,
até 10 personagens por conta, chat em tempo real e todas as interfaces em
tela em vez de comandos de texto.

O jogo continua **baseado em texto**. O que mudou é a superfície: o log
estruturado de cada luta, que no WhatsApp virava seis linhas resumidas, aqui
vira a narrativa inteira rolando na tela com as barras de vida acompanhando
golpe por golpe.

---

## O que foi portado

O motor de RPG em `server/rpg/` é **o mesmo código do bot**, copiado sem
alteração de lógica (só os caminhos de `import` mudaram). Isso não foi
preguiça: é o que garante que nenhuma fórmula, nenhuma tabela e nenhuma
decisão de balanceamento se perdeu no caminho. Os números da especificação
foram calibrados por simulação, e qualquer reescrita à mão teria mexido nas
taxas de vitória sem ninguém perceber.

| Sistema | Onde está |
| --- | --- |
| 77 classes em 4 degraus, com herança de base/armas/habilidades | `server/rpg/classes.js` |
| 70 habilidades declarativas e a regra de fusão de efeitos | `server/rpg/habilidades.js` |
| Motor de combate (golpe, luta individual, luta em grupo) | `server/rpg/combate.js` |
| 25 tipos de equipamento, raridades, materiais por nível, drop | `server/rpg/itens.js` |
| 20 espécies, elites, 19 chefes de marco + rodízio infinito, escala de fim de jogo | `server/rpg/monstros.js` |
| Encontro completo: recompensa, drop, titanita, feitiço, punição da derrota | `server/rpg/encontro.js` |
| O Abismo | `server/rpg/abismo.js` |
| Raids (10 chefes em dois escalões, golpe em área) | `server/rpg/raid.js` |
| PvP com ranking Elo | `server/rpg/pvp.js` |
| Rito de evolução (as três provas em espelho) | `server/rpg/evolucao.js` |
| Ferreiro (+1 a +10 com titanitas) | `server/rpg/ferreiro.js` |
| Feiticeiro (8 feitiços de infusão) | `server/rpg/feiticos.js` |
| Loja, oferta especial, venda em lote | `server/rpg/loja.js` |
| Negociação entre jogadores (ofertas em memória, nada retido) | `server/mercado.js` |
| Expedições | `server/rpg/expedicao.js` |
| **Toda** a configuração numérica, num objeto só | `server/config.js` |

O XP social, as apostas, o cassino e o Pokémon do bot ficaram de fora — o
escopo aqui é só o RPG.

### Onde o jogo diverge do bot, de propósito

Duas mudanças pedidas para a versão web. Fora estas, os números e as regras
são os mesmos.

| O que mudou | No bot | Aqui |
| --- | --- | --- |
| **Fogueira** | a vida regenerava no ritmo normal e **saltava** para o máximo quando os minutos acabavam | a vida sobe **em rampa**, do que havia quando o fogo foi aceso até o máximo no instante do fim. Levantar antes da hora congela o que já subiu, em vez de perder |
| **Presente de item** | `/daritem` entregava na hora | vira uma oferta de preço 0, que ainda precisa ser aceita — assim ninguém recebe item com a mochila cheia |

A rampa da fogueira continua sem temporizador nenhum: o que existe é o par
(vida, instante) gravado no acender e o horário de término, e a conta é feita
na leitura (`vidaAtual`, em `server/rpg/jogador.js`). O servidor pode cair e
voltar no meio do descanso sem perder nada, e o navegador refaz exatamente a
mesma conta a cada segundo só para a barra subir na tela.

### O que é novo

- **Contas e personagens** (`server/auth.js`, `server/store.js`): usuário e
  senha, sessão em cookie httpOnly, até 10 personagens por conta.
- **SQLite** no lugar do JSON (`server/db.js`).
- **Chat da guilda em tempo real** por WebSocket, com avisos automáticos do
  sistema quando alguém sobe de nível, derruba um chefe, acha um lendário ou
  desce fundo no Abismo (`server/realtime.js`).
- **Salas de raid, desafios de PvP e ofertas de item** que aparecem na hora
  para quem está on-line (`server/salas.js`, `server/mercado.js`).
- **Mercado**: oferecer uma peça a outro jogador por um preço, dar de
  presente (preço 0) e transferir gold.
- **Interface** sem framework nem build: HTML, CSS e módulos ES nativos
  (`public/`).

---

## Rodar no seu computador

Precisa de **Node.js 18 ou mais novo** ([nodejs.org](https://nodejs.org)).

```bash
npm install
npm start
```

Abra <http://localhost:3000>, crie uma conta e um personagem.

Durante o desenvolvimento, `npm run dev` reinicia sozinho a cada alteração.

### Os outros comandos

```bash
npm run conformidade
```

Confere o porte contra a especificação: atributos base por classe e nível,
escala de fim de jogo, atributos de monstro, bônus de item, e as invariantes
da árvore de classes (nenhuma evolução reduz atributo, nenhuma perde um tipo
de arma, nenhuma habilidade se repete). **Todas passam.**

```bash
npm run balance
```

O simulador de balanceamento do bot, portado. Monta jogadores de referência
(classe × nível × raridade) e roda milhares de lutas contra monstro comum,
elite e chefe, imprimindo a taxa de vitória de cada cruzamento. Use
`RODADAS=400 npm run balance` para uma passada rápida. É a régua: se você
mexer em algum número do `config.js`, rode isso antes de dar por encerrado.

---

## Estrutura

```
ResenhaPG web/
├── server/
│   ├── index.js        Express + estáticos + socket, num processo só
│   ├── config.js       A fonte única de verdade dos números do jogo
│   ├── db.js           SQLite: contas, sessões, chat
│   ├── store.js        Personagens em memória + gravação com debounce
│   ├── auth.js         Registro, login, sessões
│   ├── contexto.js     O personagem ativo de cada requisição
│   ├── visao.js        A ficha como o navegador a enxerga
│   ├── salas.js        Salas de raid e desafios de PvP (só em memória)
│   ├── mercado.js      Ofertas de item entre jogadores (só em memória)
│   ├── realtime.js     Chat, quem está on-line, avisos
│   ├── rotas/          contas · combate · mochila · cidade · social · mercado
│   └── rpg/            O motor, portado do bot
├── public/
│   ├── index.html
│   ├── css/estilo.css
│   └── js/             nucleo · narrativa · paineis · app
├── scripts/            conformidade.js · simulador.js
└── dados/              O banco (criado sozinho; não versione)
```

### Duas decisões que valem explicação

**Todo cálculo no servidor.** O navegador nunca decide dano, drop, gold ou
resultado de luta — ele recebe o log já resolvido e anima em cima dele. Se o
cliente calculasse qualquer coisa disso, viraria formulário de fraude.

**Estado por timestamp, nunca por temporizador.** Não existe `setTimeout`
para curar o jogador, terminar uma expedição ou liberar um cooldown. O que
existe é um horário guardado e uma função que recalcula na leitura. O
servidor pode cair e voltar no meio de qualquer coisa sem perder nada — e a
interface só conta para trás o que o servidor disse que falta.

---

## Hospedar para jogar com os amigos

### A escolha que importa

O jogo é **um processo Node.js que fica no ar** e guarda estado em memória
(os personagens, as salas de raid, os desafios de PvP, as ofertas do mercado)
com um arquivo SQLite
por trás. Isso descarta dois tipos de hospedagem:

- **Hospedagem compartilhada** (o plano mais barato da Hostinger, da Locaweb,
  da HostGator): serve PHP e arquivos estáticos, não mantém um processo Node
  seu rodando. **Não serve.**
- **Serverless** (Vercel, Netlify, Cloudflare Pages): cada requisição sobe e
  desce uma função. Sem processo contínuo não há WebSocket para o chat, e o
  arquivo SQLite não sobrevive. **Não serve.**

O que serve é **uma VPS** ou **uma plataforma de container**.

### Minha recomendação

**Para um grupo de amigos: uma VPS pequena.** É a opção mais barata por mês,
não tem surpresa de cobrança, e 1 GB de RAM sobra com folga — o jogo inteiro
ocupa uns 80 MB.

| Onde | Plano típico | Preço aproximado | Observação |
| --- | --- | --- | --- |
| **Hostinger VPS** (KVM 1) | 1 vCPU, 4 GB | ~R$ 30–50/mês | Painel em português, suporte em português. Boa escolha se você já usa. Pegue **VPS**, não "hospedagem de site" |
| **Oracle Cloud Free Tier** | 1 vCPU ARM, 6 GB | **grátis** | Sem custo permanente. O cadastro exige cartão e às vezes dá trabalho |
| **Contabo** | 4 vCPU, 6 GB | ~€ 5/mês | Muita máquina por pouco; latência maior (Alemanha/EUA) |
| **DigitalOcean / Vultr / Linode** | 1 vCPU, 1 GB | ~US$ 5–6/mês | Documentação excelente, datacenter em São Paulo |
| **Railway / Render** | — | grátis limitado, ~US$ 5/mês | Mais fácil de subir (`git push` e pronto), mas **precisa de disco persistente** para o SQLite |

Se você quer o caminho mais curto e não se incomoda de pagar em dólar:
**Railway**. Se quer o mais barato e ter controle: **Hostinger VPS** ou
**Oracle Free**.

---

### Caminho A — VPS com Ubuntu (recomendado)

Contrate a VPS escolhendo **Ubuntu 24.04**. Você vai receber um IP e uma senha
de `root`. Conecte pelo terminal (no Windows, o PowerShell já tem `ssh`):

```bash
ssh root@SEU_IP
```

**1. Atualize e instale o Node 22**

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git build-essential
```

**2. Crie um usuário sem privilégio para o jogo**

Rodar um servidor como `root` é pedir problema.

```bash
adduser --disabled-password --gecos "" resenha
```

**3. Mande o código para o servidor**

O jeito mais prático é pelo Git: crie um repositório (pode ser privado) no
GitHub com o conteúdo da pasta `ResenhaPG web` e clone lá.

```bash
su - resenha
git clone https://github.com/SEU_USUARIO/SEU_REPO.git jogo
cd jogo
npm ci --omit=dev
```

Se preferir sem Git, copie do seu PC com `scp`:

```bash
# rode isso no SEU computador, não na VPS
scp -r "C:\Users\caio\Desktop\ResenhaPG\ResenhaPG web" resenha@SEU_IP:/home/resenha/jogo
```

**4. Suba com o PM2**

O PM2 mantém o processo no ar, reinicia se ele cair e volta sozinho depois de
um reboot da máquina. O arquivo `ecosystem.config.cjs` já está pronto.

```bash
npm install -g pm2          # como root: sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                 # mostra um comando para rodar como root; rode-o
```

Confira: `pm2 logs resenha` deve mostrar `⚔️ Resenha RPG no ar`.

**5. Ponha o Nginx na frente**

Assim o jogo atende na porta 80/443 em vez de `:3000`, e o WebSocket do chat
passa direto.

```bash
# como root
apt install -y nginx
```

Crie `/etc/nginx/sites-available/resenha`:

```nginx
server {
    listen 80;
    server_name rpg.seudominio.com.br;   # ou só o IP, se não tiver domínio

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Estas três linhas são o que faz o chat funcionar: sem elas o
        # WebSocket não passa pelo proxy e o jogo fica sem tempo real.
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Uma raid grande leva alguns segundos para resolver.
        proxy_read_timeout 120s;
    }
}
```

Ative e recarregue:

```bash
ln -s /etc/nginx/sites-available/resenha /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

**6. HTTPS de graça (se você tiver um domínio)**

Aponte um subdomínio (`rpg.seudominio.com.br`) para o IP da VPS num registro
`A`, espere alguns minutos e rode:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d rpg.seudominio.com.br
```

O Certbot ajusta o Nginx e renova sozinho. **Faça isso.** O cookie de sessão
está marcado como `secure` em produção — ou seja, ele só viaja por HTTPS.

> **Sem domínio?** Dá para jogar direto no IP (`http://SEU_IP`), mas aí o
> login não vai funcionar com `NODE_ENV=production`. Troque para
> `NODE_ENV=development` no `ecosystem.config.cjs` — o que significa senha e
> cookie viajando em texto aberto. Serve para testar; para jogar de verdade,
> registre um domínio (uns R$ 40/ano) e use HTTPS.

**7. Feche o resto das portas**

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Pronto. Mande o link para o grupo.

**Para atualizar depois de mexer no código:**

```bash
ssh resenha@SEU_IP
cd jogo && git pull && npm ci --omit=dev && pm2 restart resenha
```

---

### Caminho B — Railway (o mais rápido)

1. Suba o código para um repositório no GitHub.
2. Em [railway.app](https://railway.app), **New Project → Deploy from GitHub
   repo** e escolha o repositório.
3. O Railway detecta o `Dockerfile` e sobe sozinho.
4. **Isto é o passo que não pode ser esquecido:** em **Variables**, defina
   `DB_DIR=/dados`; em **Settings → Volumes**, crie um volume montado em
   `/dados`. Sem o volume, todo deploy apaga as contas e os personagens.
5. Em **Settings → Networking → Generate Domain**, pegue a URL pública. O
   HTTPS já vem pronto.

Render e Fly.io seguem a mesma ideia: container + disco persistente montado
onde `DB_DIR` aponta.

---

### Caminho C — Docker em qualquer lugar

Se a máquina tem Docker:

```bash
docker compose up -d
```

O `docker-compose.yml` já cria o volume `dados`. Para ver os logs:
`docker compose logs -f`.

---

## Variáveis de ambiente

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `3000` | Porta em que o servidor escuta |
| `HOST` | `0.0.0.0` | Endereço; use `127.0.0.1` quando houver Nginx na frente |
| `NODE_ENV` | — | Em `production`, o cookie de sessão exige HTTPS |
| `DB_DIR` | `./dados` | Pasta do banco |
| `DB_PATH` | `$DB_DIR/resenha.db` | Caminho completo do arquivo, se quiser mandar direto |

---

## Backup

Todo o servidor — contas, personagens, mochilas, chat — cabe em um arquivo.

```bash
# na VPS, um backup diário às 4h que guarda os últimos 14 dias
mkdir -p ~/backups
crontab -e
```

Acrescente:

```cron
0 4 * * * sqlite3 /home/resenha/jogo/dados/resenha.db ".backup '/home/resenha/backups/resenha-$(date +\%F).db'" && find /home/resenha/backups -name '*.db' -mtime +14 -delete
```

(`apt install -y sqlite3` se ainda não tiver.)

Use `.backup` e não `cp`: o banco roda em modo WAL, e copiar o arquivo com o
servidor escrevendo pode capturar um estado inconsistente.

Para restaurar, pare o serviço, troque o arquivo e suba de novo:

```bash
pm2 stop resenha
cp ~/backups/resenha-2026-09-12.db ~/jogo/dados/resenha.db
rm -f ~/jogo/dados/resenha.db-wal ~/jogo/dados/resenha.db-shm
pm2 start resenha
```

---

## Ajustar o jogo

Tudo que é número vive em `server/config.js`, num objeto só. Nenhum valor de
balanceamento está espalhado pelo resto do código — foi essa disciplina que
tornou o balanceamento por simulação possível, e vale manter.

Alguns que você talvez queira mexer:

| Parâmetro | Padrão | Efeito |
| --- | --- | --- |
| `rpg.cooldownSummonSeconds` | `10` | Espera entre duas caçadas |
| `rpg.fogueiraMinutos` | `1` | Quanto a rampa da fogueira leva para encher a vida |
| `rpg.feridoMinutos` | `2` | Quanto tempo a derrota deixa o personagem ferido |
| `rpg.ofertaMinutos` | `5` | Quanto uma oferta de item fica de pé |
| `rpg.goldInicial` | `200` | Com o que o novato começa |
| `rpg.escalaEndgame` | — | A dificuldade acima do nível 40. `teto: {...}` tudo em `0` desliga |
| `rpg.raid.minJogadores` | `3` | Quantos precisa para começar uma raid |
| `rpg.abismo.nivelMinimo` | `40` | Quando o Abismo abre |
| `rpg.evolucao.custoGold` | `5k / 80k / 400k` | Preço de cada degrau do Rito |
| `web.maxPersonagens` | `10` | Personagens por conta |
| `web.chatCooldownSegundos` | `1` | Espera entre duas mensagens no chat |

> `fogueiraMinutos` e `feridoMinutos` estão em 1 e 2 (no bot eram 2 e 5) —
> foram baixados para testar sem esperar. Suba de volta quando o servidor
> entrar em uso de verdade, se quiser o ritmo original.

Se a transferência de gold entre jogadores não fizer sentido no seu grupo
(uma conta pode ter 10 personagens, e dá para empilhar gold em um deles),
basta remover a rota `/mercado/pagar` em
[server/rotas/mercado.js](server/rotas/mercado.js) e a aba "Enviar gold" do
painel.

Depois de mexer em qualquer coisa do `rpg`, rode `npm run balance` e compare
com os alvos do jogo: **~70%** de vitória contra monstro comum, **~55%**
contra elite e **~50%** contra chefe de marco, com equipamento raro acima do
nível 40.

---

## Como se joga

**Tela principal.** À esquerda a aventura: a narrativa e o menu de ações
numerado (as teclas `1` a `9` funcionam). No meio a ficha do personagem e os
botões para os outros lugares. À direita o chat.

**O laço do jogo.** Caçar dá XP, gold e equipamento. A cada 5 níveis, a
partir do 10, o nível **trava** até você derrubar o chefe daquele marco — o
XP continua entrando, mas o nível não sobe. O gold vai para a loja, o
ferreiro e o feiticeiro. Nos níveis 50, 150 e 200 abre o Rito, e cada degrau
dá uma habilidade que **acumula** com as anteriores.

**Em paralelo.** Expedições rendem com o navegador fechado. Raids juntam de 3
a 10 pessoas contra um chefe grande. PvP é duelo com ranking Elo e aposta
opcional. O Abismo, a partir do nível 40, é uma descida solo que sempre
termina em derrota — o que se mede é a profundidade.

**Mercado.** A loja compra por 70% do valor de referência e vende por 150% —
é essa margem que faz a negociação valer a pena. Como 40% dos drops caem fora
da sua classe (de propósito), o Mago que recebe um arco tem motivo para
procurar o Arqueiro. Oferecer uma peça abre uma proposta que fica de pé por 5
minutos; **nada é retido** até o aceite: o item continua com quem vende e o
gold com quem compra. Preço 0 é presente, e ainda assim precisa ser aceito.
Gold avulso vai direto, sem aceite.

**Estados que bloqueiam.** Ferido (5 min, ou uma bandagem), descansando na
fogueira (2 min até a vida cheia), em expedição (não luta), travado por chefe
(não sobe de nível). A vida regenera sozinha, 5% do máximo por minuto.
