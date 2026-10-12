// Projetos avançados: módulos multiambiente, multicloud e estado remoto com boas práticas.
import { tf, juntar as juntarTf } from '../util.js';
import { criarProjeto } from './base.js';

const REQ_AWS = tf`
  terraform {
    required_providers {
      aws = {
        source  = "hashicorp/aws"
        version = "~> 6.0"
      }
    }
  }
`;

// ---------- 6. Módulos e ambientes ----------

const MODULO_REDE_1 = tf`
  variable "nome" {
    type = string
  }

  variable "cidr" {
    type = string
  }

  resource "aws_vpc" "this" {
    cidr_block = var.cidr

    tags = {
      Name = var.nome
    }
  }

  output "vpc_id" {
    value = aws_vpc.this.id
  }
`;

const MODULO_REDE_2 = tf`
  variable "nome" {
    type = string
  }

  variable "cidr" {
    type = string
  }

  variable "quantidade_subnets" {
    type    = number
    default = 2
  }

  resource "aws_vpc" "this" {
    cidr_block = var.cidr

    tags = {
      Name = var.nome
    }
  }

  resource "aws_subnet" "this" {
    count      = var.quantidade_subnets
    vpc_id     = aws_vpc.this.id
    cidr_block = cidrsubnet(var.cidr, 8, count.index)
  }

  output "vpc_id" {
    value = aws_vpc.this.id
  }

  output "subnet_ids" {
    value = aws_subnet.this[*].id
  }
`;

const RAIZ_AMBIENTES = tf`
  locals {
    ambiente = terraform.workspace == "default" ? "dev" : terraform.workspace

    config = {
      dev = {
        cidr    = "10.0.0.0/16"
        subnets = 1
        tipo    = "t3.micro"
      }
      prod = {
        cidr    = "10.1.0.0/16"
        subnets = 3
        tipo    = "t3.small"
      }
    }

    atual = local.config[local.ambiente]
  }

  module "rede" {
    source             = "./modulos/rede"
    nome               = "vpc-\${local.ambiente}"
    cidr               = local.atual.cidr
    quantidade_subnets = local.atual.subnets
  }
`;

const PROVIDER_US = tf`
  provider "aws" {
    region = "us-east-1"
  }
`;

