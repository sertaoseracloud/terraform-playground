import { describe, it, expect } from 'vitest';
import { analisar, analisarExpressao } from '../src/tf/parser.js';
import { avaliar } from '../src/tf/avaliador.js';
import { executarTerraform } from '../src/tf/motor.js';
import { textoDoResultado, comoTfstate } from '../src/tf/saida.js';
import { atende, escolherVersao, PROVEDORES } from '../src/tf/esquema/index.js';

const valor = (expr) => avaliar(analisarExpressao(expr), { resolver: () => { throw new Error('sem referências'); } });
const AWS = 'provider "aws" {\n  region = "us-east-1"\n}\n';
const erros = (r) => r.diagnosticos.filter((d) => d.gravidade === 'erro').map((d) => d.resumo);

describe('parser do HCL', () => {
  it('lê blocos, rótulos, atributos e linhas', () => {
    const corpo = analisar('resource "a_b" "c" {\n  x = 1\n  bloco {\n    y = "z"\n  }\n}\n');
    expect(corpo.blocos[0]).toMatchObject({ tipo: 'resource', rotulos: ['a_b', 'c'], linha: 1 });
    expect(corpo.blocos[0].corpo.atributos[0]).toMatchObject({ nome: 'x', linha: 2 });
    expect(corpo.blocos[0].corpo.blocos[0].tipo).toBe('bloco');
  });

  it.each([
    ['resource "a" "b" {\n  x = \n}', 'Invalid expression', 2],
    ['variable "x" {\n  default: 1\n}', 'Invalid argument definition', 2],
    ['locals {\n  a = "abc\n}', 'Unterminated template string', 2],
    ['resource "a" "b" {\n  x = 1\n', 'Unclosed configuration block', 1],
    ['locals {\n  a = 1\n  a = 2\n}', 'Attribute redefined', 3],
  ])('erro de sintaxe: %j', (fonte, resumo, linha) => {
    expect(() => analisar(fonte)).toThrow(expect.objectContaining({ resumo, linha }));
  });

  it('heredoc com recuo (<<-EOT)', () => {
    const corpo = analisar('locals {\n  t = <<-EOT\n    a\n      b\n    EOT\n}\n');
    expect(avaliar(corpo.blocos[0].corpo.atributos[0].expr, {})).toBe('a\n  b\n');
  });
});

describe('expressões e funções', () => {
  it.each([
    ['[for s in ["a","b","c"] : upper(s) if s != "b"]', ['A', 'C']],
    ['{for k, v in {a=1, b=2} : k => v * 10}', { a: 10, b: 20 }],
    ['cidrsubnet("10.0.0.0/16", 8, 2)', '10.0.2.0/24'],
    ['cidrsubnets("10.0.0.0/16", 4, 4, 8)', ['10.0.0.0/20', '10.0.16.0/20', '10.0.32.0/24']],
    ['cidrhost("10.0.1.0/24", 5)', '10.0.1.5'],
    ['format("%s-%03d", "web", 7)', 'web-007'],
    ['merge({a=1}, {b=2}, {a=3})', { a: 3, b: 2 }],
    ['length("ação")', 4],
    ['true ? "sim" : "não"', 'sim'],
    ['join(", ", ["x", "y"])', 'x, y'],
    ['try(tonumber("abc"), 0)', 0],
    ['can(regex("^[a-z]+$", "abc"))', true],
    ['jsonencode({b = [1, 2], a = "x"})', '{"a":"x","b":[1,2]}'],
    ['"${upper("a")}-${2 + 3}"', 'A-5'],
    ['lookup({a = 1}, "b", 42)', 42],
    ['element(["a","b"], 3)', 'b'],
    ['flatten([[1,2],[3,[4]]])', [1, 2, 3, 4]],
    ['zipmap(["a","b"], [1,2])', { a: 1, b: 2 }],
    ['toset(["b", "a", "b"])', ['a', 'b']],
    ['keys({z = 1, a = 2})', ['a', 'z']],
    ['coalesce("", null, "x")', 'x'],
    ['range(3)', [0, 1, 2]],
    ['substr("terraform", 0, 5)', 'terra'],
    ['trimsuffix("main.tf", ".tf")', 'main'],
  ])('%s', (expr, esperado) => {
    expect(valor(expr)).toEqual(esperado);
  });

  it('erros de valor com mensagem útil', () => {
    expect(() => valor('["a"][3]')).toThrow(expect.objectContaining({ resumo: 'Invalid index' }));
    expect(() => valor('nada(1)')).toThrow(expect.objectContaining({ resumo: 'Call to unknown function' }));
    expect(() => valor('"x-${[1]}"')).toThrow(expect.objectContaining({ resumo: 'Invalid template interpolation value' }));
    expect(() => valor('toset(["a"])[0]')).toThrow(expect.objectContaining({ resumo: 'Invalid index' }));
  });
});

