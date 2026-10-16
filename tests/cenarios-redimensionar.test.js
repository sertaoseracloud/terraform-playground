// @vitest-environment happy-dom
// No celular (Android e iPhone), a barra de endereço some e volta durante a rolagem e dispara o
// evento resize só com a altura mudando. Refazer todos os mapas nessa hora trava a rolagem e faz os
// personagens voltarem ao começo; o mapa só depende da largura, então só ela refaz o cenário.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ligarCenarios } from '../src/ui/cenarios/palco.js';
import { renderInicio } from '../src/ui/inicio.js';

const tela = () => document.getElementById('tela-inicio');
const mapas = () => [...tela().querySelectorAll('.cenario-mapa')];

/** Uma janela de celular que guarda o tratador do resize e roda a espera na hora. */
function janelaDeCelular() {
  const j = {
    innerWidth: 412,
    innerHeight: 915,
    tratadores: [],
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    matchMedia: () => ({ matches: false }),
    addEventListener: (tipo, fn) => { if (tipo === 'resize') j.tratadores.push(fn); },
    removeEventListener: () => {},
    IntersectionObserver: class { observe() {} disconnect() {} },
    redimensionar({ largura = j.innerWidth, altura = j.innerHeight }) {
      j.innerWidth = largura;
      j.innerHeight = altura;
      j.tratadores.forEach((fn) => fn());
    },
  };
  return j;
}

beforeAll(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  renderInicio(tela());
});

describe('cenários quando a janela muda de tamanho', () => {
  it('só a altura mudou (a barra de endereço do celular): os mapas ficam como estão', () => {
    const j = janelaDeCelular();
    const { desligar } = ligarCenarios(tela(), { janela: j });
    const antes = mapas();
    expect(antes.length).toBeGreaterThan(0);
    j.redimensionar({ altura: 860 });
    j.redimensionar({ altura: 915 });
    // Os mesmos elementos (identidade): toEqual compararia só a estrutura, e um mapa refeito é igual.
    expect(mapas().every((m, i) => m === antes[i])).toBe(true);
    desligar();
  });

  it('a largura mudou (o celular girou): os mapas são refeitos na largura nova', () => {
    const j = janelaDeCelular();
    const { desligar } = ligarCenarios(tela(), { janela: j });
    const antes = mapas();
    j.redimensionar({ largura: 915, altura: 412 });
    const depois = mapas();
    expect(depois).toHaveLength(antes.length);
    expect(depois.every((m, i) => m !== antes[i])).toBe(true);
    expect(depois[0].width).toBeGreaterThan(antes[0].width);
    desligar();
  });
});
