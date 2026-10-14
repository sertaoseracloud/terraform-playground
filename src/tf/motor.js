// Motor do simulador de Terraform: init → validate → plan → apply/destroy.
//
//   executarTerraform(arquivos, { comando, estado, variaveis, workspace, semente })
//
// Nada sai do navegador: os provedores são simulados (esquema/), os IDs são
// inventados de forma estável e o "estado" é um objeto guardado pelo próprio site.
import { analisar, analisarExpressao } from './parser.js';
import { ErroHCL } from './lexer.js';
import { avaliar, ErroAvaliacao, INFO_RECURSO, referenciasDe } from './avaliador.js';
import {
  Desconhecido, desconhecido, ehDesconhecido, temDesconhecido, ehObjeto, ehConjunto, conjunto, iguais, copiar,
  nomeDoTipo, ErroValor, paraTexto,
} from './valores.js';
import { hashSimples } from './funcoes.js';
import {
  PROVEDORES, VERSAO_TERRAFORM, provedorDoTipo, buscarTipo, sugerir, atende, restricaoValida, escolherVersao, normalizarLocal,
} from './esquema/index.js';
import { REGIOES_AWS } from './esquema/aws.js';

const META_RECURSO = new Set(['count', 'for_each', 'provider', 'depends_on']);
const NOME_VALIDO = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const CONTA_AWS = '123456789012';
const ASSINATURA = 'c0ffee00-0000-4000-8000-000000000001';
const TENANT = 'aa11bb22-0000-4000-8000-000000000002';

class ErroCiclo extends Error {}

export function executarTerraform(arquivos, opcoes = {}) {
  return new Execucao(arquivos, opcoes).rodar();
}

/**
 * terraform console: avalia cada texto com a configuração (variáveis, locals, data sources,
 * funções) e o estado, como o plan veria. Devolve `{ ok, valor }` ou `{ ok: false, erro }`.
 */
export function avaliarNoConsole(arquivos, opcoes, textos) {
  const r = executarTerraform(arquivos, { ...opcoes, comando: 'plan', console: textos });
  if (r.console) return r.console;
  const primeiro = r.diagnosticos.find((d) => d.gravidade === 'erro');
  return textos.map(() => ({ ok: false, erro: { resumo: primeiro?.resumo ?? 'Invalid configuration', detalhe: primeiro?.detalhe ?? '' } }));
}

// =====================================================================
// Diagnósticos (erros e avisos no formato do Terraform)
// =====================================================================

class Diagnosticos {
  constructor(arquivos) {
    this.lista = [];
    this.arquivos = arquivos;
  }
  add(gravidade, resumo, detalhe, { arquivo, linha, contexto } = {}) {
    const chave = `${gravidade}|${resumo}|${detalhe}|${arquivo}|${linha}`;
    if (this.lista.some((d) => d.chave === chave)) return;
    const trecho = arquivo && linha ? (this.arquivos[arquivo] ?? '').split('\n')[linha - 1] : undefined;
    this.lista.push({ chave, gravidade, resumo, detalhe, arquivo, linha, contexto, trecho });
  }
  erro(...a) { this.add('erro', ...a); }
  aviso(...a) { this.add('aviso', ...a); }
  get temErros() { return this.lista.some((d) => d.gravidade === 'erro'); }
  deErro(erro, contexto, padraoArquivo) {
    if (erro instanceof ErroAvaliacao || erro instanceof ErroHCL) {
      this.erro(erro.resumo, erro.detalhe, { arquivo: erro.arquivo ?? padraoArquivo, linha: erro.linha, contexto });
      return;
    }
    if (erro instanceof ErroValor) {
      this.erro(erro.resumo, erro.detalhe, { arquivo: padraoArquivo, contexto });
      return;
    }
    throw erro;
  }
}

// =====================================================================
// Carregar a configuração de um diretório (módulo)
// =====================================================================

const TIPOS_DE_BLOCO = {
  terraform: 0, provider: 1, variable: 1, locals: 0, output: 1, resource: 2, data: 2, module: 1,
  moved: 0, import: 0, removed: 0, check: 1,
};

function normalizarCaminho(caminho) {
  const partes = [];
  for (const p of caminho.replace(/\\/g, '/').split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') partes.pop();
    else partes.push(p);
  }
  return partes.join('/');
}

function arquivosDoDiretorio(arquivos, dir) {
  return Object.keys(arquivos).filter((nome) => {
    const n = normalizarCaminho(nome);
    const pasta = n.includes('/') ? n.slice(0, n.lastIndexOf('/')) : '';
    return pasta === dir;
  });
}

function carregarConfig(arquivos, dir, diag) {
  const config = {
    dir,
    terraform: [],
    provedores: [],
    variaveis: {},
    locais: {},
    saidas: {},
    recursos: {},
    dados: {},
    modulos: {},
    movidos: [],
    importacoes: [],
    removidos: [],
    tfvars: [],
    ok: true,
  };
  const nomes = arquivosDoDiretorio(arquivos, dir);
  for (const nome of nomes) {
    const base = nome.split('/').pop();
    if (!base.endsWith('.tf') && !base.endsWith('.tfvars')) continue;
    let corpo;
    try {
      corpo = analisar(arquivos[nome], nome);
    } catch (erro) {
      config.ok = false;
      diag.deErro(erro, undefined, nome);
      continue;
    }
    if (base.endsWith('.tfvars')) {
      if (dir === '' && (base === 'terraform.tfvars' || base.endsWith('.auto.tfvars'))) config.tfvars.push({ arquivo: nome, corpo });
      continue;
    }
    for (const at of corpo.atributos) {
      config.ok = false;
      diag.erro('Unsupported argument', `Um argumento chamado "${at.nome}" não é esperado aqui, fora de um bloco. Coloque-o dentro de um resource, variable, locals...`, { arquivo: nome, linha: at.linha });
    }
    for (const bloco of corpo.blocos) {
      bloco.arquivo = nome;
      registrarBloco(config, bloco, diag);
    }
  }
  return config;
}

function registrarBloco(config, bloco, diag) {
  const onde = { arquivo: bloco.arquivo, linha: bloco.linha };
  const esperados = TIPOS_DE_BLOCO[bloco.tipo];
  if (esperados === undefined) {
    config.ok = false;
    const parecido = sugerir(bloco.tipo, Object.keys(TIPOS_DE_BLOCO));
    diag.erro('Unsupported block type',
      `Blocos do tipo "${bloco.tipo}" não são esperados aqui.${parecido ? ` Você quis dizer "${parecido}"?` : ''}`, onde);
    return;
  }
  if (bloco.rotulos.length !== esperados) {
    config.ok = false;
    const nomesRotulos = { resource: 'o tipo e o nome', data: 'o tipo e o nome', variable: 'o nome', output: 'o nome', module: 'o nome', provider: 'o nome do provedor', check: 'o nome' };
    if (bloco.rotulos.length < esperados) {
      diag.erro(`Missing name for ${bloco.tipo}`,
        `Todo bloco ${bloco.tipo} precisa de ${esperados} rótulo(s): ${nomesRotulos[bloco.tipo]}. Ex.: ${exemploRotulos(bloco.tipo)}`, onde);
    } else {
      diag.erro(`Extraneous label for ${bloco.tipo}`,
        `O bloco ${bloco.tipo} aceita só ${esperados} rótulo(s). Ex.: ${exemploRotulos(bloco.tipo)}`, onde);
    }
    return;
  }
  for (const r of bloco.rotulos) {
    if (!NOME_VALIDO.test(r) && bloco.tipo !== 'provider') {
      config.ok = false;
      diag.erro(`Invalid ${bloco.tipo} name`,
        `O nome "${r}" é inválido: comece com letra ou _ e use só letras, números, _ e -.`, onde);
      return;
    }
  }
  const [a, b] = bloco.rotulos;
  const duplicado = (mapa, chave, resumo) => {
    if (mapa[chave]) {
      config.ok = false;
      diag.erro(resumo, `"${chave}" já foi declarado em ${mapa[chave].arquivo}:${mapa[chave].linha}. Cada nome só pode ser usado uma vez.`, onde);
      return true;
    }
    return false;
  };
  switch (bloco.tipo) {
    case 'terraform': config.terraform.push(bloco); break;
    case 'provider': config.provedores.push(bloco); break;
    case 'variable': if (!duplicado(config.variaveis, a, 'Duplicate variable declaration')) config.variaveis[a] = bloco; break;
    case 'output': if (!duplicado(config.saidas, a, 'Duplicate output definition')) config.saidas[a] = bloco; break;
    case 'module': if (!duplicado(config.modulos, a, 'Duplicate module call')) config.modulos[a] = bloco; break;
    case 'resource': if (!duplicado(config.recursos, `${a}.${b}`, 'Duplicate resource configuration')) config.recursos[`${a}.${b}`] = { ...bloco, modo: 'managed', tipoRecurso: a, nome: b }; break;
    case 'data': if (!duplicado(config.dados, `data.${a}.${b}`, 'Duplicate data configuration')) config.dados[`data.${a}.${b}`] = { ...bloco, modo: 'data', tipoRecurso: a, nome: b }; break;
    case 'locals':
      for (const at of bloco.corpo.atributos) {
        if (config.locais[at.nome]) {
          config.ok = false;
          diag.erro('Duplicate local value definition', `O local "${at.nome}" já foi definido em ${config.locais[at.nome].arquivo}:${config.locais[at.nome].linha}.`, { arquivo: bloco.arquivo, linha: at.linha });
        } else {
          config.locais[at.nome] = { ...at, arquivo: bloco.arquivo };
        }
      }
      if (bloco.corpo.blocos.length) {
        config.ok = false;
        diag.erro('Unsupported block type', 'Dentro de locals só cabem atributos (nome = valor), não blocos.', { arquivo: bloco.arquivo, linha: bloco.corpo.blocos[0].linha });
      }
      break;
    case 'moved': config.movidos.push(bloco); break;
    case 'import': config.importacoes.push(bloco); break;
    case 'removed': config.removidos.push(bloco); break;
    default:
  }
}

function exemploRotulos(tipo) {
  return {
    resource: 'resource "aws_s3_bucket" "site" { ... }',
    data: 'data "aws_ami" "ubuntu" { ... }',
    variable: 'variable "regiao" { ... }',
    output: 'output "url" { ... }',
    module: 'module "rede" { ... }',
    provider: 'provider "aws" { ... }',
    check: 'check "saude" { ... }',
    terraform: 'terraform { ... }',
    locals: 'locals { ... }',
  }[tipo] ?? '';
}

// =====================================================================
// Tipos de variáveis: string, number, list(string), map(number), object({...})...
// =====================================================================

function lerTipo(expr) {
  if (!expr) return { k: 'any' };
  if (expr.k === 'ref' && !expr.passos.length) {
    if (['string', 'number', 'bool', 'any'].includes(expr.raiz)) return { k: expr.raiz };
    if (['list', 'map', 'set'].includes(expr.raiz)) return { k: expr.raiz, de: { k: 'any' } };
  }
  if (expr.k === 'tpl' && expr.partes.length === 1 && typeof expr.partes[0] === 'string') {
    throw new ErroValor('Invalid type specification', `Os tipos são escritos sem aspas: type = ${expr.partes[0]} (e não "${expr.partes[0]}").`);
  }
  if (expr.k === 'chamada') {
    const n = expr.nome;
    if (['list', 'set', 'map'].includes(n)) return { k: n, de: lerTipo(expr.args[0]) };
    if (n === 'optional') return { ...lerTipo(expr.args[0]), opcional: true, padrao: expr.args[1] };
    if (n === 'tuple') return { k: 'tuple', itens: (expr.args[0]?.itens ?? []).map(lerTipo) };
    if (n === 'object') {
      const campos = {};
      for (const { chave, valor } of expr.args[0]?.pares ?? []) campos[chave.valor] = lerTipo(valor);
      return { k: 'object', campos };
    }
  }
  throw new ErroValor('Invalid type specification', 'Tipo desconhecido. Use string, number, bool, list(...), set(...), map(...), object({...}), tuple([...]) ou any.');
}

function nomeTipo(t) {
  if (!t) return 'any';
  switch (t.k) {
    case 'list': case 'set': case 'map': return `${t.k} of ${nomeTipo(t.de)}`;
    case 'object': return 'object';
    case 'tuple': return 'tuple';
    default: return t.k;
  }
}

function converter(valor, t, onde, avaliarPadrao) {
  if (valor === null || ehDesconhecido(valor) || !t || t.k === 'any') return valor;
  const falha = (det) => {
    throw new ErroValor('Invalid value for input variable', `${onde}: ${det ?? `${nomeTipo(t)} required`}. Recebido: ${nomeDoTipo(valor)}.`);
  };
  switch (t.k) {
    case 'string':
      if (typeof valor === 'string') return valor;
      if (typeof valor === 'number' || typeof valor === 'boolean') return paraTexto(valor);
      return falha('string required');
    case 'number':
      if (typeof valor === 'number') return valor;
      if (typeof valor === 'string' && valor.trim() !== '' && !Number.isNaN(Number(valor))) return Number(valor);
      return falha('a number is required');
    case 'bool':
      if (typeof valor === 'boolean') return valor;
      if (valor === 'true' || valor === 'false') return valor === 'true';
      return falha('a bool is required');
    case 'list': case 'set': case 'tuple': {
      if (!Array.isArray(valor)) return falha(`${nomeTipo(t)} required`);
      if (t.k === 'tuple') return valor.map((v, i) => converter(v, t.itens[i], `${onde}[${i}]`, avaliarPadrao));
      const itens = valor.map((v, i) => converter(v, t.de, `${onde}[${i}]`, avaliarPadrao));
      return t.k === 'set' ? conjunto(itens) : itens;
    }
    case 'map': {
      if (!ehObjeto(valor)) return falha(`${nomeTipo(t)} required`);
      return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, converter(v, t.de, `${onde}["${k}"]`, avaliarPadrao)]));
    }
    case 'object': {
      if (!ehObjeto(valor)) return falha('object required');
      const saida = {};
      for (const [campo, tc] of Object.entries(t.campos)) {
        if (!(campo in valor) || valor[campo] === null) {
          if (tc.opcional) {
            saida[campo] = tc.padrao ? converter(avaliarPadrao(tc.padrao), tc, `${onde}.${campo}`, avaliarPadrao) : null;
            continue;
          }
          throw new ErroValor('Invalid value for input variable', `${onde}: attribute "${campo}" is required.`);
        }
        saida[campo] = converter(valor[campo], tc, `${onde}.${campo}`, avaliarPadrao);
      }
      return saida;
    }
    default: return valor;
  }
}

// =====================================================================
// Conversão dos argumentos dos recursos para o tipo do esquema
// =====================================================================

