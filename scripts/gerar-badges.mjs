// Gera os arquivos estáticos dos badges em public/:
//   public/badges/<id>.png        badge quadrado (600×600)
//   public/badges/<id>-card.png   cartão 1200×627 da prévia do LinkedIn
//   public/badge/<id>/index.html  página que o LinkedIn lê (meta tags og:) e
//                                 que leva quem clica ao certificado (noindex)
//   public/favicon.svg, icone-192.png, icone-512.png, apple-touch-icon.png
//   public/og-capa.png            capa 1200×630 para compartilhar o site
// Rode com `npm run badges` depois de mudar src/badges.js ou src/certificados.js
// e faça commit dos arquivos gerados. Os PNGs usam as fontes do sistema.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { svgBadge, svgCartao, svgIcone, svgCapa } from '../src/badges.js';
import { modulos, problemas } from '../src/conteudo/trilha.js';
import { CERTIFICADOS, EMISSOR, SITE } from '../src/certificados.js';

const raiz = new URL('../public/', import.meta.url);
const png = (svg, largura) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: largura }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } })
    .render().asPng();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function paginaBadge(id) {
  const def = CERTIFICADOS[id];
  const titulo = `${id === 'final' ? 'Certificado' : 'Badge'}: ${def.titulo} · ${EMISSOR.organizacao}`;
  const descricao = `${id === 'final' ? 'Certificado de conclusão' : 'Badge digital'} emitido pela ${EMISSOR.organizacao}. `
    + `Carga horária: ${def.cargaHoraria} ${def.cargaHoraria === 1 ? 'hora' : 'horas'}. Habilidades: ${def.conteudos.join(', ')}.`;
  const imagem = `${SITE}badges/${id}-card.png`;
  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descricao)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(EMISSOR.organizacao)}">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descricao)}">
  <meta property="og:url" content="${SITE}badge/${id}/">
  <meta property="og:image" content="${imagem}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="627">
  <meta property="og:image:alt" content="${esc(`Badge ${def.titulo}`)}">
  <meta name="robots" content="noindex, follow">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${imagem}">
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #21222c; color: #f8f8f2; font-family: system-ui, sans-serif; text-align: center; }
    img { width: 220px; height: 220px; }
    a { color: #bd93f9; }
  </style>
</head>
<body>
  <main>
    <img src="../../badges/${id}.png" alt="">
    <h1>${esc(def.titulo)}</h1>
    <p><a id="ir" href="../../">Abrir o certificado</a></p>
  </main>
  <script>
    // O código do certificado vem em ?c=; o certificado em si é montado pelo site.
    var c = new URLSearchParams(location.search).get('c');
    var destino = '../../' + (c && /^[A-Za-z0-9_-]+$/.test(c) ? '#/certificado/' + c : '#/');
    document.getElementById('ir').href = destino;
    location.replace(destino);
  </script>
</body>
</html>
`;
}

for (const id of Object.keys(CERTIFICADOS)) {
  mkdirSync(new URL('badges/', raiz), { recursive: true });
  mkdirSync(new URL(`badge/${id}/`, raiz), { recursive: true });
  writeFileSync(new URL(`badges/${id}.png`, raiz), png(svgBadge(id), 600));
  writeFileSync(new URL(`badges/${id}-card.png`, raiz), png(svgCartao(id), 1200));
  writeFileSync(new URL(`badge/${id}/index.html`, raiz), paginaBadge(id));
  console.log(`badge ${id} ok`);
}

// ---------- ícones e capa do site ----------
const icone = svgIcone();
writeFileSync(new URL('favicon.svg', raiz), icone);
writeFileSync(new URL('icone-192.png', raiz), png(icone, 192));
writeFileSync(new URL('icone-512.png', raiz), png(icone, 512));
writeFileSync(new URL('apple-touch-icon.png', raiz), png(icone, 180));
const projetos = modulos.find((m) => m.grupos)?.grupos.length ?? 0;
writeFileSync(new URL('og-capa.png', raiz), png(svgCapa({ exercicios: problemas.length, projetos }), 1200));
console.log('ícones e capa ok');
