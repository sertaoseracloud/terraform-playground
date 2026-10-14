# DivergeTerraform: terminal interativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a versão 1.6.0 com um terminal de verdade: os comandos do Terraform digitados no prompt, o `apply`/`destroy` esperando o `yes`, `init` como passo real, `fmt`, `console`, `state`, `output`, `workspace` e o shell (`ls`, `cat`, `clear`, `help`).

**Architecture:** A saída de hoje (`linhasDoResultado`) é dividida em partes por comando, reaproveitando o texto. Um módulo de comandos (`src/tf/comandos.js`) interpreta a linha e roda cada comando sobre o motor e o estado simulado, perguntando ao terminal quando precisa (`Enter a value:`). `fmt` e `console` ganham módulos próprios. O terminal animado de hoje ganha o campo de digitação (prompt, histórico, Tab, Ctrl+C/D/L, Esc) e os botões passam a digitar os comandos.

**Diferença em relação à spec (seção 5):** a divisão da linha (`dividir`) fica no próprio `src/tf/comandos.js`, e o `console` é uma função exportada do `motor.js` (`avaliarNoConsole`), porque precisa da `Execucao` por dentro; assim não existem `src/ui/shell.js` nem `src/tf/console.js`. O "inicializado" fica por exercício (o `terraform init` real vale para a pasta, não para o workspace).

**Tech Stack:** JavaScript (ES2023) no navegador, simulador próprio de Terraform (`src/tf/`), vitest 5 + happy-dom, axe-core 4.14.

**Spec:** `docs/superpowers/specs/2026-10-14-terminal-interativo-design.md`

## Global Constraints

- Versão publicada: **1.6.0**.
- "`apply` e `destroy` esperam a pessoa digitar `yes` (ou aceitam `-auto-approve`)."
- "Os botões ▶ Plan, ✔ Apply e 🗑 Destroy continuam, como atalhos que digitam o comando."
- `init`: "sem `init` (ou com um provedor novo no código), os outros comandos dão o erro do Terraform pedindo `terraform init`; os botões rodam o `init` antes quando precisa".
- "A correção automática não muda."
- Animação: "A atual continua ..., também nos comandos digitados; nada anima com 'reduzir animações'".
- Acessibilidade: WCAG 2.2 AA nos quatro temas (axe-core); campo com rótulo; saída nova numa região `role="log"`; a pergunta do `apply` é falada; Esc tira o foco do terminal (e continua pulando a animação).
- Publicação só depois do "sim" do usuário; commits como "Cláudio Raposo" <engcfraposo@gmail.com> com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- O aluno muda o código entre o `plan` e o `yes` do `apply`: o apply aplica o plano que foi mostrado (calculado antes da pergunta), como o Terraform faz com o plano salvo na memória — e não o código novo (teste no `comandos.test.js` da Task 2).
- Um `terraform apply` com erro no código não pode chegar à pergunta: mostra os erros e volta ao prompt (teste no `comandos.test.js` da Task 2).
- `terraform fmt` num arquivo com heredoc (`<<EOT`) ou com strings que têm `=` dentro não pode mexer no conteúdo do heredoc nem da string (teste no `formatar.test.js` da Task 3).
- `terraform state show` com um endereço que não existe: `No instance found for the given address!` em vez de travar (teste no `comandos.test.js` da Task 2).
- Trocar de exercício com o terminal esperando o `yes`: a pergunta é cancelada (o apply não acontece) e o novo exercício abre normalmente (teste no `item-terminal.test.js` da Task 5).

---

### Task 1: A saída dividida por comando

Antes de começar: `git checkout terminal` (o branch já tem a spec, a partir da `main` 1.5.1).

**Files:**
- Modify: `src/tf/saida.js`
- Test: `tests/saida-comandos.test.js` (novo); os testes de hoje que usam `linhasDoResultado` continuam iguais

**Interfaces:**
- Produces (em `src/tf/saida.js`, todas devolvem a lista de linhas `{ texto, classe, atraso?, digitar? }` que o terminal anima):
  - `linhasDoInit(r, { primeiraVez })` — o bloco de init de hoje (sem a linha do comando);
  - `linhasDoPlano(r)` — leituras, plano, avisos e erros de um `plan` (sem a linha do comando);
  - `linhasDaPergunta(r)` — `Do you want to perform these actions?` … até `  Enter a value: ` (sem a resposta; destroy usa o texto de hoje);
  - `linhasDoApply(r)` — o que vem depois do `yes` (o `escreverApply` de hoje);
  - `linhasDosDiagnosticos(lista)` — as caixas `╷ │ Error: … ╵`;
  - `linhaDoComando(texto)` — `$ terraform …` com o ritmo de digitação de hoje;
  - `linhasDoResultado(r, { primeiraVez })` continua existindo e passa a ser a junção das funções acima (mesma saída de hoje, conferida pelos testes atuais).

