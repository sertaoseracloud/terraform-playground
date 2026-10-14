// @vitest-environment happy-dom
// Auditoria de acessibilidade das telas (axe-core, WCAG 2.2 AA) e regras de design que
// já viraram débito técnico uma vez: o teste falha se elas voltarem.
// O contraste de cores não dá para medir sem navegador; ele foi conferido nos quatro
// temas com o axe no site publicado, e as cores ficam fixas em estilo.css.
import { describe, it, expect, beforeEach } from 'vitest';
import axe from 'axe-core';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEMAS, PADRAO, COR_DA_BARRA, preferenciasDoSistema, aplicarPreferencias } from '../src/ui/preferencias.js';
import { renderLanding } from '../src/ui/landing.js';
import { renderInstrutor } from '../src/ui/instrutor.js';
import { renderValidador } from '../src/ui/validador.js';
import { renderPrivacidade } from '../src/ui/privacidade.js';
import { renderLicenca, renderTermos } from '../src/ui/paginas-legais.js';
import { renderNovidades } from '../src/ui/novidades.js';
import { renderCertificado } from '../src/ui/certificado.js';
import { renderDeclaracaoAcessibilidade } from '../src/ui/declaracao-acessibilidade.js';
import { criarTelaItem } from '../src/ui/item.js';

const ler = (arquivo) => readFileSync(resolve(process.cwd(), arquivo), 'utf8');
const telasJs = readdirSync(resolve(process.cwd(), 'src/ui')).filter((f) => f.endsWith('.js')).map((f) => [f, ler(`src/ui/${f}`)]);

/** Roda o axe na página toda, menos o contraste (o happy-dom não calcula cores). */
async function violacoes() {
  const { violations } = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const TELAS = {
  'página inicial': (el) => renderLanding(el),
  instrutor: (el) => renderInstrutor(el),
  'validar certificado': (el) => renderValidador(el),
  privacidade: (el) => renderPrivacidade(el),
  licença: (el) => renderLicenca(el),
  termos: (el) => renderTermos(el),
  novidades: (el) => renderNovidades(el),
  'certificado com link inválido': (el) => renderCertificado(el, 'link-quebrado'),
  acessibilidade: (el) => renderDeclaracaoAcessibilidade(el),
};

describe('axe-core nas telas (WCAG 2.2 AA)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'pt-BR';
    document.title = 'Teste';
    document.body.innerHTML = '<main id="tela"></main>';
  });

  it('controle: o axe acha os erros neste ambiente', async () => {
    document.getElementById('tela').innerHTML = '<h1>Teste</h1><img src="x.png"><button></button><a href="#" target="_blank"></a>';
    const ids = (await violacoes()).map((v) => v.split(':')[0]);
    expect(ids).toEqual(expect.arrayContaining(['image-alt', 'button-name', 'link-name']));
  });

  it.each(Object.entries(TELAS))('%s: sem violações', async (_nome, render) => {
    render(document.getElementById('tela'));
    expect(await violacoes()).toEqual([]);
  });

  it.each(Object.keys(TEMAS))('exercício com o terminal esperando o yes do apply (tema %s): sem violações', async (tema) => {
    const html = ler('index.html');
    document.body.innerHTML = html.slice(html.indexOf('>', html.indexOf('<body')) + 1, html.lastIndexOf('</body>'));
    document.documentElement.classList.add('a11y-sem-movimento');
    aplicarPreferencias({ ...PADRAO, tema });
    const tela = criarTelaItem({ layout: { aplicar() {}, mostrarDescricao() {} }, definirStatus: () => {}, aoMudarProgresso: () => {} });
    tela.abrir('livre');
    const ate = async (cond) => { for (let i = 0; i < 300 && !cond(); i++) await new Promise((r) => setTimeout(r, 10)); };
    const prompt = () => document.getElementById('prompt-terminal').textContent;
    await ate(() => prompt() === 'aluno@sertao:~/livre$ ');
    document.getElementById('btn-apply').click();
    await ate(() => prompt() === '  Enter a value: ');
    expect(document.getElementById('campo-terminal').getAttribute('aria-label')).toBe('Resposta do Terraform: digite yes para aprovar');
    // Só a tela do exercício (o happy-dom não esconde [hidden] para o axe; tiramos as outras).
    document.querySelectorAll('main[id^="tela-"]').forEach((t) => { if (t.id === 'tela-item') t.hidden = false; else t.remove(); });
    expect((await violacoes()).join(' | ')).toBe('');
    document.documentElement.classList.remove('a11y-sem-movimento');
  });
});

