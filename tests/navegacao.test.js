// @vitest-environment happy-dom
// Navegação com endereços reais: o clique troca só a tela (sem recarregar), como antes no #/.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { iniciarNavegacao, irPara } from '../src/navegacao.js';
import { EVENTO_ROTA, lerRota } from '../src/compartilhar.js';

let trocas = 0;
beforeAll(() => {
  history.replaceState(null, '', '/#/p/tf-ola-arquivo'); // um link antigo, aberto direto
  iniciarNavegacao();
  window.addEventListener(EVENTO_ROTA, () => { trocas += 1; });
});
beforeEach(() => {
  trocas = 0;
  document.body.innerHTML = `
    <main><h1 id="titulo">Tela</h1>
      <a id="trilha" href="/trilha/">Trilha</a>
      <a id="antigo" href="#/livre">Livre (link antigo)</a>
      <a id="ancora" href="#titulo">Título</a>
      <a id="badge" href="/badge/fundamentos/">Badge</a>
      <a id="fora" href="https://github.com/sertaoseracloud">GitHub</a>
      <a id="aba" href="/privacidade/" target="_blank">Privacidade</a>
    </main>`;
});

const clicar = (id, opcoes = {}) => {
  const evento = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...opcoes });
  document.getElementById(id).dispatchEvent(evento);
  return evento;
};

describe('navegação', () => {
  it('um link antigo aberto direto vira o endereço novo, sem criar histórico', () => {
    expect(location.pathname).toBe('/p/tf-ola-arquivo/');
    expect(location.hash).toBe('');
  });

  it('clique num link do site troca a tela sem recarregar', () => {
    const evento = clicar('trilha');
    expect(evento.defaultPrevented).toBe(true);
    expect(location.pathname).toBe('/trilha/');
    expect(lerRota(location).tela).toBe('inicio');
    expect(trocas).toBe(1);
  });

  it('link antigo escrito no conteúdo (href="#/livre") vale como o novo', () => {
    clicar('antigo');
    expect(location.pathname).toBe('/livre/');
    expect(trocas).toBe(1);
  });

  it('âncora da própria página, arquivo do site, site externo, nova aba e Ctrl+clique ficam com o navegador', () => {
    for (const [id, opcoes] of [['ancora'], ['badge'], ['fora'], ['aba'], ['trilha', { ctrlKey: true }]]) {
      expect(clicar(id, opcoes).defaultPrevented, id).toBe(false);
    }
    expect(trocas).toBe(0);
  });

  it('irPara para o mesmo endereço não avisa de novo', () => {
    irPara('/novidades/');
    irPara('/novidades/');
    expect(trocas).toBe(1);
  });

  it('voltar (popstate) avisa a troca de tela', () => {
    irPara('/termos/');
    trocas = 0;
    history.replaceState(null, '', '/licenca/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(trocas).toBe(1);
  });
});
