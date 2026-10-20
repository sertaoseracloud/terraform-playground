// O terminal: a saída do Terraform com o movimento de um terminal de verdade e, embaixo,
// o prompt com o campo de digitação. O comando é digitado depois do prompt, o init
// "baixa" os provedores, o plano aparece de uma vez depois de o Terraform "pensar" e, no
// apply, cada recurso chega no seu tempo (com "Still creating..." nos demorados). O ritmo
// de cada linha vem de src/tf/saida.js (campos `atraso` e `digitar`).
//
// Sem animação quando: o aluno pediu "Reduzir animações" ou o modo leitor de tela (ou o
// sistema pede), ou ele clica em ⏩ Pular / tecla Esc.
//
// Teclas no campo: Enter roda; ↑/↓ histórico; Tab completa (com o campo vazio, sai do terminal); Ctrl+C cancela; Ctrl+D (campo
// vazio) é o fim da entrada; Ctrl+L limpa; Esc pula a animação ou tira o foco do terminal.
import { esc } from './util.js';

const USUARIO = 'aluno@sertao';
const TECLA_MS = 34;
const LIMITE_HISTORICO = 100;
const LIMITE_NOS = 12000;
const ROTULO_PADRAO = 'Comando do terminal';
const FOCAVEIS = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

// No modo leitor de tela a saída também chega inteira (o leitor não acompanha a digitação).
export const semMovimento = () => ['a11y-sem-movimento', 'a11y-leitor-tela'].some((c) => document.documentElement.classList.contains(c));

/** O texto do prompt do shell: aluno@sertao:~/pasta$ */
export const textoDoPrompt = (pasta) => `${USUARIO}:~/${pasta}$ `;

/** O prompt do shell, colorido como num terminal. */
function prompt(pasta) {
  return `<span class="p-usuario">${USUARIO}</span>:<span class="p-pasta">~/${esc(pasta)}</span><span class="p-cifrao">$</span> `;
}

const classesDe = (classe) => (classe ? ` ${classe.split(' ').map((c) => `l-${c}`).join(' ')}` : '');

function htmlLinha(linha, pasta, ate = linha.texto.length) {
  let texto = linha.texto.slice(0, ate);
  let inicio = '';
  if (linha.classe === 'comando' && texto.startsWith('$ ')) {
    inicio = prompt(pasta);
    texto = texto.slice(2);
  }
  return `<span class="linha${classesDe(linha.classe)}">${inicio}${esc(texto)}</span>`;
}

/** Prefixo comum das opções do Tab (para completar até onde todas concordam). */
const prefixoComum = (opcoes) => opcoes.reduce((p, o) => {
  let i = 0;
  while (i < p.length && p[i] === o[i]) i++;
  return p.slice(0, i);
});

/**
 * Liga o terminal a um <pre> (a saída). Com `campo` (o <input>) e `rotulo` (o <span> do
 * prompt), o terminal também lê o que a pessoa digita. `aoMudar(animando)` avisa quando a
 * animação começa e termina (para mostrar o botão ⏩ Pular).
 */
