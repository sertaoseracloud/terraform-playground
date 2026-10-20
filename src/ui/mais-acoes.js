// "⋯ Mais ações" na barra do exercício: à vista ficam só o caminho principal (rodar e enviar);
// o resto abre neste menu, sempre com texto. Padrão "disclosure" (botão com aria-expanded):
// Tab passa pelos itens, Esc fecha e devolve o foco ao botão, escolher um item ou clicar fora fecha.
import { $ } from './util.js';

export function iniciarMaisAcoes() {
  const botao = $('btn-mais-acoes');
  const menu = $('menu-mais-acoes');
  if (!botao || !menu) return null;

  const abrir = (aberto) => {
    menu.hidden = !aberto;
    botao.setAttribute('aria-expanded', String(aberto));
  };
  const aberto = () => !menu.hidden;

  botao.addEventListener('click', () => {
    abrir(!aberto());
    if (aberto()) menu.querySelector('button:not([disabled]):not([hidden])')?.focus();
  });
  menu.addEventListener('click', (e) => {
    if (!e.target.closest('button')) return;
    abrir(false);
    // A ação pode abrir outra coisa (o Diff muda de aba); se o foco ficou no item escondido, volta ao botão.
    setTimeout(() => { if (!document.activeElement?.offsetParent) botao.focus(); });
  });
  document.addEventListener('click', (e) => {
    if (aberto() && !menu.contains(e.target) && !botao.contains(e.target)) abrir(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aberto()) {
      e.preventDefault();
      abrir(false);
      botao.focus();
    }
  });
  // Saiu do menu com o Tab: fecha, para não ficar uma caixa aberta sobre o editor.
  menu.parentElement.addEventListener('focusout', (e) => {
    if (aberto() && !menu.parentElement.contains(e.relatedTarget)) abrir(false);
  });
  window.addEventListener('hashchange', () => abrir(false));
  return { abrir };
}
