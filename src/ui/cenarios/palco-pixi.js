// O desenho dos cenários com PixiJS (WebGL), carregado com import() só na tela da trilha. Um único
// canvas, fixo atrás da trilha e do tamanho da caixa que rola (o navegador limita os contextos
// WebGL e o tamanho das texturas: um canvas por módulo não caberia). Cada módulo é um Container
// deslocado pela rolagem; o mapa é feito de pedaços de 16×16 tiles, criados quando chegam perto da
// tela, com as texturas de um atlas (atlas.js). Os personagens deslizam entre os tiles num único
// Ticker, que só desenha quando algo mudou: a rolagem a cada quadro, a animação até 24 por segundo.
import { Application, Container, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { TILE } from './mapa.js';
import { quadrosDoAtlas, posicaoNoAtlas, camadasDoTile, desenharAtlas, tamanhoDoAtlas } from './atlas.js';

const PASSO_MS = 400;
const PEDACO = 16;
const ALTURA_VOO = 8;
const ALTURA_SALTO = 12;
const CRESCER_MS = 300;
/** Orçamento: a animação dos personagens desenha no máximo 24 quadros por segundo (a rolagem, todos). */
const QUADRO_ANIMACAO_MS = 1000 / 24;

/** A folha do cenário como texturas do Pixi. `cinza`: a do módulo bloqueado, sem cor. */
function atlasDoCenario(cen, { contorno, cinza }) {
  const { largura, altura } = tamanhoDoAtlas(cen);
  const folha = document.createElement('canvas');
  folha.width = largura;
  folha.height = altura;
  const ctx = folha.getContext('2d');
  if (ctx) desenharAtlas(ctx, cen, { contorno });
  if (ctx && cinza) {
    const img = ctx.getImageData(0, 0, largura, altura);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = y; d[i + 1] = y; d[i + 2] = y;
    }
    ctx.putImageData(img, 0, 0);
  }
  const fonte = Texture.from(folha).source;
  fonte.scaleMode = 'nearest';
  const quadros = new Map();
  quadrosDoAtlas(cen).forEach(({ nome }, i) => {
    const { x, y } = posicaoNoAtlas(i);
    quadros.set(nome, new Texture({ source: fonte, frame: new Rectangle(x, y, TILE, TILE) }));
  });
  return { fonte, quadros };
}

function criarPedaco(plano, atlas, pc, pl, corMeioFio) {
  const { mapa } = plano;
  const pedaco = new Container();
  const ate = Math.min(mapa.linhas, (pl + 1) * PEDACO);
  for (let l = pl * PEDACO; l < ate; l++) {
    for (let c = pc * PEDACO; c < Math.min(mapa.colunas, (pc + 1) * PEDACO); c++) {
      for (const nome of camadasDoTile(mapa, c, l)) {
        const s = new Sprite(atlas.quadros.get(nome));
        s.position.set(c * TILE, l * TILE);
        pedaco.addChild(s);
      }
    }
    // Meio-fio: uma linha escura de cada lado da estrada.
    const [de, fim] = mapa.estrada[l];
    for (const x of [de * TILE, (fim + 1) * TILE - 2]) {
      if (x < pc * PEDACO * TILE || x >= (pc + 1) * PEDACO * TILE) continue;
      const m = new Sprite(Texture.WHITE);
      m.tint = corMeioFio;
      m.position.set(x, l * TILE);
      m.width = 2;
      m.height = TILE;
      pedaco.addChild(m);
    }
  }
  return pedaco;
}