- [ ] **Step 1: Teste que falha**

`tests/saida-comandos.test.js`:

```js
// A saída de cada comando separada (para o terminal interativo), juntando de novo na de hoje.
import { describe, it, expect } from 'vitest';
import { executarTerraform } from '../src/tf/motor.js';
import { linhasDoResultado, linhasDoInit, linhasDoPlano, linhasDaPergunta, linhasDoApply, linhaDoComando } from '../src/tf/saida.js';

const CODIGO = { 'main.tf': 'resource "terraform_data" "a" {\n  input = "oi"\n}\n' };
const texto = (linhas) => linhas.map((l) => l.texto).join('\n');

describe('saída por comando', () => {
  it('as partes juntas dão a saída de hoje', () => {
    const r = executarTerraform(CODIGO, { comando: 'apply' });
    const partes = [
      linhaDoComando('terraform init'), ...linhasDoInit(r, { primeiraVez: true }),
      linhaDoComando('terraform apply'), { texto: '', classe: '' }, ...linhasDoPlano(r), ...linhasDaPergunta(r),
    ];
    const hoje = texto(linhasDoResultado(r, { primeiraVez: true }));
    expect(hoje.startsWith(texto(partes))).toBe(true);
    expect(texto(linhasDaPergunta(r))).toContain('Only \'yes\' will be accepted to approve.');
    expect(linhasDaPergunta(r).at(-1).texto).toBe('  Enter a value: ');
    expect(texto(linhasDoApply(r))).toContain('Apply complete! Resources: 1 added, 0 changed, 0 destroyed.');
  });

  it('o plano sozinho termina no resumo', () => {
    const r = executarTerraform(CODIGO, { comando: 'plan' });
    expect(texto(linhasDoPlano(r))).toContain('Plan: 1 to add, 0 to change, 0 to destroy.');
    expect(texto(linhasDoPlano(r))).not.toContain('terraform init');
  });
});
```

Run: `npx vitest run tests/saida-comandos.test.js`
Expected: FAIL (as funções não existem).

- [ ] **Step 2: Implementar**

Divida `linhasDoResultado` nas funções da seção Interfaces, sem mudar o texto: `linhasDoInit` é o trecho `// ---------- init ----------` (sem o `comando('terraform init', 0)`); `linhasDoPlano` é o trecho de `if (escreverLeituras(...))` até os erros; `linhasDaPergunta` é o `escreverConfirmacao` sem a linha `  Enter a value: yes` (que vira `  Enter a value: `); `linhasDoApply` é o `escreverApply`. `linhasDoResultado` passa a montar a sessão de hoje chamando essas funções e acrescentando a resposta `  Enter a value: yes` digitada, para a saída da correção continuar idêntica.

Run: `npx vitest run`
Expected: PASS (todos os testes de hoje e os novos).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Saída do Terraform dividida por comando (init, plano, pergunta, apply)"
```

---

### Task 2: Os comandos (`src/tf/comandos.js`)

**Files:**
- Create: `src/tf/comandos.js`
- Test: `tests/comandos.test.js` (novo)

**Interfaces:**
- Consumes: `executarTerraform`, as funções da Task 1, `formatarValor`, `comoTfstate`.
- Produces:
  - `dividir(linha) → string[]` (aspas simples e duplas);
  - `rodarComando(linha, ctx) → Promise<void>`, com `ctx`:
    - `arquivos(): { [nome]: texto }`, `trocarArquivos(novos)` (para o `fmt`);
    - `estado(): estado | null` e `gravarEstado(estado)` (do workspace atual);
    - `workspace(): string`, `trocarWorkspace(nome)`, `workspaces(): string[]`, `criarWorkspace(nome)`;
    - `inicializado(): { [fonte]: versao } | null`, `gravarInicializado(mapa)`;
    - `semente: string`; `primeiraVez(): boolean`;
    - `mostrar(linhas): Promise` (anima no terminal), `escrever(texto, classe?)` (texto puro, sem animação);
    - `perguntar(prompt, rotulo): Promise<string | null>` (lê no terminal; `null` = Ctrl+D/C);
    - `abrirGrafo(r)`, `aoResultado(r, comando)` (a tela atualiza estado, outputs e status).
  - Comandos: os da tabela da seção 4 da spec, e `bash: x: command not found` / `Terraform has no command named "x".`.

- [ ] **Step 1: Teste que falha**

`tests/comandos.test.js`:

```js
// Cada comando do terminal com um contexto falso (o terminal e o estado em memória).
import { describe, it, expect, beforeEach } from 'vitest';
import { rodarComando, dividir } from '../src/tf/comandos.js';