export const projetoModulos = criarProjeto({
  id: 'proj-modulos',
  titulo: 'Módulos para vários ambientes',
  icone: '🧩',
  descricao: 'Módulos próprios de rede e de aplicação, reaproveitados em dev e prod com workspaces.',
  resumo: `
    <p>Uma empresa tem <b>ambientes</b>: <b>dev</b> (para testar) e <b>prod</b> (o que os clientes usam). A infraestrutura é a mesma
    receita, só muda o tamanho.</p>
    <ul>
      <li>um <b>módulo</b> é uma receita reutilizável: uma pasta com arquivos .tf, variáveis de entrada e outputs;</li>
      <li>o <b>workspace</b> escolhe o ambiente: cada workspace tem o seu próprio estado;</li>
      <li>um mapa em <code>locals</code> guarda as diferenças (tamanho da máquina, quantidade de sub-redes...).</li>
    </ul>
    <p>Analogia: a mesma receita de bolo serve para um bolo pequeno (dev) ou para a festa toda (prod).</p>
    <p>Use o seletor de <b>workspace</b> acima do terminal para trocar entre <code>default</code> (dev) e <code>prod</code>.</p>`,
  inicial: {
    'providers.tf': juntarTf(REQ_AWS, PROVIDER_US),
  },
  etapas: [
    {
      titulo: 'O módulo de rede',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie o arquivo <code>modulos/rede/main.tf</code> com as variáveis <code>nome</code> e <code>cidr</code> (<code>string</code>),
            um <code>aws_vpc "this"</code> com <code>cidr_block = var.cidr</code> e a tag <code>Name = var.nome</code>,
            e <code>output "vpc_id"</code>;</li>
          <li>crie o arquivo <code>main.tf</code> (na raiz) usando o módulo:
            <code>module "rede" { source = "./modulos/rede"  nome = "vpc-dev"  cidr = "10.0.0.0/16" }</code>.</li>
        </ul>`,
      dica: 'Dentro do módulo, as entradas viram var.nome e var.cidr',
      alteracoes: {
        'modulos/rede/main.tf': MODULO_REDE_1,
        'main.tf': tf`
          module "rede" {
            source = "./modulos/rede"
            nome   = "vpc-dev"
            cidr   = "10.0.0.0/16"
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { arquivo: 'modulos/rede/main.tf' },
            { modulo: 'rede', source: './modulos/rede' },
            { recurso: 'module.rede.aws_vpc.this', atributo: 'cidr_block', igual: '10.0.0.0/16' },
            { recurso: 'module.rede.aws_vpc.this', atributo: 'tags.Name', igual: 'vpc-dev' },
          ],
        },
      ],
    },
    {
      titulo: 'Sub-redes dentro do módulo',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>no módulo, crie <code>variable "quantidade_subnets"</code> (<code>number</code>, padrão <code>2</code>);</li>
          <li>crie <code>aws_subnet "this"</code> com <code>count = var.quantidade_subnets</code> e
            <code>cidr_block = cidrsubnet(var.cidr, 8, count.index)</code>;</li>
          <li>crie <code>output "subnet_ids"</code> com <code>aws_subnet.this[*].id</code>.</li>
        </ul>`,
      dica: 'Quem usa o módulo não precisa passar quantidade_subnets: tem valor padrão',
      alteracoes: { 'modulos/rede/main.tf': MODULO_REDE_2 },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { tipo: 'aws_subnet', quantidade: 2 },
            { recurso: 'module.rede.aws_subnet.this[1]', atributo: 'cidr_block', igual: '10.0.1.0/24' },
            { codigo: 'output\\s+"subnet_ids"', msg: 'O módulo tem output "subnet_ids"' },
          ],
        },
      ],
    },
    {
      titulo: 'Um mapa de ambientes',
      dificuldade: 'dificil',
      enunciado: `
        <p>Em <code>main.tf</code>:</p>
        <ul>
          <li>crie <code>locals</code> com <code>ambiente = terraform.workspace == "default" ? "dev" : terraform.workspace</code>;</li>
          <li>um mapa <code>config</code> com <code>dev = { cidr = "10.0.0.0/16", subnets = 1, tipo = "t3.micro" }</code>
            e <code>prod = { cidr = "10.1.0.0/16", subnets = 3, tipo = "t3.small" }</code>;</li>
          <li><code>atual = local.config[local.ambiente]</code>;</li>
          <li>no módulo: <code>nome = "vpc-\${local.ambiente}"</code>, <code>cidr = local.atual.cidr</code> e
            <code>quantidade_subnets = local.atual.subnets</code>.</li>
        </ul>
        <p>Teste trocando o workspace para <code>prod</code>.</p>`,
      dica: 'Um local pode usar outro local: local.config[local.ambiente]',
      alteracoes: { 'main.tf': RAIZ_AMBIENTES },
      testes: [
        {
          descricao: 'workspace default (dev)',
          regras: [
            { semErros: true },
            { local: 'ambiente', igual: 'dev' },
            { tipo: 'aws_subnet', quantidade: 1 },
            { recurso: 'module.rede.aws_vpc.this', atributo: 'tags.Name', igual: 'vpc-dev' },
          ],
        },
        {
          descricao: 'workspace prod',
          workspace: 'prod',
          regras: [
            { semErros: true },
            { tipo: 'aws_subnet', quantidade: 3 },
            { recurso: 'module.rede.aws_vpc.this', atributo: 'cidr_block', igual: '10.1.0.0/16' },
          ],
        },
      ],
    },
    {
      titulo: 'O módulo da aplicação',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>modulos/app/main.tf</code> com as variáveis <code>nome</code>, <code>tipo</code> e <code>subnet_id</code>,
            e a variável <code>ami</code> com padrão <code>"ami-0a1b2c3d4e5f67890"</code>;</li>
          <li>no módulo, <code>aws_instance "this"</code> com <code>ami</code>, <code>instance_type = var.tipo</code>, <code>subnet_id</code>
            e a tag <code>Name = var.nome</code>; e <code>output "id"</code>;</li>
          <li>na raiz, <code>module "app"</code> com <code>source = "./modulos/app"</code>, <code>nome = "app-\${local.ambiente}"</code>,
            <code>tipo = local.atual.tipo</code> e <code>subnet_id = module.rede.subnet_ids[0]</code>.</li>
        </ul>`,
      dica: 'Um módulo usa o output do outro: module.rede.subnet_ids[0]',
      alteracoes: {
        'modulos/app/main.tf': tf`
          variable "nome" {
            type = string
          }

          variable "tipo" {
            type = string
          }

          variable "subnet_id" {
            type = string
          }

          variable "ami" {
            type    = string
            default = "ami-0a1b2c3d4e5f67890"
          }

          resource "aws_instance" "this" {
            ami           = var.ami
            instance_type = var.tipo
            subnet_id     = var.subnet_id

            tags = {
              Name = var.nome
            }
          }

          output "id" {
            value = aws_instance.this.id
          }
        `,
        'main.tf': juntarTf(RAIZ_AMBIENTES, tf`
          module "app" {
            source    = "./modulos/app"
            nome      = "app-\${local.ambiente}"
            tipo      = local.atual.tipo
            subnet_id = module.rede.subnet_ids[0]
          }
        `),
      },
      testes: [
        {
          descricao: 'workspace default (dev)',
          regras: [
            { semErros: true },
            { modulo: 'app', source: './modulos/app' },
            { recurso: 'module.app.aws_instance.this', atributo: 'instance_type', igual: 't3.micro' },
            { recurso: 'module.app.aws_instance.this', atributo: 'tags.Name', igual: 'app-dev' },
          ],
        },
        {
          descricao: 'workspace prod',
          workspace: 'prod',
          regras: [{ semErros: true }, { recurso: 'module.app.aws_instance.this', atributo: 'instance_type', igual: 't3.small' }],
        },
      ],
    },
    {
      titulo: 'Tags por ambiente e saídas',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>em <code>providers.tf</code>, acrescente ao provider
            <code>default_tags { tags = { Ambiente = terraform.workspace, Gerenciado = "terraform" } }</code>;</li>
          <li>crie o arquivo <code>outputs.tf</code> com <code>output "ambiente"</code> (<code>local.ambiente</code>),
            <code>output "vpc_id"</code> (<code>module.rede.vpc_id</code>) e <code>output "app_id"</code> (<code>module.app.id</code>).</li>
        </ul>`,
      dica: 'Os outputs de um módulo aparecem como module.NOME.OUTPUT',
      alteracoes: {
        'providers.tf': juntarTf(REQ_AWS, tf`
          provider "aws" {
            region = "us-east-1"

            default_tags {
              tags = {
                Ambiente   = terraform.workspace
                Gerenciado = "terraform"
              }
            }
          }
        `),
        'outputs.tf': tf`
          output "ambiente" {
            value = local.ambiente
          }

          output "vpc_id" {
            value = module.rede.vpc_id
          }

          output "app_id" {
            value = module.app.id
          }
        `,
      },
      testes: [
        {
          descricao: 'workspace default (dev)',
          regras: [
            { semErros: true },
            { recurso: 'module.rede.aws_vpc.this', atributo: 'tags_all.Gerenciado', igual: 'terraform' },
            { saida: 'ambiente', igual: 'dev' },
            { saida: 'vpc_id', existe: true },
            { saida: 'app_id', existe: true },
          ],
        },
        {
          descricao: 'workspace prod',
          workspace: 'prod',
          regras: [{ saida: 'ambiente', igual: 'prod' }, { recurso: 'module.app.aws_instance.this', atributo: 'tags_all.Ambiente', igual: 'prod' }],
        },
      ],
    },
  ],
});

// ---------- 7. Multicloud ----------

const PROVEDORES_MULTI = tf`
  terraform {
    required_providers {
      aws = {
        source  = "hashicorp/aws"
        version = "~> 6.0"
      }
      azurerm = {
        source  = "hashicorp/azurerm"
        version = "~> 4.0"
      }
      random = {
        source  = "hashicorp/random"
        version = "~> 3.7"
      }
    }
  }

  provider "aws" {
    region = "us-east-1"
  }

  provider "azurerm" {
    features {}
  }
`;

const armazenamento = (tags) => tf`
  resource "random_id" "sufixo" {
    byte_length = 4
  }

  resource "aws_s3_bucket" "backup" {
    bucket = "backup-\${var.nome}-\${random_id.sufixo.hex}"${tags}
  }

  resource "azurerm_resource_group" "rg" {
    name     = "rg-\${var.nome}-multicloud"
    location = "brazilsouth"${tags}
  }

  resource "azurerm_storage_account" "st" {
    name                     = "st\${var.nome}\${random_id.sufixo.hex}"
    resource_group_name      = azurerm_resource_group.rg.name
    location                 = azurerm_resource_group.rg.location
    account_tier             = "Standard"
    account_replication_type = "GRS"${tags}
  }
`;

const TAGS = '\n    tags     = local.tags';

export const projetoMulticloud = criarProjeto({
  id: 'proj-multicloud',
  titulo: 'Multicloud: AWS e Azure juntos',
  icone: '🌎',
  descricao: 'Armazenamento nas duas nuvens, DNS na AWS apontando para um site no Azure e configurações cruzadas.',
  resumo: `
    <p>Um mesmo projeto Terraform pode falar com <b>várias nuvens</b> ao mesmo tempo: basta declarar os dois provedores.</p>
    <ul>
      <li>o <b>backup</b> fica num bucket S3 e numa conta de armazenamento do Azure;</li>
      <li>o <b>site</b> é servido pelo Azure, mas o <b>DNS</b> (o "catálogo de endereços") fica no Route 53 da AWS;</li>
      <li>um recurso de uma nuvem pode usar atributos da outra: o Terraform liga tudo no grafo.</li>
    </ul>
    <p>Analogia: ter conta em dois bancos. Se um tiver problema, o outro segura as pontas.</p>`,
  inicial: {
    'providers.tf': PROVEDORES_MULTI,
    'variables.tf': tf`
      variable "nome" {
        type    = string
        default = "sertao"

        validation {
          condition     = can(regex("^[a-z0-9]{3,10}$", var.nome))
          error_message = "Use de 3 a 10 letras minúsculas ou números (o nome entra no storage do Azure)."
        }
      }
    `,
  },
  etapas: [
    {
      titulo: 'Armazenamento nas duas nuvens',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>armazenamento.tf</code>:</p>
        <ul>
          <li><code>random_id "sufixo"</code> com <code>byte_length = 4</code> (gera 8 caracteres hexadecimais);</li>
          <li><code>aws_s3_bucket "backup"</code> com <code>bucket = "backup-\${var.nome}-\${random_id.sufixo.hex}"</code>;</li>
          <li><code>azurerm_resource_group "rg"</code> com <code>name = "rg-\${var.nome}-multicloud"</code> em <code>brazilsouth</code>;</li>
          <li><code>azurerm_storage_account "st"</code> com <code>name = "st\${var.nome}\${random_id.sufixo.hex}"</code>,
            <code>Standard</code> e replicação <code>GRS</code>.</li>
        </ul>`,
      dica: 'O mesmo random_id deixa os nomes únicos nas duas nuvens',
      alteracoes: { 'armazenamento.tf': armazenamento('') },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket.backup', atributo: 'bucket', referencia: 'random_id.sufixo.hex' },
            { recurso: 'azurerm_storage_account.st', atributo: 'name', referencia: 'random_id.sufixo.hex' },
            { recurso: 'azurerm_storage_account.st', atributo: 'account_replication_type', igual: 'GRS' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_storage_account.st', atributo: 'name', regex: '^stsertao[0-9a-f]{8}$' }] },
      ],
    },
    {
      titulo: 'Site no Azure, DNS na AWS',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>site.tf</code>:</p>
        <ul>
          <li><code>azurerm_storage_account_static_website "site"</code> na conta <code>st</code>, com <code>index_document = "index.html"</code>;</li>
          <li><code>aws_route53_zone "zona"</code> com <code>name = "lojadosertao.com.br"</code>;</li>
          <li><code>aws_route53_record "www"</code>: <code>zone_id = aws_route53_zone.zona.zone_id</code>, <code>name = "www.lojadosertao.com.br"</code>,
            <code>type = "CNAME"</code>, <code>ttl = 300</code> e <code>records = [azurerm_storage_account.st.primary_web_host]</code>.</li>
        </ul>`,
      dica: 'Um CNAME diz: "este nome é um apelido daquele outro endereço"',
      alteracoes: {
        'site.tf': tf`
          resource "azurerm_storage_account_static_website" "site" {
            storage_account_id = azurerm_storage_account.st.id
            index_document     = "index.html"
          }

          resource "aws_route53_zone" "zona" {
            name = "lojadosertao.com.br"
          }

          resource "aws_route53_record" "www" {
            zone_id = aws_route53_zone.zona.zone_id
            name    = "www.lojadosertao.com.br"
            type    = "CNAME"
            ttl     = 300
            records = [azurerm_storage_account.st.primary_web_host]
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_route53_record.www', atributo: 'type', igual: 'CNAME' },
            { dependencia: ['aws_route53_record.www', 'azurerm_storage_account.st'] },
            { recurso: 'azurerm_storage_account_static_website.site', atributo: 'index_document', igual: 'index.html' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ recurso: 'aws_route53_record.www', atributo: 'records', tipo: 'list' }],
        },
      ],
    },
    {
      titulo: 'Uma nuvem conhece a outra',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>integracao.tf</code>:</p>
        <ul>
          <li><code>aws_ssm_parameter "blob_azure"</code> com <code>name = "/multicloud/azure/blob"</code>, <code>type = "String"</code>
            e <code>value = azurerm_storage_account.st.primary_blob_endpoint</code> (a AWS guarda o endereço do Azure);</li>
          <li><code>azurerm_storage_container "config"</code> com <code>name = "config"</code> na conta <code>st</code>;</li>
          <li><code>azurerm_storage_blob "aws"</code> com <code>name = "aws.json"</code>, <code>type = "Block"</code>, <code>content_type = "application/json"</code>
            e <code>source_content = jsonencode({ bucket = aws_s3_bucket.backup.bucket, regiao = "us-east-1" })</code>
            (o Azure guarda os dados da AWS).</li>
        </ul>`,
      dica: 'jsonencode transforma um objeto do HCL em texto JSON',
      alteracoes: {
        'integracao.tf': tf`
          resource "aws_ssm_parameter" "blob_azure" {
            name  = "/multicloud/azure/blob"
            type  = "String"
            value = azurerm_storage_account.st.primary_blob_endpoint
          }

          resource "azurerm_storage_container" "config" {
            name               = "config"
            storage_account_id = azurerm_storage_account.st.id
          }

          resource "azurerm_storage_blob" "aws" {
            name                   = "aws.json"
            storage_account_name   = azurerm_storage_account.st.name
            storage_container_name = azurerm_storage_container.config.name
            type                   = "Block"
            content_type           = "application/json"
            source_content = jsonencode({
              bucket = aws_s3_bucket.backup.bucket
              regiao = "us-east-1"
            })
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { dependencia: ['aws_ssm_parameter.blob_azure', 'azurerm_storage_account.st'] },
            { dependencia: ['azurerm_storage_blob.aws', 'aws_s3_bucket.backup'] },
            { recurso: 'azurerm_storage_blob.aws', atributo: 'content_type', igual: 'application/json' },
            { codigo: 'jsonencode\\(', msg: 'O blob usa jsonencode(...)' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ recurso: 'azurerm_storage_blob.aws', atributo: 'source_content', regex: '^\\{"bucket":"backup-sertao-[0-9a-f]{8}","regiao":"us-east-1"\\}$' }],
        },
      ],
    },
    {
      titulo: 'Uma cópia em São Paulo',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>em <code>providers.tf</code>, crie um segundo provider da AWS: <code>provider "aws" { alias = "sp"  region = "sa-east-1" }</code>;</li>
          <li>crie o arquivo <code>replica.tf</code> com <code>aws_s3_bucket "backup_sp"</code>, usando <code>provider = aws.sp</code>
            e <code>bucket = "backup-\${var.nome}-\${random_id.sufixo.hex}-sp"</code>.</li>
        </ul>`,
      dica: 'O alias dá um apelido para a segunda configuração do mesmo provedor',
      alteracoes: {
        'providers.tf': PROVEDORES_MULTI.replace('provider "azurerm"', 'provider "aws" {\n  alias  = "sp"\n  region = "sa-east-1"\n}\n\nprovider "azurerm"'),
        'replica.tf': tf`
          resource "aws_s3_bucket" "backup_sp" {
            provider = aws.sp
            bucket   = "backup-\${var.nome}-\${random_id.sufixo.hex}-sp"
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { provider: 'aws', alias: 'sp' },
            { meta: 'aws_s3_bucket.backup_sp', provider: 'aws.sp' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_s3_bucket.backup_sp', atributo: 'region', igual: 'sa-east-1' }] },
      ],
    },
    {
      titulo: 'Tags comuns e um resumo',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie o arquivo <code>locals.tf</code> com <code>locals { tags = { Projeto = "multicloud", Gerenciado = "terraform" } }</code>;</li>
          <li>em <code>armazenamento.tf</code>, use <code>tags = local.tags</code> no bucket, no grupo de recursos e na conta de armazenamento;</li>
          <li>crie o arquivo <code>outputs.tf</code> com <code>output "nuvens"</code> valendo
            <code>{ aws = aws_s3_bucket.backup.bucket, azure = azurerm_storage_account.st.name, site = azurerm_storage_account.st.primary_web_endpoint }</code>.</li>
        </ul>`,
      dica: 'As mesmas tags nas duas nuvens ajudam a achar (e pagar) tudo do projeto',
      alteracoes: {
        'locals.tf': tf`
          locals {
            tags = {
              Projeto    = "multicloud"
              Gerenciado = "terraform"
            }
          }
        `,
        'armazenamento.tf': armazenamento(TAGS),
        'outputs.tf': tf`
          output "nuvens" {
            value = {
              aws   = aws_s3_bucket.backup.bucket
              azure = azurerm_storage_account.st.name
              site  = azurerm_storage_account.st.primary_web_endpoint
            }
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket.backup', atributo: 'tags.Projeto', igual: 'multicloud' },
            { recurso: 'azurerm_storage_account.st', atributo: 'tags.Projeto', igual: 'multicloud' },
            { recurso: 'azurerm_resource_group.rg', atributo: 'tags.Gerenciado', igual: 'terraform' },
            { saida: 'nuvens', existe: true },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'nuvens', contem: 'web.core.windows.net' }] },
      ],
    },
  ],
});

