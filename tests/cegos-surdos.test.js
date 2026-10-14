// @vitest-environment happy-dom
// Acessibilidade para pessoas cegas (leitor de tela), surdas (Libras com o VLibras) e
// mudas (nada pede voz): avisos falados, perfis, página de acessibilidade e marcação.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { anunciar, falaDosTestes, frase } from '../src/ui/anuncios.js';
import { ativarLibras, VLIBRAS } from '../src/ui/libras.js';
import { PERFIS, OPCOES, PADRAO, aplicarPreferencias } from '../src/ui/preferencias.js';
import { renderDeclaracaoAcessibilidade, ATALHOS } from '../src/ui/declaracao-acessibilidade.js';
import { TERCEIROS } from '../src/privacidade.js';
import { lerRota } from '../src/compartilhar.js';

const ler = (arquivo) => readFileSync(resolve(process.cwd(), arquivo), 'utf8');

const caso = (ok, resultados = [], extra = {}) => ({ ok, resultados, ...extra });
const falhou = { ok: false, mensagem: 'O bucket tem a tag Ambiente', detalhe: 'não encontrei a tag', dica: 'use tags = { Ambiente = "dev" }' };

describe('resultado dos testes, falado', () => {
  it('aceito no envio', () => {
    expect(falaDosTestes({ aprovado: true, relatorio: [caso(true), caso(true)] }, { envio: true }))
      .toBe('Aceito! Você acertou a questão: os 2 casos passaram, inclusive os ocultos.');
  });

  it('casos visíveis passaram: lembra do atalho para enviar', () => {
    expect(falaDosTestes({ aprovado: true, relatorio: [caso(true)] })).toContain('Control Shift Enter');
  });

  it('falha: placar, caso, motivo e dica da primeira falha', () => {
    const fala = falaDosTestes(
      { aprovado: false, relatorio: [caso(true), caso(false, [{ ok: true, mensagem: 'ok' }, falhou])] },
      { nomes: ['Caso 1', 'Caso 2'] },
    );
    expect(fala).toBe('Resposta errada: 1 de 2 casos passaram. Caso 2 falhou. O bucket tem a tag Ambiente. '
      + 'Motivo: não encontrei a tag. Dica: use tags = { Ambiente = "dev" }. Os detalhes estão na aba Testes.');
  });

  it('sem o modo detalhado fala só a primeira falha; com ele, todas', () => {
    const relatorio = [caso(false, [falhou, { ...falhou, mensagem: 'Segunda' }]), caso(false, [falhou], { erroExecucao: 'Unsupported argument' })];
    const curta = falaDosTestes({ aprovado: false, relatorio }, { nomes: ['Caso 1', '🔒 Oculto 1'] });
    expect(curta).toContain('Mais 1 caso com falha.');
    expect(curta).not.toContain('Segunda');
    const completa = falaDosTestes({ aprovado: false, relatorio }, { nomes: ['Caso 1', '🔒 Oculto 1'], detalhado: true });
    expect(completa).toContain('Segunda.');
    expect(completa).toContain('Oculto 1 falhou. Erro na execução: Unsupported argument.');
    expect(completa).not.toContain('🔒');
  });

  it('com erro no código, não repete o erro (já falado com o resultado do comando)', () => {
    expect(falaDosTestes({ aprovado: false, relatorio: [caso(false, [falhou], { erroExecucao: 'Missing required argument' })] }, { codigoComErro: true }))
      .toBe('Resposta errada: 0 de 1 caso passou. Corrija primeiro o erro do código e rode de novo. Os detalhes estão na aba Testes.');
  });

  it('as execuções automáticas não falam: só o que a pessoa pediu', () => {
    const item = ler('src/ui/item.js');
    expect(item).toMatch(/const executarPeloAluno = \(\) => executar\([^)]*falar: true \}\);/);
    expect(item).toContain('if (falar && !comTestes) anunciar(fala);');
  });

  it('sem pressão: mensagem gentil', () => {
    expect(falaDosTestes({ aprovado: false, relatorio: [caso(false, [falhou])] }, { gentil: true })).toMatch(/^Ainda não passou/);
  });

  it('frases terminam com pontuação e sem espaços sobrando', () => {
    expect(frase('  linha  3 ')).toBe('linha 3.');
    expect(frase('Pronto!')).toBe('Pronto!');
  });
});

