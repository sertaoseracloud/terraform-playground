// Física dos personagens (funções puras): um tile por passo, nas 4 direções, como em RPG clássico.
// Quem anda fica no chão; quem nada ou salta (jangadeiro, peixe) fica na água; quem voa passa
// por cima de tudo. Ninguém entra na estrada, para nunca cobrir um nó do caminho.
import { tileEm } from './mapa.js';

const DIRECOES = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export function podePisar(mapa, movimento, c, l) {
  const t = tileEm(mapa, c, l);
  if (!t || t.tipo === 'estrada') return false;
  if (movimento === 'voar') return true;
  if (movimento === 'nadar' || movimento === 'saltar') return t.tipo === 'bloqueio';
  return t.tipo === 'chao';
}

function embaralhar(lista, sortear) {
  const r = [...lista];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** O próximo passo: às vezes fica parado; senão segue reto (quase sempre) ou vira. */
export function proximoPasso(p, mapa, sortear) {
  if (sortear() < 0.2) return { ...p, parado: true };
  const outras = embaralhar(DIRECOES, sortear);
  const opcoes = p.direcao && sortear() < 0.7 ? [p.direcao, ...outras] : outras;
  for (const [dc, dl] of opcoes) {
    if (podePisar(mapa, p.movimento, p.c + dc, p.l + dl)) {
      return { ...p, c: p.c + dc, l: p.l + dl, direcao: [dc, dl], quadro: 1 - p.quadro, parado: false };
    }
  }
  return { ...p, parado: true };
}

/**
 * Onde cada personagem começa: os pares à esquerda da estrada da linha, os ímpares à direita. Sem
 * lugar do seu lado (toda a água do outro lado, para quem nada ou salta), tenta o outro.
 */
export function posicoesIniciais(mapa, personagens, sortear) {
  return personagens.map((per, i) => {
    for (let tentativa = 0; tentativa < 400; tentativa++) {
      const l = Math.floor(sortear() * mapa.linhas);
      const [primeira, ultima] = mapa.estrada[l];
      const direita = (i + (tentativa >= 200 ? 1 : 0)) % 2 === 1;
      const [de, ate] = direita ? [ultima + 1, mapa.colunas - 1] : [0, primeira - 1];
      if (ate < de) continue;
      const c = de + Math.floor(sortear() * (ate - de + 1));
      if (podePisar(mapa, per.movimento, c, l)) return { c, l, movimento: per.movimento, direcao: null, quadro: 0, parado: true };
    }
    return null;
  });
}
