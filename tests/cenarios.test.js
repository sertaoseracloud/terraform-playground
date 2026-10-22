// @vitest-environment happy-dom
// Cenários da trilha: tiles próprios e CC0 em pixel art, decoração pura (o leitor de tela não
// ouve nada), leve e completa.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { CENARIOS, htmlDoCenario } from '../src/ui/cenarios/index.js';
import { LADO, desenharSprite } from '../src/ui/cenarios/pixel.js';
import { TILES_TINY_TOWN } from '../src/ui/cenarios/tiny-town.js';
import { desenharAtlas, quadrosDoAtlas, posicaoNoAtlas } from '../src/ui/cenarios/atlas.js';

const IDS = ['canteiro', 'porto', 'ceu', 'cidade'];
const COM_BLOQUEIO = ['canteiro', 'porto', 'ceu'];
const COM_ARVORES_TINY_TOWN = ['canteiro'];
const PESSOAS = ['mestre-de-obras', 'engenheira', 'estivador', 'tecnica', 'operaria'];
const camada = (id, semente) => {
  const div = document.createElement('div');
  div.innerHTML = htmlDoCenario(id, semente);
  return div.firstElementChild;
};
const spriteValido = (s) => s.linhas.length === LADO
  && s.linhas.every((l) => l.length === LADO && [...l].every((ch) => ch === '.' || ch in s.paleta));

describe('cenários', () => {
  it('existem os 4 cenários do site', () => {
    expect(Object.keys(CENARIOS).sort()).toEqual([...IDS].sort());
  });

  it('usa os pixels CC0 originais do Tiny Town apenas em cenário compatível', () => {
    const hashes = TILES_TINY_TOWN.map((s) => {
      const rgba = Buffer.alloc(LADO * LADO * 4);
      const ctx = {
        fillStyle: '',
        fillRect(x, y) {
          const rgb = this.fillStyle.match(/[a-f0-9]{2}/gi).map((c) => parseInt(c, 16));
          rgba.set([...rgb, 255], (y * LADO + x) * 4);
        },
      };
      desenharSprite(ctx, s, 0, 0, { escala: 1 });
      return createHash('sha256').update(rgba).digest('hex');
    });
    // SHA-256 dos PNGs completos tile_0027 e tile_0028 decodificados em RGBA.
    expect(hashes).toEqual([
      '58106786c05af1459af089789bbc31fe548af4b5719a47960727e5070953665f',
      '4e3413e5d27b3ad8406c8d765c4b8d36ecd406562fbd22a33243e9090dcad474',
    ]);
    for (const id of IDS) {
      const usaTilesCC0 = CENARIOS[id].objetos.some((obj) => TILES_TINY_TOWN.includes(obj));
      expect(usaTilesCC0, id).toBe(COM_ARVORES_TINY_TOWN.includes(id));
    }
  });

  it.each(IDS)('%s: chão, estrada, objetos e 3 personagens de 2 quadros, tudo em 16×16', (id) => {
    const c = CENARIOS[id];
    expect(c.chao.cores).toHaveLength(3);
    expect(c.chao.pesos).toHaveLength(3);
    expect(['terra', 'tabuas', 'pedras', 'liso']).toContain(c.estrada.padrao);
    expect(Boolean(c.bloqueio)).toBe(COM_BLOQUEIO.includes(id));
    expect(c.objetos.length).toBeGreaterThanOrEqual(2);
    expect(c.objetos.every(spriteValido)).toBe(true);
    expect(c.personagens).toHaveLength(3);
    for (const p of c.personagens) {
      expect(['andar', 'voar', 'nadar', 'saltar']).toContain(p.movimento);
      expect(p.quadros).toHaveLength(2);
      expect(p.quadros.every(spriteValido)).toBe(true);
    }
    expect(spriteValido(c.casa)).toBe(true);
    for (const p of c.personagens) expect(['pessoa', 'animal']).toContain(p.tipo);
  });

  it.each(IDS)('%s: atlas preserva todos os pixels dos objetos, casas e personagens', (id) => {
    const cen = CENARIOS[id];
    for (const cor of [undefined, '#ffffff']) {
      const retangulos = [];
      const ctx = {
        fillStyle: '',
        fillRect(x, y, w, h) { retangulos.push({ x, y, w, h, cor: this.fillStyle }); },
        strokeRect() {},
      };
      desenharAtlas(ctx, cen, { contorno: cor });
      quadrosDoAtlas(cen).forEach((f, n) => {
        const s = f.tipo === 'objeto' ? cen.objetos[f.i] : f.tipo === 'casa' ? cen.casa : f.tipo === 'per' ? f.p.quadros[f.i] : null;
        if (!s) return;
        const { x, y } = posicaoNoAtlas(n);
        const esperado = [];
        desenharSprite({
          fillStyle: '',
          fillRect(x, y, w, h) { esperado.push({ x, y, w, h, cor: this.fillStyle }); },
        }, s, 0, 0, { cor });
        const recebido = retangulos.filter((r) => r.x >= x && r.x < x + 32 && r.y >= y && r.y < y + 32)
          .map((r) => ({ ...r, x: r.x - x, y: r.y - y }));
        expect(recebido, `${id}/${f.nome}/${cor ?? 'colorido'}`).toEqual(esperado);
        expect(esperado.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 32 && r.y + r.h <= 32)).toBe(true);
      });
    }
  });

  it('quem é pessoa em cada cenário', () => {
    const pessoas = Object.values(CENARIOS).flatMap((c) => c.personagens.filter((p) => p.tipo === 'pessoa').map((p) => p.id)).sort();
    expect(pessoas).toEqual(PESSOAS.sort());
  });

  it.each(IDS)('%s: no máximo 12 KB', (id) => {
    expect(JSON.stringify(CENARIOS[id]).length).toBeLessThanOrEqual(12 * 1024);
  });

  it.each(IDS)('%s: decoração escondida do leitor de tela, sem texto, sem foco e sem ids', (id) => {
    const el = camada(id, 'basico');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.classList.contains(`cenario-${id}`)).toBe(true);
    expect(el.dataset.cenario).toBe(id);
    expect(el.dataset.semente).toBe('basico');
    expect(el.textContent.trim()).toBe('');
    expect(el.querySelector('a, button, input, [tabindex], title, text, [id]')).toBeNull();
    expect(el.querySelector('.cenario-palco')).not.toBeNull();
  });

  it('a camada leva os exercícios feitos (a vila sai deles)', () => {
    expect(camada(IDS[0], 'basico').dataset.feitos).toBe('0');
    const div = document.createElement('div');
    div.innerHTML = htmlDoCenario(IDS[0], 'basico', 7);
    expect(div.firstElementChild.dataset.feitos).toBe('7');
  });

  it('id desconhecido não quebra a trilha', () => {
    expect(htmlDoCenario('inventado')).toBe('');
    expect(htmlDoCenario(undefined)).toBe('');
  });
});
