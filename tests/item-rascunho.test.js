// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { EditorView } from 'codemirror';
import { criarTelaItem } from '../src/ui/item.js';
import { buscarItem, modulos } from '../src/conteudo/trilha.js';
import { lerRascunho } from '../src/progresso.js';

vi.mock('../src/ui/terminal.js', () => ({
  criarTerminal: () => ({
    pular() {}, cancelarLeitura() {}, limpar() {}, escrever() {}, focar() {}, silenciar() {},
    mostrar: async () => {},
    ler: () => new Promise(() => {}),
  }),
}));

const html = readFileSync('index.html', 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
const outro = modulos.flatMap((m) => m.itens).find((i) => i.tipo === 'problema').id;
describe('proteção do rascunho na tela', () => {
  let tela, view;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', new window.Storage());
    document.body.innerHTML = corpo;
    tela = criarTelaItem({ layout: { aplicar() {}, mostrarDescricao() {} }, definirStatus() {}, aoMudarProgresso() {} });
    tela.abrir('livre');
    view = EditorView.findFromDOM(document.querySelector('.cm-content'));
  });
  afterEach(() => { view.destroy(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const editar = (texto) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: texto } });
  it('salva antes da transição rápida e isola os exercícios', () => {
    const principal = Object.keys(buscarItem('livre').arquivos)[0];
    editar('rascunho A');
    vi.advanceTimersByTime(100);
    tela.abrir(outro);
    expect(lerRascunho('livre')[principal]).toBe('rascunho A');
    editar('rascunho B');
    vi.advanceTimersByTime(300);
    expect(Object.values(lerRascunho(outro))).toContain('rascunho B');
    tela.abrir('livre');
    expect(view.state.doc.toString()).toBe('rascunho A');
  });
  it('restaurar invalida a gravação pendente', () => {
    vi.stubGlobal('confirm', () => true);
    editar('descartado');
    vi.advanceTimersByTime(299);
    document.getElementById('btn-restaurar').click();
    vi.advanceTimersByTime(500);
    expect(lerRascunho('livre')).toBeNull();
    tela.abrir('livre');
    expect(view.state.doc.toString()).toBe(Object.values(buscarItem('livre').arquivos)[0]);
  });
  it.each(['pagehide', 'hashchange'])('%s descarrega sem esperar debounce', (evento) => {
    editar('última edição');
    window.dispatchEvent(new Event(evento));
    expect(Object.values(lerRascunho('livre'))).toContain('última edição');
  });
  it('quota exibe aviso sem perder o código', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    editar('meu código');
    vi.advanceTimersByTime(300);
    expect(view.state.doc.toString()).toBe('meu código');
    expect(document.getElementById('aviso-armazenamento').hidden).toBe(false);
  });
});
