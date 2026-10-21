// A vida da vila (funções puras): cada morador escolhe um destino (a porta da casa, a praça perto do
// passo atual, um nó do caminho) e vai até ele por um caminho de tiles; no caminho, cumprimenta quem
// cruza, conversa, senta perto de um objeto, entra e sai de casa. Filhotes seguem os donos. Nada é
// gravado: o estado sai da semente do módulo, dos exercícios feitos e dos passos dados.
import { sorteador, tileEm } from './mapa.js';
import { podePisar, proximoPasso } from './fisica.js';

export const BALOES = { oi: '👋', festa: '🎉', casa: '🏠' };
/** Passos (de 0,4 s) que um balão fica na tela: nunca menos de 2, então nada pisca. */
export const DURACAO_BALAO = { cumprimentar: 2, conversar: 3, acenar: 2, comemorar: 2 };
/** Depois de um balão, o morador espera estes passos para mostrar outro (o aceno: 4 s). */
const ESPERA = { cumprimentar: 20, conversar: 20, acenar: 10 };
const LIMITE_BUSCA = 2500;
const ALCANCE_DESTINO = 18;
const VIZINHOS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/**
 * O caminho mais curto (busca em largura) de `de` até `para`, só por tiles em que `movimento`
 * pode pisar. Devolve a lista de tiles depois do ponto de partida ([] se já está lá) ou null.
 */
export function caminho(mapa, movimento, de, para, limite = LIMITE_BUSCA) {
  const chave = (c, l) => l * mapa.colunas + c;
  if (de[0] === para[0] && de[1] === para[1]) return [];
  if (!podePisar(mapa, movimento, para[0], para[1])) return null;
  const veio = new Map([[chave(...de), -1]]);
  const fila = [de];
  for (let k = 0; k < fila.length && veio.size <= limite; k++) {
    const [c, l] = fila[k];
    for (const [dc, dl] of VIZINHOS) {
      const [nc, nl] = [c + dc, l + dl];
      const n = chave(nc, nl);
      if (veio.has(n) || !podePisar(mapa, movimento, nc, nl)) continue;
      veio.set(n, chave(c, l));
      if (nc === para[0] && nl === para[1]) {
        const rota = [];
        for (let x = n; x !== chave(...de); x = veio.get(x)) rota.unshift([x % mapa.colunas, Math.floor(x / mapa.colunas)]);
        return rota;
      }
      fila.push([nc, nl]);
    }
  }
  return null;
}

/** Um tile de chão ao lado da estrada na linha `l` (perto de um nó), ou null. */
function beiraDaEstrada(mapa, l) {
  const linha = Math.max(0, Math.min(mapa.linhas - 1, Math.round(l)));
  const [de, ate] = mapa.estrada[linha];
  for (const c of [de - 1, ate + 1, de - 2, ate + 2]) if (podePisar(mapa, 'andar', c, linha)) return [c, linha];
  return null;
}

/**
 * Os destinos do módulo: a porta de cada casa (o chão vizinho), a praça (ao lado do passo atual,
 * se ele está neste módulo) e os nós (ao lado de cada um; os concluídos primeiro).
 */
export function destinosDoModulo(mapa, casas = [], nos = []) {
  const portas = casas.map(({ c, l }) => {
    const porta = [[0, 1], [-1, 0], [1, 0], [0, -1]].map(([dc, dl]) => [c + dc, l + dl]).find(([x, y]) => podePisar(mapa, 'andar', x, y));
    return porta ? { casa: [c, l], porta } : null;
  }).filter(Boolean);
  const atual = nos.find((n) => n.atual);
  const praca = atual ? beiraDaEstrada(mapa, atual.l) : null;
  const ordem = [...nos.filter((n) => n.feito), ...nos.filter((n) => !n.feito)];
  return { portas, praca, nos: ordem.map((n) => beiraDaEstrada(mapa, n.l)).filter(Boolean) };
}

/**
 * Cria os moradores a partir das definições e das posições iniciais (planejar() do palco). Os
 * pequenos (filhos e filhotes) seguem o primeiro adulto da mesma espécie; o primeiro adulto que
 * anda é o anfitrião, que vai até a praça acenar.
 */
