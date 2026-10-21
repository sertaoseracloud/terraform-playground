// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PASSOS, PROBLEMA_DO_TUTORIAL } from '../src/ui/tutorial-passos.js';
import { renderInicio } from '../src/ui/inicio.js';
import { buscarItem } from '../src/conteudo/trilha.js';
import { passosAtivos } from '../src/ui/tutorial.js';
import { iniciarMenu } from '../src/ui/menu.js';

beforeAll(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  renderInicio(document.getElementById('tela-inicio'));
});

describe('tutorial', () => {
  it.each(PASSOS.filter((p) => p.alvo).map((p) => [p.titulo, p.alvo]))('o alvo do passo "%s" existe (%s)', (_t, alvo) => {
    expect(document.querySelector(alvo)).not.toBeNull();
  });

  it.each(PASSOS.filter((p) => p.alvoCelular).map((p) => [p.titulo, p.alvoCelular]))('no celular, o alvo do passo "%s" existe (%s)', (_t, alvo) => {
    expect(document.querySelector(alvo)).not.toBeNull();
  });

  it('no celular, pula os passos que só existem no desktop', () => {
    expect(passosAtivos(false)).toHaveLength(PASSOS.length);
    const celular = passosAtivos(true);
    expect(celular.length).toBeLessThan(PASSOS.length);
    expect(celular.some((p) => p.alvo === '#grupo-layout')).toBe(false);
  });

  it('todo passo tem título e texto', () => {
    for (const p of PASSOS) {
      expect(p.titulo).toBeTruthy();
      expect(p.texto).toBeTruthy();
    }
  });

  it('o problema usado no tutorial existe', () => {
    expect(buscarItem(PROBLEMA_DO_TUTORIAL)?.tipo).toBe('problema');
  });
});

describe('menu ☰', () => {
  it('abre, fecha ao escolher uma opção e com Esc', () => {
    iniciarMenu();
    const botao = document.getElementById('btn-menu');
    const painel = document.getElementById('menu-topo');
    botao.click();
    expect(painel.classList.contains('aberto')).toBe(true);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    painel.querySelector('a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(painel.classList.contains('aberto')).toBe(false);
    botao.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(botao.getAttribute('aria-label')).toBe('Abrir menu');
  });
});

describe('botões flutuantes', () => {
  it('recolhem ao rolar para baixo e voltam ao rolar para cima', async () => {
    const { iniciarFlutuantes } = await import('../src/ui/menu.js');
    iniciarFlutuantes();
    const grupo = document.getElementById('flutuantes');
    const pagina = document.getElementById('tela-inicio');
    Object.defineProperty(pagina, 'scrollHeight', { value: 3000, configurable: true });
    Object.defineProperty(pagina, 'clientHeight', { value: 600, configurable: true });
    const rolar = (y) => { pagina.scrollTop = y; pagina.dispatchEvent(new Event('scroll')); };
    rolar(0); rolar(400);
    expect(grupo.classList.contains('recolhidos')).toBe(true);
    rolar(200);
    expect(grupo.classList.contains('recolhidos')).toBe(false);
  });
});

describe('tutorial na primeira visita', () => {
  it('não abre sozinho sobre o editor (exercício ou playground livre); abre na trilha', async () => {
    const { iniciarTutorial } = await import('../src/ui/tutorial.js');
    localStorage.clear();
    const dialogo = document.getElementById('tutorial');
    dialogo.showModal ??= function showModal() { this.open = true; };
    dialogo.close ??= function close() { this.open = false; };
    for (const caminho of ['/p/tf-ola-arquivo/', '/livre/']) {
      history.replaceState(null, '', caminho);
      iniciarTutorial({ telaAtual: () => 'item' });
      expect(dialogo.open, caminho).toBe(false);
    }
    history.replaceState(null, '', '/trilha/');
    iniciarTutorial({ telaAtual: () => 'inicio' });
    await new Promise((r) => setTimeout(r, 0));
    expect(dialogo.open).toBe(true);
    dialogo.close();
  });

  it('o aviso de privacidade cabe na coluna da descrição da tela do exercício', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/caminho.css'), 'utf8');
    expect(css).toMatch(/#tela-item:not\(\[hidden\]\)\) \.aviso-privacidade \{[^}]*max-width: min\(296px/);
  });
});
