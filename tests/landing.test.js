// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderLanding, numerosDaTrilha } from '../src/ui/landing.js';
import { modulos, problemas } from '../src/conteudo/trilha.js';

describe('landing page', () => {
  beforeEach(() => localStorage.clear());

  it('os números vêm do conteúdo da trilha', () => {
    const n = numerosDaTrilha();
    expect(n.exercicios).toBe(problemas.length);
    expect(n.modulos).toBe(modulos.length);
    expect(n.projetos).toBe(8);
    expect(n.certificados).toBe(modulos.length + 1);
  });

  it('mostra todos os módulos, os badges e leva para a trilha', () => {
    const el = document.createElement('main');
    renderLanding(el);
    expect(el.querySelectorAll('.modulo-card')).toHaveLength(modulos.length);
    expect(el.querySelectorAll('.vitrine-badges svg')).toHaveLength(modulos.length + 1);
    expect(el.querySelector('.hero-acoes a').getAttribute('href')).toBe('/trilha/');
    expect(el.querySelector('a[href="/privacidade/"]')).not.toBeNull();
  });

  it('quem já começou vê "Continuar"', () => {
    localStorage.setItem('terraform-playground:progresso', JSON.stringify({ [problemas[0].id]: 'resolvido' }));
    const el = document.createElement('main');
    renderLanding(el);
    expect(el.querySelector('.hero-acoes a').textContent).toContain('Continuar');
  });
});

describe('contagem do progresso', () => {
  beforeEach(() => localStorage.clear());

  it('conta exercícios e lições separados, como o caminho mostra', async () => {
    const { resumoProgresso } = await import('../src/ui/inicio.js');
    const { itens } = await import('../src/conteudo/trilha.js');
    const licao = itens.find((i) => i.tipo === 'licao');
    const exercicios = itens.filter((i) => i.tipo === 'problema').slice(0, 2);
    const prog = Object.fromEntries([licao, ...exercicios].map((i) => [i.id, 'resolvido']));
    localStorage.setItem('terraform-playground:progresso', JSON.stringify(prog));
    expect(resumoProgresso()).toMatchObject({ resolvidos: 2, licoesLidas: 1 });
  });
});

describe('certificados na trilha (regra da cadeia)', () => {
  beforeEach(() => localStorage.clear());

  it('módulo concluído sem o certificado anterior fica em espera', async () => {
    const { certificadosDaJornada } = await import('../src/ui/inicio.js');
    const { modulos } = await import('../src/conteudo/trilha.js');
    // AWS completo, Terraform básico não: o certificado de AWS espera o do básico.
    const w3 = modulos.find((m) => m.id === 'aws');
    const prog = Object.fromEntries(w3.itens.filter((i) => i.tipo === 'problema').map((i) => [i.id, 'resolvido']));
    localStorage.setItem('terraform-playground:progresso', JSON.stringify(prog));
    const certs = certificadosDaJornada();
    const cw3 = certs.find((c) => c.id === 'aws');
    expect(cw3).toMatchObject({ concluido: true, liberado: false, falta: 'basico' });
    expect(certs.find((c) => c.id === 'basico').liberado).toBe(false);
  });

  it('com o básico e a AWS concluídos, os dois saem, e o da AWS leva a data do básico', async () => {
    const { certificadosDaJornada } = await import('../src/ui/inicio.js');
    const { modulos } = await import('../src/conteudo/trilha.js');
    const ids = modulos.filter((m) => ['basico', 'aws'].includes(m.id))
      .flatMap((m) => m.itens.filter((i) => i.tipo === 'problema').map((i) => i.id));
    localStorage.setItem('terraform-playground:progresso', JSON.stringify(Object.fromEntries(ids.map((id) => [id, 'resolvido']))));
    const certs = certificadosDaJornada();
    const [html, w3] = certs;
    expect(html.liberado && w3.liberado).toBe(true);
    expect(w3.cadeia).toEqual([html.data]);
  });
});
