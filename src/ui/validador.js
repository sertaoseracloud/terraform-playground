// Validador de certificados (#/validar e #/validar/<código>).
//   1. Colar o link: certificado, badge do LinkedIn ou só o código. Recalcula a cadeia inteira.
//   2. Certificado impresso/PDF: nome, certificado, data, selo e hash anterior digitados.
// A conferência acontece no navegador de quem valida; nada é enviado a servidor.
import {
  CERTIFICADOS, EMISSOR, ORDEM, anteriores, decodificarCertificado, extrairCodigo, validarImpresso, linkCertificado,
  lerCertificadoXml, cadeiaCoerente, conferirAssinaturas, mensagemAssinada,
} from '../certificados.js';
import { esc, $ } from './util.js';

const dataPorExtenso = (data) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const dataCurta = (data) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');

const SITUACAO = {
  confere: { classe: 'valido', titulo: '✅ Certificado válido', texto: 'Este certificado foi emitido pela Sertão será cloud e não foi alterado.' },
  'nao-confere': { classe: 'invalido', titulo: '⚠️ Certificado inválido', texto: 'As informações deste certificado foram alteradas depois da emissão.' },
  ausente: { classe: 'antigo', titulo: 'ℹ️ Link de versão antiga', texto: 'Este link é de uma versão antiga do site e não pode ser conferido. Peça ao aluno um link atualizado.' },
};

/** Resultado da validação por link, em HTML. */
export function resultadoDoLink(texto) {
  const codigo = extrairCodigo(texto);
  if (!codigo) {
    return `<div class="resultado-validacao invalido" role="status"><h2>Não encontrei um certificado aqui</h2>
      <p>Cole o link do certificado (…#/certificado/…), o link do badge do LinkedIn (…/badge/…?c=…) ou o código.</p></div>`;
  }
  const cert = decodificarCertificado(codigo);
  if (!cert) {
    return `<div class="resultado-validacao invalido" role="status"><h2>⚠️ Código ilegível</h2>
      <p>O link está incompleto ou foi alterado. Confira se copiou o link inteiro.</p></div>`;
  }
  const s = SITUACAO[cert.selo];
  const def = CERTIFICADOS[cert.modulo];
  const blocos = cert.selo === 'confere'
    ? [...cert.cadeia, { modulo: cert.modulo, data: cert.data, hash: cert.hash, anterior: cert.anterior }] : [];
  return `
    <div class="resultado-validacao ${s.classe}" role="status">
      <h2>${s.titulo}</h2>
      <p>${s.texto}</p>
      <dl class="dados-validacao">
        <div><dt>Aluno</dt><dd>${esc(cert.nome)}</dd></div>
        <div><dt>Certificado</dt><dd>${esc(def.titulo)}</dd></div>
        <div><dt>Concluído em</dt><dd>${dataPorExtenso(cert.data)}</dd></div>
        <div><dt>Emitido por</dt><dd>${esc(EMISSOR.organizacao)}</dd></div>
        ${cert.selo !== 'ausente' ? `<div><dt>Código</dt><dd><code>${esc(cert.id)}</code></dd></div>` : ''}
      </dl>
      ${blocos.length > 1 ? `
        <h3>Certificados da trilha</h3>
        <ul class="anteriores">
          ${blocos.map((b) => `<li>✔ ${esc(CERTIFICADOS[b.modulo].titulo)} <span>${dataCurta(b.data)}</span></li>`).join('')}
        </ul>` : ''}
      ${cert.selo === 'confere' ? `<p><a class="btn btn-roxo btn-pequeno" href="${linkCertificado(cert)}">Abrir o certificado</a></p>` : ''}
    </div>`;
}

/**
 * Resultado da validação de um XML: valida o código do link (com a chave, aqui no site)
 * e confere se os campos do arquivo batem com ele, para pegar XML editado à mão.
 */
export function resultadoDoXml(texto) {
  const lido = lerCertificadoXml(texto);
  if (lido.erro) {
    return `<div class="resultado-validacao invalido" role="status"><h2>⚠️ XML inválido</h2><p>${esc(lido.erro)}</p></div>`;
  }
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
  // Assinaturas Ed25519: chave do arquivo = chave publicada, e cada bloco assinado sobre a
  // mensagem que o certificado emitido gera (não sobre o texto do arquivo, que pode ter sido editado).
  const { chaveConfere, todas } = conferirAssinaturas({
    ...xml,
    blocos: xml.blocos.map((b, i) => {
      const elo = [...cert.cadeia, { modulo: cert.modulo, data: cert.data, anterior: cert.anterior }][i];
      return elo ? { ...b, mensagem: mensagemAssinada({ nome: cert.nome, modulo: elo.modulo, data: elo.data }, elo.anterior) } : b;
    }),
  });
  if (!chaveConfere || !todas) divergencias.push('assinatura');
  if (divergencias.length) {
    return `<div class="resultado-validacao invalido" role="status"><h2>⚠️ XML alterado</h2>
      <p>O arquivo foi modificado depois de baixado e não vale como comprovante. Baixe de novo na página do certificado.</p></div>`;
  }
  return resultadoDoLink(lido.codigo).replace('✅ Certificado válido', '✅ XML e certificado válidos');
}

