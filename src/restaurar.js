// Restaurar o progresso pelo certificado (#/validar/<código>). Um certificado válido prova
// que o aluno concluiu o módulo e os anteriores da cadeia, cada um numa data. O que ele
// prova volta para este navegador, se o nome salvo aqui for igual ao do certificado.
// Funções puras; quem grava é restaurarItens (progresso.js).
import { CERTIFICADOS } from './certificados.js';

/**
 * Um bloco por módulo da cadeia (o certificado final não tem itens próprios e fica de fora).
 * `modulos` é o de conteudo/trilha.js.
 */
export function planoDeRestauracao(cert, modulos) {
  const elos = [...cert.cadeia, { modulo: cert.modulo, data: cert.data }];
  return elos.flatMap(({ modulo, data }) => {
    const m = modulos.find((x) => x.id === modulo);
    if (!m) return [];
    return [{
      modulo,
      titulo: CERTIFICADOS[modulo].titulo,
      data,
      licoes: m.itens.filter((i) => i.tipo === 'licao').length,
      exercicios: m.itens.filter((i) => i.tipo === 'problema').length,
      ids: m.itens.map((i) => i.id),
    }];
  });
}

/** O nome salvo neste navegador tem de ser igual ao do certificado (só as pontas são aparadas). */
export function situacaoDoNome(cert, nomeSalvo) {
  const salvo = String(nomeSalvo ?? '').trim();
  if (!salvo) return 'sem-nome';
  return salvo === cert.nome.trim() ? 'pode' : 'nome-diferente';
}

/** Os itens do plano, cada um com a data do seu módulo. */
export const itensDoPlano = (plano) => plano.flatMap((b) => b.ids.map((id) => ({ id, data: b.data })));
