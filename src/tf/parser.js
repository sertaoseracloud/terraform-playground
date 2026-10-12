// Analisador sintático do HCL: transforma os tokens numa árvore.
//
// Corpo:  { atributos: [{ nome, expr, linha }], blocos: [{ tipo, rotulos, corpo, linha }] }
// Expressões (campo `k`): lit, tpl, tupla, objeto, ref, chamada, un, bin, cond, for, splat.
// Toda expressão guarda `linha` e `coluna` para as mensagens de erro.
import { lexar, ErroHCL } from './lexer.js';

const PRECEDENCIA = [['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];

export function analisar(fonte, arquivo = 'main.tf') {
  const tokens = lexar(fonte, arquivo);
  const p = new Parser(tokens, arquivo);
  const corpo = p.corpo(true);
  return corpo;
}

/** Analisa uma expressão solta (usada em testes e no console). */
export function analisarExpressao(fonte) {
  const p = new Parser(lexar(fonte, 'expressão'), 'expressão');
  const e = p.expressao();
  p.pularNl();
  p.esperarTipo('fim');
  return e;
}

class Parser {
  constructor(tokens, arquivo) {
    this.t = tokens;
    this.i = 0;
    this.arquivo = arquivo;
  }

  get atual() { return this.t[this.i]; }
  espiar(n = 1) { return this.t[this.i + n]; }
  proximo() { return this.t[this.i++]; }

  erro(resumo, detalhe, tok = this.atual) {
    return new ErroHCL(resumo, detalhe, { linha: tok.linha, coluna: tok.coluna, arquivo: this.arquivo });
  }

  eh(valor) { return this.atual.tipo === 'pont' && this.atual.valor === valor; }
  aceitar(valor) {
    if (this.eh(valor)) { this.i++; return true; }
    return false;
  }
  esperar(valor, resumo, detalhe) {
    if (!this.eh(valor)) throw this.erro(resumo ?? `Missing "${valor}"`, detalhe ?? `Era esperado "${valor}" aqui.`);
    return this.proximo();
  }
  esperarTipo(tipo) {
    if (this.atual.tipo !== tipo) throw this.erro('Unexpected token', `Não era esperado "${this.atual.valor ?? 'fim do arquivo'}" aqui.`);
    return this.proximo();
  }
  pularNl() { while (this.atual.tipo === 'nl') this.i++; }

  // ---------- corpo: atributos e blocos ----------

  corpo(raiz, abertura = null) {
    const corpo = { atributos: [], blocos: [] };
    const vistos = new Map();
    for (;;) {
      this.pularNl();
      if (raiz ? this.atual.tipo === 'fim' : this.eh('}')) break;
      if (this.atual.tipo === 'fim') {
        throw this.erro('Unclosed configuration block',
          'Este bloco foi aberto com "{" e nunca foi fechado. Confira se cada "{" tem o seu "}".', abertura ?? this.atual);
      }
      const nomeTok = this.atual;
      if (nomeTok.tipo !== 'ident') {
        throw this.erro('Argument or block definition required',
          'Aqui deveria começar um argumento (nome = valor) ou um bloco (tipo "rótulo" { ... }).');
      }
      this.i++;
      if (this.eh('=')) {
        this.i++;
        const expr = this.expressao();
        this.fimDeLinha('argument');
        if (vistos.has(nomeTok.valor)) {
          throw this.erro('Attribute redefined',
            `O argumento "${nomeTok.valor}" já foi definido na linha ${vistos.get(nomeTok.valor)}. Cada argumento só pode aparecer uma vez no bloco.`, nomeTok);
        }
        vistos.set(nomeTok.valor, nomeTok.linha);
        corpo.atributos.push({ nome: nomeTok.valor, expr, linha: nomeTok.linha, coluna: nomeTok.coluna });
        continue;
      }
      const rotulos = [];
      while (this.atual.tipo === 'template' || this.atual.tipo === 'ident') {
        const r = this.proximo();
        if (r.tipo === 'template') {
          if (r.valor.length !== 1 || typeof r.valor[0] !== 'string') {
            throw this.erro('Invalid block label', 'Rótulos de bloco são textos fixos: não podem ter ${...}.', r);
          }
          rotulos.push(r.valor[0]);
        } else {
          rotulos.push(r.valor);
        }
      }
      if (!this.eh('{')) {
        if (this.eh(':')) {
          throw this.erro('Invalid argument definition', 'No HCL o argumento usa "=" e não ":". Ex.: nome = "valor".');
        }
        throw this.erro('Invalid block definition',
          rotulos.length
            ? `Depois de ${nomeTok.valor} ${rotulos.map((r) => `"${r}"`).join(' ')} deveria vir "{" para abrir o bloco.`
            : `Depois de "${nomeTok.valor}" deveria vir "=" (argumento) ou "{" (bloco).`);
      }
      this.i++;
      const abre = nomeTok;
      // Bloco de uma linha: tipo { nome = valor }
      const interno = this.corpo(false, abre);
      const fecha = this.esperar('}', 'Unclosed configuration block', 'Faltou fechar este bloco com "}".');
      this.fimDeLinha('block');
      corpo.blocos.push({ tipo: nomeTok.valor, rotulos, corpo: interno, linha: abre.linha, coluna: abre.coluna, fim: fecha.linha });
    }
    return corpo;
  }

  fimDeLinha(oQue) {
    if (this.atual.tipo === 'nl' || this.atual.tipo === 'fim' || this.eh('}')) return;
    throw this.erro(`Missing newline after ${oQue}`,
      oQue === 'argument'
        ? 'Cada argumento fica na própria linha. Talvez falte uma vírgula, aspas ou operador entre os valores.'
        : 'Depois de fechar um bloco com "}", quebre a linha.');
  }

  // ---------- expressões ----------

  expressao() {
    const cond = this.binaria(0);
    if (this.aceitar('?')) {
      this.pularNl();
      const sim = this.expressao();
      this.pularNl();
      this.esperar(':', 'Missing false expression in conditional', 'A expressão condicional precisa de ":" e do valor para o caso falso: condição ? valor_se_sim : valor_se_não.');
      this.pularNl();
      const nao = this.expressao();
      return { k: 'cond', cond, sim, nao, linha: cond.linha, coluna: cond.coluna };
    }
    return cond;
  }

  binaria(nivel) {
    if (nivel >= PRECEDENCIA.length) return this.unaria();
    let esq = this.binaria(nivel + 1);
    while (this.atual.tipo === 'pont' && PRECEDENCIA[nivel].includes(this.atual.valor)) {
      const op = this.proximo();
      this.pularNlSeAgrupado();
      const dir = this.binaria(nivel + 1);
      esq = { k: 'bin', op: op.valor, a: esq, b: dir, linha: op.linha, coluna: op.coluna };
    }
    return esq;
  }

  pularNlSeAgrupado() {
    if (this.agrupado > 0) this.pularNl();
  }

  unaria() {
    if (this.eh('!') || this.eh('-')) {
      const op = this.proximo();
      const x = this.unaria();
      return { k: 'un', op: op.valor, x, linha: op.linha, coluna: op.coluna };
    }
    return this.posfixo(this.primaria());
  }

  posfixo(base) {
    let e = base;
    for (;;) {
      if (this.eh('.')) {
        const ponto = this.proximo();
        if (this.eh('*')) {
          this.i++;
          e = this.splat(e, ponto);
          continue;
        }
        if (this.atual.tipo === 'numero') {
          const n = this.proximo();
          e = this.indexar(e, { k: 'lit', valor: n.valor, linha: n.linha, coluna: n.coluna }, ponto);
          continue;
        }
        if (this.atual.tipo !== 'ident') {
          throw this.erro('Invalid attribute name', 'Depois do ponto deveria vir o nome de um atributo.');
        }
        const nome = this.proximo();
        e = this.atributo(e, nome.valor, nome);
        continue;
      }
      if (this.eh('[')) {
        const abre = this.proximo();
        if (this.eh('*')) {
          this.i++;
          this.esperar(']');
          e = this.splat(e, abre);
          continue;
        }
        this.agrupado = (this.agrupado ?? 0) + 1;
        this.pularNl();
        const indice = this.expressao();
        this.pularNl();
        this.agrupado -= 1;
        this.esperar(']', 'Missing close bracket on index', 'Faltou fechar o índice com "]".');
        e = this.indexar(e, indice, abre);
        continue;
      }
      return e;
    }
  }

  atributo(e, nome, tok) {
    if (e.k === 'ref') return { ...e, passos: [...e.passos, { attr: nome }] };
    return { k: 'acesso', alvo: e, passo: { attr: nome }, linha: tok.linha, coluna: tok.coluna };
  }

  indexar(e, indice, tok) {
    if (e.k === 'ref') return { ...e, passos: [...e.passos, { indice }] };
    return { k: 'acesso', alvo: e, passo: { indice }, linha: tok.linha, coluna: tok.coluna };
  }

  /** a[*].b.c : aplica os passos seguintes a cada item. */
  splat(alvo, tok) {
    const passos = [];
    for (;;) {
      if (this.eh('.') && this.espiar()?.tipo === 'ident') {
        this.i++;
        passos.push({ attr: this.proximo().valor });
      } else if (this.eh('[') && !(this.espiar()?.tipo === 'pont' && this.espiar().valor === '*')) {
        this.i++;
        const indice = this.expressao();
        this.esperar(']');
        passos.push({ indice });
      } else {
        break;
      }
    }
    return { k: 'splat', alvo, passos, linha: tok.linha, coluna: tok.coluna };
  }

  primaria() {
    const tok = this.atual;
    if (tok.tipo === 'numero') {
      this.i++;
      return { k: 'lit', valor: tok.valor, linha: tok.linha, coluna: tok.coluna };
    }
    if (tok.tipo === 'template') {
      this.i++;
      return this.template(tok);
    }
    if (tok.tipo === 'ident') {
      this.i++;
      if (tok.valor === 'true' || tok.valor === 'false') return { k: 'lit', valor: tok.valor === 'true', linha: tok.linha, coluna: tok.coluna };
      if (tok.valor === 'null') return { k: 'lit', valor: null, linha: tok.linha, coluna: tok.coluna };
      if (this.eh('(')) return this.chamada(tok);
      return { k: 'ref', raiz: tok.valor, passos: [], linha: tok.linha, coluna: tok.coluna };
    }
    if (this.eh('(')) {
      this.i++;
      this.agrupado = (this.agrupado ?? 0) + 1;
      this.pularNl();
      const e = this.expressao();
      this.pularNl();
      this.agrupado -= 1;
      this.esperar(')', 'Unbalanced parentheses', 'Faltou fechar o parêntese.');
      return { k: 'paren', x: e, linha: tok.linha, coluna: tok.coluna };
    }
    if (this.eh('[')) return this.tupla();
    if (this.eh('{')) return this.objeto();
    if (tok.tipo === 'nl' || tok.tipo === 'fim') {
      throw this.erro('Invalid expression', 'Faltou o valor depois do "=". Ex.: nome = "valor".');
    }
    throw this.erro('Invalid expression', `Não é possível começar uma expressão com "${tok.valor}".`);
  }

  template(tok) {
    const partes = tok.valor.map((parte) => {
      if (typeof parte === 'string') return parte;
      const sub = new Parser(parte.tokens, this.arquivo);
      sub.agrupado = 1;
      sub.pularNl();
      const expr = sub.expressao();
      sub.pularNl();
      if (sub.atual.tipo !== 'fim') {
        throw sub.erro('Extra characters after interpolation expression', 'Dentro de ${ ... } cabe uma expressão só.');
      }
      return expr;
    }).filter((p) => p !== '');
    // "${expr}" sozinho devolve o próprio valor (não vira texto), como no Terraform.
    if (partes.length === 1 && typeof partes[0] !== 'string' && !tok.heredoc) {
      return { k: 'tpl', partes, unico: true, linha: tok.linha, coluna: tok.coluna };
    }
    return { k: 'tpl', partes, linha: tok.linha, coluna: tok.coluna };
  }

  chamada(nomeTok) {
    this.i++; // (
    this.agrupado = (this.agrupado ?? 0) + 1;
    const args = [];
    let expandir = false;
    this.pularNl();
    while (!this.eh(')')) {
      args.push(this.expressao());
      this.pularNl();
      if (this.aceitar('...')) {
        expandir = true;
        this.pularNl();
      }
      if (!this.aceitar(',')) break;
      this.pularNl();
    }
    this.pularNl();
    this.agrupado -= 1;
    this.esperar(')', 'Missing close parenthesis', `Faltou fechar a chamada de ${nomeTok.valor}( com ")". Ou falta uma vírgula entre os argumentos.`);
    return { k: 'chamada', nome: nomeTok.valor, args, expandir, linha: nomeTok.linha, coluna: nomeTok.coluna };
  }

  tupla() {
    const abre = this.proximo();
    this.agrupado = (this.agrupado ?? 0) + 1;
    this.pularNl();
    if (this.atual.tipo === 'ident' && this.atual.valor === 'for' && !(this.espiar()?.tipo === 'pont' && ['=', ':'].includes(this.espiar().valor))) {
      const f = this.for(abre, ']');
      this.agrupado -= 1;
      return f;
    }
    const itens = [];
    while (!this.eh(']')) {
      itens.push(this.expressao());
      this.pularNl();
      if (!this.aceitar(',')) break;
      this.pularNl();
    }
    this.pularNl();
    this.agrupado -= 1;
    this.esperar(']', 'Missing item separator', 'Separe os itens da lista com vírgulas e feche com "]".');
    return { k: 'tupla', itens, linha: abre.linha, coluna: abre.coluna };
  }

  objeto() {
    const abre = this.proximo();
    const anterior = this.agrupado ?? 0;
    this.agrupado = 0; // dentro de { } a quebra de linha separa os itens
    this.pularNl();
    if (this.atual.tipo === 'ident' && this.atual.valor === 'for' && !(this.espiar()?.tipo === 'pont' && ['=', ':'].includes(this.espiar().valor))) {
      this.agrupado = 1;
      const f = this.for(abre, '}');
      this.agrupado = anterior;
      return f;
    }
    const pares = [];
    while (!this.eh('}')) {
      const chaveTok = this.atual;
      let chave;
      if (chaveTok.tipo === 'ident' && this.espiar()?.tipo === 'pont' && ['=', ':'].includes(this.espiar().valor)) {
        this.i++;
        chave = { k: 'lit', valor: chaveTok.valor, linha: chaveTok.linha, coluna: chaveTok.coluna, ident: true };
      } else {
        this.agrupado = 1;
        chave = this.expressao();
        this.agrupado = 0;
      }
      if (!this.aceitar('=') && !this.aceitar(':')) {
        throw this.erro('Missing key/value separator', 'Num objeto/mapa, cada item é chave = valor.');
      }
      this.agrupado = 1;
      this.pularNl();
      const valor = this.expressao();
      this.agrupado = 0;
      pares.push({ chave, valor });
      if (this.aceitar(',')) {
        this.pularNl();
        continue;
      }
      if (this.atual.tipo === 'nl') {
        this.pularNl();
        continue;
      }
      if (!this.eh('}')) {
        throw this.erro('Missing attribute separator', 'Separe os itens do objeto com vírgula ou quebra de linha.');
      }
    }
    this.esperar('}');
    this.agrupado = anterior;
    return { k: 'objeto', pares, linha: abre.linha, coluna: abre.coluna };
  }

  for(abre, fecha) {
    this.i++; // for
    const v1 = this.esperarTipo('ident').valor;
    let chaveVar = null;
    let valorVar = v1;
    if (this.aceitar(',')) {
      chaveVar = v1;
      valorVar = this.esperarTipo('ident').valor;
    }
    if (!(this.atual.tipo === 'ident' && this.atual.valor === 'in')) {
      throw this.erro('Invalid "for" expression', 'A sintaxe é: for item in coleção : resultado.');
    }
    this.i++;
    const colecao = this.expressao();
    this.esperar(':', 'Invalid "for" expression', 'Depois da coleção vem ":" e o resultado de cada item.');
    this.pularNl();
    let chaveExpr = null;
    let valorExpr = this.expressao();
    let agrupar = false;
    if (fecha === '}') {
      this.esperar('=>', 'Invalid "for" expression', 'Num for que monta um objeto, use chave => valor.');
      chaveExpr = valorExpr;
      this.pularNl();
      valorExpr = this.expressao();
      if (this.aceitar('...')) agrupar = true;
    }
    this.pularNl();
    let cond = null;
    if (this.atual.tipo === 'ident' && this.atual.valor === 'if') {
      this.i++;
      cond = this.expressao();
      this.pularNl();
    }
    this.esperar(fecha, 'Invalid "for" expression', `Faltou fechar o for com "${fecha}".`);
    return {
      k: 'for', objeto: fecha === '}', chaveVar, valorVar, colecao, chaveExpr, valorExpr, cond, agrupar,
      linha: abre.linha, coluna: abre.coluna,
    };
  }
}