function converterArg(valor, tipo, nome) {
  if (valor === null || ehDesconhecido(valor)) return valor;
  const erro = (req) => new ErroValor('Incorrect attribute value type', `Valor inadequado para o argumento "${nome}": ${req} required. Recebido: ${nomeDoTipo(valor)}.`);
  switch (tipo) {
    case 'string':
      if (typeof valor === 'string') return valor;
      if (typeof valor === 'number' || typeof valor === 'boolean') return paraTexto(valor);
      throw erro('string');
    case 'number':
      if (typeof valor === 'number') return valor;
      if (typeof valor === 'string' && valor.trim() !== '' && !Number.isNaN(Number(valor))) return Number(valor);
      throw erro('number');
    case 'bool':
      if (typeof valor === 'boolean') return valor;
      if (valor === 'true' || valor === 'false') return valor === 'true';
      throw erro('bool');
    case 'list':
      if (Array.isArray(valor)) return [...valor];
      throw erro('list of string');
    case 'set':
      if (Array.isArray(valor)) return temDesconhecido(valor) ? [...valor] : conjunto(valor);
      throw erro('set of string');
    case 'map':
      if (ehObjeto(valor)) {
        return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, typeof v === 'number' || typeof v === 'boolean' ? paraTexto(v) : v]));
      }
      throw erro('map of string');
    default: return valor;
  }
}

// =====================================================================
// Gerador de valores estáveis ("known after apply" → valor)
// =====================================================================

function utilitarios(semente, endereco, geracao, extras) {
  const base = `${semente}|${endereco}|${geracao}`;
  const hex = (n, extra = '') => {
    let s = '';
    for (let i = 0; s.length < n; i++) s += hashSimples(`${base}|${extra}|${i}`);
    return s.slice(0, n);
  };
  const b64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  return {
    hex,
    b64: (n, extra = '') => hex(n * 2, `b64${extra}`).match(/../g).map((h) => b64Chars[parseInt(h, 16) % 64]).join(''),
    uuid: (extra = '') => {
      const h = hex(32, `uuid${extra}`);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
    },
    ip: (extra = '') => {
      const faixas = ['203.0.113', '198.51.100', '192.0.2'];
      const h = parseInt(hex(4, `ip${extra}`), 16);
      return `${faixas[h % 3]}.${10 + (h % 240)}`;
    },
    ipPrivado: (cidr) => {
      const [ip, prefixo] = String(cidr).split('/');
      const n = ip.split('.').reduce((a, p) => a * 256 + Number(p), 0);
      const tamanho = 2 ** (32 - Number(prefixo));
      const host = n + 4 + (parseInt(hex(4, 'ipp'), 16) % Math.max(1, Math.min(tamanho - 6, 250)));
      return [24, 16, 8, 0].map((d) => Math.floor(host / 2 ** d) % 256).join('.');
    },
    palavras: (n) => ['sereno', 'sabia', 'cerrado', 'caatinga', 'mandacaru', 'xaxado', 'baiao', 'forro'].filter((_, i) => i % 3 === parseInt(hex(1), 16) % 3).slice(0, n).join('-') || 'sertao',
    textoAleatorio: (v) => {
      let chars = '';
      if (v.lower !== false) chars += 'abcdefghijklmnopqrstuvwxyz';
      if (v.upper !== false) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (v.numeric !== false) chars += '0123456789';
      if (v.special !== false) chars += v.override_special ?? '!@#$%&*()-_=+[]{}<>:?';
      if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';
      const h = hex(v.length * 2, 'txt');
      return Array.from({ length: v.length }, (_, i) => chars[parseInt(h.slice(i * 2, i * 2 + 2), 16) % chars.length]).join('');
    },
    base64: (t) => btoa(String.fromCharCode(...new TextEncoder().encode(t))),
    conta: CONTA_AWS,
    assinatura: ASSINATURA,
    tenant: TENANT,
    ...extras,
  };
}

// =====================================================================
// Uma execução (plan/apply/destroy) inteira
// =====================================================================

class Execucao {
  constructor(arquivos, opcoes) {
    this.arquivos = Object.fromEntries(Object.entries(arquivos).map(([k, v]) => [normalizarCaminho(k), v]));
    this.comando = opcoes.comando ?? 'plan';
    this.aplicando = this.comando === 'apply';
    this.estadoAnterior = opcoes.estado ? copiar(opcoes.estado) : estadoVazio();
    this.variaveisCli = opcoes.variaveis ?? {};
    this.workspace = opcoes.workspace ?? 'default';
    this.semente = opcoes.semente ?? 'playground';
    this.diag = new Diagnosticos(this.arquivos);
    this.instancias = new Map(); // endereço da instância → planejamento
    this.dados = new Map();
    this.grafo = { nos: new Map(), arestas: [] };
    this.provedoresUsados = new Map();
    this.falhasApply = [];
    this.textosConsole = opcoes.console ?? null;
  }

  rodar() {
    const raizConfig = carregarConfig(this.arquivos, '', this.diag);
    this.raizConfig = raizConfig;
    const init = this.init(raizConfig);
    const base = { comando: this.comando, init, configuracao: raizConfig };
    if (!raizConfig.ok || this.diag.temErros) return this.finalizar({ ...base, ok: false, fase: 'init' });

    this.validarEstrutura(raizConfig, '');
    if (this.diag.temErros) return this.finalizar({ ...base, ok: false, fase: 'validate' });

    this.configurarProvedores(raizConfig);
    // moved/removed: renomeia o estado anterior antes de comparar com a configuração.
    this.movidos = this.aplicarMovidos();
    for (const { de, para } of this.movidos) {
      this.estadoAnterior.recursos[para] = this.estadoAnterior.recursos[de];
      delete this.estadoAnterior.recursos[de];
    }
    this.raiz = new Escopo(this, raizConfig, [], null);
    try {
      this.raiz.prepararVariaveis(this.lerTfvars(raizConfig));
    } catch (erro) {
      if (erro instanceof ErroValor || erro instanceof ErroAvaliacao) this.diag.deErro(erro);
      else throw erro;
    }
    if (this.diag.temErros) return this.finalizar({ ...base, ok: false, fase: 'plan' });

    this.raiz.avaliarTudo();
    if (this.textosConsole) {
      // O console vê o que o plan veria: monta o plano (os recursos ficam com os valores
      // planejados ou os do estado) e avalia cada expressão no escopo da raiz.
      this.montarPlano();
      return this.finalizar({ ...base, ok: true, fase: 'console', console: this.textosConsole.map((t) => this.avaliarConsole(t)) });
    }
    // Todo provider declarado é validado, mesmo que nenhum recurso o use.
    for (const chave of this.configsProvedor.keys()) this.configProvedor(chave);
    if (this.diag.temErros) return this.finalizar({ ...base, ok: false, fase: 'plan' });

    const plano = this.montarPlano();
    if (this.diag.temErros) return this.finalizar({ ...base, ok: false, fase: 'plan', plano });

    let estado = this.estadoAnterior;
    if (this.comando === 'apply' || this.comando === 'destroy') estado = this.aplicar(plano);
    return this.finalizar({ ...base, ok: !this.diag.temErros, fase: this.comando, plano, estado });
  }

  avaliarConsole(texto) {
    try {
      return { ok: true, valor: avaliar(analisarExpressao(texto), this.raiz.contexto('<console>')) };
    } catch (erro) {
      if (erro instanceof ErroAvaliacao || erro instanceof ErroValor || erro instanceof ErroHCL) {
        return { ok: false, erro: { resumo: erro.resumo ?? erro.message, detalhe: erro.detalhe ?? '' } };
      }
      throw erro;
    }
  }

  finalizar(resultado) {
    const r = {
      ...resultado,
      diagnosticos: this.diag.lista,
      estado: resultado.estado ?? this.estadoAnterior,
      grafo: this.montarGrafo(),
      provedores: [...this.provedoresUsados.values()],
      workspace: this.workspace,
    };
    r.saidas = this.saidasFinais(r);
    r.variaveis = this.raiz?.valoresVariaveis() ?? {};
    r.locais = this.raiz?.valoresLocais() ?? {};
    r.blocos = this.resumoBlocos();
    r.dados = [...this.dados.values()].map((d) => ({ endereco: d.endereco, tipo: d.tipo, acao: d.acao, valor: d.final ?? d.depois }));
    return r;
  }

  // ---------- terraform init ----------

  init(config) {
    const requisitos = {};
    let versaoExigida = null;
    let backend = null;
    for (const bloco of config.terraform) {
      for (const at of bloco.corpo.atributos) {
        if (at.nome === 'required_version') {
          versaoExigida = { valor: literal(at.expr), linha: at.linha, arquivo: bloco.arquivo };
        } else {
          this.diag.erro('Unsupported argument', `O bloco terraform não aceita o argumento "${at.nome}".`, { arquivo: bloco.arquivo, linha: at.linha });
        }
      }
      for (const sub of bloco.corpo.blocos) {
        if (sub.tipo === 'required_providers') {
          for (const at of sub.corpo.atributos) {
            const v = literal(at.expr);
            if (typeof v === 'string') {
              requisitos[at.nome] = { fonte: `hashicorp/${at.nome}`, versao: v, linha: at.linha, arquivo: bloco.arquivo };
            } else if (ehObjeto(v)) {
              requisitos[at.nome] = { fonte: v.source ?? `hashicorp/${at.nome}`, versao: v.version ?? null, linha: at.linha, arquivo: bloco.arquivo };
            } else {
              this.diag.erro('Invalid required_providers object', 'Cada provedor é um objeto: aws = { source = "hashicorp/aws", version = "~> 6.0" }.', { arquivo: bloco.arquivo, linha: at.linha });
            }
          }
        } else if (sub.tipo === 'backend') {
          backend = this.lerBackend(sub, bloco.arquivo);
        } else if (sub.tipo === 'cloud') {
          backend = { tipo: 'cloud' };
        } else {
          this.diag.erro('Unsupported block type', `O bloco terraform não aceita blocos "${sub.tipo}". Os válidos são required_providers e backend.`, { arquivo: bloco.arquivo, linha: sub.linha });
        }
      }
    }
    if (versaoExigida) {
      if (!restricaoValida(versaoExigida.valor)) {
        this.diag.erro('Invalid required_version constraint', `"${versaoExigida.valor}" não é uma restrição de versão válida (ex.: ">= 1.5.0").`, versaoExigida);
      } else if (!atende(VERSAO_TERRAFORM, versaoExigida.valor)) {
        this.diag.erro('Unsupported Terraform Core version',
          `Esta configuração exige o Terraform ${versaoExigida.valor}, mas o simulador roda a versão ${VERSAO_TERRAFORM}.`, versaoExigida);
      }
    }
    // Provedores usados por recursos e fontes de dados (inclusive dentro dos módulos).
    const usados = new Map();
    const visitar = (cfg, visitados = new Set()) => {
      for (const def of [...Object.values(cfg.recursos), ...Object.values(cfg.dados)]) {
        const nome = provedorDoTipo(def.tipoRecurso);
        if (!usados.has(nome)) usados.set(nome, def);
      }
      for (const p of cfg.provedores) if (!usados.has(p.rotulos[0])) usados.set(p.rotulos[0], p);
      for (const mod of Object.values(cfg.modulos)) {
        const fonte = literal(mod.corpo.atributos.find((a) => a.nome === 'source')?.expr);
        if (typeof fonte === 'string' && /^\.\.?\//.test(fonte)) {
          const dir = normalizarCaminho(`${cfg.dir}/${fonte}`);
          if (visitados.has(dir)) continue;
          visitados.add(dir);
          visitar(carregarConfig(this.arquivos, dir, new Diagnosticos(this.arquivos)), visitados);
        }
      }
    };
    visitar(config);
    for (const nome of Object.keys(requisitos)) if (!usados.has(nome)) usados.set(nome, null);

    for (const [nome, origem] of usados) {
      const req = requisitos[nome];
      const fonte = req?.fonte ?? `hashicorp/${nome}`;
      const provedor = PROVEDORES[nome];
      const onde = req ? { arquivo: req.arquivo, linha: req.linha } : origem ? { arquivo: origem.arquivo, linha: origem.linha } : {};
      if (!provedor || (provedor.fonte !== fonte && !provedor.embutido)) {
        const parecido = sugerir(nome, Object.keys(PROVEDORES));
        this.diag.erro('Failed to query available provider packages',
          `Could not retrieve the list of available versions for provider ${fonte}: provider registry registry.terraform.io does not have a provider named registry.terraform.io/${fonte}.${parecido ? ` Você quis dizer "${parecido}"? Confira o começo do tipo do recurso (${parecido}_...).` : ''}`, onde);
        continue;
      }
      if (provedor.embutido) {
        this.provedoresUsados.set(nome, { nome, fonte: provedor.fonte, versao: VERSAO_TERRAFORM, embutido: true });
        continue;
      }
      if (req?.versao && !restricaoValida(req.versao)) {
        this.diag.erro('Invalid version constraint', `"${req.versao}" não é uma restrição de versão válida. Exemplos: "~> 6.0", ">= 4.0, < 6.0".`, onde);
        continue;
      }
      const versao = escolherVersao(provedor, req?.versao);
      if (!versao) {
        this.diag.erro('Failed to query available provider packages',
          `Could not retrieve the list of available versions for provider ${fonte}: no available releases match the given constraints ${req.versao}. Versões publicadas no simulador: ${provedor.versoes.join(', ')}.`, onde);
        continue;
      }
      this.provedoresUsados.set(nome, { nome, fonte, versao, restricao: req?.versao ?? null });
    }
    return { provedores: [...this.provedoresUsados.values()], backend, versaoTerraform: VERSAO_TERRAFORM };
  }

  lerBackend(bloco, arquivo) {
    const tipo = bloco.rotulos[0];
    const exigidos = { s3: ['bucket', 'key', 'region'], azurerm: ['resource_group_name', 'storage_account_name', 'container_name', 'key'], local: [], remote: [], gcs: ['bucket'] };
    if (!(tipo in exigidos)) {
      this.diag.erro('Unsupported backend type', `Não existe o backend "${tipo}". Use s3, azurerm, gcs, local ou remote.`, { arquivo, linha: bloco.linha });
      return { tipo };
    }
    const valores = {};
    for (const at of bloco.corpo.atributos) {
      const refs = referenciasDe(at.expr);
      if (refs.length) {
        this.diag.erro('Variables not allowed', 'O bloco backend é lido antes de tudo, então não aceita variáveis, locals nem referências. Escreva o valor fixo (ou passe com -backend-config).', { arquivo, linha: at.linha });
        continue;
      }
      valores[at.nome] = literal(at.expr);
    }
    for (const exigido of exigidos[tipo]) {
      if (!(exigido in valores)) {
        this.diag.erro('Missing required argument', `O backend "${tipo}" precisa do argumento "${exigido}".`, { arquivo, linha: bloco.linha });
      }
    }
    return { tipo, valores };
  }

  // ---------- validate: estrutura dos blocos contra o esquema ----------

