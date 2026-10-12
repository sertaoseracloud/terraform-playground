// Tudo o que fica salvo no navegador do aluno: progresso, rascunhos e o banco
// do playground livre. Cada acesso é protegido: sem localStorage (aba anônima,
// bloqueio), o site continua funcionando, só não lembra.
const PREFIXO = 'terraform-playground:';

function ler(chave, padrao = null) {
  try {
    const valor = localStorage.getItem(PREFIXO + chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
}

function remover(chave) {
  try { localStorage.removeItem(PREFIXO + chave); } catch { /* sem armazenamento */ }
}

// ---------- progresso: 'resolvido' | 'tentado' ----------
export const statusDe = (id) => ler('progresso', {})[id];

/** Data local no formato AAAA-MM-DD. */
export const hoje = () => new Date().toLocaleDateString('sv-SE');

export function marcar(id, status) {
  registrarAtividade();
  const progresso = ler('progresso', {});
  if (progresso[id] === 'resolvido') return; // nunca rebaixa um problema resolvido
  progresso[id] = status;
  gravar('progresso', progresso);
  if (status === 'resolvido') {
    const datas = ler('datas', {});
    datas[id] = hoje();
    gravar('datas', datas);
  }
}

/**
 * Dia em que o item foi resolvido (vira a data do certificado). Itens resolvidos
 * antes de as datas existirem ganham a data de hoje uma única vez e ela fica
 * salva; senão a data e o código do certificado mudariam a cada dia.
 */
export function dataDe(id) {
  const datas = ler('datas', {});
  if (datas[id]) return datas[id];
  if (statusDe(id) !== 'resolvido') return null;
  datas[id] = hoje();
  gravar('datas', datas);
  return datas[id];
}

// ---------- dias com atividade (sequência 🔥) ----------
function registrarAtividade() {
  const dias = new Set(ler('atividade', []));
  dias.add(hoje());
  gravar('atividade', [...dias].sort().slice(-400));
}
export const diasAtivos = () => ler('atividade', []);

// ---------- nome que aparece nos certificados ----------
export const lerNome = () => ler('nome', '');
export const gravarNome = (nome) => gravar('nome', nome.trim());

// ---------- lista de tarefas do enunciado (índices marcados) ----------
export const lerTarefas = (id) => ler(`tarefas:${id}`, []);
export const gravarTarefas = (id, indices) => gravar(`tarefas:${id}`, indices);

// ---------- rascunhos de código ----------
export const lerRascunho = (id) => ler(`rascunho:${id}`);
export const gravarRascunho = (id, arquivos) => gravar(`rascunho:${id}`, arquivos);
export const apagarRascunho = (id) => remover(`rascunho:${id}`);

// ---------- estado simulado do Terraform (por exercício e workspace) ----------
// Guarda o "terraform.tfstate" de cada exercício, para o próximo plan comparar
// com o que já foi "criado". Os valores desconhecidos não entram no estado.
export const lerEstado = (chave) => ler(`estado:${chave}`);
export const gravarEstado = (chave, estado) => {
  const { eventos, ...resto } = estado;
  void eventos;
  gravar(`estado:${chave}`, resto);
};
export const apagarEstado = (chave) => remover(`estado:${chave}`);

// ---------- preferências (layout, acessibilidade, tutorial) ----------
export const lerPreferencia = (chave, padrao = null) => ler(`pref:${chave}`, padrao);
export const gravarPreferencia = (chave, valor) => gravar(`pref:${chave}`, valor);

// ---------- direitos do titular (LGPD, art. 18): ver, levar e apagar ----------

function chavesDoSite() {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO));
  } catch {
    return [];
  }
}

/** Tudo o que o site guardou neste navegador, para baixar (portabilidade). */
export function exportarDados() {
  const dados = {};
  for (const chave of chavesDoSite()) dados[chave.slice(PREFIXO.length)] = ler(chave.slice(PREFIXO.length));
  return dados;
}

/** Apaga tudo o que o site guardou neste navegador. Devolve quantos itens apagou. */
export function apagarDados() {
  const chaves = chavesDoSite();
  chaves.forEach((chave) => remover(chave.slice(PREFIXO.length)));
  return chaves.length;
}
