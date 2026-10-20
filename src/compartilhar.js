// Rotas do site (no hash da URL) e links de compartilhamento.
//   #/            landing page
//   #/trilha      trilha (caminho com os módulos)
//   #/p/<id>      lição ou problema
//   #/livre       playground livre
//   #/s/<código>  código compartilhado (arquivos guardados no próprio link)
//   #/certificado/<código>  certificado (nome, módulo e data no próprio link)
//   #/privacidade privacidade, cookies e LGPD
//   #/licenca     licença (copyleft)   #/termos  termos de uso
//   #/validar[/<código>]  validador de certificados

export function paraBase64Url(bytes) {
  let binario = '';
  bytes.forEach((b) => { binario += String.fromCharCode(b); });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deBase64Url(texto) {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function codificar({ item, arquivos }) {
  return paraBase64Url(new TextEncoder().encode(JSON.stringify({ i: item, a: arquivos })));
}

export function decodificar(codigo) {
  try {
    const { i, a } = JSON.parse(new TextDecoder().decode(deBase64Url(codigo)));
    const valido = typeof i === 'string' && a && typeof a === 'object' && Object.values(a).every((v) => typeof v === 'string');
    return valido ? { item: i, arquivos: a } : null;
  } catch {
    return null;
  }
}

export const linkItem = (id) => (id === 'livre' ? '#/livre' : `#/p/${encodeURIComponent(id)}`);
export const linkCompartilhado = (estado) => `#/s/${codificar(estado)}`;

export function lerRota(hash) {
  const caminho = hash.replace(/^#\/?/, '');
  if (caminho === 'livre') return { tela: 'item', id: 'livre' };
  if (caminho === 'trilha') return { tela: 'inicio' };
  if (caminho === 'privacidade') return { tela: 'privacidade' };
  if (caminho === 'licenca') return { tela: 'licenca' };
  if (caminho === 'termos') return { tela: 'termos' };
  if (caminho === 'novidades') return { tela: 'novidades' };
  if (caminho === 'instrutor') return { tela: 'instrutor' };
  if (caminho === 'apoie') return { tela: 'instrutor', ancora: 'apoie' };
  if (caminho === 'acessibilidade') return { tela: 'acessibilidade' };
  if (caminho === 'validar') return { tela: 'validar', codigo: '' };
  if (caminho.startsWith('validar/')) return { tela: 'validar', codigo: caminho.slice(8) };
  if (caminho.startsWith('p/')) return { tela: 'item', id: decodeURIComponent(caminho.slice(2)) };
  if (caminho.startsWith('certificado/')) return { tela: 'certificado', codigo: caminho.slice(12) };
  if (caminho.startsWith('s/')) {
    const dados = decodificar(caminho.slice(2));
    if (dados) return { tela: 'item', id: dados.item, arquivos: dados.arquivos };
    return { tela: 'nao-encontrada', motivo: 'link' };
  }
  // Sem rota (ou uma âncora antiga, sem a barra): a landing. Uma rota que não existe avisa,
  // em vez de cair calada na página inicial.
  return caminho && hash.startsWith('#/') ? { tela: 'nao-encontrada' } : { tela: 'landing' };
}
