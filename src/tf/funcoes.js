// Funções embutidas do Terraform implementadas no simulador.
// Cada uma recebe (args, ctx) e devolve um valor. Se algum argumento ainda é
// desconhecido ("known after apply"), o resultado também é, como no Terraform.
import {
  Desconhecido, desconhecido, temDesconhecido, conjunto, ehObjeto, iguais,
  paraTexto, paraNumero, paraBool, nomeDoTipo, ErroValor, textoDoNumero, copiar,
} from './valores.js';

const erroArg = (fn, detalhe) => new ErroValor('Invalid function argument', `${fn}(): ${detalhe}`);

function lista(v, fn, qual = 'o argumento') {
  if (Array.isArray(v)) return v;
  throw erroArg(fn, `${qual} deve ser uma lista ou conjunto, mas é ${nomeDoTipo(v)}.`);
}
function mapa(v, fn, qual = 'o argumento') {
  if (ehObjeto(v)) return v;
  throw erroArg(fn, `${qual} deve ser um mapa ou objeto, mas é ${nomeDoTipo(v)}.`);
}
const texto = (v) => paraTexto(v, 'uma função de texto');

// ---------- IPv4 e CIDR ----------

function ipParaNumero(ip, fn) {
  const partes = ip.split('.');
  if (partes.length !== 4 || partes.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) {
    throw erroArg(fn, `"${ip}" não é um endereço IPv4 válido.`);
  }
  return partes.reduce((n, p) => n * 256 + Number(p), 0);
}
const numeroParaIp = (n) => [24, 16, 8, 0].map((d) => Math.floor(n / 2 ** d) % 256).join('.');

export function lerCidr(cidr, fn = 'cidr') {
  const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/.exec(String(cidr));
  if (!m || Number(m[2]) > 32) throw erroArg(fn, `"${cidr}" não é um bloco CIDR válido (ex.: 10.0.0.0/16).`);
  const prefixo = Number(m[2]);
  const ip = ipParaNumero(m[1], fn);
  const tamanho = 2 ** (32 - prefixo);
  const rede = Math.floor(ip / tamanho) * tamanho;
  return { rede, prefixo, tamanho };
}

function cidrsubnet(prefixo, novosBits, numero, fn = 'cidrsubnet') {
  const base = lerCidr(prefixo, fn);
  const novo = base.prefixo + paraNumero(novosBits);
  if (novo > 32) throw erroArg(fn, `não cabem mais ${novosBits} bits em ${prefixo} (o prefixo passaria de /32).`);
  const quantas = 2 ** paraNumero(novosBits);
  const n = paraNumero(numero);
  if (n < 0 || n >= quantas) throw erroArg(fn, `com ${novosBits} bits novos existem só ${quantas} sub-redes (0 a ${quantas - 1}); ${n} está fora.`);
  return `${numeroParaIp(base.rede + n * 2 ** (32 - novo))}/${novo}`;
}

// ---------- utilidades ----------

function hashSimples(textoEntrada) {
  // FNV-1a de 32 bits, repetido para formar hashes longos e estáveis (não é criptografia).
  let saida = '';
  let semente = 0x811c9dc5;
  for (let rodada = 0; saida.length < 64; rodada++) {
    let h = semente ^ rodada;
    for (const c of new TextEncoder().encode(textoEntrada)) {
      h ^= c;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    semente = h;
    saida += h.toString(16).padStart(8, '0');
  }
  return saida;
}
export { hashSimples };

function base64(textoEntrada) {
  const bytes = new TextEncoder().encode(textoEntrada);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function formatar(fn, modelo, args) {
  let k = 0;
  return modelo.replace(/%(-?)(0?)(\d*)(\.\d+)?([sdfvqt%])/g, (_, esquerda, zeros, largura, precisao, verbo) => {
    if (verbo === '%') return '%';
    if (k >= args.length) throw erroArg(fn, `o modelo "${modelo}" pede mais valores do que foram passados.`);
    const v = args[k++];
    let s;
    if (verbo === 'd') s = String(Math.trunc(paraNumero(v)));
    else if (verbo === 'f') s = paraNumero(v).toFixed(precisao ? Number(precisao.slice(1)) : 6);
    else if (verbo === 'q') s = JSON.stringify(texto(v));
    else if (verbo === 't') s = String(paraBool(v));
    else if (verbo === 'v' && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') s = JSON.stringify(v);
    else s = texto(v);
    const w = Number(largura);
    if (w) s = esquerda ? s.padEnd(w) : s.padStart(w, zeros && verbo !== 's' ? '0' : ' ');
    return s;
  });
}

function achatar(v) {
  return v.flatMap((x) => (Array.isArray(x) ? achatar(x) : [x]));
}

/** Converte um valor JS (de JSON) para valor do Terraform. */
function deJson(v) {
  if (Array.isArray(v)) return v.map(deJson);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deJson(x)]));
  return v;
}

