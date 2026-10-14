// Cada comando do terminal com um contexto falso (o terminal e o estado em memória).
import { describe, it, expect, beforeEach } from 'vitest';
import { rodarComando, dividir } from '../src/tf/comandos.js';

let ctx;
let saida;
let respostas;
const tudo = () => saida.join('\n');

function novoCtx(arquivos) {
  saida = [];
  respostas = [];
  const estados = { default: null };
  let ws = 'default';
  let init = null;
  let arqs = { ...arquivos };
  return {
    arquivos: () => arqs,
    trocarArquivos: (novos) => { arqs = { ...novos }; },
    estado: () => estados[ws],
    gravarEstado: (e) => { estados[ws] = e; },
    workspace: () => ws,
    trocarWorkspace: (n) => { ws = n; },
    workspaces: () => Object.keys(estados),
    criarWorkspace: (n) => { estados[n] = null; ws = n; },
    apagarWorkspace: (n) => { delete estados[n]; },
    inicializado: () => init,
    gravarInicializado: (m) => { init = m; },
    semente: 'teste',
    mostrar: async (linhas) => { saida.push(...linhas.map((l) => l.texto)); },
    escrever: (t) => { saida.push(...t.replace(/\n$/, '').split('\n')); },
    perguntar: async () => respostas.shift() ?? null,
    abrirGrafo: () => {},
    aoResultado: () => {},
  };
}

const CODIGO = { 'main.tf': 'resource "terraform_data" "a" {\n  input = "oi"\n}\n\noutput "valor" {\n  value = terraform_data.a.input\n}\n' };
const AWS = { 'main.tf': 'terraform {\n  required_providers {\n    aws = {\n      source  = "hashicorp/aws"\n      version = "~> 6.0"\n    }\n  }\n}\n\nprovider "aws" {\n  region = "us-east-1"\n}\n\nresource "aws_s3_bucket" "b" {\n  bucket = "dados-sertao"\n}\n' };

beforeEach(() => { ctx = novoCtx(CODIGO); });

