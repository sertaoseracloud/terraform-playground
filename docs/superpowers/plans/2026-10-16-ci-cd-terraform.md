# CI/CD unificado, gitflow e homologação — plano 1: terraform-playground — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o terraform-playground ao modelo da mentoria: workflows separados com os portões de qualidade, gitflow com `develop` e homologação em `/homologacao/`, e a primeira release (1.11.0) pelo fluxo novo.

**Architecture:** O código ganha um modo de homologação ligado por variável de ambiente no build (`HOMOLOGACAO=1`), concentrado num módulo `src/ambiente.js`; sem a variável, o site sai igual ao de hoje. Os testes ganham cobertura com limite, E2E com Playwright (axe e larguras de celular) e Lighthouse CI. O `pages.yml` dá lugar a `testes.yml` (PR + chamado pelo deploy), `deploy.yml` (push em `main`/`develop`: testes, build do `main` na raiz e do `develop` em `/homologacao/`, publicação, tag) e `auditoria-semanal.yml`.

**Tech Stack:** Vite, vitest + `@vitest/coverage-v8`, `@playwright/test` + `@axe-core/playwright`, `@lhci/cli`, GitHub Actions, GitHub Pages, `gh` CLI.

**Spec:** `../python-playground/docs/superpowers/specs/2026-10-16-ci-cd-gitflow-design.md` (branch `ci-cd-desenho` do python-playground). Copie-a para `docs/superpowers/specs/` deste repositório na Task 1.

## Global Constraints

- O site principal continua em `https://sertaoseracloud.github.io/terraform-playground/`, igual ao de hoje quando `HOMOLOGACAO` não está ligada (mesmo `localStorage`, mesmo `SITE`, mesmo segredo, `sitemap.xml` e indexação).
- Homologação: `https://sertaoseracloud.github.io/terraform-playground/homologacao/`; prefixo do `localStorage` `terraform-playground-homologacao:`; faixa "🧪 Homologação: versão em teste do develop" com link para o site principal; `<meta name="robots" content="noindex">`; sem `sitemap.xml`; segredo `CERTIFICADO_SEGREDO_HOMOLOGACAO`.
- O `base` do Vite continua `./` (relativo): o mesmo `dist` funciona na raiz e em `/homologacao/`.
- Node **24** no CI. Portões: eslint zero avisos; vitest com cobertura ≥ o valor medido hoje (arredondado para baixo); `npm audit --audit-level=high`; Playwright Chromium bloqueando (Firefox, WebKit e celular informativos); Lighthouse SEO ≥ 0,9 e acessibilidade ≥ 0,9 (erro), boas práticas ≥ 0,8 (aviso), CLS ≤ 0,1 (erro), performance só aviso.
- E2E: axe-core WCAG 2.2 AA (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) nos 4 temas (`dracula`, `claro`, `suave`, `alto-contraste`) na landing, na trilha e num exercício; larguras 320, 360, 393 e 412 px sem nada passar da borda (medido com `getBoundingClientRect`, ignorando o que está dentro de um contêiner com `overflow-x` auto/scroll, o `.cenario-palco` e o `.sr`/`.sr-only`).
- Gitflow: `develop` padrão; `feature/*` → `develop` (rebase); `release/*` e `hotfix/*` → `main` (merge commit); depois PR `main` → `develop`; rulesets em `main` e `develop` (PR obrigatório, checks bloqueantes, sem push direto nem force-push, sem aprovação obrigatória).
- Mudanças no GitHub (branch padrão, rulesets, configuração de merge, secret, push, PR, merge, tag) **só com o "sim" do usuário**, pedido antes da Task 6.
- O valor de nenhum segredo aparece em código, log ou mensagem: o secret de homologação é gerado e gravado no mesmo comando, por pipe.
- Commits como `Cláudio Raposo <engcfraposo@gmail.com>` com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PRs terminam com "🤖 Generated with [Claude Code](https://claude.com/claude-code)".

## Review Focus