describe('versões dos provedores', () => {
  it('restrições ~>, >= e combinadas', () => {
    expect(atende('6.14.0', '~> 6.0')).toBe(true);
    expect(atende('7.0.0', '~> 6.0')).toBe(false);
    expect(atende('6.2.0', '~> 6.1.0')).toBe(false);
    expect(atende('5.1.0', '>= 4.0, < 6.0')).toBe(true);
    expect(escolherVersao(PROVEDORES.aws, '~> 5.0')).toBe('5.100.0');
    expect(escolherVersao(PROVEDORES.aws, '~> 9.0')).toBeNull();
  });
});

describe('plan, apply e destroy', () => {
  const codigo = {
    'main.tf': `${AWS}
variable "nomes" {
  type    = set(string)
  default = ["dev", "prod"]
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "s" {
  count      = 2
  vpc_id     = aws_vpc.main.id
  cidr_block = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
}

resource "aws_s3_bucket" "b" {
  for_each = var.nomes
  bucket   = "aula-\${each.key}-2026"
}

output "vpc" {
  value = aws_vpc.main.id
}
`,
  };

  it('plano com +, valores conhecidos e (known after apply)', () => {
    const r = executarTerraform(codigo, { comando: 'plan' });
    expect(r.ok).toBe(true);
    expect(r.plano.resumo).toMatchObject({ criar: 5, alterar: 0, destruir: 0 });
    const sub = r.plano.acoes.find((a) => a.endereco === 'aws_subnet.s[1]');
    expect(sub.depois.cidr_block).toBe('10.0.1.0/24');
    expect(sub.depois.vpc_id.origem).toBe('aws_vpc.main.id');
    const texto = textoDoResultado(r);
    expect(texto).toContain('# aws_s3_bucket.b["prod"] will be created');
    expect(texto).toContain('Plan: 5 to add, 0 to change, 0 to destroy.');
    expect(texto).toContain('vpc = (known after apply)');
  });

  it('apply gera IDs estáveis, guarda o estado, e o plan seguinte não muda nada', () => {
    const a = executarTerraform(codigo, { comando: 'apply', semente: 't' });
    const b = executarTerraform(codigo, { comando: 'apply', semente: 't' });
    expect(a.ok).toBe(true);
    expect(a.estado.recursos['aws_vpc.main'].atributos.id).toMatch(/^vpc-0[0-9a-f]{16}$/);
    expect(a.estado.recursos['aws_vpc.main'].atributos.id).toBe(b.estado.recursos['aws_vpc.main'].atributos.id);
    expect(a.saidas.vpc.valor).toBe(a.estado.recursos['aws_vpc.main'].atributos.id);
    // a VPC é criada antes das sub-redes (ordem de dependência)
    const ordem = a.estado.eventos.map((e) => e.endereco);
    expect(ordem.indexOf('aws_vpc.main')).toBeLessThan(ordem.indexOf('aws_subnet.s[0]'));
    const de_novo = executarTerraform(codigo, { comando: 'plan', estado: a.estado });
    expect(de_novo.plano.resumo).toMatchObject({ criar: 0, alterar: 0, destruir: 0 });
    expect(textoDoResultado(de_novo)).toContain('No changes.');
    expect(comoTfstate(a.estado).resources.map((x) => x.type)).toContain('aws_subnet');
  });

  it('mudar um argumento que força recriação: -/+ e # forces replacement', () => {
    const { estado } = executarTerraform(codigo, { comando: 'apply' });
    const novo = { 'main.tf': codigo['main.tf'].replace('"10.0.0.0/16"', '"10.1.0.0/16"') };
    const r = executarTerraform(novo, { comando: 'plan', estado });
    expect(r.plano.resumo).toMatchObject({ substituir: 3 });
    expect(textoDoResultado(r)).toContain('# forces replacement');
  });

  it('mudar tags altera no lugar (~)', () => {
    const base = { 'main.tf': `${AWS}resource "aws_s3_bucket" "b" {\n  bucket = "aula-tags-1"\n  tags = { A = "1" }\n}\n` };
    const { estado } = executarTerraform(base, { comando: 'apply' });
    const r = executarTerraform({ 'main.tf': base['main.tf'].replace('A = "1"', 'A = "2"') }, { comando: 'plan', estado });
    expect(r.plano.acoes[0].acao).toBe('alterar');
    expect(textoDoResultado(r)).toContain('~ "A" = "1" -> "2"');
  });

  it('destroy apaga tudo e prevent_destroy impede', () => {
    const { estado } = executarTerraform(codigo, { comando: 'apply' });
    const d = executarTerraform(codigo, { comando: 'destroy', estado });
    expect(d.ok).toBe(true);
    expect(Object.keys(d.estado.recursos)).toEqual([]);
    const protegido = { 'main.tf': `${AWS}resource "aws_s3_bucket" "b" {\n  bucket = "aula-protegido"\n  lifecycle {\n    prevent_destroy = true\n  }\n}\n` };
    const e2 = executarTerraform(protegido, { comando: 'apply' }).estado;
    expect(erros(executarTerraform(protegido, { comando: 'destroy', estado: e2 }))).toContain('Instance cannot be destroyed');
  });

  it('moved renomeia sem recriar; import traz um recurso existente', () => {
    const v1 = { 'main.tf': `${AWS}resource "aws_s3_bucket" "velho" {\n  bucket = "aula-moved-1"\n}\n` };
    const { estado } = executarTerraform(v1, { comando: 'apply' });
    const v2 = { 'main.tf': `${AWS}resource "aws_s3_bucket" "novo" {\n  bucket = "aula-moved-1"\n}\nmoved {\n  from = aws_s3_bucket.velho\n  to   = aws_s3_bucket.novo\n}\n` };
    const r = executarTerraform(v2, { comando: 'plan', estado });
    expect(r.plano.movidos).toEqual([{ de: 'aws_s3_bucket.velho', para: 'aws_s3_bucket.novo' }]);
    expect(r.plano.resumo).toMatchObject({ criar: 0, destruir: 0 });
    const imp = { 'main.tf': `${AWS}import {\n  to = aws_s3_bucket.x\n  id = "legado-1"\n}\nresource "aws_s3_bucket" "x" {\n  bucket = "legado-1"\n}\n` };
    expect(executarTerraform(imp, { comando: 'plan' }).plano.resumo.importar).toBe(1);
  });

  it('módulos locais: entradas, saídas e endereço module.x', () => {
    const arquivos = {
      'main.tf': 'module "m" {\n  source = "./modulos/m"\n  nome = "a"\n}\noutput "o" {\n  value = module.m.arquivo\n}\n',
      'modulos/m/main.tf': 'variable "nome" {}\nresource "local_file" "f" {\n  filename = "${var.nome}.txt"\n  content = "x"\n}\noutput "arquivo" {\n  value = local_file.f.filename\n}\n',
    };
    const r = executarTerraform(arquivos, { comando: 'plan' });
    expect(r.ok).toBe(true);
    expect(r.plano.acoes[0].endereco).toBe('module.m.local_file.f');
    expect(r.saidas.o.valor).toBe('a.txt');
  });
});

