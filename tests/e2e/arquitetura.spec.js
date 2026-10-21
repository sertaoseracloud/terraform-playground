import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { abrir, medirEstouro, PRIMEIRO, TEMAS } from './apoio.js';

const AWS = `provider "aws" { region = "us-east-1" }
resource "aws_vpc" "rede" { cidr_block = "10.0.0.0/16" }
resource "aws_subnet" "app" {
  vpc_id = aws_vpc.rede.id
  cidr_block = "10.0.1.0/24"
}`;
const AZURE = `provider "azurerm" {
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
}`;
async function editar(page, codigo) {
  await page.locator('.cm-content').first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(codigo);
}

test('arquitetura acompanha AWS, Azure e erro sem Apply nem assets externos', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 2400 });
  await abrir(page, `p/${PRIMEIRO.id}/`);
  await editar(page, AWS);
  await page.locator('[data-saida="arquitetura"]').click();
  const painel = page.locator('#saida-arquitetura');
  await expect(painel.locator('image[href$="aws-vpc.svg"]')).toBeVisible();
  await expect(painel.locator('.arq-lista')).toContainText('aws_subnet.app usa aws_vpc.rede');
  await expect(painel.locator('.arq-plataforma-nome')).toHaveText('Amazon Web Services');
  await expect(painel.locator('.arq-area')).toHaveCount(1);
  await painel.screenshot({ path: testInfo.outputPath('arquitetura-aws.png') });
  await editar(page, AZURE);
  await expect(painel.locator('image[href$="azure-vnet.svg"]')).toBeVisible();
  await expect(painel.locator('image[href$="aws-vpc.svg"]')).toHaveCount(0);
  await expect(painel.locator('.arq-area')).toHaveCount(2);
  await painel.screenshot({ path: testInfo.outputPath('arquitetura-azure.png') });
  for (const imagem of await painel.locator('image').all()) {
    const url = new URL(await imagem.getAttribute('href'), page.url());
    expect(url.origin).toBe(new URL(page.url()).origin);
    const resposta = await page.request.get(url.href);
    expect(resposta.ok()).toBe(true);
    expect(await resposta.text()).toContain('<svg');
  }
  await editar(page, 'resource "aws_vpc" "rede" {');
  await expect(painel.locator('[role="status"]')).toContainText('Corrija o código');
  await expect(painel.locator('svg')).toHaveCount(0);
});

test('arquitetura é acessível nos temas e rola sem estourar no celular', async ({ page }) => {
  await abrir(page, `p/${PRIMEIRO.id}/`);
  await editar(page, AWS);
  await page.locator('[data-saida="arquitetura"]').click();
  await expect(page.locator('#saida-arquitetura svg')).toBeVisible();
  for (const tema of TEMAS) {
    await page.evaluate((valor) => { document.documentElement.dataset.tema = valor; }, tema);
    await page.waitForTimeout(300);
    const { violations } = await new AxeBuilder({ page }).include('#saida-arquitetura')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('.arq-rolagem').focus();
  await expect(page.locator('.arq-rolagem')).toBeFocused();
  expect(await medirEstouro(page)).toEqual([]);
});
