// Regras usadas pelos exercícios para conferir o resultado do Terraform simulado.
// Cada regra é um objeto com uma das chaves abaixo e, opcionalmente, `msg`:
//
//   { semErros: true }                               init, validate e plan sem erros
//   { erro: 'texto' }                                o Terraform recusa com um erro que contém o texto
//   { recurso: 'aws_s3_bucket.site' }                o recurso (ou instância) está no plano
//     + atributo: 'bucket' e igual | contem | regex | conhecido | referencia | tamanho | existe
//     + acao: 'criar' | 'alterar' | 'substituir' | 'destruir' | 'nada' | 'importar'
//   { tipo: 'aws_subnet', quantidade: 3 }            quantas instâncias desse tipo o plano tem
//   { instancias: 'aws_subnet.pub', quantidade: 2 }  quantas instâncias esse bloco gerou
//   { variavel: 'regiao', tipo, padrao, sensivel, descricao, validacao }
//   { valorVariavel: 'x', igual }                    valor final de uma variável
//   { local: 'nome', igual | contem | regex }
//   { saida: 'url', igual | contem | regex | conhecido | sensivel | existe }
//   { plano: { criar, alterar, destruir, substituir, importar } }
//   { dado: 'aws_ami.ubuntu' }                       data source declarado (+ atributo e condição)
//   { modulo: 'rede', source, entradas: [...] }
//   { provider: 'aws', alias, atributo, igual }
//   { requerido: 'aws', source, versao }             required_providers
//   { versaoTerraform: true }                        required_version declarado
//   { backend: 's3', atributo, igual }
//   { lifecycle: 'aws_s3_bucket.b', prevent_destroy, create_before_destroy, ignore_changes }
//   { meta: 'aws_instance.web', count, forEach, dependsOn, provider, dinamico }
//   { dependencia: ['aws_subnet.a', 'aws_vpc.main'] } aresta no grafo (A depende de B)
//   { movido: ['aws_s3_bucket.a', 'aws_s3_bucket.b'] }
//   { texto: 'Plan: 2 to add' }                      o terminal mostra o texto
//   { codigo: 'regex' } / { semCodigo: 'regex' }     o código-fonte (todos os arquivos)
//   { arquivo: 'variables.tf' }                      o arquivo existe
import { ehDesconhecido, iguais, ehObjeto } from './tf/valores.js';
import { textoDoResultado } from './tf/saida.js';

const ok = (regra, padrao, sucesso, detalhe) => ({ ok: sucesso, mensagem: regra.msg ?? padrao, detalhe: sucesso ? undefined : detalhe });
const mostrar = (v) => {
  if (ehDesconhecido(v)) return '(known after apply)';
  if (v === undefined) return 'nada';
  return JSON.stringify(v);
};

/** Todas as instâncias (recursos gerenciados) do resultado, com o valor mais "final" disponível. */
function instancias(r) {
  const lista = [];
  for (const a of r.plano?.acoes ?? []) {
    lista.push({ endereco: a.endereco, tipo: a.tipo, acao: a.acao, valor: a.final ?? a.depois ?? a.antes, sensiveis: a.sensiveis });
  }
  return lista;
}

function caminho(valor, partes) {
  let v = valor;
  for (const p of partes) {
    if (v === null || v === undefined || ehDesconhecido(v)) return v;
    v = Array.isArray(v) ? v[Number(p)] : v[p];
  }
  return v;
}

