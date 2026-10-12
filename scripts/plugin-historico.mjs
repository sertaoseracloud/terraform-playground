// Plugin do Vite: o módulo virtual "virtual:historico" traz a lista de alterações
// (commits) do repositório, da mais nova para a mais antiga. É gerado a cada build,
// então a página de novidades nunca fica desatualizada. Sem git (ou com clone raso),
// a lista sai vazia e a página mostra só o resumo das versões.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ID = 'virtual:historico';
const RESOLVIDO = `\0${ID}`;
const SEP = '\u001f';
/** Raiz do projeto: o git roda aqui, de onde quer que o Vite tenha sido chamado. */
const RAIZ = fileURLToPath(new URL('..', import.meta.url));

export function lerHistorico(cwd = RAIZ) {
  try {
    // stderr ignorado: sem git, a lista só sai vazia (sem "fatal: not a git repository" no console).
    const saida = execFileSync('git', ['log', `--format=%h${SEP}%ad${SEP}%s`, '--date=short'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return saida.trim().split('\n').filter(Boolean).map((linha) => {
      const [hash, data, titulo] = linha.split(SEP);
      return { hash, data, titulo };
    });
  } catch {
    return [];
  }
}

export const versaoDoPacote = () => JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export function pluginHistorico() {
  return {
    name: 'historico-de-alteracoes',
    resolveId: (id) => (id === ID ? RESOLVIDO : null),
    load: (id) => (id === RESOLVIDO ? `export default ${JSON.stringify(lerHistorico())};` : null),
  };
}