  validarEstrutura(config, caminho) {
    for (const bloco of Object.values(config.recursos)) this.validarBlocoRecurso(bloco, 'managed');
    for (const bloco of Object.values(config.dados)) this.validarBlocoRecurso(bloco, 'data');
    for (const bloco of Object.values(config.variaveis)) {
      const permitidos = new Set(['type', 'default', 'description', 'sensitive', 'nullable', 'ephemeral']);
      for (const at of bloco.corpo.atributos) {
        if (!permitidos.has(at.nome)) {
          this.diag.erro('Unsupported argument', `O bloco variable não aceita "${at.nome}". Os válidos: type, default, description, sensitive, nullable e blocos validation.`, { arquivo: bloco.arquivo, linha: at.linha, contexto: `in variable "${bloco.rotulos[0]}"` });
        }
      }
      for (const sub of bloco.corpo.blocos) {
        if (sub.tipo !== 'validation') {
          this.diag.erro('Unsupported block type', `O bloco variable só aceita blocos validation, não "${sub.tipo}".`, { arquivo: bloco.arquivo, linha: sub.linha });
          continue;
        }
        const nomes = sub.corpo.atributos.map((a) => a.nome);
        for (const exigido of ['condition', 'error_message']) {
          if (!nomes.includes(exigido)) this.diag.erro('Missing required argument', `O bloco validation precisa de "${exigido}".`, { arquivo: bloco.arquivo, linha: sub.linha });
        }
        const condicao = sub.corpo.atributos.find((a) => a.nome === 'condition');
        if (condicao && !referenciasDe(condicao.expr).some((r) => r.endereco === `var.${bloco.rotulos[0]}`)) {
          this.diag.erro('Invalid variable validation condition', `A condição precisa usar a própria variável (var.${bloco.rotulos[0]}).`, { arquivo: bloco.arquivo, linha: condicao.linha });
        }
      }
      const tipoAt = bloco.corpo.atributos.find((a) => a.nome === 'type');
      if (tipoAt) {
        try {
          bloco.tipoLido = lerTipo(tipoAt.expr);
        } catch (erro) {
          this.diag.deErro(erro, `in variable "${bloco.rotulos[0]}"`, bloco.arquivo);
        }
      }
    }
    for (const bloco of Object.values(config.saidas)) {
      const nomes = bloco.corpo.atributos.map((a) => a.nome);
      if (!nomes.includes('value')) {
        this.diag.erro('Missing required argument', 'Todo output precisa de value = ... (o valor a mostrar).', { arquivo: bloco.arquivo, linha: bloco.linha, contexto: `in output "${bloco.rotulos[0]}"` });
      }
      for (const at of bloco.corpo.atributos) {
        if (!['value', 'description', 'sensitive', 'depends_on', 'ephemeral'].includes(at.nome)) {
          this.diag.erro('Unsupported argument', `O bloco output não aceita "${at.nome}". Os válidos: value, description, sensitive e depends_on.`, { arquivo: bloco.arquivo, linha: at.linha });
        }
      }
    }
    for (const [nome, bloco] of Object.entries(config.modulos)) {
      const fonte = bloco.corpo.atributos.find((a) => a.nome === 'source');
      if (!fonte) {
        this.diag.erro('Missing required argument', 'O bloco module precisa de source = "./caminho/do/modulo".', { arquivo: bloco.arquivo, linha: bloco.linha, contexto: `in module "${nome}"` });
        continue;
      }
      const valor = literal(fonte.expr);
      if (typeof valor !== 'string') {
        this.diag.erro('Variables not allowed', 'O source de um módulo precisa ser um texto fixo (não aceita variáveis).', { arquivo: bloco.arquivo, linha: fonte.linha });
        continue;
      }
      if (!/^\.\.?\//.test(valor)) {
        this.diag.erro('Module not installed',
          `O módulo "${valor}" vem de fora (registry, Git ou URL). O simulador só roda módulos locais, em pastas do próprio projeto (source = "./modulos/${nome}"). Na vida real, terraform init baixaria esse módulo.`,
          { arquivo: bloco.arquivo, linha: fonte.linha, contexto: `in module "${nome}"` });
        continue;
      }
      const dir = normalizarCaminho(`${config.dir}/${valor}`);
      if (caminho.split('/').filter(Boolean).length > 8) {
        this.diag.erro('Module recursion', 'Os módulos chamam uns aos outros em círculo.', { arquivo: bloco.arquivo, linha: bloco.linha });
        continue;
      }
      const tf = arquivosDoDiretorio(this.arquivos, dir).filter((a) => a.endsWith('.tf'));
      if (!tf.length) {
        this.diag.erro('Unreadable module directory',
          `Não há arquivos .tf em "${dir || '.'}". Crie o módulo como arquivos nessa pasta (ex.: ${dir}/main.tf) usando o botão + do editor.`,
          { arquivo: bloco.arquivo, linha: fonte.linha, contexto: `in module "${nome}"` });
        continue;
      }
      const filha = carregarConfig(this.arquivos, dir, this.diag);
      bloco.configFilha = filha;
      if (!filha.ok) continue;
      // Argumentos do módulo = variáveis do módulo filho.
      for (const at of bloco.corpo.atributos) {
        if (['source', 'version', 'count', 'for_each', 'providers', 'depends_on'].includes(at.nome)) continue;
        if (!filha.variaveis[at.nome]) {
          const parecido = sugerir(at.nome, Object.keys(filha.variaveis));
          this.diag.erro('Unsupported argument',
            `O módulo "${nome}" não tem a variável "${at.nome}".${parecido ? ` Você quis dizer "${parecido}"?` : ` Variáveis do módulo: ${Object.keys(filha.variaveis).join(', ') || 'nenhuma'}.`}`,
            { arquivo: bloco.arquivo, linha: at.linha, contexto: `in module "${nome}"` });
        }
      }
      for (const [nomeVar, decl] of Object.entries(filha.variaveis)) {
        const temPadrao = decl.corpo.atributos.some((a) => a.nome === 'default');
        if (!temPadrao && !bloco.corpo.atributos.some((a) => a.nome === nomeVar)) {
          this.diag.erro('Missing required argument',
            `O módulo "${nome}" exige a variável "${nomeVar}" (ela não tem default). Passe nomeVar = valor dentro do bloco module.`.replace('nomeVar', nomeVar),
            { arquivo: bloco.arquivo, linha: bloco.linha, contexto: `in module "${nome}"` });
        }
      }
      if (bloco.corpo.atributos.some((a) => a.nome === 'version')) {
        this.diag.erro('Invalid argument', 'version só vale para módulos do registry. Em módulos locais, a versão é a do próprio código.', { arquivo: bloco.arquivo, linha: bloco.linha });
      }
      this.validarEstrutura(filha, `${caminho}/${nome}`);
    }
  }

  validarBlocoRecurso(bloco, modo) {
    const { tipoRecurso, nome } = bloco;
    const contexto = `in ${modo === 'data' ? 'data' : 'resource'} "${tipoRecurso}" "${nome}"`;
    const onde = { arquivo: bloco.arquivo, linha: bloco.linha, contexto };
    const { provedor, def } = buscarTipo(tipoRecurso, modo);
    if (!provedor) return; // já acusado no init
    if (!def) {
      const opcoes = Object.keys(modo === 'data' ? provedor.dados : provedor.recursos);
      const parecido = sugerir(tipoRecurso, opcoes);
      const outroModo = modo === 'data' ? provedor.recursos[tipoRecurso] : provedor.dados[tipoRecurso];
      this.diag.erro(modo === 'data' ? 'Invalid data source' : 'Invalid resource type',
        `O provedor ${provedor.fonte} não tem o ${modo === 'data' ? 'data source' : 'tipo de recurso'} "${tipoRecurso}".${parecido ? ` Você quis dizer "${parecido}"?` : ''}${outroModo ? ` Existe um ${modo === 'data' ? 'resource' : 'data source'} com esse nome: use ${modo === 'data' ? 'resource' : 'data'} "${tipoRecurso}".` : ''}`,
        onde);
      return;
    }
    bloco.def = def;
    const attrs = bloco.corpo.atributos;
    if (attrs.some((a) => a.nome === 'count') && attrs.some((a) => a.nome === 'for_each')) {
      this.diag.erro('Invalid combination of "count" and "for_each"', 'Use count OU for_each no mesmo recurso, nunca os dois.', onde);
    }
    this.validarCorpo(bloco.corpo, def, def, contexto, bloco.arquivo, true);
  }

  /** Confere nomes de argumentos e de blocos (recursivo). */
  validarCorpo(corpo, def, raizDef, contexto, arquivo, ehRaiz) {
    for (const at of corpo.atributos) {
      if (ehRaiz && META_RECURSO.has(at.nome)) continue;
      if (def.args[at.nome]) continue;
      if (def.calc?.[at.nome]) {
        this.diag.erro('Value for unconfigurable attribute',
          `Não dá para definir "${at.nome}": esse valor é decidido pelo provedor depois do apply (é só de leitura). Apague esta linha.`,
          { arquivo, linha: at.linha, contexto });
        continue;
      }
      if (def.blocos?.[at.nome]) {
        this.diag.erro('Unsupported argument',
          `"${at.nome}" é um bloco, não um argumento: escreva ${at.nome} { ... } sem o "=".`, { arquivo, linha: at.linha, contexto });
        continue;
      }
      if (def.livre) continue;
      const parecido = sugerir(at.nome, Object.keys(def.args));
      this.diag.erro('Unsupported argument',
        `O argumento "${at.nome}" não existe aqui.${parecido ? ` Você quis dizer "${parecido}"?` : ''}`, { arquivo, linha: at.linha, contexto });
    }
    const contagem = {};
    for (const sub of corpo.blocos) {
      if (ehRaiz && (sub.tipo === 'lifecycle' || sub.tipo === 'provisioner' || sub.tipo === 'connection')) {
        if (sub.tipo === 'lifecycle') this.validarLifecycle(sub, arquivo, contexto, raizDef);
        continue;
      }
      if (sub.tipo === 'dynamic') {
        const tipoSub = sub.rotulos[0];
        if (!def.blocos?.[tipoSub]) {
          this.diag.erro('Unsupported block type', `O bloco dynamic "${tipoSub}" não corresponde a nenhum bloco deste recurso.`, { arquivo, linha: sub.linha, contexto });
          continue;
        }
        if (!sub.corpo.atributos.some((a) => a.nome === 'for_each')) {
          this.diag.erro('Missing required argument', 'O bloco dynamic precisa de for_each = coleção.', { arquivo, linha: sub.linha, contexto });
        }
        const conteudo = sub.corpo.blocos.find((b) => b.tipo === 'content');
        if (!conteudo) {
          this.diag.erro('Missing required block', 'O bloco dynamic precisa de um bloco content { ... } com os argumentos de cada item.', { arquivo, linha: sub.linha, contexto });
          continue;
        }
        this.validarCorpo(conteudo.corpo, def.blocos[tipoSub], raizDef, contexto, arquivo, false);
        contagem[tipoSub] = Infinity;
        continue;
      }
      const defSub = def.blocos?.[sub.tipo];
      if (!defSub) {
        if (def.livre) continue;
        if (def.args[sub.tipo]) {
          this.diag.erro('Unsupported block type',
            `"${sub.tipo}" é um argumento, não um bloco: escreva ${sub.tipo} = ${def.args[sub.tipo].tipo === 'map' ? '{ ... }' : '...'} (com o sinal de igual).`,
            { arquivo, linha: sub.linha, contexto });
        } else {
          const parecido = sugerir(sub.tipo, Object.keys(def.blocos ?? {}));
          this.diag.erro('Unsupported block type', `Blocos do tipo "${sub.tipo}" não são esperados aqui.${parecido ? ` Você quis dizer "${parecido}"?` : ''}`, { arquivo, linha: sub.linha, contexto });
        }
        continue;
      }
      if (sub.rotulos.length) {
        this.diag.erro('Extraneous label', `O bloco ${sub.tipo} não leva rótulo entre aspas.`, { arquivo, linha: sub.linha, contexto });
      }
      contagem[sub.tipo] = (contagem[sub.tipo] ?? 0) + 1;
      this.validarCorpo(sub.corpo, defSub, raizDef, contexto, arquivo, false);
    }
    for (const [nomeBloco, defSub] of Object.entries(def.blocos ?? {})) {
      const n = contagem[nomeBloco] ?? 0;
      if (n === Infinity) continue;
      if (n < defSub.min) {
        this.diag.erro(`Insufficient ${nomeBloco} blocks`, `É obrigatório ter pelo menos ${defSub.min} bloco "${nomeBloco}" aqui.`, { arquivo, linha: corpo.blocos[0]?.linha ?? undefined, contexto });
      }
      if (n > defSub.max) {
        this.diag.erro(`Too many ${nomeBloco} blocks`, `No máximo ${defSub.max} bloco "${nomeBloco}" é permitido aqui.`, { arquivo, linha: corpo.blocos.find((b) => b.tipo === nomeBloco)?.linha, contexto });
      }
    }
  }

  validarLifecycle(bloco, arquivo, contexto, def) {
    const validos = ['create_before_destroy', 'prevent_destroy', 'ignore_changes', 'replace_triggered_by'];
    for (const at of bloco.corpo.atributos) {
      if (!validos.includes(at.nome)) {
        const parecido = sugerir(at.nome, validos);
        this.diag.erro('Unsupported argument', `lifecycle não aceita "${at.nome}".${parecido ? ` Você quis dizer "${parecido}"?` : ` Os válidos: ${validos.join(', ')}.`}`, { arquivo, linha: at.linha, contexto });
      }
      if (at.nome === 'ignore_changes' && at.expr.k === 'tupla') {
        for (const item of at.expr.itens) {
          const nome = item.k === 'ref' ? item.raiz : null;
          if (nome && !def.args[nome] && !def.blocos[nome]) {
            this.diag.erro('Unsupported attribute', `ignore_changes: o recurso não tem o argumento "${nome}".`, { arquivo, linha: at.linha, contexto });
          }
        }
      }
    }
    for (const sub of bloco.corpo.blocos) {
      if (!['precondition', 'postcondition'].includes(sub.tipo)) {
        this.diag.erro('Unsupported block type', `lifecycle só aceita blocos precondition e postcondition, não "${sub.tipo}".`, { arquivo, linha: sub.linha, contexto });
      }
    }
  }

  // ---------- provedores ----------

  configurarProvedores(config) {
    this.configsProvedor = new Map(); // "aws" ou "aws.alias" → { valores, bloco }
    const avaliarSimples = (expr, arquivo) => avaliar(expr, {
      arquivo,
      resolver: (ref, ctx) => this.raiz.resolver(ref, ctx),
      lerArquivo: (p) => this.lerArquivo(p, ''),
      existeArquivo: (p) => this.existeArquivo(p, ''),
      avaliarTexto: () => '',
    });
    this.avaliarProvedor = avaliarSimples;
    for (const bloco of config.provedores) {
      const nome = bloco.rotulos[0];
      const aliasAt = bloco.corpo.atributos.find((a) => a.nome === 'alias');
      const alias = aliasAt ? literal(aliasAt.expr) : null;
      const chave = alias ? `${nome}.${alias}` : nome;
      if (this.configsProvedor.has(chave)) {
        this.diag.erro('Duplicate provider configuration',
          alias ? `Já existe um provider "${nome}" com alias "${alias}".` : `Já existe um provider "${nome}" sem alias. Para ter dois (ex.: duas regiões), dê um alias = "nome" ao segundo.`,
          { arquivo: bloco.arquivo, linha: bloco.linha });
        continue;
      }
      this.configsProvedor.set(chave, { bloco, nome, alias, valores: null });
    }
  }

