// Confere todo o conteúdo da trilha: a solução de cada exercício passa em todos os
// testes (inclusive os ocultos), o código inicial falha em algum caso visível e as
// lições rodam sem erro.
import { describe, it, expect } from 'vitest';
import { modulos, itens, problemas, LIVRE } from '../src/conteudo/trilha.js';
import { corrigir } from '../src/corrigir.js';
import { executarTerraform } from '../src/tf/motor.js';

describe('estrutura da trilha', () => {
  it('segue a ordem Terraform básico → AWS → Azure → Projetos', () => {
    expect(modulos.map((m) => m.id)).toEqual(['basico', 'aws', 'azure', 'projetos']);
  });

  it('tem 200 exercícios, com ids únicos', () => {
    expect(problemas).toHaveLength(200);
    expect(new Set(itens.map((i) => i.id)).size).toBe(itens.length);
  });

  it.each(problemas.map((p) => [p.id, p]))('%s tem os campos obrigatórios', (_id, p) => {
    expect(p.titulo).toBeTruthy();
    expect(['facil', 'medio', 'dificil']).toContain(p.dificuldade);
    expect(p.enunciado).toContain('<');
    expect(p.dica).toBeTruthy();
    expect(Object.keys(p.arquivos).length).toBeGreaterThan(0);
    expect(p.testes.some((t) => !t.oculto)).toBe(true);
  });
});

describe('lições e playground livre', () => {
  it.each([...itens.filter((i) => i.tipo === 'licao'), LIVRE].map((l) => [l.id, l]))('%s roda sem erros', (_id, licao) => {
    const r = executarTerraform(licao.arquivos, { comando: 'apply', semente: licao.id });
    expect(r.diagnosticos.filter((d) => d.gravidade === 'erro').map((d) => `${d.resumo}: ${d.detalhe}`)).toEqual([]);
  });
});

describe('exercícios', () => {
  it.each(problemas.map((p) => [p.id, p]))('%s: a solução passa em todos os casos', async (_id, p) => {
    const { aprovado, relatorio } = await corrigir(p, p.solucao, { incluirOcultos: true });
    const falhas = relatorio.flatMap((c) => c.resultados.filter((r) => !r.ok).map((r) => `[${c.descricao}] ${r.mensagem}: ${r.detalhe}`));
    expect(falhas).toEqual([]);
    expect(aprovado).toBe(true);
  });

  it.each(problemas.map((p) => [p.id, p]))('%s: o código inicial ainda não passa', async (_id, p) => {
    const { aprovado } = await corrigir(p, p.arquivos, { incluirOcultos: false });
    expect(aprovado).toBe(false);
  });
});
