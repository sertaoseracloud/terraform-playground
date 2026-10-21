// E2E no navegador de verdade, contra o dist (npm run build antes): fluxo, axe nos 4 temas
// e larguras de celular. No CI, o Chromium bloqueia; Firefox, WebKit e celular são informativos.
// O site roda no endereço de verdade (/terraform-playground/): os testes abrem caminhos relativos
// a ele ('trilha/', 'p/<id>/').
import { defineConfig, devices } from '@playwright/test';

// PORTA_E2E troca a porta local (padrão 4174), para dois repositórios rodarem os E2E ao mesmo tempo.
const PORTA = process.env.PORTA_E2E || '4174';
const SITE = `http://localhost:${PORTA}/terraform-playground/`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: SITE, trace: 'retain-on-failure' },
  webServer: {
    command: `npx astro preview --port ${PORTA}`,
    url: SITE,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
