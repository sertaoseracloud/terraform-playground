// @vitest-environment happy-dom
// Restaurar o progresso pelo certificado: o que volta, a regra do nome e a ida e volta
// (restaurar num navegador vazio e emitir de novo o mesmo certificado).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ORDEM, anteriores, codificarCertificado, decodificarCertificado, CERTIFICADOS } from '../src/certificados.js';
import { modulos } from '../src/conteudo/trilha.js';
import { planoDeRestauracao, situacaoDoNome, itensDoPlano } from '../src/restaurar.js';
import { restaurarItens, statusDe, dataDe, marcar, diasAtivos } from '../src/progresso.js';
import { certificadosDaJornada } from '../src/ui/inicio.js';

const NOME = 'Maria da Conceição';
const dia = (n) => `2026-10-${String(n).padStart(2, '0')}`;

/** Certificado emitido de verdade (com a chave dos testes): cadeia em dias seguidos. */
function emitido(modulo, nome = NOME) {
  const cadeia = anteriores(modulo).map((_, i) => dia(i + 1));
  // O final é concluído no dia do último módulo (a data dele é a mais recente dos módulos).
  const data = modulo === 'final' ? cadeia.at(-1) : dia(cadeia.length + 1);
  const codigo = codificarCertificado({ nome, modulo, data, cadeia });
  return { codigo, cert: decodificarCertificado(codigo) };
}

const reemitido = (cert, modulo) => {
  const c = certificadosDaJornada().find((x) => x.id === modulo);
  return { liberado: c.liberado, codigo: codificarCertificado({ nome: cert.nome, modulo, data: c.data, cadeia: c.cadeia }) };
};

beforeEach(() => localStorage.clear());

describe('planoDeRestauracao', () => {
  it('um bloco por módulo da cadeia, com os itens e a data de cada um', () => {
    const { cert } = emitido(ORDEM.at(-1));
    const plano = planoDeRestauracao(cert, modulos);
    const comItens = ORDEM.filter((id) => modulos.some((m) => m.id === id));
    expect(plano.map((b) => b.modulo)).toEqual(comItens); // o final não traz itens
    for (const b of plano) {
      const m = modulos.find((x) => x.id === b.modulo);
      expect(b.titulo).toBe(CERTIFICADOS[b.modulo].titulo);
      expect(b.ids).toEqual(m.itens.map((i) => i.id));
      expect(b.exercicios).toBe(m.itens.filter((i) => i.tipo === 'problema').length);
      expect(b.licoes).toBe(m.itens.filter((i) => i.tipo === 'licao').length);
    }
    expect(plano[0].data).toBe(dia(1));
  });

  it('o primeiro certificado da trilha devolve só o próprio módulo', () => {
    const { cert } = emitido(ORDEM[0]);
    expect(planoDeRestauracao(cert, modulos).map((b) => b.modulo)).toEqual([ORDEM[0]]);
  });

  it('itensDoPlano: cada id com a data do seu módulo', () => {
    const plano = [{ modulo: 'a', data: dia(1), ids: ['x', 'y'] }, { modulo: 'b', data: dia(2), ids: ['z'] }];
    expect(itensDoPlano(plano)).toEqual([{ id: 'x', data: dia(1) }, { id: 'y', data: dia(1) }, { id: 'z', data: dia(2) }]);
  });
});

describe('situacaoDoNome', () => {
  it('sem nome, nome igual (espaços nas pontas não contam) e nome diferente (acento e maiúscula contam)', () => {
    const cert = { nome: 'Conceição' };
    expect(situacaoDoNome(cert, '')).toBe('sem-nome');
    expect(situacaoDoNome(cert, '   ')).toBe('sem-nome');
    expect(situacaoDoNome(cert, null)).toBe('sem-nome');
    expect(situacaoDoNome(cert, '  Conceição ')).toBe('pode');
    expect(situacaoDoNome({ nome: ' Conceição ' }, 'Conceição')).toBe('pode');
    expect(situacaoDoNome(cert, 'Conceicao')).toBe('nome-diferente');
    expect(situacaoDoNome(cert, 'conceição')).toBe('nome-diferente');
  });
});

describe('restaurarItens', () => {
  it('marca como resolvido na data dada, sobrescreve a data e não mexe no resto nem na 🔥', () => {
    const [m1, m2] = modulos;
    const [a, b] = m1.itens;
    const outro = m2.itens[0].id;
    marcar(a.id, 'resolvido'); // hoje
    marcar(outro, 'tentado');
    // Zera a atividade que o marcar criou, para ver que restaurar não a recria (sem citar o nome do repo).
    const prefixo = Object.keys(localStorage).find((k) => k.endsWith(':progresso')).replace('progresso', '');
    localStorage.removeItem(`${prefixo}atividade`);
    expect(restaurarItens([{ id: a.id, data: dia(1) }, { id: b.id, data: dia(1) }])).toBe(true);
    expect(statusDe(a.id)).toBe('resolvido');
    expect(dataDe(a.id)).toBe(dia(1));
    expect(statusDe(b.id)).toBe('resolvido');
    expect(statusDe(outro)).toBe('tentado');
    expect(diasAtivos()).toEqual([]);
  });

  it('sem armazenamento, devolve false', () => {
    // Na instância: o happy-dom guarda o setItem já usado, então trocar o protótipo não basta.
    const bloqueio = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    try {
      expect(restaurarItens([{ id: modulos[0].itens[0].id, data: dia(1) }])).toBe(false);
    } finally {
      bloqueio.mockRestore();
    }
  });
});

describe('ida e volta: restaurar e emitir de novo o mesmo certificado', () => {
  it.each(ORDEM)('%s', (modulo) => {
    const { codigo, cert } = emitido(modulo);
    expect(cert.selo).toBe('confere');
    expect(restaurarItens(itensDoPlano(planoDeRestauracao(cert, modulos)))).toBe(true);
    expect(reemitido(cert, modulo)).toEqual({ liberado: true, codigo });
  });

  it('com um exercício do primeiro módulo já resolvido hoje (data mais nova), o certificado sai igual', () => {
    const modulo = ORDEM[1];
    const primeiro = modulos.find((m) => m.id === ORDEM[0]).itens.find((i) => i.tipo === 'problema');
    marcar(primeiro.id, 'resolvido');
    const { codigo, cert } = emitido(modulo);
    restaurarItens(itensDoPlano(planoDeRestauracao(cert, modulos)));
    expect(reemitido(cert, modulo)).toEqual({ liberado: true, codigo });
  });
});
