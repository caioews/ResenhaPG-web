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
| 75 habilidades declarativas (70 do bot + 5 passivas de classe base) e a regra de fusão de efeitos | `server/rpg/habilidades.js` |
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

Mudanças pedidas para a versão web. Fora estas, os números e as regras são os
mesmos.

| O que mudou | No bot | Aqui |
| --- | --- | --- |
| **Fogueira** | a vida regenerava no ritmo normal e **saltava** para o máximo quando os minutos acabavam | a vida sobe **em rampa**, do que havia quando o fogo foi aceso até o máximo no instante do fim. Levantar antes da hora congela o que já subiu, em vez de perder |
| **Presente de item** | `/daritem` entregava na hora | vira uma oferta de preço 0, que ainda precisa ser aceita — assim ninguém recebe item com a mochila cheia |
| **Clérigo no fim da árvore** | Ministro da Luz → Mão Viva do Divino (habilidade Mão Viva) | **A Última Luz** → **O Homem Mais Próximo de Deus** (habilidade **Milagre**). Os ids internos continuam os antigos, então quem já evoluiu não perde nada |
| **Milagre** | — | regenera 2% por turno, leva 9% menos dano e soma a **cura do grupo**: em raid e evento de grupo, a cada turno dele, cura em 5% da vida máxima todos os aliados que ainda estão de pé |
| **Feitiços** | só na arma | na arma **e** no item secundário. Os das duas peças equipadas valem juntos; o mesmo feitiço nas duas conta uma vez só |
| **Balanceamento das classes** | as habilidades do bot | recalibradas por simulação para as classes de um mesmo degrau terem força parecida. Ver [Balanceamento das classes](#balanceamento-das-classes) |

A rampa da fogueira continua sem temporizador nenhum: o que existe é o par
(vida, instante) gravado no acender e o horário de término, e a conta é feita
na leitura (`vidaAtual`, em `server/rpg/jogador.js`). O servidor pode cair e
voltar no meio do descanso sem perder nada, e o navegador refaz exatamente a
mesma conta a cada segundo só para a barra subir na tela.

### Balanceamento das classes

Medido com `npm run classes`, que junta PvP (todas contra todas) e PvE (comum,
elite e chefe) numa nota de força por classe. A faixa é da classe mais fraca à
mais forte de cada degrau, com equipamento raro:

| Degrau | Antes | Depois |
| --- | --- | --- |
| Classes base (nível 1–49) | 46–86 | 63–74 |
| Especialidades (nível 50) | 37–80 | 57–69 |
| Maestrias (nível 150) | 34–79 | 55–68 |
| Apoteoses (nível 200) | 24–83 | 53–74 |

O que mudou:

- **Clérigo, linha do Sacerdote.** A Bênção recuperava 10% da vida por turno
  e somava com a Graça e o Milagre: no fim da árvore eram 20% por turno, e ele
  vencia 98% dos duelos e descia o dobro do Abismo. Agora são 4% + 2% + 2%.
  Continua entre os que mais descem no Abismo, sem ser imortal.
- **Passivas nas classes base.** Mago (Foco Arcano), Arqueiro (Olho de Águia),
  Ladino (Instinto), Duelista (Guarda Alta) e Bardo (Cadência) nascem com uma
  habilidade. Guerreiro e Clérigo não: a vida e a defesa deles já dominavam o
  PvP. Como toda habilidade, a passiva vale para a linhagem inteira.
- **Buffs nas habilidades fracas** de todos os degraus, no tema de cada uma
  (mais dano, perfuração, crítico ou resistência). Nenhum inimigo mudou, nenhum
  atributo de classe mudou — só habilidades.
- **Três habilidades que não faziam nada.** Efeito que é objeto (Fúria,
  Execução, Maldição) não soma com o do degrau de baixo: fica o mais forte. A
  Fúria do Campeão da Arena e do Imperador do Combate e a Execução Sombria do
  Ceifador Noturno eram mais fracas que as do Gladiador e do Assassino, e eram
  descartadas. Agora superam as anteriores.

Os atributos base continuam os da especificação (`npm run conformidade`
passa). O que ainda fica acima da faixa é o Punho da Lei Divina, que não recebeu
buff nenhum — só desceria com um nerf.

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
- **Eventos aleatórios** (`server/eventos.js`): de tempos em tempos o servidor
  chama todo mundo on-line — horda de goblins, bandidos, alcateia, mortos-vivos,
  um dragão, uma fenda, festa na taverna, estrela cadente. Aparece um pop-up e
  cada um decide se vai. Os de grupo lutam como raid. Ver
  [Eventos](#eventos-aleatórios).
- **Alertas sonoros** para o que chega sem pedir: evento, raid aberta, desafio
  de duelo, oferta e pagamento no mercado. Sintetizados no navegador, sem
  arquivo de áudio; o botão **Som** no menu liga e desliga.
- **Mochila em divisões** — utilizáveis, armas, secundárias, elmos, armaduras e
  anéis, com filtro — e o que está equipado sempre no topo.
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

```bash
npm run classes
```

Mede as classes umas contra as outras: para cada degrau da árvore, a vitória
média em duelo contra todas as outras do mesmo nível e a vitória contra
monstro comum, elite e chefe, somadas numa nota de força. Marca com ▼ quem
ficou muito abaixo da mediana do degrau e com ▲ quem ficou muito acima. Rode
depois de mexer em qualquer habilidade (`server/rpg/habilidades.js`). Use
`N=60 npm run classes` para uma passada rápida e `TIERS=4` para medir um
degrau só.

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
│   ├── grupo.js        A luta de grupo que a raid e os eventos dividem
│   ├── eventos.js      Catálogo, agenda e resolução dos eventos aleatórios
│   ├── admin.js        Comandos de administrador no chat (/evento)
│   ├── ambiente.js     Lê o .env da raiz, se houver
│   ├── realtime.js     Chat, quem está on-line, avisos
│   ├── rotas/          contas · combate · mochila · cidade · social · mercado · eventos
│   └── rpg/            O motor, portado do bot
├── public/
│   ├── index.html
│   ├── css/estilo.css
│   └── js/             nucleo · narrativa · paineis · eventos · som · app
├── scripts/            conformidade.js · simulador.js · classes.js · atualizar.sh
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

> **Quem roda o quê.** Instalar programas, mexer no Nginx e no firewall é
> trabalho de `root`. **O jogo em si nunca roda como root** — ele roda como o
> usuário `resenha`, criado no passo 2. Cada bloco abaixo começa dizendo em
> qual dos dois você deve estar. Para sair de `resenha` e voltar a `root`,
> digite `exit`.

**1. Atualize e instale o que é preciso** — *como `root`*

Tudo que é instalação global entra aqui de uma vez, inclusive o PM2. Assim o
usuário `resenha` não precisa de permissão para instalar nada.

```bash
apt update && apt upgrade -y
```

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
```

```bash
apt install -y nodejs git build-essential
```

```bash
npm install -g pm2
```

**2. Crie um usuário sem privilégio para o jogo** — *como `root`*

Um servidor exposto à internet rodando como `root` é pedir problema: qualquer
falha no processo vira controle da máquina inteira.

```bash
adduser --disabled-password --gecos "" resenha
```

**3. Mande o código para o servidor** — *como `resenha`*

Entre no usuário do jogo:

```bash
su - resenha
```

E clone o repositório (troque pelo seu endereço):

```bash
git clone https://github.com/SEU_USUARIO/SEU_REPO.git jogo
```

```bash
cd jogo && npm ci --omit=dev
```

Se preferir sem Git, copie do seu PC com `scp` — **este comando roda no seu
computador**, não na VPS:

```bash
scp -r "C:\Users\caio\Desktop\ResenhaPG\ResenhaPG web" resenha@SEU_IP:/home/resenha/jogo
```

**4. Suba com o PM2** — *como `resenha`, dentro de `~/jogo`*

O PM2 mantém o processo no ar e reinicia se ele cair. O arquivo
`ecosystem.config.cjs` já está pronto.

Isso precisa rodar como `resenha`: o PM2 lembra de qual usuário iniciou cada
processo, e é esse usuário que vai ser o dono do arquivo do banco.

```bash
pm2 start ecosystem.config.cjs
```

```bash
pm2 save
```

Confira antes de seguir — deve aparecer `⚔️ Resenha RPG no ar`:

```bash
pm2 logs resenha --lines 20
```

**5. Faça o PM2 voltar sozinho depois de um reboot** — *começa como `resenha`, termina como `root`*

Ainda como `resenha`, rode:

```bash
pm2 startup
```

Ele **não faz nada** — só imprime um comando pronto, parecido com este:

```
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u resenha --hp /home/resenha
```

Copie essa linha. O usuário `resenha` foi criado sem senha, então ele **não
consegue usar `sudo`** — volte para o root e rode lá, **sem o `sudo` do
começo**:

```bash
exit
```

Agora cole a linha que o PM2 imprimiu, tirando o `sudo`. Fica parecida com
esta (confira contra a sua, os caminhos podem variar):

```bash
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u resenha --hp /home/resenha
```

Pronto: o jogo sobe sozinho junto com a máquina.

**6. Ponha o Nginx na frente** — *como `root`*

Assim o jogo atende na porta 80/443 em vez de `:3000`, e o WebSocket do chat
passa direto.

```bash
apt install -y nginx
```

Agora o Nginx precisa de um arquivo de configuração dizendo para onde mandar
as visitas. O bloco abaixo **não é um comando**: é o conteúdo de um arquivo, e
o comando serve justamente para escrevê-lo de uma vez.

Antes de colar, troque `SEU_DOMINIO` na linha `server_name`:

- **com domínio:** `server_name rpg.seudominio.com.br;`
- **sem domínio** (vai jogar pelo IP): `server_name _;` — o `_` significa
  "qualquer endereço"

Cole tudo de uma vez, do `cat` até o `EOF` final:

```bash
cat > /etc/nginx/sites-available/resenha <<'EOF'
server {
    listen 80;
    server_name SEU_DOMINIO;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Estas duas linhas são o que faz o chat funcionar: sem elas o
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
EOF
```

As aspas em `<<'EOF'` importam: sem elas o shell tentaria trocar `$host` e
`$http_upgrade` por variáveis dele, e o arquivo sairia quebrado.

Confira que o arquivo ficou certo:

```bash
cat /etc/nginx/sites-available/resenha
```

Ative o site, tire o padrão do Nginx e recarregue:

```bash
ln -s /etc/nginx/sites-available/resenha /etc/nginx/sites-enabled/
```

```bash
rm -f /etc/nginx/sites-enabled/default
```

```bash
nginx -t && systemctl reload nginx
```

O `nginx -t` tem de responder `syntax is ok` e `test is successful`. Se
reclamar, é erro de digitação no arquivo — refaça o `cat > ...` inteiro.

**7. HTTPS de graça (se você tiver um domínio)** — *como `root`*

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

**8. Feche o resto das portas** — *como `root`*

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Pronto. Mande o link para o grupo.

---

## Atualizar o jogo depois de mexer no código

O caminho é sempre **seu PC → GitHub → servidor**. Editar arquivo direto na
VPS parece atalho, mas quebra o `git pull` seguinte e você perde a alteração
sem perceber.

### No seu PC

```bash
git add -A
```

```bash
git commit -m "descreva o que mudou"
```

```bash
git push
```

### No servidor

O usuário `resenha` não tem senha, então não dá para entrar nele direto por
SSH — entre como `root` e troque de usuário:

```bash
ssh root@SEU_IP
```

```bash
su - resenha
```

E rode o script de atualização:

```bash
~/jogo/scripts/atualizar.sh
```

Ele busca o código novo, reinstala as dependências **só se** o
`package.json` mudou, reinicia o processo e mostra as últimas linhas do log.
Se não houver nada novo, ele avisa e sai sem reiniciar nada.

Na mão, é o mesmo que:

```bash
cd ~/jogo && git pull && pm2 restart resenha
```

**O banco não é tocado.** `dados/` está no `.gitignore`, então as contas, os
personagens e o histórico do chat vivem só no servidor — nenhum `git pull`
passa por cima deles.

### Se algo quebrar depois de uma atualização

Veja o que o servidor está dizendo:

```bash
pm2 logs resenha --lines 40
```

E volte para a versão anterior enquanto investiga:

```bash
cd ~/jogo && git reset --hard HEAD~1 && pm2 restart resenha
```

### Entrar direto como `resenha` (opcional)

Para não ter que passar pelo root toda vez, copie a sua chave pública para
ele — **como `root`**, uma vez só:

```bash
install -d -m 700 -o resenha -g resenha /home/resenha/.ssh && cp ~/.ssh/authorized_keys /home/resenha/.ssh/ && chown resenha:resenha /home/resenha/.ssh/authorized_keys
```

Isso reaproveita a mesma chave com que você já entra como `root`. Depois
disso, `ssh resenha@SEU_IP` funciona.

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
| `ADMINS` | — | Usuários (da conta) que podem usar `/evento` no chat, separados por vírgula |

O servidor lê sozinho um arquivo `.env` na raiz do projeto, se existir. É o
lugar certo para o que é só daquele servidor: o `.env` não vai para o git, então
o `git pull` da atualização nunca briga com ele. Variável que já vem do
ambiente (PM2, Docker) ganha do arquivo.

Para se tornar administrador no servidor (como o usuário `resenha`):

```bash
echo "ADMINS=seu_usuario" >> ~/jogo/.env
```

```bash
pm2 restart resenha
```

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
| `eventos.ligado` | `true` | Liga e desliga os eventos aleatórios |
| `eventos.horaInicio` / `horaFim` | `9` / `24` | Janela do dia em que eventos acontecem (fuso `eventos.fusoHorario`) |
| `eventos.intervaloMinimo` / `Maximo` | `60` / `180` | Minutos sorteados entre um evento e o próximo |
| `eventos.inscricaoMinutos` | `3` | Quanto tempo a chamada fica aberta |

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

---

## Eventos aleatórios

De tempos em tempos (entre 1 e 3 horas, das 9h à meia-noite no horário de
Brasília) o servidor abre a chamada de um evento para todo mundo on-line.
Aparece um pop-up com o que aconteceu e dois botões: **Participar** e **Agora
não**. Quem fechar o pop-up ainda encontra o evento no topo do menu enquanto
a chamada estiver aberta (3 minutos). Quando ela fecha, o evento se resolve
sozinho para quem está na lista, e o resultado aparece na tela da aventura.

| Evento | Tipo | Dificuldade |
| --- | --- | --- |
| 👺 Horda de Goblins | luta em grupo | fácil — dá para vencer sozinho |
| 🏴‍☠️ Bando do Corvo Rubro | luta em grupo | fácil, paga mais gold |
| 🐺 Alcateia da Lua de Sangue | luta em grupo | média, golpe em área frequente |
| 🧟 Legião dos Mortos | luta em grupo | difícil — pede 3 pessoas |
| 🐉 Dragão Errante | luta em grupo | **raid** — pede 4 ou 5, e é o que paga mais |
| 🕳️ Fenda Sombria | cada um sozinho contra uma elite | média, vitória paga o dobro |
| 🍺 Festa na Taverna | sem luta | cura a vida e o ferimento, dá gold |
| ☄️ Estrela Cadente | sem luta | titanita, XP e chance de feitiço |

Regras:

- **Um personagem por conta** em cada evento — senão a conta com dez
  personagens levaria dez vezes o espólio.
- Ferido ou em expedição não entra em evento de luta. A condição é conferida
  de novo quando a chamada fecha.
- Luta de grupo funciona como a raid: todo mundo entra com a vida cheia, o
  inimigo ganha vida com o tamanho do grupo, e derrota deixa todos feridos.
  Não conta no cooldown nem no placar de raids.
- Com ninguém on-line, o evento espera e tenta de novo mais tarde.
- Como as salas de raid, nada fica retido: se o servidor reiniciar com a
  chamada aberta, o evento só some.

A dificuldade de cada inimigo saiu de simulação (time de classes sorteadas,
equipamento raro); a tabela está no comentário do catálogo em
[server/eventos.js](server/eventos.js), junto com os textos, pesos e
recompensas — é lá que se cria um evento novo.

### Chamar um evento na hora

Quem está em `ADMINS` (ver [Variáveis de ambiente](#variáveis-de-ambiente))
pode digitar no chat do jogo. A resposta aparece só para quem digitou.

| Comando | O que faz |
| --- | --- |
| `/evento` | sorteia um evento e abre a chamada |
| `/evento dragao` | abre um evento específico |
| `/evento dragao 30` | abre com a chamada de 30 segundos (para testar) |
| `/evento lista` | mostra os nomes dos eventos |
| `/evento encerrar` | fecha a chamada aberta e resolve agora |
| `/evento proximo` | quando sai o próximo evento sorteado |
