// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { precisaPausa, PAUSA, aplicarChecklist, pedidosDoEnunciado } from '../src/ui/neuro.js';
import { lerTarefas } from '../src/progresso.js';

const MIN = 60_000;

describe('lembrete de pausa', () => {
  const agora = 100 * MIN;
  it('avisa depois de 25 minutos seguidos de atividade', () => {
    expect(precisaPausa({ inicio: agora - 24 * MIN, ultimaAtividade: agora, agora })).toBe(false);
    expect(precisaPausa({ inicio: agora - PAUSA.focoMin * MIN, ultimaAtividade: agora, agora })).toBe(true);
  });

  it('não avisa quem já está parado (já descansou)', () => {
    expect(precisaPausa({ inicio: agora - 40 * MIN, ultimaAtividade: agora - 6 * MIN, agora })).toBe(false);
  });
});

describe('lista de tarefas', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.add('a11y-checklist');
  });

  const montar = () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <ul><li>um <code>h1</code></li><li>um parágrafo</li></ul>
      <details><summary>Dica</summary><ul><li>não conta</li></ul></details>`;
    return div;
  };

  it('ignora listas dentro de dicas', () => {
    expect(pedidosDoEnunciado(montar())).toHaveLength(2);
  });

  it('marca, mostra o progresso e lembra por exercício', () => {
    const div = montar();
    aplicarChecklist(div, 'html-teste');
    const caixas = div.querySelectorAll('li.tarefa input');
    expect(caixas).toHaveLength(2);
    expect(div.querySelector('li.tarefa code')).not.toBeNull(); // conteúdo preservado
    expect(div.querySelector('.tarefas-progresso').textContent).toContain('0 de 2');

    caixas[1].checked = true;
    caixas[1].dispatchEvent(new Event('change'));
    expect(div.querySelector('.tarefas-progresso').textContent).toContain('1 de 2');
    expect(lerTarefas('html-teste')).toEqual([1]);

    const deNovo = montar();
    aplicarChecklist(deNovo, 'html-teste');
    expect(deNovo.querySelectorAll('li.tarefa input')[1].checked).toBe(true);
  });

  it('sem a opção ligada, não mexe no enunciado', () => {
    document.documentElement.classList.remove('a11y-checklist');
    const div = montar();
    aplicarChecklist(div, 'x');
    expect(div.querySelector('li.tarefa')).toBeNull();
  });
});

describe('estrutura do enunciado', () => {
  beforeEach(() => document.documentElement.classList.add('a11y-checklist'));

  it('prefere os pedidos de "O que fazer"; sem eles, usa "Como saber que deu certo"', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <ol class="roteiro"><li>Leia</li></ol>
      <section class="secao-fazer"><p>Mostre o total.</p></section>
      <section class="glossario"><ul><li>termo</li></ul></section>
      <section class="secao-conferir"><ul><li>A página mostra "8"</li><li>Sem erros</li></ul></section>`;
    expect(pedidosDoEnunciado(div).map((li) => li.textContent)).toEqual(['A página mostra "8"', 'Sem erros']);
    div.querySelector('.secao-fazer').innerHTML = '<ul><li>um h1</li></ul>';
    expect(pedidosDoEnunciado(div).map((li) => li.textContent)).toEqual(['um h1']);
  });
});
