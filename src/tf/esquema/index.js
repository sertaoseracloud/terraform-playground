// Registro dos provedores do simulador e das versões "publicadas" de cada um.
import {
  PROVEDOR_RANDOM, PROVEDOR_LOCAL, PROVEDOR_NULL, PROVEDOR_TERRAFORM, PROVEDOR_TLS, PROVEDOR_ARCHIVE,
} from './basico.js';
import { PROVEDOR_AWS } from './aws.js';
import { PROVEDOR_AZURE, normalizarLocal } from './azure.js';

export const VERSAO_TERRAFORM = '1.13.3';

export const PROVEDORES = Object.fromEntries([
  PROVEDOR_AWS, PROVEDOR_AZURE, PROVEDOR_RANDOM, PROVEDOR_LOCAL, PROVEDOR_NULL, PROVEDOR_TERRAFORM, PROVEDOR_TLS, PROVEDOR_ARCHIVE,
].map((p) => [p.nome, p]));

/** Nome local do provedor de um tipo de recurso: "aws_s3_bucket" → "aws". */
export function provedorDoTipo(tipo) {
  if (tipo === 'terraform_data') return 'terraform';
  return tipo.split('_')[0];
}

export function buscarTipo(tipo, modo = 'managed') {
  const provedor = PROVEDORES[provedorDoTipo(tipo)];
  if (!provedor) return { provedor: null, def: null };
  return { provedor, def: (modo === 'data' ? provedor.dados : provedor.recursos)[tipo] ?? null };
}

/** Sugere o nome mais parecido (para erros de digitação). */
export function sugerir(nome, opcoes) {
  let melhor = null;
  let menor = Infinity;
  for (const o of opcoes) {
    const d = distancia(nome, o);
    if (d < menor) {
      menor = d;
      melhor = o;
    }
  }
  return menor <= Math.max(2, Math.floor(nome.length / 4)) ? melhor : null;
}

function distancia(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

// ---------- restrições de versão ("~> 6.0", ">= 4.0, < 6.0") ----------

const partes = (v) => String(v).split('.').map((n) => Number(n) || 0);
function comparar(a, b) {
  const pa = partes(a);
  const pb = partes(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

export function atende(versao, restricao) {
  if (!restricao) return true;
  return String(restricao).split(',').map((r) => r.trim()).filter(Boolean).every((r) => {
    const m = /^(~>|>=|<=|!=|>|<|=)?\s*v?(\d+(?:\.\d+){0,2})$/.exec(r);
    if (!m) return false;
    const [, op = '=', alvo] = m;
    const c = comparar(versao, alvo);
    switch (op) {
      case '=': return c === 0;
      case '!=': return c !== 0;
      case '>': return c > 0;
      case '>=': return c >= 0;
      case '<': return c < 0;
      case '<=': return c <= 0;
      case '~>': {
        // ~> 6.0 → >= 6.0 e < 7.0 ; ~> 6.1.2 → >= 6.1.2 e < 6.2.0
        if (c < 0) return false;
        const p = alvo.split('.');
        const limite = p.length === 1 ? [Number(p[0]) + 1] : [...p.slice(0, -2).map(Number), Number(p.at(-2)) + 1];
        return comparar(versao, limite.join('.')) < 0;
      }
      default: return false;
    }
  });
}

export function restricaoValida(restricao) {
  return String(restricao).split(',').map((r) => r.trim()).every((r) => /^(~>|>=|<=|!=|>|<|=)?\s*v?\d+(?:\.\d+){0,2}$/.test(r));
}

/** A maior versão publicada que atende à restrição. */
export function escolherVersao(provedor, restricao) {
  return [...provedor.versoes].sort(comparar).reverse().find((v) => atende(v, restricao)) ?? null;
}

export { normalizarLocal };
