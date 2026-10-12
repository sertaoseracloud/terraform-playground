// Regras do "jogo" (funções puras, testadas em tests/gamificacao.test.js):
// XP, níveis, sequência de dias, desbloqueio dos módulos e próximo passo do caminho.

export const XP = { licao: 5, facil: 10, medio: 20, dificil: 40 };

/** O próximo módulo abre quando o anterior tem esta porcentagem dos problemas resolvidos. */
export const LIMITE_DESBLOQUEIO = 70;

export const NIVEIS = [
  { nome: 'Iniciante', xp: 0 },
  { nome: 'Aprendiz', xp: 150 },
  { nome: 'Operador', xp: 400 },
  { nome: 'Construtor', xp: 800 },
  { nome: 'Arquiteto de nuvem', xp: 1400 },
  { nome: 'Especialista multicloud', xp: 2200 },
  { nome: 'Mestre do Terraform', xp: 3200 },
];

const xpDoItem = (item) => (item.tipo === 'licao' ? XP.licao : XP[item.dificuldade] ?? 0);
const maisRecente = (datas) => datas.filter(Boolean).sort().at(-1) ?? null;

export function nivelPorXp(xp) {
  const i = NIVEIS.findLastIndex((n) => xp >= n.xp);
  const atual = NIVEIS[i];
  const proximo = NIVEIS[i + 1];
  const pct = proximo ? Math.round(((xp - atual.xp) / (proximo.xp - atual.xp)) * 100) : 100;
  return { numero: i + 1, nome: atual.nome, pct, proximo: proximo ?? null, faltam: proximo ? proximo.xp - xp : 0 };
}

/**
 * Monta o caminho: estado de cada item ('concluido', 'tentado', 'proximo',
 * 'disponivel' ou 'bloqueado'), progresso e desbloqueio de cada módulo.
 * `statusDe(id)` devolve 'resolvido' | 'tentado' | undefined; `dataDe(id)`, 'AAAA-MM-DD'.
 */
export function calcularJornada({ modulos, statusDe, dataDe = () => null }) {
  let xp = 0;
  let anteriorPct = 100;
  const resultado = modulos.map((m, indice) => {
    const problemas = m.itens.filter((i) => i.tipo === 'problema');
    const resolvidos = problemas.filter((i) => statusDe(i.id) === 'resolvido');
    const comProgresso = m.itens.some((i) => statusDe(i.id));
    const pct = problemas.length ? Math.round((resolvidos.length / problemas.length) * 100) : 100;
    const desbloqueado = indice === 0 || anteriorPct >= LIMITE_DESBLOQUEIO || comProgresso;
    anteriorPct = pct;

    const itens = m.itens.map((item) => {
      const status = statusDe(item.id);
      if (status === 'resolvido') xp += xpDoItem(item);
      const estado = status === 'resolvido' ? 'concluido'
        : status === 'tentado' ? 'tentado'
          : desbloqueado ? 'disponivel' : 'bloqueado';
      return { ...item, estado, xp: xpDoItem(item) };
    });

    const concluido = problemas.length > 0 && resolvidos.length === problemas.length;
    return {
      ...m,
      indice,
      itens,
      total: problemas.length,
      resolvidos: resolvidos.length,
      pct,
      desbloqueado,
      concluido,
      concluidoEm: concluido ? maisRecente(resolvidos.map((i) => dataDe(i.id))) : null,
    };
  });

  // Próximo passo: o primeiro item ainda não feito de um módulo aberto.
  let proximo = null;
  for (const m of resultado) {
    const item = m.desbloqueado && m.itens.find((i) => i.estado === 'disponivel' || i.estado === 'tentado');
    if (item) {
      proximo = item;
      item.ehProximo = true;
      if (item.estado === 'disponivel') item.estado = 'proximo';
      break;
    }
  }

  const todosConcluidos = resultado.every((m) => m.concluido);
  return {
    xp,
    nivel: nivelPorXp(xp),
    modulos: resultado,
    proximo,
    final: {
      concluido: todosConcluidos,
      concluidoEm: todosConcluidos ? maisRecente(resultado.map((m) => m.concluidoEm)) : null,
    },
  };
}

const diaAnterior = (dia) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Dias seguidos com atividade, terminando hoje (ou ontem, para não zerar de manhã). */
export function sequenciaDeDias(diasAtivos, hoje) {
  const dias = new Set(diasAtivos);
  let dia = dias.has(hoje) ? hoje : diaAnterior(hoje);
  let total = 0;
  while (dias.has(dia)) {
    total += 1;
    dia = diaAnterior(dia);
  }
  return total;
}
