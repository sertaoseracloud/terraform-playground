// Validador de certificados (#/validar e #/validar/<código>).
// Três jeitos de conferir, em abas:
//   1. Link ou código: certificado, badge do LinkedIn ou só o código. Recalcula a cadeia inteira.
//   2. Impresso ou PDF: nome, certificado, data, selo e selo anterior digitados.
//   3. Arquivo XML: o arquivo baixado na página do certificado (pega edição feita à mão).
// Quem abre um link de validação vê o resultado primeiro; as abas ficam para validar outro.
// A conferência acontece no navegador de quem valida; nada é enviado a servidor.
import {
  CERTIFICADOS, EMISSOR, ORDEM, anteriores, decodificarCertificado, extrairCodigo, validarImpresso, linkCertificado,
  lerCertificadoXml, cadeiaCoerente, conferirAssinaturas, mensagemAssinada, SITE,
} from '../certificados.js';
import { svgBadge } from '../badges.js';
import { textoHoras } from '../cargaHoraria.js';
import { esc, $, dataPorExtenso } from './util.js';
import { modulos } from '../conteudo/trilha.js';
import { lerNome, restaurarItens } from '../progresso.js';
import { planoDeRestauracao, situacaoDoNome, itensDoPlano } from '../restaurar.js';
import { pedirNome } from './inicio.js';
import { anunciar } from './anuncios.js';
import { rota } from '../compartilhar.js';

/** Maior XML aceito: o de um certificado tem poucos KB. */
const MAX_XML = 512 * 1024;

const dataCurta = (data) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');

// Cada situação tem cor e ícone próprios: "não consegui ler" (âmbar) não é o mesmo que
// "foi alterado" (vermelho).
const ICONE = { valido: '✅', invalido: '⚠️', antigo: 'ℹ️', ilegivel: '🤔' };
const SITUACAO = {
  confere: { situacao: 'valido', titulo: 'Certificado válido', texto: 'Este certificado foi emitido pela Sertão será cloud e não foi alterado.' },
  'nao-confere': { situacao: 'invalido', titulo: 'Certificado inválido', texto: 'As informações deste certificado foram alteradas depois da emissão.' },
  ausente: { situacao: 'antigo', titulo: 'Link de versão antiga', texto: 'Este link é de uma versão antiga do site e não pode ser conferido. Peça ao aluno um link atualizado.' },
};

/** Caixa de resultado: ícone (ou o badge), título, explicação e o corpo. */
function caixa({ situacao, titulo, texto, figura = '', corpo = '' }) {
  return `
    <div class="resultado-validacao ${situacao}">
      <div class="resultado-topo">
        ${figura || `<span class="resultado-icone" aria-hidden="true">${ICONE[situacao]}</span>`}
        <div>
          <h2>${esc(titulo)}</h2>
          <p>${texto}</p>
        </div>
      </div>
      ${corpo}
    </div>`;
}

/** Os certificados da trilha até este, como uma linha do tempo (o último é o validado). */
function linhaDaCadeia(blocos) {
  return `
    <h3>Certificados da trilha</h3>
    <ol class="cadeia-validacao">
      ${blocos.map((b, i) => `
        <li class="${i === blocos.length - 1 ? 'atual' : ''}">
          <span class="marcador" aria-hidden="true">✔</span>
          <span class="nome-elo">${esc(CERTIFICADOS[b.modulo].titulo)}</span>
          <time datetime="${esc(b.data)}">${dataCurta(b.data)}</time>
        </li>`).join('')}
    </ol>`;
}

