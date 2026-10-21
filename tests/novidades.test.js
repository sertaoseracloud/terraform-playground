// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VERSAO, RELEASES, HISTORICO } from '../src/novidades.js';
import { renderNovidades, historicoPorDia } from '../src/ui/novidades.js';
import { lerRota } from '../src/compartilhar.js';

describe('novidades', () => {
  it('versão do site = package.json = release mais recente', () => {
    const pacote = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(VERSAO).toBe(pacote.version);
    expect(RELEASES[0].versao).toBe(VERSAO);
  });

  it('histórico vem do git e agrupa por dia', () => {
    expect(HISTORICO.length).toBeGreaterThan(0);
    const dias = historicoPorDia();
    expect(dias[0][0] >= dias.at(-1)[0]).toBe(true);
  });

  it('página e rota', () => {
    expect(lerRota({ pathname: '/novidades/' })).toEqual({ tela: 'novidades' });
    const el = document.createElement('main');
    renderNovidades(el);
    expect(el.textContent).toContain(`v${VERSAO}`);
    expect(el.querySelectorAll('.lista-historico li').length).toBe(HISTORICO.length);
  });
});