export function criarVila({ mapa, defs, posicoes, semente, destinos, emojis = ['💬'] }) {
  const moradores = [];
  posicoes.forEach((p, i) => {
    if (!p) return;
    const def = defs[i];
    moradores.push({
      i, def, id: def.id, movimento: def.movimento, tipo: def.tipo, pequeno: Boolean(def.pequeno),
      c: p.c, l: p.l, de: [p.c, p.l], quadro: 0, olhaEsquerda: false, direcao: null, parado: true,
      acao: 'parado', resta: 0, rota: [], alvo: null, balao: null, espera: 0, visivel: true, salto: false,
      dono: null, sortear: sorteador(`${semente}-morador-${i}`),
    });
  });
  for (const m of moradores) {
    if (!m.pequeno) continue;
    const dono = moradores.find((x) => !x.pequeno && x.id === m.id);
    m.dono = dono?.i ?? null;
    // Nasce perto do dono (do mesmo lado da estrada), no tile livre mais próximo.
    const perto = dono && mapa ? tileLivrePerto(mapa, m.movimento, dono, moradores) : null;
    if (perto) [m.c, m.l] = perto;
    m.de = [m.c, m.l];
  }
  const anfitriao = moradores.find((m) => !m.pequeno && m.movimento === 'andar' && m.tipo === 'pessoa');
  return { moradores, destinos, emojis, passos: 0, anfitriao: anfitriao?.i ?? null };
}

function tileLivrePerto(mapa, movimento, alvo, moradores) {
  for (let raio = 1; raio <= 4; raio++) {
    for (let dl = -raio; dl <= raio; dl++) {
      for (const dc of [raio - Math.abs(dl), -(raio - Math.abs(dl))]) {
        const [c, l] = [alvo.c + dc, alvo.l + dl];
        if (!podePisar(mapa, movimento, c, l) || moradores.some((o) => o.c === c && o.l === l)) continue;
        if (caminho(mapa, movimento, [c, l], [alvo.c, alvo.l], 200)) return [c, l];
      }
    }
  }
  return null;
}

const porIndice = (vila, i) => vila.moradores.find((m) => m.i === i);
const distancia = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.l - b.l);

function falar(m, acao, emoji, eventos) {
  m.acao = acao;
  m.resta = DURACAO_BALAO[acao];
  m.balao = emoji;
  m.espera = ESPERA[acao] ?? 0;
  m.rota = [];
  eventos.push({ tipo: 'balao', i: m.i, emoji, passos: m.resta });
}

/** Vai para `[c, l]` (vizinho): vira para o lado certo e troca o quadro da caminhada. */
function mover(m, [c, l]) {
  const direcao = [c - m.c, l - m.l];
  m.de = [m.c, m.l];
  m.c = c;
  m.l = l;
  m.direcao = direcao;
  if (direcao[0]) m.olhaEsquerda = direcao[0] < 0;
  m.quadro = 1 - m.quadro;
  m.parado = false;
}

/** Os destinos possíveis agora, do mais desejado ao menos: quem chama tenta um por um. */
function candidatos(vila, m, noite) {
  const { portas, praca, nos } = vila.destinos;
  const perto = (t) => t && Math.abs(t[1] - m.l) <= ALCANCE_DESTINO;
  const minhasPortas = portas.filter((p) => perto(p.porta)).map((p) => ({ tile: p.porta, casa: true }));
  // A noite: metade das pessoas vai para casa e fica lá.
  if (noite && m.tipo === 'pessoa' && m.i % 2 === 1 && minhasPortas.length) return minhasPortas;
  if (m.i === vila.anfitriao && perto(praca) && m.espera === 0 && m.sortear() < 0.5) return [{ tile: praca, acenar: true }];
  const opcoes = [...minhasPortas, ...nos.filter(perto).slice(0, 4).map((tile) => ({ tile }))];
  for (let i = opcoes.length - 1; i > 0; i--) {
    const j = Math.floor(m.sortear() * (i + 1));
    [opcoes[i], opcoes[j]] = [opcoes[j], opcoes[i]];
  }
  return opcoes.slice(0, 3);
}

function aoLadoDeObjeto(mapa, m) {
  return VIZINHOS.some(([dc, dl]) => tileEm(mapa, m.c + dc, m.l + dl)?.tipo === 'objeto');
}

/**
 * Um passo da vila (0,4 s): cada morador continua o que faz, anda um tile da rota ou escolhe outra
 * coisa. Devolve os eventos (balões novos) para quem desenha. `ativos(m)` diz quem pode andar agora
 * (o palco deixa parado quem está longe da tela).
 */
