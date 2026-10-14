// @vitest-environment happy-dom
// O terminal na tela do exercício, com o simulador de verdade: o prompt digitável, os
// botões que digitam os comandos, o init e a pergunta do apply.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarTelaItem } from '../src/ui/item.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
const saida = () => document.getElementById('saida-terminal').textContent;
const prompt = () => document.getElementById('prompt-terminal').textContent;
const campo = () => document.getElementById('campo-terminal');

async function ate(condicao, ms = 3000) {
  const fim = Date.now() + ms;
  while (!condicao()) {
    if (Date.now() > fim) throw new Error(`não aconteceu a tempo; saída:\n${saida()}\nprompt: ${prompt()}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

function digitar(texto) {
  campo().value = texto;
  campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

function montar() {
  document.body.innerHTML = corpo;
  window.confirm = () => true;
  return criarTelaItem({ layout: { aplicar() {}, mostrarDescricao() {} }, definirStatus: () => {}, aoMudarProgresso: () => {} });
}

const noPrompt = (id) => () => prompt() === `aluno@sertao:~/${id}$ `;

describe('terminal na tela do exercício', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.add('a11y-sem-movimento');
  });
  afterEach(() => document.documentElement.classList.remove('a11y-sem-movimento'));

  it('abrir roda terraform init e terraform plan e deixa o prompt esperando', async () => {
    const tela = montar();
    tela.abrir('livre');
    await ate(noPrompt('livre'));
    expect(saida()).toContain('$ terraform init');
    expect(saida()).toContain('Terraform has been successfully initialized!');
    expect(saida()).toContain('$ terraform plan');
  });

  it('o botão Apply digita terraform apply e espera o yes', async () => {
    const tela = montar();
    tela.abrir('livre');
    await ate(noPrompt('livre'));
    document.getElementById('btn-apply').click();
    await ate(() => prompt() === '  Enter a value: ');
    expect(saida()).toContain('$ terraform apply');
    expect(campo().getAttribute('aria-label')).toBe('Resposta do Terraform: digite yes para aprovar');
    digitar('yes');
    await ate(() => saida().includes('Apply complete!'));
    await ate(noPrompt('livre'));
    expect(document.getElementById('contador-estado').textContent).not.toBe('');
  });

  it('digitar comandos no prompt: state list, output e um comando que não existe', async () => {
    const tela = montar();
    tela.abrir('livre');
    await ate(noPrompt('livre'));
    digitar('terraform apply -auto-approve');
    await ate(() => saida().includes('Apply complete!') && noPrompt('livre')());
    digitar('terraform state list');
    await ate(() => saida().includes('aluno@sertao:~/livre$ terraform state list\nrandom_pet.nome\n') && noPrompt('livre')());
    digitar('voar');
    await ate(() => saida().includes('bash: voar: command not found'));
  });

  it('trocar de exercício com o terminal esperando o yes cancela o apply', async () => {
    const tela = montar();
    tela.abrir('livre');
    await ate(noPrompt('livre'));
    document.getElementById('btn-apply').click();
    await ate(() => prompt() === '  Enter a value: ');
    tela.abrir('licao-o-que-e-terraform');
    await ate(noPrompt('licao-o-que-e-terraform'));
    expect(saida()).not.toContain('Apply complete!');
    expect(saida()).not.toContain('Apply cancelled.');
    expect(saida()).toContain('$ terraform plan');
  });

  it('um provedor novo no código: o botão Plan roda o terraform init antes', async () => {
    const tela = montar();
    tela.abrir('livre');
    await ate(noPrompt('livre'));
    digitar('clear');
    await ate(() => saida() === '');
    // A pasta já foi inicializada sem o provedor random: o próximo comando precisa de init.
    localStorage.setItem(Object.keys(localStorage).find((k) => k.includes('init:livre')), JSON.stringify({}));
    document.getElementById('btn-executar').click();
    await ate(() => saida().includes('$ terraform plan') && noPrompt('livre')());
    expect(saida().indexOf('$ terraform init')).toBeLessThan(saida().indexOf('$ terraform plan'));
  });
});
