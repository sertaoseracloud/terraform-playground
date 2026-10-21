// Navegação entre as telas sem recarregar a página, com endereços reais (/trilha/, /p/<id>/...).
// Cada rota também existe como página HTML (o Astro gera uma por rota): abrir um link direto,
// recarregar ou abrir em outra aba funciona. Dentro do site, o clique troca só a tela, como
// antes, e avisa com o evento EVENTO_ROTA (quem fechava menus no hashchange ouve este).
import { EVENTO_ROTA, ehRotaDoSite, traduzirHashAntigo } from './compartilhar.js';

const avisar = () => window.dispatchEvent(new Event(EVENTO_ROTA));

/** Vai para outra tela do site (ou troca a atual, com `substituir`, sem criar histórico). */
export function irPara(destino, { substituir = false } = {}) {
  const url = new URL(destino, location.href);
  if (url.href === location.href) return;
  history[substituir ? 'replaceState' : 'pushState'](null, '', url.href);
  avisar();
}

/** Âncora da própria página (#conteudo, por exemplo): não é rota, o navegador só rola até lá. */
function ehAncora(hash) {
  if (hash.length < 2 || hash.startsWith('#/')) return false;
  try {
    return Boolean(document.getElementById(decodeURIComponent(hash.slice(1))));
  } catch {
    return false;
  }
}

/** Link antigo (#/trilha, #/p/<id>...) no endereço: troca pelo novo, sem criar histórico. */
function corrigirLinkAntigo() {
  const novo = traduzirHashAntigo(location.hash);
  if (novo) history.replaceState(null, '', new URL(novo, location.href).href);
  return Boolean(novo);
}

function aoClicar(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest?.('a[href]');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  // Link antigo escrito no conteúdo (href="#/trilha"): vale como o novo.
  const antigo = url.pathname === location.pathname ? traduzirHashAntigo(url.hash) : null;
  const destino = antigo ? new URL(antigo, location.href) : url;
  if (!ehRotaDoSite(destino)) return;
  if (!antigo && destino.pathname === location.pathname && ehAncora(destino.hash)) return;
  e.preventDefault();
  irPara(destino.href);
}

let ultimo = '';
/** Voltar/avançar, ou um hash trocado à mão: a tela segue o endereço. */
function aoMudarEndereco() {
  corrigirLinkAntigo();
  if (location.href === ultimo || ehAncora(location.hash)) return;
  avisar();
}

/** Liga a navegação. Chame antes de ler a primeira rota: um link antigo já vira o endereço novo. */
export function iniciarNavegacao() {
  corrigirLinkAntigo();
  window.addEventListener(EVENTO_ROTA, () => { ultimo = location.href; });
  ultimo = location.href;
  document.addEventListener('click', aoClicar);
  window.addEventListener('popstate', aoMudarEndereco);
  window.addEventListener('hashchange', aoMudarEndereco);
}
