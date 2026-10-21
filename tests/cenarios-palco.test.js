// @vitest-environment happy-dom
// O palco com PixiJS (o desenho é trocado por um falso: o happy-dom não tem WebGL), a vila viva,
// a fala de quem é clicado, a comemoração, "Conhecer a vila", a pausa e o atlas.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ligarCenarios, falaDoMorador, posicaoDaFala } from '../src/ui/cenarios/palco.js';
import { renderInicio } from '../src/ui/inicio.js';
import { CENARIOS } from '../src/ui/cenarios/index.js';
import { FALAS_DA_VILA, EMOJIS_DA_CONVERSA } from '../src/conteudo/falas-da-vila.js';
import { htmlConhecerVila, contarDaVila } from '../src/ui/cenarios/conhecer.js';
import { quadrosDoAtlas, camadasDoTile, tamanhoDoAtlas, posicaoNoAtlas, COLUNAS_DO_ATLAS } from '../src/ui/cenarios/atlas.js';
import { TILE } from '../src/ui/cenarios/mapa.js';

const tela = () => document.getElementById('tela-inicio');
const esperar = () => new Promise((r) => setTimeout(r, 0));

function janelaFalsa() {
  return {
    innerWidth: 1280,
    innerHeight: 800,
    setInterval: () => 1,
    clearInterval: () => {},
    // De verdade: o palco Pixi monta um módulo por tarefa.
    setTimeout: (f, ms) => setTimeout(f, ms),
    clearTimeout: (id) => clearTimeout(id),
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
}

const todos = () => document.querySelectorAll('.cenario').length;
/** Espera o palco Pixi montar todos os módulos (um por tarefa). */
const montado = (f) => vi.waitFor(() => expect(f.mods?.length).toBe(todos()));

/** Um "Pixi" falso: guarda o que o palco pediu e deixa o teste dar os passos. */
function pixiFalso({ falhar = false } = {}) {
  const f = { montagens: 0, desligado: false, agitado: 0, redesenhos: 0 };
  f.carregar = () => Promise.resolve({
    async criarPalcoPixi(_raiz, opcoes) {
      if (falhar) throw new Error('sem WebGL');
      f.opcoes = opcoes;
      return {
        renderizador: 'webgl',
        montar(mods) { f.montagens += 1; f.mods = [...mods]; },
        adicionar(mod) { f.mods.push(mod); },
        redimensionar() {},
        agitar() { f.agitado += 1; },
        redesenhar() { f.redesenhos += 1; },
        desligar() { f.desligado = true; },
      };
    },
  });
  /** Um passo, com o módulo `i` inteiro na tela. */
  f.passo = () => f.opcoes.aoPasso({ topoDaTela: () => 0, altura: 100000 });
  return f;
}

beforeAll(() => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  renderInicio(tela());
});

afterEach(() => {
  document.documentElement.classList.remove('a11y-sem-movimento', 'cenario-pausado');
  delete document.documentElement.dataset.tema;
});

