// O palco dos cenários no navegador. Para cada módulo, planeja o mapa e a vila (planejar, vida.js) e
// entrega para quem desenha: o PixiJS (palco-pixi.js, carregado com import() só aqui, quando há
// WebGL) ou o canvas 2D (palco-2d.js), que é o caminho de reserva e o dos testes. Daqui saem os
// passos da vila (um a cada 0,4 s, só para quem está perto da tela), os balões, a fala de quem é
// clicado e a comemoração quando um exercício é resolvido. Com "reduzir movimento", alto contraste
// ou o cenário pausado, nada se move e nenhum balão aparece sozinho.
import { CENARIOS } from './index.js';
import { TILE, gerarMapa, sorteador } from './mapa.js';
import { posicoesIniciais } from './fisica.js';
import { vila, comCasas, PERSONAGENS_POR_TELA } from './vila.js';
import { criarVila, destinosDoModulo, passoDaVila, comemorar } from './vida.js';
import { montar2d, atualizar2d, redesenhar2d } from './palco-2d.js';
import { FALAS_DA_VILA, EMOJIS_DA_CONVERSA } from '../../conteudo/falas-da-vila.js';
import { anunciar } from '../anuncios.js';

const PASSO_MS = 400;
const FALA_MS = 6000;
// O canvas 2D tem limite de altura: 1000 linhas (32 mil pixels) cobrem qualquer módulo.
const MAX_LINHAS = 1000;
/** O que tem dono no clique: o caminho, os botões e os textos. Clique ali não procura personagem. */
const INTERATIVOS = 'a, button, input, select, textarea, summary, label, [tabindex], .no, .unidade, .vila-acoes, .vila-lista';

