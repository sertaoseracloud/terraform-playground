import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarGravadorRascunho } from '../src/rascunho.js';

describe('gravação dos rascunhos', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('não perde A quando B é editado antes de 300 ms', () => {
    const gravar = vi.fn();
    const fila = criarGravadorRascunho(gravar);
    fila.agendar('A', { codigo: 'edição A' });
    vi.advanceTimersByTime(100);
    fila.agendar('B', { codigo: 'edição B' });
    vi.advanceTimersByTime(199);
    expect(gravar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(gravar).toHaveBeenCalledWith('A', { codigo: 'edição A' });
    vi.advanceTimersByTime(100);
    expect(gravar).toHaveBeenCalledWith('B', { codigo: 'edição B' });
  });

  it('isola snapshots e agrupa somente edições do mesmo item', () => {
    const gravar = vi.fn();
    const fila = criarGravadorRascunho(gravar);
    const arquivos = { codigo: 'primeiro' };
    fila.agendar('A', arquivos);
    arquivos.codigo = 'segundo';
    fila.agendar('A', arquivos);
    arquivos.codigo = 'mutação posterior';
    vi.advanceTimersByTime(300);
    expect(gravar).toHaveBeenCalledExactlyOnceWith('A', { codigo: 'segundo' });
  });

  it('descarrega antes da transição sem duplicar a gravação depois', () => {
    const gravar = vi.fn();
    const fila = criarGravadorRascunho(gravar);
    fila.agendar('A', { codigo: 'novo' });
    expect(fila.descarregar()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(fila.descarregar()).toBe(true);
  });

  it('restaurar antes do debounce não ressuscita código, nem cancela outro item', () => {
    const gravar = vi.fn();
    const fila = criarGravadorRascunho(gravar);
    fila.agendar('A', { codigo: 'descartado' });
    fila.agendar('B', { codigo: 'preservado' });
    vi.advanceTimersByTime(299);
    fila.cancelar('A');
    vi.advanceTimersByTime(1000);
    expect(gravar).toHaveBeenCalledExactlyOnceWith('B', { codigo: 'preservado' });
  });

  it('retém uma gravação que falhou para tentar novamente na saída', () => {
    const gravar = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const fila = criarGravadorRascunho(gravar);
    fila.agendar('A', { codigo: 'mantido' });
    expect(fila.descarregar()).toBe(false);
    expect(fila.descarregar()).toBe(true);
    expect(gravar).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(gravar).toHaveBeenCalledTimes(2);
  });

  it('cancelar tudo invalida também as tentativas de gravação após uma falha', () => {
    const gravar = vi.fn().mockReturnValue(false);
    const fila = criarGravadorRascunho(gravar);
    fila.agendar('A', {});
    vi.advanceTimersByTime(300);
    fila.agendar('B', {});
    fila.cancelar();
    vi.advanceTimersByTime(1000);
    expect(fila.descarregar()).toBe(true);
    expect(gravar).toHaveBeenCalledTimes(1);
    fila.cancelar('inexistente');
  });
});
