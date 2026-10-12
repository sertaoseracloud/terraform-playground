// Analisador léxico do HCL (a linguagem do Terraform), escrito do zero para rodar
// no navegador. Cobre a sintaxe nativa usada em aula: blocos, atributos, strings
// com interpolação ${...}, heredocs (<<EOT e <<-EOT), números, comentários (#, //, /* */)
// e os operadores das expressões. Diretivas %{ if } de template não são suportadas.

export class ErroHCL extends Error {
  constructor(resumo, detalhe, { linha, coluna, arquivo } = {}) {
    super(resumo);
    this.resumo = resumo;
    this.detalhe = detalhe;
    this.linha = linha;
    this.coluna = coluna;
    this.arquivo = arquivo;
  }
}

const PONTUACAO = ['...', '=>', '==', '!=', '<=', '>=', '&&', '||', '{', '}', '[', ']', '(', ')', '=', ',', '.', ':', '?', '<', '>', '+', '-', '*', '/', '%', '!'];

const ehLetra = (c) => /[A-Za-z_]/.test(c);
const ehIdent = (c) => /[A-Za-z0-9_-]/.test(c);
const ehDigito = (c) => c >= '0' && c <= '9';

/**
 * Transforma o texto em tokens. Cada token: { tipo, valor, linha, coluna }.
 * Tipos: ident, numero, template (partes: string ou { tokens }), pont, nl, fim.
 */
