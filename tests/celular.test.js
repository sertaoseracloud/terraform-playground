// Celular (iPhone 15, 393px): nada da trilha nem do tutorial passa da borda da tela. O happy-dom não
// calcula layout, então o teste confere as regras de CSS que impedem cada estouro encontrado.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const caminho = readFileSync(resolve(process.cwd(), 'src/caminho.css'), 'utf8');
const estilo = readFileSync(resolve(process.cwd(), 'src/estilo.css'), 'utf8');

/** O corpo de um @media (max-width: Npx) { ... }, com as chaves balanceadas. */
function media(css, largura) {
  const inicio = css.indexOf(`@media (max-width: ${largura}px) {`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  let nivel = 0;
  for (let i = css.indexOf('{', inicio); i < css.length; i++) {
    if (css[i] === '{') nivel++;
    if (css[i] === '}' && --nivel === 0) return css.slice(inicio, i + 1);
  }
  return '';
}

describe('a trilha cabe na largura do celular', () => {
  it('a coluna única da trilha pode encolher (minmax(0, 1fr), e não 1fr, que não desce do conteúdo mais largo)', () => {
    expect(media(caminho, 900)).toMatch(/\.caminho-pagina\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('os contadores do cabeçalho do módulo quebram linha em vez de passar da borda', () => {
    expect(media(caminho, 560)).toMatch(/\.unidade-progresso\s*\{[^}]*flex-wrap:\s*wrap/);
  });
});

describe('o tutorial cabe na largura do celular', () => {
  it('os botões quebram linha, e o Próximo fica à direita', () => {
    expect(estilo).toMatch(/\.tutorial-botoes\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(estilo).toMatch(/\.tutorial-botoes\s*\{[^}]*justify-content:\s*flex-end/);
  });
});
