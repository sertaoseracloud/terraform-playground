/** Grava snapshots independentes por exercício, sem perder edições nas transições. */
export function criarGravadorRascunho(gravar, atraso = 300) {
  const pendentes = new Map();

  function salvar(id) {
    const entrada = pendentes.get(id);
    if (!entrada) return true;
    clearTimeout(entrada.timer);
    if (gravar(id, entrada.arquivos) === false) return false;
    pendentes.delete(id);
    return true;
  }

  return {
    agendar(id, arquivos) {
      clearTimeout(pendentes.get(id)?.timer);
      const entrada = { arquivos: { ...arquivos }, timer: null };
      pendentes.set(id, entrada);
      entrada.timer = setTimeout(() => salvar(id), atraso);
    },
    descarregar() {
      let salvo = true;
      for (const id of pendentes.keys()) if (!salvar(id)) salvo = false;
      return salvo;
    },
    cancelar(id) {
      const ids = id === undefined ? [...pendentes.keys()] : [id];
      for (const chave of ids) {
        clearTimeout(pendentes.get(chave)?.timer);
        pendentes.delete(chave);
      }
    },
  };
}
