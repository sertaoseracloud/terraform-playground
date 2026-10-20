import { test, expect } from '@playwright/test';
import { abrir, PRIMEIRO } from './apoio.js';

test('o mural aparece uma vez por dia na landing e pode ser fechado sem reaparecer', async ({ page }) => {
  await abrir(page, '#/', { muralApoio: true });
  const mural = page.locator('#dialogo-apoio');

  await expect(mural).toBeVisible();
  const dimensoes = await mural.evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return { width, height };
  });
  const viewport = page.viewportSize();
  if (viewport.width > 760) {
    expect(dimensoes.width).toBeGreaterThanOrEqual(900);
    expect(dimensoes.height).toBeLessThan(650);
  } else {
    expect(dimensoes.width).toBeLessThanOrEqual(viewport.width);
  }
  await expect(mural).toContainText('gratuito');
  await expect(mural.locator('svg')).toHaveAttribute('aria-label', 'QR Code do PIX para Cláudio Filipe Lima Rapôso');
  await expect(mural.locator('#mural-codigo-pix')).toHaveValue(/br\.gov\.bcb\.pix/);
  await expect(mural.getByRole('link', { name: '⭐ Dê uma estrela no GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/sertaoseracloud/terraform-playground',
  );

  const popupPromise = page.waitForEvent('popup');
  await mural.getByRole('link', { name: '⭐ Dê uma estrela no GitHub' }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL('https://github.com/sertaoseracloud/terraform-playground');
  await expect(page).toHaveURL(/localhost/);
  await popup.close();

  await page.getByRole('button', { name: 'Continuar para o projeto' }).click();
  await expect(mural).toBeHidden();
  await page.evaluate(() => { location.hash = '#/trilha'; });
  await expect(page).toHaveURL(/#\/trilha$/);
  await expect(mural).toBeHidden();

  // No mesmo dia, recarregar não abre de novo; no dia seguinte, abre.
  await page.evaluate(() => { location.hash = '#/'; });
  await page.reload();
  await expect(page.locator('#tela-landing h1')).toBeVisible();
  await expect(mural).toBeHidden();
  await page.evaluate(() => localStorage.setItem('terraform-playground:pref:mural-apoio-visto-em', JSON.stringify('2000-01-01')));
  await page.reload();
  await expect(mural).toBeVisible();
});

test('o mural não abre por cima de um exercício aberto por link', async ({ page }) => {
  await abrir(page, `#/p/${PRIMEIRO.id}`, { muralApoio: true });
  await expect(page.locator('#item-titulo')).toBeVisible();
  await expect(page.locator('#dialogo-apoio')).toBeHidden();
});
