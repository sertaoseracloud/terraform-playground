// Texto do terminal no formato do Terraform (em inglês, como na vida real, para o
// aluno reconhecer a saída) com as explicações dos erros em português.
// Cada linha vem com uma classe para colorir (criar, alterar, destruir, erro...) e,
// para o terminal animado, o ritmo em que aparece:
//   atraso:  milissegundos de espera antes da linha (download, refresh, recurso demorado...);
//   digitar: a partir de qual caractere o texto é "digitado" (comandos e o "yes").
import { ehDesconhecido, ehObjeto, ehConjunto, comoHcl, textoDoNumero } from './valores.js';

const SIMBOLO = { criar: '+', alterar: '~', destruir: '-', substituir: '-/+', substituirAntes: '+/-', importar: ' ', ler: '<=', esquecer: '.' };

/** Uma lista de linhas com `add(texto, classe, { atraso, digitar })` e `pausar(ms)`. */
function criarLinhas() {
  const L = [];
  let espera = 0;
  const add = (texto, classe = '', ritmo = {}) => {
    const linha = { texto, classe };
    const atraso = (ritmo.atraso ?? 0) + espera;
    espera = 0;
    if (atraso) linha.atraso = atraso;
    if (ritmo.digitar !== undefined) linha.digitar = ritmo.digitar;
    L.push(linha);
  };
  /** A próxima linha espera `ms` (o Terraform "pensando"). */
  const pausar = (ms) => { espera += ms; };
  return { L, add, pausar };
}

/** `$ terraform ...` como se fosse digitado. */
export function linhaDoComando(texto, atraso = 0) {
  return { texto: `$ ${texto}`, classe: 'comando', digitar: 2, ...(atraso ? { atraso } : {}) };
}

/**
 * Linhas do terminal para um resultado de executarTerraform: a sessão inteira (init,
 * workspace, o comando, a pergunta com o "yes" digitado e o apply), como a correção e o
 * terminal animado mostram. O terminal interativo usa as partes (linhasDoInit, linhasDoPlano...).
 * `primeiraVez`: o init baixa os provedores (senão reaproveita os já instalados, como no
 * segundo `terraform init` de uma pasta).
 */
export function linhasDoResultado(r, { primeiraVez = true } = {}) {
  const L = [linhaDoComando('terraform init'), ...linhasDoInit(r, { primeiraVez })];
  if (r.fase === 'init') return L;
  if (r.fase === 'validate') return [...L, ...linhasDosDiagnosticos(r.diagnosticos)];
  if (r.workspace && r.workspace !== 'default') {
    L.push(linhaDoComando(`terraform workspace select ${r.workspace}`, 250));
    L.push({ texto: `Switched to workspace "${r.workspace}".`, classe: 'sucesso', atraso: 120 }, { texto: '', classe: '' });
  }
  L.push(linhaDoComando(`terraform ${r.comando === 'destroy' ? 'destroy' : r.comando === 'apply' ? 'apply' : 'plan'}`, 350));
  L.push({ texto: '', classe: '' }, ...linhasDoPlano(r));
  if (!seguePara(r)) return L;
  if (temMudancas(r)) {
    L.push(...linhasDaPergunta(r).slice(0, -1));
    L.push({ texto: '  Enter a value: yes', classe: 'forte', digitar: 17, atraso: 650 }, { texto: '', classe: '' });
  }
  return [...L, ...linhasDoApply(r)];
}

/** Depois do plano, o apply/destroy segue (para a pergunta ou direto para o apply)? */
export function seguePara(r) {
  if (r.comando !== 'apply' && r.comando !== 'destroy') return false;
  if (!r.plano) return false;
  return !(r.comando === 'destroy' && r.diagnosticos.some((d) => d.gravidade === 'erro'));
}

/** As caixas ╷ │ Error: … ╵ de cada diagnóstico. */
export function linhasDosDiagnosticos(lista) {
  const { L, add } = criarLinhas();
  for (const d of lista) caixa(d, add);
  return L;
}

