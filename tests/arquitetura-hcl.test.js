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
  });
});
