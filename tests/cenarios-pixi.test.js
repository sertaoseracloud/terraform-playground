// @vitest-environment happy-dom
// O desenho com PixiJS (palco-pixi.js). O happy-dom não tem WebGL, então o pixi.js é trocado por um
// falso que guarda o que o palco pediu: as opções (pixel art nítido, sem camada de acessibilidade),
// os pedaços do mapa, o orçamento de quadros, a aba oculta e a destruição do contexto.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('pixi.js', () => {
  class Container {
    constructor() {
      this.children = [];
      this.visible = true;
      this.alpha = 1;
      this.x = 0; this.y = 0;
      this.position = { set: (x, y) => { this.x = x; this.y = y; } };
      this.scale = { set: (x, y) => { this.sx = x; this.sy = y ?? x; } };
    }
    addChild(...filhos) { this.children.push(...filhos); return filhos[0]; }
    addChildAt(filho) { this.children.unshift(filho); return filho; }
    destroy() { this.destruido = true; }
  }
  class Sprite extends Container {
    constructor(textura) { super(); this.texture = textura; this.anchor = { set() {} }; }
  }
  class Texture {
    constructor(opcoes) { Object.assign(this, opcoes); }
    static from() { return { source: { scaleMode: 'linear', destroy() { this.destruida = true; } } }; }
  }
  Texture.WHITE = new Texture({ branca: true });
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }); } }
  const TextureSource = { defaultOptions: {} };
  class Application {
    async init(opcoes) {
      this.opcoes = opcoes;
      this.canvas = document.createElement('canvas');
      this.stage = new Container();
      this.renderer = { name: 'webgl', resize: vi.fn(), render: vi.fn(), gl: null };
      const quadros = [];
      this.ticker = { quadros, started: false, add: (f) => quadros.push(f), start: () => { this.ticker.started = true; }, stop: () => { this.ticker.started = false; } };
      globalThis.appPixi = this;
    }
    destroy(opcoes) { this.destruido = opcoes; this.canvas.remove(); }
  }
  return { Application, Container, Sprite, Texture, Rectangle, TextureSource };
});

const { ligarCenarios } = await import('../src/ui/cenarios/palco.js');
const { renderInicio } = await import('../src/ui/inicio.js');

const tela = () => document.getElementById('tela-inicio');
const esperar = () => new Promise((r) => setTimeout(r, 0));
const quadro = () => globalThis.appPixi.ticker.quadros[0]();
let agora = 1000;

function janelaFalsa() {
  return {
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 3,
    setInterval: () => 1, clearInterval: () => {}, setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id),
    matchMedia: () => ({ matches: false }),
    addEventListener() {}, removeEventListener() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
}

beforeAll(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  renderInicio(tela());
  // Cada módulo com 2.000 px de altura, um embaixo do outro.
  [...document.querySelectorAll('.cenario-palco')].forEach((p, i) => {
    Object.defineProperty(p, 'getBoundingClientRect', { configurable: true, value: () => ({ top: i * 2000, left: 0, width: 1280, height: 2000, right: 1280, bottom: (i + 1) * 2000 }) });
  });
  vi.spyOn(performance, 'now').mockImplementation(() => agora);
});

afterEach(() => {
  document.documentElement.classList.remove('cenario-pausado');
  delete document.documentElement.dataset.tema;
});

async function ligar() {
  const r = ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: () => import('../src/ui/cenarios/palco-pixi.js'), webgl: () => true });
  // O import() e o init() são assíncronos: espera o palco ficar pronto.
  await vi.waitFor(() => expect(tela().dataset.cenarioDesenho).toBe('webgl'), { timeout: 10000 });
  // Um módulo por tarefa: espera todos.
  await vi.waitFor(() => expect(r.modulos()).toHaveLength(document.querySelectorAll('.cenario').length), { timeout: 10000 });
  return r;
}

