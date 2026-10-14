// Os comandos do terminal: `terraform init/validate/plan/apply/destroy/output/show/state/
// workspace/graph/version` e o shell (`ls`, `cat`, `clear`, `help`), sobre o motor
// (executarTerraform) e o estado simulado. Tudo que é tela vem do `ctx` (veja rodarComando).
import { executarTerraform } from './motor.js';
import { analisarExpressao } from './parser.js';
import { avaliar } from './avaliador.js';
import { VERSAO_TERRAFORM } from './esquema/index.js';
import { formatarHcl, diferencaDeLinhas } from './formatar.js';
import {
  linhasDoInit, linhasDoPlano, linhasDaPergunta, linhasDoApply, linhasDosDiagnosticos,
  seguePara, temMudancas, formatarValor, comoTfstate,
} from './saida.js';

const vazio = () => ({ versao: 4, serial: 0, linhagem: null, recursos: {}, saidas: {} });
const linha = (texto, classe = '') => ({ texto, classe });
const erro = (resumo, detalhe) => linhasDosDiagnosticos([{ gravidade: 'erro', resumo, detalhe }]);
const aviso = (resumo, detalhe) => linhasDosDiagnosticos([{ gravidade: 'aviso', resumo, detalhe }]);

/** Divide a linha em palavras, respeitando aspas simples e duplas (`-var 'nome=Ana Lia'`). */
export function dividir(texto) {
  const partes = [];
  const re = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
  for (const m of texto.match(re) ?? []) partes.push(m.replace(/"([^"]*)"|'([^']*)'/g, (_, a, b) => a ?? b));
  return partes;
}

/** As opções de um comando: `-auto-approve`, `-var k=v` / `-var=k=v`, `-json`... */
function lerOpcoes(args) {
  const flags = new Set();
  const variaveis = {};
  const posicionais = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const atribuicao = a === '-var' ? args[++i] : a.startsWith('-var=') ? a.slice(5) : null;
    if (atribuicao !== null && atribuicao !== undefined) {
      const igual = atribuicao.indexOf('=');
      if (igual > 0) variaveis[atribuicao.slice(0, igual)] = valorDaCli(atribuicao.slice(igual + 1));
    } else if (a.startsWith('-')) {
      flags.add(a.replace(/^--?/, ''));
    } else {
      posicionais.push(a);
    }
  }
  return { flags, variaveis, posicionais };
}