  /** Valores de um provider (avaliados sob demanda, porque podem usar variáveis). */
  configProvedor(chave) {
    const reg = this.configsProvedor.get(chave);
    if (!reg) return null;
    if (reg.valores) return reg.valores;
    const { bloco, nome } = reg;
    const provedor = PROVEDORES[nome];
    const valores = {};
    const contexto = `in provider "${nome}"`;
    for (const at of bloco.corpo.atributos) {
      if (at.nome === 'alias') continue;
      if (provedor?.configuracao && !provedor.configuracao.args[at.nome]) {
        const parecido = sugerir(at.nome, Object.keys(provedor.configuracao.args));
        this.diag.erro('Unsupported argument', `O provider "${nome}" não aceita "${at.nome}".${parecido ? ` Você quis dizer "${parecido}"?` : ''}`, { arquivo: bloco.arquivo, linha: at.linha, contexto });
        continue;
      }
      try {
        valores[at.nome] = this.avaliarProvedor(at.expr, bloco.arquivo);
      } catch (erro) {
        this.diag.deErro(erro, contexto, bloco.arquivo);
      }
    }
    for (const sub of bloco.corpo.blocos) {
      if (provedor?.configuracao && !provedor.configuracao.blocos[sub.tipo]) {
        this.diag.erro('Unsupported block type', `O provider "${nome}" não aceita blocos "${sub.tipo}".`, { arquivo: bloco.arquivo, linha: sub.linha, contexto });
        continue;
      }
      const conteudo = {};
      for (const at of sub.corpo.atributos) {
        try {
          conteudo[at.nome] = this.avaliarProvedor(at.expr, bloco.arquivo);
        } catch (erro) {
          this.diag.deErro(erro, contexto, bloco.arquivo);
        }
      }
      (valores[sub.tipo] ??= []).push(conteudo);
    }
    if (nome === 'aws') {
      if (valores.region === undefined || valores.region === null) {
        this.diag.erro('Missing required argument',
          'O provedor AWS precisa saber a região. Adicione region dentro do bloco: provider "aws" { region = "us-east-1" }.',
          { arquivo: bloco.arquivo, linha: bloco.linha, contexto });
      } else if (typeof valores.region === 'string' && !REGIOES_AWS.includes(valores.region)) {
        const parecido = sugerir(valores.region, REGIOES_AWS);
        this.diag.erro('Invalid AWS Region', `"${valores.region}" não é uma região da AWS.${parecido ? ` Você quis dizer "${parecido}"?` : ' Exemplos: us-east-1, sa-east-1 (São Paulo).'}`, { arquivo: bloco.arquivo, linha: bloco.linha, contexto });
      }
    }
    if (nome === 'azurerm' && !valores.features?.length) {
      this.diag.erro('Insufficient features blocks', 'O provider azurerm exige um bloco features {} (mesmo vazio): provider "azurerm" { features {} }.', { arquivo: bloco.arquivo, linha: bloco.linha, contexto });
    }
    reg.valores = valores;
    return valores;
  }

  /** Config do provedor que um recurso usa: o padrão ou o indicado em provider = aws.alias. */
  provedorDoRecurso(bloco, escopo) {
    const nome = provedorDoTipo(bloco.tipoRecurso);
    const meta = bloco.corpo.atributos.find((a) => a.nome === 'provider');
    let chave = nome;
    if (meta) {
      if (meta.expr.k !== 'ref' || meta.expr.passos.length > 1) {
        this.diag.erro('Invalid provider reference', 'provider = espera uma referência como aws.sp (sem aspas).', { arquivo: bloco.arquivo, linha: meta.linha });
      } else {
        chave = meta.expr.passos.length ? `${meta.expr.raiz}.${meta.expr.passos[0].attr}` : meta.expr.raiz;
      }
    }
    chave = escopo.mapaProvedores?.[chave] ?? chave;
    if (['random', 'local', 'null', 'terraform', 'tls', 'archive'].includes(nome)) return { chave, valores: this.configProvedor(chave) ?? {} };
    if (!this.configsProvedor.has(chave)) {
      if (chave.includes('.')) {
        this.diag.erro('Provider configuration not present',
          `O recurso ${bloco.tipoRecurso}.${bloco.nome} usa o provider ${chave}, mas não existe provider "${nome}" com alias = "${chave.split('.')[1]}".`,
          { arquivo: bloco.arquivo, linha: meta?.linha ?? bloco.linha });
        return { chave, valores: {} };
      }
      if (nome === 'aws') {
        this.diag.erro('Missing required argument',
          'Falta configurar o provedor AWS. Adicione: provider "aws" { region = "us-east-1" }.', { arquivo: bloco.arquivo, linha: bloco.linha, contexto: `in resource "${bloco.tipoRecurso}" "${bloco.nome}"` });
      } else if (nome === 'azurerm') {
        this.diag.erro('Insufficient features blocks', 'Falta configurar o provedor Azure. Adicione: provider "azurerm" { features {} }.', { arquivo: bloco.arquivo, linha: bloco.linha, contexto: `in resource "${bloco.tipoRecurso}" "${bloco.nome}"` });
      }
      return { chave, valores: {} };
    }
    return { chave, valores: this.configProvedor(chave) ?? {} };
  }

  // ---------- arquivos (file(), templatefile()) ----------

  lerArquivo(caminho, dirModulo) {
    const n = normalizarCaminho(caminho.startsWith('/') ? caminho : `${dirModulo}/${caminho}`);
    if (!(n in this.arquivos)) {
      throw new ErroValor('Invalid function argument', `no file exists at "${caminho}". Crie o arquivo ${n} no editor (botão +).`);
    }
    return this.arquivos[n];
  }
  existeArquivo(caminho, dirModulo) {
    return normalizarCaminho(`${dirModulo}/${caminho}`) in this.arquivos;
  }

  lerTfvars(config) {
    const valores = {};
    for (const { arquivo, corpo } of config.tfvars) {
      for (const bloco of corpo.blocos) {
        this.diag.erro('Unexpected block', 'Arquivos .tfvars só têm atributos (nome = valor), não blocos.', { arquivo, linha: bloco.linha });
      }
      for (const at of corpo.atributos) {
        try {
          valores[at.nome] = avaliar(at.expr, {
            arquivo,
            resolver: () => { throw new ErroAvaliacao('Variables not allowed', 'Em arquivos .tfvars só cabem valores fixos: nada de var., local. ou referências.', { arquivo, linha: at.linha }); },
            lerArquivo: () => { throw new ErroValor('Function calls not allowed', 'file() não pode ser usada em .tfvars.'); },
            existeArquivo: () => false,
            avaliarTexto: () => '',
          });
          if (!config.variaveis[at.nome]) {
            this.diag.aviso('Value for undeclared variable',
              `O arquivo ${arquivo} define "${at.nome}", mas não existe variable "${at.nome}" declarada. O valor será ignorado.`, { arquivo, linha: at.linha });
          }
        } catch (erro) {
          this.diag.deErro(erro, undefined, arquivo);
        }
      }
    }
    return valores;
  }

  // ---------- plano ----------

  montarPlano() {
    const acoes = [];
    const vistos = new Set();
    const movidos = this.movidos ?? [];
    for (const inst of this.instancias.values()) {
      vistos.add(inst.endereco);
      acoes.push(inst);
    }
    for (const [endereco, anterior] of Object.entries(this.estadoAnterior.recursos)) {
      if (vistos.has(endereco) || anterior.modo === 'data') continue;
      const esquecer = this.removidos?.has(endereco.replace(/\[.*\]$/, ''));
      if (this.comando === 'destroy') continue;
      acoes.push({
        endereco, tipo: anterior.tipo, nome: anterior.nome, modo: 'managed', modulo: anterior.modulo, chave: anterior.chave,
        acao: esquecer ? 'esquecer' : 'destruir', antes: anterior.atributos, depois: null, motivo: esquecer ? 'removed' : 'config',
        def: buscarTipo(anterior.tipo).def, sensiveis: new Set(anterior.sensiveis ?? []),
      });
    }
    if (this.comando === 'destroy') {
      const destruir = Object.entries(this.estadoAnterior.recursos).filter(([, r]) => r.modo !== 'data').map(([endereco, anterior]) => ({
        endereco, tipo: anterior.tipo, nome: anterior.nome, modo: 'managed', modulo: anterior.modulo, chave: anterior.chave,
        acao: 'destruir', antes: anterior.atributos, depois: null, motivo: 'destroy', def: buscarTipo(anterior.tipo).def,
        sensiveis: new Set(anterior.sensiveis ?? []),
        bloqueado: this.instancias.get(endereco)?.preventDestroy,
      }));
      for (const d of destruir) {
        if (d.bloqueado) {
          this.diag.erro('Instance cannot be destroyed',
            `O recurso ${d.endereco} tem lifecycle { prevent_destroy = true }, e o terraform destroy tentou apagá-lo. Para continuar, desligue prevent_destroy.`,
            { arquivo: this.instancias.get(d.endereco).arquivo, linha: this.instancias.get(d.endereco).linha });
        }
      }
      acoes.length = 0;
      acoes.push(...destruir);
    }
    for (const a of acoes) {
      if ((a.acao === 'destruir' || a.acao === 'substituir') && a.preventDestroy && this.comando !== 'destroy') {
        this.diag.erro('Instance cannot be destroyed',
          `O recurso ${a.endereco} tem lifecycle { prevent_destroy = true }, mas o plano precisa ${a.acao === 'substituir' ? 'recriá-lo (apagar e criar de novo)' : 'apagá-lo'}. Desligue prevent_destroy ou mude a configuração para não forçar a recriação.`,
          { arquivo: a.arquivo, linha: a.linha });
      }
    }
    acoes.sort((x, y) => (x.endereco < y.endereco ? -1 : x.endereco > y.endereco ? 1 : 0));
    const resumo = { importar: 0, criar: 0, alterar: 0, destruir: 0, substituir: 0, ler: 0, mover: movidos.length, esquecer: 0 };
    for (const a of acoes) {
      if (a.acao === 'criar') resumo.criar += 1;
      if (a.acao === 'alterar') resumo.alterar += 1;
      if (a.acao === 'destruir') resumo.destruir += 1;
      if (a.acao === 'substituir') {
        resumo.criar += 1;
        resumo.destruir += 1;
        resumo.substituir += 1;
      }
      if (a.acao === 'importar') resumo.importar += 1;
      if (a.acao === 'esquecer') resumo.esquecer += 1;
    }
    for (const d of this.dados.values()) if (d.acao === 'ler') resumo.ler += 1;
    const saidas = this.planoSaidas();
    return { acoes, dadosLidos: [...this.dados.values()].filter((d) => d.acao === 'ler'), resumo, saidas, movidos };
  }

