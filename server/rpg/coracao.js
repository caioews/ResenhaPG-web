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
 * Ele NAO tem um numero fixo: nasce dos atributos de quem entrou. Um grupo
 * de nivel 300 legendario e um grupo cheio de prestigio (que carrega
 * equipamento e reforco de sobra) chegam com forcas bem diferentes, e o
 * chefe responde a qual delas aparecer — e um espelho, nao uma regua fixa:
 * a vida dele cresce com o ATAQUE medio do grupo (quanto mais elas batem,
 * mais ele precisa aguentar) e o ataque dele cresce com a VIDA media do
 * grupo (quanto mais elas aguentam, mais forte ele bate de volta). Um
 * jogador muito forte que entre sozinho nao encontra um chefe fraco:
 * encontra um mais forte que ele. Calibrado por `npm run coracao`, que joga
 * a luta por simulacao contra um grupo de nivel 300 legendario e mira nela
 * continuar sofrida MESMO ASSIM.
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

/** A média de um atributo entre quem entrou. */
const mediaDe = (atributosDoGrupo, chave) =>
  atributosDoGrupo.reduce((s, a) => s + a[chave], 0) / atributosDoGrupo.length

/**
 * O chefe pronto para lutar. `atributosDoGrupo` e uma lista de
 * `{ hp, atq, def, agi }` — os atributos JA PRONTOS (classe + nivel +
 * prestigio + equipamento, rpg/jogador.js `atributos`) de cada participante,
 * na ordem em que entraram na arena.
 */
export function criarCoracao(atributosDoGrupo) {
  const c = config.rpg.coracao
  const jogadores = atributosDoGrupo.length
  const escala = Math.pow(Math.max(1, jogadores), c.escalaPorJogador)

  const atqMedio = mediaDe(atributosDoGrupo, 'atq')
  const hpMedio = mediaDe(atributosDoGrupo, 'hp')

  // Cada jogador acima do minimo endurece o chefe um pouco mais: so a vida
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
    hp: Math.round(atqMedio * c.hpPorAtaqueDoGrupo * escala),
    atq: Math.round(hpMedio * c.atqPorVidaDoGrupo * (1 + extras * c.atqPorJogadorExtra)),
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
