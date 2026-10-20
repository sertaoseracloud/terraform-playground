// Usabilidade e acessibilidade (docs/usabilidade-acessibilidade.md) no navegador de verdade:
// axe em todas as telas e nos estados do exercício, e o caminho de quem usa só o teclado.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { abrir, medirEstouro, PRIMEIRO, TEMAS } from './apoio.js';
import { itens } from '../../src/conteudo/trilha.js';

const LICAO = itens.find((i) => i.tipo === 'licao');
// Um código que não roda, para ver a tela de erro.
const CODIGO_COM_ERRO = 'resource "local_file" "x" {';
const TELAS_EXTRAS = [
  `#/p/${LICAO.id}`, '#/livre', '#/validar', '#/validar/codigo-invalido', '#/certificado/codigo-invalido',
  '#/novidades', '#/privacidade', '#/licenca', '#/termos', '#/acessibilidade', '#/instrutor', '#/apoie', '#/nao-existe',
];

async function axe(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

async function emCadaTema(page) {
  const erros = [];
  for (const tema of TEMAS) {
    await page.evaluate((t) => { document.documentElement.dataset.tema = t; }, tema);
    await page.waitForTimeout(250);
    erros.push(...(await axe(page)).map((e) => `[${tema}] ${e}`));
  }
  return erros;
}

/** O Tab seguinte começa do topo da página (e não do botão que fechou o mural). */
const doTopo = (page) => page.evaluate(() => {
  document.body.insertAdjacentHTML('afterbegin', '<span id="inicio-tab" tabindex="-1"></span>');
  document.getElementById('inicio-tab').focus();
});

test.describe('axe nas outras telas e nos estados do exercício', () => {
  test.beforeEach(({ browserName }) => test.skip(browserName !== 'chromium', 'as cores e o layout já são cobertos nos outros navegadores pelas telas principais'));

  for (const tela of TELAS_EXTRAS) {
    test(`axe: ${tela} nos 4 temas`, async ({ page }) => {
      await abrir(page, tela);
      expect(await emCadaTema(page)).toEqual([]);
    });
  }

  for (const largura of [1280, 375]) test(`axe: exercício com erro e com sucesso, nos 4 temas (${largura} px)`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: largura, height: 800 });
    await abrir(page, `#/p/${PRIMEIRO.id}`, { extras: { [`rascunho:${PRIMEIRO.id}`]: CODIGO_COM_ERRO } });
    await page.locator('#btn-executar').click();
    await expect(page.locator('#resumo-testes')).not.toBeEmpty();
    expect(await emCadaTema(page)).toEqual([]);

    await abrir(page, `#/p/${PRIMEIRO.id}`, { extras: { [`rascunho:${PRIMEIRO.id}`]: PRIMEIRO.solucao } });
    await page.locator('#btn-enviar').click();
    await expect(page.locator('#status')).toHaveText(/Aceito/);
    expect(await emCadaTema(page)).toEqual([]);
  });

  test('nada passa da borda a 640 px (zoom de 200%) nem com o espaçamento de texto aumentado', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    for (const tela of ['#/', '#/trilha', `#/p/${PRIMEIRO.id}`, '#/validar']) {
      await abrir(page, tela);
      await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
      expect(await medirEstouro(page), tela).toEqual([]);
    }
  });
});

test.describe('teclado e foco', () => {
  test('o primeiro Tab é o "Pular para o conteúdo", e ele leva ao título da tela', async ({ page }) => {
    await abrir(page, `#/p/${PRIMEIRO.id}`);
    await doTopo(page);
    await page.keyboard.press('Tab');
    await expect(page.locator('.pular')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#item-titulo')).toBeFocused();
  });

  test('o Tab não fica preso no editor', async ({ page }) => {
    await abrir(page, `#/p/${PRIMEIRO.id}`);
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !document.activeElement.closest('.cm-editor'))).toBe(true);
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !document.activeElement.closest('.cm-editor'))).toBe(true);
  });

  test('Ctrl+Enter dentro do editor fala o resultado, como o botão', async ({ page }) => {
    await abrir(page, `#/p/${PRIMEIRO.id}`, { extras: { [`rascunho:${PRIMEIRO.id}`]: PRIMEIRO.solucao } });
    await expect(page.locator('#btn-executar')).toBeEnabled({ timeout: 60_000 }); // o motor carregou
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#anuncio')).toHaveText(/passou|passaram/);
  });

  test('mudar de tela leva o foco ao título e muda o título da aba', async ({ page }) => {
    await abrir(page, '#/trilha');
    await page.evaluate(() => { location.hash = '#/validar'; });
    await expect(page.locator('#tela-validador h1')).toBeFocused();
    await expect(page).toHaveTitle(/^Validar certificado/);
  });

  test('um endereço que não existe mostra "Página não encontrada" com caminhos de volta', async ({ page }) => {
    await abrir(page, '#/nao-existe');
    await expect(page.getByRole('heading', { level: 1, name: /Página não encontrada/ })).toBeVisible();
    await expect(page).toHaveTitle(/^Página não encontrada/);
    await page.getByRole('link', { name: /Ir para a trilha/ }).click();
    await expect(page).toHaveURL(/#\/trilha$/);
  });

  test('o mural de apoio prende o foco e, ao fechar, leva o foco ao título da tela', async ({ page }) => {
    await abrir(page, '#/', { muralApoio: true });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('#dialogo-apoio'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#tela-landing h1')).toBeFocused();
  });

  for (const largura of [1280, 375]) {
    test(`⋯ Mais ações pelo teclado, e a barra cabe na tela (${largura} px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await abrir(page, `#/p/${PRIMEIRO.id}`);
      await page.locator('#btn-mais-acoes').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#menu-mais-acoes')).toBeVisible();
      expect(await medirEstouro(page)).toEqual([]);
      await expect(page.locator('#menu-mais-acoes button:not([hidden])').first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#menu-mais-acoes')).toBeHidden();
      await expect(page.locator('#btn-mais-acoes')).toBeFocused();
      expect(await new AxeBuilder({ page }).withTags(['wcag22aa']).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
    });

    test(`fechar o tutorial e o painel ♿ devolve o foco a um botão visível (${largura} px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await abrir(page, `#/p/${PRIMEIRO.id}`);
      for (const [botao, dialogo] of [['#btn-tutorial', '#tutorial'], ['#btn-acessibilidade', '#dialogo-a11y']]) {
        if (!(await page.locator(botao).isVisible())) await page.locator('#btn-flutuantes').click();
        await page.locator(botao).click();
        await expect(page.locator(dialogo)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator(dialogo)).toBeHidden();
        // O foco volta logo depois do fechamento (no celular, para o ⚙️).
        await expect.poll(() => page.evaluate(() => !!document.activeElement.offsetParent && document.activeElement !== document.body)).toBe(true);
      }
    });
  }
});
