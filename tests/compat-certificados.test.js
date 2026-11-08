// Retrocompatibilidade dos certificados já emitidos.
//
// Quem recebeu um certificado guarda um link (`#/certificado/<código>` ou `badge/<módulo>/?c=<código>`)
// e às vezes um PDF com o selo. Esses certificados têm de continuar valendo depois de qualquer
// refatoração, inclusive da migração para TypeScript. Os testes de certificados.test.js só
// conferem a ida e a volta (emitir e validar com o código atual); se o formato mudar dos dois
// lados ao mesmo tempo, eles continuam verdes e todo certificado antigo para de conferir.
//
// Aqui o formato fica congelado em tests/fixtures/certificados-v1.json: vetores gerados pelo
// código de 08/11/2026 com as chaves fictícias dos testes (vitest.config.js), nunca com as de
// produção. Se este teste quebrar, a mudança invalida certificados emitidos: desfaça. Só regere
// os vetores (GERAR_VETORES_CERTIFICADOS=1 npx vitest run tests/compat-certificados.test.js)
// para acrescentar um módulo novo no fim da ORDEM.
import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import {
  ORDEM, anteriores, codificarCertificado, decodificarCertificado, montarCadeia, idCertificado,
  mensagemAssinada, validarImpresso, extrairCodigo, linkCertificado, linkPublico,
} from '../src/certificados.js';
import { assinar, verificar, CHAVE_PUBLICA } from '../src/ed25519.js';

const PASTA = new URL('./fixtures/', import.meta.url);
const ARQUIVO = new URL('./fixtures/certificados-v1.json', import.meta.url);
// Acentos, cedilha e espaço nas pontas de propósito: o nome entra no selo depois do trim.
const NOME = '  Maria José da Conceição  ';
const DATA = '2026-11-08';
const dataDoElo = (i) => `2026-${String((i % 12) + 1).padStart(2, '0')}-15`;
const base64url = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');

function gerarVetores() {
  const certificados = ORDEM.map((modulo, i) => {
    const cadeia = anteriores(modulo).map((_, j) => dataDoElo(j));
    const cert = { nome: NOME, modulo, data: DATA, cadeia };
    const ultimo = montarCadeia(cert).at(-1);
    const mensagem = mensagemAssinada({ nome: NOME, modulo, data: DATA }, ultimo.anterior);
    return {
      modulo,
      posicao: i,
      cadeia,
      codigo: codificarCertificado(cert),
      selo: ultimo.hash,
      anterior: ultimo.anterior,
      id: idCertificado(cert),
      mensagem,
      assinatura: assinar(mensagem),
    };
  });
  return {
    versao: 1,
    gerado: '2026-11-08',
    observacao: 'Chaves fictícias dos testes (vitest.config.js). Não regere para "consertar" uma falha: a falha quer dizer que certificados emitidos deixariam de valer.',
    nome: NOME,
    data: DATA,
    ordem: ORDEM,
    chavePublicaDosTestes: CHAVE_PUBLICA,
    // Link de antes do selo (sem `h`): tem de abrir, marcado como 'ausente'.
    linkSemSelo: base64url({ n: NOME.trim(), m: ORDEM[0], d: '2025-03-10' }),
    certificados,
  };
}

if (process.env.GERAR_VETORES_CERTIFICADOS === '1') {
  if (!existsSync(PASTA)) mkdirSync(PASTA, { recursive: true });
  writeFileSync(ARQUIVO, `${JSON.stringify(gerarVetores(), null, 2)}\n`);
}
const fixo = JSON.parse(readFileSync(ARQUIVO, 'utf8'));

describe('retrocompatibilidade dos certificados emitidos (vetores v1)', () => {
  it('a ORDEM só cresce no fim: reordenar ou renomear módulos quebra a cadeia dos selos', () => {
    expect(ORDEM.slice(0, fixo.ordem.length)).toEqual(fixo.ordem);
  });

  it('as chaves fictícias dos testes são as mesmas (senão os vetores não dizem nada)', () => {
    expect(CHAVE_PUBLICA).toBe(fixo.chavePublicaDosTestes);
  });

  for (const v of fixo.certificados) {
    describe(`${v.modulo} (posição ${v.posicao} da cadeia)`, () => {
      const cert = { nome: fixo.nome, modulo: v.modulo, data: fixo.data, cadeia: v.cadeia };

      it('emitir gera o mesmo código, o mesmo selo e o mesmo id', () => {
        expect(codificarCertificado(cert)).toBe(v.codigo);
        const ultimo = montarCadeia(cert).at(-1);
        expect(ultimo.hash).toBe(v.selo);
        expect(ultimo.anterior).toBe(v.anterior);
        expect(idCertificado(cert)).toBe(v.id);
      });

      it('o link emitido antes continua abrindo, com o selo conferindo', () => {
        const lido = decodificarCertificado(v.codigo);
        expect(lido).toMatchObject({ nome: fixo.nome.trim(), modulo: v.modulo, data: fixo.data, selo: 'confere', id: v.id });
        expect(lido.cadeia.map((e) => e.data)).toEqual(v.cadeia);
      });

      it('o código sai dos dois formatos de link já publicados', () => {
        expect(extrairCodigo(`https://exemplo/${linkCertificado(cert)}`)).toBe(v.codigo);
        expect(extrairCodigo(linkPublico(cert))).toBe(v.codigo);
        expect(extrairCodigo(`https://exemplo/#/validar/${v.codigo}`)).toBe(v.codigo);
      });

      it('o certificado impresso (selo e anterior digitados) continua válido', () => {
        const r = validarImpresso({ nome: fixo.nome, modulo: v.modulo, data: fixo.data, selo: v.selo.toUpperCase(), anterior: v.anterior });
        expect(r.valido).toBe(true);
      });

      it('a mensagem assinada e a assinatura Ed25519 são as mesmas, e a assinatura antiga ainda verifica', () => {
        expect(mensagemAssinada({ nome: fixo.nome, modulo: v.modulo, data: fixo.data }, v.anterior)).toBe(v.mensagem);
        expect(assinar(v.mensagem)).toBe(v.assinatura);
        expect(verificar(v.mensagem, v.assinatura, fixo.chavePublicaDosTestes)).toBe(true);
      });

      it('mudar uma letra do nome invalida o selo (o teste não passa por acaso)', () => {
        const adulterado = JSON.parse(Buffer.from(v.codigo, 'base64url').toString('utf8'));
        adulterado.n = `${adulterado.n}x`;
        expect(decodificarCertificado(base64url(adulterado)).selo).toBe('nao-confere');
      });
    });
  }

  it('o link de antes do selo continua abrindo, marcado como sem selo', () => {
    const lido = decodificarCertificado(fixo.linkSemSelo);
    expect(lido).toMatchObject({ nome: fixo.nome.trim(), modulo: fixo.ordem[0], data: '2025-03-10', selo: 'ausente' });
  });
});
