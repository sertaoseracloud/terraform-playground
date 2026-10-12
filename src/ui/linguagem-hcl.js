// Destaque de sintaxe do HCL (Terraform) para o CodeMirror, como linguagem "stream":
// comentários, strings com ${...}, números, palavras-chave dos blocos, funções e referências.
import { StreamLanguage } from '@codemirror/language';

const BLOCOS = new Set([
  'terraform', 'provider', 'resource', 'data', 'variable', 'output', 'locals', 'module', 'moved', 'import', 'removed', 'check',
  'lifecycle', 'dynamic', 'content', 'provisioner', 'connection', 'backend', 'required_providers', 'validation', 'precondition', 'postcondition',
]);
const PALAVRAS = new Set(['for', 'in', 'if', 'endif', 'else', 'endfor']);
const ATOMOS = new Set(['true', 'false', 'null']);
const RAIZES = new Set(['var', 'local', 'data', 'module', 'count', 'each', 'path', 'terraform', 'self']);
const TIPOS = new Set(['string', 'number', 'bool', 'list', 'map', 'set', 'object', 'tuple', 'any', 'optional']);

function tokenString(stream, state) {
  while (!stream.eol()) {
    if (stream.match('${', false)) {
      if (stream.current().length) return 'string';
      stream.match('${');
      state.pilha.push('interp');
      state.dentroString = false;
      return 'meta';
    }
    const c = stream.next();
    if (c === '\\') {
      stream.next();
      continue;
    }
    if (c === '"') {
      state.dentroString = false;
      return 'string';
    }
  }
  return 'string';
}

const hcl = {
  name: 'hcl',
  startState: () => ({ dentroString: false, comentario: false, heredoc: null, pilha: [], inicioDeLinha: true }),
  token(stream, state) {
    if (stream.sol()) state.inicioDeLinha = true;
    if (state.heredoc) {
      if (stream.sol() && new RegExp(`^\\s*${state.heredoc}\\s*$`).test(stream.string)) {
        stream.skipToEnd();
        state.heredoc = null;
        return 'meta';
      }
      stream.skipToEnd();
      return 'string';
    }
    if (state.comentario) {
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.comentario = false;
      } else {
        stream.skipToEnd();
      }
      return 'comment';
    }
    if (state.dentroString) return tokenString(stream, state);
    if (stream.eatSpace()) return null;

    if (stream.match('#') || stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match('/*')) {
      state.comentario = true;
      return 'comment';
    }
    const m = stream.match(/^<<-?([A-Za-z_]+)/);
    if (m) {
      state.heredoc = m[1];
      return 'meta';
    }
    if (stream.peek() === '}' && state.pilha.at(-1) === 'interp') {
      stream.next();
      state.pilha.pop();
      state.dentroString = true;
      return 'meta';
    }
    if (stream.peek() === '{') state.pilha.push('chave');
    if (stream.peek() === '}') state.pilha.pop();
    if (stream.peek() === '"') {
      stream.next();
      state.dentroString = true;
      return tokenString(stream, state);
    }
    if (stream.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/)) {
      state.inicioDeLinha = false;
      return 'number';
    }
    const palavra = stream.match(/^[A-Za-z_][\w-]*/);
    if (palavra) {
      const p = palavra[0];
      const primeira = state.inicioDeLinha;
      state.inicioDeLinha = false;
      if (ATOMOS.has(p)) return 'atom';
      if (PALAVRAS.has(p)) return 'keyword';
      if (primeira && BLOCOS.has(p)) return 'keyword';
      if (stream.match(/^\s*\(/, false)) return TIPOS.has(p) ? 'typeName' : 'variableName.function';
      if (primeira && stream.match(/^\s*=(?!=)/, false)) return 'propertyName';
      if (stream.match(/^\s*[=:](?![=>])/, false)) return 'propertyName';
      if (primeira && stream.match(/^\s*("|\{)/, false)) return 'keyword';
      if (RAIZES.has(p) && stream.peek() === '.') return 'variableName.special';
      if (TIPOS.has(p)) return 'typeName';
      return 'variableName';
    }
    state.inicioDeLinha = false;
    stream.next();
    return /[=<>!&|+\-*/%?:]/.test(stream.current()) ? 'operator' : null;
  },
  languageData: { commentTokens: { line: '#', block: { open: '/*', close: '*/' } } },
};

export const linguagemHcl = () => StreamLanguage.define(hcl);
