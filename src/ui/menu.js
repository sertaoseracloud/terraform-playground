// Menu ☰ do cabeçalho no celular: abre um painel com a navegação (Trilha, Playground livre).
// Fecha ao escolher uma opção, ao tocar fora, com Esc e ao mudar de página.
import { $ } from './util.js';

/**
 * Botões flutuantes: recolhem quando a pessoa rola a página para baixo (lendo) e
 * voltam quando rola para cima ou chega ao fim. Com foco num deles, nunca somem.
 */
export function iniciarFlutuantes() {
  const grupo = $('flutuantes');
  const ultimo = new WeakMap();
  document.addEventListener('scroll', (e) => {
    const alvo = e.target === document ? document.scrollingElement : e.target;
    if (!(alvo instanceof Element) || grupo.contains(document.activeElement)) return;
    const antes = ultimo.get(alvo) ?? 0;
    const agora = alvo.scrollTop;
    ultimo.set(alvo, agora);
    const noFim = agora + alvo.clientHeight >= alvo.scrollHeight - 4;
    if (Math.abs(agora - antes) < 6) return;
    grupo.classList.toggle('recolhidos', agora > antes && agora > 80 && !noFim);
  }, { capture: true, passive: true });
  window.addEventListener('hashchange', () => grupo.classList.remove('recolhidos'));
  grupo.addEventListener('focusin', () => grupo.classList.remove('recolhidos'));
}

export function iniciarMenu() {
  const botao = $('btn-menu');
  const painel = $('menu-topo');

  const abrir = (aberto) => {
    painel.classList.toggle('aberto', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    botao.querySelector('span').textContent = aberto ? '✕' : '☰';
    if (aberto) painel.querySelector('a, button')?.focus();
  };
  const estaAberto = () => painel.classList.contains('aberto');

  botao.addEventListener('click', () => abrir(!estaAberto()));
  painel.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) abrir(false);
  });
  document.addEventListener('click', (e) => {
    if (estaAberto() && !painel.contains(e.target) && !botao.contains(e.target)) abrir(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && estaAberto()) {
      abrir(false);
      botao.focus();
    }
  });
  window.addEventListener('hashchange', () => abrir(false));
  // Voltando para a largura de desktop, o painel não pode ficar "preso" aberto.
  window.matchMedia?.('(min-width: 761px)').addEventListener?.('change', (e) => e.matches && abrir(false));
}