/** Resultado da validação de um certificado impresso, em HTML. */
export function resultadoDoImpresso(dados) {
  const { valido, motivo } = validarImpresso(dados);
  return `
    <div class="resultado-validacao ${valido ? 'valido' : 'invalido'}" role="status">
      <h2>${valido ? '✅ Selo confere' : '⚠️ Não confere'}</h2>
      <p>${esc(motivo)}</p>
      ${valido && anteriores(dados.modulo).length ? `<p class="nota-validacao">Para conferir também os certificados
        anteriores da trilha, use o link do certificado na opção "Colar o link".</p>` : ''}
    </div>`;
}

export function renderValidador(el, codigoInicial = '') {
  el.innerHTML = `
    <article class="pagina-texto validador">
      <p class="voltar-trilha"><a href="#/">← Página inicial</a></p>
      <h1>🔎 Validar certificado</h1>
      <p>Confira se um certificado ou badge da <b>${esc(EMISSOR.organizacao)}</b> é autêntico.</p>

      <section class="cartao-validacao" aria-labelledby="val-link">
        <h2 id="val-link">1. Colar o link</h2>
        <form id="form-link" class="form-validacao">
          <label for="campo-link">Link do certificado, link do badge do LinkedIn ou código</label>
          <textarea id="campo-link" rows="3" spellcheck="false" placeholder="https://sertaoseracloud.github.io/terraform-playground/#/certificado/…"></textarea>
          <button class="btn btn-verde">🔎 Validar</button>
        </form>
        <div id="saida-link" aria-live="polite"></div>
      </section>

      <section class="cartao-validacao" aria-labelledby="val-impresso">
        <h2 id="val-impresso">2. Certificado impresso ou em PDF</h2>
        <p class="a11y-ajuda">Digite os dados exatamente como aparecem no certificado, inclusive acentos.
          O "Selo" e o "Anterior" ficam no rodapé, embaixo da data.</p>
        <form id="form-impresso" class="form-validacao grade-validacao">
          <label>Nome do aluno <input name="nome" autocomplete="off" required></label>
          <label>Certificado
            <select name="modulo" required>
              ${ORDEM.map((id) => `<option value="${id}">${esc(CERTIFICADOS[id].titulo)}</option>`).join('')}
            </select>
          </label>
          <label>Concluído em <input name="data" type="date" required></label>
          <label class="largo">Selo (64 caracteres) <input name="selo" spellcheck="false" autocomplete="off" required></label>
          <label class="largo" id="rotulo-anterior">Anterior (64 caracteres) <input name="anterior" spellcheck="false" autocomplete="off"></label>
          <button class="btn btn-verde">🔎 Validar</button>
        </form>
        <div id="saida-impresso" aria-live="polite"></div>
      </section>

      <section class="cartao-validacao" aria-labelledby="val-xml">
        <h2 id="val-xml">3. Arquivo XML</h2>
        <p class="a11y-ajuda">Use o arquivo baixado na página do certificado, no botão "📄 Baixar XML".</p>
        <form id="form-xml" class="form-validacao">
          <label>Escolher arquivo <input type="file" id="arquivo-xml" accept=".xml,application/xml,text/xml"></label>
          <label for="campo-xml">ou colar o conteúdo</label>
          <textarea id="campo-xml" rows="4" spellcheck="false" placeholder="&lt;?xml version=&quot;1.0&quot; …"></textarea>
          <button class="btn btn-verde">🔎 Validar</button>
        </form>
        <div id="saida-xml" aria-live="polite"></div>
      </section>

      <p class="nota-validacao">A conferência é feita aqui mesmo, sem enviar os dados para nenhum lugar.</p>
    </article>`;

  const campoLink = $('campo-link');
  const saidaLink = $('saida-link');
  $('form-link').onsubmit = (e) => {
    e.preventDefault();
    saidaLink.innerHTML = resultadoDoLink(campoLink.value);
  };

  const form = $('form-impresso');
  const rotuloAnterior = $('rotulo-anterior');
  const atualizarAnterior = () => {
    // O primeiro da cadeia não tem "Anterior".
    rotuloAnterior.hidden = anteriores(form.modulo.value).length === 0;
  };
  form.modulo.onchange = atualizarAnterior;
  atualizarAnterior();
  form.onsubmit = (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    $('saida-impresso').innerHTML = resultadoDoImpresso(dados);
  };

  const campoXml = $('campo-xml');
  $('arquivo-xml').onchange = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    campoXml.value = await arquivo.text();
    $('saida-xml').innerHTML = resultadoDoXml(campoXml.value);
  };
  $('form-xml').onsubmit = (e) => {
    e.preventDefault();
    $('saida-xml').innerHTML = resultadoDoXml(campoXml.value);
  };

  if (codigoInicial) {
    campoLink.value = codigoInicial;
    saidaLink.innerHTML = resultadoDoLink(codigoInicial);
  }
}
