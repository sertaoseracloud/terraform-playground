// Regras do linter: as recomendadas do ESLint, mais algumas que pegam erros
// comuns. Rode `npm run lint` (o CI roda antes dos testes).
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'public/', '.vitest/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      // __CHAVE_CERTIFICADO__, __SEMENTE_ED25519__ e __CHAVE_PUBLICA_ED25519__ são injetadas no build (astro.config.mjs).
      globals: { ...globals.browser, __CHAVE_CERTIFICADO__: 'readonly', __SEMENTE_ED25519__: 'readonly', __CHAVE_PUBLICA_ED25519__: 'readonly', __VERSAO__: 'readonly', __HOMOLOGACAO__: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      // ignoreReadBeforeAssign: o main.js declara a tela antes do motor, que já a lê no construtor.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      'no-implicit-globals': 'error',
    },
  },
  {
    files: ['src/php/worker.js'],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    files: ['tests/**', 'scripts/**', '*.config.js', '*.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
];