describe('regras de design que viraram débito', () => {
  it('nenhum link dentro de <summary> (vira controle dentro de controle)', () => {
    for (const [arquivo, codigo] of telasJs) {
      for (const [resumo] of codigo.matchAll(/<summary[^>]*>.*?<\/summary>/gs)) {
        expect(resumo, arquivo).not.toMatch(/<a\s|<button/);
      }
    }
  });

  it('links que abrem outra aba levam rel="noopener noreferrer"', () => {
    for (const [arquivo, codigo] of [...telasJs, ['index.html', ler('index.html')]]) {
      for (const [link] of codigo.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) {
        expect(link, arquivo).toContain('rel="noopener noreferrer"');
      }
    }
  });

  it('regiões que rolam de lado recebem foco pelo teclado', () => {
    expect(ler('src/ui/item.js')).toContain('<ol class="roteiro" aria-label="Como resolver" tabindex="0">');
    expect(ler('src/ui/editor.js')).toMatch(/contentAttributes\.of\(\{[^}]*tabindex: '0'/);
  });

  it('nenhum texto menor que 0,75rem (12px no tamanho padrão)', () => {
    for (const css of ['src/estilo.css', 'src/caminho.css', 'src/landing.css']) {
      for (const [, valor] of ler(css).matchAll(/font-size:\s*([\d.]+)rem/g)) {
        expect(Number(valor), `${css}: ${valor}rem`).toBeGreaterThanOrEqual(0.75);
      }
    }
  });
});

describe('tema que segue o sistema operacional', () => {
  const sistema = (...ativas) => (q) => ativas.includes(q);

  it('sem preferência no sistema, fica o padrão', () => {
    expect(preferenciasDoSistema(PADRAO, sistema())).toEqual(PADRAO);
  });

  it('modo claro, contraste alto e reduzir movimento', () => {
    expect(preferenciasDoSistema(PADRAO, sistema('(prefers-color-scheme: light)')).tema).toBe('claro');
    expect(preferenciasDoSistema(PADRAO, sistema('(prefers-contrast: more)', '(prefers-color-scheme: light)')).tema).toBe('alto-contraste');
    expect(preferenciasDoSistema(PADRAO, sistema('(forced-colors: active)')).tema).toBe('alto-contraste');
    expect(preferenciasDoSistema(PADRAO, sistema('(prefers-reduced-motion: reduce)')).reduzirMovimento).toBe(true);
  });

  it('a barra do navegador (theme-color) acompanha o tema, com a cor do próprio tema', () => {
    const css = ler('src/estilo.css');
    expect(Object.keys(COR_DA_BARRA).sort()).toEqual(Object.keys(TEMAS).sort());
    for (const [tema, cor] of Object.entries(COR_DA_BARRA)) {
      const bloco = css.match(new RegExp(`\\[data-tema="${tema}"\\] \\{([^}]*)\\}`))[1];
      expect(bloco, tema).toContain(`--fundo-escuro: ${cor};`);
    }
    document.head.innerHTML = '<meta name="theme-color" content="#21222c">';
    aplicarPreferencias({ ...PADRAO, tema: 'claro' });
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe(COR_DA_BARRA.claro);
  });
});