/** Compara um valor com as condições da regra (igual, contem, regex...). */
function conferirValor(v, regra, onde) {
  if ('igual' in regra) return [iguais(normalizar(v), regra.igual), `${onde}: esperado ${JSON.stringify(regra.igual)}, veio ${mostrar(v)}`];
  if ('contem' in regra) {
    const texto = typeof v === 'string' ? v : JSON.stringify(v ?? '');
    return [!ehDesconhecido(v) && texto.includes(regra.contem), `${onde}: deveria conter "${regra.contem}", veio ${mostrar(v)}`];
  }
  if ('regex' in regra) return [typeof v === 'string' && new RegExp(regra.regex).test(v), `${onde}: ${mostrar(v)} não segue o formato esperado`];
  if ('conhecido' in regra) return [ehDesconhecido(v) !== regra.conhecido, regra.conhecido ? `${onde} ainda é (known after apply)` : `${onde} deveria vir de outro recurso (known after apply), mas veio ${mostrar(v)}`];
  if ('referencia' in regra) {
    const alvo = regra.referencia;
    const origem = ehDesconhecido(v) ? v.origem ?? '' : '';
    const okRef = ehDesconhecido(v) && (origem === alvo || origem.startsWith(`${alvo}.`) || origem.replace(/\[[^\]]*\]/g, '') === alvo.replace(/\[[^\]]*\]/g, ''));
    return [okRef, `${onde} deveria usar ${alvo}, mas veio ${mostrar(v)}${origem ? ` (de ${origem})` : ''}`];
  }
  if ('tamanho' in regra) {
    const n = Array.isArray(v) ? v.length : ehObjeto(v) ? Object.keys(v).length : typeof v === 'string' ? v.length : -1;
    return [n === regra.tamanho, `${onde}: esperado tamanho ${regra.tamanho}, veio ${n < 0 ? mostrar(v) : n}`];
  }
  if ('existe' in regra) return [(v !== null && v !== undefined) === regra.existe, regra.existe ? `${onde} não foi definido` : `${onde} não deveria estar definido`];
  if ('tipo' in regra) {
    const t = Array.isArray(v) ? 'list' : ehObjeto(v) ? 'map' : typeof v;
    return [t === regra.tipo, `${onde}: esperado ${regra.tipo}, veio ${t}`];
  }
  return [v !== null && v !== undefined, `${onde} não foi definido`];
}

function normalizar(v) {
  if (Array.isArray(v)) return v.map(normalizar);
  if (ehObjeto(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)]));
  return v;
}

const erros = (r) => r.diagnosticos.filter((d) => d.gravidade === 'erro');

