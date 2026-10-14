// A trilha completa, na ordem das aulas: Terraform básico → AWS → Azure,
// mais o módulo de Projetos. Cada módulo tem `itens`: lições (tipo 'licao') e
// exercícios (tipo 'problema').
import { moduloBasico } from './basico.js';
import { moduloAws } from './aws.js';
import { moduloAzure } from './azure.js';
import { moduloProjetos } from './projetos/index.js';
import { tf } from './util.js';

export const modulos = [moduloBasico, moduloAws, moduloAzure, moduloProjetos];

export const DIFICULDADES = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};

/** Playground livre: o código e o estado ficam salvos no navegador. */
export const LIVRE = {
  id: 'livre',
  tipo: 'livre',
  titulo: 'Playground livre',
  resumo: `
    <p>Escreva o que quiser. Use o <b>+</b> para criar arquivos (variables.tf, outputs.tf,
    terraform.tfvars) e pastas de módulos (modulos/rede/main.tf).</p>
    <p><b>▶ Plan</b> mostra o que mudaria, <b>✔ Apply</b> "cria" os recursos no estado simulado e
    <b>🗑 Destroy</b> apaga tudo. O estado fica <b>salvo no seu navegador</b>; use <b>Limpar estado</b> para recomeçar.</p>
    <p>No terminal você também pode digitar os comandos: <code>terraform apply</code> (responda <code>yes</code>),
    <code>terraform fmt</code>, <code>terraform console</code>, <code>terraform output</code>... Digite <code>help</code> para ver todos.</p>
    <p>Provedores disponíveis: aws, azurerm, random, local, null, tls, archive e o embutido terraform_data.</p>`,
  arquivos: {
    'main.tf': tf`
      terraform {
        required_providers {
          random = {
            source  = "hashicorp/random"
            version = "~> 3.7"
          }
        }
      }

      variable "projeto" {
        type    = string
        default = "sertao"
      }

      resource "random_pet" "nome" {
        length = 2
      }

      output "nome_do_servidor" {
        value = "\${var.projeto}-\${random_pet.nome.id}"
      }
    `,
  },
};

export const itens = modulos.flatMap((m) => m.itens.map((item) => ({ ...item, modulo: m.id })));
export const problemas = itens.filter((i) => i.tipo === 'problema');

const porId = new Map([...itens, LIVRE].map((i) => [i.id, i]));
export const buscarItem = (id) => porId.get(id);

/** Item anterior e próximo na trilha (para os botões ‹ ›). */
export function vizinhos(id) {
  const i = itens.findIndex((item) => item.id === id);
  return { anterior: itens[i - 1], proximo: itens[i + 1] };
}
