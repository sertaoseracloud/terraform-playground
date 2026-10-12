// Tela inicial em formato de caminho (gamificação): painel do jogador com nível,
// XP, sequência de dias e certificados; e a trilha em zigue-zague, com unidades
// que desbloqueiam aos 70% e um troféu (certificado) no fim de cada módulo.
import { modulos, problemas, itens, DIFICULDADES } from '../conteudo/trilha.js';
import { linkItem } from '../compartilhar.js';
import { calcularJornada, sequenciaDeDias, LIMITE_DESBLOQUEIO, NIVEIS } from '../gamificacao.js';
import { CERTIFICADOS, ORDEM, linkCertificado } from '../certificados.js';
import { svgBadge } from '../badges.js';
import { textoHoras } from '../cargaHoraria.js';
import { statusDe, dataDe, diasAtivos, hoje, lerNome, gravarNome } from '../progresso.js';
import { esc, $ } from './util.js';

// No celular, a lista de certificados começa fechada para o caminho aparecer logo.
const MOSTRAR_CERTIFICADOS = () => !window.matchMedia?.('(max-width: 760px)').matches;

// Deslocamento horizontal dos nós, para o caminho serpentear.
const ZIGUEZAGUE = [0, 44, 76, 44, 0, -44, -76, -44];

const ICONE = { licao: '📖', facil: '⭐', medio: '🔥', dificil: '💎' };

export function jornadaAtual() {
  return calcularJornada({ modulos, statusDe, dataDe });
}

/** Exercícios resolvidos e lições lidas (contados separados: o caminho mostra os dois). */
export function resumoProgresso() {
  const resolvidos = problemas.filter((p) => statusDe(p.id) === 'resolvido');
  const licoes = itens.filter((i) => i.tipo === 'licao');
  return {
    resolvidos: resolvidos.length,
    total: problemas.length,
    lista: resolvidos,
    licoesLidas: licoes.filter((l) => statusDe(l.id) === 'resolvido').length,
    totalLicoes: licoes.length,
  };
}

// ---------- nome do aluno (para os certificados) ----------

function pedirNome({ obrigatorio = false } = {}) {
  const dialogo = $('dialogo-nome');
  const campo = $('campo-nome');
  campo.value = lerNome();
  $('btn-cancelar-nome').onclick = () => dialogo.close('cancelar');
  dialogo.returnValue = '';
  dialogo.showModal();
  campo.focus();
  return new Promise((resolve) => {
    dialogo.addEventListener('close', () => {
      const nome = campo.value.trim();
      if (dialogo.returnValue === 'salvar' && nome) {
        gravarNome(nome);
        resolve(nome);
      } else {
        resolve(obrigatorio ? null : lerNome() || null);
      }
    }, { once: true });
  });
}

/**
 * Situação de cada certificado, na ordem da cadeia. Um certificado só é liberado
 * quando o módulo foi concluído E todos os anteriores da cadeia também, porque o
 * selo dele inclui o hash do anterior (veja certificados.js).
 */
export function certificadosDaJornada(j = jornadaAtual()) {
  const datas = Object.fromEntries([
    ...j.modulos.map((m) => [m.id, m.concluido ? m.concluidoEm : null]),
    ['final', j.final.concluido ? j.final.concluidoEm : null],
  ]);
  return ORDEM.map((id, i) => {
    const falta = ORDEM.slice(0, i).find((anterior) => !datas[anterior]) ?? null;
    return {
      id,
      titulo: CERTIFICADOS[id].titulo,
      data: datas[id],
      concluido: Boolean(datas[id]),
      liberado: Boolean(datas[id]) && !falta,
      falta,
      cadeia: ORDEM.slice(0, i).map((anterior) => datas[anterior]),
    };
  });
}

async function abrirCertificado(modulo) {
  const cert = certificadosDaJornada().find((c) => c.id === modulo);
  if (!cert?.liberado) return;
  const nome = lerNome() || await pedirNome({ obrigatorio: true });
  if (nome) location.hash = linkCertificado({ nome, modulo, data: cert.data, cadeia: cert.cadeia });
}

// ---------- pedaços da tela ----------

