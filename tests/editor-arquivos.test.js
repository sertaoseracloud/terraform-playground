// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EditorArquivos } from '../src/ui/editor.js';
let editor;
beforeEach(() => {
  document.body.innerHTML = '<div id="abas"></div><div id="editor"></div>';
  editor = new EditorArquivos({ abas: document.getElementById('abas'), editor: document.getElementById('editor') });
  editor.carregar({ 'main.tf': '# principal', 'notas.txt': 'notas', 'dados.json': '{}' });
});
afterEach(() => { editor.view.destroy(); vi.unstubAllGlobals(); });
it('troca modo e nome acessível sem perder documento ou seleção', () => {
  editor.view.dispatch({ selection: { anchor: 3 } });
  editor.abrir('notas.txt');
  expect(editor.view.contentDOM.getAttribute('aria-label')).toContain('notas.txt — texto simples');
  editor.abrir('main.tf');
  expect(editor.view.contentDOM.getAttribute('aria-label')).toContain('main.tf — Terraform HCL');
  expect(editor.view.state.selection.main.anchor).toBe(3);
  expect(editor.view.state.doc.toString()).toBe('# principal');
});
it.each(['notas.txt', 'dados.json'])('excluir %s restaura foco no editor ativo', (nome) => {
  vi.stubGlobal('confirm', () => true);
  editor.abrir('notas.txt');
  document.querySelector(`[aria-label="Excluir ${nome}"]`).click();
  expect(document.activeElement).toBe(editor.view.contentDOM);
  expect(editor.arquivos[nome]).toBeUndefined();
});
