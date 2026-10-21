import { defineConfig } from 'astro/config';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { chavePublicaDe } from './src/ed25519.js';
import { pluginHistorico, versaoDoPacote } from './scripts/plugin-historico.mjs';

/**
 * Chaves dos certificados. A palavra secreta vem da variável de ambiente
 * CERTIFICADO_SEGREDO (no CI, do secret do GitHub) e nunca entra no código nem no
 * site: o bundle recebe só valores derivados dela (SHA-256 com rótulos diferentes):
 *   - a chave do selo (HMAC-SHA256);
 *   - a semente Ed25519 (assinatura) e a chave pública correspondente.
 * Nunca leia a palavra com import.meta.env nem astro:env: o que uma página lê no build
 * e escreve vira HTML. O scripts/conferir-segredo.mjs confere o dist depois do build.
 * Sem a variável, o build de produção falha; o modo dev usa um valor próprio e os
 * testes têm as chaves deles em vitest.config.js.
 */
const HOMOLOGACAO = process.env.HOMOLOGACAO === '1';
const COMANDO = process.argv.find((a) => ['dev', 'build', 'preview', 'check', 'sync'].includes(a)) ?? 'build';

/** Na homologação (HOMOLOGACAO=1), o segredo é outro: certificado de teste não vale no site principal. */
function segredo() {
  const valor = HOMOLOGACAO ? process.env.CERTIFICADO_SEGREDO_HOMOLOGACAO : process.env.CERTIFICADO_SEGREDO;
  if (valor) return valor;
  // dev, check e preview não publicam nada: um valor próprio basta.
  if (COMANDO !== 'build') return HOMOLOGACAO ? 'segredo-de-homologacao' : 'segredo-de-desenvolvimento';
  if (HOMOLOGACAO) throw new Error('Defina CERTIFICADO_SEGREDO_HOMOLOGACAO para gerar o build de homologação.');
  throw new Error('Defina CERTIFICADO_SEGREDO para gerar o build (veja o README, seção Certificados).');
}
const derivar = (rotulo, valor) => createHash('sha256').update(`terraform-playground:${rotulo}:${valor}`, 'utf8').digest('hex');

const valor = segredo();
const semente = derivar('ed25519', valor);
const chavePublica = chavePublicaDe(semente);

/** Publica a chave pública Ed25519 junto com o site, para quem verifica fora dele. */
const publicarChave = {
  name: 'chave-publica-ed25519',
  hooks: {
    'astro:build:done': ({ dir }) => {
      writeFileSync(new URL('chave-publica-ed25519.txt', dir), `${chavePublica}\n`);
      writeFileSync(new URL('chave-publica-ed25519.json', dir), `${JSON.stringify({
        algoritmo: 'Ed25519',
        emissor: 'Sertão será cloud',
        chavePublicaHex: chavePublica,
        jwk: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(chavePublica, 'hex').toString('base64url') },
      }, null, 2)}\n`);
    },
  },
};

export default defineConfig({
  site: 'https://sertaoseracloud.github.io',
  // Produção em /terraform-playground/ e homologação em /terraform-playground/homologacao/.
  base: HOMOLOGACAO ? '/terraform-playground/homologacao/' : '/terraform-playground/',
  // Uma pasta por página (trilha/index.html): o GitHub Pages serve /trilha/ e /trilha.
  trailingSlash: 'always',
  build: { format: 'directory', assets: 'assets', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  integrations: [publicarChave],
  vite: {
    plugins: [pluginHistorico()],
    define: {
      __CHAVE_CERTIFICADO__: JSON.stringify(derivar('certificado', valor)),
      __SEMENTE_ED25519__: JSON.stringify(semente),
      __CHAVE_PUBLICA_ED25519__: JSON.stringify(chavePublica),
      __VERSAO__: JSON.stringify(versaoDoPacote()),
      __HOMOLOGACAO__: JSON.stringify(HOMOLOGACAO),
    },
    build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  },
});
