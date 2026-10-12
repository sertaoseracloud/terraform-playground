// Utilitários para escrever o conteúdo da trilha.
//
// tf`...` escreve HCL dentro do JavaScript:
//   - escreva \${var.x} para a interpolação do HCL (o JS não interpreta);
//   - barras invertidas ficam como estão (como String.raw);
//   - o recuo comum e a primeira linha em branco são removidos.

export function tf(strings, ...valores) {
  const texto = String.raw({ raw: strings.raw }, ...valores).replaceAll('\\${', '${');
  const linhas = texto.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const recuo = Math.min(...linhas.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return `${linhas.map((l) => l.slice(Number.isFinite(recuo) ? recuo : 0)).join('\n')}\n`;
}

/** Arquivos: aceita uma string (vira main.tf) ou um objeto { arquivo: conteúdo }. */
export const arquivos = (v) => (typeof v === 'string' ? { 'main.tf': v } : v);

export function licao({ id, titulo, resumo, codigo }) {
  return { id, tipo: 'licao', titulo, resumo, arquivos: arquivos(codigo) };
}

export function problema({ id, titulo, dificuldade, enunciado, dica, inicial, solucao, testes, workspace }) {
  return {
    id,
    tipo: 'problema',
    titulo,
    dificuldade,
    enunciado,
    dica,
    arquivos: arquivos(inicial),
    solucao: arquivos(solucao),
    testes,
    ...(workspace ? { workspace } : {}),
  };
}

// ---------- trechos que se repetem ----------

export const AWS = tf`
  provider "aws" {
    region = "us-east-1"
  }
`;

export const AWS_SP = tf`
  provider "aws" {
    region = "sa-east-1"
  }
`;

export const AZURE = tf`
  provider "azurerm" {
    features {}
  }
`;

/** Grupo de recursos padrão dos exercícios de Azure. */
export const RG = tf`
  resource "azurerm_resource_group" "rg" {
    name     = "rg-aula"
    location = "brazilsouth"
  }
`;

export const juntar = (...partes) => partes.join('\n');
