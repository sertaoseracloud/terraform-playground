// Texto da release do GitHub a partir de src/novidades.js (o mesmo da página #/novidades).
//
//   node scripts/notas-release.mjs 1.2.3            corpo em Markdown
//   node scripts/notas-release.mjs 1.2.3 --titulo   só o título ("v1.2.3 · Título")
//
// src/novidades.js importa o histórico do git por um módulo virtual do Vite, então aqui o
// arquivo é lido como texto e só a lista RELEASES (dados puros) é avaliada.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function lerReleases(texto = readFileSync(resolve(RAIZ, 'src/novidades.js'), 'utf8')) {
  const inicio = texto.indexOf('export const RELEASES = [');
  if (inicio < 0) throw new Error('RELEASES não encontrado em src/novidades.js');
  const abre = texto.indexOf('[', inicio);
  let profundidade = 0;
  let fim = abre;
  for (; fim < texto.length; fim++) {
    if (texto[fim] === '[') profundidade++;
    else if (texto[fim] === ']' && --profundidade === 0) break;
  }
  return new Function(`return ${texto.slice(abre, fim + 1)};`)();
}

export function notas(release) {
  const grupos = (release.grupos ?? []).map((g) => `### ${g.titulo}\n${g.itens.map((i) => `- ${i}`).join('\n')}`);
  return [`## ${release.titulo}`, release.resumo, ...grupos].filter(Boolean).join('\n\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [versao, opcao] = process.argv.slice(2);
  const release = lerReleases().find((r) => r.versao === versao);
  if (!release) throw new Error(`A versão ${versao} não está em src/novidades.js`);
  console.log(opcao === '--titulo' ? `v${release.versao} · ${release.titulo}` : notas(release));
}
