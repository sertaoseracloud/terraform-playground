// SEO: título, descrição, imagem de compartilhamento e dados estruturados (JSON-LD).
// O build (scripts/prerender.mjs) usa isto para escrever o <head> do index.html,
// e o site usa `definirPagina` para atualizar título e descrição a cada tela.
//
// As rotas ficam depois do # (GitHub Pages não tem servidor), então para os
// buscadores o site é uma página só: a landing, que o build já entrega em HTML.
import { SITE, EMISSOR, CERTIFICADOS } from './certificados.js';
import { modulos, problemas, itens } from './conteudo/trilha.js';

export const NOME = 'DivergeTerraform';
export const IMAGEM = `${SITE}og-capa.png`;
export const REPOSITORIO = 'https://github.com/sertaoseracloud/terraform-playground';

const totalLicoes = itens.filter((i) => i.tipo === 'licao').length;

/** Título e descrição da página principal (buscadores e redes sociais). */
export const PRINCIPAL = {
  titulo: `${NOME}: Terraform acessível para todas as pessoas`,
  // Até ~155 caracteres, para não ser cortada no Google.
  descricao: `Aprenda Terraform grátis com acessibilidade: leitor de tela, Libras, teclado e perfis para TDAH e dislexia. `
    + `${problemas.length} exercícios de AWS e Azure com certificado.`,
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Acessibilidade da plataforma no vocabulário do schema.org (o mesmo que buscadores e
 * catálogos de recursos educacionais acessíveis leem). Só o que o site faz de verdade:
 * veja a página #/acessibilidade e tests/acessibilidade-telas.test.js.
 */
export const ACESSIBILIDADE = {
  accessMode: ['textual', 'visual'],
  accessModeSufficient: [
    { '@type': 'ItemList', itemListElement: ['textual'], description: 'Todo o conteúdo funciona só com texto, com leitor de tela ou linha braille.' },
    { '@type': 'ItemList', itemListElement: ['visual'], description: 'Nada depende de som: todo aviso aparece escrito na tela.' },
  ],
  accessibilityFeature: [
    'alternativeText', 'longDescription', 'ARIA', 'structuralNavigation', 'readingOrder',
    'highContrastDisplay', 'largePrint', 'displayTransformability', 'signLanguage', 'ttsMarkup',
  ],
  accessibilityControl: ['fullKeyboardControl', 'fullMouseControl', 'fullTouchControl'],
  accessibilityHazard: ['noFlashingHazard', 'noMotionSimulationHazard', 'noSoundHazard'],
  accessibilityAPI: ['ARIA'],
  accessibilitySummary: 'Plataforma feita para pessoas cegas, surdas, mudas e neurodivergentes: '
    + 'resultados falados pelo leitor de tela, navegação completa pelo teclado, tradução para Libras com o VLibras, '
    + 'temas de alto contraste, texto até 175% e perfis para TDAH, dislexia, autismo e ansiedade. Meta: WCAG 2.2 nível AA.',
};

/** Dados estruturados schema.org: organização, site e curso. */
export function dadosEstruturados() {
  const organizacao = {
    '@type': 'Organization',
    '@id': `${SITE}#organizacao`,
    name: EMISSOR.organizacao,
    url: 'https://github.com/sertaoseracloud',
    logo: EMISSOR.logo,
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizacao,
      {
        '@type': 'WebSite',
        '@id': `${SITE}#site`,
        url: SITE,
        name: NOME,
        description: PRINCIPAL.descricao,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE}#organizacao` },
        ...ACESSIBILIDADE,
      },
      {
        '@type': 'Course',
        '@id': `${SITE}#curso`,
        name: EMISSOR.curso,
        description: `Trilha gamificada e acessível com ${totalLicoes} lições, ${problemas.length} exercícios corrigidos por testes `
          + `automáticos e ${modulos.find((m) => m.grupos)?.grupos.length ?? 0} projetos completos: Terraform do básico à AWS e ao Azure.`,
        url: SITE,
        image: IMAGEM,
        inLanguage: 'pt-BR',
        isAccessibleForFree: true,
        ...ACESSIBILIDADE,
        license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        educationalLevel: 'Iniciante',
        teaches: Object.values(CERTIFICADOS).filter((c) => c !== CERTIFICADOS.final).map((c) => c.titulo),
        provider: { '@id': `${SITE}#organizacao` },
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'BRL', category: 'Free', availability: 'https://schema.org/InStock' },
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'Online',
          inLanguage: 'pt-BR',
        },
      },
    ],
  };
}

/** Bloco de meta tags do <head> (gerado no build). */
export function metaTags() {
  const { titulo, descricao } = PRINCIPAL;
  const tags = [
    `<title>${esc(titulo)}</title>`,
    `<meta name="description" content="${esc(descricao)}">`,
    `<link rel="canonical" href="${SITE}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<meta name="author" content="${esc(EMISSOR.organizacao)}">`,
    `<meta name="application-name" content="${NOME}">`,
    `<meta property="og:site_name" content="${NOME}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="pt_BR">',
    `<meta property="og:url" content="${SITE}">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(descricao)}">`,
    `<meta property="og:image" content="${IMAGEM}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(`${NOME}: Terraform acessível, com leitor de tela, Libras e perfis para neurodivergentes`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(titulo)}">`,
    `<meta name="twitter:description" content="${esc(descricao)}">`,
    `<meta name="twitter:image" content="${IMAGEM}">`,
    `<script type="application/ld+json">${JSON.stringify(dadosEstruturados()).replace(/</g, '\\u003c')}</script>`,
  ];
  return tags.join('\n  ');
}

/** sitemap.xml: só a página principal (as telas internas ficam depois do #). */
export function sitemap(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${data}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>
`;
}

/** Atualiza título e descrição ao trocar de tela (o Google indexa o que o JavaScript desenha). */
export function definirPagina({ titulo, descricao = PRINCIPAL.descricao }) {
  document.title = titulo;
  const meta = (seletor) => document.head.querySelector(seletor);
  meta('meta[name="description"]')?.setAttribute('content', descricao);
  meta('meta[property="og:title"]')?.setAttribute('content', titulo);
  meta('meta[property="og:description"]')?.setAttribute('content', descricao);
}
