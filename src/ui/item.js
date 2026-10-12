// Tela de uma lição, exercício ou do playground livre.
// ▶ Plan, ✔ Apply e 🗑 Destroy rodam o simulador de Terraform (src/tf/) no próprio
// navegador. O estado (terraform.tfstate simulado) fica salvo por exercício.
import { buscarItem, modulos, vizinhos, DIFICULDADES } from '../conteudo/trilha.js';
import { linkItem, linkCompartilhado } from '../compartilhar.js';
import { corrigir } from '../corrigir.js';
import { executarTerraform } from '../tf/motor.js';
import { linhasDoResultado, comoTfstate, formatarValor } from '../tf/saida.js';
import { buscarTipo } from '../tf/esquema/index.js';
import {
  statusDe, marcar, lerRascunho, gravarRascunho, apagarRascunho, lerEstado, gravarEstado, apagarEstado,
} from '../progresso.js';
import { EditorArquivos } from './editor.js';
import { iniciarLeitura } from './acessibilidade.js';
import { aplicarChecklist } from './neuro.js';
import { desenharGrafo } from './grafo.js';
import { criarTerminal } from './terminal.js';
import { termosDoTexto } from '../conteudo/glossario.js';
import { descreverRegra } from '../verificacoes.js';
import { jornadaAtual, certificadosDaJornada } from './inicio.js';
import { CERTIFICADOS } from '../certificados.js';
import { LIMITE_DESBLOQUEIO } from '../gamificacao.js';
import { $, esc } from './util.js';

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

  const estado = { item: null, ocupado: false, origem: null, ultimo: null };

  // Terminal animado. O primeiro `terraform init` de cada exercício baixa os provedores;
  // os seguintes reaproveitam, como numa pasta de verdade.
  const terminal = criarTerminal(el.terminal, {
    aoMudar: (animando) => { el.pular.hidden = !animando; },
  });
  const iniciados = new Set();
  el.pular.onclick = () => terminal.pular();
  el.terminal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && terminal.animando) {
      e.preventDefault();
      terminal.pular();
    }
  });

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
      <ol class="roteiro" aria-label="Como resolver">
        <li>Leia o que fazer</li><li>Faça uma parte</li><li>▶ Plan</li><li>Confira os ✅</li><li>⬆ Enviar</li>
      </ol>
      <section class="secao secao-fazer"><h2>🎯 O que fazer</h2>${item.enunciado}</section>
      ${glossario(item, item.titulo, item.enunciado, item.dica)}
      ${comoConferir(item.testes)}
      ${ocultos ? `<p class="licao-chip">+ ${ocultos} caso(s) oculto(s) rodam quando você clica em ⬆ Enviar. Eles usam outros valores de variáveis, para conferir que o seu código não está "decorado".</p>` : ''}
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
      return itens.length ? `<h4>${rotulo}</h4><ul class="doc-args">${itens.map(([n, a]) => `<li><code>${esc(n)}</code> <span class="tipo-arg">${esc(a.tipo)}</span>${a.padrao !== undefined ? ` <span class="padrao-arg">padrão: ${esc(JSON.stringify(a.padrao))}</span>` : ''}${a.forcaNova ? ' <span class="chip chip-recria" title="Mudar este valor apaga e recria o recurso">recria</span>' : ''}${a.sensivel ? ' <span class="chip">sensível</span>' : ''}</li>`).join('')}</ul>` : '';
    };
    const blocos = Object.entries(def.blocos);
    return `
          <details class="doc-tipo" open>
            <summary><code>${modo === 'data' ? 'data ' : ''}${esc(tipo)}</code> ${def.docs ? `<a href="${esc(def.docs)}" target="_blank" rel="noopener">registry ↗</a>` : ''}</summary>
            ${def.descricao ? `<p>${esc(def.descricao)}</p>` : ''}
            ${lista(([, a]) => a.obrigatorio, '✳️ Obrigatórios')}
            ${lista(([, a]) => !a.obrigatorio, 'Opcionais')}
            ${blocos.length ? `<h4>Blocos</h4><ul class="doc-args">${blocos.map(([n, b]) => `<li><code>${esc(n)} { ... }</code>${b.min ? ' <span class="chip">obrigatório</span>' : ''}${b.max === 1 ? ' <span class="tipo-arg">no máximo 1</span>' : ''} — ${Object.entries(b.args).map(([an, a]) => `<code>${esc(an)}</code>${a.obrigatorio ? '*' : ''}`).join(', ') || 'livre'}</li>`).join('')}</ul>` : ''}
            <h4>Atributos calculados (só leitura)</h4>
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
    el.abaSolucao.hidden = !ehProblema();
    el.abaTestes.hidden = !ehProblema();
    layout.aplicar();
    leitura.parar();
    if (ehProblema()) {
      renderSolucao();
      renderTestesPendentes();
    }
    terminal.limpar();
    el.tituloTerminal.textContent = `aluno@sertao: ~/${item.id}`;
    mostrarDesc('enunciado');
    mostrarSaida('terminal');
    renderEstado();
    executar();
    return true;
  }

  // ---------- execução ----------
  /** Mostra a saída; com `animar`, termina quando a animação acaba (ou o aluno pula). */
  function renderTerminal(r, { animar }) {
    const id = estado.item.id;
    const linhas = linhasDoResultado(r, { primeiraVez: !iniciados.has(id) });
    iniciados.add(id);
    return terminal.mostrar(linhas, { animar, pasta: id });
  }

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
  const executarPeloAluno = () => executar('plan', { abrirTestes: true, animar: true });

  /** Abre a aba 🧪 Testes (e a descrição, se estiver oculta). */
  function abrirAbaTestes() {
    if (!ehProblema()) return;
    layout.mostrarDescricao();
    mostrarDesc('testes');
  }

  async function executar(comando = 'plan', { abrirTestes = false, animar = false } = {}) {
    if (!estado.item) return;
    const item = estado.item;
    const arquivos = { ...editor.arquivos };
    definirStatus(`terraform ${comando}…`);
    await esperar();
    const inicio = performance.now();
    let r;
    try {
      r = executarTerraform(arquivos, { comando, estado: estadoAtual(), workspace: el.workspace.value, semente: item.id });
    } catch (erro) {
      console.error(erro);
      terminal.texto(`Erro interno do simulador: ${erro.message}`);
      definirStatus('Erro interno do simulador');
      return;
    }
    if (estado.item !== item) return;
    estado.ultimo = r;
    if ((comando === 'apply' || comando === 'destroy') && r.plano) {
      gravarEstado(chaveEstado(), r.estado);
    }
    const ms = Math.max(1, Math.round(performance.now() - inicio));
    const animarAgora = animar && !el.janelaTerminal.hidden;
    if (animarAgora) definirStatus(`terraform ${comando}… (Esc ou ⏩ Pular para ver tudo)`);
    const animacao = renderTerminal(r, { animar: animarAgora });
    renderEstado();
    renderSaidas(r);
    if (!el.grafo.hidden) desenharGrafo(el.grafo, r);
    await animacao;
    if (estado.item !== item || estado.ultimo !== r) return;
    const resumo = r.plano?.resumo;
    definirStatus(r.ok
      ? `${comando}: ${resumo ? `${resumo.criar} add, ${resumo.alterar} change, ${resumo.destruir} destroy` : 'ok'} · ${ms} ms`
      : `${comando}: ${r.diagnosticos.filter((d) => d.gravidade === 'erro').length} erro(s)`);

    if (item.tipo === 'licao' && !statusDe(item.id) && r.ok) {
      marcar(item.id, 'resolvido');
      aoMudarProgresso();
    }
    if (item.tipo === 'problema' && comando === 'plan') {
      await rodarTestes({ incluirOcultos: false });
      if (abrirTestes && estado.item === item) abrirAbaTestes();
    }
  }

  async function rodarTestes({ incluirOcultos }) {
    const item = estado.item;
    await esperar();
    const resultado = await corrigir(item, { ...editor.arquivos }, { incluirOcultos });
    if (estado.item !== item) return resultado;
    renderTestes(resultado, incluirOcultos);
    return resultado;
  }

  // Cada caso de teste vira um card na aba Testes.
  function cardCaso({ nome, descricao, situacao, resultados = [], oculto }) {
    const icone = { ok: '✅', falha: '❌', pendente: '⏳' }[situacao];
    const url = descricao ? `<span class="url">${esc(descricao)}</span>` : '';
    const regras = resultados
      .filter((r) => !oculto || !r.ok)
      .map((r) => `<li>${r.ok ? '✅' : '❌'} ${esc(r.mensagem)}${!r.ok && r.detalhe ? `<span class="detalhe">${esc(r.detalhe)}</span>` : ''}</li>`)
      .join('');
    return `
      <details class="caso ${situacao}" ${situacao === 'falha' ? 'open' : ''}>
        <summary>${icone} ${nome}${url}</summary>
        ${regras ? `<ul>${regras}</ul>` : ''}
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
      <div class="casos">${testes.map((t, i) => cardCaso({
        nome: nomes[i],
        descricao: t.oculto ? '' : t.descricao ?? 'terraform plan',
        situacao: 'pendente',
      })).join('')}</div>`;
    definirResumo(`${testes.length} casos · ainda não executado`);
  }

  function renderTestes({ aprovado, relatorio }, envio) {
    const testes = estado.item.testes;
    const nomes = nomesDosCasos(testes);
    const porTeste = new Map(relatorio.map((r, i) => [envio ? testes[i] : testes.filter((t) => !t.oculto)[i], r]));
    const cards = testes.map((t, i) => {
      const r = porTeste.get(t);
      return cardCaso({
        nome: nomes[i],
        descricao: t.oculto ? (r ? '' : 'rode ⬆ Enviar') : t.descricao ?? 'terraform plan',
        situacao: r ? (r.ok ? 'ok' : 'falha') : 'pendente',
        resultados: r?.resultados,
        oculto: t.oculto,
      });
    }).join('');

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

  async function enviar() {
    if (!ehProblema() || estado.ocupado) return;
    estado.ocupado = true;
    el.enviar.disabled = true;
    el.testes.innerHTML = '<p class="veredito-sub">Rodando todos os casos de teste…</p>';
    abrirAbaTestes();
    definirResumo('rodando…');
    definirStatus('Enviando…');
    try {
      const { aprovado } = await rodarTestes({ incluirOcultos: true });
      marcar(estado.item.id, aprovado ? 'resolvido' : 'tentado');
      renderCabecalho();
      aoMudarProgresso();
      const jornada = jornadaAtual();
      const modulo = jornada.modulos.find((m) => m.id === estado.item.modulo);
      if (aprovado && modulo?.concluido) {
        const cert = certificadosDaJornada(jornada).find((c) => c.id === modulo.id);
        const aviso = cert?.liberado
          ? 'Seu certificado da Sertão será cloud está liberado.'
          : `Os certificados são liberados na ordem da trilha: conclua também <b>${esc(CERTIFICADOS[cert?.falta]?.titulo ?? '')}</b> para receber o seu.`;
        el.testes.insertAdjacentHTML('afterbegin', `
          <div class="comemoracao" role="status">🏆 Você concluiu o módulo <b>${esc(modulo.titulo)}</b>!
            ${aviso}
            <a class="btn btn-roxo btn-pequeno" href="#/trilha">Ver no caminho</a></div>`);
      }
      definirStatus(aprovado ? 'Aceito! 🎉' : semPressao() ? 'Ainda não passou: veja o que falta' : 'Resposta errada');
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
  el.apply.onclick = () => executar('apply', { animar: true });
  el.destroy.onclick = () => {
    if (!Object.keys(estadoAtual()?.recursos ?? {}).length) {
      definirStatus('O estado está vazio: não há nada para destruir.');
      return;
    }
    if (confirm('terraform destroy: apagar todos os recursos do estado simulado deste exercício?')) executar('destroy', { animar: true });
  };
  el.enviar.onclick = () => enviar();
  el.workspace.onchange = () => {
    renderEstado();
    executar('plan', { animar: true });
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
  };
}
