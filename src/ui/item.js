// Tela de uma lição, exercício ou do playground livre.
// O terminal é interativo: a pessoa digita os comandos do Terraform no prompt (src/tf/
// comandos.js roda o simulador no próprio navegador). ▶ Plan, ✔ Apply e 🗑 Destroy são
// atalhos que digitam o comando (com o terraform init antes, quando precisa). O estado
// (terraform.tfstate simulado) fica salvo por exercício e workspace.
import { minutosDoItem } from '../cargaHoraria.js';
import { buscarItem, modulos, vizinhos, DIFICULDADES } from '../conteudo/trilha.js';
import { linkItem, linkCompartilhado } from '../compartilhar.js';
import { corrigir } from '../corrigir.js';
import { linhaDoComando, comoTfstate, formatarValor } from '../tf/saida.js';
import { rodarComando, precisaDeInit, completarComando } from '../tf/comandos.js';
import { buscarTipo } from '../tf/esquema/index.js';
import {
  statusDe, marcar, lerRascunho, gravarRascunho, apagarRascunho, lerEstado, gravarEstado, apagarEstado,
  lerInicializado, gravarInicializado, lerHistorico, gravarHistorico,
} from '../progresso.js';
import { EditorArquivos } from './editor.js';
import { iniciarLeitura } from './acessibilidade.js';
import { aplicarChecklist } from './neuro.js';
import { desenharGrafo } from './grafo.js';
import { criarTerminal } from './terminal.js';
import { termosDoTexto } from '../conteudo/glossario.js';
import { descreverRegra, categoriaDe } from '../verificacoes.js';
import { jornadaAtual, certificadosDaJornada } from './inicio.js';
import { CERTIFICADOS } from '../certificados.js';
import { LIMITE_DESBLOQUEIO } from '../gamificacao.js';
import { $, esc } from './util.js';
import { anunciar, falaDosTestes, leitorDeTela, frase } from './anuncios.js';
import { solucaoLiberada, minutosQueFaltam, criarCronometro } from './solucao.js';

const semPressao = () => document.documentElement.classList.contains('a11y-sem-pressao');
const esperar = () => new Promise((r) => setTimeout(r, 0));