  aplicarMovidos() {
    const movidos = [];
    const lerEndereco = (expr) => {
      if (!expr || expr.k !== 'ref') return null;
      const partes = [expr.raiz, ...expr.passos.map((p) => (p.attr !== undefined ? p.attr : `[${JSON.stringify(avaliar(p.indice, { resolver: () => ({ valor: null, consumidos: 0 }) }))}]`))];
      return partes.join('.').replace(/\.\[/g, '[');
    };
    for (const bloco of this.raizConfig.movidos) {
      const de = lerEndereco(bloco.corpo.atributos.find((a) => a.nome === 'from')?.expr);
      const para = lerEndereco(bloco.corpo.atributos.find((a) => a.nome === 'to')?.expr);
      if (!de || !para) {
        this.diag.erro('Invalid "moved" block', 'O bloco moved precisa de from = endereço_antigo e to = endereço_novo (sem aspas).', { arquivo: bloco.arquivo, linha: bloco.linha });
        continue;
      }
      for (const end of Object.keys(this.estadoAnterior.recursos)) {
        if (end === de || end.startsWith(`${de}[`)) {
          const novo = para + end.slice(de.length);
          if (this.estadoAnterior.recursos[novo]) continue;
          movidos.push({ de: end, para: novo });
        }
      }
    }
    this.removidos = new Set();
    for (const bloco of this.raizConfig.removidos) {
      const de = lerEndereco(bloco.corpo.atributos.find((a) => a.nome === 'from')?.expr);
      if (de) this.removidos.add(de);
    }
    return movidos;
  }

  planoSaidas() {
    const saidas = [];
    if (!this.raiz) return saidas;
    const antes = this.estadoAnterior.saidas ?? {};
    const atuais = this.comando === 'destroy' ? {} : this.raiz.valoresSaidas();
    for (const [nome, s] of Object.entries(atuais)) {
      const anterior = antes[nome];
      let acao = 'nada';
      if (!anterior) acao = 'criar';
      else if (!iguais(anterior.valor, s.valor) || temDesconhecido(s.valor)) acao = 'alterar';
      saidas.push({ nome, acao, antes: anterior?.valor ?? null, depois: s.valor, sensivel: s.sensivel });
    }
    for (const [nome, anterior] of Object.entries(antes)) {
      if (!(nome in atuais)) saidas.push({ nome, acao: 'destruir', antes: anterior.valor, depois: null, sensivel: anterior.sensivel });
    }
    return saidas.sort((a, b) => (a.nome < b.nome ? -1 : 1));
  }

  // ---------- apply ----------

  aplicar(plano) {
    const novo = copiar(this.estadoAnterior);
    novo.recursos = { ...novo.recursos };
    const eventos = [];
    const falhos = new Set(this.falhasApply.map((f) => f.endereco));
    // As instâncias entram no mapa na ordem em que foram avaliadas: dependências primeiro.
    const ordem = [...this.instancias.keys()];
    const posicao = (e) => {
      const i = ordem.indexOf(e);
      return i < 0 ? -1 : i;
    };
    const acoesOrdenadas = [...plano.acoes].sort((x, y) => {
      const dx = x.acao === 'destruir' || x.acao === 'esquecer';
      const dy = y.acao === 'destruir' || y.acao === 'esquecer';
      if (dx !== dy) return dx ? -1 : 1;
      return dx ? posicao(y.endereco) - posicao(x.endereco) : posicao(x.endereco) - posicao(y.endereco);
    });
    for (const a of acoesOrdenadas) {
      if (a.acao === 'destruir' || a.acao === 'esquecer') {
        delete novo.recursos[a.endereco];
        eventos.push({ endereco: a.endereco, acao: a.acao, id: a.antes?.id });
        continue;
      }
      if (falhos.has(a.endereco) || a.dependeDeFalha?.()) {
        if (a.acao === 'substituir') delete novo.recursos[a.endereco];
        continue;
      }
      novo.recursos[a.endereco] = {
        modo: 'managed', tipo: a.tipo, nome: a.nome, modulo: a.modulo, chave: a.chave, provedor: a.provedor,
        atributos: copiar(a.final ?? a.depois), dependencias: a.dependencias ?? [], geracao: a.geracao ?? 0,
        sensiveis: [...(a.sensiveis ?? [])],
      };
      if (a.acao !== 'nada') eventos.push({ endereco: a.endereco, acao: a.acao, id: a.final?.id });
    }
    for (const d of this.dados.values()) {
      if (d.final) novo.recursos[d.endereco] = { modo: 'data', tipo: d.tipo, nome: d.nome, modulo: d.modulo, chave: d.chave, provedor: d.provedor, atributos: copiar(d.final), dependencias: [], geracao: 0, sensiveis: [] };
    }
    novo.saidas = {};
    if (this.comando !== 'destroy' && this.raiz) {
      for (const [nome, s] of Object.entries(this.raiz.valoresSaidas())) novo.saidas[nome] = { valor: s.valor, sensivel: s.sensivel };
    }
    if (this.comando === 'destroy') {
      for (const end of Object.keys(novo.recursos)) if (novo.recursos[end].modo === 'data') delete novo.recursos[end];
    }
    novo.serial = (this.estadoAnterior.serial ?? 0) + 1;
    novo.eventos = eventos;
    return novo;
  }

  saidasFinais(r) {
    if ((r.comando === 'apply' || r.comando === 'destroy') && r.ok) return r.estado.saidas ?? {};
    if (!this.raiz) return {};
    try {
      return this.raiz.valoresSaidas();
    } catch {
      return {};
    }
  }

  // ---------- grafo de dependências ----------

  montarGrafo() {
    const nos = [];
    const arestas = [];
    const config = this.raizConfig;
    if (!config) return { nos, arestas };
    const visitar = (cfg, prefixo) => {
      const no = (id, tipo, rotulo, info = {}) => nos.push({ id: prefixo + id, tipo, rotulo: rotulo ?? id, ...info });
      const ligar = (de, exprs, extras = []) => {
        const alvos = new Set(extras);
        for (const e of exprs) {
          for (const { endereco } of referenciasDe(e)) {
            if (['count', 'each', 'path', 'terraform', 'self'].includes(endereco)) continue;
            alvos.add(endereco);
          }
        }
        for (const a of alvos) arestas.push({ de: prefixo + de, para: prefixo + a });
      };
      const exprsDoCorpo = (corpo) => [
        ...corpo.atributos.map((a) => a.expr),
        ...corpo.blocos.flatMap((b) => exprsDoCorpo(b.corpo)),
      ];
      for (const nome of Object.keys(cfg.variaveis)) no(`var.${nome}`, 'variavel', `var.${nome}`);
      for (const [nome, at] of Object.entries(cfg.locais)) {
        no(`local.${nome}`, 'local', `local.${nome}`);
        ligar(`local.${nome}`, [at.expr]);
      }
      for (const [end, bloco] of [...Object.entries(cfg.recursos), ...Object.entries(cfg.dados)]) {
        no(end, bloco.modo === 'data' ? 'dado' : 'recurso', end, { tipoRecurso: bloco.tipoRecurso, provedor: provedorDoTipo(bloco.tipoRecurso) });
        const deps = bloco.corpo.atributos.find((a) => a.nome === 'depends_on');
        const extras = deps?.expr.k === 'tupla' ? deps.expr.itens.filter((i) => i.k === 'ref').map((i) => referenciasDe(i)[0]?.endereco).filter(Boolean) : [];
        ligar(end, exprsDoCorpo({ atributos: bloco.corpo.atributos.filter((a) => a.nome !== 'depends_on'), blocos: bloco.corpo.blocos }), extras);
      }
      for (const [nome, bloco] of Object.entries(cfg.saidas)) {
        no(`output.${nome}`, 'saida', `output.${nome}`);
        ligar(`output.${nome}`, exprsDoCorpo(bloco.corpo));
      }
      for (const [nome, bloco] of Object.entries(cfg.modulos)) {
        no(`module.${nome}`, 'modulo', `module.${nome}`);
        ligar(`module.${nome}`, exprsDoCorpo(bloco.corpo));
      }
    };
    visitar(config, '');
    const ids = new Set(nos.map((n) => n.id));
    return { nos, arestas: arestas.filter((a) => ids.has(a.para) && ids.has(a.de) && a.de !== a.para) };
  }

  resumoBlocos() {
    const cfg = this.raizConfig;
    if (!cfg) return {};
    const lerAt = (bloco, nome) => {
      const at = bloco.corpo.atributos.find((a) => a.nome === nome);
      if (!at) return undefined;
      try {
        return avaliar(at.expr, { resolver: () => ({ valor: desconhecido('ref'), consumidos: 99 }), lerArquivo: () => '', existeArquivo: () => false, avaliarTexto: () => '' });
      } catch {
        return undefined;
      }
    };
    return {
      variaveis: Object.fromEntries(Object.entries(cfg.variaveis).map(([n, b]) => [n, {
        tipo: b.tipoLido ? nomeTipo(b.tipoLido) : null,
        padrao: lerAt(b, 'default'),
        temPadrao: b.corpo.atributos.some((a) => a.nome === 'default'),
        descricao: lerAt(b, 'description'),
        sensivel: lerAt(b, 'sensitive') === true,
        validacoes: b.corpo.blocos.filter((s) => s.tipo === 'validation').length,
        nullable: lerAt(b, 'nullable'),
      }])),
      saidas: Object.fromEntries(Object.entries(cfg.saidas).map(([n, b]) => [n, { descricao: lerAt(b, 'description'), sensivel: lerAt(b, 'sensitive') === true }])),
      recursos: Object.fromEntries(Object.entries(cfg.recursos).map(([end, b]) => {
        const lc = b.corpo.blocos.find((s) => s.tipo === 'lifecycle');
        return [end, {
          tipo: b.tipoRecurso,
          count: b.corpo.atributos.some((a) => a.nome === 'count'),
          forEach: b.corpo.atributos.some((a) => a.nome === 'for_each'),
          dependsOn: (b.corpo.atributos.find((a) => a.nome === 'depends_on')?.expr.itens ?? []).map((i) => referenciasDe(i)[0]?.endereco),
          provider: (() => { const p = b.corpo.atributos.find((a) => a.nome === 'provider'); return p?.expr.k === 'ref' ? [p.expr.raiz, ...p.expr.passos.map((x) => x.attr)].join('.') : null; })(),
          lifecycle: lc ? Object.fromEntries(lc.corpo.atributos.map((a) => [a.nome, a.expr.k === 'tupla' ? a.expr.itens.map((i) => (i.k === 'ref' ? i.raiz : null)) : lerAt(lc, a.nome)])) : {},
          dinamicos: b.corpo.blocos.filter((s) => s.tipo === 'dynamic').map((s) => s.rotulos[0]),
          provisioners: b.corpo.blocos.filter((s) => s.tipo === 'provisioner').map((s) => s.rotulos[0]),
        }];
      })),
      dados: Object.keys(cfg.dados),
      modulos: Object.fromEntries(Object.entries(cfg.modulos).map(([n, b]) => [n, {
        source: lerAt(b, 'source'),
        count: b.corpo.atributos.some((a) => a.nome === 'count'),
        forEach: b.corpo.atributos.some((a) => a.nome === 'for_each'),
        entradas: b.corpo.atributos.filter((a) => !['source', 'count', 'for_each', 'providers', 'depends_on', 'version'].includes(a.nome)).map((a) => a.nome),
      }])),
      provedores: this.raizConfig.provedores.map((b) => ({
        nome: b.rotulos[0],
        alias: lerAt(b, 'alias') ?? null,
        valores: (() => { try { return this.configProvedor(b.rotulos[0] + (lerAt(b, 'alias') ? `.${lerAt(b, 'alias')}` : '')) ?? {}; } catch { return {}; } })(),
      })),
      requeridos: Object.fromEntries(this.raizConfig.terraform.flatMap((t) => t.corpo.blocos.filter((s) => s.tipo === 'required_providers').flatMap((s) => s.corpo.atributos.map((a) => [a.nome, literal(a.expr)])))),
      versaoExigida: this.raizConfig.terraform.map((t) => literal(t.corpo.atributos.find((a) => a.nome === 'required_version')?.expr)).find((v) => v) ?? null,
      backend: this.raizConfig.terraform.flatMap((t) => t.corpo.blocos.filter((s) => s.tipo === 'backend').map((s) => ({ tipo: s.rotulos[0], valores: Object.fromEntries(s.corpo.atributos.map((a) => [a.nome, literal(a.expr)])) })))[0] ?? null,
      movidos: this.raizConfig.movidos.length,
      importacoes: this.raizConfig.importacoes.length,
      removidos: this.raizConfig.removidos.length,
    };
  }
}

function estadoVazio() {
  return { versao: 4, serial: 0, linhagem: null, recursos: {}, saidas: {} };
}

/** Valor de uma expressão que não pode depender de nada (versões, source...). */
function literal(expr) {
  if (!expr) return undefined;
  try {
    return avaliar(expr, { resolver: () => { throw new ErroValor('Variables not allowed', 'Aqui só cabem valores fixos.'); }, lerArquivo: () => '', existeArquivo: () => false, avaliarTexto: () => '' });
  } catch {
    return undefined;
  }
}

// =====================================================================
// Escopo: uma instância de módulo (a raiz ou module.x)
// =====================================================================

class Escopo {
  constructor(execucao, config, caminho, pai, { entradas = {}, mapaProvedores = null, chaveInstancia = null } = {}) {
    this.ex = execucao;
    this.config = config;
    this.caminho = caminho; // ['module.rede'] ...
    this.prefixo = caminho.length ? `${caminho.join('.')}.` : '';
    this.pai = pai;
    this.entradas = entradas;
    this.mapaProvedores = mapaProvedores;
    this.chaveInstancia = chaveInstancia;
    this.memo = new Map();
    this.visitando = new Set();
    this.vars = {};
    this.sensiveisVar = new Set();
    this.erros = new Set();
  }

  get diag() { return this.ex.diag; }

  // ---------- variáveis ----------

  prepararVariaveis(tfvars = {}) {
    for (const [nome, bloco] of Object.entries(this.config.variaveis)) {
      const ctxErro = { arquivo: bloco.arquivo, linha: bloco.linha, contexto: `in variable "${nome}"` };
      const attrs = Object.fromEntries(bloco.corpo.atributos.map((a) => [a.nome, a]));
      const fixo = (at) => (at ? literalOuErro(at, bloco, this.diag) : undefined);
      const sensivel = fixo(attrs.sensitive) === true;
      if (sensivel) this.sensiveisVar.add(nome);
      let valor;
      let origem;
      if (this.caminho.length === 0) {
        if (nome in this.ex.variaveisCli) { valor = this.ex.variaveisCli[nome]; origem = 'cli'; } else if (nome in tfvars) { valor = tfvars[nome]; origem = 'tfvars'; }
      } else if (nome in this.entradas) {
        ({ valor } = this.entradas[nome]);
        if (this.entradas[nome].sensivel) this.sensiveisVar.add(nome);
        origem = 'modulo';
      }
      if (valor === undefined || (valor === null && fixo(attrs.nullable) === false)) {
        if (attrs.default) {
          valor = literalOuErro(attrs.default, bloco, this.diag);
          origem = 'default';
        } else if (valor === undefined) {
          this.diag.erro('No value for required variable',
            this.caminho.length
              ? `O módulo precisa receber a variável "${nome}".`
              : `A variável "${nome}" não tem default e não recebeu valor. Dê um default, crie um terraform.tfvars com ${nome} = ... ou passe -var="${nome}=...".`,
            ctxErro);
          valor = desconhecido(`var.${nome}`);
          origem = 'faltando';
        }
      }
      try {
        valor = converter(valor, bloco.tipoLido, `var.${nome}`, (e) => avaliar(e, this.contextoSimples(bloco.arquivo)));
      } catch (erro) {
        if (erro instanceof ErroValor) this.diag.erro(erro.resumo, erro.detalhe, { ...ctxErro, linha: (attrs.default && origem === 'default' ? attrs.default.linha : bloco.linha) });
        else this.diag.deErro(erro, `in variable "${nome}"`, bloco.arquivo);
        valor = desconhecido(`var.${nome}`);
      }
      this.vars[nome] = { valor, origem, sensivel };
    }
    // Validações (depois de todas as variáveis prontas).
    for (const [nome, bloco] of Object.entries(this.config.variaveis)) {
      for (const val of bloco.corpo.blocos.filter((b) => b.tipo === 'validation')) {
        const cond = val.corpo.atributos.find((a) => a.nome === 'condition');
        const msg = val.corpo.atributos.find((a) => a.nome === 'error_message');
        if (!cond) continue;
        try {
          const ok = avaliar(cond.expr, this.contexto(bloco.arquivo));
          if (ehDesconhecido(ok)) continue;
          if (typeof ok !== 'boolean') throw new ErroValor('Invalid validation condition', 'A condição de validação precisa resultar em true ou false.');
          if (!ok) {
            const texto = msg ? avaliar(msg.expr, this.contexto(bloco.arquivo)) : 'Valor inválido.';
            this.diag.erro('Invalid value for variable',
              `${texto}\n\nEsta regra está em ${bloco.arquivo}:${val.linha} (validation da variável "${nome}"). Valor recebido: ${JSON.stringify(this.vars[nome].valor)}.`,
              { arquivo: bloco.arquivo, linha: cond.linha, contexto: `in variable "${nome}"` });
          }
        } catch (erro) {
          this.diag.deErro(erro, `in variable "${nome}"`, bloco.arquivo);
        }
      }
    }
  }

  valoresVariaveis() {
    return Object.fromEntries(Object.entries(this.vars).map(([n, v]) => [n, { valor: v.valor, origem: v.origem, sensivel: v.sensivel }]));
  }

  valoresLocais() {
    const saida = {};
    for (const nome of Object.keys(this.config.locais)) {
      try {
        saida[nome] = this.obter(`local.${nome}`, () => this.calcularLocal(nome));
      } catch {
        saida[nome] = desconhecido(`local.${nome}`);
      }
    }
    return saida;
  }

  // ---------- contexto para o avaliador ----------

  contexto(arquivo, locais = null) {
    const ctx = {
      arquivo,
      locais,
      sensivel: false,
      resolver: (ref, c) => this.resolver(ref, c),
      lerArquivo: (p) => this.ex.lerArquivo(p, this.config.dir),
      existeArquivo: (p) => this.ex.existeArquivo(p, this.config.dir),
      avaliarTexto: (texto, vars) => {
        return avaliar(analisarExpressao(texto), { ...this.contexto(arquivo), locais: vars });
      },
    };
    return ctx;
  }

  contextoSimples(arquivo) {
    return { arquivo, resolver: () => { throw new ErroValor('Variables not allowed', 'Aqui só cabem valores fixos.'); }, lerArquivo: () => '', existeArquivo: () => false, avaliarTexto: () => '' };
  }

