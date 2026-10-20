// @vitest-environment happy-dom
// Usabilidade e acessibilidade (docs/usabilidade-acessibilidade.md): página não encontrada,
// terminal que não repete o que o resumo já falou, foco que não se perde ao fechar janelas,
// e nada que se mexa sozinho por mais de 5 s.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderNaoEncontrada } from '../src/ui/nao-encontrada.js';
import { criarTerminal } from '../src/ui/terminal.js';
import { iniciarFlutuantes } from '../src/ui/menu.js';
import { iniciarMuralApoio } from '../src/ui/mural-apoio.js';
import { iniciarMaisAcoes } from '../src/ui/mais-acoes.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const css = readFileSync(resolve(process.cwd(), 'src/acessibilidade-ux.css'), 'utf8');
const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

describe('página não encontrada', () => {
  it('diz o que houve, em linguagem simples, e oferece dois caminhos', () => {
    const el = document.createElement('main');
    renderNaoEncontrada(el);
    expect(el.querySelector('h1').textContent).toContain('Página não encontrada');
    expect(el.textContent).toContain('progresso continua salvo');
    expect([...el.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['#/trilha', '#/']);
  });

  it('explica o link compartilhado cortado e o exercício que não existe', () => {
    const el = document.createElement('main');
    renderNaoEncontrada(el, { motivo: 'link' });
    expect(el.textContent).toContain('chegou incompleto');
    renderNaoEncontrada(el, { motivo: 'item' });
    expect(el.textContent).toContain('não existe mais');
  });

  it('tem uma tela própria no index.html e no roteador', () => {
    expect(html).toContain('<main id="tela-nao-encontrada"');
    expect(main).toContain("import './acessibilidade-ux.css'");
  });
});

describe('terminal', () => {
  it('fica mudo enquanto o resumo é falado e depois volta a ser uma região viva', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<pre id="t" role="log" aria-live="polite"></pre>';
    const pre = document.getElementById('t');
    const terminal = criarTerminal(pre);
    terminal.silenciar(60_000);
    expect(pre.getAttribute('aria-live')).toBe('off');
    terminal.silenciar(800);
    vi.advanceTimersByTime(799);
    expect(pre.getAttribute('aria-live')).toBe('off');
    vi.advanceTimersByTime(1);
    expect(pre.getAttribute('aria-live')).toBe('polite');
    vi.useRealTimers();
  });
});

describe('foco ao fechar janelas', () => {
  beforeEach(() => {
    document.body.innerHTML = corpo;
    HTMLDialogElement.prototype.showModal ??= function showModal() { this.open = true; };
    HTMLDialogElement.prototype.close ??= function close() { this.open = false; this.dispatchEvent(new Event('close')); };
  });

  it('no celular, fechar o tutorial devolve o foco ao ⚙️ (o ❓ ficou escondido)', async () => {
    window.matchMedia = (q) => ({ matches: q.includes('max-width: 760px'), media: q, addEventListener() {}, removeEventListener() {} });
    iniciarFlutuantes();
    document.getElementById('btn-flutuantes').click();
    document.getElementById('btn-tutorial').click();
    expect(document.getElementById('flutuantes-itens').hidden).toBe(true);
    document.getElementById('tutorial').dispatchEvent(new Event('close'));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(document.getElementById('btn-flutuantes'));
  });

  it('fechar o mural de apoio leva o foco ao título da tela', async () => {
    document.getElementById('tela-landing').innerHTML = '<h1>Olá</h1>';
    iniciarMuralApoio();
    document.getElementById('btn-fechar-mural-apoio').click();
    document.getElementById('dialogo-apoio').dispatchEvent(new Event('close'));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement?.textContent).toBe('Olá');
  });
});

describe('⋯ Mais ações', () => {
  beforeEach(() => { document.body.innerHTML = corpo; iniciarMaisAcoes(); });
  const botao = () => document.getElementById('btn-mais-acoes');
  const menu = () => document.getElementById('menu-mais-acoes');

  it('à vista ficam só o caminho principal e o botão do menu', () => {
    const visiveis = [...document.querySelectorAll('.acoes > button')].map((b) => b.id);
    expect(visiveis).toEqual(['btn-executar', 'btn-enviar']);
    expect(menu().hidden).toBe(true);
  });

  it('cada ação do menu tem texto e uma explicação curta', () => {
    for (const b of menu().querySelectorAll('button')) {
      expect(b.textContent.replace(/\s+/g, ' ').trim(), b.id).toMatch(/^\S+ \p{L}+.* \p{L}/u);
      expect(b.querySelector('small')?.textContent.length, b.id).toBeGreaterThan(8);
      expect(b.hasAttribute('aria-label'), b.id).toBe(false);
    }
  });

  it('abre e fecha pelo botão, com aria-expanded; Esc fecha e devolve o foco', () => {
    botao().click();
    expect(menu().hidden).toBe(false);
    expect(botao().getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu().hidden).toBe(true);
    expect(botao().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botao());
  });

  it('escolher uma ação fecha o menu', () => {
    botao().click();
    menu().querySelector('button').click();
    expect(menu().hidden).toBe(true);
  });
});

describe('movimento', () => {
  it('as animações da trilha param sozinhas antes de 5 s (WCAG 2.2.2)', () => {
    expect(css).toMatch(/\.tela-inicio \*[\s\S]*animation-iteration-count: 2 !important/);
  });
});
