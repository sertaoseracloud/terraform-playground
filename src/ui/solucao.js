// Aba Solução: só aparece depois que a pessoa tentou pelo tempo estimado do exercício
// (o "⏱ ~N min": fácil 15, médio 30, difícil 45) e enquanto ele não está resolvido.
// O tempo conta só com o exercício aberto e a aba do navegador visível, e soma as visitas.
import { minutosDoItem } from '../cargaHoraria.js';
import { lerTentativa, somarTentativa, statusDe } from '../progresso.js';

const ehExercicio = (item) => item?.tipo === 'problema';

export function solucaoLiberada(item) {
  if (!ehExercicio(item) || statusDe(item.id) === 'resolvido') return false;
  return lerTentativa(item.id) >= minutosDoItem(item) * 60;
}

/** Minutos (arredondados para cima) que faltam para a aba Solução aparecer. */
export function minutosQueFaltam(item) {
  return Math.max(0, Math.ceil((minutosDoItem(item) * 60 - lerTentativa(item.id)) / 60));
}

/**
 * Conta o tempo de tentativa do exercício aberto. `ativo()` diz se a tela do exercício
 * está na frente; `aoMudar()` é chamado a cada passo (para atualizar a aba e o aviso).
 */
export function criarCronometro({ passoMs = 15000, ativo = () => true, aoMudar = () => {} } = {}) {
  let id = null;
  let ultimo = 0;
  let timer = null;

  function contar() {
    const agora = Date.now();
    if (id && !document.hidden && ativo()) {
      // No máximo dois passos de uma vez: um computador que dormiu não conta como tentativa.
      somarTentativa(id, Math.round(Math.min(agora - ultimo, passoMs * 2) / 1000));
    }
    ultimo = agora;
    if (id) aoMudar();
  }

  document.addEventListener('visibilitychange', () => {
    if (!id) return;
    if (document.hidden) contar();
    else ultimo = Date.now();
  });

  return {
    iniciar(item) {
      this.parar();
      if (!ehExercicio(item)) return;
      id = item.id;
      ultimo = Date.now();
      timer = setInterval(contar, passoMs);
    },
    parar() {
      if (id) contar();
      clearInterval(timer);
      id = null;
    },
  };
}
