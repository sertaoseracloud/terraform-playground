// Apoio dos testes E2E: abrir uma tela com o navegador "limpo" e medir o que passa da borda.
import { problemas } from '../../src/conteudo/trilha.js';

export const PRIMEIRO = problemas[0];
export const TEMAS = ['dracula', 'claro', 'suave', 'alto-contraste'];
export const TELAS = ['#/', '#/trilha', `#/p/${PRIMEIRO.id}`];

/**
 * Abre `hash` com o localStorage zerado. Por padrão, tutorial e privacidade já foram vistos,
 * e o mural de apoio é fechado; `extras` grava outras chaves (sem o prefixo).
 */
export async function abrir(page, hash, { tutorial = false, extras = {}, muralApoio = false } = {}) {
  await page.goto('/');
  await page.evaluate(({ tutorial, extras }) => {
    localStorage.clear();
    const gravar = (chave, valor) => localStorage.setItem(`terraform-playground:${chave}`, JSON.stringify(valor));
    gravar('pref:privacidade-vista', true);
    if (!tutorial) gravar('pref:tutorial-visto', true);
    for (const [chave, valor] of Object.entries(extras)) gravar(chave, valor);
  }, { tutorial, extras });
  await page.goto(`/${hash}`);
  await page.reload();
  if (!muralApoio) {
    await page.getByRole('button', { name: 'Continuar para o projeto' }).click();
    await page.locator('#flutuantes').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animacao) => animacao.finished.catch(() => {})));
    });
  }
}

/**
 * Elementos visíveis que passam da borda da janela (getBoundingClientRect, que pega o estouro
 * escondido por um overflow: hidden). Ignora o que mora dentro de um contêiner com rolagem
 * horizontal própria, o .cenario-palco, os textos só para leitor de tela (.sr, .sr-only) e os botões
 * flutuantes recolhidos (saem pela direita de propósito ao rolar; são fixed e não criam rolagem).
 */
export function medirEstouro(page) {
  return page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    const rolaSozinho = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (p.matches('.cenario-palco, .sr, .sr-only, .flutuantes.recolhidos')) return true;
        if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    const fora = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.matches('.cenario-palco, .sr, .sr-only, .flutuantes.recolhidos, script, style')) continue;
      if (el.closest('details:not([open])')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= largura + 1 && r.left >= -1) continue;
      if (getComputedStyle(el).visibility === 'hidden' || rolaSozinho(el)) continue;
      fora.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''} (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    return fora;
  });
}
