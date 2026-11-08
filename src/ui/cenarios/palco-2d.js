// O desenho em canvas 2D dos cenários: o caminho de reserva, quando o navegador não tem WebGL (e o
// que roda nos testes, no happy-dom). O mapa de cada módulo vira um <canvas> do tamanho do módulo,
// e cada personagem é um <span> com o seu canvas, que desliza de tile em tile com a transição do CSS.
import { TILE, sorteador, tileEm } from './mapa.js';
import { desenharSprite, misturar } from './pixel.js';

const ALTURA_VOO = 8;

const altoContraste = () => document.documentElement.dataset.tema === 'alto-contraste';
const corSuave = () => getComputedStyle(document.documentElement).getPropertyValue('--suave').trim() || '#bbbbbb';

/** Textura de um tile (chão ou estrada): a cor base e pontinhos mais claros e mais escuros. */
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

/** Água, lava ou gelo partido: cor, reflexos e a borda nos lados que tocam a terra (como em RPG clássico). */
function bloqueio(ctx, mapa, c, l, x, y, b, sortear) {
  ctx.fillStyle = b.cor;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = b.brilho;
  for (let k = 0; k < 2; k++) ctx.fillRect(x + 4 + Math.floor(sortear() * 10) * 2, y + 6 + Math.floor(sortear() * 10) * 2, 6, 2);
  const lados = [[0, -1, x, y, TILE, 3], [0, 1, x, y + TILE - 3, TILE, 3], [-1, 0, x, y, 3, TILE], [1, 0, x + TILE - 3, y, 3, TILE]];
  for (const [dc, dl, bx, by, w, h] of lados) {
    if (tileEm(mapa, c + dc, l + dl)?.tipo === 'bloqueio') continue;
    ctx.fillStyle = b.borda;
    ctx.fillRect(bx, by, w, h);
  }
}

export function desenharMapa(canvas, mapa, cen, semente) {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return; // sem canvas (testes no happy-dom): só a lógica
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sortear = sorteador(`${semente}-desenho`);
  const contorno = altoContraste() ? corSuave() : null;
  for (let l = 0; l < mapa.linhas; l++) {
    for (let c = 0; c < mapa.colunas; c++) {
      const t = tileEm(mapa, c, l);
      const [x, y] = [c * TILE, l * TILE];
      if (contorno) {
        // Alto contraste: só o contorno do que bloqueia, sobre o fundo do tema.
        ctx.strokeStyle = contorno;
        if (t.tipo === 'bloqueio') ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (t.tipo === 'objeto') desenharSprite(ctx, cen.objetos[t.variante], x, y, { cor: contorno });
        if (t.tipo === 'casa') desenharSprite(ctx, cen.casa, x, y, { cor: contorno });
        continue;
      }
      if (t.tipo === 'estrada') textura(ctx, x, y, cen.estrada.cores, cen.estrada.padrao, sortear);
      else if (t.tipo === 'bloqueio') bloqueio(ctx, mapa, c, l, x, y, cen.bloqueio, sortear);
      else {
        // As variações ficam perto da cor base (35% da outra cor): textura sutil, sem xadrez.
        const cores = cen.chao.cores;
        const base = misturar(cores[0], cores[t.tipo === 'chao' ? t.variante : 0], 0.35);
        textura(ctx, x, y, [base, cores[1], cores[2]], 'terra', sortear);
        if (t.tipo === 'objeto') desenharSprite(ctx, cen.objetos[t.variante], x, y);
        if (t.tipo === 'casa') desenharSprite(ctx, cen.casa, x, y);
      }
    }
  }
  // Meio-fio: uma linha escura na borda da estrada, em cada linha do mapa (a estrada faz curvas).
  ctx.fillStyle = contorno ?? cen.estrada.cores[1];
  for (let l = 0; l < mapa.linhas; l++) {
    const [de, ate] = mapa.estrada[l];
    ctx.fillRect(de * TILE, l * TILE, 2, TILE);
    ctx.fillRect((ate + 1) * TILE - 2, l * TILE, 2, TILE);
  }
}

/** Desenha o personagem no seu canvas (só quando o quadro ou o lado mudou) e põe no tile. */
export function desenharPersonagem(p, { forcar = false } = {}) {
  const { el, def, morador: m } = p;
  const chave = `${m.quadro}${m.olhaEsquerda ? 'e' : 'd'}${altoContraste() ? 'c' : ''}`;
  if (forcar || chave !== p.desenhado) {
    p.desenhado = chave;
    const ctx = el.firstElementChild.getContext?.('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, TILE, TILE);
      // Filho e filhote: o desenho do pai ou da mãe pela metade, no pé do tile.
      const [x, y, escala] = def.pequeno ? [TILE / 4, TILE / 2, 1] : [0, 0, 2];
      desenharSprite(ctx, def.quadros[m.quadro], x, y, { escala, espelhar: m.olhaEsquerda, cor: altoContraste() ? corSuave() : undefined });
    }
  }
  el.hidden = !m.visivel;
  el.classList.toggle('saltando', Boolean(m.salto));
  const sobe = def.movimento === 'voar' ? ALTURA_VOO : 0;
  el.style.transform = `translate(${m.c * TILE}px, ${m.l * TILE - sobe}px)`;
}

/** Monta o módulo no DOM: o mundo (centralizado), o canvas do mapa e um <span> por morador. */
export function montar2d(mod) {
  const { plano, vila } = mod;
  const { cen, semente, mapa, esquerdaDoMundo } = plano;
  const mundo = document.createElement('div');
  mundo.className = 'cenario-mundo';
  mundo.style.left = `${esquerdaDoMundo}px`;
  const canvas = document.createElement('canvas');
  canvas.className = 'cenario-mapa';
  canvas.width = mapa.colunas * TILE;
  canvas.height = mapa.linhas * TILE;
  mundo.append(canvas);
  mod.palco.append(mundo);
  desenharMapa(canvas, mapa, cen, semente);
  mod.canvas = canvas;
  mod.personagens = vila.moradores.map((m) => {
    const def = plano.defs[m.i];
    const el = document.createElement('span');
    el.className = `personagem personagem-${m.i + 1} mov-${def.movimento}${def.pequeno ? ' pequeno' : ''}`;
    const tela = document.createElement('canvas');
    tela.width = TILE;
    tela.height = TILE;
    el.append(tela);
    mundo.append(el);
    const p = { def, el, morador: m };
    desenharPersonagem(p);
    return p;
  });
}

export function redesenhar2d(mod) {
  desenharMapa(mod.canvas, mod.plano.mapa, mod.plano.cen, mod.plano.semente);
  for (const p of mod.personagens) desenharPersonagem(p, { forcar: true });
}

export const atualizar2d = (mod) => { for (const p of mod.personagens) desenharPersonagem(p); };
