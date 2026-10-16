// O palco dos cenários no navegador: desenha o mapa de tiles de cada módulo num <canvas> e
// move os personagens de tile em tile. Um único temporizador (um passo a cada 0,4 s, nada a cada
// quadro) mexe só os cenários que estão na tela. Ele nem é criado com "reduzir movimento", no
// alto contraste ou sem IntersectionObserver, e para quando a aba fica oculta.
import { CENARIOS } from './index.js';
import { TILE, gerarMapa, sorteador, tileEm } from './mapa.js';
import { proximoPasso, posicoesIniciais } from './fisica.js';
import { desenharSprite, misturar } from './pixel.js';
import { vila, comCasas, PERSONAGENS_POR_TELA } from './vila.js';

const PASSO_MS = 400;
const ALTURA_VOO = 8;
// O canvas tem limite de altura: 1000 linhas (32 mil pixels) cobrem qualquer módulo.
const MAX_LINHAS = 1000;

function movimentoReduzido(janela) {
  const raiz = document.documentElement;
  return raiz.classList.contains('a11y-sem-movimento') || raiz.dataset.tema === 'alto-contraste'
    || Boolean(janela.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
const altoContraste = () => document.documentElement.dataset.tema === 'alto-contraste';
const corSuave = () => getComputedStyle(document.documentElement).getPropertyValue('--suave').trim() || '#bbbbbb';

// ---------- desenho do mapa ----------

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

/** Água, lava ou gelo partido: cor, reflexos e a borda nos lados que tocam a terra (como no Tibia). */
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

function desenharMapa(canvas, mapa, cen, semente) {
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

// ---------- personagens ----------

function desenharPersonagem(el, def, estado) {
  const canvas = el.firstElementChild;
  const ctx = canvas.getContext?.('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, TILE, TILE);
    // Filho e filhote: o desenho do pai ou da mãe pela metade, no pé do tile.
    const [x, y, escala] = def.pequeno ? [TILE / 4, TILE / 2, 1] : [0, 0, 2];
    desenharSprite(ctx, def.quadros[estado.quadro], x, y, { escala, espelhar: estado.olhaEsquerda, cor: altoContraste() ? corSuave() : undefined });
  }
  const sobe = def.movimento === 'voar' ? ALTURA_VOO : 0;
  el.style.transform = `translate(${estado.c * TILE}px, ${estado.l * TILE - sobe}px)`;
}

// ---------- um palco por módulo ----------

/** 100vw: a camada vai da borda esquerda da área da trilha até a direita (sem layout, fica no módulo). */
function alargar(camada) {
  const area = camada.closest('.tela-inicio') ?? document.documentElement;
  const r = area.getBoundingClientRect();
  if (!r.width) return;
  const secao = camada.parentElement.getBoundingClientRect();
  camada.style.setProperty('--cenario-desvio', `${Math.round(r.left - secao.left)}px`);
  camada.style.setProperty('--cenario-largura', `${area.clientWidth}px`);
}

/** O centro de cada nó do módulo, em tiles do mundo (sem layout, nenhum: a estrada fica reta). */
function medirCaminho(camada, palco, esquerdaDoMundo) {
  const base = palco.getBoundingClientRect();
  return [...camada.parentElement.querySelectorAll('.trilha .no .circulo')].map((el) => el.getBoundingClientRect())
    .filter((r) => r.width)
    .map((r) => ({ c: (r.left + r.width / 2 - base.left - esquerdaDoMundo) / TILE, l: (r.top + r.height / 2 - base.top) / TILE }));
}

function montar(camada, janela) {
  const cen = CENARIOS[camada.dataset.cenario];
  const palco = camada.querySelector('.cenario-palco');
  const { semente } = camada.dataset;
  palco.replaceChildren();
  alargar(camada);
  const largura = palco.clientWidth || janela.innerWidth || 1280;
  const altura = palco.clientHeight || janela.innerHeight || 800;
  const colunas = Math.max(1, Math.ceil(largura / TILE));
  const linhas = Math.min(MAX_LINHAS, Math.max(1, Math.ceil(altura / TILE)));
  const esquerdaDoMundo = (largura - colunas * TILE) / 2;
  const caminho = medirCaminho(camada, palco, esquerdaDoMundo);
  const base = gerarMapa({ colunas, linhas, cenario: cen, semente, caminho });
  const daVila = vila({ mapa: base, cenario: cen, semente, feitos: Number(camada.dataset.feitos) || 0 });
  const mapa = comCasas(base, daVila.casas);

  // O mundo tem colunas inteiras de 32px: centraliza para a estrada ficar embaixo dos nós.
  const mundo = document.createElement('div');
  mundo.className = 'cenario-mundo';
  mundo.style.left = `${esquerdaDoMundo}px`;
  const canvas = document.createElement('canvas');
  canvas.className = 'cenario-mapa';
  canvas.width = colunas * TILE;
  canvas.height = linhas * TILE;
  mundo.append(canvas);
  palco.append(mundo);
  desenharMapa(canvas, mapa, cen, semente);

  const sortear = sorteador(`${semente}-passos`);
  // 3 personagens (1 no celular) por tela de altura; depois, os filhos e os filhotes da vila. O limite
  // é proporcional ao espaço: 10 por tela de altura (4 no celular), então a vila cresce com o módulo.
  const celular = (janela.innerWidth ?? 1280) < 600;
  const porTela = celular ? 1 : 3;
  const telas = Math.max(1, Math.round(altura / (janela.innerHeight || 800)));
  const limite = telas * PERSONAGENS_POR_TELA[celular ? 'celular' : 'normal'];
  const deSempre = Array.from({ length: porTela * telas }, (_, i) => cen.personagens[i % porTela]);
  const porId = Object.fromEntries(cen.personagens.map((p) => [p.id, p]));
  const pequenos = [...daVila.filhos.map((f) => porId[f.pai]), ...daVila.filhotes.map((f) => porId[f.mae])].map((p) => ({ ...p, pequeno: true }));
  const defs = [...deSempre, ...pequenos].slice(0, limite);
  const personagens = posicoesIniciais(mapa, defs, sortear).map((estado, i) => {
    if (!estado) return null;
    const el = document.createElement('span');
    el.className = `personagem personagem-${i + 1} mov-${defs[i].movimento}${defs[i].pequeno ? ' pequeno' : ''}`;
    const tela = document.createElement('canvas');
    tela.width = TILE;
    tela.height = TILE;
    el.append(tela);
    mundo.append(el);
    const p = { def: defs[i], el, estado: { ...estado, olhaEsquerda: false } };
    desenharPersonagem(el, p.def, p.estado);
    return p;
  }).filter(Boolean);

  return {
    camada, canvas, mapa, cen, semente, sortear, personagens, largura: palco.clientWidth, altura: palco.clientHeight, larguraMontada: largura,
    visivel: false, bloqueado: Boolean(camada.closest('.bloqueada')),
  };
}

function andar(palco, janela) {
  for (const p of palco.personagens) {
    const novo = proximoPasso(p.estado, palco.mapa, palco.sortear);
    if (!novo.parado && novo.direcao[0]) novo.olhaEsquerda = novo.direcao[0] < 0;
    p.estado = novo;
    desenharPersonagem(p.el, p.def, novo);
    if (p.def.movimento === 'saltar' && palco.sortear() < 0.15) {
      p.el.classList.add('saltando');
      janela.setTimeout(() => p.el.classList.remove('saltando'), PASSO_MS);
    }
  }
}

/** Liga os cenários da trilha que está em `raiz`. Devolve `desligar()`, que limpa tudo. */
export function ligarCenarios(raiz, { janela = window } = {}) {
  let palcos = [...raiz.querySelectorAll('.cenario')].filter((c) => CENARIOS[c.dataset.cenario]).map((c) => montar(c, janela));
  let temporizador = null;

  const passo = () => {
    if (document.hidden || movimentoReduzido(janela)) return;
    for (const p of palcos) if (p.visivel && !p.bloqueado) andar(p, janela);
  };
  const atualizarTemporizador = () => {
    const pode = !movimentoReduzido(janela) && Boolean(janela.IntersectionObserver) && palcos.length > 0;
    if (pode && temporizador === null) temporizador = janela.setInterval(passo, PASSO_MS);
    if (!pode && temporizador !== null) { janela.clearInterval(temporizador); temporizador = null; }
  };

  const observador = janela.IntersectionObserver
    ? new janela.IntersectionObserver((entradas) => {
      for (const e of entradas) {
        const i = palcos.findIndex((x) => x.camada === e.target);
        if (i < 0) continue;
        // Montado com a tela escondida (largura 0)? Refaz com a largura de verdade, para a estrada ficar
        // sob os nós. O módulo mudou de altura? Refaz para o mapa cobrir o módulo inteiro.
        const { clientWidth: largura, clientHeight: altura } = palcos[i].camada.querySelector('.cenario-palco');
        const mudou = (largura && largura !== palcos[i].largura) || (altura && altura !== palcos[i].altura);
        if (e.isIntersecting && mudou) palcos[i] = montar(palcos[i].camada, janela);
        palcos[i].visivel = e.isIntersecting;
      }
    })
    : null;
  const observar = () => palcos.forEach((p) => observador?.observe(p.camada));
  observar();

  // Tema ou "reduzir movimento" mudaram: redesenha (as cores do alto contraste) e liga ou desliga o temporizador.
  const Mutacao = janela.MutationObserver ?? globalThis.MutationObserver;
  const mutacao = Mutacao ? new Mutacao(() => {
    for (const p of palcos) {
      desenharMapa(p.canvas, p.mapa, p.cen, p.semente);
      for (const per of p.personagens) desenharPersonagem(per.el, per.def, per.estado);
    }
    atualizarTemporizador();
  }) : null;
  mutacao?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'class'] });

  // A janela mudou de largura: refaz os mapas (com uma espera, para não refazer a cada pixel). Só a
  // largura muda o mapa; no celular, a barra de endereço muda a altura a cada rolagem, e refazer tudo
  // nessa hora travaria a rolagem e mandaria os personagens de volta ao começo.
  let espera = null;
  const aoRedimensionar = () => {
    janela.clearTimeout(espera);
    espera = janela.setTimeout(() => {
      const mudaram = palcos.filter((p) => {
        alargar(p.camada);
        const palco = p.camada.querySelector('.cenario-palco');
        return (palco.clientWidth || janela.innerWidth || 1280) !== p.larguraMontada;
      });
      if (!mudaram.length) return;
      observador?.disconnect();
      palcos = palcos.map((p) => (mudaram.includes(p) ? montar(p.camada, janela) : p));
      observar();
    }, 200);
  };
  janela.addEventListener('resize', aoRedimensionar);

  atualizarTemporizador();

  return {
    desligar() {
      if (temporizador !== null) janela.clearInterval(temporizador);
      temporizador = null;
      observador?.disconnect();
      mutacao?.disconnect();
      janela.clearTimeout(espera);
      janela.removeEventListener('resize', aoRedimensionar);
    },
  };
}