/** `-var 'portas=[80, 443]'` vira lista; o resto fica texto (o tipo da variável converte). */
function valorDaCli(texto) {
  if (!/^\s*[[{]/.test(texto)) return texto;
  try {
    return avaliar(analisarExpressao(texto), { variaveis: {}, locais: {}, funcoes: true });
  } catch {
    return texto;
  }
}

const AJUDA_TERRAFORM = `Usage: terraform [global options] <subcommand> [args]

The available commands for execution are listed below.
The primary workflow commands are given first, followed by
less common or more advanced commands.

Main commands:
  init          Prepare your working directory for other commands
  validate      Check whether the configuration is valid
  plan          Show changes required by the current configuration
  apply         Create or update infrastructure
  destroy       Destroy previously-created infrastructure

All other commands:
  console       Try Terraform expressions at an interactive command prompt
  fmt           Reformat your configuration in the standard style
  graph         Generate a Graphviz graph of the steps in an operation
  output        Show output values from your root module
  show          Show the current state or a saved plan
  state         Advanced state management
  version       Show the current Terraform version
  workspace     Workspace management

Global options (use these before the subcommand, if any):
  -help         Show this help output, or the help for a specified subcommand.
  -version      An alias for the "version" subcommand.
`;

const AJUDA_SHELL = `Comandos do terminal:
  terraform init                  prepara a pasta (baixa os provedores)
  terraform validate              confere a configuração
  terraform fmt [-check] [-diff]  arruma o recuo e alinha os =
  terraform plan [-var 'x=1']     mostra o que vai mudar
  terraform apply [-auto-approve] aplica (pergunta: só yes aprova)
  terraform destroy               destrói tudo (também pergunta)
  terraform output | show | state list | state show <endereço>
  terraform workspace list | show | new <nome> | select <nome> | delete <nome>
  terraform graph | console | version | -help
  ls  cat <arquivo>  clear  help
Teclas: ↑/↓ histórico · Tab completa · Ctrl+C cancela · Ctrl+L limpa · Esc sai do terminal
`;

const COMANDO_INEXISTENTE = (nome) => `Terraform has no command named "${nome}".

To see all of Terraform's top-level commands, run:
  terraform -help
`;

/** Provedores que ainda não passaram pelo `terraform init` (ou mudaram de versão). */
function errosDeInit(r, ctx) {
  const init = ctx.inicializado();
  const externos = (r.provedores ?? []).filter((p) => !p.embutido);
  if (init && externos.every((p) => init[p.fonte] === p.versao)) return null;
  const itens = externos.filter((p) => !init || init[p.fonte] !== p.versao).map((p) => (init?.[p.fonte]
    ? `  - provider registry.terraform.io/${p.fonte}: locked version selection ${init[p.fonte]} doesn't match the updated version constraints "${p.restricao ?? '*'}"`
    : `  - provider registry.terraform.io/${p.fonte}: required by this configuration but no version is selected`));
  const mudou = init && itens.length;
  return erro('Inconsistent dependency lock file', [
    'The following dependency selections recorded in the lock file are',
    'inconsistent with the current configuration:',
    ...(itens.length ? itens : ['  - a pasta ainda não foi inicializada (não há .terraform nem lock file)']),
    '',
    mudou ? 'To update the locked dependency selections to match a changed configuration, run:' : 'To make the initial dependency selections that will initialize the',
    ...(mudou ? ['  terraform init -upgrade'] : ['dependency lock file, run:', '  terraform init']),
  ].join('\n'));
}

/** Variável obrigatória sem valor: o Terraform pergunta no terminal, como no de verdade. */
const VARIAVEL_FALTANDO = /^A variável "([^"]+)" não tem default/;

/**
 * Roda o motor com o estado e o workspace do terminal. Sem valor para uma variável
 * obrigatória, pergunta (`var.nome` / `Enter a value:`) e roda de novo.
 * Devolve null se a pessoa cancelou a pergunta.
 */
async function executar(ctx, comando, variaveis) {
  const valores = { ...variaveis };
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const r = executarTerraform(ctx.arquivos(), {
      comando, estado: ctx.estado() ?? undefined, workspace: ctx.workspace(), semente: ctx.semente, variaveis: valores,
    });
    const faltando = r.diagnosticos.find((d) => d.resumo === 'No value for required variable' && VARIAVEL_FALTANDO.test(d.detalhe ?? ''));
    if (!faltando || !ctx.perguntar) return r;
    const nome = faltando.detalhe.match(VARIAVEL_FALTANDO)[1];
    ctx.escrever(`var.${nome}\n`, 'forte');
    const resposta = await ctx.perguntar('  Enter a value: ', `Valor da variável ${nome}`);
    if (resposta === null) return r;
    valores[nome] = valorDaCli(resposta);
    ctx.escrever('\n');
  }
  return null;
}

// ---------- os comandos ----------

async function init(ctx) {
  const r = executarTerraform(ctx.arquivos(), { comando: 'plan', estado: ctx.estado() ?? undefined, workspace: ctx.workspace(), semente: ctx.semente });
  const antes = ctx.inicializado();
  const externos = (r.provedores ?? []).filter((p) => !p.embutido);
  const primeiraVez = !antes || externos.some((p) => antes[p.fonte] !== p.versao);
  await ctx.mostrar(linhasDoInit(r, { primeiraVez }));
  if (r.fase !== 'init') ctx.gravarInicializado(Object.fromEntries(externos.map((p) => [p.fonte, p.versao])));
}

