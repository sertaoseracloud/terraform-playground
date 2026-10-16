// Certificados: um por módulo e um de conclusão total, emitidos pela Sertão será cloud.
//
// O site não tem servidor: o certificado é montado no navegador a partir do
// progresso salvo ali, e o link compartilhável guarda nome, módulo e data.
// Por isso ele é um comprovante de participação, não um documento verificável.
//
// Cadeia: os certificados seguem ORDEM, e cada um (menos o primeiro) inclui no selo
// o hash do anterior, como os blocos de um blockchain. O link leva as datas dos
// anteriores para a página recalcular a cadeia inteira.
//
// Selo: cada certificado leva um HMAC-SHA256 da data de obtenção, do emissor, da
// empresa, do aluno e do módulo, com uma chave derivada de uma palavra secreta
// (veja vite.config.js). O selo vai no link e a página confere: quem editar o nome
// ou a data no link vê "não confere". Como não há servidor, a chave derivada está
// no JavaScript do site; o selo impede alterações casuais, não falsificação dedicada.
import { paraBase64Url, deBase64Url } from './compartilhar.js';
import { hmacSha256 } from './sha256.js';
import { assinar, verificar, CHAVE_PUBLICA } from './ed25519.js';
import { textoHoras } from './cargaHoraria.js';
import { SITE_ATUAL } from './ambiente.js';

/** Endereço público do site: os links compartilhados apontam para cá. */
export const SITE = SITE_ATUAL;

export const EMISSOR = {
  organizacao: 'Sertão será cloud',
  responsavel: 'Cláudio Raposo',
  cargo: 'Instrutor responsável',
  curso: 'DivergeTerraform: infraestrutura como código na AWS e no Azure',
  logo: 'https://github.com/sertaoseracloud.png?size=160',
};