  /** Resolve a raiz de uma referência. Devolve { valor, consumidos }. */
  resolver(ref, ctx) {
    const p = ref.passos;
    const nome0 = p[0]?.attr;
    const erro = (resumo, detalhe) => new ErroAvaliacao(resumo, detalhe, { linha: ref.linha, coluna: ref.coluna, arquivo: ctx.arquivo });
    switch (ref.raiz) {
      case 'var': {
        if (!nome0) throw erro('Invalid reference', 'Use var.nome_da_variavel (o objeto var sozinho não pode ser usado).');
        if (!(nome0 in this.vars)) {
          if (this.config.variaveis[nome0]) return { valor: desconhecido(`var.${nome0}`), consumidos: 1 };
          const parecido = sugerir(nome0, Object.keys(this.config.variaveis));
          throw erro('Reference to undeclared input variable',
            `Não existe variable "${nome0}".${parecido ? ` Você quis dizer var.${parecido}?` : ` Declare com: variable "${nome0}" { ... }`}`);
        }
        if (this.vars[nome0].sensivel || this.sensiveisVar.has(nome0)) ctx.sensivel = true;
        return { valor: this.vars[nome0].valor, consumidos: 1 };
      }
      case 'local': {
        if (!nome0) throw erro('Invalid reference', 'Use local.nome (no singular: local, e não locals).');
        if (!this.config.locais[nome0]) {
          const parecido = sugerir(nome0, Object.keys(this.config.locais));
          throw erro('Reference to undeclared local value', `Não existe o local "${nome0}".${parecido ? ` Você quis dizer local.${parecido}?` : ' Declare dentro de um bloco locals { }.'}`);
        }
        const r = this.obterComSensivel(`local.${nome0}`, () => this.calcularLocal(nome0));
        if (r.sensivel) ctx.sensivel = true;
        return { valor: r.valor, consumidos: 1 };
      }
      case 'locals':
        throw erro('Reference to undeclared resource', 'Para ler um local, use local.nome (no singular). O bloco é que se chama locals.');
      case 'count':
        if (!ctx.locais?.__count) throw erro('Reference to "count" in non-counted context', 'count.index só pode ser usado dentro de um recurso ou módulo que tem count.');
        return { valor: ctx.locais.__count, consumidos: 0 };
      case 'each':
        if (!ctx.locais?.__each) throw erro('Reference to "each" in context without for_each', 'each.key e each.value só podem ser usados dentro de um recurso ou módulo que tem for_each.');
        return { valor: ctx.locais.__each, consumidos: 0 };
      case 'path':
        return { valor: { module: this.config.dir ? `./${this.config.dir}` : '.', root: '.', cwd: '.' }, consumidos: 0 };
      case 'terraform':
        return { valor: { workspace: this.ex.workspace }, consumidos: 0 };
      case 'self':
        if (ctx.locais?.__self) return { valor: ctx.locais.__self, consumidos: 0 };
        throw erro('Invalid "self" reference', 'self só pode ser usado dentro de provisioner e connection.');
      case 'data': {
        const tipo = p[0]?.attr;
        const nome = p[1]?.attr;
        if (!tipo || !nome) throw erro('Invalid data resource reference', 'Use data.TIPO.NOME.atributo (ex.: data.aws_ami.ubuntu.id).');
        const end = `data.${tipo}.${nome}`;
        if (!this.config.dados[end]) {
          throw erro('Reference to undeclared resource', `Não existe data "${tipo}" "${nome}" neste módulo.`);
        }
        const valor = this.obter(this.prefixo + end, () => this.calcularDado(end));
        return { valor, consumidos: 2 };
      }
      case 'module': {
        if (!nome0) throw erro('Invalid reference', 'Use module.NOME.saida.');
        if (!this.config.modulos[nome0]) throw erro('Reference to undeclared module', `Não existe module "${nome0}" neste módulo.`);
        const r = this.obterComSensivel(`${this.prefixo}module.${nome0}`, () => this.calcularModulo(nome0));
        if (r.sensivel) ctx.sensivel = true;
        return { valor: r.valor, consumidos: 1 };
      }
      default: {
        if (!nome0) {
          throw erro('Invalid reference',
            `"${ref.raiz}" sozinho não é um valor. Se for um texto, use aspas ("${ref.raiz}"). Se for um recurso, escreva TIPO.NOME.atributo.`);
        }
        const end = `${ref.raiz}.${nome0}`;
        if (!this.config.recursos[end]) {
          const ehTipo = ref.raiz.includes('_');
          if (!ehTipo) {
            throw erro('Invalid reference', `"${ref.raiz}.${nome0}" não é uma referência válida. Se for um texto, use aspas. Variáveis são var.nome; locals, local.nome.`);
          }
          const parecido = sugerir(end, Object.keys(this.config.recursos));
          throw erro('Reference to undeclared resource',
            `Não existe resource "${ref.raiz}" "${nome0}" neste módulo.${parecido ? ` Você quis dizer ${parecido}?` : ''}`);
        }
        const r = this.obterComSensivel(this.prefixo + end, () => this.calcularRecurso(end));
        if (r.sensivel) ctx.sensivel = true;
        return { valor: r.valor, consumidos: 1 };
      }
    }
  }

  // ---------- memória e ciclos ----------

  obter(id, calcular) {
    return this.obterComSensivel(id, calcular).valor;
  }

  obterComSensivel(id, calcular) {
    if (this.memo.has(id)) return this.memo.get(id);
    if (this.visitando.has(id)) {
      throw new ErroCiclo([...this.visitando, id].join(', '));
    }
    this.visitando.add(id);
    try {
      const r = calcular();
      const resultado = r && typeof r === 'object' && 'valorCalculado' in r ? { valor: r.valorCalculado, sensivel: r.sensivel } : { valor: r, sensivel: false };
      this.memo.set(id, resultado);
      return resultado;
    } finally {
      this.visitando.delete(id);
    }
  }

  avaliarTudo() {
    const tarefas = [
      ...Object.keys(this.config.locais).map((n) => [`local.${n}`, () => this.calcularLocal(n), this.config.locais[n]]),
      ...Object.keys(this.config.recursos).map((e) => [this.prefixo + e, () => this.calcularRecurso(e), this.config.recursos[e]]),
      ...Object.keys(this.config.dados).map((e) => [this.prefixo + e, () => this.calcularDado(e), this.config.dados[e]]),
      ...Object.keys(this.config.modulos).map((n) => [`${this.prefixo}module.${n}`, () => this.calcularModulo(n), this.config.modulos[n]]),
      ...Object.keys(this.config.saidas).map((n) => [`${this.prefixo}output.${n}`, () => this.calcularSaida(n), this.config.saidas[n]]),
    ];
    for (const [id, calcular, bloco] of tarefas) {
      try {
        this.obterComSensivel(id, calcular);
      } catch (erro) {
        if (erro instanceof ErroCiclo) {
          if (this.ex.cicloReportado) {
            this.memo.set(id, { valor: desconhecido(id), sensivel: false });
            continue;
          }
          this.ex.cicloReportado = true;
          this.diag.erro('Cycle', `Há um ciclo de dependências: ${erro.message}. Um item depende de outro que depende dele de volta. Quebre o ciclo removendo uma das referências.`, { arquivo: bloco.arquivo, linha: bloco.linha });
          this.memo.set(id, { valor: desconhecido(id), sensivel: false });
        } else {
          throw erro;
        }
      }
    }
  }

  /** Avalia uma expressão; se der erro, registra e devolve "desconhecido" (para não gerar erros em cascata). */
  avaliarSeguro(expr, ctx, contexto) {
    try {
      return avaliar(expr, ctx);
    } catch (erro) {
      if (erro instanceof ErroCiclo) throw erro;
      this.diag.deErro(erro, contexto, ctx.arquivo);
      return desconhecido('erro');
    }
  }

  // ---------- locals ----------

  calcularLocal(nome) {
    const at = this.config.locais[nome];
    const ctx = this.contexto(at.arquivo);
    const valor = this.avaliarSeguro(at.expr, ctx, 'in locals');
    return { valorCalculado: valor, sensivel: ctx.sensivel };
  }

  // ---------- outputs ----------

  calcularSaida(nome) {
    const bloco = this.config.saidas[nome];
    const at = bloco.corpo.atributos.find((a) => a.nome === 'value');
    if (!at) return { valorCalculado: null, sensivel: false };
    const ctx = this.contexto(bloco.arquivo);
    const valor = this.avaliarSeguro(at.expr, ctx, `in output "${nome}"`);
    const marcadoSensivel = literalOuErro(bloco.corpo.atributos.find((a) => a.nome === 'sensitive'), bloco, this.diag) === true;
    if (ctx.sensivel && !marcadoSensivel && this.caminho.length === 0) {
      this.diag.erro('Output refers to sensitive values',
        `O output "${nome}" mostra um valor sensível (como uma senha). O Terraform exige que você confirme a intenção: acrescente sensitive = true neste output.`,
        { arquivo: bloco.arquivo, linha: at.linha, contexto: `in output "${nome}"` });
    }
    for (const sub of bloco.corpo.blocos.filter((b) => b.tipo === 'precondition')) {
      this.checarCondicao(sub, ctx, `Module output value precondition failed`, `in output "${nome}"`, bloco.arquivo);
    }
    return { valorCalculado: valor, sensivel: ctx.sensivel || marcadoSensivel };
  }

  valoresSaidas() {
    const saida = {};
    for (const nome of Object.keys(this.config.saidas)) {
      const r = this.obterComSensivel(`${this.prefixo}output.${nome}`, () => this.calcularSaida(nome));
      saida[nome] = { valor: r.valor, sensivel: r.sensivel };
    }
    return saida;
  }

  checarCondicao(bloco, ctx, resumo, contexto, arquivo) {
    const cond = bloco.corpo.atributos.find((a) => a.nome === 'condition');
    const msg = bloco.corpo.atributos.find((a) => a.nome === 'error_message');
    if (!cond) return;
    const ok = this.avaliarSeguro(cond.expr, ctx, contexto);
    if (ok === false) {
      const texto = msg ? this.avaliarSeguro(msg.expr, ctx, contexto) : 'A condição falhou.';
      this.diag.erro(resumo, String(texto), { arquivo, linha: cond.linha, contexto });
    }
  }

  // ---------- módulos ----------

  calcularModulo(nome) {
    const bloco = this.config.modulos[nome];
    const filha = bloco.configFilha;
    if (!filha) return { valorCalculado: desconhecido(`module.${nome}`), sensivel: false };
    const contexto = `in module "${nome}"`;
    const ctxBase = this.contexto(bloco.arquivo);
    const meta = Object.fromEntries(bloco.corpo.atributos.map((a) => [a.nome, a]));
    let mapaProvedores = null;
    if (meta.providers) {
      mapaProvedores = {};
      for (const par of meta.providers.expr.pares ?? []) {
        const de = par.chave.ident ? par.chave.valor : par.chave.k === 'ref' ? [par.chave.raiz, ...par.chave.passos.map((x) => x.attr)].join('.') : null;
        const para = par.valor.k === 'ref' ? [par.valor.raiz, ...par.valor.passos.map((x) => x.attr)].join('.') : null;
        if (de && para) mapaProvedores[de] = para;
      }
    }
    const chaves = this.expandir(bloco, ctxBase, contexto);
    const criarFilho = (chave, locais) => {
      const ctx = this.contexto(bloco.arquivo, locais);
      const entradas = {};
      for (const at of bloco.corpo.atributos) {
        if (['source', 'version', 'count', 'for_each', 'providers', 'depends_on'].includes(at.nome)) continue;
        ctx.sensivel = false;
        const valor = this.avaliarSeguro(at.expr, ctx, contexto);
        entradas[at.nome] = { valor, sensivel: ctx.sensivel };
      }
      const sufixo = chave === null ? '' : `[${JSON.stringify(chave)}]`;
      const filho = new Escopo(this.ex, filha, [...this.caminho, `module.${nome}${sufixo}`], this, { entradas, mapaProvedores: mapaProvedores ?? this.mapaProvedores, chaveInstancia: chave });
      filho.prepararVariaveis();
      filho.avaliarTudo();
      return filho.valoresSaidas();
    };
    const objetoSaidas = (saidas) => Object.fromEntries(Object.entries(saidas).map(([k, s]) => [k, s.valor]));
    const algumSensivel = (saidas) => Object.values(saidas).some((s) => s.sensivel);
    if (chaves.tipo === 'unico') {
      const s = criarFilho(null, null);
      return { valorCalculado: objetoSaidas(s), sensivel: algumSensivel(s) };
    }
    if (chaves.tipo === 'desconhecido') return { valorCalculado: desconhecido(`module.${nome}`), sensivel: false };
    if (chaves.tipo === 'count') {
      const lista = chaves.itens.map((i) => objetoSaidas(criarFilho(i, { __count: { index: i } })));
      return { valorCalculado: lista, sensivel: false };
    }
    const mapa = {};
    for (const [k, v] of chaves.itens) mapa[k] = objetoSaidas(criarFilho(k, { __each: { key: k, value: v } }));
    return { valorCalculado: mapa, sensivel: false };
  }

  // ---------- count / for_each ----------

  /** Devolve as instâncias: { tipo: 'unico' } | { tipo: 'count', itens: [0..n] } | { tipo: 'for_each', itens: [[chave, valor]] }. */
  expandir(bloco, ctx, contexto) {
    const count = bloco.corpo.atributos.find((a) => a.nome === 'count');
    const forEach = bloco.corpo.atributos.find((a) => a.nome === 'for_each');
    const onde = { arquivo: bloco.arquivo, linha: (count ?? forEach)?.linha, contexto };
    if (count) {
      const n = this.avaliarSeguro(count.expr, ctx, contexto);
      if (ehDesconhecido(n)) {
        if (n.origem !== 'erro') {
          this.diag.erro('Invalid count argument',
            'O valor de count depende de algo que só será conhecido depois do apply (como o id de outro recurso), então o Terraform não sabe quantas instâncias criar. Use um valor conhecido antes (variável, length de uma lista fixa...).',
            onde);
        }
        return { tipo: 'desconhecido' };
      }
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
        this.diag.erro('Invalid count argument', `count precisa ser um número inteiro maior ou igual a zero, mas recebeu ${JSON.stringify(n)}.`, onde);
        return { tipo: 'desconhecido' };
      }
      return { tipo: 'count', itens: Array.from({ length: n }, (_, i) => i) };
    }
    if (forEach) {
      const sensivelAntes = ctx.sensivel;
      ctx.sensivel = false;
      const v = this.avaliarSeguro(forEach.expr, ctx, contexto);
      const sensivel = ctx.sensivel;
      ctx.sensivel = sensivelAntes;
      if (ehDesconhecido(v) || (Array.isArray(v) && v.some(ehDesconhecido))) {
        if (!ehDesconhecido(v) || v.origem !== 'erro') {
          this.diag.erro('Invalid for_each argument',
            'As chaves do for_each dependem de valores que só serão conhecidos depois do apply. Use chaves conhecidas antes (nomes fixos, variáveis).', onde);
        }
        return { tipo: 'desconhecido' };
      }
      if (sensivel) {
        this.diag.erro('Invalid for_each argument', 'Valores sensíveis não podem ser usados no for_each: eles apareceriam nos endereços dos recursos.', onde);
        return { tipo: 'desconhecido' };
      }
      if (ehObjeto(v)) return { tipo: 'for_each', itens: Object.keys(v).sort().map((k) => [k, v[k]]) };
      if (ehConjunto(v)) {
        if (!v.every((x) => typeof x === 'string')) {
          this.diag.erro('Invalid for_each set argument', 'O for_each aceita conjunto de strings (set of string). Este conjunto tem itens que não são texto.', onde);
          return { tipo: 'desconhecido' };
        }
        return { tipo: 'for_each', itens: v.map((x) => [x, x]) };
      }
      if (Array.isArray(v)) {
        this.diag.erro('Invalid for_each argument',
          `O for_each precisa de um mapa ou de um conjunto de strings, mas recebeu uma lista (tuple). Converta com toset(): for_each = toset(${exprComoTexto(forEach.expr)}).`,
          onde);
        return { tipo: 'desconhecido' };
      }
      this.diag.erro('Invalid for_each argument', `O for_each precisa de um mapa ou de um conjunto de strings, mas recebeu ${nomeDoTipo(v)}.`, onde);
      return { tipo: 'desconhecido' };
    }
    return { tipo: 'unico' };
  }

