// Modo de homologação: o build com HOMOLOGACAO=1 guarda o progresso em outro lugar,
// aponta os certificados para /homologacao/ e não é indexado; sem a variável, tudo como hoje.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configurarAmbiente, HOMOLOGACAO, PREFIXO_ARMAZENAMENTO, SITE_ATUAL } from '../src/ambiente.js';
import { SITE } from '../src/certificados.js';
import { prerender } from '../scripts/prerender.mjs';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('ambiente', () => {
  it('fora da homologação, tudo como hoje', () => {
    expect(configurarAmbiente(false)).toEqual({
      homologacao: false,
      prefixo: 'terraform-playground:',
      site: 'https://sertaoseracloud.github.io/terraform-playground/',
    });
  });

  it('na homologação, outro armazenamento e outro endereço', () => {
    expect(configurarAmbiente(true)).toEqual({
      homologacao: true,
      prefixo: 'terraform-playground-homologacao:',
      site: 'https://sertaoseracloud.github.io/terraform-playground/homologacao/',
    });
  });

  it('nos testes, o modo é o normal', () => {
    expect(HOMOLOGACAO).toBe(false);
    expect(PREFIXO_ARMAZENAMENTO).toBe('terraform-playground:');
    expect(SITE).toBe(SITE_ATUAL);
  });
});

describe('faixa e indexação', () => {
  it('a faixa de homologação existe escondida, com link para o site principal', () => {
    const faixa = html.match(/<aside id="faixa-homologacao"[^>]*>[\s\S]*?<\/aside>/)?.[0] ?? '';
    expect(faixa).toMatch(/aria-label="Aviso de homologação"/);
    expect(faixa).toMatch(/\shidden[\s>]/);
    expect(faixa).toContain('🧪 Homologação: versão em teste do develop');
    expect(faixa).toMatch(/href="\.\.\/"/);
  });

  it('o prerender só põe noindex na homologação', () => {
    expect(prerender(html)).not.toContain('noindex');
    const homologacao = prerender(html, { homologacao: true });
    expect(homologacao).toContain('<meta name="robots" content="noindex">');
    expect(homologacao.match(/<meta name="robots"/g)).toHaveLength(1); // um só, sem o "index, follow"
  });
});
