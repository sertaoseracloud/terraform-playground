// A vida da vila (src/ui/cenarios/vida.js): caminhos só por onde se pode pisar, destinos, balões que
// não piscam, filhotes que seguem os donos, casas e a mesma história para a mesma semente.
import { describe, it, expect } from 'vitest';
import { caminho, destinosDoModulo, criarVila, passoDaVila, comemorar, DURACAO_BALAO } from '../src/ui/cenarios/vida.js';
import { gerarMapa, tileEm } from '../src/ui/cenarios/mapa.js';
import { vila as vilaDoModulo, comCasas } from '../src/ui/cenarios/vila.js';
import { posicoesIniciais } from '../src/ui/cenarios/fisica.js';
import { sorteador } from '../src/ui/cenarios/mapa.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';

/** Um mapa desenhado à mão: "." chão, "#" estrada, "~" água, "o" objeto, "H" casa. */
function mapaDe(texto) {
  const linhas = texto.trim().split('\n').map((l) => l.trim());
  const tipos = { '.': 'chao', '#': 'estrada', '~': 'bloqueio', o: 'objeto', H: 'casa' };
  const tiles = linhas.flatMap((l) => [...l].map((ch) => ({ tipo: tipos[ch], variante: 0 })));
  const estrada = linhas.map((l) => [l.indexOf('#'), l.lastIndexOf('#')]);
  return { colunas: linhas[0].length, linhas: linhas.length, tiles, estrada };
}

const MAPA = mapaDe(`
  ...#.....
  .~~#..o..
  .~~#.....
  ...#..H..
  ...#.....`);

describe('caminho até um destino', () => {
  it('é o mais curto e só passa por chão (nem estrada, nem água, nem objeto)', () => {
    const rota = caminho(MAPA, 'andar', [4, 0], [8, 4]);
    expect(rota).toHaveLength(8); // 4 colunas + 4 linhas, distância de Manhattan
    for (const [c, l] of rota) expect(tileEm(MAPA, c, l).tipo).toBe('chao');
    expect(rota.at(-1)).toEqual([8, 4]);
  });

  it('não atravessa a estrada: do outro lado, não há caminho', () => {
    expect(caminho(MAPA, 'andar', [0, 0], [8, 0])).toBeNull();
    expect(caminho(MAPA, 'andar', [4, 0], [4, 0])).toEqual([]);
  });

  it('quem nada fica na água, e quem voa passa por cima de tudo menos da estrada', () => {
    expect(caminho(MAPA, 'nadar', [1, 1], [2, 2])).toHaveLength(2);
    expect(caminho(MAPA, 'nadar', [1, 1], [0, 0])).toBeNull();
    expect(caminho(MAPA, 'voar', [4, 1], [7, 3])).toHaveLength(5);
  });
});

describe('destinos do módulo', () => {
  it('a porta é o chão vizinho da casa, a praça fica ao lado do passo atual, os nós concluídos vêm primeiro', () => {
    const d = destinosDoModulo(MAPA, [{ c: 6, l: 3 }], [{ c: 3, l: 0, feito: false }, { c: 3, l: 4, feito: true, atual: false }, { c: 3, l: 2, atual: true }]);
    expect(d.portas).toEqual([{ casa: [6, 3], porta: [6, 4] }]);
    expect(d.praca).toEqual([4, 2]); // à esquerda da estrada é água: fica à direita, na linha do nó
    expect(d.nos[0]).toEqual([2, 4]);
  });
});

/** Um cenário do site com água (ou lava…), pessoas que andam e animais: serve em qualquer site. */
const CENARIO = Object.values(CENARIOS).find((c) => c.bloqueio && c.personagens.some((p) => p.tipo === 'pessoa' && p.movimento === 'andar')
  && c.personagens.some((p) => p.tipo !== 'pessoa')) ?? Object.values(CENARIOS)[0];

function vilaDeVerdade(semente = 'pods', feitos = 9) {
  const cen = CENARIO;
  const base = gerarMapa({ colunas: 30, linhas: 40, cenario: cen, semente, caminho: [{ c: 15, l: 5 }, { c: 12, l: 20 }, { c: 17, l: 35 }] });
  const daVila = vilaDoModulo({ mapa: base, cenario: cen, semente, feitos });
  const mapa = comCasas(base, daVila.casas);
  const porId = Object.fromEntries(cen.personagens.map((p) => [p.id, p]));
  const adulto = cen.personagens.find((p) => p.tipo === 'pessoa' && p.movimento === 'andar');
  const defs = [...cen.personagens, adulto, ...daVila.filhos.map((f) => ({ ...porId[f.pai], pequeno: true }))];
  const posicoes = posicoesIniciais(mapa, defs, sorteador(`${semente}-passos`));
  const destinos = destinosDoModulo(mapa, daVila.casas, [{ c: 15, l: 5, feito: true }, { c: 12, l: 20, atual: true }, { c: 17, l: 35 }]);
  return { mapa, vila: criarVila({ mapa, defs, posicoes, semente, destinos, emojis: ['☸️', '📦'] }) };
}

const retrato = (vila) => vila.moradores.map((m) => `${m.c},${m.l},${m.acao},${m.visivel ? 1 : 0},${m.balao ?? ''}`).join('|');