let ctx;
let saida;
let respostas;
const tudo = () => saida.join('\n');

function novoCtx(arquivos) {
  saida = [];
  respostas = [];
  const estados = { default: null };
  let ws = 'default';
  let init = null;
  let arqs = { ...arquivos };
  return {
    arquivos: () => arqs,
    trocarArquivos: (novos) => { arqs = { ...novos }; },
    estado: () => estados[ws],
    gravarEstado: (e) => { estados[ws] = e; },
    workspace: () => ws,
    trocarWorkspace: (n) => { ws = n; },
    workspaces: () => Object.keys(estados),
    criarWorkspace: (n) => { estados[n] = null; ws = n; },
    inicializado: () => init,
    gravarInicializado: (m) => { init = m; },
    semente: 'teste',
    primeiraVez: () => true,
    mostrar: async (linhas) => { saida.push(...linhas.map((l) => l.texto)); },
    escrever: (t) => { saida.push(t.replace(/\n$/, '')); },
    perguntar: async () => respostas.shift() ?? null,
    abrirGrafo: () => {},
    aoResultado: () => {},
  };
}

const CODIGO = { 'main.tf': 'resource "terraform_data" "a" {\n  input = "oi"\n}\n\noutput "valor" {\n  value = terraform_data.a.input\n}\n' };

beforeEach(() => { ctx = novoCtx(CODIGO); });