describe('região de avisos (aria-live)', () => {
  afterEach(() => vi.useRealTimers());

  it('esvazia e preenche de novo: repetir o mesmo aviso também é falado', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="anuncio" role="status" aria-live="polite">Aceito!</div>';
    anunciar('Aceito!');
    expect(document.getElementById('anuncio').textContent).toBe('');
    vi.advanceTimersByTime(100);
    expect(document.getElementById('anuncio').textContent).toBe('Aceito!');
  });

  it('no index.html: um aviso falado; o terminal é um log (só a saída nova é lida); o placar não é região viva', () => {
    const html = ler('index.html');
    expect(html).toContain('<div id="anuncio" class="sr" role="status" aria-live="polite"></div>');
    expect(html).not.toMatch(/id="status"[^>]*role="status"/);
    expect(html).not.toMatch(/id="resumo-testes"[^>]*aria-live/);
    // O terminal só acrescenta texto (nunca é reescrito inteiro), então o log lê só o que chegou.
    expect(html).toMatch(/id="saida-terminal"[^>]*role="log"/);
  });

  it('o editor descreve os atalhos para o leitor de tela', () => {
    expect(ler('index.html')).toMatch(/<p id="ajuda-editor" class="sr">[^<]*Control Enter/);
    expect(ler('src/ui/editor.js')).toContain("'aria-describedby': 'ajuda-editor'");
  });

  it('"Pular para o conteúdo" não muda a rota (antes levava à página inicial)', () => {
    const main = ler('src/main.js');
    expect(main).toMatch(/querySelector\('\.pular'\)\.addEventListener\('click', \(e\) => \{\s*e\.preventDefault\(\);\s*focarTitulo\(\);/);
    expect(main).toContain("if (!location.hash.startsWith('#/')");
  });
});

describe('perfis para pessoas cegas e surdas', () => {
  it('🦯 Leitor de tela e 🤟 Libras usam opções que existem', () => {
    expect(PERFIS.leitorTela.valores).toEqual({ leitorTela: true, reduzirMovimento: true });
    expect(PERFIS.libras.valores).toEqual({ libras: true });
    expect(OPCOES).toHaveProperty('leitorTela');
    expect(OPCOES).toHaveProperty('libras');
  });

  it('o modo leitor de tela vira classe no <html>', () => {
    const raiz = document.createElement('html');
    aplicarPreferencias({ ...PADRAO, leitorTela: true }, raiz);
    expect(raiz.classList.contains('a11y-leitor-tela')).toBe(true);
  });
});

describe('Libras com o VLibras', () => {
  afterEach(() => { delete window.VLibras; });

  it('só carrega quando ligado, do servidor do Governo Federal', async () => {
    let script;
    const append = vi.spyOn(document.head, 'append').mockImplementation((el) => { script = el; });
    const Widget = vi.fn();
    window.VLibras = { Widget };
    const ligando = ativarLibras(true);
    expect(script.src).toBe(`${VLIBRAS}/vlibras-plugin.js`);
    script.onload();
    await ligando;
    expect(Widget).toHaveBeenCalledWith(VLIBRAS);
    append.mockRestore();
  });

  it('desligado, o botão e o avatar somem', async () => {
    document.body.innerHTML = '<div id="vlibras-access-wrapper"></div><div id="vlibras-app-root" data-active="true"></div>';
    await ativarLibras(false);
    expect(document.getElementById('vlibras-access-wrapper').hidden).toBe(true);
    expect(document.getElementById('vlibras-app-root').dataset.active).toBe('false');
  });

  it('a política de privacidade lista o VLibras', () => {
    expect(TERCEIROS.some((t) => t.nome.includes('VLibras') && /Só se você ligar/.test(t.quando))).toBe(true);
  });
});

describe('página de acessibilidade', () => {
  it('rota #/acessibilidade', () => {
    expect(lerRota('#/acessibilidade')).toEqual({ tela: 'acessibilidade' });
  });

  it('fala de pessoas cegas, surdas e mudas, dos atalhos e de como relatar barreiras', () => {
    document.body.innerHTML = '<main id="tela"></main>';
    renderDeclaracaoAcessibilidade(document.getElementById('tela'));
    const titulos = [...document.querySelectorAll('h2')].map((h) => h.textContent);
    expect(document.querySelector('h1').textContent).toBe('Acessibilidade');
    expect(titulos).toEqual(expect.arrayContaining([
      'Pessoas cegas ou com baixa visão', 'Pessoas surdas ou com deficiência auditiva',
      'Pessoas mudas ou com dificuldade de fala', 'Encontrou uma barreira?',
    ]));
    expect(document.querySelectorAll('.tabela-atalhos tbody tr')).toHaveLength(ATALHOS.length);
  });

  it('o rodapé da página inicial e o painel ♿ levam até ela', () => {
    expect(ler('src/ui/landing.js')).toContain('<a href="#/acessibilidade">Acessibilidade</a>');
    expect(ler('index.html')).toContain('<a href="#/acessibilidade">Todos os atalhos e recursos de acessibilidade</a>');
  });
});
