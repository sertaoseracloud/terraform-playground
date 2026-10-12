import { verificarRegra } from './verificacoes.js';
import { executarTerraform } from './tf/motor.js';

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
 */
export async function corrigir(exercicio, arquivos, { incluirOcultos = true, semente = exercicio.id } = {}) {
  const casos = exercicio.testes.filter((t) => incluirOcultos || !t.oculto);
  const relatorio = [];
  for (const teste of casos) {
    let estado = null;
    if (teste.antes) {
      const anterior = executarTerraform(teste.antes, { comando: 'apply', variaveis: teste.variaveis, workspace: teste.workspace, semente });
      estado = anterior.estado;
    }
    const passos = teste.passos ?? [teste];
    const resultados = [];
    for (const passo of passos) {
      const r = executarTerraform(passo.arquivos ?? arquivos, {
        comando: passo.comando ?? 'plan',
        estado,
        variaveis: passo.variaveis ?? teste.variaveis,
        workspace: passo.workspace ?? teste.workspace,
        semente,
      });
      if (r.ok && (passo.comando === 'apply' || passo.comando === 'destroy')) estado = r.estado;
      resultados.push(...(passo.regras ?? []).map((regra) => verificarRegra(regra, r, { arquivos })));
    }
    relatorio.push({
      descricao: teste.descricao,
      oculto: Boolean(teste.oculto),
      ok: resultados.every((x) => x.ok),
      resultados,
    });
  }
  return { aprovado: relatorio.every((t) => t.ok), relatorio };
}
