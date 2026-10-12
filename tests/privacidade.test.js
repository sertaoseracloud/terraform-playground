// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DADOS_LOCAIS, TERCEIROS, CONTROLADOR } from '../src/privacidade.js';
import { exportarDados, apagarDados, gravarNome, marcar, gravarPreferencia } from '../src/progresso.js';
import { lerRota } from '../src/compartilhar.js';

// No ambiente happy-dom, import.meta.url não é um caminho de arquivo: lê a partir da raiz.
const ler = (arquivo) => readFileSync(resolve(process.cwd(), arquivo), 'utf8');

describe('política de privacidade', () => {
  it('toda chave que o site grava no navegador está documentada', () => {
    const codigo = ler('src/progresso.js');
    const usadas = new Set([...codigo.matchAll(/(?:ler|gravar|remover)\(\s*[`'"]([a-z:]+)(\$\{)?/g)]
      .map(([, chave, template]) => (template ? `${chave}*` : chave)));
    const documentadas = new Set(DADOS_LOCAIS.map((d) => d.chave));
    expect(usadas.size).toBeGreaterThan(5);
    for (const chave of usadas) expect(documentadas, `chave "${chave}" sem documentação`).toContain(chave);
  });

  // Só o que o navegador baixa sozinho (imagens, estilos); links comuns só levam lá se a pessoa clicar.
  it('todo domínio externo carregado automaticamente aparece na lista de terceiros', () => {
    const fontes = ['src/conteudo/basico.js', 'src/conteudo/aws.js', 'src/conteudo/azure.js', 'src/certificados.js']
      .map(ler).join(" ");
    const dominios = new Set([...fontes.matchAll(/(?:src="|stylesheet" href=")https:\/\/([^/"]+)/g)].map(([, d]) => d));
    const texto = JSON.stringify(TERCEIROS).toLowerCase();
    for (const d of dominios) expect(texto, `domínio ${d} sem aviso`).toContain(d.replace(/^www\./, '').split('.')[0]);
  });

  it('tem responsável e canal de contato', () => {
    expect(CONTROLADOR.nome).toBe('Sertão será cloud');
    expect(CONTROLADOR.contato).toMatch(/^https:\/\//);
  });

  it('rota #/privacidade', () => {
    expect(lerRota('#/privacidade')).toEqual({ tela: 'privacidade' });
  });
});

describe('direitos do titular', () => {
  beforeEach(() => localStorage.clear());

  it('exporta só os dados do site e apaga tudo', () => {
    localStorage.setItem('outro-site', 'x');
    gravarNome('Ana');
    marcar('html-1', 'resolvido');
    gravarPreferencia('tutorial-visto', true);

    const dados = exportarDados();
    expect(dados.nome).toBe('Ana');
    expect(dados.progresso).toEqual({ 'html-1': 'resolvido' });
    expect(dados['pref:tutorial-visto']).toBe(true);
    expect(dados).not.toHaveProperty('outro-site');

    expect(apagarDados()).toBe(Object.keys(dados).length);
    expect(exportarDados()).toEqual({});
    expect(localStorage.getItem('outro-site')).toBe('x');
  });
});
