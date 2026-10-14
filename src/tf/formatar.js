// terraform fmt: o estilo canônico do HCL. Só mexe em espaços: recuo de 2 por nível,
// um espaço em volta do = dos atributos (alinhados quando seguidos), um espaço antes do {
// dos blocos, sem espaços no fim da linha e uma quebra de linha no fim do arquivo.
// O conteúdo de strings, heredocs e comentários de bloco fica como está.

const ATRIBUTO = /^([A-Za-z_][\w-]*|"(?:[^"\\]|\\.)*")\s*=(?!=)\s*(.*)$/;

/** Percorre uma linha fora de strings e comentários: quanto o nível muda, heredoc, comentário de bloco. */
function analisar(texto) {
  let delta = 0;
  let heredoc = null;
  let blocoAberto = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      // string com escapes e interpolações ${ ... } (que podem ter chaves e strings dentro)
      let interp = 0;
      for (i++; i < texto.length; i++) {
        const d = texto[i];
        if (d === '\\') { i++; continue; }
        if (interp === 0 && d === '"') break;
        if ((d === '$' || d === '%') && texto[i + 1] === '{') { interp++; i++; continue; }
        if (interp > 0 && d === '{') interp++;
        else if (interp > 0 && d === '}') interp--;
      }
      continue;
    }
    if (c === '#' || (c === '/' && texto[i + 1] === '/')) break;
    if (c === '/' && texto[i + 1] === '*') {
      const fim = texto.indexOf('*/', i + 2);
      if (fim === -1) { blocoAberto = true; break; }
      i = fim + 1;
      continue;
    }
    if (c === '<' && texto[i + 1] === '<') {
      const m = texto.slice(i).match(/^<<-?([A-Za-z_]\w*)\s*$/);
      if (m) { heredoc = m[1]; break; }
    }
    if ('{[('.includes(c)) delta++;
    else if ('}])'.includes(c)) delta--;
  }
  return { delta, heredoc, blocoAberto };
}

/** O texto formatado no estilo do `terraform fmt`. */
export function formatarHcl(fonte) {
  const entrada = fonte.replace(/\r\n?/g, '\n').split('\n');
  const linhas = []; // { texto, nivel, chave?, resto?, alinha }
  // Como no hclwrite: cada linha que abre colchetes empilha UM nível (mesmo "({"), e o
  // fechamento consome os colchetes daquela linha antes de voltar o nível.
  const pilha = [];
  const fechar = (n) => {
    while (n > 0 && pilha.length) {
      const tira = Math.min(pilha.at(-1), n);
      pilha[pilha.length - 1] -= tira;
      n -= tira;
      if (!pilha.at(-1)) pilha.pop();
    }
  };
  let heredoc = null;
  let comentarioBloco = false;
  for (const original of entrada) {
    if (heredoc) {
      // O heredoc é parte da linha do atributo: não quebra o grupo de alinhamento.
      linhas.push({ texto: original, literal: true, heredoc: true });
      if (original.trim() === heredoc) heredoc = null;
      continue;
    }
    if (comentarioBloco) {
      linhas.push({ texto: original.trimEnd(), literal: true });
      if (original.includes('*/')) comentarioBloco = false;
      continue;
    }
    const t = original.trim();
    if (!t) {
      linhas.push({ texto: '', vazia: true });
      continue;
    }
    const info = analisar(t);
    // A linha que começa fechando ("}", "]", "})") fica no nível de fora.
    let fechando = 0;
    while (fechando < t.length && '}])'.includes(t[fechando])) fechando++;
    fechar(fechando);
    const recuo = pilha.length;
    const atributo = t.match(ATRIBUTO);
    let texto = t;
    let chave = null;
    let resto = null;
    if (atributo) {
      [, chave, resto] = atributo;
      texto = `${chave} = ${resto}`;
    } else if (/\S\s*\{$/.test(t) && !/^[}\])]/.test(t)) {
      texto = t.replace(/\s*\{$/, ' {'); // resource "a" "b"{ → resource "a" "b" {
    }
    // Só alinha atributo cujo valor não abre bloco nem lista (o heredoc conta como uma linha).
    const alinha = Boolean(atributo) && info.delta === 0 && !info.blocoAberto;
    linhas.push({ texto, nivel: recuo, chave, resto, alinha });
    const resto2 = info.delta + fechando; // o que sobra depois dos fechamentos do começo da linha
    if (resto2 > 0) pilha.push(resto2);
    else fechar(-resto2);
    heredoc = info.heredoc;
    comentarioBloco = info.blocoAberto;
  }

  // Grupos de atributos seguidos no mesmo nível: o = fica na mesma coluna.
  for (let i = 0; i < linhas.length;) {
    if (!linhas[i].alinha) { i++; continue; }
    let j = i;
    while (j < linhas.length && (linhas[j].heredoc || (linhas[j].alinha && linhas[j].nivel === linhas[i].nivel))) j++;
    const grupo = linhas.slice(i, j).filter((l) => l.alinha);
    const largura = Math.max(...grupo.map((l) => l.chave.length));
    for (const l of grupo) l.texto = `${l.chave.padEnd(largura)} = ${l.resto}`;
    i = j;
  }

  const saida = linhas.map((l) => (l.literal || l.vazia ? l.texto : `${'  '.repeat(l.nivel)}${l.texto}`.trimEnd()));
  while (saida.length && saida.at(-1) === '') saida.pop();
  return saida.length ? `${saida.join('\n')}\n` : '';
}

/** As diferenças linha a linha (como o `terraform fmt -diff`), num bloco só. */
export function diferencaDeLinhas(nome, antes, depois) {
  const a = antes.replace(/\n$/, '').split('\n');
  const b = depois.replace(/\n$/, '').split('\n');
  // Maior subsequência comum (os arquivos do exercício são pequenos).
  const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) m[i][j] = a[i] === b[j] ? m[i + 1][j + 1] + 1 : Math.max(m[i + 1][j], m[i][j + 1]);
  }
  const linhas = [`--- old/${nome}`, `+++ new/${nome}`, `@@ -1,${a.length} +1,${b.length} @@`];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      linhas.push(` ${a[i]}`);
      i++;
      j++;
    } else if (i < a.length && (j >= b.length || m[i + 1][j] >= m[i][j + 1])) {
      linhas.push(`-${a[i]}`);
      i++;
    } else {
      linhas.push(`+${b[j]}`);
      j++;
    }
  }
  return linhas;
}
