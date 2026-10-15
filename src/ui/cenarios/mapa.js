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

const variante = (pesos, x) => {
  const total = pesos.reduce((s, p) => s + p, 0);
  let acc = 0;
  return pesos.findIndex((p) => (acc += p / total) > x);
};

export const tileEm = (mapa, c, l) => (c < 0 || l < 0 || c >= mapa.colunas || l >= mapa.linhas ? null : mapa.tiles[l * mapa.colunas + c]);

export function gerarMapa({ colunas, linhas, cenario, semente }) {
  const sortear = sorteador(semente);
  const estrada = colunasDaEstrada(colunas);
  const [primeira, ultima] = [Math.min(...estrada), Math.max(...estrada)];
  // Manchas e objetos ficam a pelo menos 2 colunas da estrada: sobra um corredor para andar.
  const longeDaEstrada = (c) => c <= primeira - 2 || c >= ultima + 2;
  const tiles = Array.from({ length: colunas * linhas }, (_, i) => (estrada.includes(i % colunas)
    ? { tipo: 'estrada', variante: 0 }
    : { tipo: 'chao', variante: variante(cenario.chao.pesos, sortear()) }));
  const livre = (c, l) => longeDaEstrada(c) && tileEm({ colunas, linhas, tiles }, c, l)?.tipo === 'chao';

  // O centro de cada mancha é sorteado só entre as colunas permitidas: assim o rio sempre tem água.
  const permitidas = Array.from({ length: colunas }, (_, c) => c).filter(longeDaEstrada);
  if (cenario.bloqueio && permitidas.length) {
    const manchas = 2 + Math.floor(sortear() * 2);
    for (let k = 0; k < manchas; k++) {
      const c0 = permitidas[Math.floor(sortear() * permitidas.length)];
      const l0 = Math.floor(sortear() * linhas);
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
  return { colunas, linhas, tiles };
}
