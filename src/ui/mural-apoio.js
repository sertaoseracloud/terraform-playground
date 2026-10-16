import { apoioDisponivel, codigoPix, svgQrCode } from '../apoio.js';
import { $ } from './util.js';

export function iniciarMuralApoio() {
  const qr = $('mural-apoio-qr');
  if (apoioDisponivel()) {
    const codigo = codigoPix();
    qr.innerHTML = `<figure class="qr-pix">${svgQrCode(codigo, { tamanho: 200, rotulo: 'QR Code PIX para apoio ao projeto' })}<figcaption>Aponte a câmera do app do seu banco</figcaption></figure>`;
  } else {
    qr.textContent = 'Em breve você poderá apoiar o projeto com um PIX de qualquer valor.';
  }

  $('btn-fechar-mural-apoio').addEventListener('click', () => $('dialogo-apoio').close());
  $('dialogo-apoio').showModal();
}
