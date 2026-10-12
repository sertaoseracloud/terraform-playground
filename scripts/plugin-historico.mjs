// Plugin do Vite: o módulo virtual "virtual:historico" traz a lista de alterações
// (commits) do repositório, da mais nova para a mais antiga. É gerado a cada build,
// então a página de novidades nunca fica desatualizada. Sem git (ou com clone raso),
// a lista sai vazia e a página mostra só o resumo das versões.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ID = 'virtual:historico';
const RESOLVIDO = `\0${ID}`;
const SEP = '\u001f';

export function lerHistorico(cwd = process.cwd()) {
  try {
    const saida = execFileSync('git', ['log', `--format=%h${SEP}%ad${SEP}%s`, '--date=short'], { cwd, encoding: 'utf8' });
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
