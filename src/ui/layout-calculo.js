// Cálculo do layout da tela do problema (funções puras, testadas em tests/layout.test.js).
//
// Por que não é sempre lado a lado: a saída do Terraform (plan) tem linhas longas,
// de uns 80 caracteres. Num terminal estreito elas quebram e o plano fica difícil de
// ler. O modo automático só põe código e terminal lado a lado quando o terminal
// passa de 560px; senão, empilha (código em cima, terminal embaixo).

const PADDING = 16; // padding horizontal da área
const GAP = 6; // espaço entre painéis
const DIVISOR = 6; // largura da alça de redimensionar
const LIMITE_CELULAR = 900;

export const LARGURA_TERMINAL = 560;

// Mínimo de 320px: com o terminal aberto, a descrição (roteiro, palavras técnicas, dicas) continua
// legível em telas de 900 a 1230px, onde 26% da largura daria menos que isso.
export const larguraDescricao = (largura) => Math.round(Math.min(420, Math.max(320, largura * 0.26)));

/** Largura aproximada do preview em cada modo, para a divisão padrão (50%). */
export function larguraPreview(modo, { largura, descricao }) {
  const desc = descricao ? larguraDescricao(largura) + GAP : 0;
  const util = largura - PADDING - desc;
  return modo === 'lado' ? Math.floor((util - DIVISOR - 2 * GAP) / 2) : util;
}

export function escolherModo({ largura, descricao }) {
  if (largura < LIMITE_CELULAR) return 'celular';
  return larguraPreview('lado', { largura, descricao }) > LARGURA_TERMINAL ? 'lado' : 'empilhado';
}

const linhasDeAreas = (linhas) => linhas.map((l) => `"${l.join(' ')}"`).join(' ');

/**
 * Monta grid-template-columns/rows/areas para o modo escolhido. Os testes
 * funcionais são uma aba do painel de descrição, então não têm área própria.
 */
export function montarGrade({ modo, largura, descricao, divisao = 50 }) {
  const a = Math.round(divisao);
  const b = 100 - a;
  const desc = descricao ? `${larguraDescricao(largura)}px ` : '';

  if (modo === 'celular') {
    const areas = [descricao && ['desc'], ['codigo'], ['preview']].filter(Boolean);
    return { colunas: 'minmax(0, 1fr)', linhas: areas.map(() => 'auto').join(' '), areas: linhasDeAreas(areas) };
  }

  if (modo === 'lado') {
    return {
      colunas: `${desc}minmax(0, ${a}fr) ${DIVISOR}px minmax(0, ${b}fr)`,
      linhas: 'minmax(0, 1fr)',
      areas: linhasDeAreas([[...(descricao ? ['desc'] : []), 'codigo', 'divisor', 'preview']]),
    };
  }

  // empilhado
  const linhas = `minmax(0, ${a}fr) ${DIVISOR}px minmax(0, ${b}fr)`;
  if (descricao) {
    return {
      colunas: `${desc}minmax(0, 1fr)`,
      linhas,
      areas: linhasDeAreas([['desc', 'codigo'], ['desc', 'divisor'], ['desc', 'preview']]),
    };
  }
  return { colunas: 'minmax(0, 1fr)', linhas, areas: linhasDeAreas([['codigo'], ['divisor'], ['preview']]) };
}
