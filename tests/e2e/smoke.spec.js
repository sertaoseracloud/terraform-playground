// O caminho principal no navegador de verdade: landing → trilha, e um exercício que passa.
import { test, expect } from '@playwright/test';
import { abrir, PRIMEIRO } from './apoio.js';

test('a landing abre e leva à trilha', async ({ page }) => {
  await abrir(page, '');
  await page.getByRole('link', { name: /Começar a trilha/ }).first().click();
  await expect(page).toHaveURL(/\/trilha\/$/);
});

test('um exercício roda a solução de referência e passa', async ({ page }) => {
  await abrir(page, `p/${PRIMEIRO.id}/`, { extras: { [`rascunho:${PRIMEIRO.id}`]: PRIMEIRO.solucao } });
  await page.locator('#btn-executar').click();
  await expect(page.getByText('Casos visíveis passaram').first()).toBeVisible();
});

test('links antigos (#/...) abrem a mesma tela no endereço novo', async ({ page }) => {
  await abrir(page, `#/p/${PRIMEIRO.id}`);
  await expect(page).toHaveURL(new RegExp(`/p/${PRIMEIRO.id}/$`));
  await expect(page.locator('#item-titulo')).toHaveText(PRIMEIRO.titulo);
  await abrir(page, '#/trilha');
  await expect(page).toHaveURL(/\/trilha\/$/);
  await expect(page.locator('#tela-inicio')).toBeVisible();
});

test('voltar e avançar do navegador trocam a tela, sem recarregar a página', async ({ page }) => {
  await abrir(page, 'trilha/');
  await page.evaluate(() => { window.semRecarregar = true; });
  await page.evaluate(() => document.querySelector('a[data-menu="validar"]').click());
  await expect(page.locator('#tela-validador')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/trilha\/$/);
  await expect(page.locator('#tela-inicio')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#tela-validador')).toBeVisible();
  expect(await page.evaluate(() => window.semRecarregar)).toBe(true);
});

test('abrir uma lição direto pelo endereço mostra a lição (uma página por item)', async ({ page }) => {
  const resposta = await page.goto(`p/${PRIMEIRO.id}/`);
  expect(resposta.status()).toBe(200);
  await expect(page).toHaveTitle(new RegExp(`^${PRIMEIRO.titulo}`));
});
