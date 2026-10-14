// @vitest-environment happy-dom
// A aba Solução só aparece depois do tempo estimado de tentativa (o "⏱ ~N min" do
// exercício) e enquanto o exercício não está resolvido.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { solucaoLiberada, minutosQueFaltam, criarCronometro } from '../src/ui/solucao.js';
import { lerTentativa, somarTentativa, marcar } from '../src/progresso.js';

const facil = { id: 'ex-facil', tipo: 'problema', dificuldade: 'facil' };
const dificil = { id: 'ex-dificil', tipo: 'problema', dificuldade: 'dificil' };

beforeEach(() => localStorage.clear());

describe('regra da aba Solução', () => {
  it('só libera depois do tempo estimado (fácil 15 min, difícil 45 min)', () => {
    expect(solucaoLiberada(facil)).toBe(false);
    expect(minutosQueFaltam(facil)).toBe(15);
    somarTentativa(facil.id, 14 * 60 + 30);
    expect(solucaoLiberada(facil)).toBe(false);
    expect(minutosQueFaltam(facil)).toBe(1);
    somarTentativa(facil.id, 30);
    expect(solucaoLiberada(facil)).toBe(true);
    expect(minutosQueFaltam(facil)).toBe(0);
    somarTentativa(dificil.id, 15 * 60);
    expect(solucaoLiberada(dificil)).toBe(false);
    expect(minutosQueFaltam(dificil)).toBe(30);
  });

  it('não aparece em exercício resolvido nem em lição', () => {
    somarTentativa(facil.id, 60 * 60);
    marcar(facil.id, 'resolvido');
    expect(solucaoLiberada(facil)).toBe(false);
    expect(solucaoLiberada({ id: 'licao-x', tipo: 'licao' })).toBe(false);
  });

  it('um exercício só tentado (não resolvido) continua contando', () => {
    marcar(facil.id, 'tentado');
    somarTentativa(facil.id, 15 * 60);
    expect(solucaoLiberada(facil)).toBe(true);
  });
});

describe('cronômetro da tentativa', () => {
  let oculto = false;
  beforeEach(() => {
    vi.useFakeTimers();
    oculto = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculto });
  });
  afterEach(() => vi.useRealTimers());

  it('conta só com o exercício aberto e a aba visível, e soma as visitas', () => {
    const mudancas = [];
    let aberto = true;
    const cronometro = criarCronometro({ passoMs: 15000, ativo: () => aberto, aoMudar: () => mudancas.push(lerTentativa(facil.id)) });
    cronometro.iniciar(facil);
    vi.advanceTimersByTime(30000);
    expect(lerTentativa(facil.id)).toBe(30);
    oculto = true;
    vi.advanceTimersByTime(60000);
    expect(lerTentativa(facil.id)).toBe(30);
    oculto = false;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(15000);
    expect(lerTentativa(facil.id)).toBe(45);
    aberto = false; // foi para outra tela
    vi.advanceTimersByTime(60000);
    expect(lerTentativa(facil.id)).toBe(45);
    cronometro.parar();
    cronometro.iniciar(facil); // voltou ao exercício: continua de onde parou
    aberto = true;
    vi.advanceTimersByTime(15000);
    expect(lerTentativa(facil.id)).toBe(60);
    expect(mudancas.length).toBeGreaterThan(0);
  });

  it('não conta em lição', () => {
    const cronometro = criarCronometro({ passoMs: 15000, ativo: () => true, aoMudar: () => {} });
    cronometro.iniciar({ id: 'licao-x', tipo: 'licao' });
    vi.advanceTimersByTime(60000);
    expect(lerTentativa('licao-x')).toBe(0);
  });
});
