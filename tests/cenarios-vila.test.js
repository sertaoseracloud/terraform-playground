// A vila de cada módulo: calculada do progresso (sem nada gravado), estável e dentro do limite.
import { describe, it, expect } from 'vitest';
import { gerarMapa, tileEm } from '../src/ui/cenarios/mapa.js';
import { podePisar } from '../src/ui/cenarios/fisica.js';
import { vila, comCasas, lugaresDeCasa } from '../src/ui/cenarios/vila.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';

const ID = Object.keys(CENARIOS)[0];
const mapaDe = (colunas = 40, linhas = 40) => gerarMapa({ colunas, linhas, cenario: CENARIOS[ID], semente: 'm1' });
const daVila = (feitos, mapa = mapaDe(), cenario = CENARIOS[ID]) => vila({ mapa, cenario, semente: 'm1', feitos });

describe('vila', () => {
  it('a mesma semente e o mesmo progresso dão a mesma vila', () => {
    expect(daVila(9)).toEqual(daVila(9));
  });

  it('o ciclo: casa, filho, filhote (7 exercícios → 3 casas, 2 filhos, 2 filhotes)', () => {
    const v = daVila(7);
    expect([v.casas.length, v.filhos.length, v.filhotes.length]).toEqual([3, 2, 2]);
    expect(daVila(0)).toEqual({ casas: [], filhos: [], filhotes: [] });
  });

  it('a vila de n + 1 contém a de n (nada muda de lugar)', () => {
    for (let n = 0; n < 15; n++) {
      const [a, b] = [daVila(n), daVila(n + 1)];
      expect(b.casas.slice(0, a.casas.length)).toEqual(a.casas);
      expect(b.filhos.slice(0, a.filhos.length)).toEqual(a.filhos);
      expect(b.filhotes.slice(0, a.filhotes.length)).toEqual(a.filhotes);
    }
  });

  it('as casas ficam no chão, a até 3 tiles da estrada, sem vizinha (nem na diagonal)', () => {
    const mapa = mapaDe();
    const { casas } = daVila(30, mapa);
    for (const { c, l } of casas) {
      const [de, ate] = mapa.estrada[l];
      const dist = c < de ? de - c : c - ate;
      expect(dist >= 1 && dist <= 3).toBe(true);
      expect(tileEm(mapa, c, l).tipo).toBe('chao');
    }
    for (const a of casas) {
      for (const b of casas) if (a !== b) expect(Math.max(Math.abs(a.c - b.c), Math.abs(a.l - b.l))).toBeGreaterThan(1);
    }
  });

  it('sem lugar para mais casas, as casas param e o resto continua (sem laço infinito)', () => {
    const mapa = mapaDe(11, 10);
    const v = daVila(100, mapa);
    expect(v.casas.length).toBeLessThanOrEqual(lugaresDeCasa(mapa, 'm1').length);
    expect(v.filhos.length + v.filhotes.length).toBe(66);
  });

  it('sem pessoa, o filho vira filhote; sem animal, o filhote vira filho', () => {
    const base = CENARIOS[ID];
    const soAnimais = { ...base, personagens: base.personagens.map((p) => ({ ...p, tipo: 'animal' })) };
    const soPessoas = { ...base, personagens: base.personagens.map((p) => ({ ...p, tipo: 'pessoa' })) };
    expect(daVila(6, mapaDe(), soAnimais).filhos).toEqual([]);
    expect(daVila(6, mapaDe(), soAnimais).filhotes).toHaveLength(4);
    expect(daVila(6, mapaDe(), soPessoas).filhotes).toEqual([]);
    expect(daVila(6, mapaDe(), soPessoas).filhos).toHaveLength(4);
  });

  it('filho é de uma pessoa, filhote é de um animal, em rodízio', () => {
    const c = CENARIOS[ID];
    const v = daVila(12);
    const tipo = (id) => c.personagens.find((p) => p.id === id).tipo;
    expect(v.filhos.every((f) => tipo(f.pai) === 'pessoa')).toBe(true);
    expect(v.filhotes.every((f) => tipo(f.mae) === 'animal')).toBe(true);
  });

  it('ninguém anda pela casa; quem voa passa por cima', () => {
    const mapa = mapaDe();
    const { casas } = daVila(10, mapa);
    const comVila = comCasas(mapa, casas);
    const { c, l } = casas[0];
    expect(tileEm(comVila, c, l).tipo).toBe('casa');
    expect(podePisar(comVila, 'andar', c, l)).toBe(false);
    expect(podePisar(comVila, 'voar', c, l)).toBe(true);
    expect(tileEm(mapa, c, l).tipo).toBe('chao'); // o mapa original não muda
  });
});
