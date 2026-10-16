// @vitest-environment happy-dom
// Página "Quem é o instrutor?" e apoio via PIX (BR Code do Banco Central e QR Code).
import { describe, it, expect, afterEach } from 'vitest';
import { PIX, apoioDisponivel, codigoPix, crc16, semAcentos, svgQrCode } from '../src/apoio.js';
import { INSTRUTOR } from '../src/instrutor.js';
import { renderInstrutor, secaoInstrutor } from '../src/ui/instrutor.js';
import { renderLanding } from '../src/ui/landing.js';
import { lerRota } from '../src/compartilhar.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CHAVE_TESTE = '123e4567-e89b-42d3-a456-426614174000';

/** Lê os campos EMV de um BR Code: { id: valor }, com os subcampos do 26 e do 62. */
function campos(texto) {
  const lidos = {};
  for (let i = 0; i < texto.length;) {
    const id = texto.slice(i, i + 2);
    const tamanho = Number(texto.slice(i + 2, i + 4));
    lidos[id] = texto.slice(i + 4, i + 4 + tamanho);
    i += 4 + tamanho;
  }
  return lidos;
}

describe('PIX copia e cola (BR Code)', () => {
  const original = PIX.chave;
  afterEach(() => { PIX.chave = original; });

  it('CRC16-CCITT confere com o valor de referência', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('monta os campos do padrão e termina com o CRC certo', () => {
    const codigo = codigoPix({ ...PIX, chave: CHAVE_TESTE });
    const c = campos(codigo);
    expect(c['00']).toBe('01');
    expect(campos(c['26'])).toEqual({ '00': 'br.gov.bcb.pix', '01': CHAVE_TESTE, '02': 'Apoio Sertao sera cloud' });
    expect(c['52']).toBe('0000');
    expect(c['53']).toBe('986');
    expect(c['58']).toBe('BR');
    expect(c['59'].length).toBeLessThanOrEqual(25);
    expect(c['60'].length).toBeLessThanOrEqual(15);
    expect(campos(c['62'])).toEqual({ '05': '***' });
    expect(c['54']).toBeUndefined(); // sem valor: quem apoia escolhe no app
    expect(codigo.slice(-4)).toBe(crc16(codigo.slice(0, -4)));
  });

  it('valor opcional com duas casas decimais', () => {
    expect(campos(codigoPix({ ...PIX, chave: CHAVE_TESTE, valor: 10 }))['54']).toBe('10.00');
  });

  it('nome e cidade sem acentos e no tamanho máximo', () => {
    expect(semAcentos('Cláudio Filipe Lima Rapôso', 25)).toBe('Claudio Filipe Lima Rapos');
    expect(semAcentos('Florianópolis', 15)).toBe('Florianopolis');
  });

  it('QR Code em SVG, preto no branco', () => {
    const svg = svgQrCode(codigoPix({ ...PIX, chave: CHAVE_TESTE }), { rotulo: 'QR' });
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 (\d+) \1"/);
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('aria-label="QR"');
  });

  it('só aparece com uma chave aleatória válida', () => {
    PIX.chave = '';
    expect(apoioDisponivel()).toBe(false);
    PIX.chave = 'nao-e-uuid';
    expect(apoioDisponivel()).toBe(false);
    PIX.chave = CHAVE_TESTE;
    expect(apoioDisponivel()).toBe(true);
  });
});

describe('página do instrutor', () => {
  const original = PIX.chave;
  afterEach(() => { PIX.chave = original; });

  it('rotas #/instrutor e #/apoie', () => {
    expect(lerRota('#/instrutor')).toEqual({ tela: 'instrutor' });
    expect(lerRota('#/apoie')).toEqual({ tela: 'instrutor', ancora: 'apoie' });
  });

  it('mostra o perfil, a atuação e os reconhecimentos', () => {
    document.body.innerHTML = '<main id="tela"></main>';
    renderInstrutor(document.getElementById('tela'));
    const texto = document.getElementById('tela').textContent;
    expect(texto).toContain('Quem é o instrutor?');
    expect(texto).toContain('Cláudio Filipe Lima Rapôso');
    expect(document.querySelector('.links-instrutor a[href="https://mentoria.sertaoseracloud.com/"]')).not.toBeNull();
    expect(document.querySelector('.caixa-apoio a[href="https://github.com/sertaoseracloud/terraform-playground"]').textContent).toContain('estrela');
    for (const r of INSTRUTOR.reconhecimentos) expect(texto).toContain(r.nome);
    expect(texto).toContain('NTT DATA');
    expect(document.querySelectorAll('.linha-atuacao li')).toHaveLength(INSTRUTOR.atuacao.length);
  });

  it('mostra a foto, servida pelo próprio site (public/), com texto alternativo', () => {
    document.body.innerHTML = '<main id="tela"></main>';
    renderInstrutor(document.getElementById('tela'));
    const foto = document.querySelector('.avatar-instrutor img');
    expect(foto.getAttribute('src')).toBe(INSTRUTOR.foto);
    expect(foto.getAttribute('alt')).toBe(`Foto de ${INSTRUTOR.nome}`);
    expect(existsSync(resolve(process.cwd(), 'public', INSTRUTOR.foto))).toBe(true);
  });

  it('não publica telefone nem endereço do currículo', () => {
    const tudo = JSON.stringify(INSTRUTOR);
    expect(tudo).not.toMatch(/\(?\d{2}\)?\s?9?\d{4}-?\d{4}/);
    expect(tudo).not.toMatch(/Endereço|Telefone/i);
  });

  it('com a chave: QR Code e copia e cola, com botão de copiar', async () => {
    PIX.chave = CHAVE_TESTE;
    document.body.innerHTML = '<main id="tela"></main>';
    renderInstrutor(document.getElementById('tela'), { ancora: 'apoie' });
    const codigo = document.getElementById('codigo-pix');
    expect(codigo.value).toBe(codigoPix({ ...PIX, chave: CHAVE_TESTE }));
    expect(document.querySelector('.qr-pix svg')).not.toBeNull();
    let copiado = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { copiado = t; } }, configurable: true });
    await document.getElementById('btn-copiar-pix').onclick();
    expect(copiado).toBe(codigo.value);
    expect(document.getElementById('aviso-copia-pix').textContent).toContain('copiado');
  });

  it('sem a chave: o apoio aparece como "em breve", sem QR Code', () => {
    PIX.chave = '';
    document.body.innerHTML = '<main id="tela"></main>';
    renderInstrutor(document.getElementById('tela'));
    expect(document.getElementById('apoie').textContent).toContain('Em breve');
    expect(document.querySelector('.qr-pix')).toBeNull();
  });

  it('a landing tem a seção "Quem é o instrutor?" e os links no rodapé', () => {
    const el = { innerHTML: '' };
    renderLanding(el);
    expect(el.innerHTML).toContain(secaoInstrutor().trim().slice(0, 60));
    expect(el.innerHTML).toContain('href="#/instrutor"');
    expect(el.innerHTML).toContain('href="#/apoie"');
  });
});
