import { describe, it, expect } from 'vitest';
import { GLOSSARIO, termosDoTexto, MAX_TERMOS } from '../src/conteudo/glossario.js';
import { itens } from '../src/conteudo/trilha.js';
import { descreverRegra } from '../src/verificacoes.js';

const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

describe('glossário', () => {
  it('cada termo tem id único, definição e analogia', () => {
    expect(new Set(GLOSSARIO.map((t) => t.id)).size).toBe(GLOSSARIO.length);
    for (const t of GLOSSARIO) {
      expect(t.definicao.length).toBeGreaterThan(20);
      expect(t.analogia.length).toBeGreaterThan(20);
    }
  });

  it('acha termos com acento e na ordem em que aparecem', () => {
    const ids = termosDoTexto('Guarde o valor numa variável, use for_each com um conjunto e crie a VPC.').map((t) => t.id);
    expect(ids).toEqual(['variavel', 'for-each', 'conjunto', 'vpc']);
  });

  it('não confunde palavras parecidas', () => {
    expect(termosDoTexto('se for preciso, faça o post do blog')).toEqual([]);
    expect(termosDoTexto('use a região sa-east-1').map((t) => t.id)).toEqual(['regiao']);
  });

  it(`todo exercício tem pelo menos um termo explicado (no máximo ${MAX_TERMOS})`, () => {
    const semTermos = itens.filter((i) => {
      const html = i.tipo === 'problema' ? `${i.titulo} ${i.enunciado} ${i.dica}` : `${i.titulo} ${i.resumo}`;
      return termosDoTexto(texto(html)).length === 0;
    });
    expect(semTermos.map((i) => i.id)).toEqual([]);
  });
});

describe('como saber que deu certo', () => {
  it('descreve as regras em linguagem simples', () => {
    expect(descreverRegra({ saida: 'url', igual: 'x' })).toBe('O output "url" vale "x"');
    expect(descreverRegra({ recurso: 'aws_s3_bucket.b', atributo: 'bucket', igual: 'a' })).toBe('aws_s3_bucket.b.bucket vale "a"');
    expect(descreverRegra({ plano: { criar: 2 } })).toBe('O plano tem 2 to add');
    expect(descreverRegra({ variavel: 'regiao', tipo: 'string' })).toBe('Existe a variável "regiao" do tipo string');
    expect(descreverRegra({ codigo: 'count' })).toBeNull();
    expect(descreverRegra({ codigo: 'count', msg: 'Use count' })).toBe('Use count');
  });
});
