// Atlas (spritesheet) de um cenário: cada tile e cada quadro de personagem é desenhado uma única
// vez numa folha pequena, e o palco só copia pedaços dela (em vez de pintar pixel a pixel). A
// textura do chão vem em VARIACOES versões, escolhidas por um hash da posição: o mesmo tile tem
// sempre o mesmo desenho, sem guardar nada.
import { TILE, sorteador, tileEm } from './mapa.js';
import { desenharSprite, misturar } from './pixel.js';

export const VARIACOES = 4;
export const COLUNAS_DO_ATLAS = 8;
/** Vizinhos que formam a borda de um bloqueio (água, lava…): bit 1 em cima, 2 embaixo, 4 à esquerda, 8 à direita. */
const LADOS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

const hash = (c, l) => (Math.imul(c + 1, 73856093) ^ Math.imul(l + 1, 19349663)) >>> 0;

/**
 * Os quadros do atlas, em ordem (a posição na folha sai do índice): { nome, tipo, i } com o
 * índice da variante, do objeto ou do quadro do personagem (e o personagem, em `p`).
 */
export function quadrosDoAtlas(cen) {
  const lista = [];
  for (let v = 0; v < cen.chao.cores.length; v++) for (let k = 0; k < VARIACOES; k++) lista.push({ nome: `chao-${v}-${k}`, tipo: 'chao', i: v });
  for (let k = 0; k < VARIACOES; k++) lista.push({ nome: `estrada-${k}`, tipo: 'estrada' });
  if (cen.bloqueio) for (let m = 0; m < 16; m++) for (let k = 0; k < 2; k++) lista.push({ nome: `bloqueio-${m}-${k}`, tipo: 'bloqueio', i: m });
  cen.objetos.forEach((_, i) => lista.push({ nome: `objeto-${i}`, tipo: 'objeto', i }));
  lista.push({ nome: 'casa', tipo: 'casa' });
  for (const p of cen.personagens) p.quadros.forEach((_, i) => lista.push({ nome: `per-${p.id}-${i}`, tipo: 'per', i, p }));
  return lista;
}

/** Onde fica o quadro `i` na folha, em pixels. */
export const posicaoNoAtlas = (i) => ({ x: (i % COLUNAS_DO_ATLAS) * TILE, y: Math.floor(i / COLUNAS_DO_ATLAS) * TILE });

/** As camadas do tile (c, l), de baixo para cima: o chão e, se houver, o objeto ou a casa. */
export function camadasDoTile(mapa, c, l) {
  const t = tileEm(mapa, c, l);
  const k = hash(c, l) % VARIACOES;
  if (t.tipo === 'estrada') return [`estrada-${k}`];
  if (t.tipo === 'bloqueio') {
    const mascara = LADOS.reduce((m, [dc, dl], i) => (tileEm(mapa, c + dc, l + dl)?.tipo === 'bloqueio' ? m : m | (1 << i)), 0);
    return [`bloqueio-${mascara}-${k % 2}`];
  }
  const chao = `chao-${t.tipo === 'chao' ? t.variante : 0}-${k}`;
  if (t.tipo === 'objeto') return [chao, `objeto-${t.variante}`];
  if (t.tipo === 'casa') return [chao, 'casa'];
  return [chao];
}

function textura(ctx, x, y, [base, escuro, claro], padrao, sortear) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, TILE, TILE);
  if (padrao === 'tabuas') {
    ctx.fillStyle = escuro;
    for (let i = 0; i < TILE; i += 8) ctx.fillRect(x, y + i, TILE, 2);
    ctx.fillRect(x + (sortear() < 0.5 ? 10 : 22), y, 2, TILE);
    return;
  }
  if (padrao === 'pedras') {
    ctx.fillStyle = escuro;
    ctx.fillRect(x, y, TILE, 2); ctx.fillRect(x, y + 16, TILE, 2);
    ctx.fillRect(x + 14, y, 2, 16); ctx.fillRect(x + 6, y + 16, 2, 16); ctx.fillRect(x + 24, y + 16, 2, 16);
    ctx.fillStyle = claro;
    ctx.fillRect(x + 2, y + 2, 4, 2); ctx.fillRect(x + 18, y + 18, 4, 2);
    return;
  }
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? escuro : claro;
    ctx.fillRect(x + Math.floor(sortear() * 15) * 2, y + Math.floor(sortear() * 15) * 2, 2, 2);
  }
}

function bloqueio(ctx, x, y, b, mascara, sortear) {
  ctx.fillStyle = b.cor;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = b.brilho;
  for (let k = 0; k < 2; k++) ctx.fillRect(x + 4 + Math.floor(sortear() * 10) * 2, y + 6 + Math.floor(sortear() * 10) * 2, 6, 2);
  const bordas = [[x, y, TILE, 3], [x, y + TILE - 3, TILE, 3], [x, y, 3, TILE], [x + TILE - 3, y, 3, TILE]];
  ctx.fillStyle = b.borda;
  bordas.forEach(([bx, by, w, h], i) => { if (mascara & (1 << i)) ctx.fillRect(bx, by, w, h); });
}

/**
 * Desenha a folha do cenário no canvas (que já tem o tamanho certo: tamanhoDoAtlas). Com
 * `contorno` (alto contraste), só o contorno do que bloqueia e as silhuetas, nessa cor.
 */
export function desenharAtlas(ctx, cen, { contorno = null, semente = cen.id } = {}) {
  ctx.imageSmoothingEnabled = false;
  const sortear = sorteador(`${semente}-atlas`);
  quadrosDoAtlas(cen).forEach(({ tipo, i, p }, n) => {
    const { x, y } = posicaoNoAtlas(n);
    if (tipo === 'per') {
      desenharSprite(ctx, p.quadros[i], x, y, { cor: contorno ?? undefined });
      return;
    }
    if (contorno) {
      ctx.strokeStyle = contorno;
      if (tipo === 'bloqueio') ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (tipo === 'objeto') desenharSprite(ctx, cen.objetos[i], x, y, { cor: contorno });
      if (tipo === 'casa') desenharSprite(ctx, cen.casa, x, y, { cor: contorno });
      return;
    }
    if (tipo === 'chao') {
      const cores = cen.chao.cores;
      textura(ctx, x, y, [misturar(cores[0], cores[i], 0.35), cores[1], cores[2]], 'terra', sortear);
    } else if (tipo === 'estrada') textura(ctx, x, y, cen.estrada.cores, cen.estrada.padrao, sortear);
    else if (tipo === 'bloqueio') bloqueio(ctx, x, y, cen.bloqueio, i, sortear);
    else if (tipo === 'objeto') desenharSprite(ctx, cen.objetos[i], x, y);
    else desenharSprite(ctx, cen.casa, x, y);
  });
}

/** Largura e altura da folha, em pixels. */
export function tamanhoDoAtlas(cen) {
  const n = quadrosDoAtlas(cen).length;
  return { largura: COLUNAS_DO_ATLAS * TILE, altura: Math.ceil(n / COLUNAS_DO_ATLAS) * TILE };
}
