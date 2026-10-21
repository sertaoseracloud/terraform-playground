// Certificado e badge de um módulo concluído: nada passa da borda nem fica cortado (375 px e
// desktop), e o axe não acusa nada nos 4 temas.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { modulos } from '../../src/conteudo/trilha.js';
import { abrir, medirEstouro, TEMAS } from './apoio.js';

const [primeiro] = modulos;
const ids = primeiro.itens.map((i) => i.id);
// Nome comprido de propósito: o cartão precisa quebrar a linha em vez de cortar.
const NOME = 'Maria da Conceição Albuquerque de Vasconcelos Cavalcanti';
const concluido = {
  progresso: Object.fromEntries(ids.map((id) => [id, 'resolvido'])),
  datas: Object.fromEntries(ids.map((id) => [id, '2026-10-20'])),
  nome: NOME,
};

/** Textos que ficam escondidos por overflow (cortados na borda do próprio cartão). */
const medirCortes = (page) => page.evaluate(() => [...document.querySelectorAll('main *')]
  .filter((el) => el.offsetParent && el.childElementCount === 0 && el.textContent.trim())
  .filter((el) => {
    const estilo = getComputedStyle(el);
    const esconde = ['hidden', 'clip'].includes(estilo.overflowX) || estilo.textOverflow === 'ellipsis';
    return esconde && el.scrollWidth > el.clientWidth + 1;
  })
  .map((el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.textContent.trim().slice(0, 40)}`));

async function abrirCertificado(page) {
  await abrir(page, 'trilha/', { extras: concluido });
  await page.locator(`.trofeu [data-certificado="${primeiro.id}"]`).click();
  await expect(page.locator('#tela-certificado')).toBeVisible();
  await expect(page.locator('#tela-certificado')).toContainText(NOME);
}

for (const [nome, viewport] of [['375 px', { width: 375, height: 812 }], ['desktop', { width: 1280, height: 800 }]]) {
  test.describe(nome, () => {
    test.use({ viewport });

    test('o certificado e o badge cabem na tela, sem texto cortado', async ({ page }) => {
      await abrirCertificado(page);
      expect(await medirEstouro(page)).toEqual([]);
      expect(await medirCortes(page)).toEqual([]);
    });
  });
}

for (const tema of TEMAS) {
  test(`axe no certificado no tema ${tema}`, async ({ page }) => {
    await abrirCertificado(page);
    await page.evaluate((t) => { document.documentElement.dataset.tema = t; }, tema);
    await page.waitForTimeout(300); // as transições de cor terminam
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}
