// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { executarTerraform } from '../src/tf/motor.js';
import { renderArquiteturaRecursos } from '../src/ui/arquitetura-recursos.js';

describe('arquitetura a partir do HCL', () => {
  it.each([
    ['AWS', `provider "aws" { region = "us-east-1" }
resource "aws_vpc" "rede" { cidr_block = "10.0.0.0/16" }
resource "aws_subnet" "app" {
  vpc_id = aws_vpc.rede.id
  cidr_block = "10.0.1.0/24"
}`, 'aws-vpc.svg', 'aws_subnet.app usa aws_vpc.rede'],
    ['Azure', `provider "azurerm" {
  features {}
}
resource "azurerm_resource_group" "aula" {
  name = "aula"
  location = "eastus"
}
resource "azurerm_virtual_network" "rede" {
  name = "rede"
  resource_group_name = azurerm_resource_group.aula.name
  location = "eastus"
  address_space = ["10.0.0.0/16"]
}`, 'azure-vnet.svg', 'azurerm_virtual_network.rede usa azurerm_resource_group.aula'],
  ])('desenha %s e preserva relações do motor', (_provedor, codigo, icone, relacao) => {
    const r = executarTerraform({ 'main.tf': codigo }, { comando: 'plan', semente: 'arquitetura' });
    expect(r.ok, JSON.stringify(r.diagnosticos)).toBe(true);
    const el = document.createElement('div');
    el.innerHTML = renderArquiteturaRecursos(r.grafo);
    expect(el.querySelector(`image[href$="${icone}"]`)).not.toBeNull();
    expect(el.querySelector('.arq-lista').textContent).toContain(relacao);
    expect(r.grafo.contencoes).toHaveLength(1);
    expect(el.querySelectorAll('.arq-contencao')).toHaveLength(1);
    expect(el.querySelector('svg').textContent).toContain('Rede (CIDR): 10.0.0.0/16');
    expect(el.querySelector('svg').textContent).toContain('Máscara: 255.255.0.0');
  });

  it('não interpreta depends_on como pertencimento a uma rede', () => {
    const r = executarTerraform({ 'main.tf': `provider "aws" { region = "us-east-1" }
resource "aws_vpc" "rede" { cidr_block = "10.0.0.0/16" }
resource "aws_s3_bucket" "dados" {
  bucket = "arquitetura-sem-contencao"
  depends_on = [aws_vpc.rede]
}` }, { comando: 'plan' });
    expect(r.grafo.arestas).toContainEqual({ de: 'aws_s3_bucket.dados', para: 'aws_vpc.rede' });
    expect(r.grafo.contencoes).toEqual([]);
  });

  it('mostra portas e redes das regras sem ler segredos nem resolver expressões', () => {
    const r = executarTerraform({ 'main.tf': `variable "rede" { type = string }
resource "aws_security_group" "web" {
  name = "web"
  ingress {
    from_port = 80
    to_port = 8080
    protocol = "tcp"
    cidr_blocks = ["10.0.1.0/24", var.rede]
  }
  tags = { segredo = "NAO_EXIBIR" }
}` }, { comando: 'graph' });
    const detalhes = r.grafo.nos.find((n) => n.id === 'aws_security_group.web').detalhes;
    expect(detalhes).toContainEqual({ rotulo: 'Entrada · Porta inicial', valor: '80' });
    expect(detalhes).toContainEqual({ rotulo: 'Entrada · Porta final', valor: '8080' });
    expect(detalhes).toContainEqual({ rotulo: 'Entrada · Protocolo', valor: 'tcp' });
    expect(detalhes).toContainEqual({ rotulo: 'Entrada · Máscara', valor: '255.255.255.0' });
    expect(detalhes).toContainEqual({ rotulo: 'Entrada · Rede (CIDR)', valor: 'expressão não resolvida' });
    expect(JSON.stringify(detalhes)).not.toContain('NAO_EXIBIR');
  });

  it('reconhece VPC → subnet → instância sem aplicar recursos', () => {
    const r = executarTerraform({ 'main.tf': `provider "aws" { region = "us-east-1" }
resource "aws_vpc" "rede" { cidr_block = "10.0.0.0/16" }
resource "aws_subnet" "app" {
  vpc_id = aws_vpc.rede.id
  cidr_block = "10.0.1.0/24"
}
resource "aws_instance" "web" {
  ami = "ami-12345678"
  instance_type = "t3.micro"
  subnet_id = aws_subnet.app.id
}` }, { comando: 'plan' });
    expect(r.ok, JSON.stringify(r.diagnosticos)).toBe(true);
    expect(r.grafo.contencoes).toEqual([
      { filho: 'aws_subnet.app', pai: 'aws_vpc.rede', motivo: 'vpc_id' },
      { filho: 'aws_instance.web', pai: 'aws_subnet.app', motivo: 'subnet_id' },
    ]);
  });
});