export function criarTerminal(pre, {
  aoMudar = () => {}, campo = null, rotulo = null, historico = [], aoMudarHistorico = () => {}, completar = () => [],
} = {}) {
  const caixa = campo ? pre.parentElement : pre; // quem rola
  let geracao = 0;
  let timer = null;
  let acordar = null;
  let pulando = false;
  let animando = false;
  let leitura = null;
  let lista = [...historico];
  let posicao = lista.length;
  let tinhaFoco = false;
  let silencio = null;
  if (campo) campo.disabled = true;
  if (campo && !caixa.hasAttribute('tabindex')) caixa.tabIndex = -1;

  const definirAnimando = (valor) => {
    animando = valor;
    pre.setAttribute('aria-busy', String(valor));
    if (campo && leitura) campo.disabled = valor;
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

  const estaNoFim = () => caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 48;
  /** Segue o fim da saída, a não ser que o aluno tenha rolado para cima para ler. */
  const seguir = (antes) => { if (antes) caixa.scrollTop = caixa.scrollHeight; };

  function aparar() {
    while (pre.childNodes.length > LIMITE_NOS) pre.firstChild.remove();
  }

  /** Acrescenta HTML no fim da saída (antes do cursor da animação, se houver). */
  function anexarHtml(html, antesDe = null) {
    const fim = estaNoFim();
    if (antesDe) antesDe.insertAdjacentHTML('beforebegin', html);
    else pre.insertAdjacentHTML('beforeend', html);
    aparar();
    seguir(fim);
  }

  /** Texto simples no fim da saída, sem animação. `classe`: erro, sucesso, forte... */
  function escrever(texto, classe = '') {
    if (!texto) return;
    const fim = estaNoFim();
    if (classe) {
      const span = document.createElement('span');
      span.className = `linha${classesDe(classe)}`;
      span.textContent = texto;
      pre.append(span);
    } else {
      pre.append(document.createTextNode(texto));
    }
    aparar();
    seguir(fim);
  }

  const cursor = '<span class="cursor" aria-hidden="true"></span>';

  /**
   * Acrescenta as linhas. Com `animar`, devolve uma promessa que termina quando a saída
   * acaba de aparecer (ou o aluno pula).
   */
  async function mostrar(linhas, { animar = true, pasta = 'terraform' } = {}) {
    const minha = ++geracao;
    clearTimeout(timer);
    acordar?.();
    pulando = false;
    if (!linhas.length) return;

    if (!animar || semMovimento()) {
      anexarHtml(linhas.map((l) => `${htmlLinha(l, pasta)}\n`).join(''));
      if (animando) definirAnimando(false);
      return;
    }

    definirAnimando(true);
    pre.insertAdjacentHTML('beforeend', cursor);
    const elCursor = pre.lastElementChild;
    const anexar = (html) => anexarHtml(html, elCursor);

    for (let i = 0; i < linhas.length; i++) {
      if (minha !== geracao) return;
      if (pulando) {
        anexar(linhas.slice(i).map((l) => `${htmlLinha(l, pasta)}\n`).join(''));
        break;
      }
      const linha = linhas[i];
      await dormir(linha.atraso ?? 0);
      if (minha !== geracao) return;

      if (linha.digitar !== undefined && !pulando) {
        // Digita o comando letra por letra, numa linha que vai crescendo.
        anexar(htmlLinha(linha, pasta, linha.digitar));
        let atual = elCursor.previousElementSibling;
        for (let n = linha.digitar + 1; n <= linha.texto.length && !pulando; n++) {
          await dormir(TECLA_MS + ((linha.texto.charCodeAt(n) || 0) % 5) * 9);
          if (minha !== geracao) return;
          atual.outerHTML = htmlLinha(linha, pasta, n);
          atual = elCursor.previousElementSibling;
        }
        if (pulando) atual.outerHTML = htmlLinha(linha, pasta);
        anexar('\n');
        await dormir(160);
        continue;
      }
      // Linhas sem espera chegam juntas, como um bloco de texto (o plano inteiro de uma vez).
      const bloco = [`${htmlLinha(linha, pasta)}\n`];
      while (i + 1 < linhas.length && !linhas[i + 1].atraso && linhas[i + 1].digitar === undefined) {
        bloco.push(`${htmlLinha(linhas[++i], pasta)}\n`);
      }
      anexar(bloco.join(''));
    }
    if (minha !== geracao) return;
    elCursor.remove();
    seguir(true);
    definirAnimando(false);
  }

  function limpar() {
    geracao++;
    clearTimeout(timer);
    pre.innerHTML = '';
    if (animando) definirAnimando(false);
  }

  // ---------- leitura (o campo) ----------

  function terminar(valor) {
    const atual = leitura;
    leitura = null;
    tinhaFoco = document.activeElement === campo;
    campo.value = '';
    rotulo.innerHTML = '';
    campo.disabled = true;
    campo.setAttribute('aria-label', ROTULO_PADRAO);
    if (tinhaFoco) caixa.focus();
    atual.resolve(valor);
  }

  /** O que foi digitado fica na saída, depois do prompt (o do shell sai colorido). */
  function ecoar(texto) {
    if (leitura.pasta !== undefined) anexarHtml(`${htmlLinha({ texto: `$ ${texto}`, classe: 'comando' }, leitura.pasta)}\n`);
    else escrever(`${leitura.prompt}${texto}\n`);
  }

  function guardar(texto) {
    if (!texto.trim() || lista.at(-1) === texto) return;
    lista = [...lista, texto].slice(-LIMITE_HISTORICO);
    aoMudarHistorico(lista);
  }

  /**
   * Lê uma linha. `pasta`: o prompt do shell (aluno@sertao:~/pasta$); senão, `prompt` em
   * texto ("  Enter a value: ", "> "). Resolve com o texto (Enter) ou null (Ctrl+C, Ctrl+D,
   * cancelarLeitura). `historico: false` para respostas (o "yes" não vai para as setas).
   */
  function ler({ prompt: texto = '', pasta, rotulo: nome = ROTULO_PADRAO, historico: noHistorico = pasta !== undefined } = {}) {
    if (leitura) terminar(null);
    if (pasta !== undefined) rotulo.innerHTML = prompt(pasta);
    else rotulo.textContent = texto;
    campo.setAttribute('aria-label', nome);
    campo.value = '';
    campo.disabled = animando;
    posicao = lista.length;
    if (tinhaFoco || document.activeElement === caixa) campo.focus();
    return new Promise((resolve) => {
      leitura = { prompt: pasta !== undefined ? textoDoPrompt(pasta) : texto, pasta, historico: noHistorico, resolve };
    });
  }

  function tab() {
    const opcoes = completar(campo.value);
    if (!opcoes.length) return;
    if (opcoes.length === 1) {
      campo.value = `${opcoes[0]} `;
      return;
    }
    const comum = prefixoComum(opcoes);
    if (comum.length > campo.value.length) {
      campo.value = comum;
      return;
    }
    // Várias opções: lista como o bash (só a palavra que muda).
    const nomes = opcoes.map((o) => o.slice(o.lastIndexOf(' ', o.length - 2) + 1));
    ecoar(campo.value);
    escrever(`${nomes.join('  ')}\n`);
  }

  function sair() {
    const focaveis = [...document.querySelectorAll(FOCAVEIS)].filter((e) => !caixa.contains(e) && !e.disabled && !e.closest('[hidden]'));
    const depois = focaveis.find((e) => caixa.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
    tinhaFoco = false;
    const alvo = depois ?? focaveis[0];
    if (alvo) alvo.focus();
    else campo?.blur();
  }

  caixa.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const tecla = e.key.toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (animando) pular();
      else if (campo) sair();
      return;
    }
    if (!campo || !leitura) return;
    if (ctrl && tecla === 'l') {
      e.preventDefault();
      limpar();
    } else if (ctrl && tecla === 'c') {
      if (campo.selectionStart !== campo.selectionEnd) return; // com texto selecionado, é copiar
      e.preventDefault();
      ecoar(`${campo.value}^C`);
      terminar(null);
    } else if (ctrl && tecla === 'd') {
      if (campo.value) return;
      e.preventDefault();
      ecoar('');
      terminar(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const texto = campo.value;
      ecoar(texto);
      if (leitura.historico) guardar(texto);
      terminar(texto);
    } else if (e.key === 'Tab' && !e.shiftKey && campo.value.trim()) {
      // Com algo digitado, o Tab completa (como no bash). Com o campo vazio, ele segue para o
      // próximo controle da página: o terminal não prende quem usa só o teclado (WCAG 2.1.2).
      e.preventDefault();
      tab();
    } else if (e.key === 'ArrowUp' && leitura.historico) {
      e.preventDefault();
      if (posicao > 0) campo.value = lista[--posicao];
    } else if (e.key === 'ArrowDown' && leitura.historico) {
      e.preventDefault();
      if (posicao < lista.length) posicao++;
      campo.value = lista[posicao] ?? '';
    }
  });

  // Clicar no terminal põe o foco no campo (mas deixa selecionar texto para copiar).
  caixa.addEventListener('click', () => {
    if (campo && leitura && !campo.disabled && !String(globalThis.getSelection?.() ?? '')) campo.focus();
  });

  return {
    mostrar,
    escrever,
    ler,
    limpar,
    /** Termina a animação na hora, com toda a saída na tela. */
    pular,
    /** Cancela a leitura aberta (resolve com null). */
    cancelarLeitura() { if (leitura) terminar(null); },
    focar() { if (campo) (leitura && !campo.disabled ? campo : caixa).focus(); },
    /** Mostra um texto simples (erro interno do simulador). */
    texto(t) { escrever(`${t}\n`, 'erro'); },
    /**
     * O terminal é uma região viva (o leitor fala a saída dos comandos digitados). Quando o
     * resultado já é falado em resumo (#anuncio, pelos botões e atalhos), ele fica mudo por um
     * instante: o leitor ouve o resultado uma vez só.
     */
    silenciar(ms = 1500) {
      clearTimeout(silencio);
      pre.setAttribute('aria-live', 'off');
      silencio = setTimeout(() => pre.setAttribute('aria-live', 'polite'), ms);
    },
    get animando() { return animando; },
    get ocupado() { return leitura !== null; },
  };
}
