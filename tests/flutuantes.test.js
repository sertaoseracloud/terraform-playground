// @vitest-environment happy-dom
// Botões flutuantes (tutorial, acessibilidade, privacidade): no celular viram um só botão ⚙️ que
// abre e fecha o grupo, para não cobrir o editor; no desktop, os três ficam sempre à mostra.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { iniciarFlutuantes } from '../src/ui/menu.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const estilo = readFileSync(resolve(process.cwd(), 'src/estilo.css'), 'utf8');

const btn = () => document.getElementById('btn-flutuantes');
const itens = () => document.getElementById('flutuantes-itens');

function montar({ celular }) {
  document.body.innerHTML = corpo;
  window.matchMedia = (q) => ({ matches: celular && q.includes('max-width: 760px'), media: q, addEventListener() {}, removeEventListener() {} });
  iniciarFlutuantes();
}

/** Todos os blocos @media (max-width: Npx) { ... } do CSS, com as chaves balanceadas. */
function medias(css, largura) {
  const blocos = [];
  for (let inicio = css.indexOf(`@media (max-width: ${largura}px) {`); inicio >= 0; inicio = css.indexOf(`@media (max-width: ${largura}px) {`, inicio + 1)) {
    let nivel = 0;
    for (let i = css.indexOf('{', inicio); i < css.length; i++) {
      if (css[i] === '{') nivel++;
      if (css[i] === '}' && --nivel === 0) { blocos.push(css.slice(inicio, i + 1)); break; }
    }
  }
  return blocos;
}

describe('botões flutuantes no celular', () => {
  beforeEach(() => montar({ celular: true }));

  it('começa fechado: só o botão ⚙️, e os três itens fora da ordem de foco', () => {
    expect(btn().getAttribute('aria-expanded')).toBe('false');
    expect(btn().getAttribute('aria-controls')).toBe('flutuantes-itens');
    expect(btn().getAttribute('aria-label')).toBe('Ajuda e preferências');
    expect(itens().hidden).toBe(true);
    expect(itens().querySelectorAll('#btn-tutorial, #btn-acessibilidade, [data-menu="privacidade"]')).toHaveLength(3);
  });

  it('tocar no botão abre; tocar de novo fecha', () => {
    btn().click();
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    expect(itens().hidden).toBe(false);
    btn().click();
    expect(btn().getAttribute('aria-expanded')).toBe('false');
    expect(itens().hidden).toBe(true);
  });

  it('escolher um item fecha', () => {
    btn().click();
    document.getElementById('btn-acessibilidade').click();
    expect(itens().hidden).toBe(true);
  });

  it('Esc fecha e devolve o foco ao botão', () => {
    btn().click();
    document.getElementById('btn-tutorial').focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(itens().hidden).toBe(true);
    expect(document.activeElement).toBe(btn());
  });

  it('tocar fora fecha', () => {
    btn().click();
    document.body.click();
    expect(itens().hidden).toBe(true);
  });
});

describe('botões flutuantes no desktop', () => {
  it('os três ficam sempre à mostra', () => {
    montar({ celular: false });
    expect(itens().hidden).toBe(false);
  });

  it('CSS: o botão ⚙️ só aparece no celular', () => {
    const celular = medias(estilo, 760);
    const fora = celular.reduce((css, bloco) => css.replace(bloco, ''), estilo);
    expect(fora).toMatch(/#btn-flutuantes\s*\{[^}]*display:\s*none/);
    expect(celular.join(' ')).toMatch(/#btn-flutuantes\s*\{[^}]*display:\s*grid/);
  });
});