/** Parado: "reduzir movimento" (do sistema ou do painel ♿), alto contraste ou o cenário pausado. */
function movimentoReduzido(janela) {
  const raiz = document.documentElement;
  return raiz.classList.contains('a11y-sem-movimento') || raiz.classList.contains('cenario-pausado')
    || raiz.dataset.tema === 'alto-contraste'
    || Boolean(janela.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
const altoContraste = () => document.documentElement.dataset.tema === 'alto-contraste';
const corSuave = () => getComputedStyle(document.documentElement).getPropertyValue('--suave').trim() || '#bbbbbb';

/**
 * Há WebGL com placa de vídeo? Sem GPU, o navegador desenha o WebGL na CPU (SwiftShader, llvmpipe)
 * e o Pixi gastaria mais do que o canvas 2D: `failIfMajorPerformanceCaveat` recusa esse caso. No
 * happy-dom também não há: fica o canvas 2D.
 */
export function temWebGL() {
  try {
    const c = document.createElement('canvas');
    const opcoes = { failIfMajorPerformanceCaveat: true };
    const gl = c.getContext?.('webgl2', opcoes) ?? c.getContext?.('webgl', opcoes);
    if (!gl) return false;
    // O Chromium não marca o SwiftShader como lento: o nome do renderizador diz.
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const nome = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(nome);
  } catch { return false; }
}

/** 100vw: a camada vai da borda esquerda da área da trilha até a direita (sem layout, fica no módulo). */
function alargar(camada) {
  const area = camada.closest('.tela-inicio') ?? document.documentElement;
  const r = area.getBoundingClientRect();
  if (!r.width) return;
  const secao = camada.parentElement.getBoundingClientRect();
  camada.style.setProperty('--cenario-desvio', `${Math.round(r.left - secao.left)}px`);
  camada.style.setProperty('--cenario-largura', `${area.clientWidth}px`);
}

/** O centro de cada nó do módulo, em tiles do mundo, e se é o passo atual ou já foi concluído. */
function medirCaminho(camada, palco, esquerdaDoMundo) {
  const base = palco.getBoundingClientRect();
  return [...camada.parentElement.querySelectorAll('.trilha .no .circulo')]
    .map((el) => ({ r: el.getBoundingClientRect(), no: el.closest('.no') }))
    .filter(({ r }) => r.width)
    .map(({ r, no }) => ({
      c: (r.left + r.width / 2 - base.left - esquerdaDoMundo) / TILE,
      l: (r.top + r.height / 2 - base.top) / TILE,
      atual: no.classList.contains('eh-proximo'),
      feito: no.classList.contains('estado-concluido'),
    }));
}

function medir(nome, inicio) {
  try { performance.measure(nome, { start: inicio, end: performance.now() }); } catch { /* sem User Timing */ }
}

/**
 * O plano de um módulo, sem desenhar nada: o mapa com as casas da vila, quem anda nele e onde cada
 * um começa. É o mesmo para os dois desenhos.
 */
export function planejar(camada, janela) {
  const inicio = performance.now();
  const cen = CENARIOS[camada.dataset.cenario];
  const palco = camada.querySelector('.cenario-palco');
  const { semente } = camada.dataset;
  const feitos = Number(camada.dataset.feitos) || 0;
  alargar(camada);
  const largura = palco.clientWidth || janela.innerWidth || 1280;
  const altura = palco.clientHeight || janela.innerHeight || 800;
  const colunas = Math.max(1, Math.ceil(largura / TILE));
  const linhas = Math.min(MAX_LINHAS, Math.max(1, Math.ceil(altura / TILE)));
  // O mundo tem colunas inteiras de 32px: centraliza para a estrada ficar embaixo dos nós.
  const esquerdaDoMundo = (largura - colunas * TILE) / 2;
  const caminho = medirCaminho(camada, palco, esquerdaDoMundo);
  const base = gerarMapa({ colunas, linhas, cenario: cen, semente, caminho });
  const daVila = vila({ mapa: base, cenario: cen, semente, feitos });
  const mapa = comCasas(base, daVila.casas);

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
  const posicoes = posicoesIniciais(mapa, defs, sortear);
  medir('cenarios:planejar', inicio);
  return { camada, cen, semente, feitos, mapa, casas: daVila.casas, caminho, defs, posicoes, largura, altura, esquerdaDoMundo };
}

// Quantos exercícios cada módulo tinha da última vez que a trilha foi desenhada (só na memória da
// aba): se aumentou, a vila comemora. Nada disso é gravado.
const feitosVistos = new Map();

/** Um módulo pronto para desenhar: o plano, a vila viva e a camada dos balões. */
function criarModulo(camada, janela) {
  const palco = camada.querySelector('.cenario-palco');
  palco.replaceChildren();
  const plano = planejar(camada, janela);
  const { cen, mapa, defs, posicoes, semente, casas, caminho } = plano;
  const destinos = destinosDoModulo(mapa, casas, caminho);
  const vilaViva = criarVila({ mapa, defs, posicoes, semente, destinos, emojis: EMOJIS_DA_CONVERSA[cen.id] });
  const baloes = document.createElement('div');
  baloes.className = 'cenario-baloes';
  baloes.style.left = `${plano.esquerdaDoMundo}px`;
  return {
    camada, palco, plano, vila: vilaViva, baloes, ativos: new Map(),
    bloqueado: Boolean(camada.closest('.bloqueada')), visivel: false,
    largura: palco.clientWidth, altura: palco.clientHeight, larguraMontada: plano.largura, novaCasa: null,
  };
}

/** Um balão de emoji em cima do morador (na camada do cenário), que some sozinho depois de `ms`. */
function mostrarBalao(mod, m, texto, { ms, janela }) {
  mod.ativos.get(m.i)?.remove();
  const el = document.createElement('span');
  el.className = 'balao-vila';
  el.textContent = texto;
  const sobe = m.movimento === 'voar' ? 8 : 0;
  el.style.transform = `translate(${m.c * TILE + TILE / 2}px, ${m.l * TILE - sobe}px) translate(-50%, -100%)`;
  mod.baloes.append(el);
  mod.ativos.set(m.i, el);
  janela.setTimeout(() => { el.remove(); if (mod.ativos.get(m.i) === el) mod.ativos.delete(m.i); }, ms);
}

const sobrepoe = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Onde pôr a fala (largura × altura) perto do personagem em `alvo` (o topo do centro dele), sem
 * encostar em nenhum `obstaculo` (o ícone, a legenda e o balão de cada nó, com folga) e dentro de
 * `larguraSecao`. Tenta acima, abaixo e aos lados, cada vez mais longe; null se nada couber.
 */
export function posicaoDaFala({ largura, altura, alvo, larguraSecao, obstaculos, folga = 6 }) {
  const caixas = obstaculos.map((o) => ({ x: o.x - folga, y: o.y - folga, w: o.w + 2 * folga, h: o.h + 2 * folga }));
  const limitarX = (x) => Math.max(4, Math.min(larguraSecao - largura - 4, x));
  const xs = [alvo.x - largura / 2, alvo.x - largura - 20, alvo.x + 20, 4, larguraSecao - largura - 4];
  const candidatos = [];
  for (let longe = 0; longe <= 4; longe++) {
    for (const y of [alvo.y - altura - 4 - longe * TILE, alvo.y + TILE + 4 + longe * TILE]) {
      for (const x of xs) candidatos.push({ x: limitarX(x), y: Math.max(0, y), w: largura, h: altura });
    }
  }
  const livre = candidatos.find((c) => !caixas.some((o) => sobrepoe(c, o)));
  return livre ? { x: Math.round(livre.x), y: Math.round(livre.y) } : null;
}

/**
 * A fala de quem foi clicado: por cima da trilha, mas nunca sobre o ícone, a legenda ou o balão de
 * uma fase; dentro da largura da seção do módulo e sem receber clique. O texto também vai para o
 * leitor de tela, por anunciar().
 */
function mostrarFala(mod, m, texto, janela) {
  const secao = mod.camada.parentElement;
  secao.querySelector('.fala-vila')?.remove();
  const el = document.createElement('span');
  el.className = 'balao-vila fala fala-vila';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = texto;
  secao.append(el);
  const s = secao.getBoundingClientRect();
  const p = mod.palco.getBoundingClientRect();
  const relativo = (r) => ({ x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height });
  const posicao = posicaoDaFala({
    largura: el.offsetWidth,
    altura: el.offsetHeight,
    alvo: { x: p.left - s.left + mod.plano.esquerdaDoMundo + m.c * TILE + TILE / 2, y: p.top - s.top + m.l * TILE - (m.movimento === 'voar' ? 8 : 0) },
    larguraSecao: s.width,
    obstaculos: [...secao.querySelectorAll('.no .circulo, .no .legenda, .no .balao')].map((o) => relativo(o.getBoundingClientRect())).filter((o) => o.w),
  });
  if (!posicao) { el.remove(); return; } // sem lugar livre: a fala fica só no leitor de tela e na lista
  el.style.transform = `translate(${posicao.x}px, ${posicao.y}px)`;
  janela.setTimeout(() => el.remove(), FALA_MS);
}

function mostrarEventos(mod, eventos, janela) {
  for (const e of eventos) {
    const m = mod.vila.moradores.find((x) => x.i === e.i);
    if (m) mostrarBalao(mod, m, e.emoji, { ms: e.passos * PASSO_MS, janela });
  }
}

// Qual fala cada morador diz no próximo clique (gira entre as dele; começa pela semente).
const proximaFala = new Map();

/** O morador clicado (ou escolhido na lista) diz uma fala: balão na vila e aviso ao leitor de tela. */
export function falaDoMorador(id, semente = '') {
  const info = FALAS_DA_VILA[id];
  if (!info?.falas.length) return null;
  const chave = `${semente}:${id}`;
  const k = proximaFala.get(chave) ?? Math.floor(sorteador(chave)() * info.falas.length);
  proximaFala.set(chave, (k + 1) % info.falas.length);
  return { nome: info.nome, fala: info.falas[k] };
}

/** Comemora se o módulo ganhou exercícios desde o último desenho; a casa nova aparece crescendo. */
function comemorarSePreciso(mod, janela) {
  const { semente, feitos, cen, mapa } = mod.plano;
  const antes = feitosVistos.get(semente);
  feitosVistos.set(semente, feitos);
  if (antes === undefined || feitos <= antes || movimentoReduzido(janela) || mod.bloqueado) return false;
  mostrarEventos(mod, comemorar(mod.vila), janela);
  const casasAntes = vila({ mapa, cenario: cen, semente, feitos: antes }).casas.length;
  if (mod.plano.casas.length > casasAntes) mod.novaCasa = mod.plano.casas.at(-1);
  return true;
}

/** Quem pode andar agora: perto da tela (2 tiles de folga), num módulo visível e desbloqueado. */
function ativosNaTela(topo, altura) {
  return (m) => {
    const y = topo + m.l * TILE;
    return y > -2 * TILE && y < altura + 2 * TILE;
  };
}

/**
 * Liga os cenários da trilha que está em `raiz`. Devolve `desligar()`, que limpa tudo, e
 * `modulos()`. `carregarPixi` e `webgl` existem para os testes trocarem o desenho.
 */
export function ligarCenarios(raiz, { janela = window, carregarPixi = () => import('./palco-pixi.js'), webgl = temWebGL } = {}) {
  const camadas = [...raiz.querySelectorAll('.cenario')].filter((c) => CENARIOS[c.dataset.cenario]);
  // A largura da camada é medida antes do primeiro quadro: nada muda de tamanho depois (CLS zero).
  camadas.forEach(alargar);
  const usarPixi = Boolean(carregarPixi) && camadas.length > 0 && webgl();
  const desenho = usarPixi ? ligarPixi(raiz, camadas, janela, carregarPixi) : ligarCanvas2d(raiz, camadas, janela);

  // Clicar ou tocar num personagem: ele diz uma dica. A camada não recebe clique (não rouba a
  // rolagem nem o caminho): o clique na seção é convertido em tile.
  const aoClicar = (e) => {
    const secao = e.target.closest?.('.com-cenario');
    const interativo = e.target.closest?.(INTERATIVOS);
    if (!secao || (interativo && secao.contains(interativo))) return;
    const mod = desenho.modulos().find((m) => m.camada.parentElement === secao);
    if (!mod) return;
    const r = mod.palco.getBoundingClientRect();
    const x = (e.clientX - r.left - mod.plano.esquerdaDoMundo) / TILE;
    const y = (e.clientY - r.top) / TILE;
    const alvo = mod.vila.moradores.find((m) => m.visivel
      && Math.abs(m.c + 0.5 - x) <= 0.75 && Math.abs(m.l + 0.5 - (m.movimento === 'voar' ? y + 0.25 : y)) <= 0.75);
    const dita = alvo && falaDoMorador(alvo.id, mod.plano.semente);
    if (!dita) return;
    mostrarFala(mod, alvo, dita.fala, janela);
    anunciar(`${dita.nome} — ${dita.fala}`);
  };
  raiz.addEventListener('click', aoClicar);

  return {
    modulos: () => desenho.modulos(),
    desligar() {
      raiz.removeEventListener('click', aoClicar);
      desenho.desligar();
    },
  };
}

// ---------- PixiJS ----------

function ligarPixi(raiz, camadas, janela, carregarPixi) {
  let mods = [];
  let palco = null;
  let reserva = null;
  let desligado = false;
  let espera = null;
  let montagem = 0;
  raiz.dataset.cenarioDesenho = 'carregando';
  // Um módulo por tarefa (planejar um módulo longo leva ~150 ms num celular fraco), começando pelos
  // que estão na tela: a trilha responde enquanto o resto da vila é montado.
  const montarTudo = () => {
    janela.clearTimeout(espera);
    const esta = ++montagem;
    const inicio = performance.now();
    const altura = janela.innerHeight || 800;
    const distancia = (c) => {
      const r = c.getBoundingClientRect();
      return r.bottom < 0 ? -r.bottom : Math.max(0, r.top - altura);
    };
    const fila = camadas.map((c, i) => ({ c, i })).sort((a, b) => distancia(a.c) - distancia(b.c));
    const porPosicao = new Array(camadas.length).fill(null);
    mods = [];
    palco.montar([]);
    let comemorou = false;
    const proximo = () => {
      if (desligado || esta !== montagem) return;
      const inicioDoModulo = performance.now();
      const { c, i } = fila.shift();
      const mod = criarModulo(c, janela);
      mod.palco.append(mod.baloes);
      porPosicao[i] = mod;
      mods = porPosicao.filter(Boolean);
      palco.adicionar(mod);
      if (comemorarSePreciso(mod, janela)) comemorou = true;
      medir('cenarios:modulo', inicioDoModulo);
      if (fila.length) { espera = janela.setTimeout(proximo, 0); return; }
      if (comemorou) palco.agitar();
      medir('cenarios:montar', inicio);
    };
    proximo();
  };
  const aoPasso = ({ topoDaTela, altura }) => {
    let andou = false;
    for (const mod of mods) {
      const topo = topoDaTela(mod);
      if (mod.bloqueado || topo === undefined || topo > altura || topo + mod.altura < 0) continue;
      mostrarEventos(mod, passoDaVila(mod.vila, mod.plano.mapa, { noite: mod.plano.cen.rotina === 'noite', ativos: ativosNaTela(topo, altura) }), janela);
      andou = true;
    }
    return andou;
  };

  let largura = janela.innerWidth;
  const aoRedimensionar = () => {
    if (!palco) return;
    // O canvas acompanha a caixa que rola; só a largura refaz o mapa (a altura muda com a barra
    // de endereço do celular a cada rolagem).
    palco.redimensionar();
    if (janela.innerWidth !== largura) { largura = janela.innerWidth; camadas.forEach(alargar); montarTudo(); palco.redimensionar(); }
  };
  // O módulo mudou de altura (etapas abertas, fontes carregadas): refaz quando aparece.
  const observador = janela.IntersectionObserver ? new janela.IntersectionObserver((entradas) => {
    if (!palco) return;
    const mudou = entradas.some((e) => {
      const mod = mods.find((m) => m.camada === e.target);
      return e.isIntersecting && mod && mod.palco.clientHeight && mod.palco.clientHeight !== mod.altura;
    });
    if (mudou) montarTudo();
  }) : null;
  const Mutacao = janela.MutationObserver ?? globalThis.MutationObserver;
  const mutacao = Mutacao ? new Mutacao(() => palco?.redesenhar(mods)) : null;

  carregarPixi()
    .then(({ criarPalcoPixi }) => criarPalcoPixi(raiz, {
      janela,
      podeAndar: () => !movimentoReduzido(janela),
      aoPasso,
      contorno: () => (altoContraste() ? corSuave() : null),
    }))
    .then((p) => {
      if (desligado) { p.desligar(); return; }
      palco = p;
      raiz.dataset.cenarioDesenho = p.renderizador;
      montarTudo();
      janela.addEventListener('resize', aoRedimensionar);
      camadas.forEach((c) => observador?.observe(c));
      mutacao?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'class'] });
    })
    .catch((erro) => {
      // Sem WebGL de verdade (ou o Pixi não carregou): o canvas 2D de sempre.
      console.warn('Cenários: sem WebGL, usando o canvas 2D.', erro);
      if (!desligado) reserva = ligarCanvas2d(raiz, camadas, janela);
    });

  return {
    modulos: () => (reserva ? reserva.modulos() : mods),
    desligar() {
      desligado = true;
      janela.clearTimeout(espera);
      janela.removeEventListener('resize', aoRedimensionar);
      observador?.disconnect();
      mutacao?.disconnect();
      palco?.desligar();
      reserva?.desligar();
      delete raiz.dataset.cenarioDesenho;
    },
  };
}