1. **O site principal muda sem querer** (a variável de homologação vaza para o build normal): o build sem `HOMOLOGACAO` tem de sair com o `sitemap.xml`, sem `noindex`, sem a faixa e com o prefixo `terraform-playground:`. Teste na Task 1 (build dos dois modos conferidos por um script).
2. **Um certificado da homologação validado no site principal:** chaves diferentes nos dois builds. Teste na Task 1 (a chave pública do `dist` principal e a da homologação são diferentes).
3. **Publicar a homologação apaga o site principal (ou o contrário):** o deploy sempre monta os dois a partir do último commit de cada branch. Coberto pela Task 5 (o job de montagem confere que `dist/index.html` e `dist/homologacao/index.html` existem antes de publicar) e conferido no ar na Task 6.
4. **Deploy de commit com teste vermelho:** o deploy chama o `testes.yml` como primeiro job (`needs`). Task 5.
5. **Tag duplicada ou sobrescrita:** o job de tag só cria `v<versão>` se ela não existir; nunca força. Task 5.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/ambiente.js` (novo) | `HOMOLOGACAO`, `PREFIXO_ARMAZENAMENTO`, `SITE_ATUAL` e a função pura que os calcula. |
| `src/progresso.js`, `src/certificados.js`, `src/privacidade.js` | Usam o prefixo e o site de `ambiente.js`. |
| `src/main.js`, `index.html`, `src/estilo.css` | A faixa de homologação. |
| `vite.config.js`, `vitest.config.js` | `__HOMOLOGACAO__`, o segredo de cada modo, cobertura. |
| `scripts/prerender.mjs` | `noindex` e sem `sitemap.xml` na homologação. |
| `scripts/conferir-build.mjs` (novo) | Confere o `dist` de cada modo (Review Focus 1 e 2). |
| `playwright.config.js`, `tests/e2e/*.spec.js` (novos) | E2E. |
| `.lighthouserc.json` (novo) | Lighthouse CI. |
| `.github/workflows/testes.yml`, `deploy.yml`, `auditoria-semanal.yml` (novos); `pages.yml` (sai) | O pipeline. |
| `README.md`, `src/novidades.js`, `package.json` | O fluxo documentado e a versão 1.11.0. |

---

### Task 1: O modo de homologação no código

**Files:** Create `src/ambiente.js`, `scripts/conferir-build.mjs`, `tests/ambiente.test.js`, `docs/superpowers/specs/2026-10-16-ci-cd-gitflow-design.md` (cópia); Modify `vite.config.js`, `vitest.config.js`, `src/progresso.js`, `src/certificados.js`, `src/privacidade.js`, `src/main.js`, `index.html`, `src/estilo.css`, `scripts/prerender.mjs`, `package.json` (script `conferir-build`).

**Interfaces:**
- Produces: `src/ambiente.js` exporta `configurarAmbiente(homologacao: boolean) → { homologacao, prefixo, site }`, e as constantes `HOMOLOGACAO = __HOMOLOGACAO__` (com `typeof` protegido, `false` fora do Vite), `PREFIXO_ARMAZENAMENTO` e `SITE_ATUAL` = `configurarAmbiente(HOMOLOGACAO)`.
- `vite.config.js`: `process.env.HOMOLOGACAO === '1'` liga o modo; nele o segredo vem de `CERTIFICADO_SEGREDO_HOMOLOGACAO` (no `serve`, `'segredo-de-homologacao'`), e `define.__HOMOLOGACAO__ = true`.
- `scripts/prerender.mjs` lê o mesmo `process.env.HOMOLOGACAO`.

- [ ] **Step 1: Write the failing tests** (`tests/ambiente.test.js`):
  - `'fora da homologação, tudo como hoje'` → `configurarAmbiente(false)` igual a `{ homologacao: false, prefixo: 'terraform-playground:', site: 'https://sertaoseracloud.github.io/terraform-playground/' }`.
  - `'na homologação, outro armazenamento e outro endereço'` → `configurarAmbiente(true)` igual a `{ homologacao: true, prefixo: 'terraform-playground-homologacao:', site: 'https://sertaoseracloud.github.io/terraform-playground/homologacao/' }`.
  - `'nos testes, o modo é o normal'` → `HOMOLOGACAO === false`, `PREFIXO_ARMAZENAMENTO === 'terraform-playground:'`, e `SITE` de `certificados.js` igual a `SITE_ATUAL`.
- [ ] **Step 2: Run, expect fail:** `rtk proxy npx vitest run tests/ambiente.test.js` → falha (o módulo não existe).
- [ ] **Step 3: Implement** `src/ambiente.js`; `progresso.js` passa a usar `PREFIXO_ARMAZENAMENTO` (e o `slice(21)` das funções de exportar/apagar usa `PREFIXO_ARMAZENAMENTO.length`); `certificados.js` exporta `SITE = SITE_ATUAL`; `privacidade.js` cita o prefixo de `ambiente.js`; `vite.config.js` e `vitest.config.js` (`__HOMOLOGACAO__: 'false'`). A faixa: `<div id="faixa-homologacao" class="faixa-homologacao" role="note" hidden>` no topo do `<body>` do `index.html`, com o texto e o link (`href="../"`, "ir para o site principal"); o `main.js` tira o `hidden` quando `HOMOLOGACAO`; CSS com contraste AA nos 4 temas (fundo `var(--amarelo)`, texto `var(--sobre-cor)`). `prerender.mjs`: com `HOMOLOGACAO=1`, acrescenta `<meta name="robots" content="noindex">` ao `<head>` e não grava o `sitemap.xml`.
- [ ] **Step 4: Run, expect pass:** `rtk proxy npx vitest run` → tudo verde (inclusive `privacidade`, `restaurar`, `certificados`).
- [ ] **Step 5: `scripts/conferir-build.mjs`** (`npm run conferir-build -- <dist> <principal|homologacao>`), que falha com mensagem clara se: no principal, faltar `sitemap.xml`, houver `noindex`, ou o bundle não tiver `terraform-playground:` como prefixo; na homologação, houver `sitemap.xml`, faltar `noindex`, ou o bundle não tiver `terraform-playground-homologacao:`. Com dois `dist`, `--comparar <outro>` falha se `chave-publica-ed25519.txt` for igual nos dois (Review Focus 2).
  Run: `CERTIFICADO_SEGREDO=<aleatório> npm run build && cp -r dist /tmp/dist-principal && HOMOLOGACAO=1 CERTIFICADO_SEGREDO_HOMOLOGACAO=<outro aleatório> npm run build && node scripts/conferir-build.mjs /tmp/dist-principal principal && node scripts/conferir-build.mjs dist homologacao --comparar /tmp/dist-principal` (os aleatórios com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) → os três passam.
- [ ] **Step 6: Commit:** `"Homologação: modo de build com outro armazenamento, outro segredo e noindex"`.

### Task 2: Cobertura com limite

**Files:** Modify `vitest.config.js`, `package.json`.

- [ ] **Step 1:** `rtk proxy npm install -D @vitest/coverage-v8@5.0.5`; `npx vitest run --coverage --coverage.reporter=json-summary` e leia `coverage/coverage-summary.json`: `statements`, `branches`, `functions` e `lines` (pct).
- [ ] **Step 2:** em `vitest.config.js`, `coverage: { provider: 'v8', include: ['src/**/*.js'], exclude: ['src/conteudo/**'], reporter: ['text-summary', 'json-summary', 'html'], thresholds: { statements, branches, functions, lines } }` com os valores medidos arredondados para baixo (registre-os no ledger). Script `"test:cobertura": "vitest run --coverage"`.
- [ ] **Step 3:** `rtk proxy npm run test:cobertura` → verde; baixar um limite em 1 ponto acima do medido faz falhar (confira uma vez e volte). Commit: `"Testes: cobertura com limite"`.

### Task 3: E2E com Playwright

**Files:** Create `playwright.config.js`, `tests/e2e/smoke.spec.js`, `tests/e2e/acessibilidade.spec.js`, `tests/e2e/celular.spec.js`; Modify `package.json`, `vitest.config.js` (`exclude: ['tests/e2e/**', ...]`), `.gitignore` (`playwright-report/`, `test-results/`).

**Interfaces:**
- `playwright.config.js`: `webServer: { command: 'npx vite preview --port 4174 --strictPort', url: 'http://localhost:4174', reuseExistingServer: !process.env.CI }`, `use.baseURL: 'http://localhost:4174'`; projetos `chromium`, `firefox`, `webkit` e `mobile` (`devices['Pixel 7']`); script `"test:e2e": "playwright test"`. O build é feito antes (no CI, um passo `npm run build`).

- [ ] **Step 1: Write the specs** (cada uma limpa o `localStorage` e marca o tutorial e o aviso de privacidade como vistos antes de navegar):
  - `smoke.spec.js` → `'a landing abre e leva à trilha'` (o link "Começar a trilha" leva a `#/trilha`); `'um exercício roda a solução de referência e passa'`: importe a trilha (`../../src/conteudo/trilha.js`), pegue o primeiro `problemas[0]`, grave `terraform-playground:rascunho:<id>` com a `solucao`, abra `#/p/<id>`, clique em `#btn-executar` e espere "Casos visíveis passaram".
  - `acessibilidade.spec.js` → para `['#/', '#/trilha', '#/p/<problemas[0].id>']` × os 4 temas (troca `document.documentElement.dataset.tema`): `new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()` com `violations` igual a `[]`.
  - `celular.spec.js` → para 320, 360, 393 e 412 de largura (altura 800), em `#/`, `#/trilha` e `#/p/<id>`, e com o tutorial aberto na trilha: a função de medida das Global Constraints devolve `[]`.
- [ ] **Step 2:** `rtk proxy npm install -D @playwright/test @axe-core/playwright && npx playwright install chromium`; `npm run build` (segredo aleatório) e `rtk proxy npx playwright test --project=chromium` → **verde**. (Estas specs fixam o comportamento atual, já corrigido nas rodadas anteriores; para provar que pegam regressão, troque uma vez o `minmax(0, 1fr)` de `.caminho-pagina` no celular por `1fr`, rode o `celular.spec.js` e veja falhar; volte.)
- [ ] **Step 3:** `rtk proxy npx playwright test --project=firefox --project=webkit --project=mobile` (instale os navegadores) e anote o resultado no ledger (informativo; falhas viram itens, não bloqueiam).
- [ ] **Step 4:** Commit: `"Testes: E2E com Playwright (fluxo, axe e celular)"`.

### Task 4: Lighthouse CI

**Files:** Create `.lighthouserc.json`; Modify `package.json`, `.gitignore` (`.lighthouseci/`).

- [ ] **Step 1:** `rtk proxy npm install -D @lhci/cli`; `.lighthouserc.json` com `collect.staticDistDir: "./dist"`, `numberOfRuns: 3`, `url: ["http://localhost/", "http://localhost/#/trilha"]`, e as asserções das Global Constraints (`categories:seo` e `categories:accessibility` `error` ≥ 0.9, `categories:best-practices` `warn` ≥ 0.8, `categories:performance` `warn` ≥ 0.8, `cumulative-layout-shift` `error` ≤ 0.1); `upload.target: "filesystem"`, `outputDir: ".lighthouseci"`. Script `"lighthouse": "lhci autorun"`.
- [ ] **Step 2:** `npm run build && rtk proxy npm run lighthouse` → nenhum erro (avisos de performance são esperados; anote as notas no ledger). Se SEO ou acessibilidade ficarem abaixo de 0,9, investigue a causa (é achado da validação) e corrija com teste; não baixe o limite.
- [ ] **Step 3:** Commit: `"Testes: Lighthouse CI"`.

### Task 5: Os workflows

**Files:** Create `.github/workflows/testes.yml`, `.github/workflows/deploy.yml`, `.github/workflows/auditoria-semanal.yml`; Delete `.github/workflows/pages.yml`.

**Interfaces:**
- `testes.yml`: `on: pull_request` (branches `develop`, `main`) e `workflow_call`. Jobs bloqueantes (os nomes são os checks obrigatórios do ruleset): `qualidade` (npm ci, lint, `test:cobertura`, `npm audit --audit-level=high`, artifact `cobertura`), `e2e` (`needs: qualidade`; build com segredo aleatório gerado no próprio passo, Playwright Chromium, artifact `playwright-report`), `lighthouse` (`needs: qualidade`; build, `lhci autorun`, artifact `.lighthouseci`). Job informativo `e2e-outros` (`continue-on-error: true`; Firefox, WebKit, mobile). Node 24, `cache: npm`.
- `deploy.yml`: `on: push` (`main`, `develop`) e `workflow_dispatch`; `concurrency: { group: pages, cancel-in-progress: false }`; `permissions: { contents: write, pages: write, id-token: write }`. Jobs: `testes` (`uses: ./.github/workflows/testes.yml`) → `principal` (checkout `ref: main`, build com `secrets.CERTIFICADO_SEGREDO`, `conferir-build principal`, artifact `site-principal`) e `homologacao` (checkout `ref: develop`, `HOMOLOGACAO=1` e `secrets.CERTIFICADO_SEGREDO_HOMOLOGACAO`, `conferir-build homologacao`, artifact `site-homologacao`; se o branch `develop` não existir, o job é pulado e o site sai só com o principal) → `montar` (baixa os dois, põe a homologação em `dist/homologacao/`, confere que `dist/index.html` existe e, se houve homologação, `dist/homologacao/index.html`; `upload-pages-artifact`) → `publicar` (`deploy-pages`) → `tag` (só `github.ref == 'refs/heads/main'`; lê a versão do `package.json`; se `git ls-remote --tags origin v<versão>` vier vazio, cria e empurra a tag anotada; senão, só avisa).
- `auditoria-semanal.yml`: `schedule: '0 0 * * 0'` e `workflow_dispatch`; Lighthouse (`lhci collect --url=...`) no site no ar, principal e homologação, artifact por 30 dias.

- [ ] **Step 1:** escreva os três e apague o `pages.yml`.
- [ ] **Step 2:** valide a sintaxe: `python -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/*.yml` (sem erro) e, se disponível, `npx --yes action-validator .github/workflows/*.yml`.
- [ ] **Step 3:** README: seção "Como publicar" com o gitflow (feature → develop → homologação; release → main → site e tag; hotfix), o endereço da homologação e os secrets (`CERTIFICADO_SEGREDO`, `CERTIFICADO_SEGREDO_HOMOLOGACAO`). Commit: `"CI/CD: testes, deploy (principal + homologação + tag) e auditoria semanal"`.

### Task 6: Migração no GitHub e a primeira release (só com o "sim")

Peça o "sim" ao usuário listando exatamente: push do branch `feature/ci-cd`, criação do `develop`, branch padrão, secret de homologação, rulesets, merge commit liberado, PRs e merges, tag `v1.11.0`.

- [ ] **Step 1:** renomeie o branch local para `feature/ci-cd`; crie `develop` no remoto a partir do `main` (`git push origin main:develop`); `gh repo edit --default-branch develop --enable-merge-commit --enable-rebase-merge`.
- [ ] **Step 2:** o secret, sem o valor aparecer: `node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | gh secret set CERTIFICADO_SEGREDO_HOMOLOGACAO`.
- [ ] **Step 3:** PR `feature/ci-cd` → `develop`; o `testes.yml` roda no PR (os quatro jobs); com tudo verde, merge com rebase. O push em `develop` dispara o `deploy.yml` (do `develop`): confira no ar que o site principal continua igual (versão 1.10.3, sem faixa) e que `.../homologacao/` abre com a faixa, `noindex` e um exercício rodando.
- [ ] **Step 4:** os rulesets de `main` e `develop` via `gh api repos/sertaoseracloud/terraform-playground/rulesets` (`target: branch`, `enforcement: active`, regras `pull_request` sem aprovação obrigatória, `required_status_checks` com `qualidade`, `e2e` e `lighthouse`, `non_fast_forward`, `deletion`). Confira que um `git push` direto em `develop` é recusado.
- [ ] **Step 5:** `release/1.11.0` a partir do `develop`: versão `1.11.0` no `package.json`/lock e nas novidades ("Por dentro do site": "Cada versão agora passa por testes automáticos no navegador (acessibilidade nos 4 temas e larguras de celular) antes de ir ao ar." e "Existe uma versão de homologação, usada para testar as novidades antes de publicar."). PR para `main` (merge commit) → o deploy publica e cria a tag `v1.11.0`; confira no ar e a tag no GitHub. Depois o PR `main` → `develop` (merge commit).
- [ ] **Step 6:** atualize a memória do projeto (fluxo novo do terraform, endereço da homologação) e relate ao usuário.