describe('palco PixiJS', () => {
  it('cria um único canvas decorativo, com pixel art nítido e sem a camada de acessibilidade do Pixi', async () => {
    const r = await ligar();
    const app = globalThis.appPixi;
    expect(document.querySelectorAll('canvas.cenario-pixi')).toHaveLength(1);
    expect(app.canvas.getAttribute('aria-hidden')).toBe('true');
    expect(tela().classList.contains('com-pixi')).toBe(true);
    expect(app.opcoes).toMatchObject({
      preference: 'webgl', antialias: false, roundPixels: true, autoStart: false,
      failIfMajorPerformanceCaveat: true, resolution: 2, // DPR 3 limitado a 2
      accessibilityOptions: { enabledByDefault: false, activateOnTab: false },
    });
    expect(app.stage.eventMode).toBe('none');
    expect(app.ticker.started).toBe(true);
    r.desligar();
  });

  it('desenha só o que está perto da tela: pedaços de 16×16 tiles do primeiro módulo, nada dos outros', async () => {
    const r = await ligar();
    const app = globalThis.appPixi;
    quadro();
    const [primeiro, segundo] = app.stage.children;
    expect(primeiro.visible).toBe(true);
    const chao = primeiro.children[0];
    expect(chao.alpha).toBe(0.45);
    expect(chao.children.length).toBeGreaterThan(0);
    for (const pedaco of chao.children) expect(pedaco.children.length).toBeGreaterThan(0);
    expect(segundo.visible).toBe(false);
    expect(segundo.children[0].children).toHaveLength(0);
    expect(app.renderer.render).toHaveBeenCalledTimes(1);
    r.desligar();
  });

  it('orçamento: sem rolagem nem animação, não redesenha; o passo anda e desliza até o tile novo', async () => {
    const r = await ligar();
    const app = globalThis.appPixi;
    quadro();
    const desenhos = app.renderer.render.mock.calls.length;
    // Logo em seguida (menos de 1/24 s), nada muda: não desenha de novo.
    agora += 10;
    quadro();
    expect(app.renderer.render.mock.calls.length).toBe(desenhos);
    // Depois do passo (0,4 s), redesenha e os sprites ficam entre o tile antigo e o novo.
    agora += 400;
    quadro();
    agora += 200;
    quadro();
    expect(app.renderer.render.mock.calls.length).toBeGreaterThan(desenhos);
    const mod = r.modulos()[0];
    expect(mod.vila.passos).toBeGreaterThan(0);
    r.desligar();
  });

  it('pausado (ou com reduzir movimento), o Ticker não dá passos', async () => {
    const r = await ligar();
    document.documentElement.classList.add('cenario-pausado');
    const antes = r.modulos()[0].vila.passos;
    for (let k = 0; k < 5; k++) { agora += 500; quadro(); }
    expect(r.modulos()[0].vila.passos).toBe(antes);
    r.desligar();
  });

  it('aba oculta: o Ticker para; de volta, recomeça', async () => {
    const r = await ligar();
    const app = globalThis.appPixi;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(app.ticker.started).toBe(false);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(app.ticker.started).toBe(true);
    r.desligar();
  });

  it('comemoração: a casa nova cresce por 300 ms e some, deixando a do mapa', async () => {
    const r = await ligar();
    const mod = r.modulos()[0];
    mod.novaCasa = { c: 2, l: 2 };
    agora += 50;
    quadro();
    const chao = globalThis.appPixi.stage.children[0].children[0];
    const crescendo = chao.children.at(-1);
    expect(crescendo.children[1].sx).toBeLessThan(1);
    agora += 400;
    quadro();
    expect(crescendo.destruido).toBe(true);
    r.desligar();
  });

  it('o tema mudou: refaz as folhas; desligar destrói o app, tira o canvas e devolve o contexto', async () => {
    const r = await ligar();
    const app = globalThis.appPixi;
    const montados = app.stage.children.length;
    document.documentElement.dataset.tema = 'alto-contraste';
    await esperar();
    expect(app.stage.children.length).toBeGreaterThanOrEqual(montados);
    r.desligar();
    expect(app.destruido).toEqual({ removeView: true });
    expect(document.querySelectorAll('canvas.cenario-pixi')).toHaveLength(0);
    expect(tela().classList.contains('com-pixi')).toBe(false);
  });
});
