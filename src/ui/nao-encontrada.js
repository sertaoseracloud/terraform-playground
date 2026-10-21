import { rota } from '../compartilhar.js';
// Página não encontrada: um endereço que não existe, um exercício que mudou de nome ou um link
// compartilhado que chegou cortado. Diz o que houve e para onde ir, em linguagem simples.

const MOTIVOS = {
  item: 'Este exercício ou lição não existe mais, ou o endereço foi digitado errado.',
  link: 'O link do código compartilhado chegou incompleto. Peça para a pessoa copiar o link de novo, inteiro.',
};

export function renderNaoEncontrada(el, { motivo } = {}) {
  el.innerHTML = `
    <article class="pagina-texto nao-encontrada">
      <h1>🧭 Página não encontrada</h1>
      <p>${MOTIVOS[motivo] ?? 'Este endereço não existe. Talvez o link esteja incompleto ou tenha sido digitado errado.'}</p>
      <p>Seu progresso continua salvo neste navegador.</p>
      <p class="acoes-404">
        <a class="btn btn-roxo" href="${rota('trilha')}">🗺️ Ir para a trilha</a>
        <a class="btn" href="${rota()}">🏠 Página inicial</a>
      </p>
    </article>`;
}