function no(item, i) {
  const deslocamento = ZIGUEZAGUE[i % ZIGUEZAGUE.length];
  // ✔ verde só para exercício resolvido; lição lida continua com 📖 (em outra cor), para a
  // contagem "x/73 exercícios" bater com os ✔ do caminho.
  const licao = item.tipo === 'licao';
  const icone = item.estado === 'bloqueado' ? '🔒'
    : item.estado === 'concluido' ? (licao ? '📖' : '✔')
      : ICONE[licao ? 'licao' : item.dificuldade];
  const tipo = item.tipo === 'licao' ? 'Lição' : DIFICULDADES[item.dificuldade];
  const situacao = { concluido: licao ? ' · lição lida' : ' · exercício resolvido', bloqueado: ' · bloqueado' }[item.estado] ?? '';
  const rotulo = `${item.titulo} · ${tipo} · ${item.xp} XP${situacao}`;
  const conteudo = `
      <span class="circulo" aria-hidden="true">${icone}</span>
      ${item.ehProximo ? `<span class="balao" aria-hidden="true">${item.estado === 'tentado' ? 'CONTINUAR' : 'COMEÇAR'}</span>` : ''}
      <span class="legenda">${esc(item.titulo)}</span>`;
  const alvo = item.estado === 'bloqueado'
    ? `<button type="button" class="alvo" aria-disabled="true" data-bloqueado title="${esc(rotulo)}" aria-label="${esc(rotulo)}">${conteudo}</button>`
    : `<a class="alvo" href="${linkItem(item.id)}" title="${esc(rotulo)}" aria-label="${esc(rotulo)}">${conteudo}</a>`;
  return `<li class="no ${item.tipo} estado-${item.estado}${item.ehProximo ? ' eh-proximo' : ''}" style="--d:${deslocamento}px">${alvo}</li>`;
}

function trofeu(m, cert) {
  const rotulo = CERTIFICADOS[m.id].titulo;
  const espera = cert.concluido && !cert.liberado; // módulo pronto, mas falta um certificado anterior
  const texto = cert.liberado ? 'Ver certificado'
    : espera ? `falta o certificado de ${CERTIFICADOS[cert.falta].titulo}`
      : `${m.resolvidos}/${m.total}`;
  const legenda = cert.liberado ? '🎉 Certificado liberado!'
    : espera ? `🔗 Falta o certificado de ${esc(CERTIFICADOS[cert.falta].titulo)}`
      : `Certificado · ${texto}`;
  return `
    <li class="no trofeu ${cert.liberado ? 'conquistado' : ''} ${espera ? 'em-espera' : ''}" style="--d:0px">
      <button type="button" class="alvo" data-certificado="${m.id}"
        ${cert.liberado ? '' : 'aria-disabled="true"'} aria-label="Certificado: ${esc(rotulo)} (${esc(texto)})">
        <span class="circulo" aria-hidden="true">🏆</span>
        <span class="legenda">${legenda}</span>
      </button>
    </li>`;
}

function unidade(m, anterior, atual, cert) {
  const bloqueio = !m.desbloqueado && anterior
    ? `<p class="aviso-bloqueio">🔒 Resolva ${LIMITE_DESBLOQUEIO}% de ${esc(anterior.titulo)} para desbloquear (agora: ${anterior.pct}%).</p>`
    : '';
  const cabecalho = `
    <header class="unidade" data-modulo="${m.id}">
      <div>
        <p class="unidade-numero">${m.extra ? 'Módulo extra' : `Unidade ${m.indice + 1}`}</p>
        <h2>${m.icone} ${esc(m.titulo)}</h2>
        <p class="unidade-desc">${esc(m.descricao)}</p>
        ${bloqueio}
        ${atual ? '' : `<button type="button" class="btn-link btn-ver-etapas" aria-expanded="false" aria-controls="trilha-${m.id}">Ver etapas</button>`}
      </div>
      <div class="unidade-progresso" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.pct}" aria-label="Progresso em ${esc(m.titulo)}">
        <span class="anel" style="--pct:${m.pct}"><b>${m.pct}%</b></span>
        <span class="unidade-contagem">${m.resolvidos}/${m.total} ${m.grupos ? 'etapas' : 'exercícios'}</span>
        ${(() => {
          const licoes = m.itens.filter((i) => i.tipo === 'licao');
          const lidas = licoes.filter((i) => i.estado === 'concluido').length;
          return licoes.length ? `<span class="unidade-contagem">📖 ${lidas}/${licoes.length} ${licoes.length === 1 ? 'lição' : 'lições'}</span>` : '';
        })()}
        ${CERTIFICADOS[m.id] ? `<span class="unidade-contagem" title="Carga horária do certificado deste módulo">⏱ ${textoHoras(CERTIFICADOS[m.id].cargaHoraria)}</span>` : ''}
      </div>
    </header>`;

  let nos;
  if (m.grupos) {
    nos = m.grupos.map((g) => {
      const doGrupo = m.itens.filter((x) => x.grupo === g.id);
      const prontas = doGrupo.filter((x) => x.tipo === 'problema' && x.estado === 'concluido').length;
      const etapas = doGrupo.filter((x) => x.tipo === 'problema').length;
      return `
        <li class="subunidade"><span>${g.icone} ${esc(g.titulo)}</span> <small>${prontas}/${etapas} etapas</small></li>
        ${doGrupo.map(no).join('')}`;
    }).join('');
  } else {
    nos = m.itens.map(no).join('');
  }
  return `
    <section class="bloco-unidade ${m.desbloqueado ? '' : 'bloqueada'} ${atual ? 'unidade-atual' : ''}" id="unidade-${m.id}" aria-labelledby="titulo-${m.id}">
      ${cabecalho.replace('<h2>', `<h2 id="titulo-${m.id}">`)}
      <ol class="trilha" id="trilha-${m.id}">${nos}${trofeu(m, cert)}</ol>
    </section>`;
}

