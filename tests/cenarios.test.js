// @vitest-environment happy-dom
// Cenários da trilha: tiles próprios e CC0 em pixel art, decoração pura (o leitor de tela não
// ouve nada), leve e completa.
import { describe, it, expect } from 'vitest';
import { CENARIOS, htmlDoCenario } from '../src/ui/cenarios/index.js';
import { LADO } from '../src/ui/cenarios/pixel.js';
import { TILES_TINY_TOWN } from '../src/ui/cenarios/tiny-town.js';

const IDS = ['canteiro', 'porto', 'ceu', 'cidade'];
const COM_BLOQUEIO = ['canteiro', 'porto', 'ceu'];
const COM_ARVORES_TINY_TOWN = ['canteiro'];
const PESSOAS = ['mestre-de-obras', 'engenheira', 'estivador', 'tecnica', 'operaria'];
const camada = (id, semente) => {
  const div = document.createElement('div');
  div.innerHTML = htmlDoCenario(id, semente);
  return div.firstElementChild;
};
const spriteValido = (s) => s.linhas.length === LADO
  && s.linhas.every((l) => l.length === LADO && [...l].every((ch) => ch === '.' || ch in s.paleta));

describe('cenários', () => {
  it('existem os 4 cenários do site', () => {
    expect(Object.keys(CENARIOS).sort()).toEqual([...IDS].sort());
  });

  it('usa os pixels CC0 originais do Tiny Town apenas em cenário compatível', () => {
    expect(TILES_TINY_TOWN.map((s) => s.linhas.join('\n'))).toEqual([
      [
        '.aaabcccbbbbaaa.', '.aacbcbcbbbbcaa.', '.aacbcccbbbbcaa.', '.aacbbbbbbbbcaa.',
        'aaacbbbbbbbbcaa.', 'aabccbbbbbbccaa.', 'aaaccccccccccaa.', '.aaccccccccccaa.',
        '.aaccccccccccaa.', '.aaaccccccccaaa.', '..aaaaccccaaaa..', '...aaaaddaaaa...',
        '.....aaeeaa.....', '.....aaeeaa.....', '.....aaeeaa.....', '................',
      ].join('\n'),
      [
        '................', '................', '..aaaaa.........', '.aaaaaaa........',
        'aaabbbaaa.......', 'aabbbbcaaaaaaa..', 'aabccccaaaaaaaa.', 'aaccaccaaabbbaaa',
        'aaaaaccaacbbbbaa', '.aaaaccaaccccbaa', '...aaccaaccaccaa', '...aaccaaccaaaaa',
        '...aaccaaccaaaa.', '...aaccaa.......', '................', '................',
      ].join('\n'),
    ]);
    for (const id of IDS) {
      const usaTilesCC0 = CENARIOS[id].objetos.some((obj) => TILES_TINY_TOWN.includes(obj));
      expect(usaTilesCC0, id).toBe(COM_ARVORES_TINY_TOWN.includes(id));
    }
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
    expect(spriteValido(c.casa)).toBe(true);
    for (const p of c.personagens) expect(['pessoa', 'animal']).toContain(p.tipo);
  });

  it('quem é pessoa em cada cenário', () => {
    const pessoas = Object.values(CENARIOS).flatMap((c) => c.personagens.filter((p) => p.tipo === 'pessoa').map((p) => p.id)).sort();
    expect(pessoas).toEqual(PESSOAS.sort());
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

  it('a camada leva os exercícios feitos (a vila sai deles)', () => {
    expect(camada(IDS[0], 'basico').dataset.feitos).toBe('0');
    const div = document.createElement('div');
    div.innerHTML = htmlDoCenario(IDS[0], 'basico', 7);
    expect(div.firstElementChild.dataset.feitos).toBe('7');
  });

  it('id desconhecido não quebra a trilha', () => {
    expect(htmlDoCenario('inventado')).toBe('');
    expect(htmlDoCenario(undefined)).toBe('');
  });
});