export function lexar(fonte, arquivo = 'main.tf') {
  let i = 0;
  let linha = 1;
  let coluna = 1;
  const tokens = [];

  const erro = (resumo, detalhe) => new ErroHCL(resumo, detalhe, { linha, coluna, arquivo });
  const avancar = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (fonte[i] === '\n') {
        linha += 1;
        coluna = 1;
      } else {
        coluna += 1;
      }
      i += 1;
    }
  };
  const token = (tipo, valor, l, c, extra = {}) => tokens.push({ tipo, valor, linha: l, coluna: c, ...extra });

  /** Lê um template até `fim` (aspas ou fim do heredoc). Devolve as partes. */
  function lerTemplate(terminaEm) {
    const partes = [];
    let texto = '';
    while (i < fonte.length) {
      if (terminaEm(i)) return [...partes, texto];
      const c = fonte[i];
      if (c === '\n' && terminaEm === aspas) {
        throw erro('Unterminated template string', 'Uma string entre aspas não pode quebrar a linha. Feche as aspas ou use um heredoc (<<EOT).');
      }
      if (c === '\\' && terminaEm === aspas) {
        const proximo = fonte[i + 1];
        const escapes = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' };
        if (proximo in escapes) {
          texto += escapes[proximo];
          avancar(2);
          continue;
        }
        if (proximo === 'u') {
          texto += String.fromCodePoint(parseInt(fonte.slice(i + 2, i + 6), 16));
          avancar(6);
          continue;
        }
        throw erro('Invalid escape sequence', `A sequência "\\${proximo}" não existe em strings do HCL.`);
      }
      if (c === '$' && fonte[i + 1] === '$' && fonte[i + 2] === '{') {
        texto += '${';
        avancar(3);
        continue;
      }
      if (c === '%' && fonte[i + 1] === '%' && fonte[i + 2] === '{') {
        texto += '%{';
        avancar(3);
        continue;
      }
      if (c === '%' && fonte[i + 1] === '{') {
        throw erro('Template directives are not supported', 'As diretivas %{ if } e %{ for } não estão disponíveis no simulador. Use uma expressão condicional (a ? b : c) ou um for dentro de ${...}.');
      }
      if (c === '$' && fonte[i + 1] === '{') {
        const l = linha;
        const col = coluna;
        avancar(2);
        const interno = lerInterpolacao();
        partes.push(texto);
        texto = '';
        partes.push({ tokens: interno, linha: l, coluna: col });
        continue;
      }
      texto += c;
      avancar();
    }
    throw erro('Unterminated template string', 'Faltou fechar as aspas (") desta string.');
  }

  const aspas = (pos) => fonte[pos] === '"';

  /** Lê os tokens de dentro de ${ ... } até a chave que fecha. */
  function lerInterpolacao() {
    const internos = [];
    let profundidade = 0;
    const salvo = tokens.length;
    while (i < fonte.length) {
      pularEspacos(true);
      if (fonte[i] === '}' && profundidade === 0) {
        avancar();
        const meus = tokens.splice(salvo);
        internos.push(...meus, { tipo: 'fim', valor: null, linha, coluna });
        return internos;
      }
      if (fonte[i] === '{') profundidade += 1;
      if (fonte[i] === '}') profundidade -= 1;
      lerToken();
    }
    throw erro('Unterminated template string', 'Faltou fechar a interpolação ${ ... } com }.');
  }

  function pularEspacos(incluindoQuebras = false) {
    while (i < fonte.length) {
      const c = fonte[i];
      if (c === ' ' || c === '\t' || c === '\r' || (incluindoQuebras && c === '\n')) {
        avancar();
      } else if (c === '#' || (c === '/' && fonte[i + 1] === '/')) {
        while (i < fonte.length && fonte[i] !== '\n') avancar();
      } else if (c === '/' && fonte[i + 1] === '*') {
        const l = linha;
        const col = coluna;
        avancar(2);
        while (i < fonte.length && !(fonte[i] === '*' && fonte[i + 1] === '/')) avancar();
        if (i >= fonte.length) throw new ErroHCL('Unterminated comment', 'O comentário /* não foi fechado com */.', { linha: l, coluna: col, arquivo });
        avancar(2);
      } else {
        break;
      }
    }
  }

  function lerHeredoc(l, col) {
    const recuar = fonte[i] === '-';
    if (recuar) avancar();
    let marcador = '';
    while (i < fonte.length && ehIdent(fonte[i])) {
      marcador += fonte[i];
      avancar();
    }
    if (!marcador || fonte[i] !== '\n') {
      throw erro('Invalid heredoc', 'Depois de <<, escreva um marcador (ex.: EOT) e quebre a linha.');
    }
    avancar();
    // O heredoc termina numa linha que contém só o marcador (com espaços antes, se for <<-).
    const terminaEm = (pos) => {
      if (pos > 0 && fonte[pos - 1] !== '\n') return false;
      let k = pos;
      while (fonte[k] === ' ' || fonte[k] === '\t') k++;
      return fonte.startsWith(marcador, k) && /^(\r?\n|$)/.test(fonte.slice(k + marcador.length, k + marcador.length + 2));
    };
    const partes = lerTemplate(terminaEm);
    while (fonte[i] === ' ' || fonte[i] === '\t') avancar();
    avancar(marcador.length);
    // A última quebra de linha antes do marcador faz parte do texto, como no Terraform.
    let resultado = partes;
    if (recuar) resultado = tirarRecuo(partes);
    token('template', resultado, l, col, { heredoc: true });
  }

  function lerToken() {
    const c = fonte[i];
    const l = linha;
    const col = coluna;
    if (c === '\n') {
      avancar();
      token('nl', '\n', l, col);
      return;
    }
    if (c === '"') {
      avancar();
      const partes = lerTemplate(aspas);
      avancar();
      token('template', partes, l, col);
      return;
    }
    if (c === '<' && fonte[i + 1] === '<' && (fonte[i + 2] === '-' || ehLetra(fonte[i + 2] ?? ''))) {
      avancar(2);
      lerHeredoc(l, col);
      return;
    }
    if (ehDigito(c)) {
      let num = '';
      while (i < fonte.length && ehDigito(fonte[i])) { num += fonte[i]; avancar(); }
      if (fonte[i] === '.' && ehDigito(fonte[i + 1] ?? '')) {
        num += '.';
        avancar();
        while (i < fonte.length && ehDigito(fonte[i])) { num += fonte[i]; avancar(); }
      }
      if ((fonte[i] === 'e' || fonte[i] === 'E') && /[+\-\d]/.test(fonte[i + 1] ?? '')) {
        num += fonte[i];
        avancar();
        if (fonte[i] === '+' || fonte[i] === '-') { num += fonte[i]; avancar(); }
        while (i < fonte.length && ehDigito(fonte[i])) { num += fonte[i]; avancar(); }
      }
      token('numero', Number(num), l, col);
      return;
    }
    if (ehLetra(c)) {
      let nome = '';
      while (i < fonte.length && ehIdent(fonte[i])) { nome += fonte[i]; avancar(); }
      token('ident', nome, l, col);
      return;
    }
    for (const p of PONTUACAO) {
      if (fonte.startsWith(p, i)) {
        avancar(p.length);
        token('pont', p, l, col);
        return;
      }
    }
    if (c === '“' || c === '”') {
      throw erro('Invalid character', 'Estas são aspas "curvas" (de editor de texto). Use aspas retas (").');
    }
    throw erro('Invalid character', `O caractere "${c}" não é válido aqui.`);
  }

  while (i < fonte.length) {
    pularEspacos();
    if (i >= fonte.length) break;
    lerToken();
  }
  token('nl', '\n', linha, coluna);
  token('fim', null, linha, coluna);
  return tokens;
}

/** <<-EOT: tira o recuo comum de todas as linhas. */
function tirarRecuo(partes) {
  const texto = partes.map((p) => (typeof p === 'string' ? p : '\u0000')).join('');
  const linhas = texto.split('\n').filter((l) => l.trim() !== '');
  const recuo = Math.min(...linhas.map((l) => l.match(/^[ \t]*/)[0].length));
  if (!Number.isFinite(recuo) || recuo === 0) return partes;
  let inicioDeLinha = true;
  return partes.map((p) => {
    if (typeof p !== 'string') {
      inicioDeLinha = false;
      return p;
    }
    let saida = '';
    for (let k = 0; k < p.length; k++) {
      if (inicioDeLinha) {
        let tirados = 0;
        while (tirados < recuo && (p[k] === ' ' || p[k] === '\t')) {
          k++;
          tirados++;
        }
        inicioDeLinha = false;
        if (k >= p.length) break;
      }
      saida += p[k];
      if (p[k] === '\n') inicioDeLinha = true;
    }
    return saida;
  });
}