  // ---------- recursos ----------

  calcularRecurso(end) {
    const bloco = this.config.recursos[end];
    const def = bloco.def;
    if (!def) return { valorCalculado: desconhecido(this.prefixo + end), sensivel: false };
    const contexto = `in resource "${bloco.tipoRecurso}" "${bloco.nome}"`;
    const ctxBase = this.contexto(bloco.arquivo);
    const provedor = this.ex.provedorDoRecurso(bloco, this);
    const chaves = this.expandir(bloco, ctxBase, contexto);
    const enderecoBase = this.prefixo + end;
    const montar = (chave, locais) => this.calcularInstancia(bloco, def, provedor, chave, locais, enderecoBase, contexto);
    if (chaves.tipo === 'desconhecido') return { valorCalculado: desconhecido(enderecoBase), sensivel: false };
    if (chaves.tipo === 'unico') {
      const inst = montar(null, null);
      return { valorCalculado: inst, sensivel: false };
    }
    if (chaves.tipo === 'count') return { valorCalculado: chaves.itens.map((i) => montar(i, { __count: { index: i } })), sensivel: false };
    const mapa = {};
    for (const [k, v] of chaves.itens) mapa[k] = montar(k, { __each: { key: k, value: v } });
    return { valorCalculado: mapa, sensivel: false };
  }

  calcularInstancia(bloco, def, provedor, chave, locais, enderecoBase, contexto) {
    const endereco = `${enderecoBase}${chave === null ? '' : `[${JSON.stringify(chave)}]`}`;
    const ctx = this.contexto(bloco.arquivo, locais);
    ctx.sensivel = false;
    const nomeProvedor = provedorDoTipo(bloco.tipoRecurso);
    const config = this.avaliarCorpo(bloco.corpo, def, ctx, contexto, bloco.arquivo, true, endereco, bloco.linha);
    const sensiveis = new Set();
    for (const [nome, a] of Object.entries(def.args)) if (a.sensivel) sensiveis.add(nome);
    for (const [nome, c] of Object.entries(def.calc)) if (c.sensivel) sensiveis.add(nome);

    // Valores de provedor: região (AWS), local normalizado (Azure), tags_all.
    if (nomeProvedor === 'aws' && def.args.region && config.region === undefined) config.region = provedor.valores?.region ?? null;
    if (nomeProvedor === 'azurerm' && typeof config.location === 'string') config.location = normalizarLocal(config.location);

    // Validações do provedor (só com valores conhecidos).
    this.validarValores(config, def, bloco, contexto);

    // lifecycle
    const lifecycle = bloco.corpo.blocos.find((b) => b.tipo === 'lifecycle');
    const lc = { preventDestroy: false, createBeforeDestroy: false, ignorar: [], ignorarTudo: false };
    if (lifecycle) {
      for (const at of lifecycle.corpo.atributos) {
        if (at.nome === 'prevent_destroy') lc.preventDestroy = literal(at.expr) === true;
        if (at.nome === 'create_before_destroy') lc.createBeforeDestroy = literal(at.expr) === true;
        if (at.nome === 'ignore_changes') {
          if (at.expr.k === 'ref' && at.expr.raiz === 'all') lc.ignorarTudo = true;
          else if (at.expr.k === 'tupla') lc.ignorar = at.expr.itens.filter((i) => i.k === 'ref').map((i) => i.raiz);
        }
      }
      for (const sub of lifecycle.corpo.blocos.filter((b) => b.tipo === 'precondition')) {
        this.checarCondicao(sub, ctx, 'Resource precondition failed', contexto, bloco.arquivo);
      }
    }

    const anterior = this.ex.estadoAnterior.recursos[endereco];
    const importacao = this.ex.raizConfig.importacoes.find((imp) => {
      const para = imp.corpo.atributos.find((a) => a.nome === 'to')?.expr;
      return para && enderecoDeExpressao(para) === endereco;
    });

    // Plano: comparar com o estado anterior.
    let acao = 'criar';
    const forcam = [];
    const mudados = [];
    if (anterior) {
      const comparar = Object.keys(def.args).concat(Object.keys(def.blocos));
      for (const k of comparar) {
        if (lc.ignorarTudo || lc.ignorar.includes(k)) continue;
        const configurado = k in config;
        const novo = config[k];
        const velho = anterior.atributos[k];
        if (!configurado && def.args[k]?.calculado) continue;
        if (!configurado && (velho === null || velho === undefined || (Array.isArray(velho) && !velho.length))) continue;
        if (!configurado && def.args[k]?.padrao !== undefined && iguais(velho, def.args[k].padrao)) continue;
        if (iguais(novo ?? null, velho ?? null)) continue;
        if (def.blocos[k] && blocosIguais(def.blocos[k], novo, velho)) continue;
        if (!configurado && def.args[k]?.padrao === undefined && def.blocos[k] === undefined && velho !== null && def.args[k]?.calculado) continue;
        mudados.push(k);
        if (def.args[k]?.forcaNova || def.blocos[k]?.forcaNova || (def.blocos[k] && blocoForcaNova(def.blocos[k], novo, velho))) forcam.push(k);
      }
      if (def.calc.tags_all && !lc.ignorarTudo && !lc.ignorar.includes('tags')) {
        const padroes = provedor.valores?.default_tags?.[0]?.tags ?? {};
        const planejado = temDesconhecido(config.tags ?? {}) || temDesconhecido(padroes) ? null : { ...padroes, ...(config.tags ?? {}) };
        if (planejado && !iguais(planejado, anterior.atributos.tags_all ?? {})) mudados.push('tags_all');
      }
      acao = mudados.length ? (forcam.length ? 'substituir' : 'alterar') : 'nada';
    } else if (importacao) {
      acao = 'importar';
    }
    const geracao = (anterior?.geracao ?? 0) + (acao === 'substituir' ? 1 : 0);

    // Valores planejados (o que o plano mostra).
    const depois = {};
    for (const [nome, a] of Object.entries(def.args)) {
      if (nome in config) depois[nome] = config[nome];
      else if (a.padrao !== undefined) depois[nome] = copiar(a.padrao);
      else if (a.calculado) {
        depois[nome] = (acao === 'nada' || acao === 'alterar') && anterior ? anterior.atributos[nome] ?? null : desconhecido(`${endereco}.${nome}`, a.tipo);
      } else depois[nome] = null;
    }
    for (const [nome, b] of Object.entries(def.blocos)) depois[nome] = config[nome] ?? (b.max === 1 && b.min === 1 ? [] : []);
    for (const [nome, c] of Object.entries(def.calc)) {
      depois[nome] = (acao === 'nada' || acao === 'alterar') && anterior && nome in anterior.atributos ? anterior.atributos[nome] : desconhecido(`${endereco}.${nome}`, c.tipo);
    }
    if (def.calc.tags_all) {
      const padroes = provedor.valores?.default_tags?.[0]?.tags ?? {};
      const tags = depois.tags ?? {};
      if (!Object.keys(padroes).length && depois.tags == null) {
        depois.tags_all = anterior && acao !== 'substituir' ? anterior.atributos.tags_all ?? {} : desconhecido(`${endereco}.tags_all`, 'map');
      } else {
        depois.tags_all = temDesconhecido(tags) || temDesconhecido(padroes) ? desconhecido(`${endereco}.tags_all`, 'map') : { ...padroes, ...(tags ?? {}) };
      }
    }
    if (acao === 'importar') {
      const idImp = importacao.corpo.atributos.find((a) => a.nome === 'id');
      if (idImp) depois.id = this.avaliarSeguro(idImp.expr, this.contexto(importacao.arquivo), 'in import');
    }

    // Apply: valores finais (sem "known after apply").
    let final = null;
    const dependenciasEstaticas = this.dependenciasDe(bloco);
    if (this.ex.aplicando) {
      if (temDesconhecidoExterno(config, endereco)) {
        // Uma referência ficou sem valor (dependência que falhou): este recurso não é criado.
        final = null;
      } else {
        final = this.gerarFinais(def, config, depois, provedor, endereco, geracao, acao, anterior);
        if (final && (acao === 'criar' || acao === 'substituir' || acao === 'importar')) {
          const erroApi = def.validarApi?.(final);
          if (erroApi) {
            this.ex.falhasApply.push({ endereco, erro: erroApi });
            this.diag.erro(erroApi.split(':')[0], erroApi, { arquivo: bloco.arquivo, linha: bloco.linha, contexto: `with ${endereco}` });
            final = null;
          }
        }
      }
    }

    const instancia = {
      endereco, tipo: bloco.tipoRecurso, nome: bloco.nome, modo: 'managed', modulo: this.caminho.join('.') || null, chave,
      acao, antes: anterior?.atributos ?? null, depois, final, mudados, forcam, def, sensiveis,
      provedor: `provider["registry.terraform.io/${PROVEDORES[nomeProvedor]?.fonte ?? `hashicorp/${nomeProvedor}`}"]${provedor.chave.includes('.') ? `.${provedor.chave.split('.')[1]}` : ''}`,
      arquivo: bloco.arquivo, linha: bloco.linha, preventDestroy: lc.preventDestroy, createBeforeDestroy: lc.createBeforeDestroy,
      geracao, dependencias: dependenciasEstaticas, configurados: Object.keys(config),
      dependeDeFalha: () => dependenciasEstaticas.some((d) => this.ex.falhasApply.some((f) => f.endereco === d || f.endereco.startsWith(`${d}[`))),
    };
    if (this.ex.instancias.has(endereco)) return valorDaInstancia(this.ex.instancias.get(endereco), def, bloco);
    this.ex.instancias.set(endereco, instancia);
    return valorDaInstancia(instancia, def, bloco);
  }

  dependenciasDe(bloco) {
    const exprs = [];
    const coletar = (corpo) => {
      for (const at of corpo.atributos) exprs.push(at.expr);
      for (const b of corpo.blocos) coletar(b.corpo);
    };
    coletar(bloco.corpo);
    const deps = new Set();
    for (const e of exprs) {
      for (const { endereco } of referenciasDe(e)) {
        if (/^(var|local|count|each|path|terraform|self)\b/.test(endereco)) continue;
        deps.add(this.prefixo + endereco);
      }
    }
    return [...deps];
  }

  /** Avalia os argumentos e blocos de um corpo, conferindo os tipos (recursivo). */
  avaliarCorpo(corpo, def, ctx, contexto, arquivo, ehRaiz, endereco, linhaBloco) {
    const valores = {};
    for (const at of corpo.atributos) {
      if (ehRaiz && META_RECURSO.has(at.nome)) continue;
      const defArg = def.args[at.nome];
      if (!defArg && !def.livre) continue; // já acusado no validate
      const v = this.avaliarSeguro(at.expr, ctx, contexto);
      if (v === null) continue; // null = "não definido", como no Terraform
      try {
        valores[at.nome] = defArg ? converterArg(v, defArg.tipo, at.nome) : v;
      } catch (erro) {
        if (erro instanceof ErroValor) this.diag.erro(erro.resumo, erro.detalhe, { arquivo, linha: at.linha, contexto });
        else throw erro;
        valores[at.nome] = desconhecido('erro');
      }
    }
    for (const sub of corpo.blocos) {
      if (ehRaiz && (sub.tipo === 'lifecycle' || sub.tipo === 'provisioner' || sub.tipo === 'connection')) continue;
      if (sub.tipo === 'dynamic') {
        const nomeBloco = sub.rotulos[0];
        const defSub = def.blocos?.[nomeBloco];
        if (!defSub) continue;
        const forEach = sub.corpo.atributos.find((a) => a.nome === 'for_each');
        const iterador = literal(sub.corpo.atributos.find((a) => a.nome === 'iterator')?.expr) ?? sub.corpo.atributos.find((a) => a.nome === 'iterator')?.expr?.raiz ?? nomeBloco;
        const conteudo = sub.corpo.blocos.find((b) => b.tipo === 'content');
        if (!forEach || !conteudo) continue;
        const colecao = this.avaliarSeguro(forEach.expr, ctx, contexto);
        if (ehDesconhecido(colecao)) {
          valores[nomeBloco] = desconhecido(`${endereco}.${nomeBloco}`);
          continue;
        }
        let pares;
        if (Array.isArray(colecao)) pares = colecao.map((v, i) => [ehConjunto(colecao) ? v : i, v]);
        else if (ehObjeto(colecao)) pares = Object.keys(colecao).sort().map((k) => [k, colecao[k]]);
        else {
          this.diag.erro('Invalid dynamic for_each value', `O for_each do bloco dynamic precisa de uma lista, conjunto ou mapa, mas recebeu ${nomeDoTipo(colecao)}.`, { arquivo, linha: forEach.linha, contexto });
          continue;
        }
        const lista = valores[nomeBloco] ?? [];
        for (const [k, v] of pares) {
          const sub2 = { ...ctx, locais: { ...(ctx.locais ?? {}), [iterador]: { key: k, value: v } } };
          lista.push(this.completarBloco(this.avaliarCorpo(conteudo.corpo, defSub, sub2, contexto, arquivo, false, endereco, conteudo.linha), defSub, `${endereco}.${nomeBloco}`));
        }
        valores[nomeBloco] = lista;
        continue;
      }
      const defSub = def.blocos?.[sub.tipo];
      if (!defSub) {
        if (def.livre) (valores[sub.tipo] ??= []).push(this.avaliarCorpo(sub.corpo, { args: {}, blocos: {}, livre: true }, ctx, contexto, arquivo, false, endereco, sub.linha));
        continue;
      }
      (valores[sub.tipo] ??= []).push(this.completarBloco(this.avaliarCorpo(sub.corpo, defSub, ctx, contexto, arquivo, false, endereco, sub.linha), defSub, `${endereco}.${sub.tipo}`));
    }
    // Obrigatórios que faltaram.
    for (const [nome, a] of Object.entries(def.args)) {
      if (a.obrigatorio && !(nome in valores)) {
        this.diag.erro('Missing required argument',
          `O argumento "${nome}" é obrigatório, mas não foi definido${ehRaiz ? '' : ' neste bloco'}.`,
          { arquivo, linha: linhaBloco, contexto });
      }
    }
    return valores;
  }