/** O que precisa do init: com erro, mostra e devolve null. */
async function comInit(ctx, comando, variaveis = {}) {
  const r = await executar(ctx, comando, variaveis);
  if (!r) return null;
  const falta = r.fase === 'init' ? null : errosDeInit(r, ctx);
  if (falta) {
    await ctx.mostrar(falta);
    return null;
  }
  return r;
}

async function validate(ctx) {
  const r = await comInit(ctx, 'plan');
  if (!r) return;
  // O validate não precisa dos valores das variáveis: só a falta deles não é erro aqui.
  const diags = r.diagnosticos.filter((d) => d.resumo !== 'No value for required variable');
  await ctx.mostrar(linhasDosDiagnosticos(diags));
  if (diags.some((d) => d.gravidade === 'erro')) return;
  ctx.escrever(diags.length
    ? 'Success! The configuration is valid, but there were some validation warnings as shown above.\n'
    : 'Success! The configuration is valid.\n', 'sucesso forte');
}

async function plan(ctx, { flags, variaveis }) {
  const r = await comInit(ctx, flags.has('destroy') ? 'destroy' : 'plan', variaveis);
  if (!r) return;
  // `plan -destroy` mostra o plano de destruição, mas não aplica nada.
  const comoPlano = { ...r, comando: 'plan', estado: ctx.estado() ?? vazio() };
  await ctx.mostrar([linha(''), ...linhasDoPlano(flags.has('destroy') ? { ...comoPlano, comando: 'destroy' } : comoPlano)]);
  ctx.aoResultado(comoPlano, 'plan');
}

async function aplicar(ctx, comando, { flags, variaveis }) {
  // O motor calcula o plano e o resultado do apply de uma vez: o que é aplicado depois do
  // "yes" é exatamente o plano mostrado, mesmo se o código mudar enquanto a pergunta espera.
  const r = await comInit(ctx, comando, variaveis);
  if (!r) return;
  await ctx.mostrar([linha(''), ...linhasDoPlano(r)]);
  if (!seguePara(r)) {
    ctx.aoResultado({ ...r, estado: ctx.estado() ?? vazio() }, comando);
    return;
  }
  if (temMudancas(r) && !flags.has('auto-approve')) {
    await ctx.mostrar(linhasDaPergunta(r).slice(0, -1));
    const resposta = await ctx.perguntar('  Enter a value: ', 'Resposta do Terraform: digite yes para aprovar');
    if (resposta !== 'yes') {
      ctx.escrever(`\n${comando === 'destroy' ? 'Destroy' : 'Apply'} cancelled.\n`, 'erro forte');
      return;
    }
    await ctx.mostrar([linha('')]);
  }
  await ctx.mostrar(linhasDoApply(r));
  ctx.gravarEstado(r.estado);
  ctx.aoResultado(r, comando);
}

function output(ctx, { flags, posicionais }) {
  const saidas = comoTfstate(ctx.estado() ?? vazio()).outputs;
  const [nome] = posicionais;
  if (nome && !(nome in saidas)) {
    return ctx.mostrar(erro(`Output "${nome}" not found`, 'The output variable requested could not be found in the state file. If you recently\nadded this to your configuration, be sure to run `terraform apply`, since the state\nwon\'t be updated with new output variables until that command is run.'));
  }
  const json = (s) => ({ sensitive: Boolean(s.sensitive), type: s.type, value: s.value });
  if (flags.has('json')) {
    const valor = nome ? saidas[nome].value : Object.fromEntries(Object.entries(saidas).map(([k, s]) => [k, json(s)]));
    return ctx.escrever(`${JSON.stringify(valor, null, 2)}\n`);
  }
  if (nome) {
    const s = saidas[nome];
    if (flags.has('raw')) {
      if (s.value !== null && typeof s.value === 'object') {
        return ctx.mostrar(erro('Unsupported value for raw output', `The -raw option only supports strings, numbers, and boolean values, but output value "${nome}" is ${Array.isArray(s.value) ? 'a list' : 'an object'}.\n\nUse the -json option for machine-readable representations of output values that have complex types.`));
      }
      return ctx.escrever(`${s.value}\n`);
    }
    return ctx.escrever(`${s.sensitive ? '<sensitive>' : formatarValor(s.value)}\n`);
  }
  const nomes = Object.keys(saidas).sort();
  if (!nomes.length) {
    return ctx.mostrar(aviso('No outputs found', 'The state file either has no outputs defined, or all the defined outputs\nare empty. Please define an output in your configuration with the `output`\nkeyword and run `terraform refresh` for it to become available. If you\nare using interpolation, please verify the interpolated value is not\nempty. You can use the `terraform console` command to assist.'));
  }
  return ctx.escrever(`${nomes.map((k) => `${k} = ${saidas[k].sensitive ? '<sensitive>' : formatarValor(saidas[k].value)}`).join('\n')}\n`);
}

