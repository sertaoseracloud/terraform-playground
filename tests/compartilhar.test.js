import { describe, it, expect } from 'vitest';
import { codificar, decodificar, lerRota, linkItem, linkCompartilhado } from '../src/compartilhar.js';

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
    expect(lerRota('')).toEqual({ tela: 'landing' });
    expect(lerRota('#/')).toEqual({ tela: 'landing' });
    expect(lerRota('#/trilha')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/qualquer-coisa')).toEqual({ tela: 'landing' });
  });

  it('item da trilha e playground livre', () => {
    expect(lerRota(linkItem('tf-ola-arquivo'))).toEqual({ tela: 'item', id: 'tf-ola-arquivo' });
    expect(lerRota('#/livre')).toEqual({ tela: 'item', id: 'livre' });
  });

  it('código compartilhado, inclusive com pastas de módulos', () => {
    const estado = { item: 'tf-referencia', arquivos: { 'main.tf': 'resource "random_pet" "x" {}\n', 'modulos/a/main.tf': '# módulo' } };
    expect(lerRota(linkCompartilhado(estado))).toEqual({ tela: 'item', id: 'tf-referencia', arquivos: estado.arquivos });
    expect(lerRota('#/s/@@@')).toEqual({ tela: 'landing' });
  });
});
