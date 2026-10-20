// Novidades escritas para quem usa o site, e o texto da release do GitHub tirado delas.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lerReleases, notas } from '../scripts/notas-release.mjs';
import { RELEASES } from '../src/novidades.js';

// Palavras de bastidores (CI, PR, workflow...). Nomes de tecnologia que o curso ensina não entram.
const JARGAO = /(?<![\p{L}\p{N}])(CI(\/CD)?|[Ww]orkflows?|PRs?|[Pp]ull [Rr]equests?|[Pp]ush|[Mm]erge|[Oo]verrides?|GitHub Actions|[Cc]ommits?|[Bb]ranch(es)?|[Ll]ockfile|[Rr]ulesets?|[Tt]ransitivas?)(?![\p{L}\p{N}])/u;

const textos = (r) => [r.titulo, r.resumo, ...(r.grupos ?? []).flatMap((g) => [g.titulo, ...g.itens])];

describe('novidades', () => {
  it('a leitura do script de release dá a mesma lista que o site', () => {
    expect(lerReleases(readFileSync('src/novidades.js', 'utf8'))).toEqual(RELEASES);
  });

  it('cada release tem versão, data, título e resumo', () => {
    for (const r of RELEASES) {
      expect(r.versao, r.titulo).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.data, r.versao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.titulo.length, r.versao).toBeGreaterThan(3);
      expect(r.resumo.length, r.versao).toBeGreaterThan(10);
    }
  });

  it('o texto não usa palavras de bastidores', () => {
    const ruins = RELEASES.flatMap((r) => textos(r).filter((t) => JARGAO.test(t)).map((t) => `${r.versao}: ${t}`));
    expect(ruins).toEqual([]);
  });

  it('as notas da release trazem o título, o resumo e os itens', () => {
    const [r] = RELEASES;
    const texto = notas(r);
    expect(texto).toContain(`## ${r.titulo}`);
    expect(texto).toContain(r.resumo);
    for (const g of r.grupos ?? []) for (const item of g.itens) expect(texto).toContain(`- ${item}`);
  });
});
