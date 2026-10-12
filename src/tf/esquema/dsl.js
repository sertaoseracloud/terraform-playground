// Notação curta para descrever os argumentos de cada recurso no simulador.
//
//   'bucket~^ force_destroy?:bool=false tags?:map'
//
//   nome!   obrigatório          nome?   opcional
//   nome~   opcional e calculado (se não for definido, fica "known after apply")
//   ^       mudar o valor força a recriação do recurso (forces replacement)
//   $       sensível (aparece como (sensitive value))
//   :tipo   string (padrão), number, bool, list, set, map, any
//   =valor  valor padrão (true, false, número ou texto)
//
// `calc` lista os atributos só calculados pelo provedor (id, arn...), na mesma notação.

export function lerArgs(texto = '') {
  const args = {};
  for (const token of texto.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([a-z0-9_]+)(.*)$/.exec(token);
    if (!m) throw new Error(`Esquema inválido: "${token}"`);
    const [, nome, resto] = m;
    // As marcas (!?~^$) podem vir antes ou depois do tipo e do valor padrão.
    const [antes, padraoBruto] = resto.split(/=(.*)/s);
    let padrao = padraoBruto;
    let flags = antes.replace(/:[a-z]+/, '');
    if (padrao !== undefined) {
      const fim = /[!?~^$]+$/.exec(padrao);
      if (fim) {
        flags += fim[0];
        padrao = padrao.slice(0, -fim[0].length);
      }
    }
    if (/[^!?~^$]/.test(flags)) throw new Error(`Esquema inválido: "${token}"`);
    const tipo = /:([a-z]+)/.exec(antes)?.[1] ?? 'string';
    args[nome] = {
      obrigatorio: flags.includes('!'),
      calculado: flags.includes('~'),
      forcaNova: flags.includes('^'),
      sensivel: flags.includes('$'),
      tipo,
      padrao: padrao === undefined ? undefined : converterPadrao(padrao, tipo),
    };
  }
  return args;
}

function converterPadrao(texto, tipo) {
  if (tipo === 'bool') return texto === 'true';
  if (tipo === 'number') return Number(texto);
  if (texto === '[]') return [];
  if (texto === '{}') return {};
  return texto.replace(/^"|"$/g, '').replace(/_/g, ' ').replace(/\\ /g, '_');
}

export function lerCalc(texto = '') {
  const calc = {};
  for (const token of texto.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([a-z0-9_]+)(\$?)(?::([a-z]+))?(\$?)$/.exec(token);
    if (!m) throw new Error(`Esquema inválido: "${token}"`);
    calc[m[1]] = { sensivel: m[2] === '$' || m[4] === '$', tipo: m[3] ?? 'string' };
  }
  return calc;
}

/** Normaliza a definição de blocos aninhados (recursivo). */
export function lerBlocos(blocos = {}) {
  const saida = {};
  for (const [nome, def] of Object.entries(blocos)) {
    saida[nome] = {
      min: def.min ?? 0,
      max: def.max ?? Infinity,
      args: lerArgs(def.args),
      calc: lerCalc(def.calc),
      blocos: lerBlocos(def.blocos),
      livre: def.livre ?? false,
      forcaNova: def.forcaNova ?? false,
    };
  }
  return saida;
}

/**
 * Define um tipo de recurso ou fonte de dados.
 * opcoes: { args, calc, blocos, gerar, validar, validarBlocos, validarApi, prefixo, arn, azure, global,
 *           obsoletos, umDe, exige, ler, docs, descricao }
 * `validarBlocos` valida argumentos com aquele nome dentro de qualquer bloco aninhado.
 */
export function tipo(nome, opcoes = {}) {
  return {
    nome,
    args: lerArgs(opcoes.args),
    calc: lerCalc(opcoes.calc),
    blocos: lerBlocos(opcoes.blocos),
    gerar: opcoes.gerar ?? {},
    validar: opcoes.validar ?? {},
    validarBlocos: opcoes.validarBlocos ?? {},
    validarApi: opcoes.validarApi ?? null,
    prefixo: opcoes.prefixo ?? null,
    arn: opcoes.arn ?? null,
    azure: opcoes.azure ?? null,
    global: opcoes.global ?? false,
    obsoletos: opcoes.obsoletos ?? {},
    umDe: opcoes.umDe ?? [],
    exige: opcoes.exige ?? [],
    ler: opcoes.ler ?? null,
    docs: opcoes.docs ?? null,
    descricao: opcoes.descricao ?? '',
  };
}

// ---------- validadores comuns (mensagens no formato do SDK dos provedores) ----------

export const umDosValores = (...valores) => (v, nome) => (valores.includes(v) ? null
  : `expected ${nome} to be one of [${valores.map((x) => JSON.stringify(x)).join(' ')}], got ${v}`);

export const entre = (min, max) => (v, nome) => (typeof v === 'number' && v >= min && v <= max ? null
  : `expected ${nome} to be in the range (${min} - ${max}), got ${v}`);

export const padrao = (regex, mensagem) => (v, nome) => (typeof v !== 'string' || regex.test(v) ? null
  : mensagem.replaceAll('{nome}', nome).replaceAll('{valor}', v));

export function cidrValido(v, nome) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(String(v));
  if (!m || m.slice(1, 5).some((p) => Number(p) > 255) || Number(m[5]) > 32) {
    return `"${nome}" (${v}) is not a valid CIDR block: deve ser algo como 10.0.0.0/16`;
  }
  const ip = m.slice(1, 5).reduce((n, p) => n * 256 + Number(p), 0);
  const tamanho = 2 ** (32 - Number(m[5]));
  if (ip % tamanho !== 0) {
    return `"${v}" is not a valid CIDR block: o endereço não é o início da rede /${m[5]} (os bits de host devem ser zero)`;
  }
  return null;
}

export const listaDe = (validador) => (v, nome) => {
  if (!Array.isArray(v)) return null;
  for (const item of v) {
    const erro = validador(item, nome);
    if (erro) return erro;
  }
  return null;
};