  completarBloco(valores, defSub, origem) {
    const saida = {};
    for (const [nome, a] of Object.entries(defSub.args)) {
      if (nome in valores) saida[nome] = valores[nome];
      else if (a.padrao !== undefined) saida[nome] = copiar(a.padrao);
      else if (a.calculado) saida[nome] = desconhecido(`${origem}.${nome}`, a.tipo);
      else saida[nome] = null;
    }
    for (const nome of Object.keys(defSub.blocos)) saida[nome] = valores[nome] ?? [];
    for (const nome of Object.keys(defSub.calc)) saida[nome] = desconhecido(`${origem}.${nome}`);
    if (defSub.livre) Object.assign(saida, valores);
    return saida;
  }

  validarValores(config, def, bloco, contexto) {
    const onde = { arquivo: bloco.arquivo, linha: bloco.linha, contexto };
    const linhaDe = (nome) => bloco.corpo.atributos.find((a) => a.nome === nome)?.linha ?? bloco.linha;
    for (const [nome, validador] of Object.entries(def.validar)) {
      const v = config[nome];
      if (v === undefined || v === null || temDesconhecido(v)) continue;
      const msg = validador(v, nome);
      if (msg) this.diag.erro(msg, `O provedor não aceita este valor para "${nome}".`, { ...onde, linha: linhaDe(nome) });
    }
    const visitarBlocos = (valores, defAtual) => {
      for (const [nomeBloco, lista] of Object.entries(valores)) {
        if (!defAtual.blocos?.[nomeBloco] || !Array.isArray(lista)) continue;
        for (const item of lista) {
          for (const [nome, validador] of Object.entries(def.validarBlocos)) {
            const v = item?.[nome];
            if (v === undefined || v === null || temDesconhecido(v)) continue;
            const msg = validador(v, nome);
            if (msg) this.diag.erro(msg, `O provedor não aceita este valor para "${nome}" no bloco ${nomeBloco}.`, onde);
          }
          if (item && typeof item === 'object') visitarBlocos(item, defAtual.blocos[nomeBloco]);
        }
      }
    };
    visitarBlocos(config, def);
    for (const grupo of def.umDe) {
      const definidos = grupo.filter((n) => config[n] !== undefined && config[n] !== null);
      if (definidos.length === 0) {
        this.diag.erro('Invalid combination of arguments', `Defina um destes argumentos: ${grupo.map((g) => `"${g}"`).join(', ')}.`, onde);
      } else if (definidos.length > 1) {
        this.diag.erro('Conflicting configuration arguments', `"${definidos[0]}" e "${definidos[1]}" não podem ser usados juntos: escolha só um.`, { ...onde, linha: linhaDe(definidos[1]) });
      }
    }
    if (!temDesconhecido(config)) {
      for (const regra of def.exige) {
        const msg = regra(config);
        if (msg) this.diag.erro(msg.split(' (')[0], msg, onde);
      }
    }
    for (const [nome, aviso] of Object.entries(def.obsoletos)) {
      if (nome in config) this.diag.aviso('Argument is deprecated', aviso, { ...onde, linha: linhaDe(nome) });
    }
  }

  gerarFinais(def, config, depois, provedor, endereco, geracao, acao, anterior) {
    const regiao = config.region ?? provedor.valores?.region ?? 'us-east-1';
    const u = utilitarios(this.ex.semente, endereco, geracao, { regiao, lerArquivo: (p) => this.ex.lerArquivo(p, this.config.dir) });
    const v = {};
    for (const [nome, valor] of Object.entries(depois)) if (!ehDesconhecido(valor)) v[nome] = valor;
    for (const nome of Object.keys(def.args)) if (nome in config) v[nome] = config[nome];
    const reaproveitar = (acao === 'nada' || acao === 'alterar') && anterior;
    const f = {};
    const pendentes = new Set(Object.keys(depois).filter((k) => ehDesconhecido(depois[k])));
    // Geradores declarados primeiro, na ordem em que aparecem no esquema.
    for (const [nome, gerar] of Object.entries(def.gerar)) {
      if (nome in config && !ehDesconhecido(config[nome])) {
        f[nome] = config[nome];
        continue;
      }
      if (reaproveitar && anterior.atributos[nome] !== undefined && !(nome in config)) {
        f[nome] = anterior.atributos[nome];
        continue;
      }
      f[nome] = gerar({ ...v, ...f }, u, f);
    }
    const final = { ...depois };
    for (const [nome, valor] of Object.entries(f)) final[nome] = valor;
    for (const nome of pendentes) {
      if (!ehDesconhecido(final[nome])) continue;
      if (reaproveitar && anterior.atributos[nome] !== undefined) final[nome] = anterior.atributos[nome];
      else final[nome] = this.valorPadraoCalculado(nome, def, u, final, endereco);
    }
    // Blocos: atributos calculados dentro deles.
    for (const nomeBloco of Object.keys(def.blocos)) {
      if (!Array.isArray(final[nomeBloco])) continue;
      final[nomeBloco] = final[nomeBloco].map((item, i) => substituirDesconhecidos(item, (origem) => `${origem.split('.').pop()}-${u.hex(8, `${nomeBloco}${i}`)}`));
    }
    if (def.calc.tags_all && ehDesconhecido(final.tags_all)) {
      final.tags_all = { ...(provedor.valores?.default_tags?.[0]?.tags ?? {}), ...(final.tags ?? {}) };
    }
    return substituirDesconhecidos(final, () => '');
  }

  valorPadraoCalculado(nome, def, u, final, endereco) {
    if (nome === 'id') {
      if (def.prefixo) return `${def.prefixo}-0${u.hex(16)}`;
      return u.hex(20);
    }
    if (nome === 'arn' && def.arn) {
      return `arn:aws:${def.arn.replace('{regiao}', u.regiao).replace('{conta}', u.conta).replace('{id}', final.id ?? u.hex(17))}`;
    }
    if (nome === 'arn') return `arn:aws:${def.nome.split('_')[1]}:${u.regiao}:${u.conta}:${def.nome.replace(/^aws_/, '')}/${final.id ?? u.hex(12)}`;
    if (nome === 'tags_all') return final.tags ?? {};
    if (nome === 'owner_id') return u.conta;
    if (nome.endsWith('_ip') || nome === 'ip_address') return u.ip(nome);
    if (def.calc[nome]?.tipo === 'number') return 0;
    if (def.calc[nome]?.tipo === 'bool') return false;
    if (['list', 'set'].includes(def.calc[nome]?.tipo)) return [];
    if (def.calc[nome]?.tipo === 'map') return {};
    if (def.args[nome]?.tipo === 'bool') return false;
    if (def.args[nome]?.tipo === 'number') return 0;
    return `${nome}-${u.hex(8, endereco)}`;
  }

  // ---------- fontes de dados ----------

  calcularDado(end) {
    const bloco = this.config.dados[end];
    const def = bloco.def;
    if (!def) return desconhecido(this.prefixo + end);
    const contexto = `in data "${bloco.tipoRecurso}" "${bloco.nome}"`;
    const ctxBase = this.contexto(bloco.arquivo);
    const provedor = this.ex.provedorDoRecurso(bloco, this);
    const chaves = this.expandir(bloco, ctxBase, contexto);
    const enderecoBase = this.prefixo + end;
    const ler = (chave, locais) => {
      const endereco = `${enderecoBase}${chave === null ? '' : `[${JSON.stringify(chave)}]`}`;
      const ctx = this.contexto(bloco.arquivo, locais);
      const config = this.avaliarCorpo(bloco.corpo, def, ctx, contexto, bloco.arquivo, true, endereco, bloco.linha);
      this.validarValores(config, def, bloco, contexto);
      const depois = {};
      for (const [nome, a] of Object.entries(def.args)) depois[nome] = nome in config ? config[nome] : a.padrao !== undefined ? copiar(a.padrao) : a.calculado ? desconhecido(`${endereco}.${nome}`) : null;
      for (const nome of Object.keys(def.blocos)) depois[nome] = config[nome] ?? [];
      for (const nome of Object.keys(def.calc)) depois[nome] = desconhecido(`${endereco}.${nome}`, def.calc[nome].tipo);
      const dependeDeRecurso = this.dependenciasDe(bloco).some((d) => !d.startsWith(`${this.prefixo}data.`))
        && this.dependenciasDe(bloco).some((d) => [...this.ex.instancias.values()].some((i) => (i.endereco === d || i.endereco.startsWith(`${d}[`)) && i.acao !== 'nada'));
      let acao = 'nada';
      let final = null;
      if (temDesconhecido(config) || dependeDeRecurso) {
        acao = 'ler';
      } else {
        const regiao = provedor.valores?.region ?? 'us-east-1';
        const u = utilitarios(this.ex.semente, endereco, 0, { regiao, lerArquivo: (p) => this.ex.lerArquivo(p, this.config.dir) });
        try {
          const lidos = def.ler ? def.ler(config, u) : {};
          for (const k of Object.keys(lidos)) depois[k] = lidos[k];
          for (const k of Object.keys(depois)) if (ehDesconhecido(depois[k])) depois[k] = def.calc[k]?.tipo === 'list' ? [] : '';
          final = depois;
        } catch (erro) {
          if (erro instanceof ErroValor) this.diag.erro(erro.resumo, erro.detalhe, { arquivo: bloco.arquivo, linha: bloco.linha, contexto });
          else throw erro;
        }
      }
      if (acao === 'ler' && this.ex.aplicando && !temDesconhecido(config)) {
        const u = utilitarios(this.ex.semente, endereco, 0, { regiao: provedor.valores?.region ?? 'us-east-1', lerArquivo: (p) => this.ex.lerArquivo(p, this.config.dir) });
        final = { ...depois, ...(def.ler ? def.ler(config, u) : {}) };
      }
      const sensiveis = new Set(Object.entries(def.calc).filter(([, c]) => c.sensivel).map(([n]) => n));
      this.ex.dados.set(endereco, {
        endereco, tipo: bloco.tipoRecurso, nome: bloco.nome, modo: 'data', modulo: this.caminho.join('.') || null, chave, acao,
        depois, final, def, sensiveis, provedor: `provider["registry.terraform.io/${PROVEDORES[provedorDoTipo(bloco.tipoRecurso)]?.fonte}"]`,
      });
      const valor = final ?? depois;
      Object.defineProperty(valor, INFO_RECURSO, { value: { tipo: bloco.tipoRecurso, sensiveis, sugestao: sugestaoAtributo(def) }, enumerable: false });
      return valor;
    };
    if (chaves.tipo === 'desconhecido') return desconhecido(enderecoBase);
    if (chaves.tipo === 'unico') return ler(null, null);
    if (chaves.tipo === 'count') return chaves.itens.map((i) => ler(i, { __count: { index: i } }));
    const mapa = {};
    for (const [k, v] of chaves.itens) mapa[k] = ler(k, { __each: { key: k, value: v } });
    return mapa;
  }
}

function literalOuErro(at, bloco, diag) {
  if (!at) return undefined;
  try {
    return avaliar(at.expr, { arquivo: bloco.arquivo, resolver: () => { throw new ErroAvaliacao('Variables not allowed', 'Aqui só cabem valores fixos: nada de var., local. ou referências.', { arquivo: bloco.arquivo, linha: at.linha }); }, lerArquivo: () => '', existeArquivo: () => false, avaliarTexto: () => '' });
  } catch (erro) {
    diag.deErro(erro, `in ${bloco.tipo} "${bloco.rotulos[0]}"`, bloco.arquivo);
    return undefined;
  }
}

function valorDaInstancia(instancia, def, bloco) {
  const base = instancia.final ?? instancia.depois;
  const valor = { ...base };
  Object.defineProperty(valor, INFO_RECURSO, {
    value: { tipo: bloco.tipoRecurso, sensiveis: instancia.sensiveis, sugestao: sugestaoAtributo(def) },
    enumerable: false,
  });
  return valor;
}

function sugestaoAtributo(def) {
  return (nome) => {
    const parecido = sugerir(nome, [...Object.keys(def.args), ...Object.keys(def.calc), ...Object.keys(def.blocos)]);
    return parecido ? ` Você quis dizer "${parecido}"?` : '';
  };
}

/** Compara blocos olhando só o que foi configurado (o que o provedor calcula fica de fora). */
function blocosIguais(defBloco, novo, velho) {
  const n = Array.isArray(novo) ? novo : [];
  const o = Array.isArray(velho) ? velho : [];
  if (n.length !== o.length) return false;
  return n.every((item, i) => {
    const antigo = o[i] ?? {};
    for (const [k, a] of Object.entries(defBloco.args)) {
      const vn = item?.[k];
      const vo = antigo[k];
      if (ehDesconhecido(vn) && a.calculado) continue;
      if (vn === null || vn === undefined) {
        if (a.calculado || vo === null || vo === undefined) continue;
        return false;
      }
      if (!iguais(vn, vo)) return false;
    }
    for (const [k, b] of Object.entries(defBloco.blocos)) {
      if (!blocosIguais(b, item?.[k], antigo[k])) return false;
    }
    if (defBloco.livre && !iguais(item, antigo)) return false;
    return true;
  });
}

function blocoForcaNova(defBloco, novo, velho) {
  if (!Array.isArray(novo) || !Array.isArray(velho) || novo.length !== velho.length) {
    return Object.values(defBloco.args).some((a) => a.forcaNova);
  }
  return novo.some((item, i) => Object.entries(defBloco.args).some(([k, a]) => a.forcaNova && !iguais(item?.[k], velho[i]?.[k])));
}

/** Há valor desconhecido que vem de fora? (Atributos calculados do próprio recurso não contam.) */
function temDesconhecidoExterno(v, endereco) {
  if (v instanceof Desconhecido) return !String(v.origem ?? '').startsWith(`${endereco}.`);
  if (Array.isArray(v)) return v.some((x) => temDesconhecidoExterno(x, endereco));
  if (ehObjeto(v)) return Object.values(v).some((x) => temDesconhecidoExterno(x, endereco));
  return false;
}

function substituirDesconhecidos(v, gerar) {
  if (v instanceof Desconhecido) return gerar(v.origem ?? 'x');
  if (Array.isArray(v)) {
    const c = v.map((x) => substituirDesconhecidos(x, gerar));
    return ehConjunto(v) ? conjunto(c) : c;
  }
  if (ehObjeto(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, substituirDesconhecidos(x, gerar)]));
  return v;
}

function enderecoDeExpressao(expr) {
  if (expr.k !== 'ref') return null;
  let s = expr.raiz;
  for (const p of expr.passos) {
    if (p.attr !== undefined) s += `.${p.attr}`;
    else {
      try {
        s += `[${JSON.stringify(avaliar(p.indice, { resolver: () => ({ valor: null, consumidos: 0 }) }))}]`;
      } catch {
        return null;
      }
    }
  }
  return s;
}

function exprComoTexto(expr) {
  if (expr.k === 'ref') return [expr.raiz, ...expr.passos.map((p) => p.attr ?? '[…]')].join('.').replace(/\.\[/g, '[');
  return '...';
}

export { normalizarCaminho, estadoVazio };
