// Avaliação das expressões do HCL.
//
// `avaliar(expr, ctx)` devolve o valor. O ctx traz:
//   resolver(ref, ctx)   → valor da raiz de uma referência (var., local., recurso...)
//                           e quantos passos ela consumiu;
//   locais               → variáveis de um `for` (nome → valor);
//   arquivo              → para as mensagens de erro;
//   sensivel             → vira true se a expressão tocou um valor sensível.
import {
  Desconhecido, desconhecido, ehDesconhecido, temDesconhecido, ehObjeto, ehConjunto, conjunto, iguais,
  paraTexto, paraNumero, paraBool, nomeDoTipo, ErroValor, textoDoNumero,
} from './valores.js';
import { chamarFuncao, ESPECIAIS } from './funcoes.js';

export class ErroAvaliacao extends Error {
  constructor(resumo, detalhe, { linha, coluna, arquivo } = {}) {
    super(resumo);
    this.resumo = resumo;
    this.detalhe = detalhe;
    this.linha = linha;
    this.coluna = coluna;
    this.arquivo = arquivo;
  }
}

/** Marca objetos que são instâncias de recurso, para mensagens melhores. */
export const INFO_RECURSO = Symbol('infoRecurso');

function localizar(erro, expr, ctx) {
  if (erro instanceof ErroAvaliacao) return erro;
  if (erro instanceof ErroValor) {
    return new ErroAvaliacao(erro.resumo, erro.detalhe, { linha: expr.linha, coluna: expr.coluna, arquivo: ctx.arquivo });
  }
  throw erro;
}

export function avaliar(expr, ctx) {
  try {
    return avaliarSemLocal(expr, ctx);
  } catch (erro) {
    throw localizar(erro, expr, ctx);
  }
}

function avaliarSemLocal(e, ctx) {
  switch (e.k) {
    case 'lit': return e.valor;
    case 'paren': return avaliar(e.x, ctx);
    case 'tpl': return template(e, ctx);
    case 'tupla': return e.itens.map((x) => avaliar(x, ctx));
    case 'objeto': {
      const obj = {};
      for (const { chave, valor } of e.pares) {
        const k = chave.ident ? chave.valor : avaliar(chave, ctx);
        if (ehDesconhecido(k)) return desconhecido('objeto');
        obj[paraTexto(k, 'uma chave de objeto')] = avaliar(valor, ctx);
      }
      return obj;
    }
    case 'ref': return referencia(e, ctx);
    case 'acesso': return aplicarPasso(avaliar(e.alvo, ctx), e.passo, ctx, e);
    case 'splat': return splat(e, ctx);
    case 'chamada': return chamada(e, ctx);
    case 'un': return unario(e, ctx);
    case 'bin': return binario(e, ctx);
    case 'cond': {
      const c = avaliar(e.cond, ctx);
      if (ehDesconhecido(c)) return desconhecido('condicional');
      if (typeof c !== 'boolean') {
        throw new ErroValor('Incorrect condition type', `A condição antes do "?" precisa ser true ou false, mas é ${nomeDoTipo(c)}.`);
      }
      return avaliar(c ? e.sim : e.nao, ctx);
    }
    case 'for': return paraCada(e, ctx);
    default: throw new ErroValor('Invalid expression', `Expressão desconhecida: ${e.k}`);
  }
}

function template(e, ctx) {
  if (e.unico) return avaliar(e.partes[0], ctx);
  let saida = '';
  for (const parte of e.partes) {
    if (typeof parte === 'string') {
      saida += parte;
      continue;
    }
    const v = avaliar(parte, ctx);
    if (temDesconhecido(v)) return desconhecido(ehDesconhecido(v) ? v.origem : 'template', 'string');
    try {
      saida += paraTexto(v, 'uma string');
    } catch (erro) {
      throw localizar(erro, parte, ctx);
    }
  }
  return saida;
}

// ---------- referências ----------

