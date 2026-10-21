import { describe, it, expect } from 'vitest';
import {
  codificar, decodificar, lerRota, linkItem, linkCompartilhado, linkValidar, rota, traduzirHashAntigo, ehRotaDoSite, ROTAS_FIXAS,
} from '../src/compartilhar.js';

// Nos testes, o prefixo do site (BASE_URL) é "/"; no build, /<repositório>/.
const ler = (endereco) => lerRota(new URL(endereco, 'http://localhost'));

describe('compartilhar', () => {
  it('codifica e decodifica arquivos com acentos e símbolos', () => {
    const estado = { item: 'livre', arquivos: { 'main.tf': 'output "x" {\n  value = "Olá, ção! & <b> ${var.y}"\n}\n' } };
    expect(decodificar(codificar(estado))).toEqual(estado);
  });

  it('ignora códigos corrompidos', () => {
    expect(decodificar('@@@')).toBeNull();
    expect(decodificar(btoa('{"a":{"x":1}}'))).toBeNull();
  });
});

describe('rotas', () => {
  it('início', () => {
    expect(ler('/')).toEqual({ tela: 'landing' });
    expect(ler(rota())).toEqual({ tela: 'landing' });
    expect(ler(rota('trilha'))).toEqual({ tela: 'inicio' });
    expect(ler('/trilha')).toEqual({ tela: 'inicio' });
    expect(ler('/#conteudo')).toEqual({ tela: 'landing' });
  });

  it('endereço que não existe avisa em vez de cair na landing', () => {
    expect(ler('/qualquer-coisa/')).toEqual({ tela: 'nao-encontrada' });
    expect(ler('/p/a/b/')).toEqual({ tela: 'nao-encontrada' });
    expect(ler('/s/#@@@')).toEqual({ tela: 'nao-encontrada', motivo: 'link' });
  });

  it('item da trilha e playground livre', () => {
    expect(linkItem('tf-ola-arquivo')).toBe('/p/tf-ola-arquivo/');
    expect(ler(linkItem('tf-ola-arquivo'))).toEqual({ tela: 'item', id: 'tf-ola-arquivo' });
    expect(linkItem('livre')).toBe('/livre/');
    expect(ler('/livre/')).toEqual({ tela: 'item', id: 'livre' });
  });

  it('código compartilhado, inclusive com pastas de módulos (no hash, que não vai ao servidor)', () => {
    const estado = { item: 'tf-referencia', arquivos: { 'main.tf': 'resource "random_pet" "x" {}\n', 'modulos/a/main.tf': '# módulo' } };
    expect(linkCompartilhado(estado)).toMatch(/^\/s\/#[\w-]+$/);
    expect(ler(linkCompartilhado(estado))).toEqual({ tela: 'item', id: 'tf-referencia', arquivos: estado.arquivos });
  });

  it('validador e certificado levam o código no hash', () => {
    expect(linkValidar()).toBe('/validar/');
    expect(linkValidar('abc')).toBe('/validar/#abc');
    expect(ler('/validar/#abc')).toEqual({ tela: 'validar', codigo: 'abc' });
    expect(ler('/certificado/#xyz')).toEqual({ tela: 'certificado', codigo: 'xyz' });
  });

  it('toda rota fixa é uma tela do site (e cada uma vira uma página no build)', () => {
    for (const nome of ROTAS_FIXAS) {
      expect(ehRotaDoSite(new URL(rota(nome), 'http://localhost')), nome).toBe(true);
      // /s/ só vale com o código no hash (/s/#<código>): sem ele, é um link quebrado.
      if (nome !== 's') expect(ler(rota(nome)).tela, nome).not.toBe('nao-encontrada');
    }
    expect(ler(rota('s'))).toEqual({ tela: 'nao-encontrada', motivo: 'link' });
  });

  it('arquivos do site não são telas: o clique abre a página deles', () => {
    for (const arquivo of ['/badge/fundamentos/?c=abc', '/chave-publica-ed25519.txt', '/sitemap.xml']) {
      expect(ehRotaDoSite(new URL(arquivo, 'http://localhost')), arquivo).toBe(false);
    }
  });
});

describe('links antigos (rotas no #)', () => {
  it.each([
    ['#/', '/'],
    ['#/trilha', '/trilha/'],
    ['#/p/tf-ola-arquivo', '/p/tf-ola-arquivo/'],
    ['#/livre', '/livre/'],
    ['#/apoie', '/apoie/'],
    ['#/validar', '/validar/'],
    ['#/validar/abc', '/validar/#abc'],
    ['#/certificado/abc', '/certificado/#abc'],
    ['#/s/abc', '/s/#abc'],
    ['#/nao-existe', '/nao-existe/'],
  ])('%s → %s', (antigo, novo) => {
    expect(traduzirHashAntigo(antigo)).toBe(novo);
  });

  it('âncoras e hash vazio não são links antigos', () => {
    expect(traduzirHashAntigo('')).toBeNull();
    expect(traduzirHashAntigo('#conteudo')).toBeNull();
  });

  it('um link compartilhado antigo abre o mesmo exercício com os mesmos arquivos', () => {
    const estado = { item: 'tf-ola-arquivo', arquivos: { 'main.tf': 'terraform {}\n' } };
    const antigo = `#/s/${codificar(estado)}`;
    expect(ler(traduzirHashAntigo(antigo))).toEqual({ tela: 'item', id: estado.item, arquivos: estado.arquivos });
  });
});
