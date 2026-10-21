// Rotas do site (caminhos reais, uma página por rota) e links de compartilhamento.
// O prefixo é o base do build (BASE_URL): /<repositório>/ ou /<repositório>/homologacao/.
//   /                 landing page
//   /trilha/          trilha (caminho com os módulos)
//   /p/<id>/          lição ou problema
//   /livre/           playground livre
//   /s/#<código>      código compartilhado (arquivos guardados no próprio link)
//   /certificado/#<código>  certificado (nome, módulo e data no próprio link)
//   /privacidade/     privacidade, cookies e LGPD
//   /licenca/         licença (copyleft)   /termos/  termos de uso
//   /validar/[#<código>]  validador de certificados
// Os códigos ficam no hash: o hash nunca vai ao servidor (nem aos logs do GitHub Pages).
// Os links antigos (#/trilha, #/p/<id>...) continuam valendo: traduzirHashAntigo() leva à rota nova.

/** Prefixo das rotas (termina em "/"). Fora do Vite/Astro (scripts do Node), a raiz. */
export const BASE = import.meta.env?.BASE_URL ?? '/';

/** Avisado no window a cada troca de tela (clique, voltar/avançar ou link antigo). */
export const EVENTO_ROTA = 'rota';

/** Telas que têm página própria: o primeiro trecho do caminho. */
const TELAS = {
  trilha: { tela: 'inicio' },
  livre: { tela: 'item', id: 'livre' },
  privacidade: { tela: 'privacidade' },
  licenca: { tela: 'licenca' },
  termos: { tela: 'termos' },
  novidades: { tela: 'novidades' },
  instrutor: { tela: 'instrutor' },
  apoie: { tela: 'instrutor', ancora: 'apoie' },
  acessibilidade: { tela: 'acessibilidade' },
};
/** Telas que levam um código no hash. */
const COM_CODIGO = ['validar', 'certificado', 's'];

/** Telas de endereço fixo (além da landing e das lições e exercícios em p/<id>): cada uma vira uma página. */
export const ROTAS_FIXAS = [...Object.keys(TELAS), ...COM_CODIGO];

/** Caminho de uma tela: rota('trilha') → /<repositório>/trilha/; rota() → a landing. */
export const rota = (nome = '') => `${BASE}${nome ? `${nome}/` : ''}`;

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

export const linkItem = (id) => (id === 'livre' ? rota('livre') : rota(`p/${encodeURIComponent(id)}`));
export const linkCompartilhado = (estado) => `${rota('s')}#${codificar(estado)}`;
export const linkValidar = (codigo = '') => `${rota('validar')}${codigo ? `#${codigo}` : ''}`;

/** O caminho sem o prefixo do site e sem as barras das pontas: "/<repositório>/p/x/" → "p/x". */
function trecho(pathname) {
  const caminho = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '');
  return caminho.replace(/^\/+|\/+$/g, '');
}

/** A tela de um endereço ({ pathname, hash }, como o location). */
export function lerRota({ pathname = BASE, hash = '' } = {}) {
  const caminho = trecho(pathname);
  const codigo = hash.replace(/^#/, '');
  if (!caminho) return { tela: 'landing' };
  if (TELAS[caminho]) return { ...TELAS[caminho] };
  if (caminho === 'validar') return { tela: 'validar', codigo };
  if (caminho === 'certificado') return { tela: 'certificado', codigo };
  if (caminho === 's') {
    const dados = decodificar(codigo);
    if (dados) return { tela: 'item', id: dados.item, arquivos: dados.arquivos };
    return { tela: 'nao-encontrada', motivo: 'link' };
  }
  if (caminho.startsWith('p/') && !caminho.slice(2).includes('/')) return { tela: 'item', id: decodeURIComponent(caminho.slice(2)) };
  return { tela: 'nao-encontrada' };
}

/** O endereço é uma tela do site (e não um arquivo, como badge/<id>/ ou a chave pública)? */
export function ehRotaDoSite({ pathname }) {
  if (!pathname.startsWith(BASE)) return false;
  const caminho = trecho(pathname);
  const primeiro = caminho.split('/')[0];
  return !caminho || primeiro in TELAS || COM_CODIGO.includes(primeiro) || primeiro === 'p';
}

/**
 * Link antigo da época das rotas no hash (#/trilha, #/p/<id>, #/validar/<código>...) → endereço
 * novo. null quando o hash não é uma rota antiga (vazio ou uma âncora como #conteudo).
 */
export function traduzirHashAntigo(hash) {
  if (!hash.startsWith('#/')) return null;
  const caminho = hash.slice(2).replace(/\/+$/, '');
  if (!caminho) return rota();
  const barra = caminho.indexOf('/');
  const nome = barra < 0 ? caminho : caminho.slice(0, barra);
  const resto = barra < 0 ? '' : caminho.slice(barra + 1);
  if (COM_CODIGO.includes(nome)) return `${rota(nome)}${resto ? `#${resto}` : ''}`;
  return rota(caminho);
}
