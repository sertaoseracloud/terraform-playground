// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { codigoPix, PIX, svgQrCode } from '../src/apoio.js';
import { iniciarMuralApoio } from '../src/ui/mural-apoio.js';

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
    const qr = document.querySelector('#mural-apoio-qr svg');
    const esperado = svgQrCode(codigoPix(), { tamanho: 200, rotulo: 'QR Code PIX para apoio ao projeto' });
    expect(qr.getAttribute('aria-label')).toBe('QR Code PIX para apoio ao projeto');
    expect(qr.querySelector('path').getAttribute('d')).toBe(esperado.match(/<path d="([^"]+)"/)[1]);
  });

  it('fecha ao continuar e não reaparece ao navegar entre telas', () => {
    const dialogo = montar();
    iniciarMuralApoio();
    document.getElementById('btn-fechar-mural-apoio').click();
    window.dispatchEvent(new Event('hashchange'));

    expect(dialogo.close).toHaveBeenCalledOnce();
    expect(dialogo.open).toBe(false);
    expect(dialogo.showModal).toHaveBeenCalledOnce();
  });

  it('informa quando o PIX está indisponível', () => {
    PIX.chave = '';
    montar();
    iniciarMuralApoio();

    expect(document.getElementById('mural-apoio-qr').textContent).toContain('Em breve');
  });
});
