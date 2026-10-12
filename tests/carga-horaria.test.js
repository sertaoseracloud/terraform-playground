// @vitest-environment happy-dom
// Carga horária: cada certificado vale as horas das atividades do módulo (mínimo 1 hora)
// e aparece no certificado, no post, no XML, no validador e na página do badge.
import { describe, it, expect } from 'vitest';
import { modulos } from '../src/conteudo/trilha.js';
import { CERTIFICADOS, ORDEM, codificarCertificado, certificadoXml, decodificarCertificado, textoPublicacao, anteriores } from '../src/certificados.js';
import { CARGA_MINIMA_HORAS, MINUTOS_POR_ATIVIDADE, horasDosItens, minutosDoItem, textoHoras } from '../src/cargaHoraria.js';
import { resultadoDoLink } from '../src/ui/validador.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODULOS = ORDEM.filter((id) => id !== 'final');
const datas = (id) => anteriores(id).map((_, i) => `2026-10-0${i + 1}`);
const cert = (id) => ({ nome: 'Maria da Conceição', modulo: id, data: '2026-10-12', cadeia: datas(id) });

describe('carga horária', () => {
  it('estimativa por atividade: lição e exercícios por dificuldade', () => {
    expect(minutosDoItem({ tipo: 'licao' })).toBe(MINUTOS_POR_ATIVIDADE.licao);
    expect(minutosDoItem({ tipo: 'problema', dificuldade: 'dificil' })).toBe(MINUTOS_POR_ATIVIDADE.dificil);
    expect(minutosDoItem({ tipo: 'livre' })).toBe(0);
  });

  it('nenhuma atividade certificada vale menos de 1 hora', () => {
    expect(CARGA_MINIMA_HORAS).toBe(1);
    expect(horasDosItens([])).toBe(1);
    expect(horasDosItens([{ tipo: 'licao' }])).toBe(1);
    expect(horasDosItens(Array.from({ length: 5 }, () => ({ tipo: 'problema', dificuldade: 'medio' })))).toBe(3); // 150 min
    for (const id of ORDEM) expect(CERTIFICADOS[id].cargaHoraria).toBeGreaterThanOrEqual(1);
  });

  it.each(MODULOS)('%s: a carga do certificado bate com as atividades do módulo', (id) => {
    const modulo = modulos.find((m) => m.id === id);
    // Se o conteúdo mudou, revise a cargaHoraria em src/certificados.js.
    expect(CERTIFICADOS[id].cargaHoraria).toBe(horasDosItens(modulo.itens));
  });

  it('o certificado final soma todos os módulos', () => {
    expect(CERTIFICADOS.final.cargaHoraria).toBe(MODULOS.reduce((s, id) => s + CERTIFICADOS[id].cargaHoraria, 0));
  });

  it('texto em horas', () => {
    expect(textoHoras(1)).toBe('1 hora');
    expect(textoHoras(23)).toBe('23 horas');
  });
});

describe('carga horária onde o certificado aparece', () => {
  const id = MODULOS[1];
  const horas = textoHoras(CERTIFICADOS[id].cargaHoraria);

  it('página do certificado: cartão do badge e documento impresso', async () => {
    const { renderCertificado } = await import('../src/ui/certificado.js');
    document.body.innerHTML = '<main id="tela"></main>';
    renderCertificado(document.getElementById('tela'), codificarCertificado(cert(id)));
    expect(document.querySelector('.badge-dados').textContent).toContain(horas);
    expect(document.querySelector('article.certificado .cert-texto').textContent).toContain(`carga horária de ${horas}`);
    expect(document.querySelector('article.certificado .cert-carga').textContent).toBe(`Carga horária: ${horas}`);
  });

  it('post do LinkedIn', () => {
    expect(textoPublicacao(cert(id), 'https://x')).toContain(`Carga horária: ${horas}.`);
    expect(textoPublicacao(cert('final'), 'https://x')).toContain(`carga horária de ${textoHoras(CERTIFICADOS.final.cargaHoraria)}`);
  });

  it('XML e validador', () => {
    const codigo = codificarCertificado(cert(id));
    expect(certificadoXml(decodificarCertificado(codigo), codigo)).toContain(`<cargaHoraria unidade="horas">${CERTIFICADOS[id].cargaHoraria}</cargaHoraria>`);
    expect(resultadoDoLink(codigo)).toContain(`<dt>Carga horária</dt><dd>${horas}</dd>`);
  });

  it('página do badge (prévia do LinkedIn), gerada por npm run badges', () => {
    const pagina = readFileSync(resolve(process.cwd(), `public/badge/${id}/index.html`), 'utf8');
    expect(pagina).toContain(`Carga horária: ${horas}.`);
  });
});
