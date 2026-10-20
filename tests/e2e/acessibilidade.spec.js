// axe-core WCAG 2.2 AA no navegador de verdade (cores e layout reais), nas telas principais × 4 temas.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { abrir, TELAS, TEMAS } from './apoio.js';

for (const tela of TELAS) {
  for (const tema of TEMAS) {
    test(`axe: ${tela} no tema ${tema}`, async ({ page }) => {
      test.slow(tela === '#/trilha'); // 200 nós e o cenário: o axe demora no Firefox e no WebKit
      await abrir(page, tela);
      await page.evaluate((t) => { document.documentElement.dataset.tema = t; }, tema);
      await page.waitForTimeout(300); // as transições de cor terminam
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}