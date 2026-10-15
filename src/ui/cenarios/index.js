// Cenários da trilha: um mapa de tiles em pixel art (estilo Tibia) atrás do caminho de cada
// módulo, com personagens andando de tile em tile. É pura decoração: a camada fica escondida do
// leitor de tela (aria-hidden) e não recebe clique nem foco. Quem desenha o mapa e move os
// personagens é o palco (palco.js), depois que a trilha é renderizada.
import { canteiro } from './canteiro.js';
import { porto } from './porto.js';
import { ceu } from './ceu.js';
import { cidade } from './cidade.js';

export const CENARIOS = Object.fromEntries([canteiro, porto, ceu, cidade].map((c) => [c.id, c]));

/**
 * Camada decorativa do cenário (ou '' se o módulo não tem cenário). A semente (o id do módulo)
 * faz cada módulo ter sempre o mesmo mapa, e `feitos` (os exercícios resolvidos do módulo) faz a
 * vila crescer (vila.js). O palco cobre o módulo inteiro e rola junto com a página.
 */
export function htmlDoCenario(id, semente = id, feitos = 0) {
  if (!CENARIOS[id]) return '';
  return `<div class="cenario cenario-${id}" aria-hidden="true" data-cenario="${id}" data-semente="${semente}" data-feitos="${feitos}"><div class="cenario-palco"></div></div>`;
}
