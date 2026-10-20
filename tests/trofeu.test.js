// @vitest-environment happy-dom
// Botão do troféu (certificado do módulo) e nós da trilha: o nome acessível começa pelo texto visível,
// para quem usa comando de voz poder falar o que vê (WCAG 2.5.3, Rótulo no nome).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderInicio } from '../src/ui/inicio.js';

const textoVisivel = (el) => {
  const copia = el.cloneNode(true);
  copia.querySelectorAll('[aria-hidden="true"], .sr').forEach((n) => n.remove());
  return copia.textContent.replace(/\s+/g, ' ').trim();
};
const nomeAcessivel = (el) => {
  const copia = el.cloneNode(true);
  copia.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return copia.textContent.replace(/\s+/g, ' ').trim();
};

beforeAll(() => {
  localStorage.clear();
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  renderInicio(document.getElementById('tela-inicio'));
});

describe('botões de troféu', () => {
  it('existe um por módulo com certificado', () => {
    expect(document.querySelectorAll('.trofeu button[data-certificado]').length).toBeGreaterThan(0);
  });

  it('não usam aria-label: o nome vem do próprio texto do botão', () => {
    for (const botao of document.querySelectorAll('.trofeu button[data-certificado]')) {
      expect(botao.hasAttribute('aria-label'), botao.dataset.certificado).toBe(false);
    }
  });

  it('o nome acessível começa pelo texto visível e cita o módulo', () => {
    for (const botao of document.querySelectorAll('.trofeu button[data-certificado]')) {
      const visivel = textoVisivel(botao);
      const nome = nomeAcessivel(botao);
      expect(visivel).toMatch(/Certificado/);
      expect(nome.startsWith(visivel), `${nome} / ${visivel}`).toBe(true);
      expect(nome.length).toBeGreaterThan(visivel.length);
    }
  });
});

describe('nós da trilha', () => {
  it('não usam aria-label: o nome começa pelo texto visível (balão e título)', () => {
    const nos = document.querySelectorAll('.trilha .no:not(.trofeu) .alvo');
    expect(nos.length).toBeGreaterThan(0);
    for (const alvo of nos) {
      expect(alvo.hasAttribute('aria-label')).toBe(false);
      const visivel = textoVisivel(alvo);
      expect(nomeAcessivel(alvo).startsWith(visivel), visivel).toBe(true);
    }
  });

  it('o próximo passo mostra o balão no nome do link', () => {
    const proximo = document.querySelector('.trilha .eh-proximo .alvo');
    expect(nomeAcessivel(proximo)).toMatch(/^(COMEÇAR|CONTINUAR) /);
  });
});