/** O bloco do `terraform init` (sem a linha do comando). Com erro no init, as caixas dele. */
export function linhasDoInit(r, { primeiraVez = true } = {}) {
  const { L, add } = criarLinhas();
  add('');
  add('Initializing the backend...', 'titulo', { atraso: 160 });
  if (r.init?.backend?.tipo && r.init.backend.tipo !== 'local') {
    add('');
    add(`Successfully configured the backend "${r.init.backend.tipo}"! Terraform will automatically`, 'sucesso', { atraso: 220 });
    add('use this backend unless the backend configuration changes.', 'sucesso');
  }
  add('Initializing provider plugins...', 'titulo', { atraso: 140 });
  const externos = (r.provedores ?? []).filter((p) => !p.embutido);
  for (const p of r.provedores ?? []) {
    if (p.embutido) {
      add('- terraform.io/builtin/terraform is built in to Terraform', '', { atraso: 40 });
    } else if (primeiraVez) {
      add(`- Finding ${p.fonte} versions matching "${p.restricao ?? '*'}"...`, '', { atraso: 320 });
      add(`- Installing ${p.fonte} v${p.versao}...`, '', { atraso: 260 });
      add(`- Installed ${p.fonte} v${p.versao} (signed by HashiCorp)`, '', { atraso: 520 });
    } else {
      add(`- Reusing previous version of ${p.fonte} from the dependency lock file`, '', { atraso: 60 });
      add(`- Using previously-installed ${p.fonte} v${p.versao}`, '', { atraso: 60 });
    }
  }
  const errosInit = r.fase === 'init';
  if (!errosInit) {
    if (primeiraVez && externos.length) {
      add('');
      add('Terraform has created a lock file .terraform.lock.hcl to record the provider', '', { atraso: 80 });
      add('selections it made above. Include this file in your version control repository');
      add('so that Terraform can guarantee to make the same selections by default when');
      add('you run "terraform init" in the future.');
    }
    add('');
    add('Terraform has been successfully initialized!', 'sucesso forte', { atraso: 90 });
  }
  add('');
  if (errosInit) for (const d of r.diagnosticos) caixa(d, add);
  return L;
}

/**
 * O plano de um plan/apply/destroy (sem a linha do comando): leituras, ações, resumo e
 * avisos. Os erros aparecem aqui, menos os do apply (a API recusou), que vêm no linhasDoApply.
 */
export function linhasDoPlano(r) {
  const { L, add, pausar } = criarLinhas();
  const avisos = r.diagnosticos.filter((d) => d.gravidade === 'aviso');
  const erros = r.diagnosticos.filter((d) => d.gravidade === 'erro');
  if (!r.plano) {
    pausar(300);
    for (const d of [...avisos, ...erros]) caixa(d, add);
    return L;
  }
  if (escreverLeituras(r, add)) add('');
  pausar(450);
  escreverPlano(r, add);
  for (const d of avisos) caixa(d, add);
  if (erros.length && r.comando !== 'apply') for (const d of erros) caixa(d, add);
  return L;
}

/** "Do you want to perform these actions?" até o "  Enter a value: " (sem a resposta). */
export function linhasDaPergunta(r) {
  const { L, add } = criarLinhas();
  escreverConfirmacao(r, add);
  return L;
}

/** O que vem depois do "yes": o progresso de cada recurso, o resumo e os outputs. */
export function linhasDoApply(r) {
  const { L, add } = criarLinhas();
  escreverApply(r, r.diagnosticos.filter((d) => d.gravidade === 'erro'), add);
  return L;
}

/** Antes do plano: o Terraform lê os data sources e atualiza o que já está no estado. */
function escreverLeituras(r, add) {
  let escreveu = false;
  const adiados = new Set((r.plano.dadosLidos ?? []).map((d) => d.endereco));
  for (const d of r.dados ?? []) {
    if (adiados.has(d.endereco)) continue;
    add(`${d.endereco}: Reading...`, 'forte', { atraso: 70 });
    add(`${d.endereco}: Read complete after 0s${idDe(d.valor)}`, 'forte', { atraso: 140 });
    escreveu = true;
  }
  for (const a of r.plano.acoes) {
    if (!a.antes || a.acao === 'importar') continue;
    add(`${a.endereco}: Refreshing state...${idDe(a.antes)}`, 'forte', { atraso: 60 });
    escreveu = true;
  }
  return escreveu;
}

const idDe = (valor) => (valor?.id !== undefined && valor.id !== null && !ehDesconhecido(valor.id) && valor.id !== '' ? ` [id=${valor.id}]` : '');

/** O plano muda alguma coisa? (Sem mudanças, o apply não pergunta.) */
export function temMudancas(r) {
  return r.plano.acoes.some((a) => a.acao !== 'nada') || r.plano.saidas.some((s) => s.acao !== 'nada') || r.plano.movidos.length > 0;
}

/** "Do you want to perform these actions?" até o "Enter a value: " (a resposta vem do terminal). */
function escreverConfirmacao(r, add) {
  const ws = r.workspace && r.workspace !== 'default' ? ` in workspace "${r.workspace}"` : '';
  if (r.comando === 'destroy') {
    add(`Do you really want to destroy all resources${ws}?`, 'forte', { atraso: 250 });
    add('  Terraform will destroy all your managed infrastructure, as shown above.');
    add('  There is no undo. Only \'yes\' will be accepted to confirm.');
  } else {
    add(`Do you want to perform these actions${ws}?`, 'forte', { atraso: 250 });
    add('  Terraform will perform the actions described above.');
    add('  Only \'yes\' will be accepted to approve.');
  }
  add('');
  add('  Enter a value: ', 'forte');
}

export function textoDoResultado(r) {
  return linhasDoResultado(r).map((l) => l.texto).join('\n');
}