export function verificarRegra(regra, r, { arquivos = {} } = {}) {
  const codigo = Object.values(arquivos).join('\n');
  const primeiroErro = () => {
    const e = erros(r)[0];
    return e ? `${e.resumo}${e.linha ? ` (${e.arquivo} linha ${e.linha})` : ''}: ${String(e.detalhe ?? '').split('\n')[0]}` : undefined;
  };

  if ('semErros' in regra) {
    return ok(regra, 'O Terraform roda sem erros (init, validate e plan)', erros(r).length === 0, primeiroErro());
  }
  if ('erro' in regra) {
    const alvo = regra.erro.toLowerCase();
    const achou = erros(r).some((e) => `${e.resumo} ${e.detalhe}`.toLowerCase().includes(alvo));
    return ok(regra, `O Terraform recusa com o erro "${regra.erro}"`, achou,
      erros(r).length ? `veio outro erro: ${primeiroErro()}` : 'o Terraform aceitou a configuração (era para recusar)');
  }
  if ('aviso' in regra) {
    const alvo = regra.aviso.toLowerCase();
    const achou = r.diagnosticos.some((d) => d.gravidade === 'aviso' && `${d.resumo} ${d.detalhe}`.toLowerCase().includes(alvo));
    return ok(regra, `O Terraform mostra o aviso "${regra.aviso}"`, achou, 'o aviso não apareceu');
  }
  if ('recurso' in regra) {
    const alvo = regra.recurso;
    const candidatos = instancias(r).filter((i) => i.endereco === alvo || i.endereco.startsWith(`${alvo}[`));
    const ativos = candidatos.filter((i) => regra.acao === 'destruir' || i.acao !== 'destruir');
    const padrao = regra.atributo
      ? `${alvo}.${regra.atributo} ${descreverCondicao(regra)}`
      : regra.acao ? `${alvo} ${NOMES_ACAO[regra.acao]}` : `O plano tem o recurso ${alvo}`;
    if (!ativos.length) {
      return ok(regra, padrao, false, erros(r).length ? `o plano não rodou: ${primeiroErro()}` : `não encontrei ${alvo} no plano. Confira o tipo e o nome do bloco resource.`);
    }
    if (regra.acao) {
      const certo = ativos.every((i) => i.acao === regra.acao);
      if (!certo) return ok(regra, padrao, false, `a ação planejada foi "${NOMES_ACAO[ativos[0].acao] ?? ativos[0].acao}"`);
    }
    if (!regra.atributo) return ok(regra, padrao, true);
    const partes = regra.atributo.split('.');
    for (const inst of ativos) {
      const v = caminho(inst.valor, partes);
      const [certo, detalhe] = conferirValor(v, regra, `${inst.endereco}.${regra.atributo}`);
      if (!certo) return ok(regra, padrao, false, detalhe);
    }
    return ok(regra, padrao, true);
  }
  if ('tipo' in regra && 'quantidade' in regra) {
    const n = instancias(r).filter((i) => i.tipo === regra.tipo && i.acao !== 'destruir' && i.acao !== 'esquecer').length;
    return ok(regra, `O plano tem ${regra.quantidade} recurso(s) do tipo ${regra.tipo}`, n === regra.quantidade, erros(r).length ? primeiroErro() : `encontrei ${n}`);
  }
  if ('instancias' in regra) {
    const base = regra.instancias;
    const n = instancias(r).filter((i) => (i.endereco === base || i.endereco.startsWith(`${base}[`)) && i.acao !== 'destruir').length;
    return ok(regra, `${base} gera ${regra.quantidade} instância(s)`, n === regra.quantidade, erros(r).length ? primeiroErro() : `gerou ${n}`);
  }
  if ('variavel' in regra) {
    const v = r.blocos?.variaveis?.[regra.variavel];
    const padrao = `Existe a variável "${regra.variavel}"${descreverVariavel(regra)}`;
    if (!v) return ok(regra, padrao, false, `não encontrei variable "${regra.variavel}"`);
    if (regra.tipo && v.tipo !== regra.tipo) return ok(regra, padrao, false, `o tipo é ${v.tipo ?? 'não definido'} (esperado ${regra.tipo})`);
    if ('padrao' in regra && !iguais(normalizar(v.padrao), regra.padrao)) return ok(regra, padrao, false, `o default é ${mostrar(v.padrao)} (esperado ${JSON.stringify(regra.padrao)})`);
    if (regra.semPadrao && v.temPadrao) return ok(regra, padrao, false, 'ela não deveria ter default');
    if (regra.sensivel && !v.sensivel) return ok(regra, padrao, false, 'falta sensitive = true');
    if (regra.descricao && !v.descricao) return ok(regra, padrao, false, 'falta description');
    if (regra.validacao && !v.validacoes) return ok(regra, padrao, false, 'falta um bloco validation');
    return ok(regra, padrao, true);
  }
  if ('valorVariavel' in regra) {
    const v = r.variaveis?.[regra.valorVariavel]?.valor;
    const [certo, detalhe] = conferirValor(v, regra, `var.${regra.valorVariavel}`);
    return ok(regra, `var.${regra.valorVariavel} ${descreverCondicao(regra)}`, certo, detalhe);
  }
  if ('local' in regra) {
    if (!(regra.local in (r.locais ?? {}))) return ok(regra, `Existe o local "${regra.local}"`, false, `não encontrei local.${regra.local}`);
    const [certo, detalhe] = conferirValor(r.locais[regra.local], regra, `local.${regra.local}`);
    return ok(regra, `local.${regra.local} ${descreverCondicao(regra)}`, certo, detalhe);
  }
  if ('saida' in regra) {
    const s = r.saidas?.[regra.saida];
    const padrao = `O output "${regra.saida}" ${regra.sensivel ? 'é sensível' : descreverCondicao(regra)}`;
    if (!s) return ok(regra, padrao, false, erros(r).length ? primeiroErro() : `não encontrei output "${regra.saida}"`);
    if (regra.sensivel) return ok(regra, padrao, Boolean(s.sensivel), 'falta sensitive = true no output');
    if (regra.descricao) return ok(regra, `O output "${regra.saida}" tem description`, Boolean(r.blocos?.saidas?.[regra.saida]?.descricao), 'falta description = "..." no output');
    const [certo, detalhe] = conferirValor(s.valor, regra, `output.${regra.saida}`);
    return ok(regra, padrao, certo, detalhe);
  }
  if ('plano' in regra) {
    const resumo = r.plano?.resumo;
    const nomes = { criar: 'to add', alterar: 'to change', destruir: 'to destroy', substituir: 'to replace', importar: 'to import', ler: 'to read' };
    const padrao = `O plano tem ${Object.entries(regra.plano).map(([k, n]) => `${n} ${nomes[k]}`).join(', ')}`;
    if (!resumo) return ok(regra, padrao, false, primeiroErro() ?? 'o plano não rodou');
    const errado = Object.entries(regra.plano).find(([k, n]) => resumo[k] !== n);
    return ok(regra, padrao, !errado, errado ? `${nomes[errado[0]]}: ${resumo[errado[0]]} (esperado ${errado[1]})` : undefined);
  }
  if ('dado' in regra) {
    const existe = (r.blocos?.dados ?? []).includes(`data.${regra.dado}`);
    const padrao = regra.atributo ? `data.${regra.dado}.${regra.atributo} ${descreverCondicao(regra)}` : `Existe o data source data.${regra.dado}`;
    if (!existe) return ok(regra, padrao, false, `não encontrei data "${regra.dado.split('.')[0]}" "${regra.dado.split('.')[1]}"`);
    if (!regra.atributo) return ok(regra, padrao, true);
    const d = (r.dados ?? []).find((x) => x.endereco === `data.${regra.dado}`);
    if (!d) return ok(regra, padrao, false, primeiroErro() ?? 'o data source não foi lido');
    const [certo, detalhe] = conferirValor(caminho(d.valor, regra.atributo.split('.')), regra, `data.${regra.dado}.${regra.atributo}`);
    return ok(regra, padrao, certo, detalhe);
  }
  if ('modulo' in regra) {
    const m = r.blocos?.modulos?.[regra.modulo];
    const padrao = `Existe o module "${regra.modulo}"${regra.source ? ` com source "${regra.source}"` : ''}`;
    if (!m) return ok(regra, padrao, false, `não encontrei module "${regra.modulo}"`);
    if (regra.source && m.source !== regra.source) return ok(regra, padrao, false, `o source é ${mostrar(m.source)}`);
    const falta = (regra.entradas ?? []).find((e) => !m.entradas.includes(e));
    if (falta) return ok(regra, padrao, false, `o módulo não recebe "${falta}"`);
    if (regra.count && !m.count) return ok(regra, padrao, false, 'o módulo não usa count');
    if (regra.forEach && !m.forEach) return ok(regra, padrao, false, 'o módulo não usa for_each');
    return ok(regra, padrao, true);
  }
  if ('provider' in regra && !('meta' in regra)) {
    const lista = (r.blocos?.provedores ?? []).filter((p) => p.nome === regra.provider && (regra.alias === undefined || p.alias === regra.alias));
    const padrao = `Existe o provider "${regra.provider}"${regra.alias ? ` com alias "${regra.alias}"` : ''}${regra.atributo ? ` com ${regra.atributo} = ${JSON.stringify(regra.igual)}` : ''}`;
    if (!lista.length) return ok(regra, padrao, false, `não encontrei provider "${regra.provider}"${regra.alias ? ` com alias = "${regra.alias}"` : ''}`);
    if (regra.atributo) {
      const certo = lista.some((p) => iguais(normalizar(caminho(p.valores, regra.atributo.split('.'))), regra.igual));
      return ok(regra, padrao, certo, `${regra.atributo} é ${mostrar(caminho(lista[0].valores, regra.atributo.split('.')))}`);
    }
    return ok(regra, padrao, true);
  }
  if ('requerido' in regra) {
    const req = r.blocos?.requeridos?.[regra.requerido];
    const padrao = `required_providers declara ${regra.requerido}${regra.versao ? ` com version = "${regra.versao}"` : ''}`;
    if (!req) return ok(regra, padrao, false, `falta ${regra.requerido} = { ... } dentro de terraform { required_providers { } }`);
    const obj = typeof req === 'string' ? { version: req } : req;
    if (regra.source && obj.source !== regra.source) return ok(regra, padrao, false, `o source é ${mostrar(obj.source)}`);
    if (regra.versao && obj.version !== regra.versao) return ok(regra, padrao, false, `a versão é ${mostrar(obj.version)}`);
    return ok(regra, padrao, true);
  }
  if ('versaoTerraform' in regra) {
    const v = r.blocos?.versaoExigida;
    const padrao = regra.igual ? `required_version = "${regra.igual}"` : 'O bloco terraform declara required_version';
    return ok(regra, padrao, regra.igual ? v === regra.igual : Boolean(v), `required_version é ${mostrar(v)}`);
  }
  if ('backend' in regra) {
    const b = r.blocos?.backend;
    const padrao = `O backend é "${regra.backend}"${regra.atributo ? ` com ${regra.atributo} = ${JSON.stringify(regra.igual)}` : ''}`;
    if (!b || b.tipo !== regra.backend) return ok(regra, padrao, false, b ? `o backend é "${b.tipo}"` : 'não há bloco backend dentro de terraform { }');
    if (regra.atributo) return ok(regra, padrao, iguais(b.valores?.[regra.atributo], regra.igual), `${regra.atributo} é ${mostrar(b.valores?.[regra.atributo])}`);
    return ok(regra, padrao, true);
  }
  if ('lifecycle' in regra) {
    const rec = r.blocos?.recursos?.[regra.lifecycle];
    const chaves = ['prevent_destroy', 'create_before_destroy', 'ignore_changes'].filter((k) => k in regra);
    const padrao = `${regra.lifecycle} tem lifecycle { ${chaves.map((k) => `${k} = ${JSON.stringify(regra[k])}`).join(', ')} }`;
    if (!rec) return ok(regra, padrao, false, `não encontrei ${regra.lifecycle}`);
    for (const k of chaves) {
      const v = rec.lifecycle?.[k];
      if (k === 'ignore_changes' ? !regra[k].every((x) => (v ?? []).includes(x)) : v !== regra[k]) {
        return ok(regra, padrao, false, `${k} é ${mostrar(v)}`);
      }
    }
    return ok(regra, padrao, true);
  }
  if ('meta' in regra) {
    const rec = r.blocos?.recursos?.[regra.meta];
    const padrao = `${regra.meta} usa ${['count', 'forEach', 'dependsOn', 'provider', 'dinamico', 'provisioner'].filter((k) => k in regra).map((k) => NOMES_META[k](regra[k])).join(' e ')}`;
    if (!rec) return ok(regra, padrao, false, `não encontrei resource ${regra.meta}`);
    if (regra.count && !rec.count) return ok(regra, padrao, false, 'falta count');
    if (regra.forEach && !rec.forEach) return ok(regra, padrao, false, 'falta for_each');
    if (regra.count === false && rec.count) return ok(regra, padrao, false, 'não use count aqui');
    if (regra.dependsOn && !rec.dependsOn.includes(regra.dependsOn)) return ok(regra, padrao, false, `depends_on não inclui ${regra.dependsOn}`);
    if (regra.provider && rec.provider !== regra.provider) return ok(regra, padrao, false, `provider é ${mostrar(rec.provider)}`);
    if (regra.dinamico && !rec.dinamicos.includes(regra.dinamico)) return ok(regra, padrao, false, `falta dynamic "${regra.dinamico}"`);
    if (regra.provisioner && !rec.provisioners.includes(regra.provisioner)) return ok(regra, padrao, false, `falta provisioner "${regra.provisioner}"`);
    return ok(regra, padrao, true);
  }
  if ('dependencia' in regra) {
    const [de, para] = regra.dependencia;
    const achou = (r.grafo?.arestas ?? []).some((a) => a.de === de && a.para === para);
    return ok(regra, `${de} depende de ${para}`, achou, `${de} não usa nenhum valor de ${para}`);
  }
  if ('movido' in regra) {
    const [de, para] = regra.movido;
    const achou = (r.plano?.movidos ?? []).some((m) => m.de.replace(/\[.*$/, '') === de && m.para.replace(/\[.*$/, '') === para);
    return ok(regra, `O plano move ${de} para ${para} (sem recriar)`, achou, 'nenhum moved aconteceu');
  }
  if ('texto' in regra) {
    const texto = textoDoResultado(r);
    return ok(regra, `O terminal mostra "${regra.texto}"`, texto.includes(regra.texto), 'o texto não apareceu na saída');
  }
  if ('codigo' in regra) {
    return ok(regra, `O código usa ${regra.codigo}`, new RegExp(regra.codigo, 'm').test(codigo), 'não encontrei no código');
  }
  if ('semCodigo' in regra) {
    return ok(regra, `O código não usa ${regra.semCodigo}`, !new RegExp(regra.semCodigo, 'm').test(codigo), 'encontrei no código');
  }
  if ('arquivo' in regra) {
    return ok(regra, `Existe o arquivo ${regra.arquivo}`, regra.arquivo in arquivos, `crie o arquivo ${regra.arquivo} (botão + do editor)`);
  }
  throw new Error(`Regra desconhecida: ${JSON.stringify(regra)}`);
}

const NOMES_ACAO = { criar: 'será criado', alterar: 'será alterado no lugar', substituir: 'será recriado', destruir: 'será destruído', nada: 'não muda', importar: 'será importado', esquecer: 'sai do estado' };
const NOMES_META = {
  count: (v) => (v === false ? 'nada de count' : 'count'),
  forEach: () => 'for_each',
  dependsOn: (v) => `depends_on = [${v}]`,
  provider: (v) => `provider = ${v}`,
  dinamico: (v) => `dynamic "${v}"`,
  provisioner: (v) => `provisioner "${v}"`,
};

function descreverCondicao(regra) {
  if ('igual' in regra) return `vale ${JSON.stringify(regra.igual)}`;
  if ('contem' in regra) return `contém "${regra.contem}"`;
  if ('regex' in regra) return 'segue o formato pedido';
  if ('conhecido' in regra) return regra.conhecido ? 'já é conhecido no plano' : 'vem de outro recurso (known after apply)';
  if ('referencia' in regra) return `usa ${regra.referencia}`;
  if ('tamanho' in regra) return `tem ${regra.tamanho} item(ns)`;
  if ('existe' in regra) return regra.existe ? 'está definido' : 'não está definido';
  if ('tipo' in regra) return `é ${regra.tipo}`;
  return 'está definido';
}

function descreverVariavel(regra) {
  const partes = [];
  if (regra.tipo) partes.push(`do tipo ${regra.tipo}`);
  if ('padrao' in regra) partes.push(`com default ${JSON.stringify(regra.padrao)}`);
  if (regra.semPadrao) partes.push('sem default');
  if (regra.sensivel) partes.push('sensível');
  if (regra.descricao) partes.push('com description');
  if (regra.validacao) partes.push('com validation');
  return partes.length ? ` ${partes.join(', ')}` : '';
}

// ---------- detalhes para a aba Testes ----------
//
// Além de "passou / não passou", cada verificação mostra a categoria, o valor obtido
// (também quando passa, para o aluno confirmar o que o Terraform calculou) e, quando
// falha, uma dica de onde mexer.

const CATEGORIAS = [
  ['semErros', 'Execução'], ['erro', 'Execução'], ['aviso', 'Execução'], ['recurso', 'Recurso'],
  ['quantidade', 'Quantidade'], ['variavel', 'Variável'], ['valorVariavel', 'Variável'], ['local', 'Local'],
  ['saida', 'Output'], ['plano', 'Plano'], ['dado', 'Data source'], ['modulo', 'Módulo'], ['requerido', 'Versões'],
  ['versaoTerraform', 'Versões'], ['backend', 'Backend'], ['lifecycle', 'Ciclo de vida'], ['meta', 'Meta-argumento'],
  ['provider', 'Provider'], ['dependencia', 'Dependência'], ['movido', 'Estado'], ['texto', 'Terminal'],
  ['codigo', 'Código'], ['semCodigo', 'Código'], ['arquivo', 'Arquivo'],
];
export const categoriaDe = (regra) => CATEGORIAS.find(([chave]) => chave in regra)?.[1] ?? 'Verificação';

/** Valor curto para a tela: listas e mapas em JSON de uma linha, cortado se for longo. */
function curto(v) {
  if (ehDesconhecido(v)) return `(known after apply)${v.origem ? ` ← ${v.origem}` : ''}`;
  if (v === undefined) return 'não definido';
  const texto = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(normalizar(v));
  return texto.length > 140 ? `${texto.slice(0, 137)}…` : texto;
}

const NOMES_RESUMO = { importar: 'to import', criar: 'to add', alterar: 'to change', destruir: 'to destroy' };

/** O que o Terraform calculou para o ponto que a regra confere (ou undefined, se não houver um valor). */
function obtidoDe(regra, r) {
  const lista = erros(r);
  if ('semErros' in regra || 'erro' in regra) return lista.length ? lista.map((e) => `Error: ${e.resumo}`).join(' · ') : 'nenhum erro';
  // Sem plano (erro antes dele), não há valor para mostrar além do próprio erro.
  const precisaDoPlano = ['recurso', 'quantidade', 'instancias', 'valorVariavel', 'local', 'saida', 'plano', 'dado', 'movido'].some((k) => k in regra);
  if (lista.length && precisaDoPlano && !r.plano?.acoes?.length) return 'o plano não rodou (veja o erro do caso)';
  if ('recurso' in regra) {
    const ativos = instancias(r).filter((i) => (i.endereco === regra.recurso || i.endereco.startsWith(`${regra.recurso}[`)) && (regra.acao === 'destruir' || i.acao !== 'destruir'));
    if (!ativos.length) return 'o recurso não aparece no plano';
    if (regra.atributo) {
      const partes = regra.atributo.split('.');
      const v = caminho(ativos[0].valor, partes);
      const sensivel = ativos[0].sensiveis?.has?.(partes[0]) && !ehDesconhecido(v);
      return `${ativos.length > 1 ? `${ativos[0].endereco}: ` : ''}${sensivel ? '(sensitive value)' : curto(v)}`;
    }
    if (regra.acao) return NOMES_ACAO[ativos[0].acao] ?? ativos[0].acao;
    return ativos.map((a) => a.endereco).slice(0, 4).join(', ') + (ativos.length > 4 ? '…' : '');
  }
  if ('tipo' in regra && 'quantidade' in regra) {
    return `${instancias(r).filter((i) => i.tipo === regra.tipo && i.acao !== 'destruir' && i.acao !== 'esquecer').length} recurso(s)`;
  }
  if ('instancias' in regra) {
    const lista2 = instancias(r).filter((i) => (i.endereco === regra.instancias || i.endereco.startsWith(`${regra.instancias}[`)) && i.acao !== 'destruir');
    return lista2.length ? lista2.map((i) => i.endereco.slice(regra.instancias.length) || '(uma)').join(' ') : 'nenhuma instância';
  }
  if ('variavel' in regra) {
    const v = r.blocos?.variaveis?.[regra.variavel];
    if (!v) return 'a variável não existe';
    return [`type = ${v.tipo ?? 'any'}`, v.temPadrao ? `default = ${curto(v.padrao)}` : 'sem default', v.sensivel && 'sensitive', v.validacoes && 'com validation']
      .filter(Boolean).join(', ');
  }
  if ('valorVariavel' in regra) return curto(r.variaveis?.[regra.valorVariavel]?.valor);
  if ('local' in regra) return regra.local in (r.locais ?? {}) ? curto(r.locais[regra.local]) : 'o local não existe';
  if ('saida' in regra) {
    const s = r.saidas?.[regra.saida];
    if (!s) return 'o output não existe';
    if (regra.sensivel) return s.sensivel ? 'sensitive = true' : 'sem sensitive';
    return s.sensivel ? '(sensitive value)' : curto(s.valor);
  }
  if ('plano' in regra) {
    const resumo = r.plano?.resumo;
    return resumo ? Object.entries(NOMES_RESUMO).filter(([k]) => k !== 'importar' || resumo.importar).map(([k, n]) => `${resumo[k] ?? 0} ${n}`).join(', ') : 'o plano não rodou';
  }
  if ('dado' in regra && regra.atributo) {
    const d = (r.dados ?? []).find((x) => x.endereco === `data.${regra.dado}`);
    return d ? curto(caminho(d.valor, regra.atributo.split('.'))) : 'o data source não foi lido';
  }
  if ('modulo' in regra) {
    const m = r.blocos?.modulos?.[regra.modulo];
    return m ? `source = ${curto(m.source)}${m.entradas?.length ? `, entradas: ${m.entradas.join(', ')}` : ''}` : 'o módulo não existe';
  }
  if ('requerido' in regra) {
    const req = r.blocos?.requeridos?.[regra.requerido];
    if (!req) return 'não declarado';
    const obj = typeof req === 'string' ? { version: req } : req;
    return `source = ${curto(obj.source)}, version = ${curto(obj.version)}`;
  }
  if ('versaoTerraform' in regra) return curto(r.blocos?.versaoExigida);
  if ('backend' in regra) {
    const b = r.blocos?.backend;
    if (!b) return 'sem backend (estado local)';
    return regra.atributo ? `backend "${b.tipo}", ${regra.atributo} = ${curto(b.valores?.[regra.atributo])}` : `backend "${b.tipo}"`;
  }
  if ('dependencia' in regra) {
    const usa = (r.grafo?.arestas ?? []).filter((a) => a.de === regra.dependencia[0]).map((a) => a.para);
    return usa.length ? `${regra.dependencia[0]} usa: ${usa.join(', ')}` : `${regra.dependencia[0]} não usa outros blocos`;
  }
  if ('movido' in regra) {
    const m = r.plano?.movidos ?? [];
    return m.length ? m.map((x) => `${x.de} → ${x.para}`).join(', ') : 'nenhum moved';
  }
  return undefined;
}

/** Onde mexer quando a verificação falha. */
function dicaDe(regra, r) {
  if (erros(r).length && !('erro' in regra)) return 'Primeiro corrija o erro: a caixa ╷ Error no 🖥️ Terminal mostra o arquivo, a linha e o motivo.';
  if ('erro' in regra) return 'Este caso espera que o Terraform recuse a configuração: confira a validation ou a regra pedida no enunciado.';
  if ('recurso' in regra) {
    const existe = instancias(r).some((i) => i.endereco === regra.recurso || i.endereco.startsWith(`${regra.recurso}[`));
    if (!existe) {
      const indice = regra.recurso.match(/\[([^\]]+)\]$/)?.[1];
      return indice !== undefined
        ? `A instância [${indice}] só existe se o count ou o for_each gerar esse item: confira a quantidade e as chaves.`
        : `Crie o bloco resource "${regra.recurso.split('.').at(-2)}" "${regra.recurso.split('.').at(-1)}" (tipo e nome exatamente assim).`;
    }
    if ('referencia' in regra) return `Use a referência direta (${regra.referencia}) em vez de escrever o valor: assim o Terraform liga os dois recursos.`;
    if ('igual' in regra) return 'Compare com atenção: maiúsculas, aspas, espaços e o tipo (número, texto ou lista) contam.';
    if (regra.acao) return 'Veja no 🖥️ Terminal o símbolo do recurso no plano (+ cria, ~ altera, -/+ recria).';
    return `Confira o tipo e o nome do bloco: resource "${regra.recurso.split('.').at(-2) ?? ''}" "${regra.recurso.split('.').at(-1)?.replace(/\[.*$/, '') ?? ''}".`;
  }
  if ('quantidade' in regra) return 'Confira o count ou o for_each e a variável que define quantos itens são criados.';
  if ('variavel' in regra || 'valorVariavel' in regra) return 'Confira o bloco variable: nome, type, default e, se pedido, validation, description ou sensitive.';
  if ('local' in regra) return 'Confira o bloco locals { } e a expressão do valor.';
  if ('saida' in regra) return regra.sensivel ? 'Acrescente sensitive = true no bloco output.' : 'Confira o bloco output "nome" { value = ... }: o nome e a expressão do value.';
  if ('plano' in regra) return 'Leia a linha "Plan: ..." no 🖥️ Terminal e compare com o que o caso espera.';
  if ('dado' in regra) return 'Confira o bloco data "tipo" "nome" { } e os filtros dele.';
  if ('modulo' in regra) return 'Confira o bloco module: o source (caminho da pasta) e as entradas passadas.';
  if ('requerido' in regra || 'versaoTerraform' in regra) return 'Isso fica dentro de terraform { required_providers { } } (ou required_version).';
  if ('backend' in regra) return 'O backend fica em terraform { backend "tipo" { ... } } e não aceita variáveis: escreva os valores direto.';
  if ('lifecycle' in regra) return 'Acrescente um bloco lifecycle { } dentro do resource.';
  if ('meta' in regra) return 'Confira os meta-argumentos do resource (count, for_each, depends_on, provider, dynamic).';
  if ('dependencia' in regra) return `Use um atributo de ${regra.dependencia[1]} (por exemplo .id ou .name) dentro de ${regra.dependencia[0]}.`;
  if ('movido' in regra) return 'Use um bloco moved { from = ... to = ... } ao renomear, para o Terraform não destruir e recriar.';
  if ('codigo' in regra || 'semCodigo' in regra) return 'O enunciado pede essa forma de escrever: releia o passo correspondente.';
  if ('arquivo' in regra) return 'Crie o arquivo com o botão + do editor, com o nome exato (inclusive a pasta).';
  return undefined;
}

/** O resultado da regra com categoria, valor obtido e dica (para a aba Testes). */
export function detalharRegra(regra, r, opcoes = {}) {
  const base = verificarRegra(regra, r, opcoes);
  const obtido = obtidoDe(regra, r);
  return {
    ...base,
    categoria: categoriaDe(regra),
    ...(obtido !== undefined ? { obtido } : {}),
    ...(base.ok ? {} : { dica: dicaDe(regra, r) }),
  };
}

/** Primeiro erro do Terraform num resultado, em uma linha (para mostrar uma vez por caso). */
export function primeiroErroDe(r) {
  const e = erros(r)[0];
  return e ? `Error: ${e.resumo}${e.arquivo && e.linha ? ` (${e.arquivo}, linha ${e.linha})` : ''}${e.detalhe ? ` — ${String(e.detalhe).split('\n')[0]}` : ''}` : undefined;
}

/**
 * A regra em linguagem simples, para a seção "Como saber que deu certo".
 * Regras de código sem `msg` são regex e ficariam confusas: devolve null.
 */
export function descreverRegra(regra) {
  if (regra.msg) return regra.msg;
  if ('codigo' in regra || 'semCodigo' in regra || 'texto' in regra) return null;
  try {
    return verificarRegra(regra, { diagnosticos: [], plano: { acoes: [], resumo: {}, movidos: [] }, blocos: {}, saidas: {}, locais: {}, variaveis: {}, grafo: { arestas: [] } }, {}).mensagem;
  } catch {
    return null;
  }
}
