// terraform fmt: recuo de 2 espaços, = alinhados, sem mexer no conteúdo de strings e heredocs.
import { describe, it, expect } from 'vitest';
import { formatarHcl } from '../src/tf/formatar.js';
import { rodarComando } from '../src/tf/comandos.js';

describe('terraform fmt', () => {
  it('recuo de 2 espaços, = alinhados nos atributos seguidos e espaços em volta do =', () => {
    const antes = 'resource "aws_s3_bucket" "b" {\nbucket="dados"\n    force_destroy   =true\n\ntags = {\nNome="x"\n  Ambiente = "dev"\n}\n}\n';
    expect(formatarHcl(antes)).toBe('resource "aws_s3_bucket" "b" {\n  bucket        = "dados"\n  force_destroy = true\n\n  tags = {\n    Nome     = "x"\n    Ambiente = "dev"\n  }\n}\n');
  });

  it('é idempotente e não mexe em heredoc nem em strings', () => {
    const texto = 'locals {\n  a = "x = y"\n  b = <<EOT\n  linha   =  solta\nEOT\n}\n';
    expect(formatarHcl(texto)).toBe(texto);
    expect(formatarHcl(formatarHcl(texto))).toBe(texto);
  });

  it('comentários e linha em branco separam os grupos de alinhamento; espaço antes do { do bloco; espaços no fim saem', () => {
    const antes = 'variable "regiao"{\n  type = string   \n  # a região da AWS\n  default = "us-east-1"\n  description="Região"\n}\n\n\n';
    expect(formatarHcl(antes)).toBe('variable "regiao" {\n  type = string\n  # a região da AWS\n  default     = "us-east-1"\n  description = "Região"\n}\n');
  });

  it('o heredoc alinha com os vizinhos (ele conta como uma linha só)', () => {
    const antes = 'resource "local_file" "f" {\n  filename = "a.txt"\n  content = <<-EOT\n    oi\n  EOT\n  file_permission = "0644"\n}\n';
    expect(formatarHcl(antes)).toBe('resource "local_file" "f" {\n  filename        = "a.txt"\n  content         = <<-EOT\n    oi\n  EOT\n  file_permission = "0644"\n}\n');
  });

  it('vários colchetes abertos na mesma linha recuam um nível só', () => {
    const antes = 'variable "app" {\n  type = object({\n    nome = string\n    tags = map(string)\n  })\n}\n\nlocals {\n  todas = merge(var.base, {\n    extra = "sim"\n  })\n}\n';
    expect(formatarHcl(antes)).toBe(antes);
  });

  it('chaves entre colchetes e listas de várias linhas', () => {
    const antes = 'locals {\nportas = [\n80,\n443,\n]\nmapa = { "a" = 1 }\n}\n';
    expect(formatarHcl(antes)).toBe('locals {\n  portas = [\n    80,\n    443,\n  ]\n  mapa = { "a" = 1 }\n}\n');
  });

  it('o comando lista os arquivos que mudaram e troca no editor; -check só lista; -diff mostra as diferenças', async () => {
    let arquivos = { 'main.tf': 'variable "x" {\ntype=string\n}\n', 'ok.tf': 'locals {\n  a = 1\n}\n' };
    const saida = [];
    const ctx = { arquivos: () => arquivos, trocarArquivos: (n) => { arquivos = n; }, escrever: (t) => saida.push(...t.replace(/\n$/, '').split('\n')), mostrar: async () => {} };
    await rodarComando('terraform fmt -check', ctx);
    expect(saida).toEqual(['main.tf']);
    expect(arquivos['main.tf']).toContain('type=string');
    saida.length = 0;
    await rodarComando('terraform fmt -check -diff', ctx);
    expect(saida).toContain('-type=string');
    expect(saida).toContain('+  type = string');
    await rodarComando('terraform fmt', ctx);
    expect(arquivos['main.tf']).toBe('variable "x" {\n  type = string\n}\n');
    expect(arquivos['ok.tf']).toBe('locals {\n  a = 1\n}\n');
    saida.length = 0;
    await rodarComando('terraform fmt', ctx);
    expect(saida).toEqual([]);
  });
});
