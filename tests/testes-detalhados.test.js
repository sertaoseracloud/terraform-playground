// Casos de teste detalhados: cada verificação diz a categoria, o valor obtido e, se
// falhar, o motivo e uma dica; cada caso diz o cenário (comandos), o erro e o tempo.
import { describe, it, expect } from 'vitest';
import { corrigir } from '../src/corrigir.js';
import { detalharRegra, categoriaDe } from '../src/verificacoes.js';
import { executarTerraform } from '../src/tf/motor.js';
import { buscarItem, problemas } from '../src/conteudo/trilha.js';

const CODIGO = {
  'main.tf': `provider "aws" {
  region = "us-east-1"
}

variable "nome" {
  type    = string
  default = "site-da-turma"
}

resource "aws_vpc" "principal" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "a" {
  vpc_id     = aws_vpc.principal.id
  cidr_block = "10.0.1.0/24"
}

output "nome" {
  value = var.nome
}
`,
};

describe('verificação detalhada', () => {
  const r = executarTerraform(CODIGO, { comando: 'plan' });

  it('mostra o valor obtido também quando passa', () => {
    const d = detalharRegra({ recurso: 'aws_vpc.principal', atributo: 'cidr_block', igual: '10.0.0.0/16' }, r);
    expect(d).toMatchObject({ ok: true, categoria: 'Recurso', obtido: '"10.0.0.0/16"' });
    expect(d.dica).toBeUndefined();
  });

  it('referência: mostra de onde vem o valor', () => {
    const d = detalharRegra({ recurso: 'aws_subnet.a', atributo: 'vpc_id', referencia: 'aws_vpc.principal.id' }, r);
    expect(d.ok).toBe(true);
    expect(d.obtido).toBe('(known after apply) ← aws_vpc.principal.id');
  });

  it('quando falha: motivo e dica de onde mexer', () => {
    const errado = detalharRegra({ recurso: 'aws_vpc.principal', atributo: 'cidr_block', igual: '10.1.0.0/16' }, r);
    expect(errado).toMatchObject({ ok: false, obtido: '"10.0.0.0/16"' });
    expect(errado.detalhe).toContain('esperado "10.1.0.0/16"');
    expect(errado.dica).toMatch(/maiúsculas, aspas/);

    const semRecurso = detalharRegra({ recurso: 'aws_s3_bucket.site' }, r);
    expect(semRecurso.obtido).toBe('o recurso não aparece no plano');
    expect(semRecurso.dica).toBe('Crie o bloco resource "aws_s3_bucket" "site" (tipo e nome exatamente assim).');

    const indice = detalharRegra({ recurso: 'aws_subnet.a[2]', atributo: 'cidr_block', igual: 'x' }, r);
    expect(indice.dica).toMatch(/instância \[2\] só existe/);
  });

  it('outputs, quantidades, plano e variáveis mostram o que o Terraform calculou', () => {
    expect(detalharRegra({ saida: 'nome', igual: 'site-da-turma' }, r).obtido).toBe('"site-da-turma"');
    expect(detalharRegra({ tipo: 'aws_subnet', quantidade: 2 }, r)).toMatchObject({ ok: false, categoria: 'Quantidade', obtido: '1 recurso(s)' });
    expect(detalharRegra({ plano: { criar: 2 } }, r).obtido).toBe('2 to add, 0 to change, 0 to destroy');
    expect(detalharRegra({ variavel: 'nome', tipo: 'string' }, r).obtido).toBe('type = string, default = "site-da-turma"');
    expect(detalharRegra({ dependencia: ['aws_subnet.a', 'aws_vpc.principal'] }, r).obtido).toBe('aws_subnet.a usa: aws_vpc.principal');
  });

  it('com erro no código, a dica manda corrigir o erro primeiro', () => {
    const quebrado = executarTerraform({ 'main.tf': 'resource "aws_vpc" "x" {\n' }, { comando: 'plan' });
    const d = detalharRegra({ semErros: true }, quebrado);
    expect(d.ok).toBe(false);
    expect(d.obtido).toMatch(/^Error: /);
    expect(d.dica).toMatch(/Terminal mostra o arquivo, a linha/);
    expect(detalharRegra({ recurso: 'aws_vpc.x' }, quebrado).obtido).toBe('o plano não rodou (veja o erro do caso)');
  });

  it('toda regra usada nos exercícios tem categoria', () => {
    const regras = problemas.flatMap((p) => p.testes.flatMap((t) => (t.passos ?? [t]).flatMap((x) => x.regras ?? [])));
    expect(regras.filter((g) => categoriaDe(g) === 'Verificação')).toEqual([]);
  });
});

describe('caso de teste detalhado', () => {
  it('traz o cenário (comando, variáveis, workspace), o tempo e o primeiro erro', async () => {
    const item = buscarItem('az-grupo-variaveis');
    const { relatorio } = await corrigir(item, item.solucao, { incluirOcultos: true });
    const oculto = relatorio.find((c) => c.oculto);
    expect(oculto.cenario).toEqual([{ comando: 'plan', variaveis: { local: 'East US' } }]);
    expect(oculto.ms).toBeGreaterThan(0);
    expect(oculto.erroExecucao).toBeUndefined();

    const comErro = await corrigir(item, { 'main.tf': 'resource "x" {' }, { incluirOcultos: false });
    expect(comErro.relatorio[0].erroExecucao).toMatch(/^Error: .+\(main\.tf, linha \d+\)/);
  });

  it('marca quando o caso começa de um estado já aplicado', async () => {
    const item = buscarItem('proj-estado-4');
    const { relatorio } = await corrigir(item, item.solucao);
    expect(relatorio[0].estadoAnterior).toBe(true);
  });
});