describe('comandos do terminal', () => {
  it('dividir respeita aspas', () => {
    expect(dividir(`terraform plan -var 'nome=Ana Lia' -var="x=1"`)).toEqual(['terraform', 'plan', '-var', 'nome=Ana Lia', '-var=x=1']);
  });

  it('sem init, o plan pede terraform init', async () => {
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('Error: Inconsistent dependency lock file');
    expect(tudo()).toContain('terraform init');
  });

  it('init, validate e plan', async () => {
    await rodarComando('terraform init', ctx);
    expect(tudo()).toContain('Terraform has been successfully initialized!');
    await rodarComando('terraform validate', ctx);
    expect(tudo()).toContain('Success! The configuration is valid.');
    await rodarComando('terraform plan', ctx);
    expect(tudo()).toContain('Plan: 1 to add, 0 to change, 0 to destroy.');
    expect(ctx.estado()).toBeNull();
  });

  it('apply espera o yes; outra resposta cancela; -auto-approve não pergunta', async () => {
    await rodarComando('terraform init', ctx);
    respostas.push('no');
    await rodarComando('terraform apply', ctx);
    expect(tudo()).toContain('Apply cancelled.');
    expect(ctx.estado()).toBeNull();
    respostas.push('yes');
    await rodarComando('terraform apply', ctx);
    expect(tudo()).toContain('Apply complete! Resources: 1 added');
    expect(Object.keys(ctx.estado().recursos)).toContain('terraform_data.a');
    saida.length = 0;
    await rodarComando('terraform destroy -auto-approve', ctx);
    expect(tudo()).toContain('Destroy complete! Resources: 1 destroyed.');
    expect(tudo()).not.toContain('Enter a value');
  });

  it('o apply aplica o plano mostrado, mesmo se o código mudar antes do yes', async () => {
    await rodarComando('terraform init', ctx);
    const original = ctx.perguntar;
    ctx.perguntar = async () => { ctx.trocarArquivos({ 'main.tf': '' }); return 'yes'; };
    await rodarComando('terraform apply', ctx);
    ctx.perguntar = original;
    expect(Object.keys(ctx.estado().recursos)).toContain('terraform_data.a');
  });

  it('apply com erro no código não pergunta', async () => {
    ctx = novoCtx({ 'main.tf': 'resource "terraform_data" "a" {\n  input = var.nao_existe\n}\n' });
    await rodarComando('terraform init', ctx);
    respostas.push('yes');
    await rodarComando('terraform apply', ctx);
    expect(tudo()).toContain('Error: Reference to undeclared input variable');
    expect(tudo()).not.toContain('Enter a value');
    expect(respostas).toEqual(['yes']);
  });

  it('output, show, state list/show e workspace', async () => {
    await rodarComando('terraform init', ctx);
    await rodarComando('terraform apply -auto-approve', ctx);
    saida.length = 0;
    await rodarComando('terraform output', ctx);
    expect(tudo()).toContain('valor = "oi"');
    await rodarComando('terraform output -raw valor', ctx);
    expect(saida.at(-1)).toBe('oi');
    await rodarComando('terraform state list', ctx);
    expect(tudo()).toContain('terraform_data.a');
    await rodarComando('terraform state show terraform_data.a', ctx);
    expect(tudo()).toContain('# terraform_data.a:');
    await rodarComando('terraform state show terraform_data.b', ctx);
    expect(tudo()).toContain('No instance found for the given address!');
    await rodarComando('terraform workspace new dev', ctx);
    expect(tudo()).toContain('Created and switched to workspace "dev"!');
    await rodarComando('terraform workspace list', ctx);
    expect(tudo()).toContain('* dev');
    await rodarComando('terraform show', ctx);
    expect(tudo()).toContain('The state file is empty. No resources are represented.');
  });

  it('shell e comandos desconhecidos', async () => {
    await rodarComando('ls', ctx);
    expect(tudo()).toContain('main.tf');
    await rodarComando('cat main.tf', ctx);
    expect(tudo()).toContain('resource "terraform_data" "a"');
    await rodarComando('terraform voar', ctx);
    expect(tudo()).toContain('Terraform has no command named "voar".');
    await rodarComando('xyz', ctx);
    expect(tudo()).toContain('bash: xyz: command not found');
    await rodarComando('terraform version', ctx);
    expect(tudo()).toMatch(/Terraform v\d+\.\d+\.\d+/);
  });
});
```

Run: `npx vitest run tests/comandos.test.js`
Expected: FAIL (o módulo não existe).

- [ ] **Step 2: Implementar `src/tf/comandos.js`**

Pontos:

- `init`: `executarTerraform(arquivos, { comando: 'plan', estado, workspace, semente })`; mostra `linhaDoComando` não (o terminal já mostrou o que foi digitado) e `linhasDoInit(r, { primeiraVez })`; grava `inicializado` com `{ [p.fonte]: p.versao }` dos provedores (`r.provedores`).
- Antes de `validate`/`plan`/`apply`/`destroy`/`console`: se algum provedor externo de `r.provedores` não está em `inicializado()`, mostra a caixa de erro:
  `Error: Inconsistent dependency lock file` / `The following dependency selections recorded in the lock file are inconsistent with the current configuration:` / `  - provider registry.terraform.io/<fonte>: required by this configuration but no version is selected` / `To make the initial dependency selections that will initialize the dependency lock file, run:` / `  terraform init`.
- `validate`: erros → `linhasDosDiagnosticos`; senão `Success! The configuration is valid.` (verde).
- `plan [-destroy] [-var k=v]`: `executarTerraform(..., { comando: destroy ? 'destroy' : 'plan', variaveis })` e `linhasDoPlano(r)`; `aoResultado(r, 'plan')`.
- `apply`/`destroy`: calcula `r` com o comando (o motor já aplica); mostra `linhasDoPlano(r)`; com erros, para; sem mudanças, mostra `linhasDoApply(r)` sem perguntar; senão, sem `-auto-approve`, mostra `linhasDaPergunta(r)` e `perguntar('  Enter a value: ', 'Resposta do Terraform: digite yes para aprovar')`; resposta diferente de `yes` → `Apply cancelled.` (destroy: `Destroy cancelled.`) e nada é gravado; com `yes`, `linhasDoApply(r)` e `gravarEstado(r.estado)` — o `r` é o calculado antes da pergunta.
- `output [nome] [-json] [-raw]`: dos outputs do estado (`comoTfstate(estado).outputs`); sem estado: `Warning: No outputs found`; `-raw` só para string/número/bool.
- `show [-json]`: estado vazio → `The state file is empty. No resources are represented.`; senão, cada recurso como `# endereço:` + `resource "tipo" "nome" {` + atributos (`formatarValor`) + `}`; `-json` → `JSON.stringify(comoTfstate(estado))`.
- `state list` / `state show <end>`: endereços gerenciados; endereço inexistente → `No instance found for the given address!` (caixa de erro).
- `workspace list|show|select <n>|new <n>|delete <n>`: textos do Terraform (`Switched to workspace "dev".`, `Created and switched to workspace "dev"!`, `Workspace "x" doesn't exist.`), `list` com `* ` no atual.
- `graph`: `digraph G { … }` com as arestas de `r.grafo` e `abrirGrafo(r)`.
- `version`: `Terraform v<VERSAO_TERRAFORM>` + `on linux_amd64` + os provedores inicializados; `-help`/`help`: a lista de comandos.
- `fmt` e `console` chamam os módulos das Tasks 3 e 4 (nesta task, `fmt`/`console` respondem `Terraform has no command named` só até elas entrarem — os testes desta task não os usam).

