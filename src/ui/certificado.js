// Tela do certificado: o documento (pronto para imprimir/salvar em PDF) e os
// botões para compartilhar no LinkedIn. Abre por link (#/certificado/<código>),
// então quem recebe o link vê o mesmo certificado.
import { CERTIFICADOS, EMISSOR, certificadoXml, decodificarCertificado, linkLinkedInPerfil, linkLinkedInPublicar, linkPublico, textoPublicacao } from '../certificados.js';
import { svgBadge } from '../badges.js';
import { textoHoras } from '../cargaHoraria.js';
import { esc } from './util.js';

const dataPorExtenso = (data) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

export function renderCertificado(el, codigo, { definirStatus = () => {} } = {}) {
  const cert = decodificarCertificado(codigo);
  if (!cert) {
    el.innerHTML = `
      <div class="certificado-pagina">
        <div class="w3-panel aviso-certificado"><p>Este link de certificado não é válido.</p>
        <p><a href="#/trilha">← Voltar para a trilha</a></p></div>
      </div>`;
    return null;
  }

  const def = CERTIFICADOS[cert.modulo];
  const horas = textoHoras(def.cargaHoraria);
  const final = cert.modulo === 'final';
  const confere = cert.selo === 'confere';
  // Só um certificado com selo válido pode ser compartilhado: gerar o link de novo
  // a partir de dados alterados criaria um selo válido para eles.
  const url = confere ? linkPublico(cert) : '';
  const grupos = (hash) => (hash.match(/.{1,16}/g) ?? []).join(' ');
  const hashEmGrupos = grupos(cert.hash);
  const dataCurta = (data) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR');
  // Certificados anteriores da trilha (só nome e data; os detalhes técnicos ficam no validador e no XML).
  const anteriores = confere ? cert.cadeia : [];
  const avisoSelo = {
    'nao-confere': `<div class="aviso-selo erro" role="alert">⚠️ <b>O selo não confere.</b> Os dados deste link foram
      alterados depois da emissão: este certificado não é válido.</div>`,
    ausente: `<div class="aviso-selo" role="status">ℹ️ <b>Este link é de uma versão antiga do site.</b>
      Se o certificado é seu, abra-o de novo pela trilha para gerar um link atualizado.</div>`,
  }[cert.selo] ?? '';

  el.innerHTML = `
    <div class="certificado-pagina">
      <p class="voltar-trilha"><a href="#/trilha">← Voltar à trilha</a></p>
      ${avisoSelo}

      <!-- Página do badge, no estilo da Credly -->
      <section class="badge-credly" aria-labelledby="badge-titulo">
        <div class="badge-imagem">${svgBadge(cert.modulo, { tamanho: 240 })}</div>
        <div class="badge-info">
          <p class="badge-rotulo">${final ? 'Certificado de conclusão' : 'Badge digital'} · emitido por <b>${esc(EMISSOR.organizacao)}</b></p>
          <h1 id="badge-titulo">${esc(def.titulo)}</h1>
          <p class="badge-dono">Conquistado por <b>${esc(cert.nome)}</b> em ${dataPorExtenso(cert.data)}</p>
          <p class="badge-desc">Quem tem este ${final ? 'certificado' : 'badge'} ${esc(def.resumo)} do curso
            <b>${esc(EMISSOR.curso)}</b>, com carga horária de ${horas} e exercícios corrigidos automaticamente por testes funcionais.</p>
          <h2 class="badge-subtitulo">Habilidades</h2>
          <ul class="badge-habilidades">${def.conteudos.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
          <dl class="badge-dados">
            <div><dt>Emissor</dt><dd>${esc(EMISSOR.organizacao)}</dd></div>
            <div><dt>Carga horária</dt><dd>${horas}</dd></div>
            <div><dt>Código</dt><dd class="cert-codigo-dd">${esc(cert.id)}</dd></div>
            <div><dt>Selo</dt><dd class="selo-${cert.selo}">${confere ? '✅ confere' : cert.selo === 'ausente' ? 'ℹ️ sem selo' : '⚠️ não confere'}</dd></div>
          </dl>
          <details class="selo-detalhes">
            <summary>🔐 Como sei que este certificado é verdadeiro?</summary>
            <p>Todo certificado da ${esc(EMISSOR.organizacao)} tem um <b>selo de autenticidade</b>. Se alguém mudar
              qualquer informação, como o nome, a data ou o módulo, o selo deixa de valer.</p>
            <p>Os certificados são liberados na ordem da trilha, e cada um fica ligado aos anteriores.</p>
            <p>Para conferir, use o botão <b>🔎 Validar</b> ou envie o link do certificado para quem precisa conferir.</p>
            ${anteriores.length ? `
              <p><b>Certificados anteriores desta trilha:</b></p>
              <ul class="anteriores">
                ${anteriores.map((a) => `<li>✔ ${esc(CERTIFICADOS[a.modulo].titulo)} <span>${dataCurta(a.data)}</span></li>`).join('')}
              </ul>` : ''}
          </details>
          <div class="acoes-certificado" ${confere ? '' : 'hidden'}>
            <a class="btn btn-linkedin" href="${esc(linkLinkedInPublicar(cert, url))}" target="_blank" rel="noopener">in Publicar no LinkedIn</a>
            <a class="btn btn-linkedin-contorno" href="${esc(linkLinkedInPerfil(cert, url))}" target="_blank" rel="noopener">＋ Adicionar ao perfil</a>
            <button type="button" class="btn btn-fantasma" id="btn-copiar-certificado">🔗 Copiar link</button>
            <button type="button" class="btn btn-fantasma" id="btn-copiar-texto">📝 Copiar texto do post</button>
            <button type="button" class="btn btn-fantasma" id="btn-imprimir">🖨️ Imprimir / PDF</button>
            <a class="btn btn-fantasma" href="#/validar/${esc(codigo)}">🔎 Validar</a>
            <button type="button" class="btn btn-fantasma" id="btn-xml" title="Arquivo para conferir o certificado em outros sistemas">📄 Baixar XML</button>
          </div>
        </div>
      </section>

      <h2 class="titulo-documento">Certificado</h2>
      <article class="certificado ${final ? 'certificado-final' : ''}" aria-label="Certificado de ${esc(cert.nome)}">
        <div class="moldura">
          <header class="cert-topo">
            <img class="cert-logo" src="${esc(EMISSOR.logo)}" alt="" width="64" height="64"
                 onerror="this.replaceWith(Object.assign(document.createElement('span'), {className: 'cert-logo cert-logo-texto', textContent: '☁️'}))">
            <div>
              <p class="cert-emissor">${esc(EMISSOR.organizacao)}</p>
              <p class="cert-curso">${esc(EMISSOR.curso)}</p>
            </div>
            <span class="cert-selo" aria-hidden="true">${final ? '🎓' : '🏆'}</span>
          </header>

          <p class="cert-tipo">${final ? 'Certificado de conclusão da trilha' : 'Certificado de conclusão de módulo'}</p>
          <p class="cert-certificamos">Certificamos que</p>
          <p class="cert-nome">${esc(cert.nome)}</p>
          <p class="cert-texto">${esc(def.resumo)} em <b>${esc(def.titulo)}</b>,
            com carga horária de <b>${horas}</b> e exercícios corrigidos automaticamente.</p>

          <ul class="cert-conteudos" aria-label="Conteúdos">
            ${def.conteudos.map((c) => `<li>${esc(c)}</li>`).join('')}
          </ul>

          <footer class="cert-rodape">
            <div class="cert-data">
              <span>Concluído em</span>
              <b>${dataPorExtenso(cert.data)}</b>
              <span class="cert-carga">Carga horária: ${horas}</span>
              <span class="cert-codigo">Código: ${esc(cert.id)}</span>
              <span class="cert-hash" title="Selo de autenticidade">Selo: ${esc(hashEmGrupos)}</span>
              ${cert.anterior ? `<span class="cert-hash" title="Ligação com o certificado anterior">Anterior: ${esc(grupos(cert.anterior))}</span>` : ''}
            </div>
            <div class="cert-assinatura">
              <!-- Rubrica ilustrativa (decorativa) da instituição, desenhada em SVG -->
              <svg class="rubrica" viewBox="0 0 240 72" aria-hidden="true" focusable="false">
                <path d="M10 50 C 18 22, 32 14, 38 30 S 34 60, 26 54 S 44 22, 58 26 S 62 52, 70 46
                         S 82 26, 92 30 S 96 50, 104 46 C 112 42, 116 22, 126 26 S 128 52, 138 48
                         S 150 24, 162 30 C 170 34, 168 52, 178 48 C 190 42, 202 30, 232 34" />
                <path d="M52 62 C 100 55, 168 57, 226 52" />
              </svg>
              <span class="linha-assinatura" aria-hidden="true"></span>
              <b>${esc(EMISSOR.organizacao)}</b>
              <span>Instituição emissora</span>
            </div>
          </footer>
        </div>
      </article>
      <p class="nota-certificado">Dica: em "Imprimir", escolha <b>Salvar como PDF</b> e o layout <b>paisagem</b>.</p>
    </div>`;

  el.querySelector('#btn-imprimir').onclick = () => window.print();
  const copiar = async (texto, aviso) => {
    try {
      await navigator.clipboard.writeText(texto);
      definirStatus(aviso);
    } catch {
      prompt('Copie:', texto);
    }
  };
  if (!confere) return cert;
  el.querySelector('#btn-xml').onclick = () => {
    const blob = new Blob([certificadoXml(cert, codigo)], { type: 'application/xml' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `certificado-${cert.id}.xml` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    definirStatus('📄 XML do certificado baixado.');
  };
  el.querySelector('#btn-copiar-certificado').onclick = () => copiar(url, '🔗 Link do badge copiado!');
  el.querySelector('#btn-copiar-texto').onclick = () => copiar(textoPublicacao(cert, url), '📝 Texto do post copiado!');
  return cert;
}