/** Resultado da validação por link (ou código), em HTML. `titulo` troca o título do caso válido. */
export function resultadoDoLink(texto, { titulo } = {}) {
  const codigo = extrairCodigo(texto);
  if (!codigo) {
    return caixa({
      situacao: 'ilegivel',
      titulo: 'Não encontrei um certificado aqui',
      texto: 'Cole o link do certificado (…#/certificado/…), o link do badge do LinkedIn (…/badge/…?c=…) ou o código.',
    });
  }
  const cert = decodificarCertificado(codigo);
  if (!cert) {
    return caixa({ situacao: 'ilegivel', titulo: 'Código ilegível', texto: 'O link está incompleto ou foi alterado. Confira se copiou o link inteiro.' });
  }
  const s = SITUACAO[cert.selo];
  const def = CERTIFICADOS[cert.modulo];
  const valido = cert.selo === 'confere';
  const blocos = valido ? [...cert.cadeia, { modulo: cert.modulo, data: cert.data }] : [];
  return caixa({
    situacao: s.situacao,
    titulo: valido && titulo ? titulo : s.titulo,
    texto: s.texto,
    figura: valido ? `<span class="resultado-badge">${svgBadge(cert.modulo, { tamanho: 84 })}</span>` : '',
    corpo: `
      <dl class="dados-validacao">
        <div class="largo"><dt>Aluno</dt><dd>${esc(cert.nome)}</dd></div>
        <div><dt>Certificado</dt><dd>${esc(def.titulo)}</dd></div>
        <div><dt>Concluído em</dt><dd>${dataPorExtenso(cert.data)}</dd></div>
        <div><dt>Carga horária</dt><dd>${textoHoras(def.cargaHoraria)}</dd></div>
        <div><dt>Emitido por</dt><dd>${esc(EMISSOR.organizacao)}</dd></div>
        ${cert.selo !== 'ausente' ? `<div><dt>Código</dt><dd><code>${esc(cert.id)}</code></dd></div>` : ''}
      </dl>
      ${blocos.length > 1 ? linhaDaCadeia(blocos) : ''}
      ${valido ? `<p class="acoes-validacao"><a class="btn btn-roxo btn-pequeno" href="${linkCertificado(cert)}">Abrir o certificado</a></p>` : ''}`,
  });
}

/**
 * Resultado da validação de um XML: valida o código do link (com a chave, aqui no site)
 * e confere se os campos do arquivo batem com ele, para pegar XML editado à mão.
 */
export function resultadoDoXml(texto) {
  const lido = lerCertificadoXml(texto);
  if (lido.erro) return caixa({ situacao: 'ilegivel', titulo: 'XML inválido', texto: esc(lido.erro) });
  const cert = decodificarCertificado(lido.codigo);
  if (!cert || cert.selo !== 'confere') return resultadoDoLink(lido.codigo);
  const { xml } = lido;
  const divergencias = [
    xml.aluno !== cert.nome && 'aluno',
    xml.modulo !== cert.modulo && 'módulo',
    xml.data !== cert.data && 'data de conclusão',
    xml.selo !== cert.hash && 'selo',
    xml.anterior !== cert.anterior && 'selo anterior',
    !cadeiaCoerente(xml.blocos) && 'cadeia (um "anterior" não bate com o selo do bloco de antes)',
    xml.blocos.length !== cert.cadeia.length + 1 && 'número de blocos da cadeia',
  ].filter(Boolean);
  // Assinaturas: chave do arquivo = chave publicada, e cada bloco assinado sobre a mensagem
  // que o certificado emitido gera (não sobre o texto do arquivo, que pode ter sido editado).
  const elos = [...cert.cadeia, { modulo: cert.modulo, data: cert.data, anterior: cert.anterior }];
  const { chaveConfere, todas } = conferirAssinaturas({
    ...xml,
    blocos: xml.blocos.map((b, i) => (elos[i]
      ? { ...b, mensagem: mensagemAssinada({ nome: cert.nome, modulo: elos[i].modulo, data: elos[i].data }, elos[i].anterior) }
      : b)),
  });
  if (!chaveConfere || !todas) divergencias.push('assinatura');
  if (divergencias.length) {
    return caixa({
      situacao: 'invalido',
      titulo: 'XML alterado',
      texto: 'O arquivo foi modificado depois de baixado e não vale como comprovante. Baixe de novo na página do certificado.',
    });
  }
  return resultadoDoLink(lido.codigo, { titulo: 'XML e certificado válidos' });
}

/** Resultado da validação de um certificado impresso, em HTML. */
export function resultadoDoImpresso(dados) {
  const { valido, motivo, incompleto } = validarImpresso(dados);
  if (incompleto) return caixa({ situacao: 'ilegivel', titulo: 'Faltam dados', texto: esc(motivo) });
  const nota = valido && anteriores(dados.modulo).length
    ? '<p class="nota-validacao">Para conferir também os certificados anteriores da trilha, use a aba "Link ou código".</p>'
    : '';
  return caixa({ situacao: valido ? 'valido' : 'invalido', titulo: valido ? 'Selo confere' : 'Não confere', texto: esc(motivo), corpo: nota });
}

