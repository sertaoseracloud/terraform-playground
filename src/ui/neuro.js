// Recursos para pessoas neurodivergentes (ligados no painel ♿ Acessibilidade):
//   - régua de leitura: uma faixa que acompanha a linha sob o mouse (dislexia, TDAH);
//   - lista de tarefas: os pedidos do exercício viram itens marcáveis (função executiva);
//   - lembrete de pausa: um aviso discreto a cada 25 minutos de estudo contínuo.
import { lerTarefas, gravarTarefas } from '../progresso.js';
import { $ } from './util.js';

const ligado = (classe) => document.documentElement.classList.contains(classe);

// ---------- régua de leitura ----------

export function iniciarRegua() {
  const regua = $('regua-leitura');
  const mover = (y) => {
    if (!ligado('a11y-regua')) return;
    regua.style.top = `${y}px`;
    regua.classList.add('visivel');
  };
  document.addEventListener('mousemove', (e) => mover(e.clientY), { passive: true });
  // Quem navega pelo teclado: a régua vai para o elemento com foco.
  document.addEventListener('focusin', (e) => {
    const r = e.target.getBoundingClientRect?.();
    if (r && r.height < window.innerHeight / 2) mover(r.top + r.height / 2);
  });
  document.documentElement.addEventListener('mouseleave', () => regua.classList.remove('visivel'));
}

// ---------- lista de tarefas ----------

const FORA_DA_LISTA = 'details, .caso-exemplo, .etapa-info, .roteiro, .glossario, li li';

/**
 * Pedidos do enunciado: os itens de lista de "O que fazer". Se não houver, os de
 * "Como saber que deu certo"; nas lições, qualquer lista fora de dicas e exemplos.
 */
export function pedidosDoEnunciado(container) {
  for (const secao of ['.secao-fazer', '.secao-conferir', null]) {
    const raiz = secao ? container.querySelector(secao) : container;
    if (!raiz) continue;
    const itens = [...raiz.querySelectorAll('li')].filter((li) => !li.closest(FORA_DA_LISTA));
    if (itens.length) return itens;
  }
  return [];
}

/** Transforma os pedidos em caixas de marcar, salvas por exercício. */
export function aplicarChecklist(container, idItem) {
  if (!ligado('a11y-checklist')) return;
  const pedidos = pedidosDoEnunciado(container);
  if (!pedidos.length) return;
  const feitos = new Set(lerTarefas(idItem));

  const progresso = document.createElement('p');
  progresso.className = 'tarefas-progresso';
  progresso.setAttribute('aria-live', 'polite');
  pedidos[0].closest('ul, ol').before(progresso);

  const atualizar = () => {
    const total = pedidos.length;
    const marcados = pedidos.filter((_, i) => feitos.has(i)).length;
    progresso.innerHTML = marcados === total
      ? `✅ <b>${total} de ${total}</b> tarefas marcadas. Agora clique em <b>▶ Executar</b> para testar.`
      : `☑️ <b>${marcados} de ${total}</b> tarefas marcadas. Faça uma de cada vez.`;
  };

  pedidos.forEach((li, i) => {
    li.classList.add('tarefa');
    const label = document.createElement('label');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = feitos.has(i);
    const texto = document.createElement('span');
    texto.append(...li.childNodes);
    label.append(caixa, texto);
    li.append(label);
    li.classList.toggle('feita', caixa.checked);
    caixa.addEventListener('change', () => {
      if (caixa.checked) feitos.add(i);
      else feitos.delete(i);
      li.classList.toggle('feita', caixa.checked);
      gravarTarefas(idItem, [...feitos]);
      atualizar();
    });
  });
  atualizar();
}

// ---------- lembrete de pausa ----------

export const PAUSA = { focoMin: 25, inatividadeMin: 5, adiarMin: 10 };
const MIN = 60_000;

/**
 * Hora de sugerir uma pausa? Só depois de `focoMin` minutos seguidos de atividade.
 * Quem ficou `inatividadeMin` minutos parado já descansou: a contagem recomeça.
 */
export function precisaPausa({ inicio, ultimaAtividade, agora }, { focoMin, inatividadeMin } = PAUSA) {
  if (agora - ultimaAtividade > inatividadeMin * MIN) return false;
  return agora - inicio >= focoMin * MIN;
}

export function iniciarPausa({ ativo }) {
  const aviso = $('lembrete-pausa');
  let inicio = Date.now();
  let ultimaAtividade = Date.now();

  const registrar = () => {
    const agora = Date.now();
    if (agora - ultimaAtividade > PAUSA.inatividadeMin * MIN) inicio = agora;
    ultimaAtividade = agora;
  };
  ['keydown', 'pointerdown', 'wheel'].forEach((tipo) => document.addEventListener(tipo, registrar, { passive: true }));

  const fechar = (proximaEmMin) => {
    aviso.hidden = true;
    inicio = Date.now() - (PAUSA.focoMin - proximaEmMin) * MIN;
  };

  setInterval(() => {
    if (!ativo() || !aviso.hidden || !precisaPausa({ inicio, ultimaAtividade, agora: Date.now() })) return;
    aviso.innerHTML = `
      <p><b>☕ Hora de uma pausa?</b> Você está estudando há ${PAUSA.focoMin} minutos.
        Beba água, alongue o corpo, olhe para longe por 5 minutos. Seu código fica salvo.</p>
      <div class="lembrete-botoes">
        <button type="button" class="btn btn-verde btn-pequeno" data-pausa="ok">Vou pausar</button>
        <button type="button" class="btn btn-fantasma btn-pequeno" data-pausa="depois">Lembrar em ${PAUSA.adiarMin} min</button>
      </div>`;
    aviso.hidden = false;
  }, 30_000);

  aviso.addEventListener('click', (e) => {
    const escolha = e.target.closest('[data-pausa]')?.dataset.pausa;
    if (escolha === 'ok') fechar(PAUSA.focoMin + 5); // conta de novo depois dos 5 min de pausa
    if (escolha === 'depois') fechar(PAUSA.adiarMin);
  });
}
