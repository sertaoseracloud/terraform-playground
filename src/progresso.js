// Tudo o que fica salvo no navegador do aluno: progresso, rascunhos e o banco
// do playground livre. Cada acesso é protegido: sem localStorage (aba anônima,
// bloqueio), o site continua funcionando, só não lembra.
import { PREFIXO_ARMAZENAMENTO as PREFIXO } from './ambiente.js';


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

/**
 * Restaura itens resolvidos (pelo certificado, em #/validar): cada um fica resolvido na
 * data dada, mesmo se já estava resolvido em outro dia, porque a data do certificado é a
 * que vale. Não conta como atividade do dia (a 🔥 não muda). Devolve false se o navegador
 * não deixou gravar.
 */
export function restaurarItens(itens) {
  const progresso = ler('progresso', {});
  const datas = ler('datas', {});
  for (const { id, data } of itens) {
    progresso[id] = 'resolvido';
    datas[id] = data;
  }
  gravar('progresso', progresso);
  gravar('datas', datas);
  const salvo = ler('progresso', {});
  return itens.every(({ id }) => salvo[id] === 'resolvido');
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

// ---------- tempo de tentativa (segundos com o exercício aberto; libera a aba Solução) ----------
export const lerTentativa = (id) => ler('tentativa', {})[id] ?? 0;
export function somarTentativa(id, segundos) {
  const tempos = ler('tentativa', {});
  tempos[id] = (tempos[id] ?? 0) + Math.max(0, segundos);
  gravar('tentativa', tempos);
  return tempos[id];
}

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

// ---------- terraform init (os provedores "baixados" em cada exercício) ----------
export const lerInicializado = (id) => ler(`init:${id}`, null);
export const gravarInicializado = (id, mapa) => gravar(`init:${id}`, mapa);

// ---------- histórico do terminal (as setas ↑/↓), até 100 comandos ----------
export const lerHistorico = () => ler('historico', []);
export const gravarHistorico = (lista) => gravar('historico', lista.slice(-100));

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