Run: `npx vitest run tests/comandos.test.js tests/saida-comandos.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Comandos do terminal: init, validate, plan, apply/destroy com yes, output, show, state, workspace, graph, version"
```

---

### Task 3: `terraform fmt` (`src/tf/formatar.js`)

**Files:**
- Create: `src/tf/formatar.js`
- Modify: `src/tf/comandos.js` (liga o `fmt`)
- Test: `tests/formatar.test.js` (novo)

**Interfaces:**
- Produces: `formatarHcl(texto) → string`; no `comandos.js`, `terraform fmt [-check] [-diff]` usa `formatarHcl` em cada `.tf`, chama `trocarArquivos` com os que mudaram e escreve o nome de cada um (como o Terraform); `-check` só lista e não troca; `-diff` escreve as diferenças linha a linha (`-`/`+`).

- [ ] **Step 1: Teste que falha**

`tests/formatar.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatarHcl } from '../src/tf/formatar.js';
import { rodarComando } from '../src/tf/comandos.js';

describe('terraform fmt', () => {
  it('recuo de 2 espaços, = alinhados nos atributos seguidos e espaços em volta do =', () => {
    const antes = 'resource "aws_s3_bucket" "b" {\nbucket="dados"\n    force_destroy   =true\n\ntags = {\nNome="x"\n  Ambiente = "dev"\n}\n}\n';
    expect(formatarHcl(antes)).toBe('resource "aws_s3_bucket" "b" {\n  bucket        = "dados"\n  force_destroy = true\n\n  tags = {\n    Nome     = "x"\n    Ambiente = "dev"\n  }\n}\n');
  });

  it('é idempotente e não mexe em heredoc nem em strings', () => {
    const texto = 'locals {\n  a = "x = y"\n  b = <<EOT\n  linha   =  solta\nEOT\n}\n';
    expect(formatarHcl(texto)).toBe(texto);
    expect(formatarHcl(formatarHcl(texto))).toBe(texto);
  });

  it('o comando lista os arquivos que mudaram e troca no editor; -check só lista', async () => {
    let arquivos = { 'main.tf': 'variable "x" {\ntype=string\n}\n', 'ok.tf': 'locals {\n  a = 1\n}\n' };
    const saida = [];
    const ctx = { arquivos: () => arquivos, trocarArquivos: (n) => { arquivos = n; }, escrever: (t) => saida.push(t.trim()), mostrar: async () => {} };
    await rodarComando('terraform fmt -check', ctx);
    expect(saida).toEqual(['main.tf']);
    expect(arquivos['main.tf']).toContain('type=string');
    await rodarComando('terraform fmt', ctx);
    expect(arquivos['main.tf']).toBe('variable "x" {\n  type = string\n}\n');
  });
});
```

Run: `npx vitest run tests/formatar.test.js`
Expected: FAIL.

- [ ] **Step 2: Implementar `formatarHcl`**

Linha a linha, com o nível de chaves/colchetes contado fora de strings e comentários: recuo `2 * nível` (a linha que começa com `}`/`]` usa o nível de depois); `chave=valor` vira `chave = valor`; dentro de um mesmo bloco, uma sequência de linhas `chave = valor` de uma linha só (sem linha em branco ou comentário no meio, e sem o valor abrir `{`/`[` sem fechar) tem os `=` alinhados pela chave mais longa; espaços no fim saem; o arquivo termina com uma quebra de linha; heredoc (`<<EOT` / `<<-EOT` até a linha com o marcador) é copiado sem mudança.

Run: `npx vitest run tests/formatar.test.js tests/comandos.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "terraform fmt: recuo, = alinhados, -check e -diff, sem mexer em heredoc e strings"
```

---

### Task 4: `terraform console`

**Files:**
- Modify: `src/tf/motor.js` (exporta `avaliarNoConsole`), `src/tf/comandos.js`
- Test: `tests/console.test.js` (novo)

**Interfaces:**
- Produces: `avaliarNoConsole(arquivos, { estado, workspace, semente, variaveis }, textos: string[]) → [{ ok: true, valor } | { ok: false, erro: { resumo, detalhe } }]` — roda a mesma `Execucao` do `plan` e avalia cada expressão com `analisarExpressao` + `avaliar(expr, raiz.contexto('<console>'))`; `terraform console` lê com `perguntar('> ', 'Expressão do terraform console')` até `exit`/`null` e escreve `formatarValor(valor)` ou a caixa de erro.

- [ ] **Step 1: Teste que falha**