function caixa(d, add) {
  const classe = d.gravidade === 'erro' ? 'erro' : 'aviso';
  add('╷', classe);
  add(`│ ${d.gravidade === 'erro' ? 'Error' : 'Warning'}: ${d.resumo}`, `${classe} forte`);
  add('│', classe);
  if (d.arquivo && d.linha) {
    add(`│   on ${d.arquivo} line ${d.linha}${d.contexto ? `, ${d.contexto}` : ''}:`, classe);
    if (d.trecho !== undefined) add(`│   ${String(d.linha).padStart(2)}: ${d.trecho.trimEnd()}`, `${classe} trecho`);
    add('│', classe);
  } else if (d.contexto) {
    add(`│   ${d.contexto}`, classe);
    add('│', classe);
  }
  for (const linha of String(d.detalhe ?? '').split('\n')) add(`│ ${linha}`, `${classe} explicacao`);
  add('╵', classe);
}

// ---------- plano ----------

function escreverPlano(r, add) {
  const { acoes, resumo, saidas, movidos, dadosLidos } = r.plano;
  const mudam = acoes.filter((a) => a.acao !== 'nada');
  const saidasMudam = saidas.filter((s) => s.acao !== 'nada');
  if (!mudam.length && !dadosLidos.length && !movidos.length) {
    if (!saidasMudam.length && r.comando === 'destroy') {
      add('No changes. No objects need to be destroyed.', 'sucesso forte');
      add('');
      add('Either you have not created any objects yet or the existing objects were');
      add('already deleted outside of Terraform.');
      add('');
      return;
    }
    if (!saidasMudam.length) {
      add('No changes. Your infrastructure matches the configuration.', 'sucesso forte');
      add('');
      add('Terraform has compared your real infrastructure against your configuration');
      add('and found no differences, so no changes are needed.');
      add('');
      return;
    }
  }
  const simbolos = new Set(mudam.map((a) => (a.acao === 'substituir' && a.createBeforeDestroy ? 'substituirAntes' : a.acao)));
  if (dadosLidos.length) simbolos.add('ler');
  if (simbolos.size) {
    add('Terraform used the selected providers to generate the following execution');
    add('plan. Resource actions are indicated with the following symbols:');
    const nomes = { criar: 'create', alterar: 'update in-place', destruir: 'destroy', substituir: 'destroy and then create replacement', substituirAntes: 'create replacement and then destroy', importar: 'import', ler: 'read (data resources)', esquecer: 'forget' };
    for (const s of ['criar', 'alterar', 'destruir', 'substituir', 'substituirAntes', 'ler']) {
      if (simbolos.has(s)) add(`  ${SIMBOLO[s].padStart(3)} ${nomes[s]}`, classeDe(s));
    }
    add('');
    add('Terraform will perform the following actions:', 'titulo');
    add('');
  }
  for (const d of dadosLidos) {
    add(`  # ${d.endereco} will be read during apply`, 'comentario');
    add('  # (config refers to values not yet known)', 'comentario');
    add(` <= data "${d.tipo}" "${d.nome}" {`, 'ler');
    atributos(d.depois, d.def, new Set(), '      ', 'ler', add, null);
    add('    }', 'ler');
    add('');
  }
  for (const m of movidos) {
    if (acoes.some((a) => a.endereco === m.para && a.acao !== 'nada')) continue;
    const a = acoes.find((x) => x.endereco === m.para);
    add(`  # ${m.de} has moved to ${m.para}`, 'comentario');
    add(`    resource "${a?.tipo ?? m.para.split('.').slice(-2)[0]}" "${a?.nome ?? m.para.split('.').slice(-1)[0].replace(/\[.*$/, '')}" {`, '');
    if (a?.antes?.id) add(`        id = ${JSON.stringify(a.antes.id)}`);
    add('        # (unchanged attributes hidden)', 'comentario');
    add('    }');
    add('');
  }
  for (const a of mudam) escreverAcao(a, add);
  const partes = [];
  if (resumo.importar) partes.push(`${resumo.importar} to import`);
  partes.push(`${resumo.criar} to add`, `${resumo.alterar} to change`, `${resumo.destruir} to destroy`);
  if (resumo.esquecer) partes.push(`${resumo.esquecer} to forget`);
  if (mudam.length || movidos.length) {
    add(`Plan: ${partes.join(', ')}.`, 'forte');
  }
  if (saidasMudam.length) {
    add('');
    add('Changes to Outputs:', 'titulo');
    for (const s of saidasMudam) {
      const v = (x) => (s.sensivel ? '(sensitive value)' : formatarValor(x, '    '));
      if (s.acao === 'criar') add(`  + ${s.nome} = ${v(s.depois)}`, 'criar');
      else if (s.acao === 'destruir') add(`  - ${s.nome} = ${v(s.antes)} -> null`, 'destruir');
      else add(`  ~ ${s.nome} = ${v(s.antes)} -> ${v(s.depois)}`, 'alterar');
    }
  }
  add('');
  if (r.comando === 'plan') {
    add('─'.repeat(70), 'comentario');
    add('');
    add('Note: You didn\'t use the -out option to save this plan, so Terraform can\'t', 'comentario');
    add('guarantee to take exactly these actions if you run "terraform apply" now.', 'comentario');
  }
}