function referencia(e, ctx) {
  if (ctx.locais && e.raiz in ctx.locais) {
    return aplicarPassos(ctx.locais[e.raiz], e.passos, ctx, e);
  }
  const { valor, consumidos } = ctx.resolver(e, ctx);
  return aplicarPassos(valor, e.passos.slice(consumidos), ctx, e);
}

function aplicarPassos(valor, passos, ctx, e) {
  let v = valor;
  for (const passo of passos) v = aplicarPasso(v, passo, ctx, e);
  return v;
}

function aplicarPasso(v, passo, ctx, e) {
  if (ehDesconhecido(v)) return desconhecido(v.origem);
  if ('attr' in passo) {
    const nome = passo.attr;
    if (ehObjeto(v)) {
      const info = v[INFO_RECURSO];
      if (!(nome in v)) {
        if (info) {
          throw new ErroAvaliacao('Unsupported attribute',
            `O recurso ${info.tipo} não tem o argumento ou atributo "${nome}".${info.sugestao?.(nome) ?? ''}`,
            { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
        }
        throw new ErroAvaliacao('Unsupported attribute', `Este objeto não tem um atributo chamado "${nome}".`, { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
      }
      if (info?.sensiveis?.has(nome)) ctx.sensivel = true;
      return v[nome];
    }
    if (Array.isArray(v)) {
      throw new ErroAvaliacao('Unsupported attribute',
        `Este valor é uma lista (${v.length} itens) e não tem atributos. Escolha um item com [0] ou use [*].${nome} para pegar "${nome}" de todos.`,
        { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
    }
    if (v === null) {
      throw new ErroAvaliacao('Attempt to get attribute from null value', `Não dá para ler "${nome}" de um valor null.`, { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
    }
    throw new ErroAvaliacao('Unsupported attribute', `Um valor ${nomeDoTipo(v)} não tem atributos.`, { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
  }
  const indice = avaliar(passo.indice, ctx);
  if (ehDesconhecido(indice)) return desconhecido('índice');
  if (ehConjunto(v)) {
    throw new ErroAvaliacao('Invalid index',
      'Itens de um conjunto (set) não têm posição: não dá para usar [0]. Converta com tolist() ou percorra com for.',
      { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
  }
  if (Array.isArray(v)) {
    const n = paraNumero(indice);
    if (!Number.isInteger(n) || n < 0 || n >= v.length) {
      throw new ErroAvaliacao('Invalid index',
        `O índice ${textoDoNumero(n)} não existe: a lista tem ${v.length} ${v.length === 1 ? 'item' : 'itens'} (índices de 0 a ${v.length - 1}).`,
        { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
    }
    return v[n];
  }
  if (ehObjeto(v)) {
    const k = paraTexto(indice, 'um índice');
    if (!(k in v)) {
      throw new ErroAvaliacao('Invalid index', `A chave "${k}" não existe. Chaves disponíveis: ${Object.keys(v).map((c) => `"${c}"`).join(', ') || 'nenhuma'}.`,
        { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
    }
    return v[k];
  }
  if (v === null) throw new ErroAvaliacao('Attempt to index null value', 'Não dá para usar [ ] num valor null.', { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
  throw new ErroAvaliacao('Invalid index', `Um valor ${nomeDoTipo(v)} não aceita índice [ ].`, { linha: e.linha, coluna: e.coluna, arquivo: ctx.arquivo });
}

function splat(e, ctx) {
  const v = avaliar(e.alvo, ctx);
  if (ehDesconhecido(v)) return desconhecido(v.origem);
  if (v === null) return [];
  const itens = Array.isArray(v) ? v : ehObjeto(v) && !v[INFO_RECURSO] ? Object.values(v) : [v];
  return itens.map((item) => aplicarPassos(item, e.passos, ctx, e));
}

// ---------- funções ----------

function chamada(e, ctx) {
  if (ESPECIAIS.has(e.nome)) {
    if (e.nome === 'can') {
      if (e.args.length !== 1) throw new ErroValor('Invalid function argument', 'can() recebe uma expressão só.');
      try {
        const v = avaliar(e.args[0], ctx);
        return ehDesconhecido(v) ? desconhecido('can()', 'bool') : true;
      } catch (erro) {
        if (erro instanceof ErroAvaliacao || erro instanceof ErroValor) return false;
        throw erro;
      }
    }
    for (const arg of e.args) {
      try {
        return avaliar(arg, ctx);
      } catch (erro) {
        if (!(erro instanceof ErroAvaliacao || erro instanceof ErroValor)) throw erro;
      }
    }
    throw new ErroValor('Invalid function argument', 'try(): nenhuma das expressões funcionou.');
  }
  let args = e.args.map((a) => avaliar(a, ctx));
  if (e.expandir) {
    const ultimo = args.pop();
    if (ehDesconhecido(ultimo)) return desconhecido(`${e.nome}()`);
    if (!Array.isArray(ultimo)) throw new ErroValor('Invalid expanding argument value', 'Depois de ... deve vir uma lista.');
    args = [...args, ...ultimo];
  }
  const funcaoCtx = {
    lerArquivo: (p) => ctx.lerArquivo(p),
    existeArquivo: (p) => ctx.existeArquivo(p),
    avaliarTexto: (texto, vars) => ctx.avaliarTexto(texto, vars),
    marcarSensivel: () => { ctx.sensivel = true; },
    desmarcarSensivel: () => { ctx.sensivel = false; },
  };
  return chamarFuncao(e.nome, args, funcaoCtx);
}

// ---------- operadores ----------

function unario(e, ctx) {
  const x = avaliar(e.x, ctx);
  if (ehDesconhecido(x)) return desconhecido(x.origem);
  if (e.op === '!') return !paraBool(x);
  return -paraNumero(x);
}

function binario(e, ctx) {
  const a = avaliar(e.a, ctx);
  if (e.op === '&&' && a === false) return false;
  if (e.op === '||' && a === true) return true;
  const b = avaliar(e.b, ctx);
  if (e.op === '==' || e.op === '!=') {
    if (temDesconhecido(a) || temDesconhecido(b)) return desconhecido('comparação', 'bool');
    const igual = iguais(a, b);
    return e.op === '==' ? igual : !igual;
  }
  if (ehDesconhecido(a) || ehDesconhecido(b)) return desconhecido('operação');
  switch (e.op) {
    case '&&': return paraBool(a) && paraBool(b);
    case '||': return paraBool(a) || paraBool(b);
    case '+': return paraNumero(a) + paraNumero(b);
    case '-': return paraNumero(a) - paraNumero(b);
    case '*': return paraNumero(a) * paraNumero(b);
    case '/': {
      if (paraNumero(b) === 0) throw new ErroValor('Operation failed', 'Divisão por zero.');
      return paraNumero(a) / paraNumero(b);
    }
    case '%': return paraNumero(a) % paraNumero(b);
    case '<': return paraNumero(a) < paraNumero(b);
    case '>': return paraNumero(a) > paraNumero(b);
    case '<=': return paraNumero(a) <= paraNumero(b);
    case '>=': return paraNumero(a) >= paraNumero(b);
    default: throw new ErroValor('Invalid operator', e.op);
  }
}

// ---------- for ----------

function paraCada(e, ctx) {
  const colecao = avaliar(e.colecao, ctx);
  if (ehDesconhecido(colecao)) return desconhecido('for');
  let pares;
  if (Array.isArray(colecao)) pares = colecao.map((v, i) => [ehConjunto(colecao) ? v : i, v]);
  else if (ehObjeto(colecao)) pares = Object.keys(colecao).sort().map((k) => [k, colecao[k]]);
  else throw new ErroValor('Iteration over non-iterable value', `O for precisa de uma lista, conjunto ou mapa, mas recebeu ${nomeDoTipo(colecao)}.`);

  const resultadoLista = [];
  const resultadoObjeto = {};
  for (const [k, v] of pares) {
    const locais = { ...(ctx.locais ?? {}), [e.valorVar]: v };
    if (e.chaveVar) locais[e.chaveVar] = k;
    const sub = { ...ctx, locais };
    if (e.cond) {
      const c = avaliar(e.cond, sub);
      if (ehDesconhecido(c)) return desconhecido('for');
      if (!paraBool(c)) continue;
    }
    if (!e.objeto) {
      resultadoLista.push(avaliar(e.valorExpr, sub));
      continue;
    }
    const chave = avaliar(e.chaveExpr, sub);
    if (ehDesconhecido(chave)) return desconhecido('for');
    const textoChave = paraTexto(chave, 'uma chave de objeto');
    const valor = avaliar(e.valorExpr, sub);
    if (e.agrupar) {
      (resultadoObjeto[textoChave] ??= []).push(valor);
    } else {
      if (textoChave in resultadoObjeto) {
        throw new ErroValor('Duplicate object key',
          `Duas chaves iguais ("${textoChave}") no for. Use => valor... (com reticências) para agrupar os valores em listas.`);
      }
      resultadoObjeto[textoChave] = valor;
    }
  }
  return e.objeto ? resultadoObjeto : resultadoLista;
}

// ---------- análise estática: quais referências uma expressão usa ----------

/** Lista as referências (ex.: "var.x", "aws_s3_bucket.b", "data.aws_ami.u") de uma expressão. */
export function referenciasDe(expr, ignorar = new Set()) {
  const saida = [];
  const visitar = (e, locais) => {
    if (!e || typeof e !== 'object') return;
    switch (e.k) {
      case 'ref': {
        if (locais.has(e.raiz)) {
          e.passos.forEach((p) => p.indice && visitar(p.indice, locais));
          return;
        }
        saida.push({ ref: e, endereco: enderecoDe(e), linha: e.linha });
        e.passos.forEach((p) => p.indice && visitar(p.indice, locais));
        return;
      }
      case 'for': {
        visitar(e.colecao, locais);
        const novos = new Set([...locais, e.valorVar, ...(e.chaveVar ? [e.chaveVar] : [])]);
        visitar(e.chaveExpr, novos);
        visitar(e.valorExpr, novos);
        visitar(e.cond, novos);
        return;
      }
      case 'tpl': e.partes.forEach((p) => typeof p !== 'string' && visitar(p, locais)); return;
      case 'tupla': e.itens.forEach((x) => visitar(x, locais)); return;
      case 'objeto': e.pares.forEach(({ chave, valor }) => { if (!chave.ident) visitar(chave, locais); visitar(valor, locais); }); return;
      case 'acesso': visitar(e.alvo, locais); if (e.passo.indice) visitar(e.passo.indice, locais); return;
      case 'splat': visitar(e.alvo, locais); e.passos.forEach((p) => p.indice && visitar(p.indice, locais)); return;
      case 'chamada': e.args.forEach((x) => visitar(x, locais)); return;
      case 'un': visitar(e.x, locais); return;
      case 'bin': visitar(e.a, locais); visitar(e.b, locais); return;
      case 'cond': visitar(e.cond, locais); visitar(e.sim, locais); visitar(e.nao, locais); return;
      case 'paren': visitar(e.x, locais); return;
      default:
    }
  };
  visitar(expr, ignorar);
  return saida;
}

/** "var.regiao", "aws_vpc.main", "data.aws_ami.ubuntu", "module.rede", "local.nome"... */
export function enderecoDe(ref) {
  const p = ref.passos;
  const nome = (i) => p[i]?.attr;
  switch (ref.raiz) {
    case 'var': case 'local': case 'module': return nome(0) ? `${ref.raiz}.${nome(0)}` : ref.raiz;
    case 'data': return nome(0) && nome(1) ? `data.${nome(0)}.${nome(1)}` : 'data';
    case 'count': case 'each': case 'path': case 'terraform': case 'self': return ref.raiz;
    default: return nome(0) ? `${ref.raiz}.${nome(0)}` : ref.raiz;
  }
}

export { Desconhecido, conjunto };