`tests/console.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { avaliarNoConsole } from '../src/tf/motor.js';

const CODIGO = { 'main.tf': 'variable "nome" {\n  default = "sertao"\n}\n\nlocals {\n  maiusculo = upper(var.nome)\n}\n' };

describe('terraform console', () => {
  it('avalia funções, variáveis, locals e mostra erros', () => {
    const [a, b, c, d] = avaliarNoConsole(CODIGO, {}, ['1 + 2', 'local.maiusculo', 'length([1, 2, 3])', 'var.nao_existe']);
    expect(a).toEqual({ ok: true, valor: 3 });
    expect(b).toEqual({ ok: true, valor: 'SERTAO' });
    expect(c).toEqual({ ok: true, valor: 3 });
    expect(d.ok).toBe(false);
    expect(d.erro.resumo).toBe('Reference to undeclared input variable');
  });
});
```

Run: `npx vitest run tests/console.test.js`
Expected: FAIL (`avaliarNoConsole` não existe).

- [ ] **Step 2: Implementar**

`src/tf/motor.js`: `Execucao` aceita `opcoes.console` (lista de textos); em `rodar()`, depois de `this.raiz.avaliarTudo()`, se houver `console`, devolve `this.finalizar({ ...base, ok: true, fase: 'console', console: textos.map((t) => this.avaliarConsole(t)) })`, com `avaliarConsole(t)` = `try { return { ok: true, valor: avaliar(analisarExpressao(t), this.raiz.contexto('<console>')) }; } catch (erro) { if (erro instanceof ErroAvaliacao || erro instanceof ErroValor || erro instanceof ErroHCL) return { ok: false, erro: { resumo: erro.resumo, detalhe: erro.detalhe } }; throw erro; }`. `export function avaliarNoConsole(arquivos, opcoes, textos) { return executarTerraform(arquivos, { ...opcoes, comando: 'plan', console: textos }).console ?? []; }`. No `comandos.js`, o `console` mostra o resultado de cada linha com `formatarValor` (valores desconhecidos: `(known after apply)`).

Run: `npx vitest run tests/console.test.js tests/comandos.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "terraform console: avalia expressões com variáveis, locals, funções e o estado"
```

---

### Task 5: O terminal interativo na tela do exercício

**Files:**
- Modify: `src/ui/terminal.js` (ganha o campo e a leitura), `src/ui/item.js`, `index.html`, `src/estilo.css`, `src/progresso.js`, `src/privacidade.js`, `src/ui/tutorial-passos.js`, `src/ui/declaracao-acessibilidade.js`
- Test: `tests/terminal-interativo.test.js` (novo), `tests/item-terminal.test.js` (novo), `tests/privacidade.test.js`, `tests/acessibilidade-telas.test.js`

**Interfaces:**
- Consumes: `rodarComando` (Tasks 2–4).
- Produces: `criarTerminal(pre, { aoMudar, campo, rotulo, historico, aoMudarHistorico, completar })` mantém `mostrar(linhas, opcoes)` (animação de hoje), `pular()`, `limpar()`, `texto(t)`, e ganha:
  - `escrever(texto, classe?)` (sem animação);
  - `ler({ prompt, rotulo }) → Promise<string | null>` (Enter; Ctrl+D/C → `null`, Ctrl+C escreve `^C`);
  - `cancelarLeitura()`; `ocupado`.
  Teclas: ↑/↓ histórico (até 100, salvo); Tab completa (comandos, subcomandos, arquivos, endereços do estado); Ctrl+L limpa; Esc: com animação, pula; sem animação, tira o foco.
- `progresso.js`: `lerHistorico()`/`gravarHistorico(lista)` (chave `historico`) e `lerInicializado(id)`/`gravarInicializado(id, mapa)` (chave `init:<id>`); `privacidade.js` documenta as duas chaves.
- HTML: depois do `<pre id="saida-terminal">`, `<div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal" autocomplete="off" spellcheck="false" aria-label="Comando do terminal"></div>`; o `<pre>` ganha `role="log"`.

- [ ] **Step 1: Testes que falham**

`tests/terminal-interativo.test.js`:

```js
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { criarTerminal } from '../src/ui/terminal.js';

let t;
let historico;
const campo = () => document.getElementById('campo-terminal');
const tecla = (key, extra = {}) => campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }));
const digitar = (v) => { campo().value = v; tecla('Enter'); };

beforeEach(() => {
  document.documentElement.classList.add('a11y-sem-movimento');
  document.body.innerHTML = '<pre id="saida-terminal" role="log"></pre><div class="linha-prompt"><span id="prompt-terminal"></span><input id="campo-terminal"></div>';
  historico = [];
  t = criarTerminal(document.getElementById('saida-terminal'), {
    campo: campo(), rotulo: document.getElementById('prompt-terminal'),
    historico: [], aoMudarHistorico: (h) => { historico = h; },
    completar: (v) => ['terraform plan', 'terraform apply'].filter((c) => c.startsWith(v)),
  });
});

describe('terminal interativo', () => {
  it('lê com prompt e rótulo; histórico; Tab com várias opções lista', async () => {
    let p = t.ler({ prompt: 'aluno@sertao:~/x$ ', rotulo: 'Comando do terminal' });
    digitar('terraform plan');
    expect(await p).toBe('terraform plan');
    expect(historico).toEqual(['terraform plan']);
    p = t.ler({ prompt: '$ ' });
    tecla('ArrowUp');
    expect(campo().value).toBe('terraform plan');
    campo().value = 'terraform ';
    tecla('Tab');
    expect(document.getElementById('saida-terminal').textContent).toContain('terraform plan');
    expect(document.getElementById('saida-terminal').textContent).toContain('terraform apply');
    tecla('c', { ctrlKey: true });
    expect(await p).toBeNull();
  });

  it('a pergunta do apply tem o rótulo dela e Esc tira o foco', async () => {
    const p = t.ler({ prompt: '  Enter a value: ', rotulo: 'Resposta do Terraform: digite yes para aprovar' });
    expect(campo().getAttribute('aria-label')).toBe('Resposta do Terraform: digite yes para aprovar');
    campo().focus();
    tecla('Escape');
    expect(document.activeElement).not.toBe(campo());
    t.cancelarLeitura();
    expect(await p).toBeNull();
  });

  it('Ctrl+L limpa a saída e mantém a leitura aberta', async () => {
    t.escrever('linha antiga\n');
    const p = t.ler({ prompt: '$ ' });
    tecla('l', { ctrlKey: true });
    expect(document.getElementById('saida-terminal').textContent).toBe('');
    digitar('ls');
    expect(await p).toBe('ls');
  });
});
```

`tests/item-terminal.test.js` (a tela do exercício com o motor de verdade, que roda no próprio navegador):

```js
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarTelaItem } from '../src/ui/item.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const corpo = html.slice(html.indexOf('<body'), html.lastIndexOf('</body>'));
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const saida = () => document.getElementById('saida-terminal').textContent;

function montar() {
  document.documentElement.classList.add('a11y-sem-movimento');
  document.body.innerHTML = corpo;
  return criarTelaItem({ layout: { aplicar() {}, mostrarDescricao() {} }, definirStatus: () => {}, aoMudarProgresso: () => {} });
}

describe('terminal na tela do exercício', () => {
  beforeEach(() => localStorage.clear());

  it('o botão Apply digita terraform apply e espera o yes', async () => {
    const tela = montar();
    tela.abrir('livre');
    await espera();
    document.getElementById('btn-apply').click();
    await espera();
    expect(saida()).toContain('terraform apply');
    expect(document.getElementById('prompt-terminal').textContent).toBe('  Enter a value: ');
    const campo = document.getElementById('campo-terminal');
    campo.value = 'yes';
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await espera();
    expect(saida()).toContain('Apply complete!');
  });

  it('trocar de exercício com o terminal esperando o yes cancela o apply', async () => {
    const tela = montar();
    tela.abrir('livre');
    await espera();
    document.getElementById('btn-apply').click();
    await espera();
    tela.abrir('livre');
    await espera();
    expect(saida()).not.toContain('Apply complete!');
    expect(document.getElementById('prompt-terminal').textContent).toContain('aluno@sertao');
  });
});
```

(Se `criarTelaItem` hoje exigir outros parâmetros, use os mesmos do `main.js`; o teste só precisa do layout e dos callbacks.)

`tests/acessibilidade-telas.test.js`: um caso com o terminal esperando o `yes`, sem violações do axe-core nos 4 temas.

Run: `npx vitest run tests/terminal-interativo.test.js tests/item-terminal.test.js tests/privacidade.test.js tests/acessibilidade-telas.test.js`
Expected: FAIL.

- [ ] **Step 2: Implementar**

`src/ui/terminal.js`: mantém a animação; acrescenta o campo (o prompt vai no `<span id="prompt-terminal">`, o campo logo depois, mesma fonte), `ler`/`escrever`/`cancelarLeitura`/`ocupado` e as teclas da seção Interfaces. Durante a animação o campo fica desabilitado e Esc pula; depois, Esc tira o foco. O `final(pasta)` de hoje (prompt com cursor desenhado no fim da saída) sai: o prompt de verdade é a linha do campo.

