// A vila dos cenários no navegador de verdade: "Conhecer a vila" e "Pausar animação do cenário" por
// teclado, axe WCAG 2.2 AA nos 4 temas com a lista aberta, alvos de toque e nada passando da borda.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { abrir, medirEstouro, TEMAS } from './apoio.js';

test('Conhecer a vila e Pausar animação, só com o teclado', async ({ page }) => {
  await abrir(page, '#/trilha');
  const vila = page.getByRole('button', { name: 'Conhecer a vila' }).first();
  await vila.focus();
  await page.keyboard.press('Enter');
  await expect(vila).toHaveAttribute('aria-expanded', 'true');
  const lista = page.locator(`#${await vila.getAttribute('aria-controls')}`);
  await expect(lista).toBeVisible();
  await expect(lista.locator('li').first()).toContainText(' — ');
  // Foco visível no botão (contorno do tema).
  expect(await vila.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Space');
  await expect(lista).toBeHidden();

  const pausa = page.getByRole('button', { name: 'Pausar animação do cenário' });
  await pausa.focus();
  await page.keyboard.press('Space');
  await expect(pausa).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/cenario-pausado/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pausar animação do cenário' })).toHaveAttribute('aria-pressed', 'true');
});

test('o cenário é decorativo: o desenho fica escondido do leitor de tela e não recebe foco', async ({ page }) => {
  await abrir(page, '#/trilha');
  await expect(page.locator('#tela-inicio')).toHaveAttribute('data-cenario-desenho', /webgl|2d/);
  for (const sel of ['.cenario', '.cenario-pixi']) {
    for (const el of await page.locator(sel).all()) await expect(el).toHaveAttribute('aria-hidden', 'true');
  }
  expect(await page.locator('.cenario [tabindex], .cenario a, .cenario button').count()).toBe(0);
});

test('alvos de toque da vila com pelo menos 24×24 px', async ({ page }) => {
  await abrir(page, '#/trilha');
  for (const botao of [page.getByRole('button', { name: 'Conhecer a vila' }).first(), page.getByRole('button', { name: 'Pausar animação do cenário' })]) {
    const caixa = await botao.boundingBox();
    expect(caixa.width).toBeGreaterThanOrEqual(24);
    expect(caixa.height).toBeGreaterThanOrEqual(24);
  }
});

for (const tema of TEMAS) {
  test(`axe: a vila aberta no tema ${tema}`, async ({ page }) => {
    test.slow(); // 200 nós e o cenário
    await abrir(page, '#/trilha');
    await page.getByRole('button', { name: 'Conhecer a vila' }).first().click();
    await page.getByRole('button', { name: 'Pausar animação do cenário' }).click();
    await page.evaluate((t) => { document.documentElement.dataset.tema = t; }, tema);
    await page.waitForTimeout(300);
    const { violations } = await new AxeBuilder({ page })
      .include('.caminho')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

for (const largura of [320, 375, 412]) {
  test(`${largura} px: a vila aberta e a pausa não passam da borda`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 800 });
    await abrir(page, '#/trilha');
    await page.getByRole('button', { name: 'Conhecer a vila' }).first().click();
    await page.waitForTimeout(300);
    expect(await medirEstouro(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
