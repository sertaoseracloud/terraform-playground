import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRINCIPAL, metaTags, dadosEstruturados, sitemap, IMAGEM, NOME } from '../src/seo.js';
import { montarPagina } from '../scripts/prerender.mjs';
import { paginaDe, paginasDoSite } from '../src/paginas.js';
import { SITE } from '../src/certificados.js';
import { problemas, itens } from '../src/conteudo/trilha.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('SEO', () => {
  it('título e descrição nos tamanhos que o Google mostra', () => {
    expect(PRINCIPAL.titulo.length).toBeLessThanOrEqual(60);
    expect(PRINCIPAL.descricao.length).toBeGreaterThan(70);
    expect(PRINCIPAL.descricao.length).toBeLessThanOrEqual(160);
    expect(PRINCIPAL.descricao).toContain(String(problemas.length));
  });

  it('meta tags essenciais', () => {
    const tags = metaTags();
    for (const esperado of [
      `<link rel="canonical" href="${SITE}">`,
      '<meta property="og:locale" content="pt_BR">',
      `<meta property="og:image" content="${IMAGEM}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      'application/ld+json',
    ]) expect(tags).toContain(esperado);
  });

  it('dados estruturados: organização, site e curso gratuito', () => {
    const tipos = dadosEstruturados()['@graph'].map((n) => n['@type']);
    expect(tipos).toEqual(['Organization', 'WebSite', 'Course']);
    const curso = dadosEstruturados()['@graph'][2];
    expect(curso.isAccessibleForFree).toBe(true);
    expect(curso.offers.price).toBe(0);
    expect(curso.inLanguage).toBe('pt-BR');
  });

  it('o JSON-LD não quebra o HTML (sem "</" dentro do script)', () => {
    const script = metaTags().match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    expect(script).not.toContain('</');
    expect(() => JSON.parse(script)).not.toThrow();
  });

  it('o index.html é em pt-BR, tem o bloco de SEO e a landing visível sem JS', () => {
    expect(html).toContain('<html lang="pt-BR"');
    expect(html).toMatch(/<!-- seo:inicio -->[\s\S]*<!-- seo:fim -->/);
    expect(html).toContain('<main id="tela-landing" class="tela-landing"></main>');
  });

  it('o build escreve o <head> e a landing em HTML (com um único h1)', () => {
    const { head, corpo } = montarPagina(html);
    expect(head).toContain(`<title>${PRINCIPAL.titulo}</title>`);
    expect(head).toContain(`<link rel="canonical" href="${SITE}">`);
    const landing = corpo.match(/<main id="tela-landing"[^>]*>([\s\S]*?)<\/main>/)[1];
    expect(landing).toContain('Aprenda');
    expect((landing.match(/<h1/g) ?? []).length).toBe(1);
    expect(landing).toContain('href="/trilha/"');
  });

  it('cada lição e exercício tem página com título, descrição e endereço próprios', () => {
    const item = problemas[0];
    const { head, corpo } = montarPagina(html, { caminho: `p/${item.id}` });
    expect(head).toContain(`<title>${item.titulo} · ${NOME}</title>`);
    expect(head).toContain(`<link rel="canonical" href="${SITE}p/${item.id}/">`);
    expect(head).toContain(`<meta name="description" content="Exercício de `);
    expect(head).not.toContain('application/ld+json'); // os dados do curso ficam só na principal
    // A marcação é a do index.html, com a landing vazia (só a página inicial a traz pronta).
    expect(corpo).toContain('<main id="tela-landing" class="tela-landing"></main>');
    expect(corpo).not.toContain('src="/src/main.js"');
  });

  it('os links do index.html e os arquivos do <head> ganham o endereço real', () => {
    const { head, corpo } = montarPagina(html, { caminho: 'trilha' });
    expect(corpo).toContain('<a href="/trilha/" data-menu="inicio">');
    expect(corpo).not.toMatch(/href="#\//);
    expect(head).toContain('<link rel="icon" href="/favicon.svg"');
    expect(head).toContain('<link rel="manifest" href="/manifest.webmanifest">');
  });

  it('na homologação, todas as páginas têm noindex', () => {
    for (const caminho of ['', 'trilha', `p/${problemas[0].id}`]) {
      expect(montarPagina(html, { caminho, homologacao: true }).head, caminho).toContain('<meta name="robots" content="noindex">');
    }
  });

  it('título e descrição da página são os mesmos que o site põe ao abrir a tela', () => {
    for (const { caminho, rota } of paginasDoSite()) {
      // /s/ precisa do código no hash: o exercício só aparece com o JS (título da principal até lá).
      const { titulo } = caminho === 's' ? PRINCIPAL : paginaDe(rota);
      expect(montarPagina(html, { caminho }).head, caminho).toContain(`<title>${titulo.replace(/&/g, '&#38;').replace(/</g, '&#60;')}</title>`);
    }
  });

  it('o nome é DivergeTerraform e o título e a descrição falam de acessibilidade', () => {
    expect(NOME).toBe('DivergeTerraform');
    expect(PRINCIPAL.titulo).toMatch(/acessíve(l|is) para todas as pessoas/);
    expect(PRINCIPAL.descricao).toMatch(/acessibilidade: leitor de tela, Libras, teclado/);
    expect(metaTags()).toContain(`<meta property="og:site_name" content="DivergeTerraform">`);
  });

  it('dados estruturados de acessibilidade (schema.org) no site e no curso', () => {
    const [, site, curso] = dadosEstruturados()['@graph'];
    for (const no of [site, curso]) {
      expect(no.accessibilityFeature).toEqual(expect.arrayContaining(['signLanguage', 'ARIA', 'highContrastDisplay', 'structuralNavigation']));
      expect(no.accessibilityControl).toContain('fullKeyboardControl');
      expect(no.accessibilityHazard).toEqual(['noFlashingHazard', 'noMotionSimulationHazard', 'noSoundHazard']);
      expect(no.accessibilitySummary).toMatch(/cegas, surdas, mudas e neurodivergentes/);
    }
  });

  it('a página inicial já abre falando de acessibilidade (h1 e selos)', () => {
    const landing = montarPagina(html).corpo.match(/<main id="tela-landing"[^>]*>([\s\S]*?)<\/main>/)[1];
    expect(landing).toMatch(/<h1[^>]*>Aprenda .* com acessibilidade para todas as pessoas<\/h1>/);
    expect(landing).toContain('Leitor de tela · 🤟 Libras');
  });

  it('sitemap com a página principal', () => {
    expect(sitemap('2026-10-12')).toContain(`<loc>${SITE}</loc>`);
  });

  it('sitemap com cada página do site (lições e exercícios), sem repetir a principal', () => {
    const urls = [SITE, `${SITE}trilha/`, `${SITE}p/${problemas[0].id}/`];
    const mapa = sitemap('2026-10-12', urls);
    expect(mapa.match(/<loc>/g)).toHaveLength(3);
    expect(mapa).toContain(`<loc>${SITE}p/${problemas[0].id}/</loc>`);
  });

  it('as páginas do sitemap: todas as lições e exercícios, sem as que precisam de código', () => {
    const paginas = paginasDoSite().filter((p) => p.sitemap).map((p) => p.caminho);
    expect(paginas).toContain(`p/${problemas[0].id}`);
    expect(paginas.filter((c) => c.startsWith('p/'))).toHaveLength(itens.length);
    for (const fora of ['certificado', 's', 'apoie']) expect(paginas).not.toContain(fora);
  });
});