/** Um recurso do estado como o `terraform show` mostra. */
function textoDoRecurso(endereco, r) {
  const atributos = Object.entries(r.atributos ?? {}).filter(([, v]) => v !== null && v !== undefined).sort(([a], [b]) => (a < b ? -1 : 1));
  const largura = Math.max(0, ...atributos.map(([k]) => k.length));
  const sensiveis = new Set(r.sensiveis ?? []);
  return [
    `# ${endereco}:`,
    `${r.modo === 'data' ? 'data' : 'resource'} "${r.tipo}" "${r.nome}" {`,
    ...atributos.map(([k, v]) => `    ${k.padEnd(largura)} = ${sensiveis.has(k) ? '(sensitive value)' : formatarValor(v, '  ')}`),
    '}',
  ].join('\n');
}

function show(ctx, { flags }) {
  const estado = ctx.estado() ?? vazio();
  if (flags.has('json')) return ctx.escrever(`${JSON.stringify(comoTfstate(estado))}\n`);
  const recursos = Object.entries(estado.recursos ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));
  if (!recursos.length) return ctx.escrever('The state file is empty. No resources are represented.\n');
  const saidas = Object.entries(estado.saidas ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));
  const partes = recursos.map(([endereco, r]) => textoDoRecurso(endereco, r));
  if (saidas.length) partes.push(`\nOutputs:\n\n${saidas.map(([k, s]) => `${k} = ${s.sensivel ? '(sensitive value)' : formatarValor(s.valor)}`).join('\n')}`);
  return ctx.escrever(`${partes.join('\n\n')}\n`);
}

function state(ctx, { posicionais }) {
  const [sub, endereco] = posicionais;
  const recursos = (ctx.estado() ?? vazio()).recursos ?? {};
  if (sub === 'list') {
    const lista = Object.keys(recursos).sort();
    return lista.length ? ctx.escrever(`${lista.join('\n')}\n`) : undefined;
  }
  if (sub === 'show') {
    if (!endereco) return ctx.mostrar(erro('Exactly one argument expected', 'The state show command requires exactly one argument: the address of the resource instance to show.'));
    if (!recursos[endereco]) return ctx.mostrar(erro('No instance found for the given address!', 'This command requires that the address references one specific instance.\nTo view the available instances, use "terraform state list". Please modify\nthe address to reference a specific instance.'));
    return ctx.escrever(`${textoDoRecurso(endereco, recursos[endereco])}\n`);
  }
  return ctx.escrever('Usage: terraform [global options] state <subcommand> [options] [args]\n\nSubcommands:\n    list    List resources in the state\n    show    Show a resource in the state\n');
}

