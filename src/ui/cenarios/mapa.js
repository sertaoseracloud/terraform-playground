// Mapa de tiles de um cenário (funções puras): a estrada embaixo do caminho dos exercícios,
// o chão com variações, manchas onde não se anda (água, lava…) e objetos. A mesma semente
// gera sempre o mesmo mapa.
export const TILE = 32;

/** Números "aleatórios" repetíveis a partir de um texto (mulberry32 sobre um hash). */
export function sorteador(semente) {
  let h = 1779033703 ^ String(semente).length;
  for (const ch of String(semente)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Colunas que ficam embaixo do ziguezague dos nós (até `raio` px do centro): a estrada. */
export function colunasDaEstrada(colunas, raio = 112) {
  const centro = (colunas * TILE) / 2;
  const lista = [];
  for (let c = 0; c < colunas; c++) {
    if ((c + 1) * TILE > centro - raio && c * TILE < centro + raio) lista.push(c);
  }
  return lista;
}

/** Até quantos tiles da curva é estrada (a faixa tem uns 5 tiles: cobre o nó e a legenda). */
export const RAIO_ESTRADA = 2;

/** Catmull-Rom em uma dimensão: o valor entre p1 e p2, com p0 e p3 dando a curvatura. */
const catmull = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

/**
 * A faixa de estrada de cada linha: [de, ate] (colunas, inclusivo). Com o `caminho` (os centros
 * dos nós, em tiles), a curva passa por eles; antes do primeiro e depois do último, segue reta.
 * Sem caminho, é a faixa reta do centro (colunasDaEstrada).
 */
export function estradaPorLinha(colunas, linhas, caminho = []) {
  const reta = colunasDaEstrada(colunas);
  if (!caminho.length) return Array.from({ length: linhas }, () => [Math.min(...reta), Math.max(...reta)]);
  // Um ponto por linha (a média, se dois nós estão na mesma altura), em ordem de cima para baixo.
  const porLinha = new Map();
  for (const { c, l } of caminho) {
    const chave = Math.round(l * 2) / 2;
    porLinha.set(chave, [...(porLinha.get(chave) ?? []), c]);
  }
  const pontos = [...porLinha].sort((a, b) => a[0] - b[0]).map(([l, cs]) => ({ l, c: cs.reduce((s, x) => s + x, 0) / cs.length }));
  const x = (y) => {
    if (y <= pontos[0].l) return pontos[0].c;
    if (y >= pontos.at(-1).l) return pontos.at(-1).c;
    const i = pontos.findIndex((p, k) => y >= p.l && y <= pontos[k + 1].l);
    const p = (k) => pontos[Math.max(0, Math.min(pontos.length - 1, k))].c;
    const t = (y - pontos[i].l) / (pontos[i + 1].l - pontos[i].l);
    return catmull(p(i - 1), p(i), p(i + 1), p(i + 2), t);
  };
  // Sobra pelo menos 1 tile de chão de cada lado.
  const minimo = RAIO_ESTRADA + 1;
  const maximo = Math.max(minimo, colunas - RAIO_ESTRADA - 1);
  return Array.from({ length: linhas }, (_, l) => {
    const centro = Math.min(maximo, Math.max(minimo, x(l + 0.5)));
    return [Math.floor(centro - RAIO_ESTRADA), Math.ceil(centro + RAIO_ESTRADA) - 1];
  });
}

const variante = (pesos, x) => {
  const total = pesos.reduce((s, p) => s + p, 0);
  let acc = 0;
  return pesos.findIndex((p) => (acc += p / total) > x);
};

export const tileEm = (mapa, c, l) => (c < 0 || l < 0 || c >= mapa.colunas || l >= mapa.linhas ? null : mapa.tiles[l * mapa.colunas + c]);

export function gerarMapa({ colunas, linhas, cenario, semente, caminho = [] }) {
  const sortear = sorteador(semente);
  const estrada = estradaPorLinha(colunas, linhas, caminho);
  const naEstrada = (c, l) => c >= estrada[l][0] && c <= estrada[l][1];
  // Manchas e objetos ficam a pelo menos 2 colunas da estrada da linha: sobra um corredor para andar.
  const longeDaEstrada = (c, l) => c <= estrada[l][0] - 2 || c >= estrada[l][1] + 2;
  const tiles = Array.from({ length: colunas * linhas }, (_, i) => (naEstrada(i % colunas, Math.floor(i / colunas))
    ? { tipo: 'estrada', variante: 0 }
    : { tipo: 'chao', variante: variante(cenario.chao.pesos, sortear()) }));
  const livre = (c, l) => l >= 0 && l < linhas && longeDaEstrada(c, l) && tileEm({ colunas, linhas, tiles }, c, l)?.tipo === 'chao';

  if (cenario.bloqueio) {
    const manchas = 2 + Math.floor(sortear() * 2);
    for (let k = 0; k < manchas; k++) {
      // O centro de cada mancha é sorteado entre as colunas permitidas da sua linha: o rio sempre tem água.
      const l0 = Math.floor(sortear() * linhas);
      const permitidas = Array.from({ length: colunas }, (_, c) => c).filter((c) => longeDaEstrada(c, l0));
      if (!permitidas.length) continue;
      const c0 = permitidas[Math.floor(sortear() * permitidas.length)];
      const rc = 1 + Math.floor(sortear() * 2);
      const rl = 1 + Math.floor(sortear() * 2);
      for (let l = l0 - rl; l <= l0 + rl; l++) {
        for (let c = c0 - rc; c <= c0 + rc; c++) {
          const dentro = ((c - c0) / (rc + 0.5)) ** 2 + ((l - l0) / (rl + 0.5)) ** 2 <= 1;
          if (dentro && livre(c, l)) tiles[l * colunas + c] = { tipo: 'bloqueio', variante: 0 };
        }
      }
    }
  }
  for (let i = 0; i < tiles.length; i++) {
    const [c, l] = [i % colunas, Math.floor(i / colunas)];
    if (livre(c, l) && sortear() < 0.06) tiles[i] = { tipo: 'objeto', variante: Math.floor(sortear() * cenario.objetos.length) };
  }
  return { colunas, linhas, tiles, estrada };
}
