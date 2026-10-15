// Mapa de tiles dos cenários: determinístico, com a estrada embaixo dos nós e espaço livre dos dois lados.
import { describe, it, expect } from 'vitest';
import { gerarMapa, colunasDaEstrada, estradaPorLinha, sorteador, tileEm, TILE } from '../src/ui/cenarios/mapa.js';
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
    const s = CENARIOS.canteiro.personagens[0].quadros[0];
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
    expect(mapaDe('canteiro')).toEqual(mapaDe('canteiro'));
    expect(mapaDe('canteiro', 40, 25, 'outro')).not.toEqual(mapaDe('canteiro'));
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

  it('sem caminho, a estrada de cada linha é a faixa reta de hoje', () => {
    const cols = colunasDaEstrada(40);
    expect(estradaPorLinha(40, 5)).toEqual(Array(5).fill([Math.min(...cols), Math.max(...cols)]));
  });

  it('com o caminho em ziguezague, o tile de cada nó é estrada, e a faixa tem até 5 tiles', () => {
    const caminho = [{ c: 17.5, l: 2.5 }, { c: 22.5, l: 6.5 }, { c: 16.5, l: 10.5 }, { c: 23.5, l: 14.5 }];
    const faixa = estradaPorLinha(40, 18, caminho);
    for (const { c, l } of caminho) {
      const [de, ate] = faixa[Math.floor(l)];
      expect(Math.floor(c)).toBeGreaterThanOrEqual(de);
      expect(Math.floor(c)).toBeLessThanOrEqual(ate);
    }
    for (const [de, ate] of faixa) {
      expect(ate - de + 1).toBeLessThanOrEqual(5);
      expect(de).toBeGreaterThanOrEqual(1);
      expect(ate).toBeLessThanOrEqual(38);
    }
  });

  it('entre dois nós, a estrada faz uma volta, para um lado e depois para o outro (um caminho sinuoso)', () => {
    const caminho = [{ c: 20, l: 2.5 }, { c: 20, l: 12.5 }, { c: 20, l: 22.5 }];
    const faixa = estradaPorLinha(40, 25, caminho);
    const centro = (l) => (faixa[l][0] + faixa[l][1] + 1) / 2;
    expect(Math.abs(centro(7) - 20)).toBeGreaterThanOrEqual(2);
    expect(Math.abs(centro(17) - 20)).toBeGreaterThanOrEqual(2);
    expect(Math.sign(centro(7) - 20)).toBe(-Math.sign(centro(17) - 20));
  });

  it('nós repetidos na mesma linha ou fora do mapa não quebram a curva', () => {
    const faixa = estradaPorLinha(20, 10, [{ c: 8, l: 3 }, { c: 12, l: 3 }, { c: 50, l: -4 }, { c: 9, l: 30 }]);
    expect(faixa).toHaveLength(10);
    for (const [de, ate] of faixa) {
      expect(Number.isInteger(de) && Number.isInteger(ate) && de <= ate).toBe(true);
      expect(de).toBeGreaterThanOrEqual(1);
      expect(ate).toBeLessThanOrEqual(18);
    }
  });

  it('com caminho, a estrada do mapa segue a faixa de cada linha, e manchas e objetos ficam a 2 tiles dela', () => {
    const caminho = [{ c: 14.5, l: 3.5 }, { c: 24.5, l: 12.5 }, { c: 15.5, l: 21.5 }];
    const m = gerarMapa({ colunas: 40, linhas: 25, cenario: CENARIOS.porto, semente: 'php', caminho });
    for (let l = 0; l < 25; l++) {
      const [de, ate] = m.estrada[l];
      for (let c = 0; c < 40; c++) {
        const t = tileEm(m, c, l);
        expect(t.tipo === 'estrada').toBe(c >= de && c <= ate);
        if (t.tipo === 'bloqueio' || t.tipo === 'objeto') expect(c <= de - 2 || c >= ate + 2).toBe(true);
      }
    }
  });

  it('cenários com área bloqueada têm manchas; os outros não', () => {
    for (const [id, c] of Object.entries(CENARIOS)) {
      const tem = mapaDe(id).tiles.some((t) => t.tipo === 'bloqueio');
      expect(tem, id).toBe(Boolean(c.bloqueio));
    }
  });
});
