// A vila de um módulo (funções puras): cada exercício resolvido acrescenta, em ciclo, uma casa,
// um filho de uma pessoa e um filhote de um animal do cenário. Nada é gravado: a vila sai da
// semente do módulo e do número de exercícios feitos, e a de n + 1 contém a de n.
import { sorteador, tileEm } from './mapa.js';

/** O limite de personagens é proporcional ao espaço: tantos por tela de altura do módulo. */
export const PERSONAGENS_POR_TELA = { normal: 10, celular: 4 };
const CICLO = ['casa', 'filho', 'filhote'];

/** Onde dá para construir: chão a até 3 tiles da estrada, embaralhado uma vez pela semente. */
export function lugaresDeCasa(mapa, semente) {
  const lista = [];
  for (let l = 0; l < mapa.linhas; l++) {
    const [de, ate] = mapa.estrada[l];
    for (let c = 0; c < mapa.colunas; c++) {
      const distancia = c < de ? de - c : c > ate ? c - ate : 0;
      if (distancia >= 1 && distancia <= 3 && tileEm(mapa, c, l).tipo === 'chao') lista.push([c, l]);
    }
  }
  const sortear = sorteador(`${semente}-vila`);
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(sortear() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

export function vila({ mapa, cenario, semente, feitos }) {
  const pessoas = cenario.personagens.filter((p) => p.tipo === 'pessoa');
  const animais = cenario.personagens.filter((p) => p.tipo !== 'pessoa');
  const candidatas = lugaresDeCasa(mapa, semente);
  const ocupadas = new Set();
  const temVizinha = (c, l) => [-1, 0, 1].some((dc) => [-1, 0, 1].some((dl) => ocupadas.has(`${c + dc},${l + dl}`)));
  const casas = [];
  const filhos = [];
  const filhotes = [];
  let proxima = 0;
  for (let i = 0; i < feitos; i++) {
    const passo = CICLO[i % CICLO.length];
    if (passo === 'casa') {
      while (proxima < candidatas.length && temVizinha(...candidatas[proxima])) proxima++;
      if (proxima < candidatas.length) {
        const [c, l] = candidatas[proxima++];
        ocupadas.add(`${c},${l}`);
        casas.push({ c, l });
      }
      continue;
    }
    // Sem pessoa no cenário, o filho vira filhote; sem animal, o filhote vira filho.
    const filho = passo === 'filho' ? pessoas.length > 0 : animais.length === 0;
    if (filho && pessoas.length) filhos.push({ pai: pessoas[filhos.length % pessoas.length].id });
    else if (animais.length) filhotes.push({ mae: animais[filhotes.length % animais.length].id });
  }
  return { casas, filhos, filhotes };
}

/** O mapa com as casas no lugar (um mapa novo: o de entrada não muda). */
export function comCasas(mapa, casas) {
  const tiles = [...mapa.tiles];
  for (const { c, l } of casas) tiles[l * mapa.colunas + c] = { tipo: 'casa', variante: 0 };
  return { ...mapa, tiles };
}