// cargaHoraria: horas de cada certificado (soma das atividades do módulo, mínimo 1 hora;
// veja src/cargaHoraria.js). O final soma todos os módulos.
export const CERTIFICADOS = {
  basico: {
    titulo: 'Fundamentos de Terraform',
    cargaHoraria: 23,
    resumo: 'concluiu o módulo Terraform básico, resolvendo os 50 exercícios práticos',
    hashtags: ['Terraform', 'IaC', 'DevOps'],
    conteudos: ['HCL, recursos e referências', 'Variáveis, outputs e validação', 'Locals, expressões e funções', 'count, for_each e blocos dynamic', 'Estado, ciclo de vida e módulos'],
  },
  aws: {
    titulo: 'Terraform na AWS',
    cargaHoraria: 27,
    resumo: 'concluiu o módulo Terraform na AWS, resolvendo os 55 exercícios práticos',
    hashtags: ['Terraform', 'AWS', 'Cloud'],
    conteudos: ['S3, IAM e políticas', 'VPC, sub-redes e security groups', 'EC2, ALB e Auto Scaling', 'RDS e DynamoDB', 'Lambda, API Gateway, SQS e SNS'],
  },
  azure: {
    titulo: 'Terraform no Azure',
    cargaHoraria: 27,
    resumo: 'concluiu o módulo Terraform no Azure, resolvendo os 55 exercícios práticos',
    hashtags: ['Terraform', 'Azure', 'Cloud'],
    conteudos: ['Grupos de recursos e Storage', 'VNet, NSG e máquinas virtuais', 'App Service e Functions', 'SQL, PostgreSQL e Cosmos DB', 'Key Vault, identidades, AKS e monitoramento'],
  },
  projetos: {
    titulo: 'Projetos de infraestrutura com Terraform',
    cargaHoraria: 25,
    resumo: 'construiu os 8 projetos completos da trilha, em 40 etapas',
    hashtags: ['Terraform', 'AWS', 'Azure', 'DevOps'],
    conteudos: ['Site estático com S3 e CloudFront', 'Rede de 3 camadas na AWS', 'API serverless', 'App web e Kubernetes no Azure', 'Módulos multiambiente, multicloud e estado remoto'],
  },
  final: {
    titulo: 'Engenharia de infraestrutura com Terraform: trilha completa',
    cargaHoraria: 102,
    resumo: 'concluiu a trilha completa: 160 exercícios de Terraform, AWS e Azure e 8 projetos (40 etapas)',
    hashtags: ['Terraform', 'AWS', 'Azure', 'IaC', 'DevOps'],
    conteudos: ['Terraform e HCL', 'AWS', 'Azure', 'Módulos e estado remoto', '8 projetos completos'],
  },
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Injetada no build (vite.config.js). Fora do Vite (ex.: scripts/gerar-badges.mjs) não existe.
const CHAVE = typeof __CHAVE_CERTIFICADO__ === 'undefined' ? null : __CHAVE_CERTIFICADO__;

/**
 * Ordem da cadeia de certificados. Como num blockchain, cada certificado (menos o
 * primeiro) leva no selo o hash do certificado anterior desta lista. Para forjar o
 * de Azure, seria preciso forjar também os de Terraform básico e AWS, com o mesmo nome; mudar
 * uma data ou um nome em qualquer ponto quebra todos os selos seguintes.
 */
export const ORDEM = Object.keys(CERTIFICADOS);
export const anteriores = (modulo) => ORDEM.slice(0, ORDEM.indexOf(modulo));

/**
 * Selo de um certificado: HMAC-SHA256 (64 caracteres hexadecimais) da data de
 * obtenção, emissor, empresa, aluno, módulo e, a partir do segundo, do hash anterior.
 * O primeiro da cadeia não tem anterior, e o selo dele é o mesmo da versão sem cadeia.
 */
export function hashCertificado({ nome, modulo, data }, anterior = '') {
  if (!CHAVE) throw new Error('Chave do certificado indisponível fora do build do site.');
  return hmacSha256(CHAVE, mensagemAssinada({ nome, modulo, data }, anterior));
}

/**
 * Recalcula a cadeia inteira até `modulo`. `cadeia` traz as datas dos certificados
 * anteriores, na ordem de ORDEM. Devolve os elos [{ modulo, data, hash, anterior }].
 */
export function montarCadeia({ nome, modulo, data, cadeia = [] }) {
  const ids = anteriores(modulo);
  const datas = cadeia.map((c) => (typeof c === 'string' ? c : c.data));
  if (datas.length !== ids.length) {
    throw new Error(`O certificado de ${modulo} precisa das datas de ${ids.length} certificado(s) anterior(es).`);
  }
  const elos = [];
  let anterior = '';
  [...ids, modulo].forEach((id, i) => {
    const elo = { modulo: id, data: i < datas.length ? datas[i] : data, anterior };
    elo.hash = hashCertificado({ nome, modulo: id, data: elo.data }, anterior);
    elos.push(elo);
    anterior = elo.hash;
  });
  return elos;
}

/** Código curto para mostrar e para o LinkedIn: SSC-AAAA-XXXX-XXXX, tirado do selo. */
const idDoHash = (data, hash) => `SSC-${data.slice(0, 4)}-${hash.slice(0, 4)}-${hash.slice(4, 8)}`.toUpperCase();
export const idCertificado = (cert) => cert.id ?? idDoHash(cert.data, montarCadeia(cert).at(-1).hash);

/** Código do link: nome, módulo, data, datas da cadeia (c) e o selo (h). */
export function codificarCertificado(cert) {
  const elos = montarCadeia(cert);
  const dados = { n: cert.nome, m: cert.modulo, d: cert.data, h: elos.at(-1).hash };
  if (elos.length > 1) dados.c = elos.slice(0, -1).map((e) => e.data);
  return paraBase64Url(new TextEncoder().encode(JSON.stringify(dados)));
}

/**
 * Lê o código do link. Devolve null se for ilegível; senão, o certificado com a
 * cadeia recalculada e `selo`: 'confere', 'nao-confere' (link alterado, ou cadeia
 * incompleta) ou 'ausente' (link antigo, de antes do selo ou da cadeia).
 */
export function decodificarCertificado(codigo) {
  try {
    const { n, m, d, h, c } = JSON.parse(new TextDecoder().decode(deBase64Url(codigo)));
    const nome = typeof n === 'string' ? n.trim() : '';
    if (!nome || nome.length > 80 || !(m in CERTIFICADOS) || !DATA.test(d)) return null;
    const cert = { nome, modulo: m, data: d };
    const precisaCadeia = anteriores(m).length > 0;

    // Link antigo: sem selo, ou (depois do primeiro) sem as datas da cadeia.
    if (typeof h !== 'string' || (precisaCadeia && c === undefined)) {
      return { ...cert, cadeia: [], anterior: '', hash: h ?? '', id: idDoHash(d, h ?? '00000000'), selo: 'ausente' };
    }
    const datas = Array.isArray(c) ? c : [];
    if (!datas.every((x) => typeof x === 'string' && DATA.test(x)) || datas.length !== anteriores(m).length) {
      return { ...cert, cadeia: [], anterior: '', hash: h, id: idDoHash(d, h), selo: 'nao-confere' };
    }
    const elos = montarCadeia({ ...cert, cadeia: datas });
    const ultimo = elos.at(-1);
    const selo = h === ultimo.hash ? 'confere' : 'nao-confere';
    return {
      ...cert,
      cadeia: elos.slice(0, -1),
      anterior: ultimo.anterior,
      hash: selo === 'confere' ? ultimo.hash : h,
      id: idDoHash(d, selo === 'confere' ? ultimo.hash : h),
      selo,
    };
  } catch {
    return null;
  }
}

export const linkCertificado = (cert) => `#/certificado/${codificarCertificado(cert)}`;

/**
 * Link público do badge. É uma página estática por certificado (gerada por
 * scripts/gerar-badges.mjs) com a imagem do badge nas meta tags og:, porque o
 * robô do LinkedIn não executa JavaScript nem enxerga o que vem depois do #.
 * Quem abre o link é levado ao certificado.
 */
export const linkPublico = (cert, site = SITE) => `${site}badge/${cert.modulo}/?c=${codificarCertificado(cert)}`;

/** "Adicionar ao perfil" do LinkedIn, já com os campos da certificação preenchidos. */
export function linkLinkedInPerfil(cert, urlCertificado = linkPublico(cert)) {
  const parametros = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: CERTIFICADOS[cert.modulo].titulo,
    organizationName: EMISSOR.organizacao,
    issueYear: cert.data.slice(0, 4),
    issueMonth: String(Number(cert.data.slice(5, 7))),
    certUrl: urlCertificado,
    certId: cert.id ?? idCertificado(cert),
  });
  return `https://www.linkedin.com/profile/add?${parametros}`;
}