function painelJogador(j) {
  const nome = lerNome();
  const sequencia = sequenciaDeDias(diasAtivos(), hoje());
  const certificados = certificadosDaJornada(j);
  const emitidos = certificados.filter((c) => c.liberado).length;
  const proximoNivel = j.nivel.proximo
    ? `${j.nivel.faltam} XP para <b>${esc(j.nivel.proximo.nome)}</b>`
    : 'Nível máximo! 🎉';

  return `
    <aside class="painel-jogador" aria-label="Seu progresso">
      <div class="jogador">
        <span class="avatar" aria-hidden="true">${nome ? esc(nome.trim()[0].toUpperCase()) : '🐘'}</span>
        <div>
          <p class="jogador-nome">${nome ? esc(nome) : 'Estudante'}
            <button type="button" class="btn-link" id="btn-nome">${nome ? 'editar' : 'informar nome'}</button></p>
          <p class="jogador-nivel">Nível ${j.nivel.numero} · ${esc(j.nivel.nome)}</p>
        </div>
      </div>
      <div class="barra-xp" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${j.nivel.pct}" aria-label="Progresso até o próximo nível">
        <span style="width:${j.nivel.pct}%"></span>
      </div>
      <p class="xp-legenda">${proximoNivel}</p>

      <div class="estatisticas">
        <div><span class="valor">⭐ ${j.xp}</span><span class="rotulo">XP</span></div>
        <div><span class="valor">🔥 ${sequencia}</span><span class="rotulo">${sequencia === 1 ? 'dia seguido' : 'dias seguidos'}</span></div>
        <div><span class="valor">🏆 ${emitidos}/${certificados.length}</span><span class="rotulo">certificados</span></div>
      </div>

      ${j.proximo
        ? `<a class="btn btn-verde btn-continuar" href="${linkItem(j.proximo.id)}">▶ Continuar<small>${esc(j.proximo.titulo)}</small></a>`
        : '<p class="tudo-feito">🎓 Você concluiu tudo!</p>'}

      <details class="bloco-certificados" ${MOSTRAR_CERTIFICADOS() ? 'open' : ''}>
      <summary class="titulo-certificados">Certificados <small>${emitidos}/${certificados.length}</small></summary>
      <ul class="lista-certificados">
        ${certificados.map((c) => `
          <li>
            <button type="button" class="certificado-slot ${c.liberado ? 'emitido' : ''}" data-certificado="${c.id}"
              ${c.liberado ? '' : 'aria-disabled="true"'} ${c.concluido && !c.liberado ? `title="Falta o certificado de ${esc(CERTIFICADOS[c.falta].titulo)}"` : ''}>
              <span class="mini-badge" aria-hidden="true">${c.liberado ? svgBadge(c.id, { tamanho: 28 }) : c.concluido ? '🔗' : c.id === 'final' ? '🎓' : '🔒'}</span>
              <span>${esc(c.titulo)}</span>
            </button>
          </li>`).join('')}
      </ul>
      </details>
      <p class="nota-niveis">Níveis: ${NIVEIS.map((n) => esc(n.nome)).join(' → ')}</p>
    </aside>`;
}

