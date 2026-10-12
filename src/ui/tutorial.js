// Tutorial passo a passo em modal (<dialog>), com destaque no elemento explicado.
// Abre sozinho na primeira visita e pelo botão "❓ Tutorial".
import { PASSOS, PROBLEMA_DO_TUTORIAL } from './tutorial-passos.js';
import { linkItem } from '../compartilhar.js';
import { lerPreferencia, gravarPreferencia } from '../progresso.js';
import { $ } from './util.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const celular = () => window.matchMedia?.('(max-width: 760px)').matches ?? false;

/** Passos que valem para esta tela: no celular, pula os que só existem no desktop. */
export const passosAtivos = (ehCelular = celular()) => PASSOS.filter((p) => !(p.soDesktop && ehCelular));

export function iniciarTutorial({ telaAtual }) {
  const dialogo = $('tutorial');
  const el = {
    passo: $('tutorial-passo'),
    titulo: $('tutorial-titulo'),
    texto: $('tutorial-texto'),
    pontos: $('tutorial-pontos'),
    voltar: $('tutorial-voltar'),
    avancar: $('tutorial-avancar'),
    pular: $('tutorial-pular'),
  };
  let indice = 0;
  let passos = PASSOS;
  let destacado = null;
  let hashAntes = '';

  function limparDestaque() {
    destacado?.classList.remove('tutorial-destaque');
    destacado = null;
  }

  async function irParaTela(tela) {
    if (!tela || tela === telaAtual()) return;
    location.hash = tela === 'inicio' ? '#/trilha' : linkItem(PROBLEMA_DO_TUTORIAL);
    for (let i = 0; i < 20 && telaAtual() !== tela; i++) await esperar(50);
    await esperar(150);
  }

  function posicionar(alvo) {
    dialogo.classList.remove('centro', 'acima', 'abaixo');
    if (!alvo || window.innerWidth < 700) {
      dialogo.classList.add('centro');
      dialogo.style.removeProperty('top');
      return;
    }
    const r = alvo.getBoundingClientRect();
    const alturaDialogo = dialogo.offsetHeight || 260;
    const cabeAbaixo = r.bottom + 16 + alturaDialogo < window.innerHeight;
    const cabeAcima = r.top - 16 - alturaDialogo > 0;
    if (cabeAbaixo) {
      dialogo.classList.add('abaixo');
      dialogo.style.top = `${r.bottom + 16}px`;
    } else if (cabeAcima) {
      dialogo.classList.add('acima');
      dialogo.style.top = `${r.top - 16 - alturaDialogo}px`;
    } else {
      dialogo.classList.add('centro');
      dialogo.style.removeProperty('top');
    }
  }

  async function mostrar(i) {
    indice = i;
    const passo = passos[i];
    limparDestaque();
    await irParaTela(passo.tela);

    // No celular, a navegação fica no painel ☰: o destaque vai para o botão do menu.
    const seletor = celular() && passo.alvoCelular ? passo.alvoCelular : passo.alvo;
    const alvo = seletor ? document.querySelector(seletor) : null;
    const visivel = alvo && alvo.offsetParent !== null;
    if (visivel) {
      alvo.scrollIntoView({ block: 'nearest' });
      alvo.classList.add('tutorial-destaque');
      destacado = alvo;
    }

    el.passo.textContent = `Passo ${i + 1} de ${passos.length}`;
    el.titulo.textContent = passo.titulo;
    el.texto.innerHTML = passo.texto;
    el.pontos.innerHTML = passos.map((_, j) => `<span class="${j === i ? 'atual' : j < i ? 'feito' : ''}"></span>`).join('');
    el.voltar.disabled = i === 0;
    el.avancar.textContent = i === passos.length - 1 ? 'Começar ✓' : 'Próximo ›';

    if (!dialogo.open) dialogo.showModal();
    posicionar(visivel ? alvo : null);
    el.avancar.focus();
  }

  function fechar() {
    limparDestaque();
    if (dialogo.open) dialogo.close();
    gravarPreferencia('tutorial-visto', true);
  }

  el.avancar.onclick = () => {
    if (indice === passos.length - 1) {
      fechar();
      // Termina no primeiro problema, ou volta para onde o aluno estava.
      if (/^(#\/?|#\/trilha)?$/.test(hashAntes)) location.hash = linkItem(PROBLEMA_DO_TUTORIAL);
      return;
    }
    mostrar(indice + 1);
  };
  el.voltar.onclick = () => indice > 0 && mostrar(indice - 1);
  el.pular.onclick = fechar;
  dialogo.addEventListener('close', limparDestaque);
  dialogo.addEventListener('cancel', () => gravarPreferencia('tutorial-visto', true));
  dialogo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') el.avancar.click();
    if (e.key === 'ArrowLeft') el.voltar.click();
  });
  window.addEventListener('resize', () => dialogo.open && posicionar(destacado));

  const abrir = () => {
    hashAntes = location.hash;
    passos = passosAtivos();
    mostrar(0);
  };
  $('btn-tutorial').onclick = abrir;

  // Primeira visita: abre sozinho quando a pessoa entra na trilha ou num exercício
  // (não na landing, na privacidade nem em links de código compartilhado ou de certificado).
  const talvezAbrir = () => {
    if (!dialogo.open && !lerPreferencia('tutorial-visto') && /^#\/(trilha|p\/|livre)/.test(location.hash)) abrir();
  };
  talvezAbrir();
  window.addEventListener('hashchange', talvezAbrir);

  return { abrir };
}