// ---------- 8. Estado remoto e boas práticas ----------

const PROVEDOR_ESTADO = juntarTf(REQ_AWS, PROVIDER_US);

const DADOS = tf`
  resource "aws_s3_bucket" "dados" {
    bucket = "dados-da-empresa-2026"
  }
`;

const PRINCIPAL = tf`
  resource "aws_s3_bucket" "principal" {
    bucket = "dados-da-empresa-2026"
  }

  moved {
    from = aws_s3_bucket.dados
    to   = aws_s3_bucket.principal
  }
`;

const LOGS = tf`
  resource "aws_s3_bucket" "logs" {
    bucket = "logs-legados-2026"
  }
`;

export const projetoEstado = criarProjeto({
  id: 'proj-estado',
  titulo: 'Estado remoto e boas práticas',
  icone: '🔐',
  descricao: 'Bucket de estado protegido, backend S3 com trava, import, moved, removed e versões fixadas.',
  resumo: `
    <p>O arquivo de <b>estado</b> (<code>terraform.tfstate</code>) é a memória do Terraform: ele liga cada bloco do código a um
    recurso real. Num time, ele não pode ficar no computador de uma pessoa só.</p>
    <ul>
      <li><b>estado remoto</b>: o estado fica num bucket S3 versionado e criptografado;</li>
      <li><b>trava</b> (<code>use_lockfile</code>): duas pessoas não rodam apply ao mesmo tempo;</li>
      <li><b>import</b>, <b>moved</b> e <b>removed</b>: mexem no estado sem destruir nada.</li>
    </ul>
    <p>Analogia: o estado é o caderno de chamada da turma. Ele fica na secretaria (remoto), e só um professor escreve por vez (trava).</p>`,
  inicial: {
    'providers.tf': PROVEDOR_ESTADO,
    'main.tf': DADOS,
  },
  etapas: [
    {
      titulo: 'O bucket do estado',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>estado.tf</code>:</p>
        <ul>
          <li><code>aws_s3_bucket "estado"</code> com <code>bucket = "tfstate-sertao-2026"</code> e
            <code>lifecycle { prevent_destroy = true }</code> (perder o estado é um desastre);</li>
          <li><code>aws_s3_bucket_versioning "estado"</code> com <code>status = "Enabled"</code> (dá para voltar versões);</li>
          <li><code>aws_s3_bucket_public_access_block "estado"</code> com os quatro bloqueios em <code>true</code>.</li>
        </ul>`,
      dica: 'versioning_configuration { status = "Enabled" }',
      alteracoes: {
        'estado.tf': tf`
          resource "aws_s3_bucket" "estado" {
            bucket = "tfstate-sertao-2026"

            lifecycle {
              prevent_destroy = true
            }
          }

          resource "aws_s3_bucket_versioning" "estado" {
            bucket = aws_s3_bucket.estado.id

            versioning_configuration {
              status = "Enabled"
            }
          }

          resource "aws_s3_bucket_public_access_block" "estado" {
            bucket                  = aws_s3_bucket.estado.id
            block_public_acls       = true
            block_public_policy     = true
            ignore_public_acls      = true
            restrict_public_buckets = true
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { lifecycle: 'aws_s3_bucket.estado', prevent_destroy: true },
            { recurso: 'aws_s3_bucket_versioning.estado', atributo: 'versioning_configuration.0.status', igual: 'Enabled' },
            { recurso: 'aws_s3_bucket_public_access_block.estado', atributo: 'block_public_acls', igual: true },
          ],
        },
      ],
    },
    {
      titulo: 'O backend S3 com trava',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>backend.tf</code> com um bloco <code>terraform { backend "s3" { ... } }</code>:</p>
        <ul>
          <li><code>bucket = "tfstate-sertao-2026"</code> e <code>key = "empresa/terraform.tfstate"</code>;</li>
          <li><code>region = "us-east-1"</code>, <code>encrypt = true</code> e <code>use_lockfile = true</code>.</li>
        </ul>
        <p>Lembre: o backend não aceita variáveis. Tudo escrito direto.</p>`,
      dica: 'Pode existir mais de um bloco terraform { }, em arquivos diferentes',
      alteracoes: {
        'backend.tf': tf`
          terraform {
            backend "s3" {
              bucket       = "tfstate-sertao-2026"
              key          = "empresa/terraform.tfstate"
              region       = "us-east-1"
              encrypt      = true
              use_lockfile = true
            }
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform init',
          regras: [
            { semErros: true },
            { backend: 's3', atributo: 'bucket', igual: 'tfstate-sertao-2026' },
            { backend: 's3', atributo: 'key', igual: 'empresa/terraform.tfstate' },
            { backend: 's3', atributo: 'use_lockfile', igual: true },
            { backend: 's3', atributo: 'encrypt', igual: true },
          ],
        },
      ],
    },
    {
      titulo: 'Importando um bucket antigo',
      dificuldade: 'medio',
      enunciado: `
        <p>Já existe um bucket <code>logs-legados-2026</code>, criado à mão no console. Traga-o para o Terraform sem recriar.</p>
        <ul>
          <li>crie o arquivo <code>importar.tf</code> com <code>import { to = aws_s3_bucket.logs  id = "logs-legados-2026" }</code>;</li>
          <li>e o recurso <code>aws_s3_bucket "logs"</code> com <code>bucket = "logs-legados-2026"</code>.</li>
        </ul>
        <p>No plano, o bucket aparece como <b>import</b>, e não como <b>create</b>.</p>`,
      dica: 'O bloco import diz "esse recurso já existe, só anote no estado"',
      alteracoes: {
        'importar.tf': juntarTf(tf`
          import {
            to = aws_s3_bucket.logs
            id = "logs-legados-2026"
          }
        `, LOGS),
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket.logs', acao: 'importar' },
            { plano: { importar: 1 } },
          ],
        },
      ],
    },
    {
      titulo: 'Renomeando sem destruir',
      dificuldade: 'dificil',
      enunciado: `
        <p>O nome <code>aws_s3_bucket.dados</code> ficou vago. Renomeie para <code>aws_s3_bucket.principal</code> <b>sem</b> recriar o bucket.</p>
        <ul>
          <li>em <code>main.tf</code>, troque o rótulo do recurso para <code>"principal"</code>;</li>
          <li>acrescente <code>moved { from = aws_s3_bucket.dados  to = aws_s3_bucket.principal }</code>.</li>
        </ul>
        <p>O teste aplica a versão antiga primeiro e confere que o plano só <b>move</b>, sem destruir.</p>`,
      dica: 'Sem o moved, o Terraform destruiria o bucket antigo e criaria outro',
      alteracoes: { 'main.tf': PRINCIPAL },
      testes: [
        {
          descricao: 'plan depois do apply da versão antiga',
          antes: { 'providers.tf': PROVEDOR_ESTADO, 'main.tf': DADOS },
          regras: [
            { semErros: true },
            { movido: ['aws_s3_bucket.dados', 'aws_s3_bucket.principal'] },
            { plano: { destruir: 0 } },
          ],
        },
      ],
    },
    {
      titulo: 'Esquecendo o bucket antigo e fixando versões',
      dificuldade: 'dificil',
      enunciado: `
        <p>Os logs legados vão para outra equipe: o Terraform deve <b>parar de cuidar</b> do bucket, mas sem apagá-lo.</p>
        <ul>
          <li>apague o arquivo <code>importar.tf</code>;</li>
          <li>crie o arquivo <code>esquecer.tf</code> com <code>removed { from = aws_s3_bucket.logs  lifecycle { destroy = false } }</code>;</li>
          <li>em <code>providers.tf</code>, fixe a versão do Terraform: <code>required_version = "&gt;= 1.10"</code> dentro do bloco <code>terraform</code>.</li>
        </ul>`,
      dica: 'removed com destroy = false tira do estado, mas deixa o recurso existindo na nuvem',
      alteracoes: {
        'importar.tf': null,
        'esquecer.tf': tf`
          removed {
            from = aws_s3_bucket.logs

            lifecycle {
              destroy = false
            }
          }
        `,
        'providers.tf': PROVEDOR_ESTADO.replace('terraform {\n', 'terraform {\n  required_version = ">= 1.10"\n\n'),
      },
      testes: [
        {
          descricao: 'plan depois do apply com o bucket de logs',
          antes: { 'providers.tf': PROVEDOR_ESTADO, 'main.tf': PRINCIPAL, 'logs.tf': LOGS },
          regras: [
            { semErros: true },
            { versaoTerraform: true },
            { plano: { destruir: 0 } },
            { semCodigo: 'import\\s*\\{', msg: 'O bloco import saiu do código' },
            { codigo: 'removed\\s*\\{', msg: 'Existe um bloco removed' },
          ],
        },
      ],
    },
  ],
});

