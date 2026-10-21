export function detalhesCidr(valor) {
  const texto = String(valor);
  const detalhes = [{ rotulo: 'Rede (CIDR)', valor: texto }];
  const partes = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(texto);
  if (partes && partes[1].split('.').every((n) => Number(n) <= 255) && Number(partes[2]) <= 32) {
    const bits = Number(partes[2]);
    const mascara = [0, 8, 16, 24].map((inicio) => {
      const usados = Math.max(0, Math.min(8, bits - inicio));
      return 256 - 2 ** (8 - usados);
    }).join('.');
    detalhes.push({ rotulo: 'Máscara', valor: mascara });
  }
  return detalhes;
}
