import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRINCIPAL, metaTags, dadosEstruturados, sitemap, IMAGEM } from '../src/seo.js';
import { prerender } from '../scripts/prerender.mjs';
import { SITE } from '../src/certificados.js';
import { problemas } from '../src/conteudo/trilha.js';

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
    const saida = prerender(html);
    expect(saida).toContain(`<title>${PRINCIPAL.titulo}</title>`);
    expect(saida).toContain('<link rel="canonical"');
    const landing = saida.match(/<main id="tela-landing"[^>]*>([\s\S]*?)<\/main>/)[1];
    expect(landing).toContain('Aprenda');
    expect((landing.match(/<h1/g) ?? []).length).toBe(1);
    expect(landing).toContain('href="#/trilha"');
  });

  it('sitemap com a página principal', () => {
    expect(sitemap('2026-10-12')).toContain(`<loc>${SITE}</loc>`);
  });
});
