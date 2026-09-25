/**
 * O Coração do Abismo Demoníaco: o chefe final da rota.
 *
 * Vive no ultimo ato (a fase 10 do ato 51) e nao e uma luta de uma pessoa so.
 * E uma raid: colossal, fora da arena onde os jogadores pisam, e so cai em
 * grupo — no minimo `config.rpg.coracao.minJogadores`. Quem vence o resto da
 * rota chega ate ele, e todo mundo que chega e levado para a mesma arena
 * (server/final.js), como todo mundo se junta na taberna.
 *
 * O combate em si e o de grupo comum (lutarEmGrupo, rpg/combate.js): cada
 * rodada todos batem nele e ele bate de volta, com o golpe em area de
 * sempre. O que e dele so:
 *
 *   o laser     no lugar do golpe da rodada, atira em alguns jogadores de uma
 *               vez, e nao da para desviar
 *   a furia     abaixo de 40% de vida ele enfurece: bate mais forte e atira
 *               com mais frequencia
 *
 * Ele nao escala com o nivel de quem entra. E calibrado para um grupo de
 * nivel 300 com equipamento lendario e ainda assim ser sofrido (npm run
 * coracao); quem chega mais fraco vai apanhar, e voltar depois.
 */
import { config } from '../config.js'

export const CORACAO = {
  id: 'coracao',
  nome: 'O Coração do Abismo',
  emoji: '🫀',
  descricao:
    'Tudo o que o Abismo engoliu bate aqui dentro. Colossal, preso à própria arena, ele não vai a lugar nenhum — ' +
    'quem quiser passar tem de encará-lo, e em grupo.',
}

/** O chefe pronto para lutar, para um grupo deste tamanho. */
export function criarCoracao(jogadores) {
  const c = config.rpg.coracao
  const escala = Math.pow(Math.max(1, jogadores), c.escalaPorJogador)

  // Cada jogador acima do minimo endurece o chefe: ataque maior. So a vida
  // cresce linear com o grupo, mas o dano dele nao — e com dez jogadores a
  // luta viraria passeio.
  const extras = Math.max(0, jogadores - c.minJogadores)

  return {
    id: CORACAO.id,
    nome: CORACAO.nome,
    emoji: CORACAO.emoji,
    descricao: CORACAO.descricao,
    duro: true,
    nivel: c.nivel,
    hp: Math.round(c.hpPorJogador * escala),
    atq: Math.round(c.atq * (1 + extras * c.atqPorJogadorExtra)),
    def: c.def,
    agi: c.agi,
    areaCada: c.areaCada,
    areaMultiplicador: c.areaMultiplicador,
    laser: { ...c.laser },
    furia: { ...c.furia },
    maxRodadas: c.maxRodadas,
    // A tela precisa do retrato de cada rodada para as barras de vida.
    estados: true,
  }
}