const contar = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * Bloco "Restaurar o progresso" de um certificado válido. O progresso só volta se o nome
 * salvo neste navegador for igual ao do certificado (acentos e maiúsculas contam).
 */
export function blocoRestaurar(cert, codigo, nomeSalvo = lerNome()) {
  const situacao = situacaoDoNome(cert, nomeSalvo);
  let corpo;
  if (situacao === 'sem-nome') {
    corpo = `
      <p>Este certificado pode trazer o seu progresso de volta para este navegador. Antes, salve aqui o seu nome
        <b>exatamente como está no certificado</b>, com os mesmos acentos e maiúsculas.</p>
      <p><button type="button" class="btn btn-roxo btn-pequeno" data-nome-restaurar>✏️ Salvar o meu nome</button></p>`;
  } else if (situacao === 'nome-diferente') {
    corpo = `
      <p>O progresso só volta quando o nome salvo neste navegador é igual ao do certificado, com os mesmos acentos e maiúsculas.</p>
      <dl class="dados-validacao">
        <div class="largo"><dt>No certificado</dt><dd>${esc(cert.nome)}</dd></div>
        <div class="largo"><dt>Neste navegador</dt><dd>${esc(String(nomeSalvo).trim())}</dd></div>
      </dl>
      <p><button type="button" class="btn btn-roxo btn-pequeno" data-nome-restaurar>✏️ Trocar o nome deste navegador</button></p>`;
  } else {
    const plano = planoDeRestauracao(cert, modulos);
    corpo = `
      <p>Estes módulos voltam como concluídos, nas datas do certificado. Nada do que já está neste navegador é apagado.</p>
      <ul class="lista-restaurar">
        ${plano.map((b) => `<li><b>${esc(b.titulo)}</b> · ${contar(b.exercicios, 'exercício', 'exercícios')} e ${contar(b.licoes, 'lição', 'lições')} · concluído em ${dataCurta(b.data)}</li>`).join('')}
      </ul>
      <p><button type="button" class="btn btn-verde" data-restaurar>↩️ Restaurar o meu progresso neste navegador</button></p>`;
  }
  return `
    <section class="restaurar-progresso" data-codigo="${esc(codigo)}">
      <h3 tabindex="-1">↩️ Restaurar o progresso neste navegador</h3>
      ${corpo}
    </section>`;
}

/** Resultado do link com o bloco de restaurar (só quando o selo confere). */
function resultadoComRestauracao(texto) {
  const codigo = extrairCodigo(texto);
  const cert = codigo && decodificarCertificado(codigo);
  return resultadoDoLink(texto) + (cert?.selo === 'confere' ? blocoRestaurar(cert, codigo) : '');
}

/** Cliques do bloco: salvar o nome (e redesenhar) ou restaurar. */
function ligarRestauracao(el, aoRestaurar) {
  el.onclick = async (e) => {
    const bloco = e.target.closest('.restaurar-progresso');
    if (!bloco) return;
    const { codigo } = bloco.dataset;
    const cert = decodificarCertificado(codigo);
    const redesenhar = () => {
      const novo = document.createRange().createContextualFragment(blocoRestaurar(cert, codigo)).firstElementChild;
      bloco.replaceWith(novo);
      novo.querySelector('h3').focus();
    };
    if (e.target.closest('[data-nome-restaurar]')) {
      await pedirNome();
      redesenhar();
      return;
    }
    if (!e.target.closest('[data-restaurar]')) return;
    if (situacaoDoNome(cert, lerNome()) !== 'pode') { redesenhar(); return; } // o nome mudou noutra aba
    const plano = planoDeRestauracao(cert, modulos);
    const ok = restaurarItens(itensDoPlano(plano));
    const texto = ok
      ? `Pronto: ${contar(plano.length, 'módulo voltou', 'módulos voltaram')} para este navegador, com as datas do certificado.`
      : 'Este navegador não deixou o site guardar o progresso (aba anônima ou dados bloqueados). Tente numa janela normal.';
    bloco.innerHTML = `
      <h3 tabindex="-1">↩️ Restaurar o progresso neste navegador</h3>
      <p>${ok ? '✅' : '⚠️'} ${esc(texto)}</p>
      ${ok ? `<p><a class="btn btn-roxo btn-pequeno" href="${rota('trilha')}">Ir para a trilha</a></p>` : ''}`;
    // Foco no próximo passo: o link da trilha; se não deu certo, o título do aviso.
    (bloco.querySelector('a') ?? bloco.querySelector('h3')).focus();
    anunciar(texto);
    if (ok) aoRestaurar();
  };
}

