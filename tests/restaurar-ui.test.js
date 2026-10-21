// @vitest-environment happy-dom
// O bloco "Restaurar o progresso" no validador: só com selo válido, só com o nome igual.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ORDEM, anteriores, codificarCertificado, decodificarCertificado, certificadoXml } from '../src/certificados.js';
import { renderValidador, resultadoDoXml } from '../src/ui/validador.js';
import { gravarNome, statusDe } from '../src/progresso.js';
import { modulos } from '../src/conteudo/trilha.js';

const NOME = 'Maria da Conceição';
const MODULO = ORDEM[1];
const codigo = codificarCertificado({ nome: NOME, modulo: MODULO, data: '2026-10-02', cadeia: anteriores(MODULO).map(() => '2026-10-01') });

function abrir(texto = codigo, opcoes) {
  document.body.innerHTML = '<main id="tela"></main><div id="anuncio" aria-live="polite"></div>';
  renderValidador(document.getElementById('tela'), texto, opcoes);
  return document.querySelector('#resultado-inicial .restaurar-progresso');
}

beforeEach(() => localStorage.clear());

describe('restaurar o progresso no validador', () => {
  it('selo que não confere: sem bloco', () => {
    const dados = JSON.parse(Buffer.from(codigo, 'base64url').toString());
    const alterado = Buffer.from(JSON.stringify({ ...dados, d: '2026-10-03' })).toString('base64url');
    gravarNome(NOME);
    expect(abrir(alterado)).toBeNull();
    expect(document.getElementById('resultado-inicial').textContent).toContain('Certificado inválido');
  });

  it('sem nome salvo: explica e oferece salvar o nome, sem botão de restaurar', () => {
    const bloco = abrir();
    expect(bloco.textContent).toContain('exatamente como está no certificado');
    expect(bloco.querySelector('[data-nome-restaurar]')).not.toBeNull();
    expect(bloco.querySelector('[data-restaurar]')).toBeNull();
  });

  it('nome diferente (acento): mostra os dois nomes, sem botão de restaurar', () => {
    gravarNome('Maria da Conceicao');
    const bloco = abrir();
    expect(bloco.textContent).toContain(NOME);
    expect(bloco.textContent).toContain('Maria da Conceicao');
    expect(bloco.querySelector('[data-restaurar]')).toBeNull();
  });

  it('nome igual: lista os módulos, restaura, anuncia e avisa o topo', async () => {
    gravarNome(NOME);
    let avisado = 0;
    const bloco = abrir(codigo, { aoRestaurar: () => { avisado += 1; } });
    expect(bloco.querySelectorAll('li')).toHaveLength(2);
    bloco.querySelector('[data-restaurar]').click();
    await new Promise((r) => setTimeout(r, 120));
    const ids = modulos.filter((m) => [ORDEM[0], MODULO].includes(m.id)).flatMap((m) => m.itens.map((i) => i.id));
    expect(ids.every((id) => statusDe(id) === 'resolvido')).toBe(true);
    expect(avisado).toBe(1);
    const depois = document.querySelector('#resultado-inicial .restaurar-progresso');
    expect(depois.querySelector('a[href="/trilha/"]')).not.toBeNull();
    expect(document.activeElement).toBe(depois.querySelector('a[href="/trilha/"]'));
    expect(document.getElementById('anuncio').textContent).toContain('voltaram para este navegador');
  });

  it('a aba "Link ou código" também mostra o bloco', () => {
    gravarNome(NOME);
    abrir('');
    document.getElementById('campo-link').value = codigo;
    document.getElementById('form-link').onsubmit({ preventDefault() {} });
    expect(document.querySelector('#saida-link [data-restaurar]')).not.toBeNull();
  });

  it('o resultado do XML não tem o bloco', () => {
    gravarNome(NOME);
    expect(resultadoDoXml(certificadoXml(decodificarCertificado(codigo)))).not.toContain('restaurar-progresso');
  });

  it('se o navegador não deixa gravar, avisa em vez de confirmar', async () => {
    gravarNome(NOME);
    const bloco = abrir();
    // Na instância: o happy-dom guarda o setItem já usado, então trocar o protótipo não basta.
    const bloqueio = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    try {
      bloco.querySelector('[data-restaurar]').click();
      await new Promise((r) => setTimeout(r, 120));
    } finally {
      bloqueio.mockRestore();
    }
    const depois = document.querySelector('#resultado-inicial .restaurar-progresso');
    expect(depois.textContent).toContain('não deixou o site guardar');
    expect(depois.querySelector('a[href="/trilha/"]')).toBeNull();
  });
});
