// Terminal animado: mostra a saída do Terraform com o movimento de um terminal de
// verdade. O comando é digitado depois do prompt, o init "baixa" os provedores, o
// plano aparece de uma vez depois de o Terraform "pensar" e, no apply, cada recurso
// chega no seu tempo (com "Still creating..." nos demorados). O ritmo de cada linha vem
// de src/tf/saida.js (campos `atraso` e `digitar`).
//
// Sem animação quando: o aluno pediu "Reduzir animações" (ou o sistema pede), a saída é
// só reaberta, ou ele clica em ⏩ Pular / tecla Esc.
import { esc } from './util.js';

const USUARIO = 'aluno@sertao';
const TECLA_MS = 34;

export const semMovimento = () => document.documentElement.classList.contains('a11y-sem-movimento');

/** O prompt do shell, colorido como num terminal: aluno@sertao:~/pasta$ */
function prompt(pasta) {
  return `<span class="p-usuario">${USUARIO}</span>:<span class="p-pasta">~/${esc(pasta)}</span><span class="p-cifrao">$</span> `;
}

function htmlLinha(linha, pasta, ate = linha.texto.length) {
  const classes = linha.classe ? ` ${linha.classe.split(' ').map((c) => `l-${c}`).join(' ')}` : '';
  let texto = linha.texto.slice(0, ate);
  let inicio = '';
  if (linha.classe === 'comando' && texto.startsWith('$ ')) {
    inicio = prompt(pasta);
    texto = texto.slice(2);
  }
  return `<span class="linha${classes}">${inicio}${esc(texto)}</span>`;
}

/**
 * Liga o terminal a um <pre>. `aoMudar(animando)` avisa quando a animação começa e
 * termina (para mostrar o botão ⏩ Pular).
 */
export function criarTerminal(pre, { aoMudar = () => {} } = {}) {
  let geracao = 0;
  let timer = null;
  let acordar = null;
  let pulando = false;
  let animando = false;

  const definirAnimando = (valor) => {
    animando = valor;
    pre.setAttribute('aria-busy', String(valor));
    aoMudar(valor);
  };

  // Numa aba escondida o navegador atrasa os timers: a saída aparece inteira, sem esperar.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animando) pular();
  });

  function pular() {
    if (!animando) return;
    pulando = true;
    clearTimeout(timer);
    acordar?.();
  }

  function dormir(ms) {
    if (pulando || ms <= 0 || document.hidden) return Promise.resolve();
    return new Promise((resolver) => {
      acordar = resolver;
      timer = setTimeout(resolver, ms);
    });
  }

  /** Segue o fim da saída, a não ser que o aluno tenha rolado para cima para ler. */
  function noFim(antes) {
    if (antes) pre.scrollTop = pre.scrollHeight;
  }
  const estaNoFim = () => pre.scrollHeight - pre.scrollTop - pre.clientHeight < 48;

  const cursor = '<span class="cursor" aria-hidden="true"></span>';
  const final = (pasta) => `\n<span class="linha l-comando">${prompt(pasta)}</span>${cursor}`;

  /**
   * Mostra as linhas. Com `animar`, devolve uma promessa que termina quando a saída
   * acaba de aparecer (ou o aluno pula).
   */
  async function mostrar(linhas, { animar = true, pasta = 'terraform' } = {}) {
    const minha = ++geracao;
    clearTimeout(timer);
    acordar?.();
    pulando = false;

    if (!animar || semMovimento()) {
      pre.innerHTML = linhas.map((l) => htmlLinha(l, pasta)).join('\n') + final(pasta);
      pre.scrollTop = pre.scrollHeight;
      if (animando) definirAnimando(false);
      return;
    }

    definirAnimando(true);
    pre.innerHTML = cursor;
    const elCursor = pre.lastElementChild;
    let primeira = true;
    /** Acrescenta HTML antes do cursor, seguindo o fim da saída. */
    const anexar = (html) => {
      const seguir = estaNoFim();
      elCursor.insertAdjacentHTML('beforebegin', `${primeira ? '' : '\n'}${html}`);
      primeira = false;
      noFim(seguir);
    };

    for (let i = 0; i < linhas.length; i++) {
      if (minha !== geracao) return;
      if (pulando) {
        anexar(linhas.slice(i).map((l) => htmlLinha(l, pasta)).join('\n'));
        break;
      }
      const linha = linhas[i];
      await dormir(linha.atraso ?? 0);
      if (minha !== geracao) return;

      if (linha.digitar !== undefined && !pulando) {
        // Digita o comando (ou o "yes") letra por letra, numa linha que vai crescendo.
        anexar(htmlLinha(linha, pasta, linha.digitar));
        for (let n = linha.digitar + 1; n <= linha.texto.length && !pulando; n++) {
          await dormir(TECLA_MS + ((linha.texto.charCodeAt(n) || 0) % 5) * 9);
          if (minha !== geracao) return;
          elCursor.previousElementSibling.outerHTML = htmlLinha(linha, pasta, n);
        }
        if (pulando) elCursor.previousElementSibling.outerHTML = htmlLinha(linha, pasta);
        await dormir(160);
        continue;
      }
      // Linhas sem espera chegam juntas, como um bloco de texto (o plano inteiro de uma vez).
      const bloco = [htmlLinha(linha, pasta)];
      while (i + 1 < linhas.length && !linhas[i + 1].atraso && linhas[i + 1].digitar === undefined) {
        bloco.push(htmlLinha(linhas[++i], pasta));
      }
      anexar(bloco.join('\n'));
    }
    if (minha !== geracao) return;
    elCursor.insertAdjacentHTML('beforebegin', `\n<span class="linha l-comando">${prompt(pasta)}</span>`);
    noFim(true);
    definirAnimando(false);
  }

  return {
    mostrar,
    /** Mostra um texto simples (erro interno do simulador). */
    texto(t) {
      geracao++;
      pre.textContent = t;
      if (animando) definirAnimando(false);
    },
    limpar() {
      geracao++;
      clearTimeout(timer);
      pre.innerHTML = '';
      if (animando) definirAnimando(false);
    },
    /** Termina a animação na hora, com toda a saída na tela. */
    pular,
    get animando() { return animando; },
  };
}