export function passoDaVila(vila, mapa, { noite = false, ativos = () => true } = {}) {
  vila.passos += 1;
  const eventos = [];
  // Os pequenos dividem o tile com os adultos (são metade do tamanho): só adulto bloqueia adulto.
  const ocupado = (c, l, eu) => vila.moradores.some((o) => o !== eu && o.visivel && !o.pequeno && o.c === c && o.l === l);
  for (const m of vila.moradores) {
    if (!ativos(m)) continue;
    m.salto = false;
    m.de = [m.c, m.l];
    m.parado = true;
    if (m.espera > 0) m.espera -= 1;
    if (m.resta > 0) {
      m.resta -= 1;
      if (m.resta > 0) continue;
      if (m.acao === 'em-casa') m.visivel = true;
      m.acao = 'parado';
      m.balao = null;
      continue;
    }
    m.balao = null;

    // Filhote (e filho): fica perto do dono, sem cobrir o tile dele.
    const dono = m.dono !== null ? porIndice(vila, m.dono) : null;
    if (dono) {
      m.rota = [];
      // Dono em casa: espera na porta.
      if (!dono.visivel) { m.acao = 'parado'; continue; }
      if (distancia(m, dono) > 1) {
        const rota = caminho(mapa, m.movimento, [m.c, m.l], [dono.de[0], dono.de[1]], 600);
        const prox = rota?.[0];
        if (prox && !ocupado(prox[0], prox[1], m)) mover(m, prox);
      }
      m.acao = 'seguir';
      continue;
    }

    if (!m.rota.length) {
      const r = m.sortear();
      const vaiLonge = m.movimento === 'andar' && (r < 0.4 || (noite && m.tipo === 'pessoa' && m.i % 2 === 1));
      let achou = false;
      for (const destino of vaiLonge ? candidatos(vila, m, noite) : []) {
        const rota = caminho(mapa, m.movimento, [m.c, m.l], destino.tile);
        if (!rota) continue;
        m.rota = rota;
        m.alvo = destino;
        m.acao = 'andar';
        achou = true;
        break;
      }
      if (achou) { /* segue abaixo, já andando */ } else if (r < 0.55 && aoLadoDeObjeto(mapa, m)) {
        m.acao = 'sentar';
        m.resta = 4 + Math.floor(m.sortear() * 5);
        continue;
      } else if (r < 0.65) {
        m.acao = 'parado';
        m.resta = 1 + Math.floor(m.sortear() * 2);
        continue;
      }
    }

    if (m.rota.length) {
      const prox = m.rota[0];
      if (!podePisar(mapa, m.movimento, prox[0], prox[1])) { m.rota = []; continue; }
      if (ocupado(prox[0], prox[1], m)) {
        // Espera o outro passar; se demorar, desiste e escolhe outra coisa no próximo passo.
        m.esperando = (m.esperando ?? 0) + 1;
        if (m.esperando >= 3) { m.rota = []; m.alvo = null; m.esperando = 0; }
        continue;
      }
      m.esperando = 0;
      m.rota.shift();
      mover(m, prox);
      if (!m.rota.length && m.alvo) {
        const alvo = m.alvo;
        m.alvo = null;
        if (alvo.casa) {
          // Entra em casa: some por alguns passos (a noite toda, para quem mora nela à noite).
          m.acao = 'em-casa';
          m.visivel = false;
          m.resta = noite ? 40 : 5 + Math.floor(m.sortear() * 5);
          continue;
        }
        if (alvo.acenar) falar(m, 'acenar', BALOES.oi, eventos);
      }
    } else {
      // Sem destino: um passo à toa, como antes (a física de sempre).
      const novo = proximoPasso({ ...m, direcao: m.direcao }, mapa, m.sortear);
      if (!novo.parado) mover(m, [novo.c, novo.l]);
      m.acao = 'andar';
    }

    // Encontrou alguém: cumprimenta (👋) ou conversa (um emoji do tema). Só pessoas, com intervalo.
    if (m.tipo !== 'pessoa' || m.espera > 0 || m.balao) continue;
    const outro = vila.moradores.find((o) => o !== m && o.tipo === 'pessoa' && o.visivel && !o.balao && o.espera === 0 && distancia(m, o) === 1);
    if (!outro) continue;
    if (m.sortear() < 0.6) {
      falar(m, 'cumprimentar', BALOES.oi, eventos);
      falar(outro, 'cumprimentar', BALOES.oi, eventos);
    } else {
      const emoji = vila.emojis[Math.floor(m.sortear() * vila.emojis.length)];
      falar(m, 'conversar', emoji, eventos);
      falar(outro, 'conversar', vila.emojis[(vila.emojis.indexOf(emoji) + 1) % vila.emojis.length], eventos);
    }
  }
  return eventos;
}

/** Um exercício foi resolvido: todo mundo que está à vista dá um salto (uma vez só) e comemora. */
export function comemorar(vila) {
  const eventos = [];
  for (const m of vila.moradores) {
    if (!m.visivel) continue;
    m.salto = true;
    m.rota = [];
    if (m.tipo === 'pessoa') falar(m, 'comemorar', BALOES.festa, eventos);
  }
  return eventos;
}
