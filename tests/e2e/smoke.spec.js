// O caminho principal no navegador de verdade: landing → trilha, e um exercício que passa.
import { test, expect } from '@playwright/test';
import { abrir, PRIMEIRO } from './apoio.js';

test('a landing abre e leva à trilha', async ({ page }) => {
  await abrir(page, '#/');
  await page.getByRole('link', { name: /Começar a trilha/ }).first().click();
  await expect(page).toHaveURL(/#\/trilha$/);
});

test('um exercício roda a solução de referência e passa', async ({ page }) => {
  await abrir(page, `#/p/${PRIMEIRO.id}`, { extras: { [`rascunho:${PRIMEIRO.id}`]: PRIMEIRO.solucao } });
  await page.locator('#btn-executar').click();
  await expect(page.getByText('Casos visíveis passaram').first()).toBeVisible();
});