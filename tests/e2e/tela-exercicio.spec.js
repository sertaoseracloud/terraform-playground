// Tela do exercício na primeira visita: o tutorial não abre sozinho por cima do código, e o aviso
// de privacidade fica na coluna da descrição, sem cobrir o editor nem o terminal.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { abrir, medirEstouro, PRIMEIRO, TEMAS } from './apoio.js';

const EXERCICIO = `p/${PRIMEIRO.id}/`;
const primeiraVisita = { tutorial: true, privacidade: false };

const seCruzam = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('o tutorial não abre sozinho e o aviso não cobre o editor nem o terminal', async ({ page }) => {
    await abrir(page, EXERCICIO, primeiraVisita);
    const aviso = page.locator('#aviso-privacidade');
    await expect(aviso).toBeVisible();
    await expect(page.locator('#tutorial')).toBeHidden();
    const caixaAviso = await aviso.boundingBox();
    for (const seletor of ['.painel-codigo', '.painel-preview']) {
      const alvo = page.locator(seletor).first();
      if (!(await alvo.isVisible())) continue;
      expect(seCruzam(caixaAviso, await alvo.boundingBox()), seletor).toBe(false);
    }
  });

  for (const tema of TEMAS) {
    test(`axe com o aviso aberto no tema ${tema}`, async ({ page }) => {
      await abrir(page, EXERCICIO, primeiraVisita);
      await page.evaluate((t) => { document.documentElement.dataset.tema = t; }, tema);
      await page.waitForTimeout(300); // as transições de cor terminam
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});

test.describe('375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('com o aviso aberto, nada passa da borda', async ({ page }) => {
    await abrir(page, EXERCICIO, primeiraVisita);
    await expect(page.locator('#aviso-privacidade')).toBeVisible();
    await expect(page.locator('#tutorial')).toBeHidden();
    expect(await medirEstouro(page)).toEqual([]);
  });
});