function classeDe(acao) {
  return { criar: 'criar', alterar: 'alterar', destruir: 'destruir', substituir: 'substituir', substituirAntes: 'substituir', importar: 'criar', ler: 'ler', esquecer: 'comentario' }[acao] ?? '';
}

function escreverAcao(a, add) {
  const [tipo, nome] = [a.tipo, a.nome];
  const classe = classeDe(a.acao);
  switch (a.acao) {
    case 'criar': add(`  # ${a.endereco} will be created`, 'comentario'); break;
    case 'alterar': add(`  # ${a.endereco} will be updated in-place`, 'comentario'); break;
    case 'substituir': add(`  # ${a.endereco} must be replaced`, 'comentario'); break;
    case 'importar': add(`  # ${a.endereco} will be imported`, 'comentario'); break;
    case 'esquecer':
      add(`  # ${a.endereco} will no longer be managed by Terraform`, 'comentario');
      add(`    resource "${tipo}" "${nome}" {`);
      add('        # (o recurso continua existindo na nuvem; só sai do estado)', 'comentario');
      add('    }');
      add('');
      return;
    case 'destruir':
      add(`  # ${a.endereco} will be destroyed`, 'comentario');
      if (a.motivo === 'config') {
        add(a.chave !== null && a.chave !== undefined && /\[\d+\]$/.test(a.endereco)
          ? `  # (because index ${a.endereco.match(/\[\d+\]$/)[0]} is out of range for count)`
          : `  # (because ${a.endereco.replace(/\[.*$/, '')} is not in configuration)`, 'comentario');
      }
      break;
    default:
  }
  const simbolo = a.acao === 'substituir' && a.createBeforeDestroy ? '+/-' : SIMBOLO[a.acao];
  add(`${simbolo.padStart(3)} resource "${tipo}" "${nome}" {`, classe);
  if (a.acao === 'criar') {
    atributos(a.depois, a.def, a.sensiveis, '      ', 'criar', add, null);
  } else if (a.acao === 'importar') {
    atributos(a.depois, a.def, a.sensiveis, '      ', 'importar', add, null);
  } else if (a.acao === 'destruir') {
    atributos(a.antes, a.def, a.sensiveis, '      ', 'destruir', add, null);
  } else {
    diferencas(a, add);
  }
  add('    }', classe);
  add('');
}

/** Atributos de um recurso criado ou destruído, em ordem alfabética, com os blocos no fim. */
function atributos(valores, def, sensiveis, recuo, modo, add) {
  if (!valores) return;
  const simbolo = { criar: '+', destruir: '-', ler: '+', importar: ' ' }[modo];
  const blocos = new Set(Object.keys(def?.blocos ?? {}));
  const simples = Object.keys(valores).filter((k) => !blocos.has(k) && valores[k] !== null && valores[k] !== undefined && !(Array.isArray(valores[k]) && !valores[k].length && !ehConjunto(valores[k]) && def?.args?.[k] === undefined && def?.calc?.[k] === undefined)).sort();
  const largura = Math.max(0, ...simples.map((k) => k.length));
  for (const k of simples) {
    const v = valores[k];
    const texto = sensiveis?.has(k) && !ehDesconhecido(v) ? '(sensitive value)' : formatarValor(v, `${recuo}  `, simbolo);
    add(`${recuo}${simbolo} ${k.padEnd(largura)} = ${texto}${modo === 'destruir' ? ' -> null' : ''}`, modo === 'ler' ? 'ler' : modo);
  }
  for (const nomeBloco of [...blocos].sort()) {
    const lista = valores[nomeBloco];
    if (!Array.isArray(lista) || !lista.length) continue;
    for (const item of lista) {
      add('');
      add(`${recuo}${simbolo} ${nomeBloco} {`, modo === 'ler' ? 'ler' : modo);
      atributos(item, def.blocos[nomeBloco], sensiveis, `${recuo}    `, modo, add);
      add(`${recuo}  }`, modo === 'ler' ? 'ler' : modo);
    }
  }
}

