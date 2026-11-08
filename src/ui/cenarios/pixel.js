// Pixel art dos cenários, no estilo de RPG clássico: cada sprite tem 16×16 pixels, escritos
// como 16 linhas de 16 letras (cada letra é uma cor da paleta; "." é transparente), e é
// desenhado ampliado, sem suavização.
export const LADO = 16;

/** Cria um sprite a partir do texto (16 linhas × 16 letras); avisa se o desenho estiver errado. */
export function sprite(paleta, texto) {
  const linhas = texto.trim().split('\n').map((l) => l.trim());
  if (linhas.length !== LADO || linhas.some((l) => l.length !== LADO)) throw new Error('o sprite precisa ser 16×16');
  for (const linha of linhas) {
    for (const ch of linha) if (ch !== '.' && !(ch in paleta)) throw new Error(`a cor "${ch}" está fora da paleta`);
  }
  return { paleta, linhas };
}

/**
 * O 2º quadro da animação: quem anda ou nada mexe as pernas (as 4 últimas linhas deslizam 1px,
 * alternando para um lado e para o outro); quem voa ou salta bate as asas (linhas 4 a 9 sobem 1px).
 */
export function passo(s, movimento) {
  const linhas = [...s.linhas];
  if (movimento === 'voar' || movimento === 'saltar') {
    for (let i = 3; i <= 9; i++) linhas[i] = s.linhas[i + 1];
  } else {
    for (let i = LADO - 4; i < LADO; i++) {
      linhas[i] = i % 2 ? `.${s.linhas[i].slice(0, -1)}` : `${s.linhas[i].slice(1)}.`;
    }
  }
  return { paleta: s.paleta, linhas };
}

/** Desenha o sprite no canvas, ampliado (e espelhado, para olhar para a esquerda). */
export function desenharSprite(ctx, s, x, y, { escala = 2, espelhar = false, cor } = {}) {
  for (let i = 0; i < LADO; i++) {
    for (let j = 0; j < LADO; j++) {
      const ch = s.linhas[i][espelhar ? LADO - 1 - j : j];
      if (ch === '.') continue;
      ctx.fillStyle = cor ?? s.paleta[ch];
      ctx.fillRect(x + j * escala, y + i * escala, escala, escala);
    }
  }
}

/** Mistura duas cores #rrggbb: `t` = 0 dá a primeira, 1 dá a segunda. */
export function misturar(a, b, t) {
  const canal = (cor, i) => parseInt(cor.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => Math.round(canal(a, i) * (1 - t) + canal(b, i) * t).toString(16).padStart(2, '0')).join('')}`;
}
