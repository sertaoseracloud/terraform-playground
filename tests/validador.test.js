// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  codificarCertificado, decodificarCertificado, extrairCodigo, validarImpresso, montarCadeia, linkPublico, SITE,
  certificadoXml, lerCertificadoXml, cadeiaCoerente, mensagemAssinada, conferirAssinaturas,
} from '../src/certificados.js';
import { CHAVE_PUBLICA } from '../src/ed25519.js';
import { createPublicKey, verify } from 'node:crypto';
import { resultadoDoLink, resultadoDoImpresso, resultadoDoXml, renderValidador } from '../src/ui/validador.js';
import { lerRota } from '../src/compartilhar.js';

const PHP = { nome: 'Maria da Conceição', modulo: 'azure', data: '2026-10-12', cadeia: ['2026-10-01', '2026-10-05'] };
const HTML = { nome: 'Maria da Conceição', modulo: 'basico', data: '2026-10-01' };

describe('extrairCodigo', () => {
  const codigo = codificarCertificado(PHP);
  it.each([
    ['link do certificado', `${SITE}#/certificado/${codigo}`],
    ['link do badge do LinkedIn', linkPublico(PHP)],
    ['link do validador', `${SITE}#/validar/${codigo}`],
    ['só o código, com espaços', `  ${codigo}  `],
  ])('%s', (_nome, texto) => {
    expect(extrairCodigo(texto)).toBe(codigo);
  });

  it('texto que não é certificado', () => {
    expect(extrairCodigo('olá, tudo bem?')).toBeNull();
    expect(extrairCodigo('')).toBeNull();
  });
});