function diferencas(a, add) {
  const recuo = '      ';
  const antes = a.antes ?? {};
  const depois = a.depois ?? {};
  const blocos = new Set(Object.keys(a.def?.blocos ?? {}));
  const mudados = new Set(a.mudados);
  const forcam = new Set(a.forcam);
  let escondidos = 0;
  const linhas = [];
  for (const k of Object.keys({ ...antes, ...depois }).sort()) {
    if (blocos.has(k)) continue;
    const novo = depois[k];
    const velho = antes[k];
    const calculadoNovo = ehDesconhecido(novo);
    if (mudados.has(k) || (calculadoNovo && a.acao === 'substituir' && velho !== undefined && velho !== null && velho !== '')) {
      const sens = a.sensiveis?.has(k);
      const fmt = (x) => (sens && !ehDesconhecido(x) ? '(sensitive value)' : formatarValor(x, `${recuo}  `, '~'));
      if (velho === null || velho === undefined) linhas.push([`${recuo}+ ${k}`, fmt(novo), 'criar', forcam.has(k)]);
      else if (novo === null || novo === undefined) linhas.push([`${recuo}- ${k}`, `${fmt(velho)} -> null`, 'destruir', forcam.has(k)]);
      else if (ehObjeto(velho) && ehObjeto(novo) && !sens) linhas.push([`${recuo}~ ${k}`, diffMapa(velho, novo, recuo), 'alterar', forcam.has(k)]);
      else linhas.push([`${recuo}~ ${k}`, `${fmt(velho)} -> ${fmt(novo)}`, 'alterar', forcam.has(k)]);
    } else if (k === 'id' || k === 'name' || k === 'tags') {
      if (velho !== undefined && velho !== null && !(ehObjeto(velho) && !Object.keys(velho).length)) linhas.push([`${recuo}  ${k}`, formatarValor(velho, `${recuo}  `), '', false]);
    } else if (velho !== null && velho !== undefined) {
      escondidos += 1;
    }
  }
  const largura = Math.max(0, ...linhas.map(([n]) => n.length));
  for (const [nome, valor, classe, forca] of linhas) {
    add(`${nome.padEnd(largura)} = ${valor}${forca ? ' # forces replacement' : ''}`, forca ? `${classe} forte` : classe);
  }
  for (const k of [...blocos].sort()) {
    if (!mudados.has(k)) continue;
    add(`${recuo}~ ${k} {`, 'alterar');
    const n = depois[k]?.[0] ?? {};
    const o = antes[k]?.[0] ?? {};
    for (const campo of Object.keys({ ...n, ...o }).sort()) {
      if (ehDesconhecido(n[campo]) || JSON.stringify(n[campo]) === JSON.stringify(o[campo])) continue;
      if (Array.isArray(n[campo]) && Array.isArray(o[campo]) && !n[campo].length && !o[campo].length) continue;
      add(`${recuo}    ~ ${campo} = ${formatarValor(o[campo] ?? null, `${recuo}    `)} -> ${formatarValor(n[campo] ?? null, `${recuo}    `)}${forcam.has(k) ? ' # forces replacement' : ''}`, 'alterar');
    }
    add(`${recuo}  }`, 'alterar');
  }
  if (escondidos) add(`${recuo}# (${escondidos} unchanged attributes hidden)`, 'comentario');
}

/** Diferença de um mapa chave a chave: + nova, - removida, ~ alterada. */
function diffMapa(velho, novo, recuo) {
  const linhas = [];
  let iguaisEscondidos = 0;
  const chaves = [...new Set([...Object.keys(velho), ...Object.keys(novo)])].sort();
  const largura = Math.max(...chaves.map((k) => JSON.stringify(k).length));
  for (const k of chaves) {
    const nome = JSON.stringify(k).padEnd(largura);
    if (!(k in velho)) linhas.push(`${recuo}    + ${nome} = ${formatarValor(novo[k], `${recuo}    `)}`);
    else if (!(k in novo)) linhas.push(`${recuo}    - ${nome} = ${formatarValor(velho[k], `${recuo}    `)} -> null`);
    else if (JSON.stringify(velho[k]) !== JSON.stringify(novo[k])) linhas.push(`${recuo}    ~ ${nome} = ${formatarValor(velho[k], `${recuo}    `)} -> ${formatarValor(novo[k], `${recuo}    `)}`);
    else iguaisEscondidos += 1;
  }
  if (iguaisEscondidos) linhas.push(`${recuo}      # (${iguaisEscondidos} unchanged element${iguaisEscondidos > 1 ? 's' : ''} hidden)`);
  return `{\n${linhas.join('\n')}\n${recuo}  }`;
}

