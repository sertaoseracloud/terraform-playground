// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gravarRascunho, lerRascunho, apagarRascunho, marcar, statusDe } from '../src/progresso.js';
import { iniciarAvisoArmazenamento } from '../src/ui/aviso-armazenamento.js';
import { notificarFalhaArmazenamento } from '../src/armazenamento.js';

describe('armazenamento indisponível', () => {
  let encerrar;
  beforeEach(() => {
    vi.stubGlobal('localStorage', new Storage());
    document.body.innerHTML = '<div><div id="editor" tabindex="0">código em edição</div></div>';
    encerrar = iniciarAvisoArmazenamento(document.getElementById('editor'));
  });
  afterEach(() => { encerrar(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('salva e remove sem apresentar aviso, preservando o contrato dos rascunhos', () => {
    expect(gravarRascunho('A', { arquivo: 'conteúdo' })).toBe(true);
    expect(lerRascunho('A')).toEqual({ arquivo: 'conteúdo' });
    expect(apagarRascunho('A')).toBe(true);
    expect(lerRascunho('A')).toBeNull();
    expect(document.getElementById('aviso-armazenamento').hidden).toBe(true);
  });

  it.each(['setItem', 'getItem', 'removeItem'])('avisa falha em %s sem apagar código ou roubar foco', (metodo) => {
    const editor = document.getElementById('editor');
    editor.focus();
    vi.spyOn(localStorage, metodo).mockImplementation(() => { throw new DOMException('bloqueado', 'QuotaExceededError'); });
    if (metodo === 'setItem') expect(gravarRascunho('A', {})).toBe(false);
    if (metodo === 'getItem') expect(lerRascunho('A')).toBeNull();
    if (metodo === 'removeItem') expect(apagarRascunho('A')).toBe(false);
    const aviso = document.getElementById('aviso-armazenamento');
    expect(aviso.hidden).toBe(false);
    expect(aviso.getAttribute('role')).toBe('status');
    expect(aviso.textContent).toContain('Copie seus arquivos');
    expect(editor.textContent).toBe('código em edição');
    expect(document.activeElement).toBe(editor);
  });

  it('não rebaixa conquistas históricas ao salvar novas tentativas', () => {
    marcar('A', 'resolvido');
    marcar('A', 'tentado');
    expect(statusDe('A')).toBe('resolvido');
  });

  it('permite desligar o observador', () => {
    encerrar();
    notificarFalhaArmazenamento();
    expect(document.getElementById('aviso-armazenamento')).toBeNull();
  });
});
