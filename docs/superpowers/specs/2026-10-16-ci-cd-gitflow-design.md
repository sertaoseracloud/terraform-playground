# CI/CD unificado e gitflow nos playgrounds — design

Data: 2026-10-16 · Repositórios: `php-playground`, `terraform-playground`, `python-playground` (e o futuro `k8s-playground`, DivergeK8S, que já nasce assim) · Referência: o pipeline do hub `deep-dive-vm` (mentoria.sertaoseracloud.com).

## Por quê

Hoje cada playground publica num só workflow (`pages.yml`): o mesmo arquivo testa e publica, o `main` não tem proteção, e todo merge vai direto para o ar. As versões não ganham tag desde a v1.7.0 (php), v1.8.0 (terraform) e v0.4.1 (python). A verificação visual (axe nos 4 temas, larguras de celular) é feita à mão no preview local, a cada rodada.

O usuário considera a estrutura do pipeline da mentoria a mais adequada e quer que todos os repositórios sigam esse modelo, com gitflow, e uma **homologação**: uma variação do site, com o `develop`, usada por ele e pelo Claude para testar as funcionalidades visualmente antes da release.

## Objetivos

1. A estrutura de workflows da mentoria nos três playgrounds: testes separados do deploy, com os portões de qualidade dela.
2. Gitflow: `develop` como branch de integração, releases e hotfixes até o `main`, tag em cada versão publicada.
3. Homologação: o `develop` publicado em `/homologacao/`, dentro do mesmo site.
4. `main` e `develop` protegidos: só entra por PR com o CI verde.
5. O mesmo desenho, sem diferença à toa, nos três (as diferenças são só as do próprio site: o PySpark real e o pytest no python).

## Fora do escopo (agora)

- Juntar o código repetido dos três num pacote compartilhado (26 arquivos iguais e 35 quase iguais): é outro projeto, depois deste.
- O DivergeK8S em si: ele usa este desenho quando for criado, num projeto próprio.
- Domínio próprio e repositórios privados (adiados pelo usuário).
- Atualizar `@noble/*` e `qrcode-generator` (versões maiores).

## Anti-objetivos (seria um fracasso mesmo funcionando)

- A homologação invalidar ou forjar certificados de verdade, ou misturar o progresso de teste com o progresso real de quem usa o site.
- Um certificado já emitido deixar de validar, ou um link já compartilhado parar de funcionar (o endereço do site principal não muda).
- O site principal sair do ar ou voltar a uma versão velha porque a homologação foi publicada (ou o contrário).
- Um portão novo que trave a publicação sem dizer o porquê (todo portão tem relatório no artifact).

## O desenho

### 1. Workflows (em cada repositório)

Três arquivos, como na mentoria:

| Arquivo | Quando | O que faz |
|---|---|---|
| `.github/workflows/testes.yml` | PR para `develop` ou `main`, push em `develop` e `main` | Os portões de qualidade (seção 2). Não publica nada. |
| `.github/workflows/deploy.yml` | push em `main` ou em `develop`; `workflow_dispatch` | Monta o site do `main` na raiz e o do `develop` em `/homologacao/`, publica os dois juntos no Pages e, quando o push é no `main`, cria a tag `v<versão do package.json>` se ela ainda não existir. |
| `.github/workflows/auditoria-semanal.yml` | domingo, 00:00 UTC; `workflow_dispatch` | Lighthouse no site no ar (principal e homologação), relatório no artifact. |

O `pages.yml` de hoje sai. O deploy só roda depois que os testes do mesmo commit passaram (`workflow_run` do `testes.yml` com `conclusion == success`, ou o deploy chama os testes como job anterior; escolha do construtor, desde que nunca publique um commit com teste vermelho).

Node **24** nos três (hoje php e terraform usam 22; o python precisa do 24 pelo JSPI).

### 2. Portões de qualidade (`testes.yml`)

Da mentoria, adaptados aos playgrounds:

1. `npm ci`, `npm run lint` (eslint, zero avisos).
2. `npm test` (vitest) com **cobertura mínima**: o limite começa no valor medido hoje em cada repositório, arredondado para baixo, e só pode subir (o da mentoria é 95%; não é meta desta rodada).
3. `npm audit --audit-level=high`.
4. **E2E com Playwright** (novo nos playgrounds), sobre o build local (`vite preview`):
   - Chromium **bloqueando**: a landing, a trilha, abrir um exercício e rodar a solução de referência até os testes visíveis passarem; axe-core WCAG 2.2 AA (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) nos 4 temas (`dracula`, `claro`, `suave`, `alto-contraste`) na landing, na trilha e num exercício; nas larguras **320, 360, 393 e 412 px**, nenhum elemento passa da borda (medindo o `getBoundingClientRect`, não só o `scrollWidth`, e ignorando as faixas que rolam de propósito e o cenário).
   - Firefox, WebKit e celular **só informativos** (`continue-on-error`), como na mentoria.
5. **Lighthouse CI** sobre o `dist`: SEO ≥ 0,9, acessibilidade ≥ 0,9 (erro), boas práticas ≥ 0,8 (aviso), CLS ≤ 0,1 (erro), na landing e na trilha. Performance: só aviso nos playgrounds (o runtime e o bundle de ~1,2 MB derrubam a nota; é débito conhecido, não regressão).
6. O que já é próprio de cada site continua: no python, o pytest do runtime e a conformidade com o PySpark 4.0.1 real (Java 17, `delta-spark` 4.0.0, numpy).

