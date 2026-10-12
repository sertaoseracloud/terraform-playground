import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { BADGES, svgBadge, svgCartao } from '../src/badges.js';
import { CERTIFICADOS, SITE } from '../src/certificados.js';

const publico = (caminho) => new URL(`../public/${caminho}`, import.meta.url);

describe('badges', () => {
  it('cada certificado tem um badge', () => {
    expect(Object.keys(BADGES).sort()).toEqual(Object.keys(CERTIFICADOS).sort());
  });

  it('gera SVG com ids únicos a cada desenho', () => {
    const a = svgBadge('basico');
    const b = svgBadge('basico');
    const id = (svg) => svg.match(/id="([^"]+)fundo"/)[1];
    expect(id(a)).not.toBe(id(b));
    expect(svgCartao('final')).toContain('viewBox="0 0 1200 627"');
  });

  // Os arquivos de public/ saem de `npm run badges`; este teste avisa se alguém esqueceu de rodar.
  it.each(Object.keys(CERTIFICADOS))('%s: PNGs e página do LinkedIn estão em public/', (id) => {
    expect(existsSync(publico(`badges/${id}.png`))).toBe(true);
    expect(existsSync(publico(`badges/${id}-card.png`))).toBe(true);
    const pagina = readFileSync(publico(`badge/${id}/index.html`), 'utf8');
    expect(pagina).toContain(`<meta property="og:image" content="${SITE}badges/${id}-card.png">`);
    expect(pagina).toContain(CERTIFICADOS[id].titulo);
  });
});
