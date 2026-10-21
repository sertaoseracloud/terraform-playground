// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { codigoPix, PIX, svgQrCode } from '../src/apoio.js';
import { INSTRUTOR } from '../src/instrutor.js';
import { iniciarMuralApoio, deveAbrirMural } from '../src/ui/mural-apoio.js';
import { EVENTO_ROTA, lerRota } from '../src/compartilhar.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const chaveOriginal = PIX.chave;

function montar() {
  document.body.innerHTML = html.slice(html.indexOf('<dialog id="dialogo-apoio"'), html.indexOf('</dialog>', html.indexOf('<dialog id="dialogo-apoio"')) + 9);
  const dialogo = document.getElementById('dialogo-apoio');
  dialogo.showModal = vi.fn(() => { dialogo.open = true; });
  dialogo.close = vi.fn(() => { dialogo.open = false; dialogo.dispatchEvent(new Event('close')); });
  return dialogo;
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  PIX.chave = chaveOriginal;
});

describe('mural de apoio', () => {
  it('mostra a mensagem e o mesmo QR PIX da página de apoio ao abrir', () => {
    const dialogo = montar();
    iniciarMuralApoio();

    expect(dialogo.showModal).toHaveBeenCalledOnce();
    expect(dialogo.open).toBe(true);
    expect(document.getElementById('mural-apoio-mensagem').textContent).toContain('gratuito');
    expect(document.getElementById('mural-apoio-mensagem').textContent).toContain('voluntário');
    const qr = document.querySelector('#mural-apoio-conteudo .qr-pix svg');
    const rotulo = `QR Code do PIX para ${INSTRUTOR.nome}`;
    const esperado = svgQrCode(codigoPix(), { tamanho: 200, rotulo });
    expect(qr.getAttribute('aria-label')).toBe(rotulo);
    expect(qr.querySelector('path').getAttribute('d')).toBe(esperado.match(/<path d="([^"]+)"/)[1]);
    expect(document.querySelector('#mural-apoio-mensagem').textContent).toContain('sem anúncios e sem cadastro');
    expect(document.querySelector('#mural-codigo-pix').value).toBe(codigoPix());
    expect(document.querySelector('#mural-apoio-conteudo a[href="https://github.com/sertaoseracloud/terraform-playground"].btn-estrela-github').textContent).toContain('estrela');
  });

  it('fecha ao continuar e não reaparece ao navegar entre telas', () => {
    const dialogo = montar();
    iniciarMuralApoio();
    document.getElementById('btn-fechar-mural-apoio').click();
    window.dispatchEvent(new Event(EVENTO_ROTA));

    expect(dialogo.close).toHaveBeenCalledOnce();
    expect(dialogo.open).toBe(false);
    expect(dialogo.showModal).toHaveBeenCalledOnce();
  });

  it('abre o endereço de estrela em uma janela separada sem navegar no mural', () => {
    const popup = { opener: window };
    const abrirPopup = vi.spyOn(window, 'open').mockReturnValue(popup);
    montar();
    iniciarMuralApoio();
    const link = document.querySelector('.btn-estrela-github');
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true });

    link.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(abrirPopup).toHaveBeenCalledWith(link.href, 'github-star', 'popup=yes,width=900,height=700');
    expect(popup.opener).toBeNull();
    abrirPopup.mockRestore();
  });

  it('copia o código PIX a partir do mural', async () => {
    montar();
    iniciarMuralApoio();
    const escrever = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });

    await document.getElementById('mural-btn-copiar-pix').onclick();

    expect(escrever).toHaveBeenCalledWith(codigoPix());
    expect(document.getElementById('mural-aviso-copia-pix').textContent).toContain('copiado');
  });

  it('informa quando o PIX está indisponível', () => {
    PIX.chave = '';
    montar();
    iniciarMuralApoio();

    expect(document.getElementById('mural-apoio-mensagem').textContent).toContain('Em breve');
    expect(document.querySelector('#mural-apoio-conteudo a[href="https://github.com/sertaoseracloud/terraform-playground"]')).not.toBeNull();
  });
});

describe('quando o mural abre sozinho', () => {
  it('no máximo uma vez por dia', () => {
    expect(deveAbrirMural({ tela: 'landing', vistoEm: null, dia: '2026-10-20' })).toBe(true);
    expect(deveAbrirMural({ tela: 'landing', vistoEm: '2026-10-20', dia: '2026-10-20' })).toBe(false);
    expect(deveAbrirMural({ tela: 'landing', vistoEm: '2026-10-19', dia: '2026-10-20' })).toBe(true);
  });

  it('só na página inicial e na trilha, nunca por cima de um exercício, certificado ou validador', () => {
    const tela = (pathname, hash = '') => lerRota({ pathname, hash }).tela;
    for (const caminho of ['/', '/trilha/']) expect(deveAbrirMural({ tela: tela(caminho), vistoEm: null, dia: 'd' }), caminho).toBe(true);
    for (const [caminho, hash] of [['/p/x/'], ['/livre/'], ['/s/', '#abc'], ['/certificado/', '#abc'], ['/validar/'], ['/validar/', '#abc'], ['/apoie/']]) {
      expect(deveAbrirMural({ tela: tela(caminho, hash), vistoEm: null, dia: 'd' }), caminho).toBe(false);
    }
  });

  it('fechar o mural guarda o dia, e ele não abre de novo hoje', () => {
    const dialogo = montar();
    iniciarMuralApoio();
    document.getElementById('btn-fechar-mural-apoio').click();
    montar();
    iniciarMuralApoio();
    expect(document.getElementById('dialogo-apoio').showModal).not.toHaveBeenCalled();
    expect(dialogo.open).toBe(false);
  });
});
