// Roda depois do `vite build` (npm run build): deixa o site legível para buscadores
// e redes sociais, que nem sempre executam JavaScript.
//   - troca o bloco <!-- seo:inicio --> … <!-- seo:fim --> do <head> pelas meta tags
//     e pelos dados estruturados (src/seo.js);
//   - escreve a landing page já em HTML dentro de <main id="tela-landing">;
//   - gera dist/sitemap.xml.
import { readFileSync, writeFileSync } from 'node:fs';
import { metaTags, sitemap } from '../src/seo.js';
import { versaoDoPacote } from './plugin-historico.mjs';

// Mesma versão que o Vite injeta no site (a landing lê __VERSAO__).
globalThis.__VERSAO__ = versaoDoPacote();
const { renderLanding } = await import('../src/ui/landing.js');

export function prerender(html) {
  const seo = /<!-- seo:inicio -->[\s\S]*?<!-- seo:fim -->/;
  if (!seo.test(html)) throw new Error('index.html sem o bloco <!-- seo:inicio --> … <!-- seo:fim -->');
  const landing = { innerHTML: '' };
  renderLanding(landing); // sem progresso salvo: mostra "Começar a trilha"
  const vazio = /(<main id="tela-landing"[^>]*>)\s*(<\/main>)/;
  if (!vazio.test(html)) throw new Error('index.html sem <main id="tela-landing"></main> vazio');
  return html
    .replace(seo, `<!-- seo:inicio (gerado por scripts/prerender.mjs) -->\n  ${metaTags()}\n  <!-- seo:fim -->`)
    .replace(vazio, (_, abre, fecha) => `${abre}${landing.innerHTML}${fecha}`);
}

// Só escreve os arquivos quando roda como script (os testes importam só a função).
if (process.argv[1]?.endsWith('prerender.mjs')) {
  const dist = new URL('../dist/', import.meta.url);
  const arquivo = new URL('index.html', dist);
  writeFileSync(arquivo, prerender(readFileSync(arquivo, 'utf8')));
  writeFileSync(new URL('sitemap.xml', dist), sitemap(new Date().toISOString().slice(0, 10)));
  console.log('prerender: <head> com SEO, landing em HTML e sitemap.xml');
}
