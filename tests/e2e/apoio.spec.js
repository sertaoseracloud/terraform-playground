import { test, expect } from '@playwright/test';
import { abrir } from './apoio.js';

test('o mural aparece em cada abertura completa e pode ser fechado sem reaparecer na navegação', async ({ page }) => {
  await abrir(page, '#/', { muralApoio: true });
  const mural = page.locator('#dialogo-apoio');

  await expect(mural).toBeVisible();
  await expect(mural).toContainText('gratuito');
  await expect(mural.locator('svg')).toHaveAttribute('aria-label', 'QR Code PIX para apoio ao projeto');

  await page.getByRole('button', { name: 'Continuar para o projeto' }).click();
  await expect(mural).toBeHidden();
  await page.evaluate(() => { location.hash = '#/trilha'; });
  await expect(page).toHaveURL(/#\/trilha$/);
  await expect(mural).toBeHidden();

  await page.reload();
  await expect(mural).toBeVisible();
});
