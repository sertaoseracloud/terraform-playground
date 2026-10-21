// Monta o HTML de cada página do site a partir do index.html (a casca da aplicação), no build
// do Astro (src/pages): a marcação é a mesma em todas as páginas, e o que muda é só
//   - o bloco <!-- seo:inicio --> … <!-- seo:fim --> do <head>: título, descrição e endereço
//     da página (src/seo.js e src/paginas.js), com noindex na homologação;
//   - a landing, escrita em HTML dentro de <main id="tela-landing"> só na página inicial;
//   - os links do menu (href="#/trilha" no index.html) e os arquivos do <head>, que ganham o
//     prefixo do site (/<repositório>/), porque as páginas ficam em pastas (/p/<id>/).
// O <script> do index.html sai: no Astro, quem carrega o src/main.js é a própria página.
import { metaTags, PRINCIPAL } from '../src/seo.js';
import { paginaDe } from '../src/paginas.js';
import { renderLanding } from '../src/ui/landing.js';
import { BASE, lerRota, rota, traduzirHashAntigo } from '../src/compartilhar.js';
import { SITE } from '../src/certificados.js';
import { configurarAmbiente } from '../src/ambiente.js';

const SEO = /<!-- seo:inicio -->[\s\S]*?<!-- seo:fim -->/;
const LANDING = /(<main id="tela-landing"[^>]*>)\s*(<\/main>)/;
const SCRIPT_PRINCIPAL = /\s*<script type="module" src="\/src\/main\.js"><\/script>/;

/**
 * href="#/trilha" → href="/<repositório>/trilha/"; arquivos relativos do <head> ganham o
 * prefixo; o "ir para o site principal" da faixa de homologação (href="../") vira o endereço dele.
 */
function corrigirLinks(html) {
  return html
    .replace(/href="(#\/[^"]*)"/g, (_, antigo) => `href="${traduzirHashAntigo(antigo)}"`)
    .replace(/href="\.\.\/"/g, `href="${configurarAmbiente(false).site}"`)
    .replace(/(<link [^>]*href=")(?![a-z]+:|\/|#)([^"]+)"/g, (_, inicio, arquivo) => `${inicio}${BASE}${arquivo}"`);
}

/**
 * HTML de uma página: { atributos do <html>, head, corpo }. `caminho` é o endereço sem o base
 * ('' na landing, 'trilha', 'p/<id>'...); a homologação ganha noindex.
 */
export function montarPagina(html, { caminho = '', homologacao = false } = {}) {
  if (!SEO.test(html)) throw new Error('index.html sem o bloco <!-- seo:inicio --> … <!-- seo:fim -->');
  if (!LANDING.test(html)) throw new Error('index.html sem <main id="tela-landing"></main> vazio');
  if (!SCRIPT_PRINCIPAL.test(html)) throw new Error('index.html sem o <script type="module" src="/src/main.js">');
  const url = `${SITE}${rota(caminho).slice(BASE.length)}`;
  // /s/ só abre com o código no hash, que o build não vê: até o JS abrir o exercício, vale o
  // título da página principal (como era com o #/s/<código>), e não "Página não encontrada".
  const pagina = caminho === 's' ? PRINCIPAL : paginaDe(lerRota({ pathname: rota(caminho) }));
  let meta = metaTags({ ...pagina, url });
  // Na homologação, o robots "index, follow" do site principal vira noindex.
  if (homologacao) meta = meta.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex">');

  let saida = html.replace(SEO, `<!-- seo:inicio (gerado por scripts/prerender.mjs) -->\n${meta}\n<!-- seo:fim -->`)
    .replace(SCRIPT_PRINCIPAL, '');
  if (!caminho) {
    const landing = { innerHTML: '' };
    renderLanding(landing); // sem progresso salvo: mostra "Começar a trilha"
    saida = saida.replace(LANDING, (_, abre, fecha) => `${abre}${landing.innerHTML}${fecha}`);
  }
  saida = corrigirLinks(saida);
  const atributos = Object.fromEntries([...saida.match(/<html([^>]*)>/)[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, nome, valor]) => [nome, valor]));
  return {
    atributos,
    head: saida.slice(saida.indexOf('<head>') + 6, saida.indexOf('</head>')),
    corpo: saida.slice(saida.indexOf('<body>') + 6, saida.indexOf('</body>')),
  };
}
