// Depois do build: a palavra secreta não pode aparecer em nenhum arquivo publicado.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const segredo = process.env.HOMOLOGACAO === '1' ? process.env.CERTIFICADO_SEGREDO_HOMOLOGACAO : process.env.CERTIFICADO_SEGREDO;
if (!segredo) process.exit(0);
const arquivos = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? arquivos(join(d, n)) : [join(d, n)]));
const vazou = arquivos('dist').filter((f) => readFileSync(f).includes(segredo));
if (vazou.length) { console.error('A palavra secreta apareceu em:', vazou); process.exit(1); }
console.log(`conferir-segredo: ${arquivos('dist').length} arquivos sem a palavra secreta.`);