/** Valor no estilo do plano: listas e mapas em várias linhas, com + na frente de cada item. */
export function formatarValor(v, recuo = '', simbolo = '') {
  if (ehDesconhecido(v)) return '(known after apply)';
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') {
    if (v.includes('\n')) {
      const linhas = v.replace(/\n$/, '').split('\n');
      return `<<-EOT\n${linhas.map((l) => `${recuo}    ${l}`).join('\n')}\n${recuo}EOT`;
    }
    return JSON.stringify(v);
  }
  if (typeof v === 'number') return textoDoNumero(v);
  if (typeof v === 'boolean') return String(v);
  const pre = simbolo ? `${simbolo} ` : '';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const itens = v.map((x) => `${recuo}    ${pre}${formatarValor(x, `${recuo}    `, simbolo)},`).join('\n');
    return `${ehConjunto(v) ? '' : ''}[\n${itens}\n${recuo}  ]`;
  }
  if (ehObjeto(v)) {
    const chaves = Object.keys(v).sort();
    if (!chaves.length) return '{}';
    const largura = Math.max(...chaves.map((k) => JSON.stringify(k).length));
    return `{\n${chaves.map((k) => `${recuo}    ${pre}${JSON.stringify(k).padEnd(largura)} = ${formatarValor(v[k], `${recuo}    `, simbolo)}`).join('\n')}\n${recuo}  }`;
  }
  return comoHcl(v);
}

// ---------- apply / destroy ----------

function escreverApply(r, erros, add) {
  const eventos = r.estado?.eventos ?? [];
  const tempo = linhaDoTempo(r, erros);
  // O tempo simulado (minutos para um RDS ou um AKS) vira poucos segundos na tela.
  const total = tempo.at(-1)?.t ?? 0;
  const msPorSegundo = total ? Math.min(14, 7000 / total) : 0;
  let anterior = 0;
  for (const { t, texto, classe } of tempo) {
    add(texto, classe, { atraso: Math.min(600, Math.round((t - anterior) * msPorSegundo)) + 45 });
    anterior = t;
  }
  if (tempo.length) add('');
  for (const d of erros) caixa(d, add);
  if (erros.length) {
    add('');
    add('O apply parou com erro: o que foi criado antes do erro continua no estado.', 'comentario');
    return;
  }
  const n = (acao) => eventos.filter((e) => e.acao === acao).length;
  const substituidos = n('substituir');
  if (r.comando === 'destroy') {
    add(`Destroy complete! Resources: ${n('destruir')} destroyed.`, 'sucesso forte', { atraso: 200 });
    return;
  }
  const importados = n('importar');
  add(`Apply complete! Resources: ${importados ? `${importados} imported, ` : ''}${n('criar') + substituidos} added, ${n('alterar')} changed, ${n('destruir') + substituidos} destroyed.`, 'sucesso forte', { atraso: 200 });
  const saidas = Object.entries(r.estado?.saidas ?? {});
  if (saidas.length) {
    add('');
    add('Outputs:', 'titulo', { atraso: 80 });
    add('');
    for (const [nome, s] of saidas.sort(([a], [b]) => (a < b ? -1 : 1))) {
      add(`${nome} = ${s.sensivel ? '<sensitive>' : formatarValor(s.valor)}`, 'saida');
    }
  }
}

// ---------- linha do tempo do apply ----------
//
// Como o Terraform de verdade: cada recurso começa assim que as dependências terminam
// (vários ao mesmo tempo), os demorados mostram "Still creating... [00m10s elapsed]" a
// cada 10 segundos e o fim diz quanto levou. Os tempos são típicos de cada serviço
// (um bucket leva segundos, um cluster AKS leva minutos) e sempre os mesmos para o
// mesmo endereço, para a saída não mudar entre execuções.

/** Segundos típicos para criar cada tipo de recurso (o resto: 1 a 3 s; provedores locais: 0 s). */
const DURACAO = {
  aws_db_instance: 290, aws_cloudfront_distribution: 200, aws_elasticache_cluster: 420, aws_lb: 160,
  aws_nat_gateway: 105, aws_autoscaling_group: 50, aws_acm_certificate_validation: 40, aws_route53_zone: 35,
  aws_instance: 14, aws_subnet: 11, aws_dynamodb_table: 9, aws_lambda_function: 8, aws_ecs_service: 6,
  aws_ebs_volume: 10, aws_volume_attachment: 21, aws_eip: 2, aws_vpc: 2, aws_secretsmanager_secret: 1,
  azurerm_redis_cache: 960, azurerm_postgresql_flexible_server: 430, azurerm_cosmosdb_account: 390,
  azurerm_kubernetes_cluster: 340, azurerm_container_app_environment: 290, azurerm_key_vault: 190,
  azurerm_kubernetes_cluster_node_pool: 180, azurerm_application_gateway: 600, azurerm_mssql_server: 75,
  azurerm_linux_function_app: 62, azurerm_linux_virtual_machine_scale_set: 64, azurerm_linux_virtual_machine: 52,
  azurerm_private_endpoint: 48, azurerm_linux_web_app: 44, azurerm_mssql_database: 42, azurerm_container_app: 31,
  azurerm_role_assignment: 26, azurerm_storage_account: 24, azurerm_container_registry: 21, azurerm_nat_gateway: 19,
  azurerm_log_analytics_workspace: 12, azurerm_resource_group: 11, azurerm_service_plan: 9,
  azurerm_virtual_network: 6, azurerm_static_web_app: 6, azurerm_subnet: 5, azurerm_public_ip: 4,
  azurerm_lb: 4, azurerm_application_insights: 4, azurerm_dns_zone: 3, azurerm_key_vault_secret: 2,
};
const LOCAIS = /^(random_|local_|null_|terraform_data|tls_|archive_)/;

