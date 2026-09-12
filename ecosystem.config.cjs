/**
 * Configuração do PM2 — o jeito mais simples de manter o jogo no ar numa VPS.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup     # volta sozinho depois de reiniciar a máquina
 *   pm2 logs resenha
 *
 * Uma instância só, de propósito: os personagens vivem em memória e as salas
 * de raid e os desafios de PvP também. Com duas instâncias, metade do grupo
 * não veria a sala da outra metade. Se um dia precisar escalar, o caminho é
 * mover esse estado para fora do processo (Redis), não subir réplicas.
 */
module.exports = {
  apps: [
    {
      name: 'resenha',
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Com Nginx na frente, o Node não precisa ser alcançável de fora.
        HOST: '127.0.0.1',
      },
      max_memory_restart: '400M',
      autorestart: true,
      // Se cair em laço, para de tentar em vez de encher o disco de log.
      max_restarts: 10,
      min_uptime: '20s',
    },
  ],
}