describe('palco com PixiJS', () => {
  it('com WebGL, carrega o Pixi, monta os módulos e marca o desenho; desligar devolve tudo', async () => {
    const f = pixiFalso();
    const r = ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: f.carregar, webgl: () => true });
    expect(tela().dataset.cenarioDesenho).toBe('carregando');
    await montado(f);
    expect(tela().dataset.cenarioDesenho).toBe('webgl');
    expect(f.montagens).toBe(1);
    // Nada de canvas 2D: o mapa e os personagens são do Pixi; os balões, do DOM.
    expect(document.querySelectorAll('.cenario-mapa, .personagem')).toHaveLength(0);
    expect(document.querySelectorAll('.cenario-baloes').length).toBe(f.mods.length);
    r.desligar();
    expect(f.desligado).toBe(true);
    expect(tela().dataset.cenarioDesenho).toBeUndefined();
  });

  it('desligado antes de o Pixi carregar (trocou de rota): o palco que chega é desligado na hora', async () => {
    const f = pixiFalso();
    ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: f.carregar, webgl: () => true }).desligar();
    await esperar(); await esperar();
    expect(f.desligado).toBe(true);
    expect(f.montagens).toBe(0);
  });

  it('se o Pixi falhar (sem WebGL de verdade), volta para o canvas 2D', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: pixiFalso({ falhar: true }).carregar, webgl: () => true });
    await esperar(); await esperar();
    expect(tela().dataset.cenarioDesenho).toBe('2d');
    expect(document.querySelectorAll('.cenario-mapa').length).toBeGreaterThan(0);
    r.desligar();
    aviso.mockRestore();
  });

  it('sem WebGL, nem tenta o Pixi: o 2D é montado na hora', () => {
    const carregar = vi.fn();
    const r = ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: carregar, webgl: () => false });
    expect(carregar).not.toHaveBeenCalled();
    expect(tela().dataset.cenarioDesenho).toBe('2d');
    r.desligar();
  });

  it('os passos vêm do Ticker do Pixi; parados com reduzir movimento, alto contraste ou pausa', async () => {
    const f = pixiFalso();
    const r = ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: f.carregar, webgl: () => true });
    await montado(f);
    expect(f.opcoes.podeAndar()).toBe(true);
    const antes = r.modulos().map((m) => m.vila.passos);
    expect(f.passo()).toBe(true);
    r.modulos().forEach((m, i) => expect(m.vila.passos).toBe(antes[i] + (m.bloqueado ? 0 : 1)));
    for (const preparar of [
      () => document.documentElement.classList.add('cenario-pausado'),
      () => document.documentElement.classList.add('a11y-sem-movimento'),
      () => { document.documentElement.dataset.tema = 'alto-contraste'; },
    ]) {
      preparar();
      expect(f.opcoes.podeAndar()).toBe(false);
      document.documentElement.classList.remove('cenario-pausado', 'a11y-sem-movimento');
      delete document.documentElement.dataset.tema;
    }
    document.documentElement.dataset.tema = 'alto-contraste';
    expect(f.opcoes.contorno()).toBeTruthy();
    r.desligar();
  });
});

describe('vila viva', () => {
  it('um exercício a mais desde o último desenho: a vila comemora e a casa nova aparece crescendo', async () => {
    const camada = document.querySelector('.cenario');
    camada.dataset.feitos = '0';
    const f1 = pixiFalso();
    ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: f1.carregar, webgl: () => true }).desligar();
    await esperar(); await esperar();
    const f2 = pixiFalso();
    const r1 = ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: f2.carregar, webgl: () => true });
    await montado(f2);
    r1.desligar();
    camada.dataset.feitos = '1'; // o 1º exercício resolvido dá uma casa
    const f3 = pixiFalso();
    const r2 = ligarCenarios(tela(), { janela: janelaFalsa(), carregarPixi: f3.carregar, webgl: () => true });
    await montado(f3);
    const mod = r2.modulos()[0];
    expect(f3.agitado).toBe(1);
    expect(mod.vila.moradores.filter((m) => m.visivel).every((m) => m.salto)).toBe(true);
    expect(mod.novaCasa).toEqual(mod.plano.casas.at(-1));
    expect(mod.baloes.querySelectorAll('.balao-vila').length).toBeGreaterThan(0);
    r2.desligar();
    camada.dataset.feitos = '0';
  });

  it('com reduzir movimento, nada de comemoração automática', async () => {
    const camada = document.querySelector('.cenario');
    camada.dataset.feitos = '0';
    ligarCenarios(tela(), { janela: janelaFalsa(), webgl: () => false }).desligar();
    document.documentElement.classList.add('a11y-sem-movimento');
    camada.dataset.feitos = '2';
    const r = ligarCenarios(tela(), { janela: janelaFalsa(), webgl: () => false });
    expect(r.modulos()[0].baloes.children).toHaveLength(0);
    expect(r.modulos()[0].vila.moradores.some((m) => m.salto)).toBe(false);
    r.desligar();
    camada.dataset.feitos = '0';
  });

  it('clicar num personagem mostra a fala dele por cima da trilha e avisa o leitor de tela', () => {
    const r = ligarCenarios(tela(), { janela: janelaFalsa(), webgl: () => false });
    const mod = r.modulos()[0];
    const m = mod.vila.moradores.find((x) => x.visivel);
    const secao = mod.camada.parentElement;
    const alvo = secao.querySelector('.trilha');
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: mod.plano.esquerdaDoMundo + m.c * TILE + 16, clientY: m.l * TILE + 16 }));
    const fala = secao.querySelector('.fala-vila');
    expect(fala).not.toBeNull();
    expect(fala.getAttribute('aria-hidden')).toBe('true');
    expect(FALAS_DA_VILA[m.id].falas).toContain(fala.textContent);
    // Clique num nó do caminho não procura personagem.
    fala.remove();
    secao.querySelector('.no .alvo').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }));
    expect(secao.querySelector('.fala-vila')).toBeNull();
    r.desligar();
  });

  it('as falas giram entre as do morador, começando por uma escolhida pela semente', () => {
    const [id, { falas }] = Object.entries(FALAS_DA_VILA).find(([, info]) => info.falas.length > 1);
    const ditas = Array.from({ length: falas.length }, () => falaDoMorador(id, 'teste').fala);
    expect(new Set(ditas).size).toBe(falas.length);
    expect(falaDoMorador('ninguem')).toBeNull();
  });
});