const METODOS = [
  { id: 'link', rotulo: 'Link ou código', icone: '🔗' },
  { id: 'impresso', rotulo: 'Impresso ou PDF', icone: '🖨️' },
  { id: 'xml', rotulo: 'Arquivo XML', icone: '📄' },
];

function htmlPagina(temResultadoInicial) {
  const abas = METODOS.map((m, i) => `
    <button type="button" role="tab" class="aba-validacao" id="aba-val-${m.id}" aria-controls="painel-val-${m.id}"
      aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span aria-hidden="true">${m.icone}</span> ${m.rotulo}</button>`).join('');
  return `
    <article class="pagina-texto validador">
      <p class="voltar-trilha"><a href="${rota()}">← Página inicial</a></p>
      <header class="cabecalho-validador">
        <h1>🔎 Validar certificado</h1>
        <p>Confira se um certificado ou badge da <b>${esc(EMISSOR.organizacao)}</b> é autêntico.</p>
        <p class="selo-privacidade"><span aria-hidden="true">🔒</span> A conferência é feita aqui mesmo, no seu navegador: nada é enviado para nenhum lugar.</p>
      </header>

      ${temResultadoInicial ? '<section id="resultado-inicial" class="resultado-inicial" aria-live="polite" aria-label="Resultado da validação"></section>' : ''}

      <section class="cartao-validacao" aria-labelledby="titulo-metodos">
        <h2 id="titulo-metodos">${temResultadoInicial ? 'Validar outro certificado' : 'Como você recebeu o certificado?'}</h2>
        <div class="abas-validacao" role="tablist" aria-label="Forma de validar">${abas}</div>

        <div class="painel-validacao" id="painel-val-link" role="tabpanel" aria-labelledby="aba-val-link">
          <form id="form-link" class="form-validacao">
            <label for="campo-link">Link do certificado, link do badge do LinkedIn ou código</label>
            <textarea id="campo-link" rows="3" spellcheck="false" autocomplete="off"
              placeholder="${SITE}#/certificado/…"></textarea>
            <button class="btn btn-verde">🔎 Validar</button>
          </form>
          <div id="saida-link" class="saida-validacao" aria-live="polite"></div>
        </div>

        <div class="painel-validacao" id="painel-val-impresso" role="tabpanel" aria-labelledby="aba-val-impresso" hidden>
          <p class="a11y-ajuda">Digite os dados exatamente como aparecem no certificado, inclusive acentos.
            O "Selo" e o "Anterior" ficam no rodapé, embaixo da data.</p>
          <form id="form-impresso" class="form-validacao grade-validacao">
            <label class="largo">Nome do aluno <input name="nome" autocomplete="off" required maxlength="80"></label>
            <label>Certificado
              <select name="modulo" required>
                ${ORDEM.map((id) => `<option value="${id}">${esc(CERTIFICADOS[id].titulo)}</option>`).join('')}
              </select>
            </label>
            <label>Concluído em <input name="data" type="date" required></label>
            <label class="largo">Selo <span class="contador-hash" data-para="selo" aria-hidden="true">0/64</span>
              <input name="selo" spellcheck="false" autocomplete="off" required maxlength="90" aria-describedby="ajuda-hash"></label>
            <label class="largo" id="rotulo-anterior">Anterior <span class="contador-hash" data-para="anterior" aria-hidden="true">0/64</span>
              <input name="anterior" spellcheck="false" autocomplete="off" maxlength="90" aria-describedby="ajuda-hash"></label>
            <p class="nota-validacao largo" id="ajuda-hash">64 caracteres, letras de a a f e números. Espaços e maiúsculas não importam.</p>
            <button class="btn btn-verde">🔎 Validar</button>
          </form>
          <div id="saida-impresso" class="saida-validacao" aria-live="polite"></div>
        </div>

        <div class="painel-validacao" id="painel-val-xml" role="tabpanel" aria-labelledby="aba-val-xml" hidden>
          <p class="a11y-ajuda">Use o arquivo baixado na página do certificado, no botão "📄 Baixar XML".</p>
          <form id="form-xml" class="form-validacao">
            <label class="campo-arquivo">Escolher arquivo
              <input type="file" id="arquivo-xml" accept=".xml,application/xml,text/xml"></label>
            <label for="campo-xml">ou colar o conteúdo</label>
            <textarea id="campo-xml" rows="4" spellcheck="false" placeholder="&lt;?xml version=&quot;1.0&quot; …"></textarea>
            <button class="btn btn-verde">🔎 Validar</button>
          </form>
          <div id="saida-xml" class="saida-validacao" aria-live="polite"></div>
        </div>
      </section>
    </article>`;
}

