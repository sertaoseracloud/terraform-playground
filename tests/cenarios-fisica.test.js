// Física dos personagens: um tile por passo, nas 4 direções, sem pisar onde não pode.
import { describe, it, expect } from 'vitest';
import { gerarMapa, sorteador, tileEm } from '../src/ui/cenarios/mapa.js';
import { proximoPasso, posicoesIniciais, podePisar } from '../src/ui/cenarios/fisica.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';

function simular(id, passos = 2000) {
  const c = CENARIOS[id];
  const mapa = gerarMapa({ colunas: 40, linhas: 25, cenario: c, semente: id });
  const sortear = sorteador(`fisica-${id}`);
  let ps = posicoesIniciais(mapa, c.personagens, sortear);
  const historico = ps.map((p) => (p ? [p] : []));
  for (let i = 0; i < passos; i++) {
    ps = ps.map((p, k) => {
      if (!p) return p;
      const q = proximoPasso(p, mapa, sortear);
      historico[k].push(q);
      return q;
    });
  }
  return { mapa, historico, c };
}

describe('física', () => {
  it.each(Object.keys(CENARIOS))('%s: ninguém pisa onde não pode, e todo passo é para um vizinho', (id) => {
    const { mapa, historico, c } = simular(id);
    historico.forEach((h, k) => {
      const mov = c.personagens[k].movimento;
      for (let i = 0; i < h.length; i++) {
        const p = h[i];
        expect(podePisar(mapa, mov, p.c, p.l), `${id}/${c.personagens[k].id} em ${p.c},${p.l}`).toBe(true);
        expect(tileEm(mapa, p.c, p.l).tipo).not.toBe('estrada');
        if (i > 0) expect(Math.abs(p.c - h[i - 1].c) + Math.abs(p.l - h[i - 1].l)).toBeLessThanOrEqual(1);
      }
    });
  });

  it('quem anda nunca entra na água; voadores podem; peixe e jangadeiro nunca saem dela', () => {
    const { mapa } = simular('rio', 1);
    const agua = mapa.tiles.findIndex((t) => t.tipo === 'bloqueio');
    const [c, l] = [agua % mapa.colunas, Math.floor(agua / mapa.colunas)];
    expect(podePisar(mapa, 'andar', c, l)).toBe(false);
    expect(podePisar(mapa, 'voar', c, l)).toBe(true);
    expect(podePisar(mapa, 'nadar', c, l)).toBe(true);
    const chao = mapa.tiles.findIndex((t) => t.tipo === 'chao');
    expect(podePisar(mapa, 'nadar', chao % mapa.colunas, Math.floor(chao / mapa.colunas))).toBe(false);
  });

  it('os personagens se mexem (não ficam parados para sempre) e viram para onde andam', () => {
    const { historico } = simular('sertao', 200);
    const vaqueiro = historico[0];
    const andou = new Set(vaqueiro.map((p) => `${p.c},${p.l}`)).size;
    expect(andou).toBeGreaterThan(10);
    const passo = vaqueiro.find((p, i) => i > 0 && !p.parado);
    expect(Math.abs(passo.direcao[0]) + Math.abs(passo.direcao[1])).toBe(1);
  });
});