function paraJson(v) {
  if (v instanceof Desconhecido) return null;
  if (Array.isArray(v)) return v.map(paraJson);
  if (ehObjeto(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, paraJson(v[k])]));
  return v;
}

function templateArquivo(conteudo, vars, ctx) {
  // ${var} e ${expressão simples} usando as variáveis passadas.
  return conteudo.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const valor = ctx.avaliarTexto(expr.trim(), vars);
    return paraTexto(valor, 'um template');
  });
}

// ---------- tabela de funções ----------

export const FUNCOES = {
  // números
  abs: ([n]) => Math.abs(paraNumero(n)),
  ceil: ([n]) => Math.ceil(paraNumero(n)),
  floor: ([n]) => Math.floor(paraNumero(n)),
  max: (args) => {
    if (!args.length) throw erroArg('max', 'passe pelo menos um número (use max(lista...) para uma lista).');
    return Math.max(...args.map(paraNumero));
  },
  min: (args) => {
    if (!args.length) throw erroArg('min', 'passe pelo menos um número (use min(lista...) para uma lista).');
    return Math.min(...args.map(paraNumero));
  },
  pow: ([a, b]) => paraNumero(a) ** paraNumero(b),
  signum: ([n]) => Math.sign(paraNumero(n)),
  parseint: ([s, base]) => {
    const n = parseInt(texto(s), paraNumero(base));
    if (Number.isNaN(n)) throw erroArg('parseint', `"${s}" não é um número na base ${base}.`);
    return n;
  },
  sum: ([l]) => lista(l, 'sum').reduce((a, b) => a + paraNumero(b), 0),

  // texto
  chomp: ([s]) => texto(s).replace(/(\r?\n)+$/, ''),
  format: ([modelo, ...args]) => formatar('format', texto(modelo), args),
  formatlist: ([modelo, ...args]) => {
    const tamanho = Math.max(...args.map((a) => (Array.isArray(a) ? a.length : 1)));
    return Array.from({ length: tamanho }, (_, i) => formatar('formatlist', texto(modelo), args.map((a) => (Array.isArray(a) ? a[i] : a))));
  },
  indent: ([n, s]) => texto(s).split('\n').map((l, i) => (i === 0 ? l : ' '.repeat(paraNumero(n)) + l)).join('\n'),
  join: ([sep, ...listas]) => listas.flatMap((l) => lista(l, 'join', 'a lista')).map((x) => texto(x)).join(texto(sep)),
  lower: ([s]) => texto(s).toLowerCase(),
  upper: ([s]) => texto(s).toUpperCase(),
  title: ([s]) => texto(s).replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
  replace: ([s, de, para]) => {
    const alvo = texto(de);
    if (alvo.length > 2 && alvo.startsWith('/') && alvo.endsWith('/')) {
      return texto(s).replace(new RegExp(alvo.slice(1, -1), 'g'), texto(para).replace(/\$\{?(\d+)\}?/g, '$$$1'));
    }
    return texto(s).split(alvo).join(texto(para));
  },
  split: ([sep, s]) => texto(s).split(texto(sep)),
  strrev: ([s]) => [...texto(s)].reverse().join(''),
  substr: ([s, inicio, tamanho]) => {
    const chars = [...texto(s)];
    let i = paraNumero(inicio);
    if (i < 0) i = chars.length + i;
    const n = paraNumero(tamanho);
    return chars.slice(i, n < 0 ? undefined : i + n).join('');
  },
  trim: ([s, cs]) => {
    const conjuntoChars = new Set(texto(cs));
    const c = [...texto(s)];
    while (c.length && conjuntoChars.has(c[0])) c.shift();
    while (c.length && conjuntoChars.has(c.at(-1))) c.pop();
    return c.join('');
  },
  trimprefix: ([s, p]) => (texto(s).startsWith(texto(p)) ? texto(s).slice(texto(p).length) : texto(s)),
  trimsuffix: ([s, p]) => (texto(s).endsWith(texto(p)) && texto(p) ? texto(s).slice(0, -texto(p).length) : texto(s)),
  trimspace: ([s]) => texto(s).trim(),
  startswith: ([s, p]) => texto(s).startsWith(texto(p)),
  endswith: ([s, p]) => texto(s).endsWith(texto(p)),
  strcontains: ([s, p]) => texto(s).includes(texto(p)),
  regex: ([padrao, s]) => {
    const m = new RegExp(texto(padrao)).exec(texto(s));
    if (!m) throw erroArg('regex', `o padrão não encontrou nada em "${s}". Use can(regex(...)) para testar.`);
    if (m.groups) return { ...m.groups };
    return m.length > 1 ? m.slice(1) : m[0];
  },
  regexall: ([padrao, s]) => [...texto(s).matchAll(new RegExp(texto(padrao), 'g'))].map((m) => (m.length > 1 ? m.slice(1) : m[0])),

  // coleções
  alltrue: ([l]) => lista(l, 'alltrue').every((x) => paraBool(x)),
  anytrue: ([l]) => lista(l, 'anytrue').some((x) => paraBool(x)),
  chunklist: ([l, n]) => {
    const itens = lista(l, 'chunklist');
    const tamanho = paraNumero(n);
    const saida = [];
    for (let i = 0; i < itens.length; i += tamanho) saida.push(itens.slice(i, i + tamanho));
    return saida;
  },
  coalesce: (args) => {
    const v = args.find((x) => x !== null && x !== '');
    if (v === undefined) throw erroArg('coalesce', 'todos os argumentos são null ou vazios.');
    return v;
  },
  coalescelist: (args) => args.find((x) => Array.isArray(x) && x.length) ?? [],
  compact: ([l]) => lista(l, 'compact').filter((x) => x !== null && x !== ''),
  concat: (args) => args.flatMap((l) => lista(l, 'concat', 'cada argumento')),
  contains: ([l, v]) => lista(l, 'contains').some((x) => iguais(x, v)),
  distinct: ([l]) => lista(l, 'distinct').filter((x, i, arr) => arr.findIndex((y) => iguais(x, y)) === i),
  element: ([l, i]) => {
    const itens = lista(l, 'element');
    if (!itens.length) throw erroArg('element', 'a lista está vazia.');
    const n = paraNumero(i);
    return itens[((n % itens.length) + itens.length) % itens.length];
  },
  flatten: ([l]) => achatar(lista(l, 'flatten')),
  index: ([l, v]) => {
    const i = lista(l, 'index').findIndex((x) => iguais(x, v));
    if (i < 0) throw erroArg('index', 'o valor não está na lista.');
    return i;
  },
  keys: ([m]) => Object.keys(mapa(m, 'keys')).sort(),
  values: ([m]) => Object.keys(mapa(m, 'values')).sort().map((k) => m[k]),
  length: ([v]) => {
    if (typeof v === 'string') return [...v].length;
    if (Array.isArray(v)) return v.length;
    if (ehObjeto(v)) return Object.keys(v).length;
    throw erroArg('length', `não existe tamanho para um valor ${nomeDoTipo(v)}.`);
  },
  lookup: ([m, chave, padrao], ctx, nArgs) => {
    const obj = mapa(m, 'lookup');
    const k = texto(chave);
    if (k in obj) return obj[k];
    if (nArgs < 3) throw erroArg('lookup', `a chave "${k}" não existe no mapa e não foi passado um valor padrão.`);
    return padrao;
  },
  merge: (args) => Object.assign({}, ...args.filter((a) => a !== null).map((a) => mapa(a, 'merge', 'cada argumento'))),
  one: ([l]) => {
    const itens = lista(l, 'one');
    if (itens.length > 1) throw erroArg('one', `a lista tem ${itens.length} itens; one() aceita 0 ou 1.`);
    return itens[0] ?? null;
  },
  range: (args) => {
    const [inicio, fim, passo] = args.length === 1 ? [0, paraNumero(args[0]), 1]
      : [paraNumero(args[0]), paraNumero(args[1]), args[2] === undefined ? 1 : paraNumero(args[2])];
    const saida = [];
    if (passo === 0) throw erroArg('range', 'o passo não pode ser zero.');
    for (let i = inicio; passo > 0 ? i < fim : i > fim; i += passo) {
      saida.push(i);
      if (saida.length > 1024) throw erroArg('range', 'o simulador limita range() a 1024 itens.');
    }
    return saida;
  },
  reverse: ([l]) => [...lista(l, 'reverse')].reverse(),
  setintersection: ([a, ...resto]) => conjunto(lista(a, 'setintersection').filter((x) => resto.every((r) => lista(r, 'setintersection').some((y) => iguais(x, y))))),
  setsubtract: ([a, b]) => conjunto(lista(a, 'setsubtract').filter((x) => !lista(b, 'setsubtract').some((y) => iguais(x, y)))),
  setunion: (args) => conjunto(args.flatMap((l) => lista(l, 'setunion'))),
  setproduct: (args) => args.reduce((acc, l) => acc.flatMap((combo) => lista(l, 'setproduct').map((x) => [...combo, x])), [[]]),
  slice: ([l, i, j]) => {
    const itens = lista(l, 'slice');
    const a = paraNumero(i);
    const b = paraNumero(j);
    if (a < 0 || b > itens.length || a > b) throw erroArg('slice', `os índices ${a} e ${b} estão fora da lista (tamanho ${itens.length}).`);
    return itens.slice(a, b);
  },
  sort: ([l]) => [...lista(l, 'sort')].map((x) => texto(x)).sort(),
  zipmap: ([ks, vs]) => {
    const chaves = lista(ks, 'zipmap');
    const valores = lista(vs, 'zipmap');
    if (chaves.length !== valores.length) throw erroArg('zipmap', 'as duas listas precisam ter o mesmo tamanho.');
    return Object.fromEntries(chaves.map((k, i) => [texto(k), valores[i]]));
  },
  transpose: ([m]) => {
    const saida = {};
    for (const [k, l] of Object.entries(mapa(m, 'transpose'))) {
      for (const v of lista(l, 'transpose')) (saida[texto(v)] ??= []).push(k);
    }
    return saida;
  },

  // codificação
  base64encode: ([s]) => base64(texto(s)),
  base64decode: ([s]) => {
    const bin = atob(texto(s));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  },
  jsonencode: ([v]) => JSON.stringify(paraJson(v)),
  jsondecode: ([s]) => {
    try {
      return deJson(JSON.parse(texto(s)));
    } catch {
      throw erroArg('jsondecode', 'o texto não é um JSON válido.');
    }
  },
  urlencode: ([s]) => encodeURIComponent(texto(s)),
  md5: ([s]) => hashSimples(`md5:${texto(s)}`).slice(0, 32),
  sha1: ([s]) => hashSimples(`sha1:${texto(s)}`).slice(0, 40),
  sha256: ([s]) => hashSimples(`sha256:${texto(s)}`),
  filemd5: ([p], ctx) => hashSimples(`md5:${ctx.lerArquivo(texto(p))}`).slice(0, 32),
  filebase64sha256: ([p], ctx) => base64(hashSimples(`sha256:${ctx.lerArquivo(texto(p))}`).slice(0, 32)),
  uuid: () => desconhecido('uuid()', 'string'),
  timestamp: () => desconhecido('timestamp()', 'string'),
  bcrypt: () => desconhecido('bcrypt()', 'string'),

  // rede
  cidrhost: ([prefixo, n]) => {
    const { rede, tamanho } = lerCidr(prefixo, 'cidrhost');
    const i = paraNumero(n);
    if (i < 0 || i >= tamanho) throw erroArg('cidrhost', `o host ${i} não cabe em ${prefixo} (${tamanho} endereços).`);
    return numeroParaIp(rede + i);
  },
  cidrnetmask: ([prefixo]) => {
    const { prefixo: p } = lerCidr(prefixo, 'cidrnetmask');
    return numeroParaIp(p === 0 ? 0 : (2 ** 32 - 2 ** (32 - p)));
  },
  cidrsubnet: ([prefixo, bits, n]) => cidrsubnet(prefixo, bits, n),
  cidrsubnets: ([prefixo, ...bits]) => {
    const base = lerCidr(prefixo, 'cidrsubnets');
    let atual = base.rede;
    return bits.map((b) => {
      const novo = base.prefixo + paraNumero(b);
      const tamanho = 2 ** (32 - novo);
      atual = Math.ceil(atual / tamanho) * tamanho;
      const cidr = `${numeroParaIp(atual)}/${novo}`;
      atual += tamanho;
      if (atual > base.rede + base.tamanho) throw erroArg('cidrsubnets', `as sub-redes não cabem em ${prefixo}.`);
      return cidr;
    });
  },

  // tipos
  tobool: ([v]) => (v === null ? null : paraBool(v)),
  tonumber: ([v]) => (v === null ? null : paraNumero(v)),
  tostring: ([v]) => {
    if (v === null) return null;
    if (typeof v === 'object') throw erroArg('tostring', `não dá para converter ${nomeDoTipo(v)} em string. Use jsonencode().`);
    return texto(v);
  },
  tolist: ([v]) => [...lista(v, 'tolist')],
  toset: ([v]) => conjunto(lista(v, 'toset')),
  tomap: ([v]) => ({ ...mapa(v, 'tomap') }),
  type: ([v]) => nomeDoTipo(v),

  // arquivos (os arquivos do editor)
  file: ([p], ctx) => ctx.lerArquivo(texto(p)),
  fileexists: ([p], ctx) => ctx.existeArquivo(texto(p)),
  templatefile: ([p, vars], ctx) => templateArquivo(ctx.lerArquivo(texto(p)), mapa(vars, 'templatefile', 'o segundo argumento'), ctx),
  abspath: ([p]) => `/workspace/${texto(p).replace(/^\.\//, '')}`,
  basename: ([p]) => texto(p).split('/').pop(),
  dirname: ([p]) => texto(p).split('/').slice(0, -1).join('/') || '.',
  pathexpand: ([p]) => texto(p).replace(/^~/, '/home/aluno'),

  // sensibilidade
  sensitive: ([v], ctx) => {
    ctx.marcarSensivel();
    return v;
  },
  nonsensitive: ([v], ctx) => {
    ctx.desmarcarSensivel();
    return v;
  },
};

/** Funções que lidam com erro ou desconhecido do próprio jeito (recebem as expressões). */
export const ESPECIAIS = new Set(['try', 'can']);

/** Funções que não propagam "desconhecido" automaticamente. */
const SEM_PROPAGAR = new Set(['length', 'coalesce', 'concat', 'merge', 'tolist', 'toset', 'tomap', 'sensitive', 'nonsensitive', 'type']);

export function chamarFuncao(nome, args, ctx) {
  const fn = FUNCOES[nome];
  if (!fn) {
    throw new ErroValor('Call to unknown function',
      `Não existe a função "${nome}". Confira o nome (ex.: lower, upper, join, length, merge, cidrsubnet).`);
  }
  if (!SEM_PROPAGAR.has(nome) && args.some(temDesconhecido)) return desconhecido(`${nome}()`);
  if (nome === 'length' && args[0] instanceof Desconhecido) return desconhecido('length()', 'number');
  return copiar(fn(args, ctx, args.length));
}

export { textoDoNumero };