describe('onde a fala aparece', () => {
  const base = { largura: 200, altura: 60, larguraSecao: 700 };
  const sobrepoe = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('sem nada em volta, fica logo acima do personagem, centralizada', () => {
    expect(posicaoDaFala({ ...base, alvo: { x: 300, y: 400 }, obstaculos: [] })).toEqual({ x: 200, y: 336 });
  });

  it('nunca cobre o ícone, a legenda nem o balão de uma fase', () => {
    const icones = [{ x: 260, y: 320, w: 56, h: 56 }, { x: 230, y: 380, w: 140, h: 20 }, { x: 150, y: 250, w: 60, h: 30 }];
    for (let y = 200; y <= 700; y += 37) {
      for (let x = 20; x <= 680; x += 53) {
        const pos = posicaoDaFala({ ...base, alvo: { x, y }, obstaculos: icones });
        if (!pos) continue;
        for (const o of icones) expect(sobrepoe({ ...pos, w: 200, h: 60 }, o), `${x},${y}`).toBe(false);
        expect(pos.x).toBeGreaterThanOrEqual(4);
        expect(pos.x + 200).toBeLessThanOrEqual(696);
      }
    }
  });

  it('se não houver lugar livre, não mostra (a fala fica no leitor de tela e na lista)', () => {
    expect(posicaoDaFala({ ...base, alvo: { x: 300, y: 400 }, obstaculos: [{ x: 0, y: 0, w: 700, h: 2000 }] })).toBeNull();
  });
});