`src/ui/item.js`:
- cria o terminal com o campo, o histórico (`lerHistorico`/`gravarHistorico`) e `completar` (comandos, subcomandos, arquivos do editor, endereços do estado);
- um laço de shell (`async function shell()`) lê `aluno@sertao:~/<id>$ ` e chama `rodarComando(linha, ctx)` com o `ctx` ligado à tela (estado do workspace com `estadoAtual`/`gravarEstado`, seletor 🗂, `lerInicializado`/`gravarInicializado` por exercício, `mostrar` = `terminal.mostrar` com animação, `perguntar` = `terminal.ler`, `abrirGrafo` = mostrar a aba 🕸️ e desenhar, `aoResultado` = `renderEstado`/`renderSaidas`/status/fala de hoje);
- os botões: ▶ Plan → `digitarComando('terraform plan')`; ✔ Apply → `'terraform apply'`; 🗑 Destroy → `'terraform destroy'`; antes, se o código precisa de `init`, `digitarComando('terraform init')`. `digitarComando(texto)` cancela a leitura do prompt, escreve o prompt + texto como digitado e roda; depois do `plan`, os testes visíveis rodam como hoje (`comTestes`);
- `abrir(id)`: cancela a leitura aberta (inclusive o `Enter a value:` — o apply não acontece), limpa o terminal e roda `terraform init` + `terraform plan` (com animação na primeira vez, como hoje), e o laço do shell volta.

`progresso.js`/`privacidade.js`: as duas chaves novas (`historico`: "Os últimos 100 comandos que você digitou no terminal", finalidade "As setas ↑/↓ do terminal"; `init:*`: "Os provedores que o terraform init 'baixou' em cada exercício", finalidade "Saber se é preciso rodar terraform init de novo").

Textos: tutorial (o passo do terminal: dá para digitar os comandos; o Apply pede `yes`), declaração de acessibilidade (o campo do terminal tem rótulo; Esc sai do terminal ou pula a animação).

Run: `npx vitest run && npx eslint .`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Terminal interativo na tela: prompt digitável, botões digitam os comandos, init de verdade"
```

---

### Task 6: Versão 1.6.0, auditoria e publicação

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/novidades.js`, `README.md`

- [ ] **Step 1: Versão e textos**

`npm version 1.6.0 --no-git-tag-version`. `src/novidades.js`, no topo:

```js
  {
    versao: '1.6.0',
    data: '2026-10-14', // a data do dia da publicação
    titulo: 'Um terminal de verdade',
    resumo: 'Digite os comandos do Terraform no terminal, como no seu computador: init, plan, apply com yes, fmt, console, state e mais.',
    grupos: [
      { titulo: '🖥️ Terminal', itens: ['O prompt aceita terraform init, validate, fmt, plan, apply, destroy, output, show, state, workspace, graph, console e version, além de ls, cat, clear e help.', 'O apply e o destroy mostram o plano e esperam você digitar yes (ou use -auto-approve).', 'O init virou um passo de verdade: com um provedor novo no código, o Terraform pede terraform init de novo.', 'Setas para o histórico, Tab para completar, Ctrl+C para cancelar, Ctrl+L para limpar.', 'Os botões Plan, Apply e Destroy continuam: eles digitam o comando para você.'] },
      { titulo: '♿ Acessibilidade', itens: ['O campo do terminal tem rótulo e a pergunta do apply é falada.', 'Esc pula a animação ou tira o foco do terminal (o Tab completa comandos).'] },
    ],
  },
```

`README.md`: a seção do terminal descreve os comandos e o `yes`.

- [ ] **Step 2: Auditoria**

Run: `npx eslint . && npx vitest run && CERTIFICADO_SEGREDO=<valor aleatório descartável> npm run build`
Expected: tudo verde, build sem avisos.

No navegador (build + preview): um exercício AWS (`terraform init`, `plan`, `apply` → `no` → `Apply cancelled.`, `apply` → `yes`, `state list`, `output`, `console` com `upper("x")` e `exit`, `fmt` num código desalinhado); os botões; axe-core sem violações nos 4 temas a 1280 px e a 320 px com o terminal esperando o `yes`.

- [ ] **Step 3: Pedir o "sim" do usuário e publicar**

Depois do "sim":

```bash
git checkout main && git merge --ff-only terminal && git push origin main
gh run watch $(gh run list -R sertaoseracloud/terraform-playground --branch main --limit 1 --json databaseId -q '.[0].databaseId') -R sertaoseracloud/terraform-playground --exit-status
git tag -a v1.6.0 -m "Versão 1.6.0" && git push origin v1.6.0
gh release create v1.6.0 -R sertaoseracloud/terraform-playground --verify-tag --title "v1.6.0 · Um terminal de verdade" --notes-file ../notas-terraform-1.6.0.md
```
