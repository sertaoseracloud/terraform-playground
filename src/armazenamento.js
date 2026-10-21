/** Não transmite chaves, código ou dados pessoais junto do aviso. */
export function notificarFalhaArmazenamento() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('armazenamento-indisponivel'));
  }
}