describe('falas e "Conhecer a vila"', () => {
  it('todo personagem de todo cenário tem nome e falas curtas, sem resposta de exercício', () => {
    for (const cen of Object.values(CENARIOS)) {
      expect(EMOJIS_DA_CONVERSA[cen.id], cen.id).toBeTruthy();
      for (const p of cen.personagens) {
        const info = FALAS_DA_VILA[p.id];
        expect(info, p.id).toBeTruthy();
        expect(info.falas.length).toBeGreaterThan(0);
        for (const fala of info.falas) {
          expect(fala.length, fala).toBeLessThanOrEqual(140);
          // Uma definição para revisar: "Termo: o que é".
          expect(fala, fala).toMatch(/^[^:]{2,40}: \S.+\.$/);
          expect(fala).not.toMatch(/gabarito|resposta (é|certa)|validador|validação|solução/i);
        }
      }
    }
  });

  it('a lista de cada módulo traz todas as definições dos moradores e o quanto a vila cresceu', () => {
    // Um cenário com pessoas e animais (qualquer site tem).
    const cen = Object.values(CENARIOS).find((c) => c.personagens.some((p) => p.tipo === 'pessoa') && c.personagens.some((p) => p.tipo !== 'pessoa'));
    const html = htmlConhecerVila(cen.id, 'modulo', 7);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="vila-modulo"');
    expect(html).toContain('hidden');
    for (const p of cen.personagens) for (const fala of FALAS_DA_VILA[p.id].falas) expect(html).toContain(fala.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
    expect(html).toContain('3 casas, 2 crianças e 2 filhotes');
    expect(htmlConhecerVila(cen.id, 'x', 0)).toContain('A cada exercício resolvido');
    expect(htmlConhecerVila('nenhum', 'x')).toBe('');
    expect(contarDaVila({ personagens: [{ tipo: 'animal' }] }, 3)).toEqual({ casas: 1, filhos: 0, filhotes: 2 });
  });

  it('na trilha: o botão abre e fecha a lista; a pausa fica lembrada e para o cenário', () => {
    renderInicio(tela());
    const botao = tela().querySelector('.btn-vila');
    const lista = document.getElementById(botao.getAttribute('aria-controls'));
    expect(lista.hidden).toBe(true);
    botao.click();
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(lista.hidden).toBe(false);
    botao.click();
    expect(lista.hidden).toBe(true);

    const pausa = tela().querySelector('.btn-pausar-cenario');
    expect(pausa.getAttribute('aria-pressed')).toBe('false');
    pausa.click();
    expect(pausa.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.classList.contains('cenario-pausado')).toBe(true);
    renderInicio(tela()); // lembrada: continua pausado
    expect(tela().querySelector('.btn-pausar-cenario').getAttribute('aria-pressed')).toBe('true');
    tela().querySelector('.btn-pausar-cenario').click();
    expect(document.documentElement.classList.contains('cenario-pausado')).toBe(false);
  });
});

describe('atlas', () => {
  it('cada quadro tem um lugar na folha, e a folha cabe todos', () => {
    for (const cen of Object.values(CENARIOS)) {
      const quadros = quadrosDoAtlas(cen);
      const nomes = quadros.map((q) => q.nome);
      expect(new Set(nomes).size).toBe(nomes.length);
      const { largura, altura } = tamanhoDoAtlas(cen);
      expect(largura).toBe(COLUNAS_DO_ATLAS * TILE);
      const ultimo = posicaoNoAtlas(quadros.length - 1);
      expect(ultimo.y + TILE).toBeLessThanOrEqual(altura);
      for (const p of cen.personagens) expect(nomes).toContain(`per-${p.id}-0`);
    }
  });

  it('as camadas do tile: chão com objeto ou casa por cima, e a borda da água nos lados que tocam a terra', () => {
    const tiles = ['chao', 'objeto', 'casa', 'estrada', 'bloqueio', 'bloqueio'].map((tipo) => ({ tipo, variante: 0 }));
    const mapa = { colunas: 6, linhas: 1, tiles, estrada: [[3, 3]] };
    expect(camadasDoTile(mapa, 0, 0)[0]).toMatch(/^chao-0-\d$/);
    expect(camadasDoTile(mapa, 1, 0)[1]).toBe('objeto-0');
    expect(camadasDoTile(mapa, 2, 0)[1]).toBe('casa');
    expect(camadasDoTile(mapa, 3, 0)[0]).toMatch(/^estrada-\d$/);
    // Água em (4,0): em cima, embaixo e à esquerda é terra (1 + 2 + 4); à direita, mais água.
    expect(camadasDoTile(mapa, 4, 0)[0]).toMatch(/^bloqueio-7-\d$/);
    expect(camadasDoTile(mapa, 5, 0)[0]).toMatch(/^bloqueio-(1[1])-\d$/); // 1 + 2 + 8
  });
});
