// Carga horária: quanto tempo cada atividade leva, em média, e quantas horas vale
// cada certificado. A carga de um módulo é a soma das atividades dele, arredondada
// para cima em horas, com o mínimo de 1 hora. A de cada certificado fica fixa em
// src/certificados.js (um certificado emitido não muda de carga), e o teste
// tests/carga-horaria.test.js avisa quando o conteúdo mudar e ela precisar ser revista.

/** Minutos de cada atividade: tempo de ler, tentar, errar e acertar. */
export const MINUTOS_POR_ATIVIDADE = { licao: 10, facil: 15, medio: 30, dificil: 45 };

/** Nenhuma atividade certificada vale menos de 1 hora. */
export const CARGA_MINIMA_HORAS = 1;

/** Minutos estimados de um item da trilha (lição ou exercício); 0 para o playground livre. */
export function minutosDoItem(item) {
  if (item?.tipo === 'licao') return MINUTOS_POR_ATIVIDADE.licao;
  if (item?.tipo === 'problema') return MINUTOS_POR_ATIVIDADE[item.dificuldade] ?? 0;
  return 0;
}

/** Horas de um conjunto de itens: soma arredondada para cima, no mínimo 1 hora. */
export function horasDosItens(itens) {
  const minutos = itens.reduce((soma, item) => soma + minutosDoItem(item), 0);
  return Math.max(CARGA_MINIMA_HORAS, Math.ceil(minutos / 60));
}

export const textoHoras = (horas) => `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
