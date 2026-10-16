import { ativarCopiaPix, ativarLinkEstrela, caixaApoio } from './instrutor.js';
import { $ } from './util.js';

export function iniciarMuralApoio() {
  const conteudo = $('mural-apoio-conteudo');
  conteudo.innerHTML = caixaApoio({ prefix: 'mural-' });
  ativarCopiaPix(conteudo, { prefix: 'mural-' });
  ativarLinkEstrela(conteudo);

  $('btn-fechar-mural-apoio').addEventListener('click', () => $('dialogo-apoio').close());
  $('dialogo-apoio').showModal();
}