function hashTexto(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Segundos simulados para uma ação num recurso. */
function duracaoDe(tipo, acao, endereco) {
  if (LOCAIS.test(tipo) || acao === 'importar' || acao === 'esquecer') return 0;
  const base = DURACAO[tipo] ?? 1 + (hashTexto(tipo) % 3);
  const variacao = 0.85 + (hashTexto(endereco) % 31) / 100;
  const fator = { criar: 1, alterar: 0.35, destruir: tipo === 'aws_cloudfront_distribution' ? 0.9 : 0.45 }[acao] ?? 1;
  return Math.max(acao === 'destruir' ? 0 : 1, Math.round(base * variacao * fator));
}

function tempoDecorrido(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}m${String(s % 60).padStart(2, '0')}s`;
}
function duracaoTexto(s) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
}

const base = (endereco) => endereco.replace(/\[[^\]]*\]$/, '');
const tipoDoEndereco = (endereco) => base(endereco).replace(/^(module\.[^.]+\.)+/, '').replace(/^data\./, '').split('.')[0];

/** De quem cada nó depende (recursos e data sources), atravessando variáveis, locals e módulos. */
function dependenciasDoGrafo(r) {
  const diretas = new Map();
  for (const { de, para } of r.grafo?.arestas ?? []) {
    if (!diretas.has(de)) diretas.set(de, new Set());
    diretas.get(de).add(para);
  }
  const memo = new Map();
  const resolver = (no, visitando = new Set()) => {
    if (memo.has(no)) return memo.get(no);
    if (visitando.has(no)) return new Set();
    visitando.add(no);
    const todas = new Set();
    for (const alvo of diretas.get(no) ?? []) {
      if (/^(var|local|output)\./.test(alvo) || /^module\.[^.]+$/.test(alvo)) {
        for (const x of resolver(alvo, visitando)) todas.add(x);
        if (/^module\.[^.]+$/.test(alvo)) todas.add(alvo);
      } else {
        todas.add(alvo);
      }
    }
    memo.set(no, todas);
    return todas;
  };
  return (endereco) => {
    const modulo = endereco.match(/^module\.[^.[]+/)?.[0];
    const deps = new Set(resolver(base(endereco)));
    if (modulo) for (const x of resolver(modulo)) deps.add(x);
    for (const x of r.estado?.recursos?.[endereco]?.dependencias ?? []) deps.add(modulo && !x.startsWith('module.') ? `${modulo}.${x}` : x);
    return deps;
  };
}

function linhaDoTempo(r, erros) {
  const deps = dependenciasDoGrafo(r);
  const eventos = (r.estado?.eventos ?? []).map((e) => ({ ...e }));
  // Recursos que a API recusou: começam a ser criados e param no erro.
  for (const d of erros) {
    const endereco = d.contexto?.match(/^with (.+)$/)?.[1];
    if (endereco && !eventos.some((e) => e.endereco === endereco)) eventos.push({ endereco, acao: 'criar', falhou: true });
  }
  // Data sources que só podem ser lidos no apply.
  const lidosNoApply = new Set((r.plano?.dadosLidos ?? []).map((d) => d.endereco));
  for (const d of r.dados ?? []) {
    if (lidosNoApply.has(d.endereco)) eventos.push({ endereco: d.endereco, acao: 'ler', id: d.valor?.id });
  }

  // Quem pertence a cada nó do grafo (aws_subnet.a → aws_subnet.a[0], [1]...).
  const doNo = (no) => eventos.filter((e) => base(e.endereco) === no || e.endereco.startsWith(`${no}.`));
  const fim = new Map();
  const inicio = new Map();
  const destruindo = (e) => e.acao === 'destruir';

  const calcular = (e, pilha = new Set()) => {
    if (fim.has(e)) return fim.get(e);
    if (pilha.has(e)) return 0;
    pilha.add(e);
    let pronto = 0;
    if (destruindo(e)) {
      // Para destruir, espera quem depende dele ser destruído antes.
      for (const outro of eventos) {
        if (outro !== e && destruindo(outro) && deps(outro.endereco).has(base(e.endereco))) pronto = Math.max(pronto, calcular(outro, pilha));
      }
    } else {
      for (const no of deps(e.endereco)) {
        for (const outro of doNo(no)) if (outro !== e && !destruindo(outro)) pronto = Math.max(pronto, calcular(outro, pilha));
      }
    }
    const tipo = tipoDoEndereco(e.endereco);
    const d = e.acao === 'substituir'
      ? duracaoDe(tipo, 'destruir', e.endereco) + duracaoDe(tipo, 'criar', e.endereco)
      : e.acao === 'ler' ? 0 : duracaoDe(tipo, e.acao, e.endereco);
    inicio.set(e, pronto);
    fim.set(e, e.falhou ? pronto + Math.min(d, 3) : pronto + d);
    return fim.get(e);
  };
  eventos.forEach((e) => calcular(e));

  const linhas = [];
  let ordem = 0;
  // No Terraform as linhas de progresso saem em negrito, sem cor.
  const em = (t, texto) => linhas.push({ t, texto, classe: 'forte', ordem: ordem++ });
  for (const e of eventos) {
    const t0 = inicio.get(e);
    const t1 = fim.get(e);
    const id = e.id !== undefined && e.id !== null && e.id !== '' ? ` [id=${e.id}]` : '';
    const ticks = (desde, ate, verbo, comId) => {
      for (let s = 10; desde + s < ate; s += 10) em(desde + s, `${e.endereco}: Still ${verbo}... [${comId ? `id=${e.id}, ` : ''}${tempoDecorrido(s)} elapsed]`);
    };
    switch (e.acao) {
      case 'ler':
        em(t0, `${e.endereco}: Reading...`);
        em(t1, `${e.endereco}: Read complete after 0s${id}`);
        break;
      case 'importar':
        em(t0, `${e.endereco}: Importing...${id}`);
        em(t1, `${e.endereco}: Import complete${id}`);
        break;
      case 'esquecer':
        break;
      case 'destruir':
        em(t0, `${e.endereco}: Destroying...${id}`);
        ticks(t0, t1, 'destroying', Boolean(id));
        em(t1, `${e.endereco}: Destruction complete after ${duracaoTexto(t1 - t0)}`);
        break;
      case 'alterar':
        em(t0, `${e.endereco}: Modifying...${id}`);
        ticks(t0, t1, 'modifying', Boolean(id));
        em(t1, `${e.endereco}: Modifications complete after ${duracaoTexto(t1 - t0)}${id}`);
        break;
      case 'substituir': {
        const meio = t0 + duracaoDe(tipoDoEndereco(e.endereco), 'destruir', e.endereco);
        em(t0, `${e.endereco}: Destroying...`);
        em(meio, `${e.endereco}: Destruction complete after ${duracaoTexto(meio - t0)}`);
        em(meio, `${e.endereco}: Creating...`);
        ticks(meio, t1, 'creating');
        em(t1, `${e.endereco}: Creation complete after ${duracaoTexto(t1 - meio)}${id}`);
        break;
      }
      default:
        em(t0, `${e.endereco}: Creating...`);
        ticks(t0, t1, 'creating');
        if (!e.falhou) em(t1, `${e.endereco}: Creation complete after ${duracaoTexto(t1 - t0)}${id}`);
    }
  }
  return linhas.sort((a, b) => a.t - b.t || a.ordem - b.ordem);
}

/** Estado no formato do terraform.tfstate (versão 4), para a aba Estado. */
export function comoTfstate(estado, versaoTerraform = '1.13.3') {
  const recursos = new Map();
  for (const [endereco, r] of Object.entries(estado.recursos ?? {})) {
    const base = `${r.modulo ? `${r.modulo}.` : ''}${r.modo === 'data' ? 'data.' : ''}${r.tipo}.${r.nome}`;
    if (!recursos.has(base)) {
      recursos.set(base, {
        ...(r.modulo ? { module: r.modulo } : {}),
        mode: r.modo,
        type: r.tipo,
        name: r.nome,
        provider: r.provedor,
        instances: [],
      });
    }
    recursos.get(base).instances.push({
      ...(r.chave !== null && r.chave !== undefined ? { index_key: r.chave } : {}),
      schema_version: 0,
      attributes: limparJson(r.atributos),
      sensitive_attributes: (r.sensiveis ?? []).map((s) => [{ type: 'get_attr', value: s }]),
      ...(r.dependencias?.length ? { dependencies: r.dependencias } : {}),
    });
    void endereco;
  }
  return {
    version: 4,
    terraform_version: versaoTerraform,
    serial: estado.serial ?? 0,
    lineage: estado.linhagem ?? '6f1e0c2a-0000-4000-8000-terraformplay',
    outputs: Object.fromEntries(Object.entries(estado.saidas ?? {}).map(([k, s]) => [k, { value: limparJson(s.valor), type: tipoJson(s.valor), ...(s.sensivel ? { sensitive: true } : {}) }])),
    resources: [...recursos.values()],
    check_results: null,
  };
}

function limparJson(v) {
  if (ehDesconhecido(v)) return null;
  if (Array.isArray(v)) return v.map(limparJson);
  if (ehObjeto(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, limparJson(x)]));
  return v;
}

function tipoJson(v) {
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'bool';
  if (Array.isArray(v)) return ['tuple', v.map(tipoJson)];
  if (ehObjeto(v)) return ['object', Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tipoJson(x)]))];
  return 'dynamic';
}
