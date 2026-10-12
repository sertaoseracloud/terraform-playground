import { describe, it, expect } from 'vitest';
import { calcularJornada, sequenciaDeDias, nivelPorXp, XP, NIVEIS, LIMITE_DESBLOQUEIO } from '../src/gamificacao.js';
import { modulos } from '../src/conteudo/trilha.js';

// Trilha pequena e previsível para os testes.
const p = (id, dificuldade = 'facil') => ({ id, tipo: 'problema', dificuldade });
const l = (id) => ({ id, tipo: 'licao' });
const TRILHA = [
  { id: 'a', titulo: 'A', itens: [l('a0'), p('a1'), p('a2'), p('a3', 'medio'), p('a4', 'dificil')] },
  { id: 'b', titulo: 'B', itens: [l('b0'), p('b1'), p('b2')] },
  { id: 'c', titulo: 'C', extra: true, itens: [p('c1')] },
];

const jornada = (status = {}, datas = {}) => calcularJornada({
  modulos: TRILHA,
  statusDe: (id) => status[id],
  dataDe: (id) => datas[id],
});

describe('calcularJornada', () => {
  it('no começo: só o primeiro módulo aberto e o primeiro item é o próximo passo', () => {
    const j = jornada();
    expect(j.modulos.map((m) => m.desbloqueado)).toEqual([true, false, false]);
    expect(j.proximo.id).toBe('a0');
    expect(j.modulos[0].itens[0].estado).toBe('proximo');
    expect(j.modulos[0].itens[1].estado).toBe('disponivel');
    expect(j.modulos[1].itens[1].estado).toBe('bloqueado');
    expect(j.xp).toBe(0);
  });

  it(`o próximo módulo abre quando o anterior chega a ${LIMITE_DESBLOQUEIO}% dos problemas`, () => {
    const metade = jornada({ a1: 'resolvido', a2: 'resolvido' });
    expect(metade.modulos[0].pct).toBe(50);
    expect(metade.modulos[1].desbloqueado).toBe(false);

    const tres = jornada({ a1: 'resolvido', a2: 'resolvido', a3: 'resolvido' });
    expect(tres.modulos[0].pct).toBe(75);
    expect(tres.modulos[1].desbloqueado).toBe(true);
    expect(tres.modulos[2].desbloqueado).toBe(false);
  });

  it('um módulo com progresso nunca volta a bloquear', () => {
    expect(jornada({ b1: 'tentado' }).modulos[1].desbloqueado).toBe(true);
  });

  it('XP por tipo e dificuldade; tentado não conta', () => {
    const j = jornada({ a0: 'resolvido', a1: 'resolvido', a3: 'resolvido', a4: 'resolvido', a2: 'tentado' });
    expect(j.xp).toBe(XP.licao + XP.facil + XP.medio + XP.dificil);
    const tentado = j.modulos[0].itens.find((i) => i.id === 'a2');
    expect(tentado.estado).toBe('tentado');
    expect(tentado.ehProximo).toBe(true);
    expect(j.proximo.id).toBe('a2');
  });

  it('o próximo passo pula o que já foi feito e respeita o bloqueio', () => {
    expect(jornada({ a0: 'resolvido' }).proximo.id).toBe('a1');
    const tudoA = { a0: 'resolvido', a1: 'resolvido', a2: 'resolvido', a3: 'resolvido', a4: 'resolvido' };
    expect(jornada(tudoA).proximo.id).toBe('b0');
  });

  it('módulo concluído com a data da última resolução; final exige todos', () => {
    const tudoA = { a1: 'resolvido', a2: 'resolvido', a3: 'resolvido', a4: 'resolvido' };
    const datas = { a1: '2026-10-01', a2: '2026-10-03', a3: '2026-10-02', a4: '2026-10-02' };
    const j = jornada(tudoA, datas);
    expect(j.modulos[0].concluido).toBe(true);
    expect(j.modulos[0].concluidoEm).toBe('2026-10-03');
    expect(j.final.concluido).toBe(false);

    const tudo = { ...tudoA, a0: 'resolvido', b0: 'resolvido', b1: 'resolvido', b2: 'resolvido', c1: 'resolvido' };
    const fim = jornada(tudo, { ...datas, b1: '2026-10-05', b2: '2026-10-04', c1: '2026-10-07' });
    expect(fim.final).toEqual({ concluido: true, concluidoEm: '2026-10-07' });
    expect(fim.proximo).toBeNull();
  });
});

describe('níveis e sequência', () => {
  it('nível pelo XP, com progresso até o próximo', () => {
    expect(nivelPorXp(0)).toMatchObject({ numero: 1, nome: NIVEIS[0].nome, pct: 0 });
    const n = nivelPorXp(NIVEIS[1].xp + (NIVEIS[2].xp - NIVEIS[1].xp) / 2);
    expect(n).toMatchObject({ numero: 2, nome: NIVEIS[1].nome, pct: 50 });
    expect(nivelPorXp(999999)).toMatchObject({ numero: NIVEIS.length, pct: 100 });
  });

  it('o último nível é alcançável com a trilha real', () => {
    const tudo = calcularJornada({ modulos, statusDe: () => 'resolvido', dataDe: () => '2026-10-11' });
    expect(tudo.xp).toBeGreaterThanOrEqual(NIVEIS.at(-1).xp);
    expect(tudo.final.concluido).toBe(true);
  });

  it('sequência de dias seguidos (vale até ontem)', () => {
    expect(sequenciaDeDias([], '2026-10-11')).toBe(0);
    expect(sequenciaDeDias(['2026-10-09', '2026-10-10', '2026-10-11'], '2026-10-11')).toBe(3);
    expect(sequenciaDeDias(['2026-10-09', '2026-10-10'], '2026-10-11')).toBe(2);
    expect(sequenciaDeDias(['2026-10-08', '2026-10-10', '2026-10-11'], '2026-10-11')).toBe(2);
    expect(sequenciaDeDias(['2026-10-01'], '2026-10-11')).toBe(0);
    expect(sequenciaDeDias(['2026-02-28', '2026-03-01'], '2026-03-01')).toBe(2);
  });
});
