/**
 * A chave de arte: o identificador que liga um nome do jogo a um arquivo de
 * `public/arte`.
 *
 * Minusculo, sem acento, hifen no lugar do espaco. "Vigia do Poço" vira
 * `vigia-do-poco`, "Ruínas de Valkhar" vira `ruinas-de-valkhar`. A mesma
 * conta acontece do outro lado, em scripts/arte.js, a partir do NOME DA
 * PASTA ou do arquivo — renomear um ato, um habitante ou uma profundidade
 * aqui pede renomear a pasta la, senao a cena entra com a arte de reserva.
 *
 * Mora sozinho num modulo sem importacao nenhuma de proposito: quem precisa
 * dele (rota.js, abismo.js) esta em lados diferentes do grafo de modulos, e
 * uma folha nao fecha ciclo com ninguem.
 */
export const chaveDeArte = (nome) =>
  String(nome)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