function workspace(ctx, { posicionais }) {
  const [sub, nome] = posicionais;
  const existentes = ctx.workspaces();
  switch (sub) {
    case 'list':
      return ctx.escrever(`${[...existentes].sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a < b ? -1 : 1)).map((w) => `${w === ctx.workspace() ? '*' : ' '} ${w}`).join('\n')}\n\n`);
    case 'show':
      return ctx.escrever(`${ctx.workspace()}\n`);
    case 'select':
      if (!existentes.includes(nome)) {
        return ctx.escrever(`\nWorkspace "${nome}" doesn't exist.\n\nYou can create this workspace with the "new" subcommand\nor include the "-or-create" flag with the "select" subcommand.\n`, 'erro');
      }
      ctx.trocarWorkspace(nome);
      return ctx.escrever(`Switched to workspace "${nome}".\n`, 'sucesso');
    case 'new':
      if (!nome || !/^[A-Za-z0-9_-]+$/.test(nome)) return ctx.escrever('The workspace name contains invalid characters. Use letters, numbers, - and _.\n', 'erro');
      if (existentes.includes(nome)) return ctx.escrever(`Workspace "${nome}" already exists\n`, 'erro');
      ctx.criarWorkspace(nome);
      return ctx.escrever(`Created and switched to workspace "${nome}"!\n\nYou're now on a new, empty workspace. Workspaces isolate their state,\nso if you run "terraform plan" Terraform will not see any existing state\nfor this configuration.\n`, 'sucesso');
    case 'delete':
      if (nome === 'default') return ctx.escrever('Can\'t delete default state\n', 'erro');
      if (!existentes.includes(nome)) return ctx.escrever(`Workspace "${nome}" doesn't exist.\n`, 'erro');
      if (nome === ctx.workspace()) return ctx.escrever(`Workspace "${nome}" is your active workspace.\n\nYou cannot delete the currently active workspace. Please switch\nto another workspace and try again.\n`, 'erro');
      ctx.apagarWorkspace?.(nome);
      return ctx.escrever(`Deleted workspace "${nome}"!\n`, 'sucesso');
    default:
      return ctx.escrever('Usage: terraform [global options] workspace\n\n  new, list, show, select and delete Terraform workspaces.\n');
  }
}

function graph(ctx) {
  const r = executarTerraform(ctx.arquivos(), { comando: 'plan', estado: ctx.estado() ?? undefined, workspace: ctx.workspace(), semente: ctx.semente });
  const nos = r.grafo?.nos ?? [];
  const linhas = [
    'digraph G {',
    '  rankdir = "RL";',
    '  node [shape = rect, fontname = "sans-serif"];',
    ...nos.map((n) => `  "${n.id}" [label="${n.rotulo ?? n.id}"];`),
    ...(r.grafo?.arestas ?? []).map((a) => `  "${a.de}" -> "${a.para}";`),
    '}',
  ];
  ctx.escrever(`${linhas.join('\n')}\n`);
  ctx.abrirGrafo?.(r);
}

/** terraform fmt: arruma os .tf e .tfvars no editor e lista os que mudaram. */
function fmt(ctx, { flags }) {
  const arquivos = ctx.arquivos();
  const novos = { ...arquivos };
  const saida = [];
  for (const nome of Object.keys(arquivos).sort()) {
    if (!/\.(tf|tfvars)$/.test(nome)) continue;
    const formatado = formatarHcl(arquivos[nome]);
    if (formatado === arquivos[nome]) continue;
    saida.push(nome);
    if (flags.has('diff')) saida.push(...diferencaDeLinhas(nome, arquivos[nome], formatado));
    novos[nome] = formatado;
  }
  if (!flags.has('check') && saida.length) ctx.trocarArquivos(novos);
  if (saida.length) ctx.escrever(`${saida.join('\n')}\n`);
}

function version(ctx) {
  const init = ctx.inicializado() ?? {};
  const provedores = Object.entries(init).sort(([a], [b]) => (a < b ? -1 : 1)).map(([fonte, v]) => `+ provider registry.terraform.io/${fonte} v${v}`);
  ctx.escrever(`Terraform v${VERSAO_TERRAFORM}\non linux_amd64\n${provedores.length ? `${provedores.join('\n')}\n` : ''}`);
}