// ---------- canvas 2D (reserva) ----------

function montarModulo2d(camada, janela) {
  const inicio = performance.now();
  const mod = criarModulo(camada, janela);
  montar2d(mod);
  mod.palco.append(mod.baloes);
  comemorarSePreciso(mod, janela);
  medir('cenarios:montar', inicio);
  return mod;
}

function ligarCanvas2d(raiz, camadas, janela) {
  raiz.dataset.cenarioDesenho = '2d';
  let palcos = camadas.map((c) => montarModulo2d(c, janela));
  let temporizador = null;

  const passo = () => {
    if (document.hidden || movimentoReduzido(janela)) return;
    const altura = janela.innerHeight || 800;
    for (const p of palcos) {
      if (!p.visivel || p.bloqueado) continue;
      const topo = p.palco.getBoundingClientRect().top;
      mostrarEventos(p, passoDaVila(p.vila, p.plano.mapa, { noite: p.plano.cen.rotina === 'noite', ativos: ativosNaTela(topo, altura) }), janela);
      atualizar2d(p);
    }
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
        const { clientWidth: largura, clientHeight: altura } = palcos[i].palco;
        const mudou = (largura && largura !== palcos[i].largura) || (altura && altura !== palcos[i].altura);
        if (e.isIntersecting && mudou) palcos[i] = montarModulo2d(palcos[i].camada, janela);
        palcos[i].visivel = e.isIntersecting;
      }
    })
    : null;
  const observar = () => palcos.forEach((p) => observador?.observe(p.camada));
  observar();

  // Tema, pausa ou "reduzir movimento" mudaram: redesenha (as cores do alto contraste) e liga ou desliga o temporizador.
  const Mutacao = janela.MutationObserver ?? globalThis.MutationObserver;
  const mutacao = Mutacao ? new Mutacao(() => {
    for (const p of palcos) redesenhar2d(p);
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
        return (p.palco.clientWidth || janela.innerWidth || 1280) !== p.larguraMontada;
      });
      if (!mudaram.length) return;
      observador?.disconnect();
      palcos = palcos.map((p) => (mudaram.includes(p) ? montarModulo2d(p.camada, janela) : p));
      observar();
    }, 200);
  };
  janela.addEventListener('resize', aoRedimensionar);

  atualizarTemporizador();

  return {
    modulos: () => palcos,
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
