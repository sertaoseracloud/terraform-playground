// Mapa de tiles dos cenários: determinístico, com a estrada embaixo dos nós e espaço livre dos dois lados.
import { describe, it, expect } from 'vitest';
import { gerarMapa, colunasDaEstrada, sorteador, tileEm, TILE } from '../src/ui/cenarios/mapa.js';
import { sprite, passo, misturar, LADO } from '../src/ui/cenarios/pixel.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';

const mapaDe = (id, colunas = 40, linhas = 25, semente = 'basico') => gerarMapa({ colunas, linhas, cenario: CENARIOS[id], semente });

describe('pixel art', () => {
  it('sprite valida 16×16 e as cores', () => {
    const linha = '.'.repeat(LADO);
    expect(() => sprite({ a: '#000' }, Array(LADO).fill(linha).join('\n'))).not.toThrow();
    expect(() => sprite({ a: '#000' }, Array(15).fill(linha).join('\n'))).toThrow('16×16');
    expect(() => sprite({ a: '#000' }, [...Array(15).fill(linha), `b${'.'.repeat(15)}`].join('\n'))).toThrow('fora da paleta');
  });

  it('misturar: as variações do chão ficam perto da cor base (sem xadrez)', () => {
    expect(misturar('#000000', '#ffffff', 0)).toBe('#000000');
    expect(misturar('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(misturar('#d9a066', '#e8bb80', 0.35)).toBe('#dea96f');
  });

  it('o 2º quadro da caminhada é diferente do 1º e continua 16×16', () => {
    const s = CENARIOS.sertao.personagens[0].quadros[0];
    const b = passo(s, 'andar');
    expect(b.linhas).toHaveLength(LADO);
    expect(b.linhas.every((l) => l.length === LADO)).toBe(true);
    expect(b.linhas.join('')).not.toBe(s.linhas.join(''));
  });
});

describe('mapa', () => {
  it('sorteador é determinístico pela semente', () => {
    const a = sorteador('pyspark'); const b = sorteador('pyspark'); const c = sorteador('dados');
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
  });

  it('a mesma semente gera o mesmo mapa', () => {
    expect(mapaDe('sertao')).toEqual(mapaDe('sertao'));
    expect(mapaDe('sertao', 40, 25, 'outro')).not.toEqual(mapaDe('sertao'));
  });

  it('a estrada cobre a faixa dos nós (±112px do centro)', () => {
    const cols = colunasDaEstrada(40);
    const centro = (40 * TILE) / 2;
    expect(cols.some((c) => c * TILE <= centro - 100)).toBe(true);
    expect(cols.some((c) => (c + 1) * TILE >= centro + 100)).toBe(true);
  });

  it.each(Object.keys(CENARIOS))('%s: a estrada é só estrada, e há chão livre dos dois lados', (id) => {
    for (const [colunas, linhas] of [[40, 25], [11, 17]]) {
      const m = mapaDe(id, colunas, linhas);
      const estrada = new Set(colunasDaEstrada(colunas));
      for (let l = 0; l < linhas; l++) {
        for (let c = 0; c < colunas; c++) {
          expect(tileEm(m, c, l).tipo === 'estrada').toBe(estrada.has(c));
        }
      }
      const livres = (lado) => m.tiles.filter((t, i) => t.tipo === 'chao' && (lado ? i % colunas > Math.max(...estrada) : i % colunas < Math.min(...estrada))).length;
      expect(livres(false)).toBeGreaterThanOrEqual(linhas);
      expect(livres(true)).toBeGreaterThanOrEqual(linhas);
    }
  });

  it('cenários com área bloqueada têm manchas; os outros não', () => {
    for (const [id, c] of Object.entries(CENARIOS)) {
      const tem = mapaDe(id).tiles.some((t) => t.tipo === 'bloqueio');
      expect(tem, id).toBe(Boolean(c.bloqueio));
    }
  });
});