describe('erros no formato do Terraform, explicados em português', () => {
  it.each([
    ['tipo com erro de digitação', `${AWS}resource "aws_s3_buckett" "b" {}\n`, 'Invalid resource type', /aws_s3_bucket/],
    ['provedor que não existe', 'resource "awz_s3_bucket" "b" {}\n', 'Failed to query available provider packages', /aws/],
    ['argumento obrigatório', `${AWS}resource "aws_instance" "w" {\n  instance_type = "t3.micro"\n}\n`, 'Missing required argument', /ami/],
    ['tags como bloco', `${AWS}resource "aws_s3_bucket" "b" {\n  tags {\n    A = "1"\n  }\n}\n`, 'Unsupported block type', /sinal de igual/],
    ['atributo calculado', `${AWS}resource "aws_s3_bucket" "b" {\n  arn = "x"\n}\n`, 'Value for unconfigurable attribute', /leitura/],
    ['variável não declarada', `${AWS}resource "aws_s3_bucket" "b" {\n  bucket = var.x\n}\n`, 'Reference to undeclared input variable', /variable "x"/],
    ['for_each com lista', 'resource "random_pet" "p" {\n  for_each = ["a"]\n}\n', 'Invalid for_each argument', /toset/],
    ['count desconhecido', 'resource "random_id" "a" {\n  byte_length = 2\n}\nresource "random_pet" "p" {\n  count = length(random_id.a.hex)\n}\n', 'Invalid count argument', /apply/],
    ['output sensível sem sensitive', 'variable "s" {\n  default = "x"\n  sensitive = true\n}\noutput "o" {\n  value = var.s\n}\n', 'Output refers to sensitive values', /sensitive = true/],
    ['azurerm sem features', 'provider "azurerm" {}\n', 'Insufficient features blocks', /features/],
    ['nome de storage inválido', 'provider "azurerm" {\n  features {}\n}\nresource "azurerm_storage_account" "s" {\n  name = "Meu_Storage"\n  resource_group_name = "rg"\n  location = "brazilsouth"\n  account_tier = "Standard"\n  account_replication_type = "LRS"\n}\n', 'name ("Meu_Storage") can only consist of lowercase letters and numbers, and must be between 3 and 24 characters long', /provedor/],
    ['ciclo', 'locals {\n  a = local.b\n  b = local.a\n}\n', 'Cycle', /ciclo/],
  ])('%s', (_nome, main, resumo, detalhe) => {
    const r = executarTerraform({ 'main.tf': main }, { comando: 'plan' });
    expect(r.ok).toBe(false);
    const d = r.diagnosticos.find((x) => x.resumo === resumo);
    expect(d, `esperado "${resumo}", veio ${erros(r).join(' | ')}`).toBeTruthy();
    expect(d.detalhe).toMatch(detalhe);
    expect(textoDoResultado(r)).toContain(`Error: ${resumo}`);
  });

  it('erros da API só aparecem no apply (nome de bucket já usado)', () => {
    const main = { 'main.tf': `${AWS}resource "aws_s3_bucket" "b" {\n  bucket = "teste"\n}\n` };
    expect(executarTerraform(main, { comando: 'plan' }).ok).toBe(true);
    const r = executarTerraform(main, { comando: 'apply' });
    expect(r.ok).toBe(false);
    expect(r.diagnosticos[0].detalhe).toContain('BucketAlreadyExists');
    expect(r.estado.recursos).toEqual({});
  });
});