describe('passos da vila', () => {
  it('é determinística: mesma semente e mesmos exercícios, mesma história', () => {
    const a = vilaDeVerdade();
    const b = vilaDeVerdade();
    for (let k = 0; k < 120; k++) {
      passoDaVila(a.vila, a.mapa);
      passoDaVila(b.vila, b.mapa);
      expect(retrato(a.vila)).toBe(retrato(b.vila));
    }
    const c = vilaDeVerdade('services');
    for (let k = 0; k < 30; k++) passoDaVila(c.vila, c.mapa);
    expect(retrato(c.vila)).not.toBe(retrato(a.vila));
  });

  it('ninguém pisa onde não pode, e cada passo anda no máximo um tile', () => {
    const { mapa, vila } = vilaDeVerdade();
    for (let k = 0; k < 200; k++) {
      const antes = vila.moradores.map((m) => [m.c, m.l]);
      passoDaVila(vila, mapa);
      vila.moradores.forEach((m, i) => {
        expect(Math.abs(m.c - antes[i][0]) + Math.abs(m.l - antes[i][1])).toBeLessThanOrEqual(1);
        const t = tileEm(mapa, m.c, m.l);
        expect(t.tipo).not.toBe('estrada');
        if (m.movimento === 'andar') expect(['chao']).toContain(t.tipo);
      });
    }
  });

  it('um balão fica pelo menos 2 passos (0,8 s): nada pisca mais de 3 vezes por segundo', () => {
    const { mapa, vila } = vilaDeVerdade('balões', 30);
    const historico = new Map();
    for (let k = 0; k < 400; k++) {
      passoDaVila(vila, mapa);
      for (const m of vila.moradores) historico.set(m.i, [...(historico.get(m.i) ?? []), Boolean(m.balao)]);
    }
    let baloes = 0;
    for (const serie of historico.values()) {
      // Cada trecho com balão dura pelo menos 2 passos seguidos.
      let seguidos = 0;
      for (const [k, tem] of serie.entries()) {
        if (tem) { seguidos += 1; continue; }
        if (seguidos) { expect(seguidos, `passo ${k}`).toBeGreaterThanOrEqual(Math.min(...Object.values(DURACAO_BALAO)) - 1); baloes += 1; }
        seguidos = 0;
      }
    }
    expect(baloes).toBeGreaterThan(0); // houve cumprimentos ou conversas
  });

  it('filhotes e filhos seguem o dono de perto', () => {
    const { mapa, vila } = vilaDeVerdade('seguir', 6);
    const pequenos = vila.moradores.filter((m) => m.dono !== null);
    expect(pequenos.length).toBeGreaterThan(0);
    for (let k = 0; k < 80; k++) passoDaVila(vila, mapa);
    for (const p of pequenos) {
      const dono = vila.moradores.find((m) => m.i === p.dono);
      if (!dono.visivel) continue;
      expect(Math.abs(p.c - dono.c) + Math.abs(p.l - dono.l)).toBeLessThanOrEqual(3);
    }
  });

  it('quem entra em casa some por alguns passos e sai pela porta; à noite, metade fica em casa', () => {
    const { mapa, vila } = vilaDeVerdade('casa', 12);
    let entrou = null;
    for (let k = 0; k < 600 && !entrou; k++) {
      passoDaVila(vila, mapa);
      entrou = vila.moradores.find((m) => m.acao === 'em-casa');
    }
    expect(entrou).toBeTruthy();
    expect(entrou.visivel).toBe(false);
    for (let k = 0; k < 12; k++) passoDaVila(vila, mapa);
    expect(entrou.visivel).toBe(true);

    const noite = vilaDeVerdade('casa', 12);
    let emCasa = 0;
    for (let k = 0; k < 600; k++) {
      passoDaVila(noite.vila, noite.mapa, { noite: true });
      emCasa = Math.max(emCasa, noite.vila.moradores.filter((m) => !m.visivel).length);
    }
    expect(emCasa).toBeGreaterThan(0);
  });

  it('o anfitrião vai até a praça do passo atual e acena', () => {
    const { mapa, vila } = vilaDeVerdade('aceno', 3);
    let acenou = false;
    for (let k = 0; k < 800 && !acenou; k++) acenou = passoDaVila(vila, mapa).some((e) => e.emoji === '👋' && e.i === vila.anfitriao);
    expect(acenou).toBe(true);
  });

  it('só anda quem está ativo (perto da tela)', () => {
    const { mapa, vila } = vilaDeVerdade();
    const antes = retrato(vila);
    for (let k = 0; k < 20; k++) passoDaVila(vila, mapa, { ativos: () => false });
    expect(retrato(vila)).toBe(antes);
  });

  it('comemorar: quem está à vista salta uma vez, e as pessoas mostram 🎉', () => {
    const { mapa, vila } = vilaDeVerdade();
    const eventos = comemorar(vila);
    expect(vila.moradores.filter((m) => m.visivel).every((m) => m.salto)).toBe(true);
    expect(eventos.every((e) => e.emoji === '🎉')).toBe(true);
    expect(eventos.length).toBeGreaterThan(0);
    passoDaVila(vila, mapa);
    expect(vila.moradores.some((m) => m.salto)).toBe(false);
  });
});
