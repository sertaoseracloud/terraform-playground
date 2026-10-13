// Grafo de dependências (como o "terraform graph", só que desenhado):
// cada coluna é um nível; quem é usado fica à esquerda e quem depende, à direita.
// A seta vai de quem usa para quem é usado (aws_subnet → aws_vpc).
import { esc } from './util.js';

const COR = { variavel: 'roxo', local: 'ciano', recurso: 'verde', dado: 'laranja', saida: 'amarelo', modulo: 'rosa' };
const ROTULO_TIPO = { variavel: 'variável', local: 'local', recurso: 'recurso', dado: 'data source', saida: 'output', modulo: 'módulo' };

/** Calcula colunas (níveis) e posições. Função pura, testada em tests/grafo.test.js. */
export function layoutGrafo({ nos, arestas }) {
  const deps = new Map(nos.map((n) => [n.id, []]));
  for (const a of arestas) deps.get(a.de)?.push(a.para);
  const nivel = new Map();
  const visitando = new Set();
  const calcular = (id) => {
    if (nivel.has(id)) return nivel.get(id);
    if (visitando.has(id)) return 0; // ciclo: o motor já acusa o erro
    visitando.add(id);
    const n = Math.max(-1, ...deps.get(id).map(calcular)) + 1;
    visitando.delete(id);
    nivel.set(id, n);
    return n;
  };
  nos.forEach((n) => calcular(n.id));
  const colunas = [];
  for (const n of nos) (colunas[nivel.get(n.id)] ??= []).push(n);
  const ordem = { variavel: 0, local: 1, dado: 2, recurso: 3, modulo: 4, saida: 5 };
  colunas.forEach((c) => c.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || a.id.localeCompare(b.id)));
  const LARGURA = 210;
  const ALTURA = 46;
  const GAP_X = 60;
  const GAP_Y = 14;
  const pos = new Map();
  colunas.forEach((coluna, i) => coluna.forEach((n, j) => pos.set(n.id, { x: 10 + i * (LARGURA + GAP_X), y: 10 + j * (ALTURA + GAP_Y) })));
  const largura = 20 + colunas.length * (LARGURA + GAP_X) - GAP_X;
  const altura = 20 + Math.max(1, ...colunas.map((c) => c.length)) * (ALTURA + GAP_Y) - GAP_Y;
  return { pos, largura, altura, LARGURA, ALTURA, niveis: colunas.length };
}

export function desenharGrafo(el, r) {
  const { nos = [], arestas = [] } = r.grafo ?? {};
  if (!nos.length) {
    el.innerHTML = '<p class="vazio">Ainda não há blocos para desenhar. Escreva um resource, variable ou output.</p>';
    return;
  }
  const { pos, largura, altura, LARGURA, ALTURA } = layoutGrafo({ nos, arestas });
  const acoes = new Map((r.plano?.acoes ?? []).map((a) => [a.endereco.replace(/\[.*$/, ''), a.acao]));
  const linhas = arestas.map((a) => {
    const de = pos.get(a.de);
    const para = pos.get(a.para);
    if (!de || !para) return '';
    const x1 = de.x;
    const y1 = de.y + ALTURA / 2;
    const x2 = para.x + LARGURA;
    const y2 = para.y + ALTURA / 2;
    const meio = (x1 + x2) / 2;
    return `<path d="M${x1},${y1} C${meio},${y1} ${meio},${y2} ${x2},${y2}" class="aresta" marker-end="url(#seta)"/>`;
  }).join('');
  const caixas = nos.map((n) => {
    const p = pos.get(n.id);
    const acao = acoes.get(n.id);
    const titulo = n.rotulo.length > 30 ? `${n.rotulo.slice(0, 29)}…` : n.rotulo;
    return `<g class="no-grafo cor-${COR[n.tipo]}${acao ? ` acao-${acao}` : ''}" transform="translate(${p.x},${p.y})">
      <title>${esc(n.rotulo)} (${ROTULO_TIPO[n.tipo]})${acao ? ` · ${acao}` : ''}</title>
      <rect width="${LARGURA}" height="${ALTURA}" rx="8"/>
      <text x="10" y="18" class="tipo-no">${ROTULO_TIPO[n.tipo]}${acao && acao !== 'nada' ? ` · ${acao}` : ''}</text>
      <text x="10" y="35" class="nome-no">${esc(titulo)}</text>
    </g>`;
  }).join('');
  el.innerHTML = `
    <p class="legenda-grafo">A seta vai de quem <b>usa</b> um valor para quem <b>fornece</b> o valor. O Terraform cria primeiro o que está à esquerda.</p>
    <div class="area-grafo">
      <svg viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="Grafo de dependências com ${nos.length} blocos. A mesma informação está na lista em texto logo abaixo.">
        <defs><marker id="seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>
        ${linhas}${caixas}
      </svg>
    </div>
    <details class="lista-grafo" ${document.documentElement.classList.contains('a11y-leitor-tela') ? 'open' : ''}><summary>Lista de dependências (texto)</summary>
      <ul>${arestas.map((a) => `<li><code>${esc(a.de)}</code> usa <code>${esc(a.para)}</code></li>`).join('') || '<li>Nenhum bloco depende de outro.</li>'}</ul>
    </details>`;
}
