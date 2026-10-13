// Tradução para Libras com o VLibras (https://www.gov.br/governodigital/pt-br/vlibras),
// do Governo Federal: um avatar traduz para Libras o texto que a pessoa seleciona ou
// passa o mouse. Só carrega quando a opção é ligada no painel ♿ (ninguém recebe o
// script nem fala com o servidor do VLibras sem pedir) e some quando é desligada.

export const VLIBRAS = 'https://vlibras.gov.br/app';

let carregando = null;

function carregar() {
  carregando ??= new Promise((ok, erro) => {
    const script = document.createElement('script');
    script.src = `${VLIBRAS}/vlibras-plugin.js`;
    script.onload = () => {
      // O plugin monta o botão sozinho; o construtor só confirma o endereço do app.
      new window.VLibras.Widget(VLIBRAS);
      ok();
    };
    script.onerror = () => {
      carregando = null;
      erro(new Error('Não foi possível carregar o VLibras.'));
    };
    document.head.append(script);
  });
  return carregando;
}

/** Liga ou desliga o VLibras. Devolve uma promessa (falha se o serviço estiver fora). */
export async function ativarLibras(ligar) {
  const esconder = !ligar;
  for (const id of ['vlibras-access-wrapper', 'vlibras-app-root']) {
    const el = document.getElementById(id);
    if (el) el.hidden = esconder;
  }
  if (esconder) {
    const app = document.getElementById('vlibras-app-root');
    if (app) app.dataset.active = 'false';
    return;
  }
  await carregar();
}
