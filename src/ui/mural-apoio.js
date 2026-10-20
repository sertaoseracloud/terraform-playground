import { ativarCopiaPix, ativarLinkEstrela, caixaApoio } from './instrutor.js';
import { lerPreferencia, gravarPreferencia } from '../progresso.js';
import { $ } from './util.js';

/** Hoje, no fuso de quem usa (AAAA-MM-DD). */
const hoje = () => new Date().toLocaleDateString('sv');

/**
 * O mural abre sozinho no máximo uma vez por dia, e só na página inicial ou na trilha: nunca por
 * cima de um exercício, de um certificado ou do validador abertos por link. O apoio continua à
 * mão no rodapé e em #/apoie.
 */
export function deveAbrirMural({ hash = location.hash, vistoEm = lerPreferencia('mural-apoio-visto-em'), dia = hoje() } = {}) {
  return vistoEm !== dia && /^(#\/?|#\/trilha)?$/.test(hash);
}

export function iniciarMuralApoio() {
  const conteudo = $('mural-apoio-conteudo');
  conteudo.innerHTML = caixaApoio({ prefix: 'mural-' });
  ativarCopiaPix(conteudo, { prefix: 'mural-' });
  ativarLinkEstrela(conteudo);

  const dialogo = $('dialogo-apoio');
  $('btn-fechar-mural-apoio').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('close', () => {
    gravarPreferencia('mural-apoio-visto-em', hoje());
    // O mural abre com a página: ao fechar, não há botão para onde o foco voltar. Ele vai para o
    // título da tela, e o Tab segue dali (e não do começo do documento).
    setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const titulo = document.querySelector('#conteudo > main:not([hidden]) h1');
      if (!titulo) return;
      if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
      titulo.focus({ preventScroll: true });
    });
  });
  if (deveAbrirMural()) dialogo.showModal();
}
