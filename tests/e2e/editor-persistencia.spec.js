import { test, expect } from '@playwright/test';
import { abrir, PRIMEIRO } from './apoio.js';

test('arquivo auxiliar usa rótulo próprio, desfazer preserva histórico e excluir devolve foco', async ({ page }) => {
  await abrir(page, `p/${PRIMEIRO.id}/`);
  const editor = page.locator('#editor .cm-content');
  const principal = await page.locator('#abas-arquivos .aba.ativa').textContent();
  const original = await editor.innerText();
  await editor.fill('edição para desfazer');
  page.once('dialog', (dialog) => dialog.accept('dados.json'));
  await page.getByRole('button', { name: 'Novo arquivo', exact: true }).click();
  await expect(editor).toHaveAttribute('aria-label', 'Editor de dados.json — texto simples');
  await editor.fill('{"nome":"Ana"}');
  await page.getByRole('button', { name: principal, exact: true }).click();
  await editor.press('ControlOrMeta+z');
  await expect.poll(() => editor.innerText()).toBe(original);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir dados.json', exact: true }).click();
  await expect(editor).toBeFocused();
  await expect(page.locator('#anuncio')).toContainText(`Arquivo dados.json excluído. Editor de ${principal} ativo.`);
});

test('quota indisponível mantém código e aviso junto ao editor', async ({ page }) => {
  await abrir(page, `p/${PRIMEIRO.id}/`);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
  });
  const editor = page.locator('#editor .cm-content');
  await editor.fill('código que não pode ser perdido');
  await expect(page.locator('#aviso-armazenamento')).toBeVisible();
  await expect(page.locator('#aviso-armazenamento')).toContainText('Copie seus arquivos');
  await expect(editor).toHaveText('código que não pode ser perdido');
  await expect(editor).toBeFocused();
});