describe('comandos do terminal', () => {
  it('dividir respeita aspas', () => {
    expect(dividir(`terraform plan -var 'nome=Ana Lia' -var="x=1"`)).toEqual(['terraform', 'plan', '-var', 'nome=Ana Lia', '-var=x=1']);
  });

  it('sem init, o plan pede terraform init', async () => {
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('Error: Inconsistent dependency lock file');
    expect(tudo()).toContain('terraform init');
  });

  it('um provedor novo no código pede terraform init de novo', async () => {
    await rodarComando('terraform init', ctx);
    ctx.trocarArquivos(AWS);
    saida.length = 0;
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('- provider registry.terraform.io/hashicorp/aws: required by this configuration but no version is selected');
    await rodarComando('terraform init', ctx);
    expect(tudo()).toContain('- Installing hashicorp/aws v');
    saida.length = 0;
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('Plan: 1 to add, 0 to change, 0 to destroy.');
  });

  it('init, validate e plan', async () => {
    await rodarComando('terraform init', ctx);
    expect(tudo()).toContain('Terraform has been successfully initialized!');
    await rodarComando('terraform validate', ctx);
    expect(tudo()).toContain('Success! The configuration is valid.');
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('Plan: 1 to add, 0 to change, 0 to destroy.');
    expect(ctx.estado()).toBeNull();
  });

  it('plan -var e -destroy', async () => {
    ctx = novoCtx({ 'main.tf': 'variable "nome" {\n  type = string\n}\n\noutput "ola" {\n  value = "Olá, ${var.nome}"\n}\n' });
    await rodarComando('terraform init', ctx);
    await rodarComando(`terraform plan -var 'nome=Ana Lia'`, ctx);
    expect(tudo()).toContain('+ ola = "Olá, Ana Lia"');
    await rodarComando('terraform apply -auto-approve -var nome=Bia', ctx);
    saida.length = 0;
    await rodarComando('terraform plan -destroy -var nome=Bia', ctx);
    expect(tudo()).toContain('- ola = "Olá, Bia" -> null');
  });

  it('apply espera o yes; outra resposta cancela; -auto-approve não pergunta', async () => {
    await rodarComando('terraform init', ctx);
    respostas.push('no');
    await rodarComando('terraform apply', ctx);
    expect(tudo()).toContain('Apply cancelled.');
    expect(ctx.estado()).toBeNull();
    respostas.push('yes');
    await rodarComando('terraform apply', ctx);
    expect(tudo()).toContain('Apply complete! Resources: 1 added');
    expect(Object.keys(ctx.estado().recursos)).toContain('terraform_data.a');
    saida.length = 0;
    await rodarComando('terraform apply', ctx);
    expect(tudo()).toContain('No changes.');
    expect(tudo()).not.toContain('Enter a value');
    respostas.push(null); // Ctrl+C na pergunta
    await rodarComando('terraform destroy', ctx);
    expect(tudo()).toContain('Destroy cancelled.');
    saida.length = 0;
    await rodarComando('terraform destroy -auto-approve', ctx);
    expect(tudo()).toContain('Destroy complete! Resources: 1 destroyed.');
    expect(tudo()).not.toContain('Enter a value');
  });

  it('o apply aplica o plano mostrado, mesmo se o código mudar antes do yes', async () => {
    await rodarComando('terraform init', ctx);
    ctx.perguntar = async () => { ctx.trocarArquivos({ 'main.tf': '' }); return 'yes'; };
    await rodarComando('terraform apply', ctx);
    expect(Object.keys(ctx.estado().recursos)).toContain('terraform_data.a');
  });

  it('apply com erro no código não pergunta', async () => {
    ctx = novoCtx({ 'main.tf': 'resource "terraform_data" "a" {\n  input = var.nao_existe\n}\n' });
    await rodarComando('terraform init', ctx);
    respostas.push('yes');
    await rodarComando('terraform apply', ctx);
    expect(tudo()).toContain('Error: Reference to undeclared input variable');
    expect(tudo()).not.toContain('Enter a value');
    expect(respostas).toEqual(['yes']);
  });

  it('output, show, state list/show e workspace', async () => {
    await rodarComando('terraform init', ctx);
    await rodarComando('terraform output', ctx);
    expect(tudo()).toContain('Warning: No outputs found');
    await rodarComando('terraform apply -auto-approve', ctx);
    saida.length = 0;
    await rodarComando('terraform output', ctx);
    expect(tudo()).toContain('valor = "oi"');
    await rodarComando('terraform output -raw valor', ctx);
    expect(saida.at(-1)).toBe('oi');
    await rodarComando('terraform output -json', ctx);
    expect(tudo()).toContain('"value": "oi"');
    await rodarComando('terraform state list', ctx);
    expect(saida.at(-1)).toBe('terraform_data.a');
    await rodarComando('terraform state show terraform_data.a', ctx);
    expect(tudo()).toContain('# terraform_data.a:');
    expect(tudo()).toContain('resource "terraform_data" "a" {');
    await rodarComando('terraform state show terraform_data.b', ctx);
    expect(tudo()).toContain('No instance found for the given address!');
    await rodarComando('terraform show', ctx);
    expect(tudo()).toContain('Outputs:');
    await rodarComando('terraform workspace new dev', ctx);
    expect(tudo()).toContain('Created and switched to workspace "dev"!');
    await rodarComando('terraform workspace list', ctx);
    expect(tudo()).toContain('* dev');
    expect(tudo()).toContain('  default');
    await rodarComando('terraform workspace show', ctx);
    expect(saida.at(-1)).toBe('dev');
    await rodarComando('terraform show', ctx);
    expect(tudo()).toContain('The state file is empty. No resources are represented.');
    await rodarComando('terraform workspace select nada', ctx);
    expect(tudo()).toContain('Workspace "nada" doesn\'t exist.');
    await rodarComando('terraform workspace select default', ctx);
    expect(tudo()).toContain('Switched to workspace "default".');
    await rodarComando('terraform workspace delete dev', ctx);
    expect(tudo()).toContain('Deleted workspace "dev"!');
  });

  it('variável obrigatória sem valor: o Terraform pergunta (var.x / Enter a value:)', async () => {
    ctx = novoCtx({ 'main.tf': 'variable "nome" {\n  type = string\n}\n\nvariable "portas" {\n  type = list(number)\n}\n\noutput "ola" {\n  value = "${var.nome}:${length(var.portas)}"\n}\n' });
    await rodarComando('terraform init', ctx);
    respostas.push('Ana', '[80, 443]');
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('var.nome');
    expect(tudo()).toContain('var.portas');
    expect(tudo()).toContain('+ ola = "Ana:2"');
    saida.length = 0;
    respostas.push(null); // Ctrl+C na pergunta: o erro do Terraform aparece
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('Error: No value for required variable');
  });

  it('Tab: subcomandos, endereços do estado e workspaces', async () => {
    const { completarComando } = await import('../src/tf/comandos.js');
    await rodarComando('terraform init', ctx);
    await rodarComando('terraform apply -auto-approve', ctx);
    expect(completarComando('terraform ap', ctx)).toEqual(['terraform apply']);
    expect(completarComando('terraform state show terr', ctx)).toEqual(['terraform state show terraform_data.a']);
    expect(completarComando('terraform workspace sel', ctx)).toEqual(['terraform workspace select']);
    expect(completarComando('cat m', ctx)).toEqual(['cat main.tf']);
    expect(completarComando('te', ctx)).toEqual(['terraform']);
  });

  it('graph mostra o DOT e abre a aba do grafo', async () => {
    let abriu = false;
    ctx.abrirGrafo = () => { abriu = true; };
    await rodarComando('terraform graph', ctx);
    expect(tudo()).toContain('digraph G {');
    expect(tudo()).toContain('"output.valor" -> "terraform_data.a"');
    expect(abriu).toBe(true);
  });

  it('shell, version, help e comandos desconhecidos', async () => {
    await rodarComando('ls', ctx);
    expect(tudo()).toContain('main.tf');
    await rodarComando('cat main.tf', ctx);
    expect(tudo()).toContain('resource "terraform_data" "a"');
    await rodarComando('cat nada.tf', ctx);
    expect(tudo()).toContain('cat: nada.tf: No such file or directory');
    await rodarComando('terraform voar', ctx);
    expect(tudo()).toContain('Terraform has no command named "voar".');
    await rodarComando('xyz', ctx);
    expect(tudo()).toContain('bash: xyz: command not found');
    await rodarComando('terraform version', ctx);
    expect(tudo()).toMatch(/Terraform v\d+\.\d+\.\d+/);
    await rodarComando('terraform -help', ctx);
    expect(tudo()).toContain('Usage: terraform [global options] <subcommand> [args]');
    await rodarComando('help', ctx);
    expect(tudo()).toContain('terraform apply');
  });
});