/** Subcomandos que ainda não existem no simulador entram aqui (fmt e console, nas próximas tarefas). */
export const SUBCOMANDOS = {
  init: (ctx) => init(ctx),
  validate: (ctx) => validate(ctx),
  fmt: (ctx, o) => fmt(ctx, o),
  plan: (ctx, o) => plan(ctx, o),
  apply: (ctx, o) => aplicar(ctx, 'apply', o),
  destroy: (ctx, o) => aplicar(ctx, 'destroy', o),
  output: (ctx, o) => output(ctx, o),
  show: (ctx, o) => show(ctx, o),
  state: (ctx, o) => state(ctx, o),
  workspace: (ctx, o) => workspace(ctx, o),
  graph: (ctx) => graph(ctx),
  version: (ctx) => version(ctx),
};

/**
 * Roda uma linha digitada no terminal. `ctx`: arquivos/trocarArquivos, estado/gravarEstado,
 * workspace/trocarWorkspace/workspaces/criarWorkspace/apagarWorkspace, inicializado/
 * gravarInicializado, semente, mostrar(linhas) (anima), escrever(texto, classe),
 * perguntar(prompt, rotulo) → texto | null, abrirGrafo(r), aoResultado(r, comando), limpar().
 */
export async function rodarComando(texto, ctx) {
  const [cmd, ...args] = dividir(texto.trim());
  if (!cmd) return;
  if (cmd === 'clear') return ctx.limpar?.();
  if (cmd === 'help') return ctx.escrever(AJUDA_SHELL);
  if (cmd === 'ls') return ctx.escrever(`${Object.keys(ctx.arquivos()).sort().join('  ')}\n`);
  if (cmd === 'cat') {
    const conteudo = ctx.arquivos()[args[0]];
    if (conteudo === undefined) return ctx.escrever(`cat: ${args[0] ?? ''}: No such file or directory\n`, 'erro');
    return ctx.escrever(conteudo.endsWith('\n') || !conteudo ? conteudo : `${conteudo}\n`);
  }
  if (cmd !== 'terraform') return ctx.escrever(`bash: ${cmd}: command not found\n`, 'erro');
  const [sub, ...resto] = args;
  if (!sub || sub === '-help' || sub === '--help' || sub === '-h' || sub === 'help') return ctx.escrever(AJUDA_TERRAFORM);
  if (sub === '-version' || sub === '--version' || sub === '-v') return version(ctx);
  const fn = SUBCOMANDOS[sub];
  if (!fn) return ctx.escrever(COMANDO_INEXISTENTE(sub));
  return fn(ctx, lerOpcoes(resto));
}

/** Para o Tab: subcomandos, opções comuns e endereços do estado. */
export function completarComando(texto, ctx) {
  const partes = dividir(texto);
  const nova = !texto || /\s$/.test(texto);
  const ultima = nova ? '' : partes.pop() ?? '';
  const antes = partes.length ? `${partes.join(' ')} ` : '';
  let opcoes;
  if (!partes.length) opcoes = ['terraform', 'ls', 'cat', 'clear', 'help'];
  else if (partes[0] === 'cat') opcoes = Object.keys(ctx.arquivos()).sort();
  else if (partes[0] !== 'terraform') opcoes = [];
  else if (partes.length === 1) opcoes = Object.keys(SUBCOMANDOS);
  else if (partes[1] === 'state' && partes.length === 2) opcoes = ['list', 'show'];
  else if (partes[1] === 'state' && partes[2] === 'show') opcoes = Object.keys((ctx.estado() ?? vazio()).recursos ?? {}).sort();
  else if (partes[1] === 'workspace' && partes.length === 2) opcoes = ['list', 'show', 'select', 'new', 'delete'];
  else if (partes[1] === 'workspace' && ['select', 'delete'].includes(partes[2])) opcoes = ctx.workspaces();
  else if (partes[1] === 'output') opcoes = Object.keys((ctx.estado() ?? vazio()).saidas ?? {}).sort();
  else if (['apply', 'destroy'].includes(partes[1])) opcoes = ['-auto-approve', '-var'];
  else if (partes[1] === 'plan') opcoes = ['-destroy', '-var'];
  else if (partes[1] === 'fmt') opcoes = ['-check', '-diff'];
  else opcoes = [];
  return opcoes.filter((o) => o.startsWith(ultima)).map((o) => antes + o);
}
