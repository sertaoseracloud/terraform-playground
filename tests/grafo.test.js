// @vitest-environment happy-dom
// Grafo de dependências (aba 🕸️ Grafo): níveis, posições e a versão em texto.
import { describe, it, expect, afterEach } from 'vitest';
import { layoutGrafo, desenharGrafo } from '../src/ui/grafo.js';
import { executarTerraform } from '../src/tf/motor.js';

const no = (id, tipo = 'recurso') => ({ id, rotulo: id, tipo });

describe('layoutGrafo', () => {
  it('quem é usado fica à esquerda de quem usa', () => {
    const { pos } = layoutGrafo({
      nos: [no('aws_subnet.a'), no('aws_vpc.main'), no('var.cidr', 'variavel')],
      arestas: [{ de: 'aws_subnet.a', para: 'aws_vpc.main' }, { de: 'aws_vpc.main', para: 'var.cidr' }],
    });
    expect(pos.get('var.cidr').x).toBeLessThan(pos.get('aws_vpc.main').x);
    expect(pos.get('aws_vpc.main').x).toBeLessThan(pos.get('aws_subnet.a').x);
  });

  it('na mesma coluna, variáveis vêm antes dos recursos e ninguém se sobrepõe', () => {
    const { pos } = layoutGrafo({ nos: [no('aws_s3_bucket.b'), no('var.nome', 'variavel'), no('aws_s3_bucket.a')], arestas: [] });
    const ys = ['var.nome', 'aws_s3_bucket.a', 'aws_s3_bucket.b'].map((id) => pos.get(id).y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(new Set(ys).size).toBe(3);
  });

  it('um ciclo não trava o cálculo (o motor é quem acusa o erro)', () => {
    expect(() => layoutGrafo({
      nos: [no('a'), no('b')],
      arestas: [{ de: 'a', para: 'b' }, { de: 'b', para: 'a' }],
    })).not.toThrow();
  });
});

describe('desenharGrafo', () => {
  afterEach(() => document.documentElement.classList.remove('a11y-leitor-tela'));

  const codigo = {
    'main.tf': 'variable "nome" { default = "site" }\nresource "aws_s3_bucket" "site" { bucket = var.nome }\n',
  };

  it('desenha o SVG e a lista em texto com as mesmas dependências', () => {
    const el = document.createElement('div');
    desenharGrafo(el, executarTerraform(codigo, { comando: 'plan', semente: 'grafo' }));
    expect(el.querySelector('svg[role="img"]').getAttribute('aria-label')).toContain('lista em texto');
    expect(el.querySelector('.lista-grafo').textContent).toMatch(/aws_s3_bucket\.site\s*usa\s*var\.nome/);
  });

  it('no modo leitor de tela, a lista em texto já vem aberta', () => {
    document.documentElement.classList.add('a11y-leitor-tela');
    const el = document.createElement('div');
    desenharGrafo(el, executarTerraform(codigo, { comando: 'plan', semente: 'grafo' }));
    expect(el.querySelector('.lista-grafo').open).toBe(true);
  });

  it('sem blocos, explica o que escrever', () => {
    const el = document.createElement('div');
    desenharGrafo(el, { grafo: { nos: [], arestas: [] } });
    expect(el.textContent).toContain('Ainda não há blocos');
  });
});
