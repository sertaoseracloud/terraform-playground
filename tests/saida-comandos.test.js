// A saída de cada comando separada (para o terminal interativo), juntando de novo na de hoje.
import { describe, it, expect } from 'vitest';
import { executarTerraform } from '../src/tf/motor.js';
import { linhasDoResultado, linhasDoInit, linhasDoPlano, linhasDaPergunta, linhasDoApply, linhaDoComando, linhasDosDiagnosticos, temMudancas } from '../src/tf/saida.js';

const CODIGO = { 'main.tf': 'resource "terraform_data" "a" {\n  input = "oi"\n}\n' };
const texto = (linhas) => linhas.map((l) => l.texto).join('\n');

describe('saída por comando', () => {
  it('as partes juntas dão a saída de hoje', () => {
    const r = executarTerraform(CODIGO, { comando: 'apply' });
    const partes = [
      linhaDoComando('terraform init'), ...linhasDoInit(r, { primeiraVez: true }),
      linhaDoComando('terraform apply'), { texto: '', classe: '' }, ...linhasDoPlano(r), ...linhasDaPergunta(r),
    ];
    const hoje = texto(linhasDoResultado(r, { primeiraVez: true }));
    expect(hoje.startsWith(texto(partes))).toBe(true);
    expect(texto(linhasDaPergunta(r))).toContain('Only \'yes\' will be accepted to approve.');
    expect(linhasDaPergunta(r).at(-1).texto).toBe('  Enter a value: ');
    expect(texto(linhasDoApply(r))).toContain('Apply complete! Resources: 1 added, 0 changed, 0 destroyed.');
    expect(hoje.endsWith(texto(linhasDoApply(r)))).toBe(true);
    expect(temMudancas(r)).toBe(true);
  });

  it('o plano sozinho termina no resumo', () => {
    const r = executarTerraform(CODIGO, { comando: 'plan' });
    expect(texto(linhasDoPlano(r))).toContain('Plan: 1 to add, 0 to change, 0 to destroy.');
    expect(texto(linhasDoPlano(r))).not.toContain('terraform init');
  });

  it('os diagnósticos saem nas caixas do Terraform', () => {
    const r = executarTerraform({ 'main.tf': 'resource "terraform_data" "a" {\n  input = var.x\n}\n' }, { comando: 'plan' });
    const t = texto(linhasDosDiagnosticos(r.diagnosticos));
    expect(t).toContain('╷');
    expect(t).toContain('│ Error: Reference to undeclared input variable');
    expect(texto(linhasDoPlano(r))).toContain('│ Error: Reference to undeclared input variable');
  });
});
