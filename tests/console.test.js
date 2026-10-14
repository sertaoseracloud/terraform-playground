// terraform console: expressões com variáveis, locals, funções e o estado.
import { describe, it, expect } from 'vitest';
import { avaliarNoConsole, executarTerraform } from '../src/tf/motor.js';
import { rodarComando } from '../src/tf/comandos.js';

const CODIGO = { 'main.tf': 'variable "nome" {\n  default = "sertao"\n}\n\nlocals {\n  maiusculo = upper(var.nome)\n}\n\nresource "terraform_data" "a" {\n  input = local.maiusculo\n}\n' };

describe('terraform console', () => {
  it('avalia funções, variáveis, locals e mostra erros', () => {
    const [a, b, c, d, e] = avaliarNoConsole(CODIGO, {}, ['1 + 2', 'local.maiusculo', 'length([1, 2, 3])', 'var.nao_existe', '1 +']);
    expect(a).toEqual({ ok: true, valor: 3 });
    expect(b).toEqual({ ok: true, valor: 'SERTAO' });
    expect(c).toEqual({ ok: true, valor: 3 });
    expect(d.ok).toBe(false);
    expect(d.erro.resumo).toBe('Reference to undeclared input variable');
    expect(e.ok).toBe(false);
  });

  it('lê os recursos do estado (depois do apply)', () => {
    const { estado } = executarTerraform(CODIGO, { comando: 'apply' });
    const [a] = avaliarNoConsole(CODIGO, { estado }, ['terraform_data.a.output']);
    expect(a).toEqual({ ok: true, valor: 'SERTAO' });
  });

  it('o comando: prompt >, valores no formato do Terraform, exit sai', async () => {
    const saida = [];
    const linhas = ['upper("x")', 'var.nome', '[1, 2]', 'var.nada', 'exit'];
    const prompts = [];
    let init = null;
    const ctx = {
      arquivos: () => CODIGO, estado: () => null, workspace: () => 'default', semente: 't',
      inicializado: () => init, gravarInicializado: (m) => { init = m; },
      mostrar: async (l) => { saida.push(...l.map((x) => x.texto)); },
      escrever: (t) => saida.push(...t.replace(/\n$/, '').split('\n')),
      perguntar: async (p) => { prompts.push(p); return linhas.shift() ?? null; },
    };
    await rodarComando('terraform init', ctx);
    await rodarComando('terraform console', ctx);
    expect(prompts.every((p) => p === '> ')).toBe(true);
    expect(saida).toContain('"X"');
    expect(saida).toContain('"sertao"');
    expect(saida.join('\n')).toContain('[\n  1,\n  2,\n]');
    expect(saida.join('\n')).toContain('Error: Reference to undeclared input variable');
    expect(linhas).toEqual([]);
  });
});
