// @vitest-environment happy-dom
// Avisos falados para leitores de tela e resumo dos resultados de teste.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { anunciar, falaDosTestes, frase, leitorDeTela } from '../src/ui/anuncios.js';

const caso = (ok, resultados = [], extra = {}) => ({ ok, resultados, ...extra });
const falhou = { ok: false, mensagem: 'O Pod não tem label app', detalhe: 'label ausente', dica: 'adicione labels ao metadata' };

afterEach(() => vi.useRealTimers());

describe('frase', () => {
  it('termina com ponto quando não tem pontuação', () => {
    expect(frase('linha 3')).toBe('linha 3.');
  });

  it('mantém pontuação existente', () => {
    expect(frase('Pronto!')).toBe('Pronto!');
    expect(frase('Erro?')).toBe('Erro?');
  });

  it('normaliza espaços extras', () => {
    expect(frase('  linha  3 ')).toBe('linha 3.');
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(frase('')).toBe('');
    expect(frase(null)).toBe('');
  });
});

describe('anunciar', () => {
  it('esvazia e preenche depois de um instante (leitor percebe a mudança)', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="anuncio" role="status" aria-live="polite">Antigo</div>';
    anunciar('Novo texto');
    expect(document.getElementById('anuncio').textContent).toBe('');
    vi.advanceTimersByTime(100);
    expect(document.getElementById('anuncio').textContent).toBe('Novo texto');
  });

  it('não faz nada sem região ou texto', () => {
    expect(() => anunciar('', null)).not.toThrow();
    expect(() => anunciar(null, null)).not.toThrow();
  });
});

describe('falaDosTestes', () => {
  it('aceito no envio: fala que passou inclusive ocultos', () => {
    const fala = falaDosTestes({ aprovado: true, relatorio: [caso(true), caso(true)] }, { envio: true });
    expect(fala).toContain('Aceito');
    expect(fala).toContain('2 casos passaram');
    expect(fala).toContain('inclusive os ocultos');
  });

  it('aprovado sem envio: lembra do atalho Control Shift Enter', () => {
    const fala = falaDosTestes({ aprovado: true, relatorio: [caso(true)] });
    expect(fala).toContain('Control Shift Enter');
  });

  it('falha: placar, caso, motivo e dica da primeira falha', () => {
    const fala = falaDosTestes(
      { aprovado: false, relatorio: [caso(true), caso(false, [{ ok: true, mensagem: 'ok' }, falhou])] },
      { nomes: ['Caso 1', 'Caso 2'] },
    );
    expect(fala).toContain('1 de 2 casos passaram');
    expect(fala).toContain('Caso 2 falhou');
    expect(fala).toContain('label ausente');
    expect(fala).toContain('adicione labels');
  });

  it('sem detalhado fala só a primeira falha; com ele, todas', () => {
    const relatorio = [caso(false, [falhou, { ...falhou, mensagem: 'Segunda' }]), caso(false, [falhou])];
    const curta = falaDosTestes({ aprovado: false, relatorio }, { nomes: ['Caso 1', '🔒 Oculto 1'] });
    expect(curta).toContain('Mais 1 caso com falha');
    expect(curta).not.toContain('Segunda');
    const completa = falaDosTestes({ aprovado: false, relatorio }, { nomes: ['Caso 1', '🔒 Oculto 1'], detalhado: true });
    expect(completa).toContain('Segunda');
    expect(completa).toContain('Oculto 1 falhou');
  });

  it('com erro no código, não repete o erro', () => {
    const fala = falaDosTestes(
      { aprovado: false, relatorio: [caso(false, [falhou], { erroExecucao: 'Missing required field' })] },
      { codigoComErro: true },
    );
    expect(fala).toContain('Corrija primeiro o erro do código');
    expect(fala).not.toContain('Missing required field');
  });

  it('sem pressão: mensagem gentil', () => {
    const fala = falaDosTestes({ aprovado: false, relatorio: [caso(false, [falhou])] }, { gentil: true });
    expect(fala).toMatch(/^Ainda não passou/);
  });

  it('um único caso aprovado no envio usa singular', () => {
    const fala = falaDosTestes({ aprovado: true, relatorio: [caso(true)] }, { envio: true });
    expect(fala).toContain('o caso passou');
  });
});

describe('leitorDeTela', () => {
  it('retorna false quando classe não está presente', () => {
    document.documentElement.classList.remove('a11y-leitor-tela');
    expect(leitorDeTela()).toBe(false);
  });

  it('retorna true quando classe está presente', () => {
    document.documentElement.classList.add('a11y-leitor-tela');
    expect(leitorDeTela()).toBe(true);
    document.documentElement.classList.remove('a11y-leitor-tela');
  });
});