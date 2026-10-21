// dist/sitemap.xml: a página principal e cada página do site (lições, exercícios, trilha...).
// A homologação não tem sitemap (e tem noindex): lá esta rota não gera nada.
import { sitemap } from '../seo.js';
import { SITE } from '../certificados.js';
import { BASE, rota } from '../compartilhar.js';
import { paginasDoSite } from '../paginas.js';

export function getStaticPaths() {
  return __HOMOLOGACAO__ ? [] : [{ params: { mapa: 'sitemap' } }];
}

export function GET() {
  const urls = paginasDoSite().filter((p) => p.sitemap).map((p) => `${SITE}${rota(p.caminho).slice(BASE.length)}`);
  return new Response(sitemap(new Date().toISOString().slice(0, 10), urls), { headers: { 'Content-Type': 'application/xml' } });
}
