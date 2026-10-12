// Valores do Terraform no simulador.
//   string, number, bool, null           → string, number, boolean, null do JS
//   list/tuple                           → Array
//   set                                  → Array marcado com CONJUNTO (sem repetição, ordenado)
//   map/object                           → objeto simples
//   "(known after apply)"                → instância de Desconhecido
//
// Desconhecido guarda de onde veio (ex.: "aws_instance.web.id"), para o grafo e para
// os testes conferirem referências entre recursos.

export class Desconhecido {
  constructor(origem = null, tipo = null) {
    this.origem = origem;
    this.tipo = tipo;
  }
  toString() { return '(known after apply)'; }
}

export const desconhecido = (origem, tipo) => new Desconhecido(origem, tipo);
export const ehDesconhecido = (v) => v instanceof Desconhecido;

/** Algum pedaço do valor (em qualquer profundidade) é desconhecido? */
export function temDesconhecido(v) {
  if (v instanceof Desconhecido) return true;
  if (Array.isArray(v)) return v.some(temDesconhecido);
  if (ehObjeto(v)) return Object.values(v).some(temDesconhecido);
  return false;
}

export const CONJUNTO = Symbol('conjunto');

export function conjunto(itens) {
  const unicos = [];
  for (const item of itens) if (!unicos.some((u) => iguais(u, item))) unicos.push(item);
  // O Terraform ordena conjuntos de strings e números; o simulador faz o mesmo.
  if (unicos.every((u) => typeof u === 'string')) unicos.sort();
  else if (unicos.every((u) => typeof u === 'number')) unicos.sort((a, b) => a - b);
  Object.defineProperty(unicos, CONJUNTO, { value: true });
  return unicos;
}

export const ehConjunto = (v) => Array.isArray(v) && v[CONJUNTO] === true;
export const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Desconhecido);

export function iguais(a, b) {
  if (a === b) return true;
  if (a instanceof Desconhecido || b instanceof Desconhecido) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => iguais(x, b[i]));
  if (ehObjeto(a) && ehObjeto(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && iguais(a[k], b[k]));
  }
  return false;
}

/** Nome do tipo como o Terraform escreve nas mensagens. */
export function nomeDoTipo(v) {
  if (v === null) return 'null';
  if (v instanceof Desconhecido) return v.tipo ?? 'dynamic';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'bool';
  if (ehConjunto(v)) return `set of ${v.length ? nomeDoTipo(v[0]) : 'dynamic'}`;
  if (Array.isArray(v)) return 'tuple';
  return 'object';
}

/** Número como o Terraform mostra: sem ".0" no fim. */
export function textoDoNumero(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(15)));
}

/** Conversão automática para string (interpolação e funções de texto). */
export function paraTexto(v, onde = 'a string') {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return textoDoNumero(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === null) throw new ErroValor('Invalid template interpolation value', `O valor é null e não pode entrar em ${onde}. Use coalesce() ou um valor padrão.`);
  throw new ErroValor('Invalid template interpolation value',
    `Não dá para colocar um valor do tipo ${nomeDoTipo(v)} dentro de ${onde}: só string, number e bool. Use join() para listas ou jsonencode() para objetos.`);
}

export function paraNumero(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  throw new ErroValor('Invalid value', `Era esperado um número, mas veio ${typeof v === 'string' ? `"${v}"` : nomeDoTipo(v)}.`);
}

export function paraBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  throw new ErroValor('Invalid value', `Era esperado true ou false, mas veio ${typeof v === 'string' ? `"${v}"` : nomeDoTipo(v)}.`);
}

/** Erro de valor durante a avaliação; o avaliador acrescenta arquivo e linha. */
export class ErroValor extends Error {
  constructor(resumo, detalhe) {
    super(resumo);
    this.resumo = resumo;
    this.detalhe = detalhe;
  }
}

/** Escreve o valor como HCL (usado no plano, nas saídas e no estado). */
export function comoHcl(v, recuo = '') {
  if (v instanceof Desconhecido) return '(known after apply)';
  if (v === null) return 'null';
  if (typeof v === 'string') {
    if (v.includes('\n')) {
      const linhas = v.replace(/\n$/, '').split('\n');
      return `<<-EOT\n${linhas.map((l) => `${recuo}    ${l}`).join('\n')}\n${recuo}EOT`;
    }
    return JSON.stringify(v);
  }
  if (typeof v === 'number') return textoDoNumero(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (!v.length) return ehConjunto(v) ? 'toset([])' : '[]';
    const itens = v.map((x) => `${recuo}    ${comoHcl(x, `${recuo}    `)},`).join('\n');
    return `${ehConjunto(v) ? 'toset(' : ''}[\n${itens}\n${recuo}]${ehConjunto(v) ? ')' : ''}`;
  }
  const chaves = Object.keys(v);
  if (!chaves.length) return '{}';
  const largura = Math.max(...chaves.map((k) => chaveHcl(k).length));
  return `{\n${chaves.map((k) => `${recuo}    ${chaveHcl(k).padEnd(largura)} = ${comoHcl(v[k], `${recuo}    `)}`).join('\n')}\n${recuo}}`;
}

const chaveHcl = (k) => (/^[A-Za-z_][\w-]*$/.test(k) ? k : JSON.stringify(k));

/** Cópia profunda (preserva conjuntos e desconhecidos). */
export function copiar(v) {
  if (Array.isArray(v)) {
    const c = v.map(copiar);
    return ehConjunto(v) ? conjunto(c) : c;
  }
  if (ehObjeto(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copiar(x)]));
  return v;
}
