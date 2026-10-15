// @vitest-environment happy-dom
// Cenários da trilha: tiles em pixel art (estilo Tibia), decoração pura (o leitor de tela não
// ouve nada), leve e completa.
import { describe, it, expect } from 'vitest';
import { CENARIOS, htmlDoCenario } from '../src/ui/cenarios/index.js';
import { LADO } from '../src/ui/cenarios/pixel.js';

const IDS = ['sertao', 'vale', 'gelo', 'fogo', 'rio', 'cidade', 'jardim'];
const COM_BLOQUEIO = ['sertao', 'vale', 'gelo', 'fogo', 'rio'];
const camada = (id, semente) => {
  const div = document.createElement('div');
  div.innerHTML = htmlDoCenario(id, semente);
  return div.firstElementChild;
};
const spriteValido = (s) => s.linhas.length === LADO
  && s.linhas.every((l) => l.length === LADO && [...l].every((ch) => ch === '.' || ch in s.paleta));

describe('cenários', () => {
  it('existem os 7 cenários', () => {
    expect(Object.keys(CENARIOS).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s: chão, estrada, objetos e 3 personagens de 2 quadros, tudo em 16×16', (id) => {
    const c = CENARIOS[id];
    expect(c.chao.cores).toHaveLength(3);
    expect(c.chao.pesos).toHaveLength(3);
    expect(['terra', 'tabuas', 'pedras', 'liso']).toContain(c.estrada.padrao);
    expect(Boolean(c.bloqueio)).toBe(COM_BLOQUEIO.includes(id));
    expect(c.objetos.length).toBeGreaterThanOrEqual(2);
    expect(c.objetos.every(spriteValido)).toBe(true);
    expect(c.personagens).toHaveLength(3);
    for (const p of c.personagens) {
      expect(['andar', 'voar', 'nadar', 'saltar']).toContain(p.movimento);
      expect(p.quadros).toHaveLength(2);
      expect(p.quadros.every(spriteValido)).toBe(true);
    }
  });

  it.each(IDS)('%s: no máximo 12 KB', (id) => {
    expect(JSON.stringify(CENARIOS[id]).length).toBeLessThanOrEqual(12 * 1024);
  });

  it.each(IDS)('%s: decoração escondida do leitor de tela, sem texto, sem foco e sem ids', (id) => {
    const el = camada(id, 'basico');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.classList.contains(`cenario-${id}`)).toBe(true);
    expect(el.dataset.cenario).toBe(id);
    expect(el.dataset.semente).toBe('basico');
    expect(el.textContent.trim()).toBe('');
    expect(el.querySelector('a, button, input, [tabindex], title, text, [id]')).toBeNull();
    expect(el.querySelector('.cenario-palco')).not.toBeNull();
  });

  it('id desconhecido não quebra a trilha', () => {
    expect(htmlDoCenario('inventado')).toBe('');
    expect(htmlDoCenario(undefined)).toBe('');
  });
});
