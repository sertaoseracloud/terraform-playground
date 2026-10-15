// @vitest-environment happy-dom
// A trilha com cenários: cada módulo tem o seu, o caminho continua igual para o leitor de tela,
// os personagens só andam quando podem (e param com "reduzir movimento"), e o CSS não rouba o clique.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulos } from '../src/conteudo/trilha.js';
import { CENARIO_DO_MODULO } from '../src/conteudo/cenarios.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';
import { ligarCenarios } from '../src/ui/cenarios/palco.js';
import { renderInicio } from '../src/ui/inicio.js';

const css = readFileSync(resolve(process.cwd(), 'src/cenarios.css'), 'utf8');
const estilo = readFileSync(resolve(process.cwd(), 'src/estilo.css'), 'utf8');
const tela = () => document.getElementById('tela-inicio');

/** Uma janela falsa: conta os temporizadores e os observadores. */
function janelaFalsa({ reduzir = false, observador = true, largura = 1280 } = {}) {
  const j = {
    intervalos: 0,
    limpos: 0,
    desconectados: 0,
    innerWidth: largura,
    innerHeight: 800,
    setInterval: () => { j.intervalos += 1; return 1; },
    clearInterval: () => { j.limpos += 1; },
    setTimeout: () => 0,
    clearTimeout: () => {},
    matchMedia: (q) => ({ matches: reduzir && q.includes('reduced-motion') }),
    addEventListener() {},
    removeEventListener() {},
  };
  if (observador) {
    j.IntersectionObserver = class { observe() {} disconnect() { j.desconectados += 1; } };
  }
  return j;
}

beforeAll(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  renderInicio(tela());
});

afterEach(() => {
  document.documentElement.classList.remove('a11y-sem-movimento');
  delete document.documentElement.dataset.tema;
});

describe('cenários na trilha', () => {
  it('todo módulo tem um cenário, e todo cenário do mapa existe', () => {
    for (const m of modulos) expect(CENARIO_DO_MODULO[m.id], m.id).toBeTruthy();
    for (const id of Object.values(CENARIO_DO_MODULO)) expect(CENARIOS[id], id).toBeTruthy();
  });

  it('cada bloco de módulo tem o seu cenário como primeira camada, com o módulo como semente', () => {
    for (const m of modulos) {
      const bloco = document.getElementById(`unidade-${m.id}`);
      expect(bloco.classList.contains('com-cenario')).toBe(true);
      const camada = bloco.firstElementChild;
      expect(camada.classList.contains(`cenario-${CENARIO_DO_MODULO[m.id]}`)).toBe(true);
      expect(camada.getAttribute('aria-hidden')).toBe('true');
      expect(camada.dataset.semente).toBe(m.id);
    }
  });

  it('o caminho continua o mesmo: os nós e os rótulos não ganham nada do cenário', () => {
    const nos = [...document.querySelectorAll('.no .alvo')];
    expect(nos.length).toBeGreaterThan(0);
    for (const alvo of nos) expect(alvo.closest('.cenario')).toBeNull();
    expect(document.querySelectorAll('.cenario [aria-label], .cenario a, .cenario button, .cenario [tabindex]')).toHaveLength(0);
    for (const m of modulos) expect(document.getElementById(`trilha-${m.id}`)).not.toBeNull();
  });
});

describe('palco: personagens e temporizador', () => {
  it('no caso normal, 3 personagens por cenário e um único temporizador para a página', () => {
    const j = janelaFalsa();
    const { desligar } = ligarCenarios(tela(), { janela: j });
    for (const palco of document.querySelectorAll('.cenario-palco')) {
      expect(palco.querySelectorAll('.personagem').length).toBeGreaterThanOrEqual(2);
      expect(palco.querySelectorAll('.personagem').length).toBeLessThanOrEqual(3);
    }
    expect(j.intervalos).toBe(1);
    desligar();
    expect(j.limpos).toBe(1);
    expect(j.desconectados).toBeGreaterThanOrEqual(1);
  });

  it('no celular, só 1 personagem por cenário', () => {
    const { desligar } = ligarCenarios(tela(), { janela: janelaFalsa({ largura: 375 }) });
    for (const palco of document.querySelectorAll('.cenario-palco')) expect(palco.querySelectorAll('.personagem').length).toBe(1);
    desligar();
  });

  it('ligar de novo não duplica os personagens', () => {
    ligarCenarios(tela(), { janela: janelaFalsa() }).desligar();
    const { desligar } = ligarCenarios(tela(), { janela: janelaFalsa() });
    for (const palco of document.querySelectorAll('.cenario-palco')) {
      expect(palco.querySelectorAll('.personagem').length).toBeLessThanOrEqual(3);
      expect(palco.querySelectorAll('.cenario-mapa').length).toBe(1);
    }
    desligar();
  });

  it('montado com a tela escondida (largura 0), refaz o mapa com a largura de verdade quando aparece', () => {
    const j = janelaFalsa();
    let avisar = null;
    j.IntersectionObserver = class { constructor(cb) { avisar = cb; } observe() {} disconnect() {} };
    const { desligar } = ligarCenarios(tela(), { janela: j });
    const camada = document.querySelector('.cenario');
    const palco = camada.querySelector('.cenario-palco');
    expect(palco.querySelector('.cenario-mundo').style.left).toBe('0px'); // 1280 da janela, 40 colunas
    Object.defineProperty(palco, 'clientWidth', { value: 700, configurable: true });
    avisar([{ target: camada, isIntersecting: true }]);
    expect(palco.querySelector('.cenario-mundo').style.left).toBe('-2px'); // (700 - 22 × 32) / 2
    desligar();
  });

  it.each([
    ['prefers-reduced-motion', () => janelaFalsa({ reduzir: true })],
    ['a11y-sem-movimento', () => { document.documentElement.classList.add('a11y-sem-movimento'); return janelaFalsa(); }],
    ['alto contraste', () => { document.documentElement.dataset.tema = 'alto-contraste'; return janelaFalsa(); }],
    ['sem IntersectionObserver', () => janelaFalsa({ observador: false })],
  ])('com %s, nenhum temporizador (os personagens ficam parados)', (_nome, preparar) => {
    const j = preparar();
    const { desligar } = ligarCenarios(tela(), { janela: j });
    expect(j.intervalos).toBe(0);
    expect(document.querySelectorAll('.personagem').length).toBeGreaterThan(0);
    desligar();
  });
});

describe('CSS dos cenários', () => {
  it('não rouba o clique, acompanha a rolagem e mantém o véu da legenda', () => {
    expect(css).toMatch(/\.cenario\s*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.cenario\s*\{[^}]*overflow:\s*clip/);
    expect(css).toMatch(/\.cenario-palco\s*\{[^}]*position:\s*sticky[^}]*height:\s*100vh/);
    expect(css).toMatch(/\.com-cenario \.legenda[^{]*\{[^}]*background/);
  });

  it('pixel art sem suavização e passo de 0,4 s, que some quando pedem menos movimento', () => {
    expect(css).toMatch(/\.cenario-mapa[^{]*\{[^}]*image-rendering:\s*pixelated/);
    expect(css).toMatch(/\.personagem canvas[^{]*\{[^}]*image-rendering:\s*pixelated/);
    expect(css).toMatch(/\.personagem\s*\{[^}]*transition:\s*transform \.4s linear/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.personagem[^{]*\{[^}]*transition:\s*none/);
    expect(estilo).toMatch(/:root\.a11y-sem-movimento \*[\s\S]*transition:\s*none !important/);
  });
});