export function criarTelaItem({ layout, definirStatus, aoMudarProgresso }) {
  const el = {
    anterior: $('item-anterior'),
    proximo: $('item-proximo'),
    modulo: $('item-modulo'),
    titulo: $('item-titulo'),
    dificuldade: $('item-dificuldade'),
    status: $('item-status'),
    executar: $('btn-executar'),
    apply: $('btn-apply'),
    destroy: $('btn-destroy'),
    enviar: $('btn-enviar'),
    resetarEstado: $('btn-resetar-estado'),
    restaurar: $('btn-restaurar'),
    compartilhar: $('btn-compartilhar'),
    abaDocs: $('aba-docs'),
    abaSolucao: $('aba-solucao'),
    abaTestes: $('aba-testes'),
    resumoTestes: $('resumo-testes'),
    enunciado: $('desc-enunciado'),
    docs: $('desc-docs'),
    solucao: $('desc-solucao'),
    testes: $('saida-testes'),
    terminal: $('saida-terminal'),
    janelaTerminal: $('janela-terminal'),
    tituloTerminal: $('titulo-terminal'),
    pular: $('btn-pular'),
    grafo: $('saida-grafo'),
    estado: $('saida-estado'),
    saidas: $('saida-saidas'),
    contadorEstado: $('contador-estado'),
    workspace: $('workspace'),
  };

  const estado = { item: null, ocupado: false, origem: null, ultimo: null, ultimoComando: null };

  // O terminal: a animação de sempre + o prompt digitável (histórico, Tab, Ctrl+C/D/L, Esc).
  const terminal = criarTerminal(el.terminal, {
    aoMudar: (animando) => { el.pular.hidden = !animando; },
    campo: $('campo-terminal'),
    rotulo: $('prompt-terminal'),
    historico: lerHistorico(),
    aoMudarHistorico: gravarHistorico,
    completar: (texto) => (estado.item ? completarComando(texto, criarCtx(estado.item, shell.vez)) : []),
  });
  el.pular.onclick = () => terminal.pular();

  let salvarTimer;
  const editor = new EditorArquivos({
    abas: $('abas-arquivos'),
    editor: $('editor'),
    aoExecutar: () => executarPeloAluno(),
    aoEnviar: () => enviar(),
    aoMudar: (arquivos) => {
      clearTimeout(salvarTimer);
      const id = estado.item.id;
      salvarTimer = setTimeout(() => gravarRascunho(id, arquivos), 300);
    },
  });

  // 🔊 Ouvir: lê a aba visível do painel de descrição.
  const leitura = iniciarLeitura($('btn-ouvir'), () =>
    [el.titulo.textContent, ...Object.values(paineisDesc).filter((p) => !p.hidden).map((p) => p.innerText)].join('. '));

  const ehProblema = () => estado.item?.tipo === 'problema';
  const ehLivre = () => estado.item?.tipo === 'livre';

  // ---------- abas ----------
  const paineisDesc = { enunciado: el.enunciado, docs: el.docs, solucao: el.solucao, testes: $('desc-testes') };
  function mostrarDesc(nome) {
    for (const [chave, painel] of Object.entries(paineisDesc)) painel.hidden = chave !== nome;
    document.querySelectorAll('[data-desc]').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.desc === nome);
      b.setAttribute('aria-selected', String(b.dataset.desc === nome));
    });
    if (nome === 'docs') renderDocs();
  }
  document.querySelectorAll('[data-desc]').forEach((b) => { b.onclick = () => mostrarDesc(b.dataset.desc); });

  // ---------- aba Solução: só depois do tempo estimado e se não resolvido (veja solucao.js) ----------
  function avisoDaSolucao(item) {
    if (item?.tipo !== 'problema' || solucaoLiberada(item) || statusDe(item.id) === 'resolvido') return '';
    const quando = semPressao()
      ? 'depois de um tempo tentando'
      : `depois de ~${minutosDoItem(item)} min tentando (faltam ${minutosQueFaltam(item)} min)`;
    return `<p class="licao-chip aviso-solucao" id="aviso-solucao">🔒 A solução aparece ${quando}. Tentar antes é o que faz aprender.</p>`;
  }

  function atualizarSolucao({ avisar = false } = {}) {
    const item = estado.item;
    if (!item) return;
    const liberada = solucaoLiberada(item);
    const estava = !el.abaSolucao.hidden;
    el.abaSolucao.hidden = !liberada;
    if (!liberada && !paineisDesc.solucao.hidden) mostrarDesc('enunciado');
    const aviso = document.getElementById('aviso-solucao');
    if (aviso) aviso.outerHTML = avisoDaSolucao(item);
    if (liberada && !estava && avisar) anunciar('A solução deste exercício está disponível na aba Solução.');
  }

  // Conta o tempo de tentativa só com a tela do exercício na frente.
  const cronometro = criarCronometro({
    ativo: () => Boolean(estado.item) && !el.titulo.closest('[hidden]'),
    aoMudar: () => atualizarSolucao({ avisar: true }),
  });

  const saidas = { terminal: el.janelaTerminal, grafo: el.grafo, estado: el.estado, saidas: el.saidas };
  function mostrarSaida(nome) {
    for (const [chave, painel] of Object.entries(saidas)) painel.hidden = chave !== nome;
    document.querySelectorAll('[data-saida]').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.saida === nome);
      b.setAttribute('aria-selected', String(b.dataset.saida === nome));
    });
    if (nome === 'grafo' && estado.ultimo) desenharGrafo(el.grafo, estado.ultimo);
  }
  document.querySelectorAll('[data-saida]').forEach((b) => { b.onclick = () => mostrarSaida(b.dataset.saida); });

  // ---------- estado simulado (por exercício e workspace) ----------
  const chaveEstado = () => `${estado.item.id}@${el.workspace.value}`;
  const estadoAtual = () => lerEstado(chaveEstado());

  // ---------- descrição ----------
  function renderDescricao() {
    const item = estado.item;
    const moduloNoCaminho = jornadaAtual().modulos.find((m) => m.id === item.modulo);
    const avisoBloqueio = moduloNoCaminho && !moduloNoCaminho.desbloqueado ? `
      <div class="etapa-info">🔒 Este módulo ainda está bloqueado no caminho: resolva ${LIMITE_DESBLOQUEIO}% do módulo anterior.
        Você pode praticar aqui, mas siga a trilha na ordem para aproveitar melhor.</div>` : '';
    if (item.tipo !== 'problema') {
      el.enunciado.innerHTML = avisoBloqueio + item.resumo + glossario(item, item.titulo, item.resumo);
      aplicarChecklist(el.enunciado, item.id);
      return;
    }
    const etapa = item.projeto ? `
      <div class="etapa-info">
        <p><b>${esc(item.projeto.icone)} ${esc(item.projeto.titulo)}</b> · etapa ${item.etapa} de ${item.totalEtapas}</p>
        ${estado.origem === 'aluno'
          ? `<p>Você continua do <b>seu código</b> da etapa anterior.
              <button class="btn btn-fantasma btn-pequeno" id="btn-referencia">Usar o código de referência</button></p>`
          : item.etapaAnterior ? '<p>O código inicial é a solução de referência da etapa anterior.</p>' : ''}
      </div>` : '';
    const ocultos = item.testes.filter((t) => t.oculto).length;
    el.enunciado.innerHTML = `
      ${avisoBloqueio}
      ${etapa}
      <ol class="roteiro" aria-label="Como resolver" tabindex="0">
        <li>Leia o que fazer</li><li>Faça uma parte</li><li>▶ Plan</li><li>Confira os ✅</li><li>⬆ Enviar</li>
      </ol>
      <section class="secao secao-fazer"><h2>🎯 O que fazer</h2>${item.enunciado}</section>
      ${glossario(item, item.titulo, item.enunciado, item.dica)}
      ${comoConferir(item.testes)}
      ${ocultos ? `<p class="licao-chip">+ ${ocultos} caso(s) oculto(s) rodam quando você clica em ⬆ Enviar. Eles usam outros valores de variáveis, para conferir que o seu código não está "decorado".</p>` : ''}
      ${avisoDaSolucao(item)}
      <details><summary>💡 Dica</summary><p><code>${esc(item.dica)}</code></p></details>`;
    aplicarChecklist(el.enunciado, item.id);
    $('btn-referencia')?.addEventListener('click', () => {
      if (!confirm('Trocar o seu código pelo código de referência desta etapa?')) return;
      editor.carregar(item.arquivos);
      gravarRascunho(item.id, item.arquivos);
      estado.origem = 'referencia';
      renderDescricao();
      executar();
    });
  }

  /** "Como saber que deu certo": as regras dos casos visíveis, em linguagem simples. */
  function comoConferir(testes) {
    const blocos = testes.filter((t) => !t.oculto).map((t) => {
      const regras = (t.passos ? t.passos.flatMap((p) => p.regras ?? []) : t.regras).map(descreverRegra).filter(Boolean);
      if (!regras.length) return '';
      const onde = t.descricao ? `<code>${esc(t.descricao)}</code>` : 'Ao rodar terraform plan';
      return `<p class="caso-exemplo"><span class="rotulo">${onde}:</span></p>
        <ul>${regras.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
    }).join('');
    return blocos ? `<section class="secao secao-conferir"><h2>✅ Como saber que deu certo</h2>${blocos}</section>` : '';
  }

  /** Palavras técnicas do desafio, cada uma com explicação, analogia e exemplo. */
  function glossario(item, ...textos) {
    const div = document.createElement('div');
    div.innerHTML = textos.join(' ');
    const termos = termosDoTexto(div.textContent, { modulo: item.modulo });
    if (!termos.length) return '';
    return `
      <section class="secao glossario">
        <h2>📚 Palavras técnicas</h2>
        <p class="glossario-ajuda">Toque numa palavra para ver o que ela significa, com uma comparação do dia a dia.</p>
        ${termos.map((t) => `
          <details class="termo">
            <summary><b>${esc(t.termo)}</b><span>${esc(t.definicao)}</span></summary>
            <p class="analogia"><span aria-hidden="true">🧠</span> <b>Pense assim:</b> ${esc(t.analogia)}</p>
            ${t.exemplo ? `<pre class="trecho exemplo-termo"><code>${esc(t.exemplo)}</code></pre>` : ''}
          </details>`).join('')}
      </section>`;
  }

  // ---------- docs: argumentos dos recursos usados no exercício ----------
  function renderDocs() {
    const codigo = [...Object.values(editor.arquivos), ...Object.values(estado.item.solucao ?? {})].join('\n');
    const tipos = [...new Map([...codigo.matchAll(/(resource|data)\s+"([a-z0-9_]+)"/g)].map((m) => [`${m[1]}:${m[2]}`, m])).values()];
    if (!tipos.length) {
      el.docs.innerHTML = '<p>Quando o código tiver blocos resource ou data, os argumentos de cada tipo aparecem aqui.</p>';
      return;
    }
    el.docs.innerHTML = `
      <p class="glossario-ajuda">Argumentos aceitos pelo simulador para os tipos usados aqui. Eles seguem a documentação oficial do provedor (link em cada tipo).</p>
      ${tipos.map(([, modo, tipo]) => {
    const { def, provedor } = buscarTipo(tipo, modo === 'data' ? 'data' : 'managed');
    if (!def) return `<details class="doc-tipo"><summary><code>${esc(tipo)}</code> <span class="chip">não existe no ${esc(provedor?.fonte ?? 'simulador')}</span></summary></details>`;
    const args = Object.entries(def.args).filter(([n]) => n !== 'region');
    const lista = (filtro, rotulo) => {
      const itens = args.filter(filtro);
      return itens.length ? `<h2>${rotulo}</h2><ul class="doc-args">${itens.map(([n, a]) => `<li><code>${esc(n)}</code> <span class="tipo-arg">${esc(a.tipo)}</span>${a.padrao !== undefined ? ` <span class="padrao-arg">padrão: ${esc(JSON.stringify(a.padrao))}</span>` : ''}${a.forcaNova ? ' <span class="chip chip-recria" title="Mudar este valor apaga e recria o recurso">recria</span>' : ''}${a.sensivel ? ' <span class="chip">sensível</span>' : ''}</li>`).join('')}</ul>` : '';
    };
    const blocos = Object.entries(def.blocos);
    return `
          <details class="doc-tipo" open>
            <summary><code>${modo === 'data' ? 'data ' : ''}${esc(tipo)}</code></summary>
            ${def.descricao ? `<p>${esc(def.descricao)}</p>` : ''}
            ${def.docs ? `<p class="doc-link"><a href="${esc(def.docs)}" target="_blank" rel="noopener noreferrer">Documentação no Terraform Registry ↗</a></p>` : ''}
            ${lista(([, a]) => a.obrigatorio, '✳️ Obrigatórios')}
            ${lista(([, a]) => !a.obrigatorio, 'Opcionais')}
            ${blocos.length ? `<h2>Blocos</h2><ul class="doc-args">${blocos.map(([n, b]) => `<li><code>${esc(n)} { ... }</code>${b.min ? ' <span class="chip">obrigatório</span>' : ''}${b.max === 1 ? ' <span class="tipo-arg">no máximo 1</span>' : ''} — ${Object.entries(b.args).map(([an, a]) => `<code>${esc(an)}</code>${a.obrigatorio ? '*' : ''}`).join(', ') || 'livre'}</li>`).join('')}</ul>` : ''}
            <h2>Atributos calculados (só leitura)</h2>
            <p class="doc-calc">${Object.keys(def.calc).map((n) => `<code>${esc(n)}</code>`).join(' ') || '—'}</p>
          </details>`;
  }).join('')}`;
  }

  function renderSolucao() {
    const item = estado.item;
    el.solucao.innerHTML = `
      <p>Tente resolver sozinho antes! Se travar, veja a dica na aba Descrição.</p>
      <button class="btn btn-fantasma" id="btn-revelar">👀 Mostrar solução</button>`;
    $('btn-revelar').onclick = () => {
      el.solucao.innerHTML = `
        ${Object.entries(item.solucao).map(([nome, codigo]) => `<h2>${esc(nome)}</h2><pre class="codigo-solucao">${esc(codigo)}</pre>`).join('')}
        <button class="btn btn-roxo" id="btn-usar-solucao">Copiar para o editor</button>`;
      $('btn-usar-solucao').onclick = () => {
        if (!confirm('Substituir o seu código pela solução?')) return;
        editor.carregar(item.solucao);
        gravarRascunho(item.id, item.solucao);
        executar();
      };
    };
  }

  function renderCabecalho() {
    const item = estado.item;
    const modulo = modulos.find((m) => m.id === item.modulo);
    el.modulo.textContent = item.projeto
      ? `${item.projeto.icone} ${item.projeto.titulo} · ${item.etapa}/${item.totalEtapas}`
      : modulo ? `${modulo.icone} ${modulo.titulo}` : '🧪 Livre';
    el.titulo.textContent = item.titulo;
    el.dificuldade.className = item.tipo === 'problema' ? `dificuldade ${item.dificuldade}` : 'licao-chip';
    el.dificuldade.textContent = item.tipo === 'problema' ? DIFICULDADES[item.dificuldade] : item.tipo === 'licao' ? 'Lição' : '';
    const minutos = minutosDoItem(item);
    if (minutos) el.dificuldade.textContent += ` · ⏱ ~${minutos} min`;
    el.dificuldade.title = minutos ? `Tempo estimado: cerca de ${minutos} minutos (conta na carga horária do certificado)` : '';
    const status = statusDe(item.id);
    el.status.textContent = item.tipo === 'problema' && status === 'resolvido' ? '✅ Resolvido' : status === 'tentado' ? '◐ Tentado' : '';
    el.status.className = 'chip';
    el.status.hidden = !el.status.textContent;

    const { anterior, proximo } = ehLivre() ? {} : vizinhos(item.id);
    for (const [botao, alvo] of [[el.anterior, anterior], [el.proximo, proximo]]) {
      botao.classList.toggle('desativado', !alvo);
      botao.href = alvo ? linkItem(alvo.id) : '#';
      botao.title = alvo ? alvo.titulo : '';
      botao.hidden = ehLivre();
    }
  }

  // ---------- abrir ----------
  function abrir(id, arquivosCompartilhados) {
    const item = buscarItem(id);
    if (!item) return false;
    estado.item = item;
    estado.origem = null;
    estado.ultimo = null;
    let arquivos = arquivosCompartilhados ?? lerRascunho(id);
    // Etapa de projeto: quem resolveu a etapa anterior continua do próprio código.
    if (!arquivos && item.etapaAnterior && statusDe(item.etapaAnterior) === 'resolvido') {
      const anterior = lerRascunho(item.etapaAnterior);
      if (anterior) {
        arquivos = anterior;
        estado.origem = 'aluno';
        gravarRascunho(id, anterior);
      }
    }
    editor.carregar(arquivos ?? item.arquivos);
    el.workspace.value = item.workspace ?? 'default';

    renderCabecalho();
    renderDescricao();
    el.enviar.hidden = !ehProblema();
    el.abaSolucao.hidden = !solucaoLiberada(item);
    cronometro.iniciar(item);
    el.abaTestes.hidden = !ehProblema();
    layout.aplicar();
    leitura.parar();
    if (ehProblema()) {
      renderSolucao();
      renderTestesPendentes();
    }
    el.tituloTerminal.textContent = `aluno@sertao: ~/${item.id}`;
    mostrarDesc('enunciado');
    mostrarSaida('terminal');
    renderEstado();
    // O que estava no terminal do exercício anterior (um apply esperando o yes) é cancelado.
    executar('plan', { abrindo: true });
    return true;
  }

  // ---------- o shell do terminal ----------
  // Cada "vez" é uma sessão do shell: trocar de exercício ou apertar um botão começa outra,
  // e os comandos da anterior param de mexer na tela (um apply esperando o yes é cancelado).
  const shell = { vez: 0, atual: null, animar: false };

  /** O que os comandos (src/tf/comandos.js) usam da tela, enquanto a sessão `vez` valer. */
  function criarCtx(item, vez) {
    const vivo = () => shell.vez === vez && estado.item === item;
    const id = item.id;
    const chave = () => `${id}@${el.workspace.value}`;
    return {
      arquivos: () => ({ ...editor.arquivos }),
      trocarArquivos: (novos) => {
        if (!vivo()) return;
        editor.carregar(novos);
        gravarRascunho(id, novos);
      },
      estado: () => lerEstado(chave()) ?? null,
      gravarEstado: (e) => {
        if (!vivo()) return;
        gravarEstado(chave(), e);
        renderEstado();
      },
      workspace: () => el.workspace.value,
      trocarWorkspace: (nome) => {
        if (!vivo()) return;
        el.workspace.value = nome;
        renderEstado();
      },
      workspaces: () => [...el.workspace.options].map((o) => o.value),
      criarWorkspace: (nome) => {
        if (!vivo()) return;
        el.workspace.add(new Option(nome, nome));
        el.workspace.value = nome;
        renderEstado();
      },
      apagarWorkspace: (nome) => {
        if (!vivo()) return;
        apagarEstado(`${id}@${nome}`);
        [...el.workspace.options].find((o) => o.value === nome)?.remove();
      },
      inicializado: () => lerInicializado(id),
      gravarInicializado: (mapa) => { if (vivo()) gravarInicializado(id, mapa); },
      semente: id,
      mostrar: (linhas) => (vivo() ? terminal.mostrar(linhas, { animar: shell.animar && !el.janelaTerminal.hidden, pasta: id }) : Promise.resolve()),
      escrever: (texto, classe) => { if (vivo()) terminal.escrever(texto, classe); },
      perguntar: (prompt, rotulo) => {
        if (!vivo()) return Promise.resolve(null);
        const resposta = terminal.ler({ prompt, rotulo, historico: false });
        // A pergunta recebe o foco (quem clicou em ✔ Apply digita o yes ali) e é falada.
        terminal.focar();
        if (/yes/.test(rotulo)) anunciar('O Terraform pergunta se pode continuar. Digite yes e aperte Enter para aprovar.');
        return resposta;
      },
      abrirGrafo: (r) => {
        if (!vivo()) return;
        estado.ultimo = r;
        mostrarSaida('grafo');
      },
      aoResultado: (r, comando) => { if (vivo()) depoisDoComando(r, comando); },
      limpar: () => { if (vivo()) terminal.limpar(); },
    };
  }

  /** Roda uma linha no simulador; um erro do próprio simulador vai para o terminal. */
  async function rodarLinha(texto, ctx) {
    try {
      await rodarComando(texto, ctx);
    } catch (erro) {
      console.error(erro);
      ctx.escrever(`Erro interno do simulador: ${erro.message}\n`, 'erro');
      definirStatus('Erro interno do simulador');
    }
  }

  /** O prompt: lê e roda comandos até a sessão mudar. */
  async function laco(item, vez) {
    const ctx = criarCtx(item, vez);
    while (shell.vez === vez && estado.item === item) {
      const linha = await terminal.ler({ pasta: item.id, rotulo: 'Comando do terminal' });
      if (shell.vez !== vez || estado.item !== item) return;
      if (linha === null) continue;
      shell.animar = true; // os comandos digitados também animam
      shell.atual = rodarLinha(linha, ctx);
      await shell.atual;
    }
  }

  /** Para o que estiver no terminal e espera o comando em andamento terminar (sem escrever). */
  async function pararShell() {
    shell.vez++;
    terminal.pular();
    terminal.cancelarLeitura();
    await shell.atual;
  }

  /**
   * Digita os comandos no terminal, um depois do outro, como se a pessoa tivesse digitado
   * (os botões e o abrir do exercício). Depois, o prompt volta.
   */
  async function digitarComandos(textos, { animar = false, limpar = false } = {}) {
    await pararShell();
    const item = estado.item;
    const vez = shell.vez;
    if (limpar) terminal.limpar();
    const ctx = criarCtx(item, vez);
    shell.animar = animar;
    shell.atual = (async () => {
      for (const texto of textos) {
        if (shell.vez !== vez) return;
        await ctx.mostrar([linhaDoComando(texto)]);
        await rodarLinha(texto, ctx);
      }
    })();
    await shell.atual;
    const valendo = shell.vez === vez && estado.item === item;
    if (valendo) laco(item, vez);
    return valendo;
  }

  /** Com o terraform init antes, se o código precisar (pasta nova ou provedor novo). */
  const comInit = (textos) => (precisaDeInit(criarCtx(estado.item, shell.vez)) ? ['terraform init', ...textos] : textos);

  /** Depois de cada plan/apply/destroy (pelos botões ou digitado): estado, outputs, status, progresso. */
  function depoisDoComando(r, comando) {
    estado.ultimo = r;
    estado.ultimoComando = { r, comando };
    renderEstado();
    renderSaidas(r);
    if (!el.grafo.hidden) desenharGrafo(el.grafo, r);
    const resumo = r.plano?.resumo;
    definirStatus(r.ok
      ? `${comando}: ${resumo ? `${resumo.criar} add, ${resumo.alterar} change, ${resumo.destruir} destroy` : 'ok'}`
      : `${comando}: ${r.diagnosticos.filter((d) => d.gravidade === 'erro').length} erro(s)`, { falar: false });
    const item = estado.item;
    if (item.tipo === 'licao' && !statusDe(item.id) && r.ok) {
      marcar(item.id, 'resolvido');
      aoMudarProgresso();
    }
  }

  // ---------- execução ----------

  function renderEstado() {
    const atual = estadoAtual();
    const n = Object.values(atual?.recursos ?? {}).filter((r) => r.modo === 'managed').length;
    el.contadorEstado.textContent = n ? String(n) : '';
    if (!atual || !n) {
      el.estado.innerHTML = `<p class="vazio">O estado está vazio: nada foi criado ainda neste exercício${el.workspace.value !== 'default' ? ` (workspace ${esc(el.workspace.value)})` : ''}.
        Clique em <b>✔ Apply</b> para "criar" os recursos e ver o terraform.tfstate.</p>`;
      return;
    }
    const json = JSON.stringify(comoTfstate(atual), null, 2);
    el.estado.innerHTML = `
      <p>Recursos no estado (workspace <b>${esc(el.workspace.value)}</b>, serial ${atual.serial}):</p>
      <ul class="lista-estado">${Object.entries(atual.recursos).filter(([, r]) => r.modo === 'managed').map(([end, r]) => `<li><code>${esc(end)}</code> <span class="id-estado">${esc(String(r.atributos.id ?? ''))}</span></li>`).join('')}</ul>
      <details><summary>Ver terraform.tfstate (JSON)</summary><pre class="trecho">${esc(json)}</pre></details>
      <p class="nota-estado">⚠️ No mundo real, o arquivo de estado pode conter senhas: nunca o coloque no Git. Use um backend remoto (S3, Azure Storage...).</p>`;
  }

  function renderSaidas(r) {
    const lista = Object.entries(r.saidas ?? {});
    if (!lista.length) {
      el.saidas.innerHTML = '<p class="vazio">Nenhum output. Crie um com: output "nome" { value = ... }</p>';
      return;
    }
    el.saidas.innerHTML = `
      <table class="tabela-saidas"><tr><th>Output</th><th>Valor ${r.comando === 'plan' ? '(planejado)' : ''}</th></tr>
      ${lista.map(([nome, s]) => `<tr><td><code>${esc(nome)}</code></td><td><pre>${esc(s.sensivel ? '(sensitive value)' : formatarValor(s.valor))}</pre></td></tr>`).join('')}
      </table>`;
  }

  /** Executar pedido pelo aluno (botão ou Ctrl+Enter): mostra a aba de testes com o resultado. */
  const executarPeloAluno = () => executar('plan', { abrirTestes: true, animar: true, falar: true });

  /** Abre a aba 🧪 Testes (e a descrição, se estiver oculta). */
  function abrirAbaTestes() {
    if (!ehProblema()) return;
    layout.mostrarDescricao();
    mostrarDesc('testes');
  }

  // Os botões digitam os comandos no terminal. `falar`: só quando a pessoa pediu (botão ou
  // atalho); as execuções automáticas (abrir o exercício, restaurar) não interrompem o leitor
  // de tela. `abrindo`: terraform init + terraform plan, num terminal limpo.
  async function executar(comando = 'plan', { abrirTestes = false, animar = false, falar = false, abrindo = false, antes = [] } = {}) {
    if (!estado.item) return;
    const item = estado.item;
    estado.ultimoComando = null;
    definirStatus(animar ? `terraform ${comando}… (Esc ou ⏩ Pular para ver tudo)` : `terraform ${comando}…`, { falar: false });
    const textos = abrindo ? ['terraform init', 'terraform plan'] : [...antes, ...comInit([`terraform ${comando}`])];
    const valendo = await digitarComandos(textos, { animar, limpar: abrindo });
    if (!valendo || estado.item !== item) return;
    const r = estado.ultimoComando?.comando === comando ? estado.ultimoComando.r : null;
    if (!r) {
      definirStatus(`terraform ${comando}: cancelado ou com erro (veja o terminal)`, { falar: falar && `terraform ${comando} não foi concluído. Veja o terminal.` });
      return;
    }
    const fala = falaDoTerraform(comando, r);
    const comTestes = item.tipo === 'problema' && comando === 'plan';
    if (falar && !comTestes) anunciar(fala);
    if (comTestes) {
      const resultado = await rodarTestes({ incluirOcultos: false });
      if (estado.item !== item) return;
      if (falar) anunciar(`${fala} ${falarTestes(resultado, false, { codigoComErro: !r.ok })}`);
      if (abrirTestes) abrirAbaTestes();
    }
  }

  /** O resultado do comando, falado: o que muda ou os erros (com arquivo e linha). */
  function falaDoTerraform(comando, r) {
    const erros = r.diagnosticos.filter((d) => d.gravidade === 'erro');
    if (erros.length) {
      const lidos = leitorDeTela() ? erros : erros.slice(0, 1);
      return [
        `terraform ${comando} com ${erros.length} ${erros.length === 1 ? 'erro' : 'erros'}.`,
        ...lidos.map((d) => frase(`${d.resumo}${d.detalhe ? `: ${d.detalhe.replace(/[.\s]+$/, '')}` : ''}${d.arquivo ? ` (${d.arquivo}${d.linha ? `, linha ${d.linha}` : ''})` : ''}`)),
      ].join(' ');
    }
    const resumo = r.plano?.resumo;
    const avisos = r.diagnosticos.filter((d) => d.gravidade !== 'erro').length;
    const mudancas = resumo
      ? `${resumo.criar} para criar, ${resumo.alterar} para alterar e ${resumo.destruir} para destruir.`
      : 'sem erros.';
    return `terraform ${comando} concluído: ${mudancas}${avisos ? ` ${avisos} ${avisos === 1 ? 'aviso' : 'avisos'} no terminal.` : ''}`;
  }

  async function rodarTestes({ incluirOcultos }) {
    const item = estado.item;
    await esperar();
    const resultado = await corrigir(item, { ...editor.arquivos }, { incluirOcultos });
    if (estado.item !== item) return resultado;
    renderTestes(resultado, incluirOcultos);
    return resultado;
  }

  // ---------- casos de teste ----------
  // Cada caso vira um card: o cenário (os comandos que o teste roda, como no terminal),
  // o placar e cada verificação com categoria, valor obtido e, se falhar, motivo e dica.
  // Nos casos ocultos, os valores das variáveis e o que passou ficam escondidos.

  /** Os comandos de um caso, como o aluno digitaria no terminal. */
  function linhasDoCenario(cenario, { ocultar = false, estadoAnterior = false } = {}) {
    const valor = (v) => (ocultar ? '…' : typeof v === 'string' ? v : JSON.stringify(v));
    const linhas = [];
    if (estadoAnterior) linhas.push('# antes: terraform apply da versão anterior (o estado já existe)');
    let workspaceAtual = 'default';
    for (const { comando, variaveis, workspace = 'default' } of cenario) {
      if (workspace !== workspaceAtual) {
        linhas.push(`$ terraform workspace select ${ocultar ? '…' : workspace}`);
        workspaceAtual = workspace;
      }
      const vars = Object.entries(variaveis ?? {}).map(([k, v]) => ` -var='${k}=${valor(v)}'`).join('');
      linhas.push(`$ terraform ${comando}${vars}`);
    }
    return linhas;
  }

  /** Cenário a partir da definição do teste (antes de rodar). */
  const cenarioDoTeste = (t) => (t.passos ?? [t]).map((p) => ({
    comando: p.comando ?? 'plan',
    variaveis: p.variaveis ?? t.variaveis,
    workspace: p.workspace ?? t.workspace,
  }));

  /** O que o caso vai conferir (antes de rodar), em linguagem simples. */
  const verificacoesPrevistas = (t) => (t.passos ?? [t]).flatMap((p) => p.regras ?? [])
    .map((regra) => ({ mensagem: descreverRegra(regra) ?? 'Verificação no código', categoria: categoriaDe(regra) }));

  function itemVerificacao(r, situacao) {
    const marca = { ok: '✅', falha: '❌', pendente: '⏳' }[situacao];
    const extras = [
      r.obtido !== undefined && (situacao === 'ok' || situacao === 'falha') ? `<span class="obtido"><b>Obtido:</b> <code>${esc(r.obtido)}</code></span>` : '',
      situacao === 'falha' && r.detalhe ? `<span class="detalhe"><b>Motivo:</b> ${esc(r.detalhe)}</span>` : '',
      situacao === 'falha' && r.dica ? `<span class="dica">💡 ${esc(r.dica)}</span>` : '',
    ].join('');
    return `
      <li class="verificacao ${situacao}">
        <span class="marca" aria-hidden="true">${marca}</span>
        <div>
          <span class="chip-categoria">${esc(r.categoria ?? 'Verificação')}</span>
          <span class="sr">${{ ok: 'passou', falha: 'falhou', pendente: 'ainda não rodou' }[situacao]}: </span>${esc(r.mensagem)}
          ${extras}
        </div>
      </li>`;
  }

  function cardCaso({ nome, teste, resultado }) {
    const oculto = Boolean(teste.oculto);
    const situacao = resultado ? (resultado.ok ? 'ok' : 'falha') : 'pendente';
    const icone = { ok: '✅', falha: '❌', pendente: '⏳' }[situacao];
    const descricao = oculto ? (resultado ? 'caso oculto' : 'rode ⬆ Enviar') : teste.descricao ?? 'terraform plan';
    const cenario = resultado?.cenario ?? cenarioDoTeste(teste);
    const verificacoes = resultado
      ? resultado.resultados.map((r) => ({ ...r, situacao: r.ok ? 'ok' : 'falha' }))
      : verificacoesPrevistas(teste).map((r) => ({ ...r, situacao: 'pendente' }));
    // Nos ocultos, só aparece o que falhou (sem revelar o resto do caso).
    const visiveis = oculto ? verificacoes.filter((r) => r.situacao === 'falha') : verificacoes;
    const passaram = verificacoes.filter((r) => r.situacao === 'ok').length;
    const placar = resultado
      ? `${passaram}/${verificacoes.length} verificações · ${resultado.ms} ms`
      : oculto ? '' : `${verificacoes.length} verificações`;
    const esperaErro = verificacoes.some((r) => r.categoria === 'Execução' && /recusa/.test(r.mensagem));
    return `
      <details class="caso ${situacao}" ${situacao === 'falha' ? 'open' : ''}>
        <summary>${icone} ${nome}<span class="url">${esc(descricao)}</span>${placar ? `<span class="placar">${placar}</span>` : ''}</summary>
        <div class="corpo-caso">
          <p class="rotulo-caso">Cenário${oculto ? ' (valores ocultos)' : ''}</p>
          <pre class="cenario">${linhasDoCenario(cenario, { ocultar: oculto, estadoAnterior: resultado?.estadoAnterior ?? Boolean(teste.antes) }).map(esc).join('\n')}</pre>
          ${resultado?.erroExecucao && !oculto ? `<p class="erro-execucao ${esperaErro ? 'esperado' : ''}">${esperaErro ? '🛑 O Terraform recusou, como o caso espera:' : '⛔ O Terraform parou com erro:'} <code>${esc(resultado.erroExecucao)}</code></p>` : ''}
          ${visiveis.length ? `<p class="rotulo-caso">${resultado ? 'Verificações' : 'O que este caso confere'}</p>
          <ul class="verificacoes">${visiveis.map((r) => itemVerificacao(r, r.situacao)).join('')}</ul>` : ''}
          ${oculto && resultado?.ok ? '<p class="nota-caso">Todas as verificações deste caso passaram.</p>' : ''}
        </div>
      </details>`;
  }

  function nomesDosCasos(testes) {
    let visivel = 0;
    let oculto = 0;
    return testes.map((t) => (t.oculto ? `🔒 Oculto ${++oculto}` : `Caso ${++visivel}`));
  }

  /** Resumo no nome da aba: curto ("✅ 3/3"); o texto completo vai na dica e no leitor de tela. */
  function definirResumo(texto, classe = '') {
    const curto = texto.match(/^[✅❌]\s*\d+\/\d+/)?.[0] ?? (texto.startsWith('rodando') ? '⏳' : '');
    el.resumoTestes.textContent = curto;
    el.resumoTestes.className = `resumo-testes ${classe}`;
    el.abaTestes.title = `Testes: ${texto}`;
    el.abaTestes.setAttribute('aria-label', `Testes: ${texto}`);
  }

  function renderTestesPendentes() {
    const testes = estado.item.testes;
    const nomes = nomesDosCasos(testes);
    el.testes.innerHTML = `
      <p class="veredito-sub"><b>▶ Plan</b> roda os casos visíveis. <b>⬆ Enviar</b> roda todos, inclusive os ocultos, e marca a questão como resolvida.</p>
      <div class="casos">${testes.map((t, i) => cardCaso({ nome: nomes[i], teste: t })).join('')}</div>`;
    definirResumo(`${testes.length} casos · ainda não executado`);
  }

  function renderTestes({ aprovado, relatorio }, envio) {
    const testes = estado.item.testes;
    const nomes = nomesDosCasos(testes);
    const porTeste = new Map(relatorio.map((r, i) => [envio ? testes[i] : testes.filter((t) => !t.oculto)[i], r]));
    const cards = testes.map((t, i) => cardCaso({ nome: nomes[i], teste: t, resultado: porTeste.get(t) })).join('');

    const passaram = relatorio.filter((t) => t.ok).length;
    const gentil = semPressao();
    const titulo = aprovado
      ? (envio ? 'Aceito 🎉 Você acertou a questão!' : 'Casos visíveis passaram')
      : (gentil ? 'Ainda não passou, e tudo bem: errar faz parte' : 'Resposta errada');
    const sub = aprovado && !envio
      ? 'Agora clique em ⬆ Enviar para rodar também os casos ocultos.'
      : gentil && !aprovado
        ? `${passaram} de ${relatorio.length} casos já funcionam. Abra o caso marcado abaixo para ver o próximo ajuste.`
        : `${passaram}/${relatorio.length} casos passaram${envio ? ' (incluindo os ocultos)' : ''}.`;
    const { proximo } = vizinhos(estado.item.id);
    el.testes.innerHTML = `
      <p class="veredito ${aprovado ? 'ok' : 'falha'}">${titulo}</p>
      <p class="veredito-sub">${sub}
      ${aprovado && envio && proximo ? `<a class="btn btn-roxo btn-pequeno proximo-problema" href="${linkItem(proximo.id)}">Próximo: ${esc(proximo.titulo)} ›</a>` : ''}</p>
      <div class="casos">${cards}</div>`;
    definirResumo(
      `${aprovado ? '✅' : '❌'} ${passaram}/${relatorio.length} ${envio ? 'casos (todos)' : 'casos visíveis'}`,
      aprovado ? 'ok' : 'falha',
    );
  }

  /** O que o leitor de tela fala sobre os testes (com os nomes da aba Testes). */
  function falarTestes(resultado, envio, extras = {}) {
    const testes = estado.item.testes;
    const nomes = nomesDosCasos(testes);
    const rodados = envio ? testes : testes.filter((t) => !t.oculto);
    return falaDosTestes(resultado, {
      envio,
      gentil: semPressao(),
      detalhado: leitorDeTela(),
      nomes: rodados.map((t) => nomes[testes.indexOf(t)]),
      ...extras,
    });
  }

  async function enviar() {
    if (!ehProblema() || estado.ocupado) return;
    estado.ocupado = true;
    el.enviar.disabled = true;
    el.testes.innerHTML = '<p class="veredito-sub">Rodando todos os casos de teste…</p>';
    abrirAbaTestes();
    definirResumo('rodando…');
    definirStatus('Enviando…');
    try {
      const resultado = await rodarTestes({ incluirOcultos: true });
      const { aprovado } = resultado;
      let conquista = '';
      marcar(estado.item.id, aprovado ? 'resolvido' : 'tentado');
      renderCabecalho();
      atualizarSolucao();
      aoMudarProgresso();
      const jornada = jornadaAtual();
      const modulo = jornada.modulos.find((m) => m.id === estado.item.modulo);
      if (aprovado && modulo?.concluido) {
        const cert = certificadosDaJornada(jornada).find((c) => c.id === modulo.id);
        const aviso = cert?.liberado
          ? 'Seu certificado da Sertão será cloud está liberado.'
          : `Os certificados são liberados na ordem da trilha: conclua também <b>${esc(CERTIFICADOS[cert?.falta]?.titulo ?? '')}</b> para receber o seu.`;
        conquista = `Você concluiu o módulo ${modulo.titulo}! ${aviso.replace(/<[^>]+>/g, '')}`;
        el.testes.insertAdjacentHTML('afterbegin', `
          <div class="comemoracao">🏆 Você concluiu o módulo <b>${esc(modulo.titulo)}</b>!
            ${aviso}
            <a class="btn btn-roxo btn-pequeno" href="#/trilha">Ver no caminho</a></div>`);
      }
      definirStatus(aprovado ? 'Aceito! 🎉' : semPressao() ? 'Ainda não passou: veja o que falta' : 'Resposta errada', {
        falar: `${falarTestes(resultado, true)} ${conquista}`.trim(),
      });
    } catch (erro) {
      console.error(erro);
      el.testes.innerHTML = `<p class="veredito falha">Erro</p><p class="veredito-sub">${esc(erro.message)}</p>`;
    } finally {
      estado.ocupado = false;
      el.enviar.disabled = false;
    }
  }

  // ---------- eventos ----------
  el.executar.onclick = () => executarPeloAluno();
  // Apply e Destroy digitam o comando: o Terraform mostra o plano e espera o yes no terminal.
  el.apply.onclick = () => executar('apply', { animar: true, falar: true });
  el.destroy.onclick = () => executar('destroy', { animar: true, falar: true });
  el.enviar.onclick = () => enviar();
  el.workspace.onchange = () => {
    renderEstado();
    executar('plan', { animar: true, falar: true, antes: [`terraform workspace select ${el.workspace.value}`] });
  };

  el.restaurar.onclick = () => {
    if (!confirm('Voltar ao código original? Suas alterações serão perdidas.')) return;
    apagarRascunho(estado.item.id);
    editor.carregar(estado.item.arquivos);
    executar();
  };

  el.resetarEstado.onclick = () => {
    if (!confirm('Apagar o estado simulado deste exercício (como se nada tivesse sido criado)?')) return;
    apagarEstado(chaveEstado());
    renderEstado();
    executar();
  };

  el.compartilhar.onclick = async () => {
    const link = `${location.origin}${location.pathname}${linkCompartilhado({ item: estado.item.id, arquivos: editor.arquivos })}`;
    try {
      await navigator.clipboard.writeText(link);
      definirStatus('🔗 Link copiado!');
    } catch {
      prompt('Copie o link:', link);
    }
  };

  el.executar.disabled = false;
  el.enviar.disabled = false;

  return {
    abrir,
    redesenharDescricao: () => estado.item && renderDescricao(),
    /** Saiu da tela do exercício: a animação do terminal termina na hora. */
    sair: () => terminal.pular(),
    terminal,
  };
}