/** Texto do post, no estilo dos badges da Credly. */
export function textoPublicacao(cert, url = linkPublico(cert)) {
  const def = CERTIFICADOS[cert.modulo];
  const tags = [...def.hashtags, 'SertaoSeraCloud'].map((t) => `#${t}`).join(' ');
  return cert.modulo === 'final'
    ? `🎓 Concluí a trilha completa "${def.titulo}" e recebi o certificado emitido pela ${EMISSOR.organizacao}!

`
      + `Foram ${def.resumo.replace(/^concluiu a trilha completa: /, '')}, com carga horária de ${textoHoras(def.cargaHoraria)}.

${url}

${tags}`
    : `🏆 Conquistei o badge "${def.titulo}", emitido pela ${EMISSOR.organizacao}!

`
      + `Habilidades: ${def.conteudos.join(', ')}.
Carga horária: ${textoHoras(def.cargaHoraria)}.

${url}

${tags}`;
}

/** Abre a caixa de publicação do LinkedIn com o texto pronto; o link gera a prévia com o badge. */
export const linkLinkedInPublicar = (cert, url = linkPublico(cert)) =>
  `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(textoPublicacao(cert, url))}`;

// ---------- validador (#/validar) ----------

/** Tira o código de um link de certificado, de um link de badge ou do próprio código colado. */
export function extrairCodigo(texto) {
  const t = String(texto ?? '').trim();
  const doHash = t.match(/#\/(?:certificado|validar)\/([A-Za-z0-9_-]+)/);
  if (doHash) return doHash[1];
  const doBadge = t.match(/[?&]c=([A-Za-z0-9_-]+)/);
  if (doBadge) return doBadge[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(t) ? t : null;
}

const limparHash = (h) => String(h ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');

/**
 * Confere um certificado impresso: com nome, módulo, data, selo e (a partir do
 * segundo da cadeia) o hash anterior, recalcula aquele elo e compara com o selo.
 * Devolve { valido, motivo, incompleto } (incompleto: falta algum dado; não é o selo que não confere).
 */
export function validarImpresso({ nome, modulo, data, selo, anterior }) {
  if (!String(nome ?? '').trim()) return { valido: false, incompleto: true, motivo: 'Informe o nome como está no certificado.' };
  if (!(modulo in CERTIFICADOS)) return { valido: false, incompleto: true, motivo: 'Escolha qual certificado é.' };
  if (!DATA.test(data ?? '')) return { valido: false, incompleto: true, motivo: 'Informe a data de conclusão.' };
  const h = limparHash(selo);
  if (h.length !== 64) return { valido: false, incompleto: true, motivo: 'O selo tem 64 caracteres (letras de a a f e números).' };
  const primeiro = anteriores(modulo).length === 0;
  const a = limparHash(anterior);
  if (!primeiro && a.length !== 64) return { valido: false, incompleto: true, motivo: 'Este certificado tem o campo "Anterior" (64 caracteres). Copie-o também.' };
  const esperado = hashCertificado({ nome, modulo, data }, primeiro ? '' : a);
  return esperado === h
    ? { valido: true, motivo: 'O selo confere com o nome, o certificado, a data e o elo anterior informados.' }
    : { valido: false, motivo: 'O selo não confere. Confira se digitou tudo exatamente como no certificado, inclusive acentos.' };
}

// ---------- XML para validação em outras páginas ----------

const XML_NS = `${SITE}certificado/v1`;
/** Onde a chave pública oficial fica publicada (gerada no build, vite.config.js). */
const URL_CHAVE_PUBLICA = `${SITE}chave-publica-ed25519.txt`;
const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** Mensagem exata que o selo (HMAC-SHA256) assina: um array JSON. Não contém a chave. */
export function mensagemAssinada({ nome, modulo, data }, anterior = '') {
  const campos = [data, EMISSOR.responsavel, EMISSOR.organizacao, nome.trim(), modulo];
  if (anterior) campos.push(anterior);
  return JSON.stringify(campos);
}

/**
 * XML do certificado, com tudo o que é preciso para conferi-lo fora do site, menos o
 * segredo: dados, selo, hash anterior, a cadeia inteira, a mensagem assinada e o link
 * de validação. Só para certificados com selo que confere.
 */
export function certificadoXml(cert, codigo = codificarCertificado(cert)) {
  const elos = montarCadeia(cert);
  const atual = elos.at(-1);
  const url = `${SITE}#/validar/${codigo}`;
  const msg = (e) => mensagemAssinada({ nome: cert.nome, modulo: e.modulo, data: e.data }, e.anterior);
  const bloco = (e, i) => `    <bloco ordem="${i + 1}" modulo="${e.modulo}" titulo="${escXml(CERTIFICADOS[e.modulo].titulo)}" data="${e.data}">
      <selo>${e.hash}</selo>
      <anterior>${e.anterior}</anterior>
      <mensagemAssinada>${escXml(msg(e))}</mensagemAssinada>
      <assinatura algoritmo="Ed25519">${assinar(msg(e))}</assinatura>
    </bloco>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<certificado xmlns="${XML_NS}" versao="1">
  <emissor>
    <organizacao>${escXml(EMISSOR.organizacao)}</organizacao>
    <responsavel>${escXml(EMISSOR.responsavel)}</responsavel>
    <cargo>${escXml(EMISSOR.cargo)}</cargo>
  </emissor>
  <curso>${escXml(EMISSOR.curso)}</curso>
  <aluno>${escXml(cert.nome.trim())}</aluno>
  <modulo id="${cert.modulo}">${escXml(CERTIFICADOS[cert.modulo].titulo)}</modulo>
  <dataConclusao>${cert.data}</dataConclusao>
  <cargaHoraria unidade="horas">${CERTIFICADOS[cert.modulo].cargaHoraria}</cargaHoraria>
  <codigo>${idDoHash(cert.data, atual.hash)}</codigo>
  <selo algoritmo="HMAC-SHA256">${atual.hash}</selo>
  <seloAnterior>${atual.anterior}</seloAnterior>
  <mensagemAssinada>${escXml(msg(atual))}</mensagemAssinada>
  <assinatura algoritmo="Ed25519">
    <chavePublica formato="hex">${CHAVE_PUBLICA}</chavePublica>
    <chavePublicaPublicada>${escXml(URL_CHAVE_PUBLICA)}</chavePublicaPublicada>
    <valor formato="hex">${assinar(msg(atual))}</valor>
  </assinatura>
  <cadeia ordem="${ORDEM.join(' ')}">
${elos.map(bloco).join('\n')}
  </cadeia>
  <validacao>
    <url>${escXml(url)}</url>
    <codigoDoLink>${codigo}</codigoDoLink>
    <regras>
      <regra>A assinatura Ed25519 de cada bloco é sobre a mensagemAssinada (texto UTF-8) e se confere com a chave pública, sem segredo.</regra>
      <regra>Use a chave pública publicada em ${escXml(URL_CHAVE_PUBLICA)}: se a chave deste arquivo for diferente, ele não foi emitido pela ${escXml(EMISSOR.organizacao)}.</regra>
      <regra>Na cadeia, o primeiro bloco tem anterior vazio e cada bloco seguinte tem anterior igual ao selo do bloco anterior.</regra>
      <regra>A conferência completa (com a chave) é feita em: ${escXml(url)}</regra>
    </regras>
  </validacao>
</certificado>
`;
}

/**
 * Lê um XML de certificado e devolve { codigo, xml } para validar, ou { erro }.
 * `xml` traz os campos do arquivo, para comparar com o que o link diz.
 */
export function lerCertificadoXml(texto, parser = new DOMParser()) {
  const doc = parser.parseFromString(String(texto ?? ''), 'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement?.localName !== 'certificado') {
    return { erro: 'O arquivo não é um XML de certificado do DivergeTerraform.' };
  }
  const pega = (nome) => doc.getElementsByTagNameNS(XML_NS, nome)[0]?.textContent?.trim() ?? '';
  const codigo = pega('codigoDoLink');
  if (!codigo) return { erro: 'O XML não tem o código de validação (codigoDoLink).' };
  const blocos = [...doc.getElementsByTagNameNS(XML_NS, 'bloco')].map((b) => ({
    modulo: b.getAttribute('modulo'),
    data: b.getAttribute('data'),
    selo: b.getElementsByTagNameNS(XML_NS, 'selo')[0]?.textContent.trim() ?? '',
    anterior: b.getElementsByTagNameNS(XML_NS, 'anterior')[0]?.textContent.trim() ?? '',
    mensagem: b.getElementsByTagNameNS(XML_NS, 'mensagemAssinada')[0]?.textContent ?? '',
    assinatura: b.getElementsByTagNameNS(XML_NS, 'assinatura')[0]?.textContent.trim() ?? '',
  }));
  return {
    codigo,
    xml: {
      aluno: pega('aluno'),
      modulo: doc.getElementsByTagNameNS(XML_NS, 'modulo')[0]?.getAttribute('id') ?? '',
      data: pega('dataConclusao'),
      selo: pega('selo'),
      anterior: pega('seloAnterior'),
      chavePublica: pega('chavePublica'),
      blocos,
    },
  };
}

/** Confere se a cadeia do XML é coerente (cada "anterior" = selo do bloco anterior). Não precisa da chave. */
export function cadeiaCoerente(blocos) {
  return blocos.length > 0 && blocos.every((b, i) => (i === 0 ? b.anterior === '' : b.anterior === blocos[i - 1].selo));
}

/**
 * Confere as assinaturas Ed25519 dos blocos de um XML lido, só com a chave pública.
 * É o que qualquer página pode fazer fora do site. `chaveOficial` é a chave publicada;
 * a do arquivo precisa ser igual a ela.
 */
export function conferirAssinaturas(xml, chaveOficial = CHAVE_PUBLICA) {
  const chaveConfere = Boolean(chaveOficial) && xml.chavePublica?.toLowerCase() === chaveOficial.toLowerCase();
  const blocos = xml.blocos.map((b) => verificar(b.mensagem, b.assinatura, chaveOficial));
  return { chaveConfere, blocos, todas: chaveConfere && blocos.length > 0 && blocos.every(Boolean) };
}
