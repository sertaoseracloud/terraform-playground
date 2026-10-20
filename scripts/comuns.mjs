// Arquivos comuns aos quatro playgrounds (php, terraform, python e kubernetes).
//
// comuns.json guarda a lista dos arquivos que precisam ser iguais nos quatro repositórios e o
// SHA-256 de cada um (com finais de linha LF). Cada repositório é um site independente no GitHub
// Pages, então não há pacote compartilhado: a cópia é feita por este script e conferida no CI.
//
//   node scripts/comuns.mjs                  confere os arquivos contra a lista (CI, job qualidade)
//   node scripts/comuns.mjs atualizar        recalcula os hashes depois de mudar um arquivo comum
//   node scripts/comuns.mjs copiar <dir>...  copia os arquivos comuns daqui para outros repositórios
//                                            e atualiza a lista de cada um
//   node scripts/comuns.mjs comparar         compara com o comuns.json do develop dos outros três
//                                            (auditoria semanal)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LISTA = 'comuns.json';

const lerTexto = (raiz, arquivo) => readFileSync(join(raiz, arquivo), 'utf8').replace(/\r\n/g, '\n');
export const hashDe = (texto) => createHash('sha256').update(texto.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
const lerLista = (raiz) => JSON.parse(readFileSync(join(raiz, LISTA), 'utf8'));
const gravarLista = (raiz, lista) => writeFileSync(join(raiz, LISTA), `${JSON.stringify(lista, null, 2)}\n`);

/** Arquivos da lista que estão diferentes (ou faltando) neste repositório. */
export function divergentes(raiz = RAIZ) {
  const { arquivos } = lerLista(raiz);
  return Object.entries(arquivos).flatMap(([arquivo, hash]) => {
    if (!existsSync(join(raiz, arquivo))) return [{ arquivo, motivo: 'faltando' }];
    return hashDe(lerTexto(raiz, arquivo)) === hash ? [] : [{ arquivo, motivo: 'diferente' }];
  });
}

function atualizar(raiz = RAIZ) {
  const lista = lerLista(raiz);
  for (const arquivo of Object.keys(lista.arquivos)) lista.arquivos[arquivo] = hashDe(lerTexto(raiz, arquivo));
  gravarLista(raiz, lista);
}

function verificar() {
  const erros = divergentes();
  if (!erros.length) {
    console.log(`Arquivos comuns em dia (${Object.keys(lerLista(RAIZ).arquivos).length}).`);
    return;
  }
  for (const { arquivo, motivo } of erros) console.error(`  ${motivo}: ${arquivo}`);
  console.error(`\n${erros.length} arquivo(s) comum(ns) mudaram sem atualizar ${LISTA}.`);
  console.error('Leve a mesma mudança aos outros playgrounds: npm run comuns:copiar -- ../outro-repo ...');
  console.error('Se a mudança é só deste repositório, tire o arquivo da lista em comuns.json.');
  process.exitCode = 1;
}

function copiar(destinos) {
  if (!destinos.length) throw new Error('Diga para onde copiar: npm run comuns:copiar -- ../terraform-playground');
  atualizar();
  const lista = lerLista(RAIZ);
  for (const destino of destinos.map((d) => resolve(d))) {
    for (const arquivo of Object.keys(lista.arquivos)) {
      mkdirSync(dirname(join(destino, arquivo)), { recursive: true });
      writeFileSync(join(destino, arquivo), lerTexto(RAIZ, arquivo));
    }
    gravarLista(destino, lista);
    console.log(`${Object.keys(lista.arquivos).length} arquivos copiados para ${destino}`);
  }
}

async function comparar() {
  const lista = lerLista(RAIZ);
  const { name } = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  let diferencas = 0;
  for (const repo of lista.repositorios.filter((r) => !r.endsWith(`/${name}`))) {
    const url = `https://raw.githubusercontent.com/${repo}/develop/${LISTA}`;
    const resposta = await fetch(url);
    if (!resposta.ok) {
      console.log(`${repo}: sem ${LISTA} no develop (${resposta.status})`);
      diferencas++;
      continue;
    }
    const outra = await resposta.json();
    const nomes = new Set([...Object.keys(lista.arquivos), ...Object.keys(outra.arquivos)]);
    const fora = [...nomes].filter((n) => lista.arquivos[n] !== outra.arquivos[n]);
    diferencas += fora.length;
    console.log(`${repo}: ${fora.length ? `${fora.length} diferente(s)\n  ${fora.join('\n  ')}` : 'igual'}`);
  }
  if (diferencas) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [comando = 'verificar', ...resto] = process.argv.slice(2);
  const acoes = { verificar, atualizar: () => atualizar(), copiar: () => copiar(resto), comparar };
  if (!acoes[comando]) throw new Error(`Comando desconhecido: ${comando}. Use verificar, atualizar, copiar ou comparar.`);
  await acoes[comando]();
}
