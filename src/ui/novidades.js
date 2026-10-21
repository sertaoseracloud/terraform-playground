// Página "Novidades" (#/novidades): versão atual, resumo de cada release e o
// histórico completo de alterações, agrupado por dia.
import { VERSAO, RELEASES, HISTORICO, REPOSITORIO } from '../novidades.js';
import { esc, dataPorExtenso } from './util.js';
import { rota } from '../compartilhar.js';


/** Histórico agrupado por dia, do mais recente para o mais antigo. */
export function historicoPorDia(lista = HISTORICO) {
  const dias = new Map();
  for (const c of lista) {
    if (!dias.has(c.data)) dias.set(c.data, []);
    dias.get(c.data).push(c);
  }
  return [...dias.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export function renderNovidades(el) {
  const dias = historicoPorDia();
  el.innerHTML = `
    <article class="pagina-texto novidades">
      <p class="voltar-trilha"><a href="${rota()}">← Página inicial</a></p>
      <h1>🆕 Novidades</h1>
      <p class="versao-atual">Versão atual: <b>${esc(VERSAO)}</b></p>

      ${RELEASES.map((r) => `
        <section class="release" aria-labelledby="release-${esc(r.versao)}">
          <h2 id="release-${esc(r.versao)}"><span class="etiqueta-versao">v${esc(r.versao)}</span> ${esc(r.titulo)}</h2>
          <p class="atualizada">${dataPorExtenso(r.data)}</p>
          <p>${esc(r.resumo)}</p>
          ${r.grupos.map((g) => `
            <h3>${esc(g.titulo)}</h3>
            <ul>${g.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}
        </section>`).join('')}

      ${dias.length ? `
        <section aria-labelledby="historico-titulo">
          <h2 id="historico-titulo">Histórico completo</h2>
          <p class="a11y-ajuda">Todas as ${HISTORICO.length} alterações publicadas, da mais recente para a mais antiga.</p>
          ${dias.map(([data, alteracoes]) => `
            <details class="dia-historico" ${data === dias[0][0] ? 'open' : ''}>
              <summary>${dataPorExtenso(data)} <small>${alteracoes.length} ${alteracoes.length === 1 ? 'alteração' : 'alterações'}</small></summary>
              <ul class="lista-historico">
                ${alteracoes.map((c) => `<li><a href="${REPOSITORIO}/commit/${esc(c.hash)}" target="_blank" rel="noopener noreferrer"><code>${esc(c.hash)}</code></a> ${esc(c.titulo)}</li>`).join('')}
              </ul>
            </details>`).join('')}
        </section>` : ''}
    </article>`;
}
