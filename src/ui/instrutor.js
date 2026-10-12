// Página "Quem é o instrutor?" (#/instrutor) com o apoio via PIX (#/apoie), e a
// seção resumida da landing. O conteúdo vem de src/instrutor.js e src/apoio.js.
import { INSTRUTOR } from '../instrutor.js';
import { PIX, apoioDisponivel, codigoPix, svgQrCode } from '../apoio.js';
import { esc } from './util.js';

const linkExterno = (l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.rotulo)} ↗</a>`;

// A foto fica em public/ (servida junto com o site, sem depender de outro domínio). O
// caminho é relativo: o site sempre roda na página base (as telas são rotas #/...),
// inclusive na landing pré-renderizada.
const avatar = () => `<span class="avatar-instrutor"><img src="${INSTRUTOR.foto}" alt="Foto de ${esc(INSTRUTOR.nome)}" width="88" height="88" loading="lazy"></span>`;

const selos = () => `
  <ul class="selos-instrutor" aria-label="Reconhecimentos">
    ${INSTRUTOR.reconhecimentos.map((r) => `<li><b>${esc(r.nome)}</b><span>${esc(r.detalhe)}</span></li>`).join('')}
  </ul>`;

/** Seção curta para a landing: quem é, os reconhecimentos e os links. */
export function secaoInstrutor() {
  return `
    <section class="faixa faixa-instrutor" aria-labelledby="instrutor-titulo">
      <h2 id="instrutor-titulo">Quem é o instrutor?</h2>
      <div class="cartao-instrutor">
        ${avatar()}
        <div>
          <p class="nome-instrutor">${esc(INSTRUTOR.nome)}</p>
          <p class="titulo-instrutor">${esc(INSTRUTOR.titulo)}</p>
          <p>${esc(INSTRUTOR.resumo[0])}</p>
          ${selos()}
          <p class="acoes-instrutor">
            <a class="btn btn-roxo" href="#/instrutor">Conheça o instrutor</a>
            <a class="btn btn-fantasma" href="#/apoie">☕ Apoie o projeto</a>
          </p>
        </div>
      </div>
    </section>`;
}

/** Caixa de apoio: QR Code e código copia e cola (ou "em breve", sem chave configurada). */
export function caixaApoio() {
  if (!apoioDisponivel()) {
    return `
      <section class="caixa-apoio" id="apoie" aria-labelledby="apoio-titulo">
        <h2 id="apoio-titulo">☕ Apoie o projeto</h2>
        <p>Em breve você poderá apoiar o projeto com um PIX de qualquer valor.</p>
      </section>`;
  }
  const codigo = codigoPix();
  return `
    <section class="caixa-apoio" id="apoie" aria-labelledby="apoio-titulo">
      <h2 id="apoio-titulo">☕ Apoie o projeto</h2>
      <p>Os playgrounds são gratuitos, sem anúncios e sem cadastro. Se eles te ajudaram, você pode apoiar com
        um PIX de qualquer valor para ${esc(PIX.instituicao)}. O apoio é voluntário e não muda nada no acesso ao site nem nos certificados.</p>
      <div class="pix">
        <figure class="qr-pix">
          ${svgQrCode(codigo, { tamanho: 200, rotulo: `QR Code do PIX para ${INSTRUTOR.nome}` })}
          <figcaption>Aponte a câmera do app do banco</figcaption>
        </figure>
        <div class="copia-e-cola">
          <ol class="passos-pix">
            <li>Abra o app do seu banco e escolha <b>PIX</b>.</li>
            <li>Leia o QR Code ou escolha <b>PIX copia e cola</b> e cole o código abaixo.</li>
            <li>Digite o valor que quiser e confirme. Recebedor: <b>${esc(PIX.nome)}</b>.</li>
          </ol>
          <label for="codigo-pix">PIX copia e cola</label>
          <textarea id="codigo-pix" class="codigo-pix" rows="4" readonly spellcheck="false">${esc(codigo)}</textarea>
          <p><button type="button" class="btn btn-verde" id="btn-copiar-pix">📋 Copiar código PIX</button>
            <span class="aviso-copia" id="aviso-copia-pix" role="status"></span></p>
        </div>
      </div>
    </section>`;
}

/** Página completa: perfil, atuação, formação e o apoio. */
export function renderInstrutor(el, { ancora } = {}) {
  const i = INSTRUTOR;
  el.innerHTML = `
    <article class="pagina-texto pagina-instrutor">
      <p class="voltar-trilha"><a href="#/">← Página inicial</a></p>
      <header class="cabecalho-instrutor">
        ${avatar()}
        <div>
          <h1>Quem é o instrutor?</h1>
          <p class="nome-instrutor">${esc(i.nome)}</p>
          <p class="titulo-instrutor">${esc(i.titulo)}</p>
          <p class="links-instrutor">${i.links.map(linkExterno).join(' · ')}</p>
        </div>
      </header>
      ${i.resumo.map((p) => `<p>${esc(p)}</p>`).join('')}

      <h2>Reconhecimentos</h2>
      ${selos()}

      <h2>Onde atua</h2>
      <ol class="linha-atuacao">
        ${i.atuacao.map((a) => `
          <li>
            <b>${esc(a.cargo)}</b>
            <span class="onde">${esc(a.onde)} · ${esc(a.periodo)}</span>
            ${a.detalhe ? `<span class="detalhe-atuacao">${esc(a.detalhe)}</span>` : ''}
          </li>`).join('')}
      </ol>

      <h2>Certificações</h2>
      <ul>${i.certificacoes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>

      <h2>Formação</h2>
      <ul>${i.formacao.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>

      <h2>Especialidades</h2>
      <ul class="chips-instrutor">${i.especialidades.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      <p class="idiomas">🌎 ${esc(i.idiomas)}</p>

      ${caixaApoio()}
    </article>`;

  const botao = el.querySelector('#btn-copiar-pix');
  if (botao) {
    const campo = el.querySelector('#codigo-pix');
    const aviso = el.querySelector('#aviso-copia-pix');
    botao.onclick = async () => {
      try {
        await navigator.clipboard.writeText(campo.value);
      } catch {
        campo.select();
        document.execCommand?.('copy');
      }
      aviso.textContent = '✅ Código copiado. Cole no app do banco, em PIX copia e cola.';
    };
  }
  if (ancora === 'apoie') el.querySelector('#apoie')?.scrollIntoView?.({ block: 'start' });
}