describe('validar pelo link', () => {
  it('certificado válido mostra aluno e a cadeia', () => {
    const html = resultadoDoLink(`${SITE}#/certificado/${codificarCertificado(PHP)}`);
    expect(html).toContain('Certificado válido');
    expect(html).toContain('Maria da Conceição');
    expect(html.match(/<li/g)).toHaveLength(3); // básico → AWS → Azure
  });

  it('link alterado é inválido', () => {
    const outro = codificarCertificado({ ...PHP, nome: 'Outra Pessoa' });
    const dados = JSON.parse(atob(outro.replace(/-/g, '+').replace(/_/g, '/')));
    const original = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(codificarCertificado(PHP).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
    // selo da Maria com o nome de outra pessoa
    const adulterado = btoa(unescape(encodeURIComponent(JSON.stringify({ ...original, n: dados.n })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(resultadoDoLink(adulterado)).toContain('Certificado inválido');
  });

  it('texto sem certificado', () => {
    expect(resultadoDoLink('qualquer coisa')).toContain('Não encontrei um certificado');
  });
});

describe('validar certificado impresso', () => {
  const elos = montarCadeia(PHP);
  const impressoPhp = { nome: PHP.nome, modulo: 'azure', data: PHP.data, selo: elos[2].hash, anterior: elos[1].hash };

  it('o primeiro da cadeia não precisa de "Anterior"', () => {
    const selo = montarCadeia(HTML)[0].hash;
    expect(validarImpresso({ ...HTML, selo }).valido).toBe(true);
  });

  it('aceita o selo do jeito que está impresso (em grupos, maiúsculas)', () => {
    const emGrupos = impressoPhp.selo.match(/.{16}/g).join(' ').toUpperCase();
    expect(validarImpresso({ ...impressoPhp, selo: emGrupos }).valido).toBe(true);
  });

  it('nome, data ou anterior diferentes não conferem', () => {
    expect(validarImpresso({ ...impressoPhp, nome: 'Maria da Conceicao' }).valido).toBe(false);
    expect(validarImpresso({ ...impressoPhp, data: '2026-10-13' }).valido).toBe(false);
    expect(validarImpresso({ ...impressoPhp, anterior: elos[0].hash }).valido).toBe(false);
  });

  it('avisa o que falta', () => {
    expect(validarImpresso({ ...impressoPhp, anterior: '' }).motivo).toMatch(/Anterior/);
    expect(validarImpresso({ ...impressoPhp, selo: 'abc' }).motivo).toMatch(/64 caracteres/);
    expect(resultadoDoImpresso(impressoPhp)).toContain('Selo confere');
  });
});

describe('página', () => {
  it('rotas #/validar e #/validar/<código>', () => {
    expect(lerRota('#/validar')).toEqual({ tela: 'validar', codigo: '' });
    expect(lerRota('#/validar/abc')).toEqual({ tela: 'validar', codigo: 'abc' });
  });

  it('com código na rota, já mostra o resultado', () => {
    document.body.innerHTML = '<main id="tela"></main>';
    renderValidador(document.getElementById('tela'), codificarCertificado(HTML));
    expect(document.getElementById('saida-link').textContent).toContain('Certificado válido');
    // O básico é o primeiro da cadeia: o campo "Anterior" some quando ele é escolhido
    const form = document.getElementById('form-impresso');
    form.modulo.value = 'basico';
    form.modulo.onchange();
    expect(document.getElementById('rotulo-anterior').hidden).toBe(true);
  });
});

describe('XML do certificado', () => {
  const codigo = codificarCertificado(PHP);
  const xml = certificadoXml(decodificarCertificado(codigo), codigo);

  it('não leva o segredo, a chave do selo nem a semente da assinatura', () => {
    expect(xml).not.toContain('chave-dos-testes'); // chave do HMAC usada nos testes (vitest.config.js)
    expect(xml).not.toContain('01'.repeat(32)); // semente Ed25519 dos testes
    expect(xml.toLowerCase()).not.toMatch(/caf[eé]/);
  });

  it('assinatura Ed25519 confere só com a chave pública, inclusive fora do site (node:crypto)', () => {
    const { xml: dados } = lerCertificadoXml(xml);
    expect(dados.chavePublica).toBe(CHAVE_PUBLICA);
    expect(conferirAssinaturas(dados).todas).toBe(true);
    const chave = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(CHAVE_PUBLICA, 'hex').toString('base64url') }, format: 'jwk' });
    for (const b of dados.blocos) {
      expect(verify(null, Buffer.from(b.mensagem, 'utf8'), chave, Buffer.from(b.assinatura, 'hex'))).toBe(true);
    }
  });

  it('assinatura não confere com mensagem alterada nem com outra chave', () => {
    const { xml: dados } = lerCertificadoXml(xml);
    const alterada = { ...dados, blocos: dados.blocos.map((b) => ({ ...b, mensagem: b.mensagem.replace(PHP.nome, 'Outra') })) };
    expect(conferirAssinaturas(alterada).todas).toBe(false);
    expect(conferirAssinaturas(dados, 'ab'.repeat(32)).chaveConfere).toBe(false);
  });

  it('XML com chave pública trocada é recusado pelo validador', () => {
    expect(resultadoDoXml(xml.replace(CHAVE_PUBLICA, 'cd'.repeat(32)))).toContain('XML alterado');
  });

  it('é XML válido, com os dados, o selo e a cadeia', () => {
    const lido = lerCertificadoXml(xml);
    expect(lido.erro).toBeUndefined();
    const elos = montarCadeia(PHP);
    expect(lido.xml).toMatchObject({ aluno: PHP.nome, modulo: 'azure', data: PHP.data, selo: elos[2].hash, anterior: elos[1].hash });
    expect(lido.xml.blocos.map((b) => b.modulo)).toEqual(['basico', 'aws', 'azure']);
    expect(cadeiaCoerente(lido.xml.blocos)).toBe(true);
    expect(xml).toContain(`<url>${SITE}#/validar/${codigo}</url>`);
  });

  it('a mensagem assinada é exatamente o que o selo cobre', () => {
    expect(mensagemAssinada(PHP, montarCadeia(PHP)[1].hash)).toBe(
      JSON.stringify([PHP.data, 'Cláudio Raposo', 'Sertão será cloud', PHP.nome, 'azure', montarCadeia(PHP)[1].hash]),
    );
  });

  it('outras páginas conferem a cadeia sem a chave', () => {
    const { xml: dados } = lerCertificadoXml(xml);
    const quebrada = dados.blocos.map((b, i) => (i === 1 ? { ...b, selo: '0'.repeat(64) } : b));
    expect(cadeiaCoerente(quebrada)).toBe(false);
  });

  it('o validador aceita o XML e detecta edição no arquivo', () => {
    expect(resultadoDoXml(xml)).toContain('XML e certificado válidos');
    expect(resultadoDoXml(xml.replace(`<aluno>${PHP.nome}</aluno>`, '<aluno>Outra Pessoa</aluno>'))).toContain('XML alterado');
    expect(resultadoDoXml('<html></html>')).toContain('XML inválido');
  });
});

describe('certificado impresso', () => {
  it('tem a rubrica da instituição e não cita o instrutor', async () => {
    const { renderCertificado } = await import('../src/ui/certificado.js');
    document.body.innerHTML = '<main id="tela"></main>';
    renderCertificado(document.getElementById('tela'), codificarCertificado(HTML));
    const impresso = document.querySelector('article.certificado');
    expect(impresso.querySelector('.cert-assinatura svg.rubrica')).not.toBeNull();
    expect(impresso.textContent).toContain('Sertão será cloud');
    expect(impresso.textContent).not.toContain('Cláudio Raposo');
    expect(impresso.textContent).not.toContain('Instrutor responsável');
    expect(impresso.querySelectorAll('.cert-assinatura')).toHaveLength(1);
  });
});

describe('textos para o aluno: simples e sem detalhes da validação', () => {
  const TECNICO = /HMAC|SHA-?256|Ed25519|blockchain|segredo|chave (secreta|pública)|Cláudio Raposo/i;

  it('página do certificado (cartão, explicação e impresso)', async () => {
    const { renderCertificado } = await import('../src/ui/certificado.js');
    document.body.innerHTML = '<main id="tela"></main>';
    renderCertificado(document.getElementById('tela'), codificarCertificado(PHP));
    const texto = document.getElementById('tela').textContent;
    expect(texto).toContain('Como sei que este certificado é verdadeiro?');
    expect(texto).not.toMatch(TECNICO);
  });

  it('resultados do validador', () => {
    const codigo = codificarCertificado(PHP);
    for (const html of [resultadoDoLink(codigo), resultadoDoXml(certificadoXml(decodificarCertificado(codigo), codigo))]) {
      expect(html.replace(/<[^>]+>/g, ' ')).not.toMatch(TECNICO);
    }
  });

  it('landing page', async () => {
    const { renderLanding } = await import('../src/ui/landing.js');
    const el = { innerHTML: '' };
    renderLanding(el);
    expect(el.innerHTML.replace(/<[^>]+>/g, ' ')).not.toMatch(TECNICO);
  });
});