Cada portão sobe o relatório como artifact (cobertura, Playwright, Lighthouse), mesmo quando falha.

### 3. Gitflow

- **`main`**: o que está no ar. Só recebe `release/x.y.z` e `hotfix/x.y.z`, por PR, com o CI verde. Cada merge no `main` publica e ganha a tag `vx.y.z`.
- **`develop`**: a integração; vira o **branch padrão** do repositório. Recebe `feature/*` por PR com o CI verde. Cada merge publica a homologação.
- **`feature/<nome>`**: sai de `develop`, volta para `develop`.
- **`release/x.y.z`**: sai de `develop`; leva a versão no `package.json` e a entrada nas novidades; entra no `main` por PR e depois volta para `develop` (merge do `main` em `develop`).
- **`hotfix/x.y.z`**: sai do `main` para uma correção urgente; entra no `main` por PR e volta para `develop`.
- Merge **com rebase** nos PRs de `feature/*` (como hoje); merge commit nos PRs de `release/*` e `hotfix/*` para o `main`, para o `main` e o `develop` não divergirem.
- **Proteção** (ruleset do GitHub) em `main` e `develop`: PR obrigatório, os checks bloqueantes do `testes.yml` obrigatórios, sem push direto e sem force-push. Sem exigir aprovação de outra pessoa (o projeto tem um mantenedor).

As tags que faltam (as versões publicadas sem tag) não são recriadas para trás; a primeira tag nova é a da primeira release deste fluxo.

### 4. Homologação

- **Endereço:** `https://sertaoseracloud.github.io/<repo>/homologacao/`. O site principal continua na raiz, no mesmo endereço de hoje.
- **Build:** o mesmo build com uma variável de ambiente (por exemplo `HOMOLOGACAO=1`) que muda só:
  - o `base` do Vite para `/<repo>/homologacao/`;
  - o prefixo do `localStorage` (`<repo>-homologacao:`), para o teste não misturar com o progresso real (o domínio é o mesmo);
  - uma faixa fixa e acessível no topo: "🧪 Homologação: versão em teste do `develop`", com link para o site principal;
  - `<meta name="robots" content="noindex">` e fora do `sitemap.xml`;
  - o segredo dos certificados: um segredo **próprio da homologação** (`CERTIFICADO_SEGREDO_HOMOLOGACAO`, gerado aleatório, nunca visto por ninguém), para que nenhum certificado emitido na homologação valide no site principal, e vice-versa.
- **Publicação:** o deploy sempre monta os dois (o `main` na raiz, o `develop` em `/homologacao/`) a partir do último commit de cada branch e publica tudo junto; assim publicar um não apaga o outro.
- **Uso pelo Claude:** depois de cada merge em `develop`, a verificação visual (axe nos 4 temas, 320–412 px, as telas mexidas) é feita na homologação no ar, e não mais no preview local.

### 5. Migração (em cada repositório, com o "sim" do usuário antes de mexer no GitHub)

1. Branch `feature/ci-cd`: os três workflows, o Playwright e o Lighthouse, a variável de homologação, o README com o fluxo.
2. Criar `develop` a partir do `main` e torná-lo o branch padrão.
3. Os rulesets de `main` e `develop`, e nas configurações do repositório: permitir **merge commit** (para release e hotfix) além do rebase.
   - O deploy precisa de `contents: write` (para criar a tag), além de `pages: write` e `id-token: write`.
   - A volta do `main` para o `develop` depois de uma release é um PR `main → develop` (o `develop` é protegido), com o CI verde.
4. O secret `CERTIFICADO_SEGREDO_HOMOLOGACAO` (aleatório, gerado e gravado sem aparecer em lugar nenhum).
5. A primeira release pelo fluxo novo (`release/x.y.z`), que publica com tag e liga a homologação.

Ordem: primeiro o **terraform** (sem runtime próprio, o mais simples), depois o **php** e por fim o **python** (o pipeline mais longo, com o PySpark real).

## O que fica para quem constrói

- Os nomes exatos dos jobs (desde que os bloqueantes sejam os checks obrigatórios do ruleset).
- `workflow_run` ou job anterior para ligar o deploy aos testes.
- Onde a variável de homologação entra no código (Vite `define`, um módulo de configuração), desde que o site principal fique byte a byte igual ao de hoje quando ela não está ligada.
- O texto da faixa, desde que tenha contraste AA nos 4 temas e seja anunciado ao leitor de tela.

## Chamadas que eu fiz (para o usuário conferir)

- A homologação usa um segredo de certificado próprio (os certificados dela não valem no site real).
- O prefixo de armazenamento da homologação é outro (o progresso de teste não mistura com o real).
- O limite de cobertura começa no valor de hoje, não em 95%.
- Performance no Lighthouse é só aviso nos playgrounds.
- Sem aprovação obrigatória de outra pessoa nos PRs.
- Merge commit (e não rebase) nos PRs de release e hotfix para o `main`.
- Ordem da migração: terraform, php, python.