function diploma(j) {
  const total = j.modulos.length;
  const prontos = j.modulos.filter((m) => m.concluido).length;
  return `
    <section class="bloco-final" aria-label="Certificado final">
      <button type="button" class="diploma ${j.final.concluido ? 'conquistado' : ''}" data-certificado="final"
        ${j.final.concluido ? '' : 'aria-disabled="true"'}>
        <span class="circulo" aria-hidden="true">🎓</span>
        <span class="diploma-titulo">${esc(CERTIFICADOS.final.titulo)}</span>
        <span class="diploma-sub">${j.final.concluido ? 'Emitir certificado de conclusão total' : `${prontos}/${total} módulos concluídos`}</span>
      </button>
    </section>`;
}

// ---------- render ----------

export function renderInicio(el) {
  const j = jornadaAtual();
  const certs = certificadosDaJornada(j);
  // Módulo atual: onde está o próximo passo. No modo foco, só ele mostra as etapas.
  const atual = j.modulos.find((m) => m.itens.some((i) => i.ehProximo))?.id ?? j.modulos.at(-1).id;
  el.innerHTML = `
    <div class="caminho-pagina">
      ${painelJogador(j)}
      <div class="caminho">
        <h1 class="caminho-titulo">Trilha: Terraform do básico à nuvem</h1>
        <p class="legenda-caminho">
          <span><i class="mini ok">✔</i> exercício resolvido</span>
          <span><i class="mini lida">📖</i> lição lida</span>
          <span><i class="mini">⭐</i> fácil · <i class="mini">🔥</i> médio · <i class="mini">💎</i> difícil</span>
          <span>O módulo seguinte abre com ${LIMITE_DESBLOQUEIO}% dos exercícios.</span>
        </p>
        ${j.modulos.map((m, i) => unidade(m, j.modulos[i - 1], m.id === atual, certs[i])).join('')}
        ${diploma(j)}
      </div>
    </div>`;

  el.querySelectorAll('[data-certificado]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return;
      abrirCertificado(b.dataset.certificado);
    });
  });
  el.querySelectorAll('[data-bloqueado]').forEach((b) => {
    b.addEventListener('click', () => {
      const unidadeBloqueada = b.closest('.bloco-unidade').querySelector('.aviso-bloqueio');
      unidadeBloqueada?.classList.remove('chacoalhar');
      void unidadeBloqueada?.offsetWidth;
      unidadeBloqueada?.classList.add('chacoalhar');
    });
  });
  el.querySelectorAll('.btn-ver-etapas').forEach((b) => {
    b.addEventListener('click', () => {
      const aberta = b.closest('.bloco-unidade').classList.toggle('expandida');
      b.setAttribute('aria-expanded', String(aberta));
      b.textContent = aberta ? 'Esconder etapas' : 'Ver etapas';
    });
  });
  $('btn-nome')?.addEventListener('click', async () => {
    await pedirNome();
    renderInicio(el);
  });
  mostrarPassoAtual(el);
}

/**
 * Rola até o passo atual, como nos apps de idiomas, e mostra o botão "📍 Passo atual"
 * sempre que ele sai da tela (ao rolar ou ao mudar o tamanho da janela).
 */
function mostrarPassoAtual(el) {
  const passo = el.querySelector('.eh-proximo');
  if (!passo) return;
  const suave = () => (document.documentElement.classList.contains('a11y-sem-movimento') ? 'auto' : 'smooth');
  const irAoPasso = (behavior = suave()) => passo.scrollIntoView({ block: 'center', behavior });
  irAoPasso('auto');

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'btn btn-roxo ir-passo-atual';
  botao.hidden = true;
  botao.innerHTML = '📍 Passo atual';
  botao.setAttribute('aria-label', `Ir para o passo atual: ${passo.querySelector('.legenda')?.textContent ?? ''}`);
  botao.onclick = () => {
    irAoPasso();
    passo.querySelector('.alvo')?.focus({ preventScroll: true });
  };
  el.append(botao);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entrada]) => {
      botao.hidden = entrada.isIntersecting;
    }, { root: el, threshold: 0.6 }).observe(passo.querySelector('.circulo') ?? passo);
  }
}
