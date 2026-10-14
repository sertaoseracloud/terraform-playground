// @vitest-environment happy-dom
// O terminal interativo: prompt digitável, histórico, Tab, Ctrl+C/D/L, Esc e a pergunta do apply.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarTerminal } from '../src/ui/terminal.js';

let t;
let historico;
const campo = () => document.getElementById('campo-terminal');
const saida = () => document.getElementById('saida-terminal').textContent;
const tecla = (key, extra = {}) => campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
const digitar = (v) => { campo().value = v; tecla('Enter'); };

beforeEach(() => {
  document.documentElement.classList.add('a11y-sem-movimento');
  document.body.innerHTML = '<div id="terminal" class="terminal"><pre id="saida-terminal" role="log"></pre><div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal"></div></div><button id="depois">depois</button>';
  historico = [];
  t = criarTerminal(document.getElementById('saida-terminal'), {
    campo: campo(), rotulo: document.getElementById('prompt-terminal'),
    historico: [], aoMudarHistorico: (h) => { historico = h; },
    completar: (v) => ['terraform plan', 'terraform apply'].filter((c) => c.startsWith(v)),
  });
});
afterEach(() => document.documentElement.classList.remove('a11y-sem-movimento'));

describe('terminal interativo', () => {
  it('lê com o prompt do shell; o digitado fica na saída; histórico; Tab com várias opções lista', async () => {
    let p = t.ler({ pasta: 'x', rotulo: 'Comando do terminal' });
    expect(document.getElementById('prompt-terminal').textContent).toBe('aluno@sertao:~/x$ ');
    digitar('terraform plan');
    expect(await p).toBe('terraform plan');
    expect(saida()).toBe('aluno@sertao:~/x$ terraform plan\n');
    expect(historico).toEqual(['terraform plan']);
    p = t.ler({ pasta: 'x' });
    tecla('ArrowUp');
    expect(campo().value).toBe('terraform plan');
    campo().value = 'terraform ';
    tecla('Tab');
    expect(saida()).toContain('plan  apply');
    tecla('c', { ctrlKey: true });
    expect(await p).toBeNull();
    expect(saida()).toContain('aluno@sertao:~/x$ terraform ^C');
  });

  it('a pergunta do apply tem o rótulo dela; a resposta não entra no histórico; Esc tira o foco', async () => {
    let p = t.ler({ prompt: '  Enter a value: ', rotulo: 'Resposta do Terraform: digite yes para aprovar', historico: false });
    expect(campo().getAttribute('aria-label')).toBe('Resposta do Terraform: digite yes para aprovar');
    digitar('yes');
    expect(await p).toBe('yes');
    expect(saida()).toBe('  Enter a value: yes\n');
    expect(historico).toEqual([]);
    p = t.ler({ prompt: '> ' });
    campo().focus();
    tecla('Escape');
    expect(document.activeElement).not.toBe(campo());
    t.cancelarLeitura();
    expect(await p).toBeNull();
    expect(campo().disabled).toBe(true);
  });

  it('Ctrl+L limpa a saída e mantém a leitura aberta; Ctrl+D com o campo vazio é null', async () => {
    t.escrever('linha antiga\n');
    let p = t.ler({ prompt: '$ ' });
    tecla('l', { ctrlKey: true });
    expect(saida()).toBe('');
    digitar('ls');
    expect(await p).toBe('ls');
    p = t.ler({ prompt: '> ' });
    tecla('d', { ctrlKey: true });
    expect(await p).toBeNull();
  });

  it('mostrar acrescenta as linhas (com as cores) e escrever acrescenta texto', async () => {
    t.escrever('antes\n');
    await t.mostrar([{ texto: '$ terraform plan', classe: 'comando' }, { texto: 'Plan: 1 to add', classe: 'forte' }], { pasta: 'aula' });
    t.escrever('erro\n', 'erro');
    expect(saida()).toBe('antes\naluno@sertao:~/aula$ terraform plan\nPlan: 1 to add\nerro\n');
    expect(document.querySelector('#saida-terminal .l-erro').textContent).toBe('erro\n');
  });
});
