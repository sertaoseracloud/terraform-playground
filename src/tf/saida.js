// Texto do terminal no formato do Terraform (em inglês, como na vida real, para o
// aluno reconhecer a saída) com as explicações dos erros em português.
// Cada linha vem com uma classe para colorir: criar, alterar, destruir, erro...
import { ehDesconhecido, ehObjeto, ehConjunto, comoHcl, textoDoNumero } from './valores.js';

const SIMBOLO = { criar: '+', alterar: '~', destruir: '-', substituir: '-/+', substituirAntes: '+/-', importar: ' ', ler: '<=', esquecer: '.' };

export function linhasDoResultado(r) {
  const L = [];
  const add = (texto, classe = '') => L.push({ texto, classe });

  // ---------- init ----------
  add('$ terraform init', 'comando');
  add('');
  if (r.init?.backend?.tipo && r.init.backend.tipo !== 'local') {
    add('Initializing the backend...', 'titulo');
    add(`Successfully configured the backend "${r.init.backend.tipo}"! Terraform will automatically`, 'sucesso');
    add('use this backend unless the backend configuration changes.', 'sucesso');
  } else {
    add('Initializing the backend...', 'titulo');
  }
  add('Initializing provider plugins...', 'titulo');
  for (const p of r.provedores ?? []) {
    if (p.embutido) {
      add(`- ${p.nome} is built in to Terraform`);
      continue;
    }
    add(`- Finding ${p.fonte} versions matching "${p.restricao ?? '*'}"...`);
    add(`- Installing ${p.fonte} v${p.versao}...`);
    add(`- Installed ${p.fonte} v${p.versao} (signed by HashiCorp)`);
  }
  const errosInit = r.fase === 'init';
  if (!errosInit) {
    add('');
    add('Terraform has been successfully initialized!', 'sucesso');
  }
  add('');

  if (r.fase === 'init' || r.fase === 'validate') {
    for (const d of r.diagnosticos) caixa(d, add);
    return L;
  }

  // ---------- plan / apply / destroy ----------
  add(`$ terraform ${r.comando === 'destroy' ? 'destroy' : r.comando === 'apply' ? 'apply' : 'plan'}${r.workspace !== 'default' ? `  # workspace "${r.workspace}"` : ''}`, 'comando');
  add('');
  const avisos = r.diagnosticos.filter((d) => d.gravidade === 'aviso');
  const erros = r.diagnosticos.filter((d) => d.gravidade === 'erro');
  if (!r.plano) {
    for (const d of [...avisos, ...erros]) caixa(d, add);
    return L;
  }
  escreverPlano(r, add);
  for (const d of avisos) caixa(d, add);
  if (erros.length && r.comando !== 'apply') {
    for (const d of erros) caixa(d, add);
    return L;
  }
  if (r.comando === 'apply' || r.comando === 'destroy') escreverApply(r, erros, add);
  return L;
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
  const verbos = {
    criar: ['Creating...', 'Creation complete after 1s'],
    importar: ['Importing...', 'Import complete'],
    alterar: ['Modifying...', 'Modifications complete after 1s'],
    substituir: ['Destroying... + Creating...', 'Creation complete after 2s'],
    destruir: ['Destroying...', 'Destruction complete after 0s'],
    esquecer: ['Removing from state...', 'Removed from state'],
  };
  for (const e of eventos) {
    const [comeco, fim] = verbos[e.acao] ?? ['...', 'ok'];
    add(`${e.endereco}: ${comeco}`, classeDe(e.acao));
    add(`${e.endereco}: ${fim}${e.id && e.acao !== 'destruir' ? ` [id=${e.id}]` : ''}`, classeDe(e.acao));
  }
  if (eventos.length) add('');
  for (const d of erros) caixa(d, add);
  if (erros.length) {
    add('');
    add('O apply parou com erro: o que foi criado antes do erro continua no estado.', 'comentario');
    return;
  }
  const n = (acao) => eventos.filter((e) => e.acao === acao).length;
  const substituidos = n('substituir');
  if (r.comando === 'destroy') {
    add(`Destroy complete! Resources: ${n('destruir')} destroyed.`, 'sucesso forte');
    return;
  }
  const importados = n('importar');
  add(`Apply complete! Resources: ${importados ? `${importados} imported, ` : ''}${n('criar') + substituidos} added, ${n('alterar')} changed, ${n('destruir') + substituidos} destroyed.`, 'sucesso forte');
  const saidas = Object.entries(r.estado?.saidas ?? {});
  if (saidas.length) {
    add('');
    add('Outputs:', 'titulo');
    add('');
    for (const [nome, s] of saidas.sort(([a], [b]) => (a < b ? -1 : 1))) {
      add(`${nome} = ${s.sensivel ? '<sensitive>' : formatarValor(s.valor)}`, 'saida');
    }
  }
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
