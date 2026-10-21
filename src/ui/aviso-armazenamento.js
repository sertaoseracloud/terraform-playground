export function iniciarAvisoArmazenamento(editor) {
  const aviso = document.createElement('p');
  aviso.id = 'aviso-armazenamento';
  aviso.className = 'licao-chip';
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-live', 'polite');
  aviso.hidden = true;
  editor.before(aviso);
  const mostrar = () => {
    aviso.hidden = false;
    aviso.textContent = 'O navegador não deixou guardar ou recuperar seus dados. Seu código continua no editor, mas pode não ser lembrado ao sair. Copie seus arquivos antes de fechar ou trocar de exercício.';
  };
  window.addEventListener('armazenamento-indisponivel', mostrar);
  return () => {
    window.removeEventListener('armazenamento-indisponivel', mostrar);
    aviso.remove();
  };
}
