// Larguras de celular (iPhone SE, Android pequeno, iPhone 15, Pixel): nada passa da borda.
import { test, expect } from '@playwright/test';
import { abrir, medirEstouro, TELAS } from './apoio.js';

for (const largura of [320, 360, 393, 412]) {
  test.describe(`${largura} px`, () => {
    test.use({ viewport: { width: largura, height: 800 } });

    for (const tela of TELAS) {
      test(`${tela}: nada passa da borda`, async ({ page }) => {
        await abrir(page, tela);
        expect(await medirEstouro(page)).toEqual([]);
      });
    }

    // Celular girado (deitado → em pé): o cenário foi desenhado largo e a trilha tem de encolher.
    test('trilha depois de girar o celular: nada passa da borda', async ({ page }) => {
      await page.setViewportSize({ width: 700, height: 800 });
      await abrir(page, 'trilha/');
      await page.setViewportSize({ width: largura, height: 800 });
      await page.waitForTimeout(300); // o cenário refaz o mapa na nova largura
      expect(await medirEstouro(page)).toEqual([]);
    });

    test('trilha com o tutorial aberto: nada passa da borda', async ({ page }) => {
      await abrir(page, 'trilha/', { tutorial: true });
      await expect(page.locator('#tutorial')).toBeVisible();
      expect(await medirEstouro(page)).toEqual([]);
    });
  });
}