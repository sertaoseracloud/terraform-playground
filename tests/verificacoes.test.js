// Regras que os casos de teste usam para conferir o resultado (src/verificacoes.js):
// cada tipo passa quando deve e falha com um motivo útil quando não deve.
// Os 200 exercícios (conteudo.test.js) cobrem o caminho feliz; aqui ficam as falhas.
import { describe, it, expect } from 'vitest';
import { verificarRegra, categoriaDe } from '../src/verificacoes.js';
import { executarTerraform } from '../src/tf/motor.js';

const MAIN = `
provider "aws" {
  region = "us-east-1"
}

variable "nome" {
  type        = string
  default     = "site"
  description = "Nome do bucket"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "pub" {
  count      = 2
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.\${count.index}.0/24"
}

resource "aws_s3_bucket" "site" {
  bucket = "\${var.nome}-prod"
}

output "bucket" {
  value = aws_s3_bucket.site.bucket
}
`;
const arquivos = { 'main.tf': MAIN };
const r = executarTerraform(arquivos, { comando: 'plan', semente: 'verificacoes' });
const conferir = (regra, resultado = r) => verificarRegra(regra, resultado, { arquivos });

describe('verificarRegra', () => {
  it('o código de exemplo roda sem erros', () => {
    expect(conferir({ semErros: true })).toMatchObject({ ok: true });
  });

  it('semErros falha com o primeiro erro, com arquivo e linha', () => {
    const quebrado = executarTerraform({ 'main.tf': 'resource "aws_s3_bucket" "b" {\n  nao_existe = 1\n}\n' }, { comando: 'plan' });
    const v = verificarRegra({ semErros: true }, quebrado);
    expect(v.ok).toBe(false);
    expect(v.detalhe).toMatch(/main\.tf linha \d/);
  });

  it('erro: passa só quando o Terraform recusa com aquele erro', () => {
    expect(conferir({ erro: 'Unsupported argument' })).toMatchObject({ ok: false, detalhe: 'o Terraform aceitou a configuração (era para recusar)' });
  });

  it('recurso com atributo: igual, contem e o motivo quando não bate', () => {
    expect(conferir({ recurso: 'aws_s3_bucket.site', atributo: 'bucket', igual: 'site-prod' }).ok).toBe(true);
    expect(conferir({ recurso: 'aws_s3_bucket.site', atributo: 'bucket', contem: 'prod' }).ok).toBe(true);
    const v = conferir({ recurso: 'aws_s3_bucket.site', atributo: 'bucket', igual: 'site-dev' });
    expect(v).toMatchObject({ ok: false, detalhe: 'aws_s3_bucket.site.bucket: esperado "site-dev", veio "site-prod"' });
  });

  it('recurso que não existe: diz o que procurar', () => {
    expect(conferir({ recurso: 'aws_s3_bucket.outro' }).detalhe).toContain('não encontrei aws_s3_bucket.outro no plano');
  });

  it('referência: o valor vem de outro recurso (known after apply)', () => {
    expect(conferir({ recurso: 'aws_subnet.pub', atributo: 'vpc_id', referencia: 'aws_vpc.main' }).ok).toBe(true);
    expect(conferir({ recurso: 'aws_subnet.pub', atributo: 'vpc_id', referencia: 'aws_vpc.outra' }).ok).toBe(false);
  });

  it('ação planejada', () => {
    expect(conferir({ recurso: 'aws_vpc.main', acao: 'criar' }).ok).toBe(true);
    expect(conferir({ recurso: 'aws_vpc.main', acao: 'destruir' })).toMatchObject({ ok: false });
  });

  it('quantidade por tipo e por bloco (count)', () => {
    expect(conferir({ tipo: 'aws_subnet', quantidade: 2 }).ok).toBe(true);
    expect(conferir({ instancias: 'aws_subnet.pub', quantidade: 3 })).toMatchObject({ ok: false, detalhe: 'gerou 2' });
  });

  it('variável: tipo, default e description', () => {
    expect(conferir({ variavel: 'nome', tipo: 'string', padrao: 'site', descricao: true }).ok).toBe(true);
    expect(conferir({ variavel: 'nome', sensivel: true })).toMatchObject({ ok: false, detalhe: 'falta sensitive = true' });
    expect(conferir({ variavel: 'regiao' }).detalhe).toBe('não encontrei variable "regiao"');
  });

  it('output e resumo do plano', () => {
    expect(conferir({ saida: 'bucket', igual: 'site-prod' }).ok).toBe(true);
    expect(conferir({ plano: { criar: 4 } }).ok).toBe(true);
    expect(conferir({ plano: { criar: 5 } })).toMatchObject({ ok: false, detalhe: 'to add: 4 (esperado 5)' });
  });

  it('dependência no grafo', () => {
    expect(conferir({ dependencia: ['aws_subnet.pub', 'aws_vpc.main'] }).ok).toBe(true);
    expect(conferir({ dependencia: ['aws_vpc.main', 'aws_subnet.pub'] }).ok).toBe(false);
  });

  it('código, semCodigo e arquivo', () => {
    expect(conferir({ codigo: 'count\\s*=' }).ok).toBe(true);
    expect(conferir({ semCodigo: 'brazilsouth' }).ok).toBe(true);
    expect(conferir({ semCodigo: 'us-east-1' })).toMatchObject({ ok: false, detalhe: 'encontrei no código' });
    expect(conferir({ arquivo: 'variables.tf' })).toMatchObject({ ok: false, detalhe: 'crie o arquivo variables.tf (botão + do editor)' });
  });

  it('a mensagem da regra (msg) substitui a padrão', () => {
    expect(conferir({ semErros: true, msg: 'Roda sem erros' }).mensagem).toBe('Roda sem erros');
  });

  it('regra desconhecida é um erro de quem escreveu o exercício', () => {
    expect(() => conferir({ inventada: true })).toThrow('Regra desconhecida');
  });

  it('cada tipo de regra tem categoria', () => {
    expect(categoriaDe({ recurso: 'x' })).toBe('Recurso');
    expect(categoriaDe({ tipo: 'aws_subnet', quantidade: 1 })).toBe('Quantidade');
    expect(categoriaDe({ inventada: true })).toBe('Verificação');
  });
});
