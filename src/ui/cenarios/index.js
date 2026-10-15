// Cenários da trilha: um mapa de tiles em pixel art (estilo Tibia) atrás do caminho de cada
// módulo, com personagens andando de tile em tile. É pura decoração: a camada fica escondida do
// leitor de tela (aria-hidden) e não recebe clique nem foco. Quem desenha o mapa e move os
// personagens é o palco (palco.js), depois que a trilha é renderizada.
import { sertao } from './sertao.js';
import { vale } from './vale.js';
import { gelo } from './gelo.js';
import { fogo } from './fogo.js';
import { rio } from './rio.js';
import { cidade } from './cidade.js';
import { jardim } from './jardim.js';

export const CENARIOS = Object.fromEntries([sertao, vale, gelo, fogo, rio, cidade, jardim].map((c) => [c.id, c]));

/**
 * Camada decorativa do cenário (ou '' se o módulo não tem cenário). A semente (o id do módulo)
 * faz cada módulo ter sempre o mesmo mapa. O palco tem a altura da tela e acompanha a rolagem:
 * o módulo tem milhares de pixels.
 */
export function htmlDoCenario(id, semente = id) {
  if (!CENARIOS[id]) return '';
  return `<div class="cenario cenario-${id}" aria-hidden="true" data-cenario="${id}" data-semente="${semente}"><div class="cenario-palco"></div></div>`;
}
