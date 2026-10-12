import { detalharRegra, primeiroErroDe } from './verificacoes.js';
import { executarTerraform } from './tf/motor.js';

const agora = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

/**
 * Roda os casos de teste do exercício com os arquivos do aluno.
 *
 * - "Executar" usa só os casos visíveis; "Enviar" inclui os ocultos (`oculto: true`).
 * - Cada caso roda um comando (`comando`: 'plan' padrão, 'apply' ou 'destroy') com
 *   variáveis (`variaveis`, como -var) e workspace (`workspace`) próprios.
 *   Variáveis diferentes nos casos ocultos impedem respostas "decoradas".
 * - `antes`: arquivos de uma versão anterior que é aplicada primeiro (apply), para
 *   testar mudanças sobre um estado existente (update, replace, moved, import...).
 * - `passos`: sequência de comandos que compartilham o mesmo estado, cada um com as
 *   próprias regras (ex.: apply → plan de novo deve dizer "No changes").
 *
 * Cada caso do relatório traz, além do resultado das regras (com categoria, valor
 * obtido e dica; veja detalharRegra), o cenário (os comandos rodados, com variáveis e
 * workspace), se havia estado anterior, o primeiro erro do Terraform e o tempo.
 */
export async function corrigir(exercicio, arquivos, { incluirOcultos = true, semente = exercicio.id } = {}) {
  const casos = exercicio.testes.filter((t) => incluirOcultos || !t.oculto);
  const relatorio = [];
  for (const teste of casos) {
    const inicio = agora();
    let estado = null;
    if (teste.antes) {
      const anterior = executarTerraform(teste.antes, { comando: 'apply', variaveis: teste.variaveis, workspace: teste.workspace, semente });
      estado = anterior.estado;
    }
    const passos = teste.passos ?? [teste];
    const resultados = [];
    const cenario = [];
    let erroExecucao;
    for (const passo of passos) {
      const comando = passo.comando ?? 'plan';
      const variaveis = passo.variaveis ?? teste.variaveis;
      const workspace = passo.workspace ?? teste.workspace;
      const r = executarTerraform(passo.arquivos ?? arquivos, { comando, estado, variaveis, workspace, semente });
      if (r.ok && (comando === 'apply' || comando === 'destroy')) estado = r.estado;
      cenario.push({ comando, ...(variaveis ? { variaveis } : {}), ...(workspace ? { workspace } : {}) });
      erroExecucao ??= primeiroErroDe(r);
      resultados.push(...(passo.regras ?? []).map((regra) => detalharRegra(regra, r, { arquivos })));
    }
    relatorio.push({
      descricao: teste.descricao,
      oculto: Boolean(teste.oculto),
      ok: resultados.every((x) => x.ok),
      resultados,
      cenario,
      estadoAnterior: Boolean(teste.antes),
      ...(erroExecucao ? { erroExecucao } : {}),
      ms: Math.max(1, Math.round(agora() - inicio)),
    });
  }
  return { aprovado: relatorio.every((t) => t.ok), relatorio };
}