/** Abas acessíveis: clique, setas, Home e End (padrão WAI-ARIA de abas). */
function ligarAbas(raiz) {
  const abas = [...raiz.querySelectorAll('[role="tab"]')];
  const selecionar = (aba, focar = false) => {
    for (const a of abas) {
      const ativa = a === aba;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      $(a.getAttribute('aria-controls')).hidden = !ativa;
    }
    if (focar) aba.focus();
  };
  abas.forEach((aba, i) => {
    aba.onclick = () => selecionar(aba);
    aba.onkeydown = (e) => {
      const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
      if (destino === undefined) return;
      e.preventDefault();
      selecionar(abas[(destino + abas.length) % abas.length], true);
    };
  });
}

/** Mostra o resultado e o traz para a tela (no celular ele pode ficar abaixo da dobra). */
function mostrar(saida, html) {
  saida.innerHTML = html;
  const reduzir = document.documentElement.classList.contains('a11y-sem-movimento');
  saida.firstElementChild?.scrollIntoView?.({ block: 'nearest', behavior: reduzir ? 'auto' : 'smooth' });
}

export function renderValidador(el, codigoInicial = '', { aoRestaurar = () => {} } = {}) {
  el.innerHTML = htmlPagina(Boolean(codigoInicial));
  ligarAbas(el);
  ligarRestauracao(el, aoRestaurar);

  // 1. Link ou código. Mudou o texto? O resultado antigo some (não vale para o texto novo).
  const campoLink = $('campo-link');
  const saidaLink = $('saida-link');
  campoLink.oninput = () => { saidaLink.innerHTML = ''; };
  $('form-link').onsubmit = (e) => {
    e.preventDefault();
    mostrar(saidaLink, resultadoComRestauracao(campoLink.value));
  };

  // 2. Impresso ou PDF.
  const form = $('form-impresso');
  const saidaImpresso = $('saida-impresso');
  const rotuloAnterior = $('rotulo-anterior');
  const atualizarAnterior = () => {
    // O primeiro da cadeia não tem "Anterior".
    rotuloAnterior.hidden = anteriores(form.modulo.value).length === 0;
  };
  form.modulo.onchange = atualizarAnterior;
  atualizarAnterior();
  for (const contador of el.querySelectorAll('.contador-hash')) {
    const campo = form.elements[contador.dataset.para];
    campo.addEventListener('input', () => {
      const n = campo.value.toLowerCase().replace(/[^0-9a-f]/g, '').length;
      contador.textContent = `${n}/64`;
      contador.classList.toggle('completo', n === 64);
    });
  }
  form.oninput = () => { saidaImpresso.innerHTML = ''; };
  form.onsubmit = (e) => {
    e.preventDefault();
    mostrar(saidaImpresso, resultadoDoImpresso(Object.fromEntries(new FormData(form))));
  };

  // 3. Arquivo XML.
  const campoXml = $('campo-xml');
  const saidaXml = $('saida-xml');
  campoXml.oninput = () => { saidaXml.innerHTML = ''; };
  $('arquivo-xml').onchange = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (arquivo.size > MAX_XML) {
      mostrar(saidaXml, caixa({ situacao: 'ilegivel', titulo: 'Arquivo grande demais', texto: 'O XML de um certificado tem poucos KB. Confira se escolheu o arquivo certo.' }));
      return;
    }
    try {
      campoXml.value = await arquivo.text();
      mostrar(saidaXml, resultadoDoXml(campoXml.value));
    } catch {
      mostrar(saidaXml, caixa({ situacao: 'ilegivel', titulo: 'Não consegui ler o arquivo', texto: 'Tente de novo ou cole o conteúdo do XML no campo abaixo.' }));
    }
  };
  $('form-xml').onsubmit = (e) => {
    e.preventDefault();
    mostrar(saidaXml, resultadoDoXml(campoXml.value));
  };

  if (codigoInicial) $('resultado-inicial').innerHTML = resultadoComRestauracao(codigoInicial);
}
