// Avisos para leitores de tela (NVDA, JAWS, VoiceOver, TalkBack): uma região
// aria-live escondida da tela (#anuncio, no index.html) fala o resultado de cada ação
// (rodou, passou, falhou e por quê) sem tirar o foco de onde a pessoa está.
// O terminal e a lista de testes não são regiões vivas: o leitor leria tudo, letra por
// letra. Eles continuam navegáveis; aqui vai só o resumo do que importa.

let timer = null;

/** Fala um texto pelo leitor de tela. Repetir o mesmo texto também é falado. */
export function anunciar(texto, regiao = document.getElementById('anuncio')) {
  if (!regiao || !texto) return;
  clearTimeout(timer);
  regiao.textContent = '';
  // Esvaziar e preencher depois de um instante faz o leitor perceber a mudança.
  timer = setTimeout(() => { regiao.textContent = texto; }, 80);
}

/** O modo "leitor de tela" do painel ♿ está ligado (avisos com todos os detalhes). */
export const leitorDeTela = () => document.documentElement.classList.contains('a11y-leitor-tela');

/** Termina a frase com ponto (para o leitor fazer a pausa certa). */
export function frase(texto) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return !t || /[.!?:]$/.test(t) ? t : `${t}.`;
}

/**
 * Resumo falado dos casos de teste.
 * `relatorio`: [{ ok, resultados: [{ ok, mensagem, detalhe, dica }], erroExecucao }]
 * `nomes`: nome de cada caso do relatório ("Caso 1", "🔒 Oculto 1").
 * Sem `detalhado`, fala só a primeira falha (o resto está na aba Testes). Com
 * `codigoComErro`, o erro do código já foi falado: só o placar e o que fazer.
 */
export function falaDosTestes({ aprovado, relatorio }, { envio = false, nomes = [], gentil = false, detalhado = false, codigoComErro = false } = {}) {
  const total = relatorio.length;
  const passaram = relatorio.filter((c) => c.ok).length;
  const casos = (n) => `${n} ${n === 1 ? 'caso' : 'casos'}`;
  if (aprovado && envio) return `Aceito! Você acertou a questão: ${total === 1 ? 'o caso passou' : `os ${casos(total)} passaram`}, inclusive os ocultos.`;
  if (aprovado) return `Testes: ${total === 1 ? 'o caso visível passou' : `os ${casos(total)} visíveis passaram`}. Agora envie, com Control Shift Enter, para rodar também os casos ocultos.`;

  const partes = [`${gentil ? 'Ainda não passou' : 'Resposta errada'}: ${passaram} de ${casos(total)} ${total === 1 ? 'passou' : 'passaram'}.`];
  if (codigoComErro) return `${partes[0]} Corrija primeiro o erro do código e rode de novo. Os detalhes estão na aba Testes.`;
  const falhas = relatorio.map((c, i) => ({ ...c, nome: (nomes[i] ?? `Caso ${i + 1}`).replace(/^🔒\s*/, '') })).filter((c) => !c.ok);
  for (const caso of detalhado ? falhas : falhas.slice(0, 1)) {
    const erradas = caso.resultados.filter((r) => !r.ok);
    const itens = (detalhado ? erradas : erradas.slice(0, 1)).map((r) => [
      frase(r.mensagem),
      r.detalhe ? frase(`Motivo: ${r.detalhe}`) : '',
      r.dica ? frase(`Dica: ${r.dica}`) : '',
    ].filter(Boolean).join(' '));
    partes.push(`${caso.nome} falhou.`);
    if (caso.erroExecucao) partes.push(frase(`Erro na execução: ${caso.erroExecucao}`));
    partes.push(...itens);
  }
  if (!detalhado && falhas.length > 1) partes.push(`Mais ${casos(falhas.length - 1)} com falha.`);
  partes.push('Os detalhes estão na aba Testes.');
  return partes.join(' ');
}
