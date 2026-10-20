import { describe, it, expect } from 'vitest';
import { escolherModo, larguraDescricao, larguraPreview, montarGrade, LARGURA_TERMINAL } from '../src/ui/layout-calculo.js';

describe('escolherModo', () => {
  it('telas estreitas usam o layout de celular', () => {
    expect(escolherModo({ largura: 800, descricao: true })).toBe('celular');
  });

  it('1366px com descrição: lado a lado deixaria o terminal estreito demais para o plano, então empilha', () => {
    expect(larguraPreview('lado', { largura: 1366, descricao: true })).toBeLessThanOrEqual(LARGURA_TERMINAL);
    expect(escolherModo({ largura: 1366, descricao: true })).toBe('empilhado');
    expect(larguraPreview('empilhado', { largura: 1366, descricao: true })).toBeGreaterThan(LARGURA_TERMINAL);
  });

  it('1366px sem descrição cabe lado a lado', () => {
    expect(escolherModo({ largura: 1366, descricao: false })).toBe('lado');
  });

  it('1920px com descrição fica lado a lado com o terminal largo o bastante', () => {
    expect(escolherModo({ largura: 1920, descricao: true })).toBe('lado');
    expect(larguraPreview('lado', { largura: 1920, descricao: true })).toBeGreaterThan(LARGURA_TERMINAL);
  });

  it('a descrição fica entre 320 e 420px (legível mesmo com o terminal aberto)', () => {
    expect(larguraDescricao(900)).toBe(320);
    expect(larguraDescricao(1024)).toBe(320);
    expect(larguraDescricao(3000)).toBe(420);
  });
});

describe('montarGrade', () => {
  const base = { largura: 1920, descricao: true, divisao: 50 };

  it('lado a lado: descrição (com a aba de testes), código e preview', () => {
    expect(montarGrade({ ...base, modo: 'lado' })).toEqual({
      colunas: '420px minmax(0, 50fr) 6px minmax(0, 50fr)',
      linhas: 'minmax(0, 1fr)',
      areas: '"desc codigo divisor preview"',
    });
  });

  it('empilhado: a descrição ocupa a coluna toda, código em cima e preview embaixo', () => {
    expect(montarGrade({ ...base, largura: 1366, modo: 'empilhado', divisao: 40 })).toEqual({
      colunas: '355px minmax(0, 1fr)',
      linhas: 'minmax(0, 40fr) 6px minmax(0, 60fr)',
      areas: '"desc codigo" "desc divisor" "desc preview"',
    });
  });

  it('sem descrição', () => {
    expect(montarGrade({ ...base, modo: 'lado', descricao: false })).toEqual({
      colunas: 'minmax(0, 50fr) 6px minmax(0, 50fr)',
      linhas: 'minmax(0, 1fr)',
      areas: '"codigo divisor preview"',
    });
    expect(montarGrade({ ...base, modo: 'empilhado', descricao: false })).toEqual({
      colunas: 'minmax(0, 1fr)',
      linhas: 'minmax(0, 50fr) 6px minmax(0, 50fr)',
      areas: '"codigo" "divisor" "preview"',
    });
  });

  it('celular: tudo em uma coluna, sem área de testes', () => {
    expect(montarGrade({ ...base, modo: 'celular' }).areas).toBe('"desc" "codigo" "preview"');
  });
});