/** Quem rola a trilha: a própria tela (overflow: auto) ou, se ela não rolar, o documento. */
export function acharRolador(raiz) {
  for (let el = raiz; el && el !== document.body; el = el.parentElement) {
    if (['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) return el;
  }
  return document.scrollingElement ?? document.documentElement;
}

/**
 * Cria o palco Pixi em `raiz`. `aoPasso(agora)` é chamado a cada 0,4 s enquanto `podeAndar()`;
 * devolve true se alguém andou. Lança erro se não houver WebGL (quem chama volta para o 2D).
 */
export async function criarPalcoPixi(raiz, { janela = window, podeAndar = () => true, aoPasso = () => false, contorno = () => null } = {}) {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({
    preference: 'webgl',
    backgroundAlpha: 0,
    antialias: false,
    autoStart: false,
    sharedTicker: false,
    resolution: Math.min(janela.devicePixelRatio || 1, 2),
    autoDensity: true,
    roundPixels: true,
    failIfMajorPerformanceCaveat: true,
    // O canvas é decorativo: o Pixi não pode criar a camada de acessibilidade dele ao apertar Tab.
    accessibilityOptions: { enabledByDefault: false, activateOnTab: false },
  });
  app.stage.eventMode = 'none';
  const canvas = app.canvas;
  canvas.className = 'cenario-pixi';
  canvas.setAttribute('aria-hidden', 'true');
  raiz.classList.add('com-pixi');
  raiz.prepend(canvas);
  const rolador = acharRolador(raiz);
  const doDocumento = rolador === document.scrollingElement || rolador === document.documentElement;
  let caixa = { top: 0, left: 0, width: 0, height: 0 };
  const ajustarCanvas = () => {
    caixa = doDocumento ? { top: 0, left: 0, width: janela.innerWidth, height: janela.innerHeight } : rolador.getBoundingClientRect();
    Object.assign(canvas.style, { top: `${caixa.top}px`, left: `${caixa.left}px` });
    app.renderer.resize(Math.max(1, caixa.width), Math.max(1, caixa.height));
  };
  ajustarCanvas();

  const atlas = new Map();
  const atlasDe = (cen, cinza) => {
    const chave = `${cen.id}:${cinza ? 'cinza' : ''}`;
    if (!atlas.has(chave)) atlas.set(chave, atlasDoCenario(cen, { contorno: contorno(), cinza }));
    return atlas.get(chave);
  };
  const limparAtlas = () => {
    for (const a of atlas.values()) a.fonte.destroy();
    atlas.clear();
  };

  let modulos = [];
  // Onde cada módulo está, em coordenadas do conteúdo que rola: só muda ao redimensionar.
  const medirGeometria = () => {
    const rolagem = rolador.scrollTop;
    for (const m of modulos) {
      const r = m.mod.palco.getBoundingClientRect();
      m.topo = r.top - caixa.top + rolagem;
      m.esquerda = r.left - caixa.left + m.mod.plano.esquerdaDoMundo;
      m.altura = r.height;
    }
  };

  const criarModuloPixi = (mod) => {
    const raizModulo = new Container();
    const chao = new Container();
    chao.alpha = 0.45;
    const gente = new Container();
    raizModulo.addChild(chao, gente);
    if (mod.bloqueado) raizModulo.alpha = 0.2;
    app.stage.addChild(raizModulo);
    const a = atlasDe(mod.plano.cen, mod.bloqueado);
    const sprites = mod.vila.moradores.map((m) => {
      const s = new Sprite(a.quadros.get(`per-${m.id}-0`));
      s.anchor.set(0.5, 1);
      gente.addChild(s);
      return { m, s };
    });
    const cor = contorno() ?? mod.plano.cen.estrada.cores[1];
    return { mod, atlas: a, raiz: raizModulo, chao, pedacos: new Map(), sprites, cor, topo: 0, esquerda: 0, altura: 0, crescer: null };
  };
  const montar = (lista) => {
    for (const m of modulos) m.raiz.destroy({ children: true });
    modulos = lista.map(criarModuloPixi);
    medirGeometria();
  };
  /** Mais um módulo (a montagem vai um por tarefa, para não travar o celular). */
  const adicionar = (mod) => {
    modulos.push(criarModuloPixi(mod));
    medirGeometria();
  };

  /** Uma casa nova aparece crescendo (300 ms), por cima da casa já desenhada no mapa. */
  const crescerCasa = (m, agora) => {
    const { novaCasa } = m.mod;
    if (!novaCasa) return;
    m.mod.novaCasa = null;
    const camada = new Container();
    const chao = new Sprite(m.atlas.quadros.get(camadasDoTile(m.mod.plano.mapa, novaCasa.c, novaCasa.l)[0]));
    const casa = new Sprite(m.atlas.quadros.get('casa'));
    casa.anchor.set(0.5, 1);
    casa.position.set(TILE / 2, TILE);
    camada.addChild(chao, casa);
    camada.position.set(novaCasa.c * TILE, novaCasa.l * TILE);
    m.chao.addChild(camada);
    m.crescer = { camada, casa, inicio: agora };
  };

  let ultimoY = null;
  let ultimoDesenho = 0;
  let proximoPasso = 0;
  let passoEm = 0;
  let animando = false;
  const quadro = () => {
    const agora = performance.now();
    const y = rolador.scrollTop;
    const altura = caixa.height;
    if (podeAndar() && !document.hidden && agora >= proximoPasso) {
      proximoPasso = agora + PASSO_MS;
      if (aoPasso({ topoDaTela: (m) => modulos.find((x) => x.mod === m)?.topo - y, altura })) { passoEm = agora; animando = true; }
    }
    const rolou = y !== ultimoY;
    if (!rolou && !(animando && agora - ultimoDesenho >= QUADRO_ANIMACAO_MS)) return;
    ultimoY = y;
    ultimoDesenho = agora;
    const k = Math.min(1, (agora - passoEm) / PASSO_MS);
    animando = k < 1;
    for (const m of modulos) {
      const visivel = m.topo - y < altura && m.topo + m.altura - y > 0;
      m.raiz.visible = visivel;
      if (!visivel) continue;
      m.raiz.position.set(Math.round(m.esquerda), Math.round(m.topo - y));
      // Pedaços do mapa: cria os que chegaram perto da tela e esconde os outros.
      const { colunas, linhas } = m.mod.plano.mapa;
      const de = Math.max(0, Math.floor((y - m.topo) / (PEDACO * TILE)) - 1);
      const ate = Math.min(Math.ceil(linhas / PEDACO) - 1, Math.floor((y + altura - m.topo) / (PEDACO * TILE)) + 1);
      for (const pedaco of m.pedacos.values()) pedaco.visible = pedaco.linha >= de && pedaco.linha <= ate;
      for (let pl = de; pl <= ate; pl++) {
        for (let pc = 0; pc < Math.ceil(colunas / PEDACO); pc++) {
          if (m.pedacos.has(`${pc},${pl}`)) continue;
          const pedaco = criarPedaco(m.mod.plano, m.atlas, pc, pl, m.cor);
          pedaco.linha = pl;
          m.chao.addChildAt(pedaco, 0);
          m.pedacos.set(`${pc},${pl}`, pedaco);
        }
      }
      crescerCasa(m, agora);
      if (m.crescer) {
        const t = Math.min(1, (agora - m.crescer.inicio) / CRESCER_MS);
        m.crescer.casa.scale.set(0.3 + 0.7 * t);
        if (t >= 1) { m.crescer.camada.destroy({ children: true }); m.crescer = null; } else animando = true;
      }
      for (const { m: mor, s } of m.sprites) {
        s.visible = mor.visivel;
        if (!mor.visivel) continue;
        s.texture = m.atlas.quadros.get(`per-${mor.id}-${mor.quadro}`);
        const c = mor.de[0] + (mor.c - mor.de[0]) * k;
        const l = mor.de[1] + (mor.l - mor.de[1]) * k;
        const meia = mor.pequeno ? 0.5 : 1;
        s.scale.set((mor.olhaEsquerda ? -1 : 1) * meia, meia);
        const salto = mor.salto ? Math.sin(Math.PI * k) * ALTURA_SALTO : 0;
        s.position.set(c * TILE + TILE / 2, l * TILE + TILE - (mor.movimento === 'voar' ? ALTURA_VOO : 0) - salto);
      }
    }
    app.renderer.render(app.stage);
  };
  app.ticker.add(quadro);
  app.ticker.start();

  // Aba oculta: o Ticker para de vez (o requestAnimationFrame já pausaria, mas assim nada acorda).
  const aoMudarVisibilidade = () => { if (document.hidden) app.ticker.stop(); else { ultimoY = null; app.ticker.start(); } };
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  let desligado = false;
  return {
    renderizador: app.renderer.name,
    montar(lista) { montar(lista); ultimoY = null; },
    adicionar(mod) { adicionar(mod); ultimoY = null; },
    redimensionar() { ajustarCanvas(); medirGeometria(); ultimoY = null; },
    /** Anima sem dar passo (o salto da comemoração, a casa nova). */
    agitar() { const agora = performance.now(); passoEm = agora; proximoPasso = agora + PASSO_MS; animando = true; ultimoY = null; },
    /** O tema mudou (alto contraste, por exemplo): refaz as folhas e os pedaços. */
    redesenhar(lista) { limparAtlas(); montar(lista); ultimoY = null; },
    desligar() {
      if (desligado) return;
      desligado = true;
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      app.ticker.stop();
      // Devolve o contexto WebGL na hora: o navegador só deixa uns 16 abertos ao mesmo tempo.
      const gl = app.renderer.gl;
      limparAtlas();
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      raiz.classList.remove('com-pixi');
    },
  };
}
