// @vitest-environment happy-dom
// Uma página por tela: título e descrição de cada uma (o mesmo no build e ao trocar de tela) e o sitemap.
import { describe, it, expect } from 'vitest';
import { paginaDe, paginasDoSite } from '../src/paginas.js';
import { definirPagina, NOME, PRINCIPAL } from '../src/seo.js';
import { SITE } from '../src/certificados.js';
import { itens, LIVRE } from '../src/conteudo/trilha.js';
import { GET, getStaticPaths } from '../src/pages/[mapa].xml.js';

describe('título e descrição de cada tela', () => {
  it.each([
    [{ tela: 'landing' }, PRINCIPAL.titulo],
    [{ tela: 'inicio' }, `Trilha · ${NOME}`],
    [{ tela: 'validar', codigo: '' }, `Validar certificado · ${NOME}`],
    [{ tela: 'acessibilidade' }, `Acessibilidade · ${NOME}`],
    [{ tela: 'instrutor' }, `Quem é o instrutor? · ${NOME}`],
    [{ tela: 'instrutor', ancora: 'apoie' }, `Apoie o projeto · ${NOME}`],
    [{ tela: 'licenca' }, `Licença · ${NOME}`],
    [{ tela: 'termos' }, `Termos de uso · ${NOME}`],
    [{ tela: 'privacidade' }, `Privacidade e cookies · ${NOME}`],
    [{ tela: 'certificado', codigo: '' }, `Certificado · ${NOME}`],
    [{ tela: 'nao-encontrada' }, `Página não encontrada · ${NOME}`],
    [{ tela: 'item', id: 'nao-existe' }, `Página não encontrada · ${NOME}`],
    [{ tela: 'item', id: 'livre' }, `${LIVRE.titulo} · ${NOME}`],
  ])('%o', (rota, titulo) => {
    const pagina = paginaDe(rota);
    expect(pagina.titulo).toBe(titulo);
    expect(pagina.descricao.length).toBeGreaterThan(20);
  });

  it('novidades traz a versão no título', () => {
    expect(paginaDe({ tela: 'novidades' }).titulo).toMatch(new RegExp(`^Novidades \\(v[\\d.]+\\) · ${NOME}$`));
  });

  it('lição e exercício dizem o que são e de que módulo', () => {
    const licao = itens.find((i) => i.tipo === 'licao');
    const exercicio = itens.find((i) => i.tipo === 'problema');
    expect(paginaDe({ tela: 'item', id: licao.id }).descricao).toMatch(/^Lição de /);
    expect(paginaDe({ tela: 'item', id: exercicio.id }).descricao).toMatch(/^Exercício de /);
  });

  it('definirPagina troca o título da aba e as meta tags de descrição', () => {
    document.head.innerHTML = '<meta name="description" content=""><meta property="og:title" content=""><meta property="og:description" content="">';
    definirPagina(paginaDe({ tela: 'inicio' }));
    expect(document.title).toBe(`Trilha · ${NOME}`);
    expect(document.head.querySelector('meta[property="og:title"]').content).toBe(`Trilha · ${NOME}`);
    definirPagina({ titulo: 'Certificado de Ana · Sertão será cloud' });
    expect(document.head.querySelector('meta[name="description"]').content).toBe(PRINCIPAL.descricao);
  });
});

describe('sitemap.xml', () => {
  it('é gerado no site principal (na homologação, a rota não gera nada)', () => {
    expect(getStaticPaths()).toEqual([{ params: { mapa: 'sitemap' } }]);
  });

  it('lista a página principal e todas as páginas indexáveis', async () => {
    const resposta = GET();
    expect(resposta.headers.get('Content-Type')).toBe('application/xml');
    const xml = await resposta.text();
    const total = paginasDoSite().filter((p) => p.sitemap).length;
    expect(xml.match(/<loc>/g)).toHaveLength(total);
    expect(xml).toContain(`<loc>${SITE}</loc>`);
    expect(xml).toContain(`<loc>${SITE}p/${itens[0].id}/</loc>`);
    expect(xml).not.toContain(`<loc>${SITE}certificado/</loc>`);
  });
});
