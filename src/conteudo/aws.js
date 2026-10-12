// Módulo 2: Terraform na AWS. S3, IAM, rede, EC2, balanceamento, bancos,
// serverless, mensagens, monitoramento, estado remoto e várias regiões.
import { tf, licao, problema, AWS, juntar } from './util.js';

const REQ = tf`
  terraform {
    required_providers {
      aws = {
        source  = "hashicorp/aws"
        version = "~> 6.0"
      }
    }
  }
`;

const BUCKET_SITE = tf`
  resource "aws_s3_bucket" "site" {
    bucket = "site-da-turma-2026"
  }
`;

const VPC = tf`
  resource "aws_vpc" "principal" {
    cidr_block           = "10.0.0.0/16"
    enable_dns_hostnames = true

    tags = {
      Name = "vpc-aula"
    }
  }
`;

const IGW = tf`
  resource "aws_internet_gateway" "igw" {
    vpc_id = aws_vpc.principal.id
  }
`;

const SUBNET_PUBLICA = tf`
  resource "aws_subnet" "publica" {
    vpc_id                  = aws_vpc.principal.id
    cidr_block              = "10.0.1.0/24"
    availability_zone       = "us-east-1a"
    map_public_ip_on_launch = true
  }
`;

const DUAS_SUBNETS = tf`
  resource "aws_subnet" "a" {
    vpc_id            = aws_vpc.principal.id
    cidr_block        = "10.0.1.0/24"
    availability_zone = "us-east-1a"
  }

  resource "aws_subnet" "b" {
    vpc_id            = aws_vpc.principal.id
    cidr_block        = "10.0.2.0/24"
    availability_zone = "us-east-1b"
  }
`;

const SG_WEB = tf`
  resource "aws_security_group" "web" {
    name   = "web"
    vpc_id = aws_vpc.principal.id

    ingress {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }

    egress {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
`;

const AMI = tf`
  data "aws_ami" "ubuntu" {
    most_recent = true
    owners      = ["099720109477"]

    filter {
      name   = "name"
      values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
    }
  }
`;

const ROLE_EC2 = tf`
  data "aws_iam_policy_document" "assume_ec2" {
    statement {
      actions = ["sts:AssumeRole"]

      principals {
        type        = "Service"
        identifiers = ["ec2.amazonaws.com"]
      }
    }
  }

  resource "aws_iam_role" "app" {
    name               = "app-ec2"
    assume_role_policy = data.aws_iam_policy_document.assume_ec2.json
  }
`;

const ROLE_LAMBDA = tf`
  data "aws_iam_policy_document" "assume_lambda" {
    statement {
      actions = ["sts:AssumeRole"]

      principals {
        type        = "Service"
        identifiers = ["lambda.amazonaws.com"]
      }
    }
  }

  resource "aws_iam_role" "lambda" {
    name               = "lambda-ola"
    assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
  }
`;

const APP_PY = 'def handler(event, context):\n    return {"statusCode": 200, "body": "Olá do sertão!"}\n';

const LAMBDA = tf`
  data "archive_file" "codigo" {
    type        = "zip"
    source_file = "app.py"
    output_path = "app.zip"
  }

  resource "aws_lambda_function" "ola" {
    function_name    = "ola"
    role             = aws_iam_role.lambda.arn
    handler          = "app.handler"
    runtime          = "python3.12"
    filename         = data.archive_file.codigo.output_path
    source_code_hash = data.archive_file.codigo.output_base64sha256
  }
`;

const SNS = tf`
  resource "aws_sns_topic" "alertas" {
    name = "alertas"
  }
`;

const comAws = (...partes) => juntar(AWS, ...partes);

export const moduloAws = {
  id: 'aws',
  titulo: 'Terraform na AWS',
  icone: '🟧',
  descricao: 'S3, IAM, VPC, EC2, load balancer, RDS, DynamoDB, Lambda, API Gateway, filas e estado remoto.',
  itens: [
    licao({
      id: 'licao-aws-provedor',
      titulo: 'A AWS e o provedor aws',
      resumo: `
        <p>A <b>AWS</b> é a nuvem da Amazon. O Terraform fala com ela pelo provedor <code>hashicorp/aws</code>.</p>
        <ul>
          <li>No bloco <code>terraform { required_providers { } }</code> você fixa a versão do provedor
            (aqui usamos a <code>~&gt; 6.0</code>).</li>
          <li>No bloco <code>provider "aws"</code> você diz a <b>região</b>: <code>sa-east-1</code> é São Paulo,
            <code>us-east-1</code> é a Virgínia (costuma ser a mais barata).</li>
          <li>As <b>credenciais</b> nunca vão no código: na vida real elas vêm de variáveis de ambiente
            (<code>AWS_ACCESS_KEY_ID</code>), do <code>aws configure</code> ou de um papel (role) do CI.</li>
        </ul>
        <p>Aqui é um simulador: não precisa de conta e nada é cobrado. Os IDs (<code>vpc-0a1b...</code>) e ARNs são inventados,
        mas seguem o formato real.</p>
        <p><b>Cuidado na vida real:</b> recursos na AWS custam dinheiro. Depois de estudar, rode <code>terraform destroy</code>.</p>`,
      codigo: juntar(REQ, tf`
        provider "aws" {
          region = "sa-east-1"

          default_tags {
            tags = {
              Projeto = "aula"
            }
          }
        }

        resource "aws_s3_bucket" "primeiro" {
          bucket = "meu-primeiro-bucket-2026"
        }

        output "arn" {
          value = aws_s3_bucket.primeiro.arn
        }
      `),
    }),

    problema({
      id: 'aws-provedor',
      titulo: 'Configurando o provedor AWS',
      dificuldade: 'facil',
      enunciado: `
        <p>Rode o plan: falta configurar o provedor. Prepare o projeto para a AWS em São Paulo.</p>
        <ul>
          <li>crie <code>terraform { required_providers { aws = { source = "hashicorp/aws", version = "~&gt; 6.0" } } }</code>;</li>
          <li>crie <code>provider "aws"</code> com <code>region = "sa-east-1"</code>.</li>
        </ul>`,
      dica: 'provider "aws" { region = "sa-east-1" }',
      inicial: tf`
        resource "aws_s3_bucket" "dados" {
          bucket = "dados-da-turma-2026"
        }
      `,
      solucao: juntar(REQ, tf`
        provider "aws" {
          region = "sa-east-1"
        }

        resource "aws_s3_bucket" "dados" {
          bucket = "dados-da-turma-2026"
        }
      `),
      testes: [
        {
          descricao: 'terraform init e plan',
          regras: [
            { semErros: true },
            { requerido: 'aws', source: 'hashicorp/aws', versao: '~> 6.0' },
            { provider: 'aws', atributo: 'region', igual: 'sa-east-1' },
            { recurso: 'aws_s3_bucket.dados', atributo: 'region', igual: 'sa-east-1' },
          ],
        },
        { oculto: true, descricao: 'versão instalada', regras: [{ texto: 'Installing hashicorp/aws v6' }] },
      ],
    }),

    problema({
      id: 'aws-s3-bucket',
      titulo: 'Um bucket com tags',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>resource "aws_s3_bucket" "fotos"</code> com <code>bucket = "fotos-turma-sertao-2026"</code>;</li>
          <li>com as tags <code>Projeto = "aula"</code> e <code>Ambiente = "dev"</code>.</li>
        </ul>
        <p>O nome de um bucket é <b>único no mundo inteiro</b>: só letras minúsculas, números, pontos e hifens.</p>`,
      dica: 'tags = { Projeto = "aula", Ambiente = "dev" }',
      inicial: comAws(tf`
        # resource "aws_s3_bucket" "fotos" { ... }
      `),
      solucao: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"

          tags = {
            Projeto  = "aula"
            Ambiente = "dev"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket.fotos', atributo: 'bucket', igual: 'fotos-turma-sertao-2026' },
            { recurso: 'aws_s3_bucket.fotos', atributo: 'tags', igual: { Projeto: 'aula', Ambiente: 'dev' } },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_s3_bucket.fotos', atributo: 'arn', igual: 'arn:aws:s3:::fotos-turma-sertao-2026' }] },
      ],
    }),

    problema({
      id: 'aws-s3-nome-unico',
      titulo: 'Nome de bucket sem conflito',
      dificuldade: 'medio',
      enunciado: `
        <p>Como o nome do bucket é único no mundo, é comum acrescentar um sufixo aleatório.</p>
        <ul>
          <li>crie <code>random_string "sufixo"</code> com <code>length = 6</code>, <code>special = false</code> e <code>upper = false</code>;</li>
          <li>o bucket deve se chamar <code>"fotos-\${random_string.sufixo.result}"</code>.</li>
        </ul>`,
      dica: 'bucket = "fotos-${random_string.sufixo.result}"',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos"
        }
      `),
      solucao: comAws(tf`
        resource "random_string" "sufixo" {
          length  = 6
          special = false
          upper   = false
        }

        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-\${random_string.sufixo.result}"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'random_string.sufixo', atributo: 'special', igual: false },
            { recurso: 'random_string.sufixo', atributo: 'upper', igual: false },
            { recurso: 'aws_s3_bucket.fotos', atributo: 'bucket', referencia: 'random_string.sufixo.result' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_s3_bucket.fotos', atributo: 'bucket', regex: '^fotos-[a-z0-9]{6}$' }] },
      ],
    }),

    problema({
      id: 'aws-s3-versionamento',
      titulo: 'Versionamento no S3',
      dificuldade: 'facil',
      enunciado: `
        <p>Com versionamento, apagar ou sobrescrever um arquivo não perde a versão antiga. Na versão atual do provedor,
        isso é um recurso separado do bucket.</p>
        <ul>
          <li>crie <code>aws_s3_bucket_versioning "fotos"</code> com <code>bucket = aws_s3_bucket.fotos.id</code>;</li>
          <li>e o bloco <code>versioning_configuration { status = "Enabled" }</code>.</li>
        </ul>`,
      dica: 'versioning_configuration { status = "Enabled" }',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }
      `),
      solucao: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }

        resource "aws_s3_bucket_versioning" "fotos" {
          bucket = aws_s3_bucket.fotos.id

          versioning_configuration {
            status = "Enabled"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket_versioning.fotos', atributo: 'bucket', referencia: 'aws_s3_bucket.fotos.id' },
            { recurso: 'aws_s3_bucket_versioning.fotos', atributo: 'versioning_configuration.0.status', igual: 'Enabled' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-s3-bloqueio-publico',
      titulo: 'Bloquear acesso público',
      dificuldade: 'facil',
      enunciado: `
        <p>Buckets vazados são um dos erros de segurança mais comuns. Bloqueie todo acesso público.</p>
        <ul>
          <li>crie <code>aws_s3_bucket_public_access_block "fotos"</code> para o bucket <code>fotos</code>;</li>
          <li>com os quatro argumentos <code>block_public_acls</code>, <code>block_public_policy</code>,
            <code>ignore_public_acls</code> e <code>restrict_public_buckets</code> iguais a <code>true</code>.</li>
        </ul>`,
      dica: 'block_public_acls = true (e os outros três)',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }
      `),
      solucao: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }

        resource "aws_s3_bucket_public_access_block" "fotos" {
          bucket                  = aws_s3_bucket.fotos.id
          block_public_acls       = true
          block_public_policy     = true
          ignore_public_acls      = true
          restrict_public_buckets = true
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket_public_access_block.fotos', atributo: 'block_public_acls', igual: true },
            { recurso: 'aws_s3_bucket_public_access_block.fotos', atributo: 'block_public_policy', igual: true },
            { recurso: 'aws_s3_bucket_public_access_block.fotos', atributo: 'ignore_public_acls', igual: true },
            { recurso: 'aws_s3_bucket_public_access_block.fotos', atributo: 'restrict_public_buckets', igual: true },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-s3-criptografia',
      titulo: 'Criptografia com chave própria (KMS)',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_kms_key "chave"</code> com <code>enable_key_rotation = true</code>;</li>
          <li>crie <code>aws_s3_bucket_server_side_encryption_configuration "fotos"</code> para o bucket;</li>
          <li>com <code>rule { apply_server_side_encryption_by_default { ... } }</code> usando
            <code>sse_algorithm = "aws:kms"</code> e <code>kms_master_key_id = aws_kms_key.chave.arn</code>.</li>
        </ul>`,
      dica: 'Os blocos ficam um dentro do outro: rule { apply_server_side_encryption_by_default { ... } }',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }
      `),
      solucao: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }

        resource "aws_kms_key" "chave" {
          description         = "Chave dos arquivos da turma"
          enable_key_rotation = true
        }

        resource "aws_s3_bucket_server_side_encryption_configuration" "fotos" {
          bucket = aws_s3_bucket.fotos.id

          rule {
            apply_server_side_encryption_by_default {
              sse_algorithm     = "aws:kms"
              kms_master_key_id = aws_kms_key.chave.arn
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_kms_key.chave', atributo: 'enable_key_rotation', igual: true },
            { recurso: 'aws_s3_bucket_server_side_encryption_configuration.fotos', atributo: 'rule.0.apply_server_side_encryption_by_default.0.sse_algorithm', igual: 'aws:kms' },
            { recurso: 'aws_s3_bucket_server_side_encryption_configuration.fotos', atributo: 'rule.0.apply_server_side_encryption_by_default.0.kms_master_key_id', referencia: 'aws_kms_key.chave.arn' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-s3-ciclo-de-vida',
      titulo: 'Apagar arquivos temporários sozinho',
      dificuldade: 'medio',
      enunciado: `
        <p>Arquivos na pasta <code>tmp/</code> devem sumir depois de 7 dias, para não pagar à toa.</p>
        <ul>
          <li>crie <code>aws_s3_bucket_lifecycle_configuration "fotos"</code>;</li>
          <li>com um <code>rule</code> de <code>id = "apagar-temporarios"</code> e <code>status = "Enabled"</code>;</li>
          <li>dentro dele, <code>filter { prefix = "tmp/" }</code> e <code>expiration { days = 7 }</code>.</li>
        </ul>`,
      dica: 'rule { id = "..."  status = "Enabled"  filter { ... }  expiration { ... } }',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }
      `),
      solucao: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-turma-sertao-2026"
        }

        resource "aws_s3_bucket_lifecycle_configuration" "fotos" {
          bucket = aws_s3_bucket.fotos.id

          rule {
            id     = "apagar-temporarios"
            status = "Enabled"

            filter {
              prefix = "tmp/"
            }

            expiration {
              days = 7
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket_lifecycle_configuration.fotos', atributo: 'rule.0.id', igual: 'apagar-temporarios' },
            { recurso: 'aws_s3_bucket_lifecycle_configuration.fotos', atributo: 'rule.0.filter.0.prefix', igual: 'tmp/' },
            { recurso: 'aws_s3_bucket_lifecycle_configuration.fotos', atributo: 'rule.0.expiration.0.days', igual: 7 },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-s3-site',
      titulo: 'Bucket como site',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_s3_bucket_website_configuration "site"</code> para o bucket <code>site</code>;</li>
          <li>com <code>index_document { suffix = "index.html" }</code> e <code>error_document { key = "erro.html" }</code>;</li>
          <li>crie <code>output "endereco"</code> com o <code>website_endpoint</code> da configuração.</li>
        </ul>`,
      dica: 'aws_s3_bucket_website_configuration.site.website_endpoint',
      inicial: comAws(BUCKET_SITE),
      solucao: comAws(BUCKET_SITE, tf`
        resource "aws_s3_bucket_website_configuration" "site" {
          bucket = aws_s3_bucket.site.id

          index_document {
            suffix = "index.html"
          }

          error_document {
            key = "erro.html"
          }
        }

        output "endereco" {
          value = aws_s3_bucket_website_configuration.site.website_endpoint
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket_website_configuration.site', atributo: 'index_document.0.suffix', igual: 'index.html' },
            { recurso: 'aws_s3_bucket_website_configuration.site', atributo: 'error_document.0.key', igual: 'erro.html' },
            { saida: 'endereco', conhecido: false },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'endereco', contem: 's3-website-us-east-1' }] },
      ],
    }),

    problema({
      id: 'aws-s3-objeto',
      titulo: 'Enviando um arquivo (objeto)',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_s3_object "pagina"</code> no bucket <code>site</code>;</li>
          <li>com <code>key = "index.html"</code>, <code>content = "&lt;h1&gt;Olá, sertão!&lt;/h1&gt;"</code>;</li>
          <li>e <code>content_type = "text/html"</code> (assim o navegador mostra a página em vez de baixar).</li>
        </ul>`,
      dica: 'bucket = aws_s3_bucket.site.id',
      inicial: comAws(BUCKET_SITE),
      solucao: comAws(BUCKET_SITE, tf`
        resource "aws_s3_object" "pagina" {
          bucket       = aws_s3_bucket.site.id
          key          = "index.html"
          content      = "<h1>Olá, sertão!</h1>"
          content_type = "text/html"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_object.pagina', atributo: 'key', igual: 'index.html' },
            { recurso: 'aws_s3_object.pagina', atributo: 'content_type', igual: 'text/html' },
            { recurso: 'aws_s3_object.pagina', atributo: 'bucket', referencia: 'aws_s3_bucket.site.id' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_s3_object.pagina', atributo: 'etag', existe: true }] },
      ],
    }),

    problema({
      id: 'aws-s3-politica',
      titulo: 'Política de bucket com policy document',
      dificuldade: 'dificil',
      enunciado: `
        <p>Escrever JSON de política à mão é fácil de errar. O data source <code>aws_iam_policy_document</code> monta o JSON a partir de blocos.</p>
        <ul>
          <li>crie <code>data "aws_iam_policy_document" "leitura_publica"</code> com um <code>statement</code>;</li>
          <li>no statement: <code>actions = ["s3:GetObject"]</code>, <code>resources = ["\${aws_s3_bucket.site.arn}/*"]</code>
            e <code>principals { type = "*"  identifiers = ["*"] }</code>;</li>
          <li>crie <code>aws_s3_bucket_policy "site"</code> com <code>policy = data.aws_iam_policy_document.leitura_publica.json</code>.</li>
        </ul>`,
      dica: 'resources = ["${aws_s3_bucket.site.arn}/*"]',
      inicial: comAws(BUCKET_SITE),
      solucao: comAws(BUCKET_SITE, tf`
        data "aws_iam_policy_document" "leitura_publica" {
          statement {
            sid       = "LeituraPublica"
            actions   = ["s3:GetObject"]
            resources = ["\${aws_s3_bucket.site.arn}/*"]

            principals {
              type        = "*"
              identifiers = ["*"]
            }
          }
        }

        resource "aws_s3_bucket_policy" "site" {
          bucket = aws_s3_bucket.site.id
          policy = data.aws_iam_policy_document.leitura_publica.json
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { dado: 'aws_iam_policy_document.leitura_publica' },
            { recurso: 'aws_s3_bucket_policy.site', atributo: 'policy', referencia: 'data.aws_iam_policy_document.leitura_publica' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [
            { recurso: 'aws_s3_bucket_policy.site', atributo: 'policy', contem: '"Action": "s3:GetObject"' },
            { recurso: 'aws_s3_bucket_policy.site', atributo: 'policy', contem: 'arn:aws:s3:::site-da-turma-2026/*' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-default-tags',
      titulo: 'Tags padrão no provedor',
      dificuldade: 'facil',
      enunciado: `
        <p>Em vez de repetir as mesmas tags em cada recurso, coloque-as uma vez no provedor.</p>
        <ul>
          <li>no <code>provider "aws"</code>, acrescente <code>default_tags { tags = { ... } }</code>;</li>
          <li>com <code>Projeto = "sertao"</code> e <code>GerenciadoPor = "terraform"</code>;</li>
          <li>veja no plano o atributo <code>tags_all</code> do bucket com as duas tags.</li>
        </ul>`,
      dica: 'default_tags { tags = { ... } } dentro do provider',
      inicial: tf`
        provider "aws" {
          region = "us-east-1"
        }

        resource "aws_s3_bucket" "logs" {
          bucket = "logs-da-turma-2026"
        }
      `,
      solucao: tf`
        provider "aws" {
          region = "us-east-1"

          default_tags {
            tags = {
              Projeto       = "sertao"
              GerenciadoPor = "terraform"
            }
          }
        }

        resource "aws_s3_bucket" "logs" {
          bucket = "logs-da-turma-2026"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { provider: 'aws', atributo: 'default_tags.0.tags', igual: { Projeto: 'sertao', GerenciadoPor: 'terraform' } },
            { recurso: 'aws_s3_bucket.logs', atributo: 'tags_all', igual: { Projeto: 'sertao', GerenciadoPor: 'terraform' } },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-s3-nome-invalido',
      titulo: 'Conserte o nome do bucket',
      dificuldade: 'facil',
      enunciado: `
        <p>Rode o plan e leia o erro: o nome do bucket não segue as regras da AWS.</p>
        <ul>
          <li>troque por <code>fotos-da-turma-2026</code> (só minúsculas, números e hifens).</li>
        </ul>`,
      dica: 'Sem letras maiúsculas e sem sublinhado (_).',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "Fotos_Da_Turma"
        }
      `),
      solucao: comAws(tf`
        resource "aws_s3_bucket" "fotos" {
          bucket = "fotos-da-turma-2026"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'aws_s3_bucket.fotos', atributo: 'bucket', igual: 'fotos-da-turma-2026' }] },
      ],
    }),

    licao({
      id: 'licao-aws-iam',
      titulo: 'IAM: quem pode fazer o quê',
      resumo: `
        <p>O <b>IAM</b> controla o acesso na AWS:</p>
        <ul>
          <li><b>usuário</b> (<code>aws_iam_user</code>): uma pessoa ou sistema com login;</li>
          <li><b>grupo</b> (<code>aws_iam_group</code>): junta usuários com as mesmas permissões;</li>
          <li><b>papel/role</b> (<code>aws_iam_role</code>): permissões que um serviço "veste" (uma EC2, uma Lambda), sem senha;</li>
          <li><b>política/policy</b>: o JSON que diz o que é permitido (<code>Allow</code>) em quais recursos.</li>
        </ul>
        <p>Use o data source <code>aws_iam_policy_document</code> para escrever políticas em HCL, e siga o
        <b>menor privilégio</b>: só o necessário.</p>`,
      codigo: comAws(tf`
        data "aws_iam_policy_document" "leitura" {
          statement {
            actions   = ["s3:GetObject"]
            resources = ["arn:aws:s3:::relatorios/*"]
          }
        }

        resource "aws_iam_policy" "leitura" {
          name   = "leitura-relatorios"
          policy = data.aws_iam_policy_document.leitura.json
        }

        output "politica" {
          value = data.aws_iam_policy_document.leitura.json
        }
      `),
    }),

    problema({
      id: 'aws-iam-usuario',
      titulo: 'Um usuário do IAM',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>aws_iam_user "ana"</code> com <code>name = "ana.silva"</code>;</li>
          <li>e a tag <code>Time = "infra"</code>.</li>
        </ul>`,
      dica: 'resource "aws_iam_user" "ana" { name = "ana.silva" ... }',
      inicial: comAws(tf`
        # resource "aws_iam_user" "ana" { ... }
      `),
      solucao: comAws(tf`
        resource "aws_iam_user" "ana" {
          name = "ana.silva"

          tags = {
            Time = "infra"
          }
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'aws_iam_user.ana', atributo: 'name', igual: 'ana.silva' }, { recurso: 'aws_iam_user.ana', atributo: 'tags', igual: { Time: 'infra' } }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_iam_user.ana', atributo: 'arn', igual: 'arn:aws:iam::123456789012:user/ana.silva' }] },
      ],
    }),

    problema({
      id: 'aws-iam-grupo',
      titulo: 'Usuário num grupo',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_iam_group "devs"</code> com <code>name = "desenvolvedores"</code>;</li>
          <li>coloque a usuária no grupo com <code>aws_iam_user_group_membership "ana"</code>;</li>
          <li>use <code>user = aws_iam_user.ana.name</code> e <code>groups = [aws_iam_group.devs.name]</code>.</li>
        </ul>`,
      dica: 'groups é uma lista: groups = [aws_iam_group.devs.name]',
      inicial: comAws(tf`
        resource "aws_iam_user" "ana" {
          name = "ana.silva"
        }
      `),
      solucao: comAws(tf`
        resource "aws_iam_user" "ana" {
          name = "ana.silva"
        }

        resource "aws_iam_group" "devs" {
          name = "desenvolvedores"
        }

        resource "aws_iam_user_group_membership" "ana" {
          user   = aws_iam_user.ana.name
          groups = [aws_iam_group.devs.name]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_iam_group.devs', atributo: 'name', igual: 'desenvolvedores' },
            { recurso: 'aws_iam_user_group_membership.ana', atributo: 'user', igual: 'ana.silva' },
            { recurso: 'aws_iam_user_group_membership.ana', atributo: 'groups', igual: ['desenvolvedores'] },
            { dependencia: ['aws_iam_user_group_membership.ana', 'aws_iam_group.devs'] },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-iam-politica',
      titulo: 'Uma política de só leitura',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>data "aws_iam_policy_document" "leitura_s3"</code> com um <code>statement</code> que permite
            <code>"s3:GetObject"</code> e <code>"s3:ListBucket"</code>;</li>
          <li>nos <code>resources</code>: <code>"arn:aws:s3:::relatorios"</code> e <code>"arn:aws:s3:::relatorios/*"</code>;</li>
          <li>crie <code>aws_iam_policy "leitura"</code> com <code>name = "leitura-relatorios"</code> e o JSON do documento.</li>
        </ul>`,
      dica: 'policy = data.aws_iam_policy_document.leitura_s3.json',
      inicial: comAws(tf`
        # data "aws_iam_policy_document" "leitura_s3" { ... }
        # resource "aws_iam_policy" "leitura" { ... }
      `),
      solucao: comAws(tf`
        data "aws_iam_policy_document" "leitura_s3" {
          statement {
            actions = ["s3:GetObject", "s3:ListBucket"]
            resources = [
              "arn:aws:s3:::relatorios",
              "arn:aws:s3:::relatorios/*",
            ]
          }
        }

        resource "aws_iam_policy" "leitura" {
          name   = "leitura-relatorios"
          policy = data.aws_iam_policy_document.leitura_s3.json
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { dado: 'aws_iam_policy_document.leitura_s3' },
            { recurso: 'aws_iam_policy.leitura', atributo: 'name', igual: 'leitura-relatorios' },
            { recurso: 'aws_iam_policy.leitura', atributo: 'policy', contem: 's3:ListBucket' },
            { recurso: 'aws_iam_policy.leitura', atributo: 'policy', contem: 'arn:aws:s3:::relatorios/*' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-iam-role-ec2',
      titulo: 'Um papel para a EC2',
      dificuldade: 'medio',
      enunciado: `
        <p>Uma role precisa dizer <b>quem pode assumi-la</b> (a "trust policy").</p>
        <ul>
          <li>crie <code>data "aws_iam_policy_document" "assume_ec2"</code> com <code>actions = ["sts:AssumeRole"]</code>;</li>
          <li>e <code>principals { type = "Service"  identifiers = ["ec2.amazonaws.com"] }</code>;</li>
          <li>crie <code>aws_iam_role "app"</code> com <code>name = "app-ec2"</code> e <code>assume_role_policy</code> com esse JSON.</li>
        </ul>`,
      dica: 'assume_role_policy = data.aws_iam_policy_document.assume_ec2.json',
      inicial: comAws(tf`
        # data "aws_iam_policy_document" "assume_ec2" { ... }
        # resource "aws_iam_role" "app" { ... }
      `),
      solucao: comAws(ROLE_EC2),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_iam_role.app', atributo: 'name', igual: 'app-ec2' },
            { recurso: 'aws_iam_role.app', atributo: 'assume_role_policy', contem: 'ec2.amazonaws.com' },
            { recurso: 'aws_iam_role.app', atributo: 'assume_role_policy', contem: 'sts:AssumeRole' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-iam-anexar',
      titulo: 'Anexar uma política gerenciada',
      dificuldade: 'facil',
      enunciado: `
        <p>A AWS oferece políticas prontas. A <code>AmazonSSMManagedInstanceCore</code> deixa acessar a máquina sem SSH.</p>
        <ul>
          <li>crie <code>aws_iam_role_policy_attachment "ssm"</code>;</li>
          <li>com <code>role = aws_iam_role.app.name</code>;</li>
          <li>e <code>policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"</code>.</li>
        </ul>`,
      dica: 'role usa o name da role, não o arn',
      inicial: comAws(ROLE_EC2),
      solucao: comAws(ROLE_EC2, tf`
        resource "aws_iam_role_policy_attachment" "ssm" {
          role       = aws_iam_role.app.name
          policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_iam_role_policy_attachment.ssm', atributo: 'role', igual: 'app-ec2' },
            { recurso: 'aws_iam_role_policy_attachment.ssm', atributo: 'policy_arn', igual: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-iam-perfil-instancia',
      titulo: 'Perfil de instância',
      dificuldade: 'medio',
      enunciado: `
        <p>Para uma EC2 usar uma role, ela precisa de um <b>instance profile</b> (o "crachá" da máquina).</p>
        <ul>
          <li>crie <code>aws_iam_instance_profile "app"</code> com <code>name = "app-perfil"</code>;</li>
          <li>e <code>role = aws_iam_role.app.name</code>.</li>
        </ul>`,
      dica: 'resource "aws_iam_instance_profile" "app" { ... }',
      inicial: comAws(ROLE_EC2),
      solucao: comAws(ROLE_EC2, tf`
        resource "aws_iam_instance_profile" "app" {
          name = "app-perfil"
          role = aws_iam_role.app.name
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'aws_iam_instance_profile.app', atributo: 'name', igual: 'app-perfil' }, { recurso: 'aws_iam_instance_profile.app', atributo: 'role', igual: 'app-ec2' }] },
      ],
    }),

    problema({
      id: 'aws-iam-usuarios-turma',
      titulo: 'Usuários da turma com for_each',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie um <code>aws_iam_user "turma"</code> para cada nome de <code>var.usuarios</code>;</li>
          <li>use <code>for_each = toset(var.usuarios)</code> e <code>name = each.key</code>.</li>
        </ul>`,
      dica: 'for_each = toset(var.usuarios)',
      inicial: comAws(tf`
        variable "usuarios" {
          type    = list(string)
          default = ["ana", "bruno", "carla"]
        }
      `),
      solucao: comAws(tf`
        variable "usuarios" {
          type    = list(string)
          default = ["ana", "bruno", "carla"]
        }

        resource "aws_iam_user" "turma" {
          for_each = toset(var.usuarios)
          name     = each.key
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { instancias: 'aws_iam_user.turma', quantidade: 3 }, { recurso: 'aws_iam_user.turma["bruno"]', atributo: 'name', igual: 'bruno' }] },
        { oculto: true, descricao: 'outra turma', variaveis: { usuarios: ['davi', 'elis'] }, regras: [{ instancias: 'aws_iam_user.turma', quantidade: 2 }] },
      ],
    }),

    licao({
      id: 'licao-aws-rede',
      titulo: 'Rede: VPC, sub-redes, rotas e security groups',
      resumo: `
        <p>Pense na <b>VPC</b> como um condomínio fechado com a faixa de endereços <code>10.0.0.0/16</code>:</p>
        <ul>
          <li><b>sub-redes</b> são as ruas, cada uma numa <b>zona de disponibilidade</b> (<code>us-east-1a</code>...);</li>
          <li>o <b>internet gateway</b> é o portão para a internet;</li>
          <li>a <b>tabela de rotas</b> são as placas: "para a internet (<code>0.0.0.0/0</code>), vá pelo portão";</li>
          <li>o <b>NAT gateway</b> deixa as sub-redes privadas saírem sem serem acessadas de fora;</li>
          <li>o <b>security group</b> é a lista de convidados de cada máquina (portas e origens permitidas).</li>
        </ul>
        <p>Veja na aba <b>🕸️ Grafo</b> como tudo depende da VPC.</p>`,
      codigo: comAws(VPC, IGW, SUBNET_PUBLICA, tf`
        resource "aws_route_table" "publica" {
          vpc_id = aws_vpc.principal.id

          route {
            cidr_block = "0.0.0.0/0"
            gateway_id = aws_internet_gateway.igw.id
          }
        }

        resource "aws_route_table_association" "publica" {
          subnet_id      = aws_subnet.publica.id
          route_table_id = aws_route_table.publica.id
        }
      `),
    }),

    problema({
      id: 'aws-vpc',
      titulo: 'Sua primeira VPC',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>aws_vpc "principal"</code> com <code>cidr_block = "10.0.0.0/16"</code>;</li>
          <li>com <code>enable_dns_hostnames = true</code>;</li>
          <li>e a tag <code>Name = "vpc-aula"</code>.</li>
        </ul>`,
      dica: 'resource "aws_vpc" "principal" { cidr_block = "10.0.0.0/16" ... }',
      inicial: comAws(tf`
        # resource "aws_vpc" "principal" { ... }
      `),
      solucao: comAws(VPC),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_vpc.principal', atributo: 'cidr_block', igual: '10.0.0.0/16' },
            { recurso: 'aws_vpc.principal', atributo: 'enable_dns_hostnames', igual: true },
            { recurso: 'aws_vpc.principal', atributo: 'tags.Name', igual: 'vpc-aula' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_vpc.principal', atributo: 'id', regex: '^vpc-' }] },
      ],
    }),

    problema({
      id: 'aws-subnet',
      titulo: 'Uma sub-rede pública',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>aws_subnet "publica"</code> dentro da VPC: <code>vpc_id = aws_vpc.principal.id</code>;</li>
          <li>com <code>cidr_block = "10.0.1.0/24"</code> e <code>availability_zone = "us-east-1a"</code>;</li>
          <li>e <code>map_public_ip_on_launch = true</code> (máquinas ganham IP público).</li>
        </ul>`,
      dica: 'vpc_id = aws_vpc.principal.id',
      inicial: comAws(VPC),
      solucao: comAws(VPC, SUBNET_PUBLICA),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_subnet.publica', atributo: 'vpc_id', referencia: 'aws_vpc.principal.id' },
            { recurso: 'aws_subnet.publica', atributo: 'cidr_block', igual: '10.0.1.0/24' },
            { recurso: 'aws_subnet.publica', atributo: 'map_public_ip_on_launch', igual: true },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-igw',
      titulo: 'Internet gateway',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>aws_internet_gateway "igw"</code> ligado à VPC: <code>vpc_id = aws_vpc.principal.id</code>.</li>
        </ul>`,
      dica: 'resource "aws_internet_gateway" "igw" { vpc_id = ... }',
      inicial: comAws(VPC),
      solucao: comAws(VPC, IGW),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'aws_internet_gateway.igw', atributo: 'vpc_id', referencia: 'aws_vpc.principal.id' }] },
      ],
    }),

    problema({
      id: 'aws-rotas',
      titulo: 'Tabela de rotas para a internet',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_route_table "publica"</code> na VPC com um bloco <code>route</code>;</li>
          <li>a rota: <code>cidr_block = "0.0.0.0/0"</code> (qualquer destino) e <code>gateway_id = aws_internet_gateway.igw.id</code>;</li>
          <li>associe à sub-rede com <code>aws_route_table_association "publica"</code> (<code>subnet_id</code> e <code>route_table_id</code>).</li>
        </ul>`,
      dica: 'route { cidr_block = "0.0.0.0/0"  gateway_id = aws_internet_gateway.igw.id }',
      inicial: comAws(VPC, IGW, SUBNET_PUBLICA),
      solucao: comAws(VPC, IGW, SUBNET_PUBLICA, tf`
        resource "aws_route_table" "publica" {
          vpc_id = aws_vpc.principal.id

          route {
            cidr_block = "0.0.0.0/0"
            gateway_id = aws_internet_gateway.igw.id
          }
        }

        resource "aws_route_table_association" "publica" {
          subnet_id      = aws_subnet.publica.id
          route_table_id = aws_route_table.publica.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_route_table.publica', atributo: 'route.0.cidr_block', igual: '0.0.0.0/0' },
            { recurso: 'aws_route_table.publica', atributo: 'route.0.gateway_id', referencia: 'aws_internet_gateway.igw.id' },
            { recurso: 'aws_route_table_association.publica', atributo: 'subnet_id', referencia: 'aws_subnet.publica.id' },
            { recurso: 'aws_route_table_association.publica', atributo: 'route_table_id', referencia: 'aws_route_table.publica.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-subnets-azs',
      titulo: 'Uma sub-rede por zona',
      dificuldade: 'medio',
      enunciado: `
        <p>Para não depender de um data center só, espalhe as sub-redes pelas zonas da região.</p>
        <ul>
          <li>crie <code>data "aws_availability_zones" "disponiveis"</code> com <code>state = "available"</code>;</li>
          <li>crie <code>aws_subnet "publica"</code> com <code>count = 3</code>;</li>
          <li><code>cidr_block = cidrsubnet(aws_vpc.principal.cidr_block, 8, count.index)</code>;</li>
          <li><code>availability_zone = data.aws_availability_zones.disponiveis.names[count.index]</code>.</li>
        </ul>`,
      dica: 'names[count.index] pega a zona da vez',
      inicial: comAws(VPC),
      solucao: comAws(VPC, tf`
        data "aws_availability_zones" "disponiveis" {
          state = "available"
        }

        resource "aws_subnet" "publica" {
          count             = 3
          vpc_id            = aws_vpc.principal.id
          cidr_block        = cidrsubnet(aws_vpc.principal.cidr_block, 8, count.index)
          availability_zone = data.aws_availability_zones.disponiveis.names[count.index]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { instancias: 'aws_subnet.publica', quantidade: 3 },
            { recurso: 'aws_subnet.publica[2]', atributo: 'cidr_block', igual: '10.0.2.0/24' },
            { recurso: 'aws_subnet.publica[1]', atributo: 'availability_zone', igual: 'us-east-1b' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-subnets-mapa',
      titulo: 'Sub-redes a partir de um mapa',
      dificuldade: 'dificil',
      enunciado: `
        <p>Cada camada da aplicação tem a sua sub-rede. A variável <code>subredes</code> já descreve as três.</p>
        <ul>
          <li>crie <code>aws_subnet "rede"</code> com <code>for_each = var.subredes</code>;</li>
          <li>use <code>each.value.cidr</code> no <code>cidr_block</code> e <code>each.value.publica</code> no <code>map_public_ip_on_launch</code>;</li>
          <li>a tag <code>Name</code> deve ser <code>each.key</code>;</li>
          <li>crie <code>output "publicas"</code> com os nomes das sub-redes públicas:
            <code>[for nome, s in aws_subnet.rede : nome if s.map_public_ip_on_launch]</code>.</li>
        </ul>`,
      dica: 'each.value é o objeto { cidr, publica } da vez',
      inicial: comAws(VPC, tf`
        variable "subredes" {
          type = map(object({
            cidr    = string
            publica = bool
          }))
          default = {
            web = { cidr = "10.0.1.0/24", publica = true }
            app = { cidr = "10.0.2.0/24", publica = false }
            db  = { cidr = "10.0.3.0/24", publica = false }
          }
        }
      `),
      solucao: comAws(VPC, tf`
        variable "subredes" {
          type = map(object({
            cidr    = string
            publica = bool
          }))
          default = {
            web = { cidr = "10.0.1.0/24", publica = true }
            app = { cidr = "10.0.2.0/24", publica = false }
            db  = { cidr = "10.0.3.0/24", publica = false }
          }
        }

        resource "aws_subnet" "rede" {
          for_each                = var.subredes
          vpc_id                  = aws_vpc.principal.id
          cidr_block              = each.value.cidr
          map_public_ip_on_launch = each.value.publica

          tags = {
            Name = each.key
          }
        }

        output "publicas" {
          value = [for nome, s in aws_subnet.rede : nome if s.map_public_ip_on_launch]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { instancias: 'aws_subnet.rede', quantidade: 3 },
            { recurso: 'aws_subnet.rede["db"]', atributo: 'cidr_block', igual: '10.0.3.0/24' },
            { recurso: 'aws_subnet.rede["web"]', atributo: 'tags.Name', igual: 'web' },
            { saida: 'publicas', igual: ['web'] },
          ],
        },
        {
          oculto: true,
          descricao: 'duas públicas',
          variaveis: { subredes: { a: { cidr: '10.0.10.0/24', publica: true }, b: { cidr: '10.0.11.0/24', publica: true } } },
          regras: [{ saida: 'publicas', igual: ['a', 'b'] }],
        },
      ],
    }),

    problema({
      id: 'aws-nat',
      titulo: 'NAT gateway para as sub-redes privadas',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie um IP elástico: <code>aws_eip "nat"</code> com <code>domain = "vpc"</code>;</li>
          <li>crie <code>aws_nat_gateway "nat"</code> na sub-rede pública, com <code>allocation_id = aws_eip.nat.id</code>;</li>
          <li>o NAT só funciona depois do internet gateway: acrescente <code>depends_on = [aws_internet_gateway.igw]</code>.</li>
        </ul>`,
      dica: 'allocation_id = aws_eip.nat.id e subnet_id = aws_subnet.publica.id',
      inicial: comAws(VPC, IGW, SUBNET_PUBLICA),
      solucao: comAws(VPC, IGW, SUBNET_PUBLICA, tf`
        resource "aws_eip" "nat" {
          domain = "vpc"
        }

        resource "aws_nat_gateway" "nat" {
          allocation_id = aws_eip.nat.id
          subnet_id     = aws_subnet.publica.id

          depends_on = [aws_internet_gateway.igw]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_eip.nat', atributo: 'domain', igual: 'vpc' },
            { recurso: 'aws_nat_gateway.nat', atributo: 'allocation_id', referencia: 'aws_eip.nat.id' },
            { recurso: 'aws_nat_gateway.nat', atributo: 'subnet_id', referencia: 'aws_subnet.publica.id' },
            { meta: 'aws_nat_gateway.nat', dependsOn: 'aws_internet_gateway.igw' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-security-group',
      titulo: 'Security group de um servidor web',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_security_group "web"</code> com <code>name = "web"</code> na VPC;</li>
          <li>dois blocos <code>ingress</code>: portas <code>80</code> e <code>443</code>, <code>protocol = "tcp"</code>,
            <code>cidr_blocks = ["0.0.0.0/0"]</code>;</li>
          <li>um bloco <code>egress</code> liberando tudo: portas <code>0</code> a <code>0</code> e <code>protocol = "-1"</code>.</li>
        </ul>`,
      dica: 'Cada ingress tem from_port, to_port, protocol e cidr_blocks',
      inicial: comAws(VPC),
      solucao: comAws(VPC, tf`
        resource "aws_security_group" "web" {
          name   = "web"
          vpc_id = aws_vpc.principal.id

          ingress {
            from_port   = 80
            to_port     = 80
            protocol    = "tcp"
            cidr_blocks = ["0.0.0.0/0"]
          }

          ingress {
            from_port   = 443
            to_port     = 443
            protocol    = "tcp"
            cidr_blocks = ["0.0.0.0/0"]
          }

          egress {
            from_port   = 0
            to_port     = 0
            protocol    = "-1"
            cidr_blocks = ["0.0.0.0/0"]
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_security_group.web', atributo: 'ingress', tamanho: 2 },
            { recurso: 'aws_security_group.web', atributo: 'ingress.1.from_port', igual: 443 },
            { recurso: 'aws_security_group.web', atributo: 'egress.0.protocol', igual: '-1' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-sg-dinamico',
      titulo: 'Portas a partir de uma lista (dynamic)',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>no <code>aws_security_group "web"</code>, troque os ingress fixos por um <code>dynamic "ingress"</code>;</li>
          <li>com <code>for_each = var.portas</code> e, no <code>content</code>, <code>from_port</code> e <code>to_port</code>
            iguais a <code>ingress.value</code>, <code>protocol = "tcp"</code> e <code>cidr_blocks = ["0.0.0.0/0"]</code>.</li>
        </ul>`,
      dica: 'dynamic "ingress" { for_each = var.portas  content { ... } }',
      inicial: comAws(VPC, tf`
        variable "portas" {
          type    = list(number)
          default = [22, 80, 443]
        }

        resource "aws_security_group" "web" {
          name   = "web"
          vpc_id = aws_vpc.principal.id

          ingress {
            from_port   = 22
            to_port     = 22
            protocol    = "tcp"
            cidr_blocks = ["0.0.0.0/0"]
          }
        }
      `),
      solucao: comAws(VPC, tf`
        variable "portas" {
          type    = list(number)
          default = [22, 80, 443]
        }

        resource "aws_security_group" "web" {
          name   = "web"
          vpc_id = aws_vpc.principal.id

          dynamic "ingress" {
            for_each = var.portas
            content {
              from_port   = ingress.value
              to_port     = ingress.value
              protocol    = "tcp"
              cidr_blocks = ["0.0.0.0/0"]
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { meta: 'aws_security_group.web', dinamico: 'ingress' },
            { recurso: 'aws_security_group.web', atributo: 'ingress', tamanho: 3 },
            { recurso: 'aws_security_group.web', atributo: 'ingress.2.to_port', igual: 443 },
          ],
        },
        { oculto: true, descricao: 'outra lista de portas', variaveis: { portas: [8080] }, regras: [{ recurso: 'aws_security_group.web', atributo: 'ingress', tamanho: 1 }] },
      ],
    }),

    problema({
      id: 'aws-sg-regras',
      titulo: 'Regras de security group separadas',
      dificuldade: 'medio',
      enunciado: `
        <p>A forma recomendada hoje é criar cada regra como um recurso próprio.</p>
        <ul>
          <li>crie <code>aws_vpc_security_group_ingress_rule "https"</code> para o security group <code>web</code>:
            <code>ip_protocol = "tcp"</code>, portas <code>443</code> e <code>cidr_ipv4 = "0.0.0.0/0"</code>;</li>
          <li>crie <code>aws_vpc_security_group_egress_rule "tudo"</code> com <code>ip_protocol = "-1"</code> e <code>cidr_ipv4 = "0.0.0.0/0"</code>.</li>
        </ul>`,
      dica: 'security_group_id = aws_security_group.web.id',
      inicial: comAws(VPC, tf`
        resource "aws_security_group" "web" {
          name   = "web"
          vpc_id = aws_vpc.principal.id
        }
      `),
      solucao: comAws(VPC, tf`
        resource "aws_security_group" "web" {
          name   = "web"
          vpc_id = aws_vpc.principal.id
        }

        resource "aws_vpc_security_group_ingress_rule" "https" {
          security_group_id = aws_security_group.web.id
          ip_protocol       = "tcp"
          from_port         = 443
          to_port           = 443
          cidr_ipv4         = "0.0.0.0/0"
        }

        resource "aws_vpc_security_group_egress_rule" "tudo" {
          security_group_id = aws_security_group.web.id
          ip_protocol       = "-1"
          cidr_ipv4         = "0.0.0.0/0"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_vpc_security_group_ingress_rule.https', atributo: 'security_group_id', referencia: 'aws_security_group.web.id' },
            { recurso: 'aws_vpc_security_group_ingress_rule.https', atributo: 'from_port', igual: 443 },
            { recurso: 'aws_vpc_security_group_egress_rule.tudo', atributo: 'ip_protocol', igual: '-1' },
          ],
        },
      ],
    }),

    licao({
      id: 'licao-aws-ec2',
      titulo: 'EC2, load balancer e auto scaling',
      resumo: `
        <p>Uma <b>instância EC2</b> é uma máquina virtual. Ela precisa de:</p>
        <ul>
          <li>uma <b>AMI</b> (a imagem do sistema operacional). Em vez de copiar o ID, use o data source
            <code>aws_ami</code>, que acha a mais recente;</li>
          <li>um <b>instance_type</b> (o tamanho): <code>t3.micro</code> é pequeno e barato;</li>
          <li>a sub-rede e o security group onde ela vai ficar.</li>
        </ul>
        <p>Para ter alta disponibilidade, use um <b>load balancer</b> (ALB) na frente de várias máquinas e um
        <b>Auto Scaling Group</b>, que liga e desliga máquinas conforme a demanda.</p>`,
      codigo: comAws(AMI, tf`
        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"

          tags = {
            Name = "servidor-web"
          }
        }

        output "ip_publico" {
          value = aws_instance.web.public_ip
        }
      `),
    }),

    problema({
      id: 'aws-ami',
      titulo: 'Achando a AMI mais recente',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>data "aws_ami" "ubuntu"</code> com <code>most_recent = true</code> e <code>owners = ["099720109477"]</code> (a Canonical);</li>
          <li>com um <code>filter</code>: <code>name = "name"</code> e
            <code>values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]</code>;</li>
          <li>crie <code>output "ami"</code> com <code>data.aws_ami.ubuntu.id</code>.</li>
        </ul>`,
      dica: 'data "aws_ami" "ubuntu" { most_recent = true ... filter { ... } }',
      inicial: comAws(tf`
        # data "aws_ami" "ubuntu" { ... }
      `),
      solucao: comAws(AMI, tf`
        output "ami" {
          value = data.aws_ami.ubuntu.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { dado: 'aws_ami.ubuntu', atributo: 'most_recent', igual: true },
            { dado: 'aws_ami.ubuntu', atributo: 'owners', igual: ['099720109477'] },
            { saida: 'ami', regex: '^ami-[0-9a-f]+$' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-ec2',
      titulo: 'Sua primeira instância EC2',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>aws_instance "web"</code> com <code>ami = data.aws_ami.ubuntu.id</code>;</li>
          <li>e <code>instance_type = "t3.micro"</code>;</li>
          <li>com a tag <code>Name = "servidor-web"</code>.</li>
        </ul>`,
      dica: 'ami = data.aws_ami.ubuntu.id',
      inicial: comAws(AMI),
      solucao: comAws(AMI, tf`
        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"

          tags = {
            Name = "servidor-web"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_instance.web', atributo: 'instance_type', igual: 't3.micro' },
            { recurso: 'aws_instance.web', atributo: 'ami', regex: '^ami-' },
            { recurso: 'aws_instance.web', atributo: 'tags.Name', igual: 'servidor-web' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_instance.web', atributo: 'public_ip', regex: '^\\d+\\.\\d+\\.\\d+\\.\\d+$' }] },
      ],
    }),

    problema({
      id: 'aws-ec2-rede',
      titulo: 'Instância na sua rede',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>coloque a <code>aws_instance "web"</code> na sub-rede pública: <code>subnet_id = aws_subnet.publica.id</code>;</li>
          <li>e no security group: <code>vpc_security_group_ids = [aws_security_group.web.id]</code>.</li>
        </ul>`,
      dica: 'vpc_security_group_ids é uma lista',
      inicial: comAws(VPC, SUBNET_PUBLICA, SG_WEB, AMI, tf`
        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"
        }
      `),
      solucao: comAws(VPC, SUBNET_PUBLICA, SG_WEB, AMI, tf`
        resource "aws_instance" "web" {
          ami                    = data.aws_ami.ubuntu.id
          instance_type          = "t3.micro"
          subnet_id              = aws_subnet.publica.id
          vpc_security_group_ids = [aws_security_group.web.id]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_instance.web', atributo: 'subnet_id', referencia: 'aws_subnet.publica.id' },
            { recurso: 'aws_instance.web', atributo: 'vpc_security_group_ids.0', referencia: 'aws_security_group.web.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-user-data',
      titulo: 'Script de inicialização (user_data)',
      dificuldade: 'medio',
      enunciado: `
        <p>O arquivo <code>instalar.sh.tpl</code> instala um servidor web. Ele tem uma lacuna <code>\${porta}</code>.</p>
        <ul>
          <li>na instância, use <code>user_data = templatefile("instalar.sh.tpl", { porta = 8080 })</code>;</li>
          <li>e <code>user_data_replace_on_change = true</code> (mudar o script recria a máquina).</li>
        </ul>`,
      dica: 'templatefile("instalar.sh.tpl", { porta = 8080 })',
      inicial: {
        'main.tf': comAws(AMI, tf`
          resource "aws_instance" "web" {
            ami           = data.aws_ami.ubuntu.id
            instance_type = "t3.micro"
          }
        `),
        'instalar.sh.tpl': '#!/bin/bash\napt-get update\napt-get install -y nginx\necho "porta ${porta}" > /etc/porta-do-app\n',
      },
      solucao: {
        'main.tf': comAws(AMI, tf`
          resource "aws_instance" "web" {
            ami                         = data.aws_ami.ubuntu.id
            instance_type               = "t3.micro"
            user_data                   = templatefile("instalar.sh.tpl", { porta = 8080 })
            user_data_replace_on_change = true
          }
        `),
        'instalar.sh.tpl': '#!/bin/bash\napt-get update\napt-get install -y nginx\necho "porta ${porta}" > /etc/porta-do-app\n',
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_instance.web', atributo: 'user_data', contem: 'porta 8080' },
            { recurso: 'aws_instance.web', atributo: 'user_data_replace_on_change', igual: true },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-key-pair',
      titulo: 'Par de chaves SSH',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>gere uma chave com <code>tls_private_key "chave"</code> e <code>algorithm = "ED25519"</code>;</li>
          <li>crie <code>aws_key_pair "chave"</code> com <code>key_name = "aula"</code> e
            <code>public_key = tls_private_key.chave.public_key_openssh</code>;</li>
          <li>use <code>key_name = aws_key_pair.chave.key_name</code> na instância;</li>
          <li>crie <code>output "chave_privada"</code> com <code>tls_private_key.chave.private_key_openssh</code> (sensível!).</li>
        </ul>`,
      dica: 'A chave privada é segredo: output com sensitive = true',
      inicial: comAws(AMI, tf`
        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"
        }
      `),
      solucao: comAws(AMI, tf`
        resource "tls_private_key" "chave" {
          algorithm = "ED25519"
        }

        resource "aws_key_pair" "chave" {
          key_name   = "aula"
          public_key = tls_private_key.chave.public_key_openssh
        }

        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"
          key_name      = aws_key_pair.chave.key_name
        }

        output "chave_privada" {
          value     = tls_private_key.chave.private_key_openssh
          sensitive = true
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_key_pair.chave', atributo: 'public_key', referencia: 'tls_private_key.chave.public_key_openssh' },
            { recurso: 'aws_instance.web', atributo: 'key_name', igual: 'aula' },
            { saida: 'chave_privada', sensivel: true },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-ebs',
      titulo: 'Um disco extra (EBS)',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_ebs_volume "dados"</code> na mesma zona da instância
            (<code>availability_zone = aws_instance.web.availability_zone</code>), com <code>size = 20</code> e <code>type = "gp3"</code>;</li>
          <li>ligue na instância com <code>aws_volume_attachment "dados"</code>: <code>device_name = "/dev/sdf"</code>,
            <code>volume_id</code> e <code>instance_id</code>.</li>
        </ul>`,
      dica: 'O disco e a máquina precisam estar na mesma zona',
      inicial: comAws(AMI, tf`
        resource "aws_instance" "web" {
          ami               = data.aws_ami.ubuntu.id
          instance_type     = "t3.micro"
          availability_zone = "us-east-1a"
        }
      `),
      solucao: comAws(AMI, tf`
        resource "aws_instance" "web" {
          ami               = data.aws_ami.ubuntu.id
          instance_type     = "t3.micro"
          availability_zone = "us-east-1a"
        }

        resource "aws_ebs_volume" "dados" {
          availability_zone = aws_instance.web.availability_zone
          size              = 20
          type              = "gp3"
        }

        resource "aws_volume_attachment" "dados" {
          device_name = "/dev/sdf"
          volume_id   = aws_ebs_volume.dados.id
          instance_id = aws_instance.web.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_ebs_volume.dados', atributo: 'availability_zone', igual: 'us-east-1a' },
            { recurso: 'aws_ebs_volume.dados', atributo: 'size', igual: 20 },
            { recurso: 'aws_volume_attachment.dados', atributo: 'volume_id', referencia: 'aws_ebs_volume.dados.id' },
            { recurso: 'aws_volume_attachment.dados', atributo: 'instance_id', referencia: 'aws_instance.web.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-ec2-count',
      titulo: 'Várias instâncias e seus IPs',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>a <code>aws_instance "web"</code> deve ter <code>count = var.quantidade</code>;</li>
          <li>crie <code>output "ips"</code> com o IP público de todas: <code>aws_instance.web[*].public_ip</code>.</li>
        </ul>`,
      dica: 'count = var.quantidade',
      inicial: comAws(AMI, tf`
        variable "quantidade" {
          type    = number
          default = 2
        }

        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"
        }
      `),
      solucao: comAws(AMI, tf`
        variable "quantidade" {
          type    = number
          default = 2
        }

        resource "aws_instance" "web" {
          count         = var.quantidade
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"
        }

        output "ips" {
          value = aws_instance.web[*].public_ip
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { instancias: 'aws_instance.web', quantidade: 2 }, { saida: 'ips', tamanho: 2 }] },
        { oculto: true, descricao: 'quatro servidores', variaveis: { quantidade: 4 }, regras: [{ instancias: 'aws_instance.web', quantidade: 4 }, { saida: 'ips', tamanho: 4 }] },
      ],
    }),

    problema({
      id: 'aws-tipo-validado',
      titulo: 'Só instâncias da família t3',
      dificuldade: 'medio',
      enunciado: `
        <p>Para controlar custos, o time só permite máquinas da família <code>t3</code>.</p>
        <ul>
          <li>na <code>variable "tipo_instancia"</code>, crie um bloco <code>validation</code>;</li>
          <li>com <code>condition = can(regex("^t3\\\\.", var.tipo_instancia))</code> e uma <code>error_message</code>;</li>
          <li>use a variável no <code>instance_type</code>.</li>
        </ul>`,
      dica: 'can(regex(...)) dá true ou false, sem quebrar',
      inicial: comAws(AMI, tf`
        variable "tipo_instancia" {
          type    = string
          default = "t3.micro"
        }

        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"
        }
      `),
      solucao: comAws(AMI, tf`
        variable "tipo_instancia" {
          type    = string
          default = "t3.micro"

          validation {
            condition     = can(regex("^t3\\.", var.tipo_instancia))
            error_message = "Use uma instância da família t3 (ex.: t3.micro)."
          }
        }

        resource "aws_instance" "web" {
          ami           = data.aws_ami.ubuntu.id
          instance_type = var.tipo_instancia
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { variavel: 'tipo_instancia', validacao: true }, { recurso: 'aws_instance.web', atributo: 'instance_type', igual: 't3.micro' }] },
        { descricao: 'tipo_instancia = "m5.large"', variaveis: { tipo_instancia: 'm5.large' }, regras: [{ erro: 'Invalid value for variable', msg: 'm5.large é recusado' }] },
        { oculto: true, descricao: 'tipo_instancia = "t3.small"', variaveis: { tipo_instancia: 't3.small' }, regras: [{ semErros: true }, { recurso: 'aws_instance.web', atributo: 'instance_type', igual: 't3.small' }] },
      ],
    }),

    problema({
      id: 'aws-asg',
      titulo: 'Launch template e Auto Scaling',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>aws_launch_template "web"</code> com <code>name_prefix = "web-"</code>,
            <code>image_id = data.aws_ami.ubuntu.id</code> e <code>instance_type = "t3.micro"</code>;</li>
          <li>crie <code>aws_autoscaling_group "web"</code> com <code>min_size = 2</code>, <code>max_size = 5</code> e
            <code>desired_capacity = 2</code>;</li>
          <li>nas sub-redes <code>a</code> e <code>b</code>: <code>vpc_zone_identifier = [aws_subnet.a.id, aws_subnet.b.id]</code>;</li>
          <li>com <code>launch_template { id = aws_launch_template.web.id  version = "$Latest" }</code>.</li>
        </ul>`,
      dica: 'O ASG usa o launch template como "molde" das máquinas',
      inicial: comAws(VPC, DUAS_SUBNETS, AMI),
      solucao: comAws(VPC, DUAS_SUBNETS, AMI, tf`
        resource "aws_launch_template" "web" {
          name_prefix   = "web-"
          image_id      = data.aws_ami.ubuntu.id
          instance_type = "t3.micro"
        }

        resource "aws_autoscaling_group" "web" {
          min_size            = 2
          max_size            = 5
          desired_capacity    = 2
          vpc_zone_identifier = [aws_subnet.a.id, aws_subnet.b.id]

          launch_template {
            id      = aws_launch_template.web.id
            version = "$Latest"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_autoscaling_group.web', atributo: 'min_size', igual: 2 },
            { recurso: 'aws_autoscaling_group.web', atributo: 'max_size', igual: 5 },
            { recurso: 'aws_autoscaling_group.web', atributo: 'launch_template.0.id', referencia: 'aws_launch_template.web.id' },
            { recurso: 'aws_autoscaling_group.web', atributo: 'launch_template.0.version', igual: '$Latest' },
            { recurso: 'aws_autoscaling_group.web', atributo: 'vpc_zone_identifier', tamanho: 2 },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-alb',
      titulo: 'Application Load Balancer',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>aws_lb "web"</code> com <code>name = "web-alb"</code>, <code>load_balancer_type = "application"</code>,
            as sub-redes <code>a</code> e <code>b</code> e o security group <code>web</code>;</li>
          <li>crie <code>aws_lb_target_group "web"</code> com <code>name = "web-tg"</code>, <code>port = 80</code>,
            <code>protocol = "HTTP"</code>, a VPC e <code>health_check { path = "/" }</code>;</li>
          <li>crie <code>aws_lb_listener "http"</code> na porta <code>80</code>, com
            <code>default_action { type = "forward"  target_group_arn = aws_lb_target_group.web.arn }</code>;</li>
          <li>crie <code>output "dns"</code> com <code>aws_lb.web.dns_name</code>.</li>
        </ul>`,
      dica: 'O listener recebe na porta 80 e encaminha (forward) para o target group',
      inicial: comAws(VPC, DUAS_SUBNETS, SG_WEB),
      solucao: comAws(VPC, DUAS_SUBNETS, SG_WEB, tf`
        resource "aws_lb" "web" {
          name               = "web-alb"
          load_balancer_type = "application"
          subnets            = [aws_subnet.a.id, aws_subnet.b.id]
          security_groups    = [aws_security_group.web.id]
        }

        resource "aws_lb_target_group" "web" {
          name     = "web-tg"
          port     = 80
          protocol = "HTTP"
          vpc_id   = aws_vpc.principal.id

          health_check {
            path = "/"
          }
        }

        resource "aws_lb_listener" "http" {
          load_balancer_arn = aws_lb.web.arn
          port              = 80
          protocol          = "HTTP"

          default_action {
            type             = "forward"
            target_group_arn = aws_lb_target_group.web.arn
          }
        }

        output "dns" {
          value = aws_lb.web.dns_name
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_lb.web', atributo: 'load_balancer_type', igual: 'application' },
            { recurso: 'aws_lb_target_group.web', atributo: 'health_check.0.path', igual: '/' },
            { recurso: 'aws_lb_listener.http', atributo: 'default_action.0.type', igual: 'forward' },
            { recurso: 'aws_lb_listener.http', atributo: 'default_action.0.target_group_arn', referencia: 'aws_lb_target_group.web.arn' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'dns', contem: 'elb.amazonaws.com' }] },
      ],
    }),

    licao({
      id: 'licao-aws-dados-serverless',
      titulo: 'Bancos de dados e serverless',
      resumo: `
        <p>Para guardar dados:</p>
        <ul>
          <li><b>RDS</b>: banco relacional gerenciado (PostgreSQL, MySQL). A AWS cuida de backup e atualização.
            Use <code>manage_master_user_password = true</code> para a senha ficar no Secrets Manager.</li>
          <li><b>DynamoDB</b>: banco NoSQL sem servidor, pago por uso (<code>PAY_PER_REQUEST</code>).</li>
        </ul>
        <p>Para rodar código sem servidor (<b>serverless</b>):</p>
        <ul>
          <li><b>Lambda</b>: a função; o código vai num .zip (use o data source <code>archive_file</code>);</li>
          <li><b>API Gateway</b>: a porta HTTP da API, que chama a Lambda;</li>
          <li><b>SQS</b> (filas) e <b>SNS</b> (avisos) ligam os serviços entre si.</li>
        </ul>`,
      codigo: comAws(tf`
        resource "aws_dynamodb_table" "pedidos" {
          name         = "pedidos"
          billing_mode = "PAY_PER_REQUEST"
          hash_key     = "id"

          attribute {
            name = "id"
            type = "S"
          }
        }

        resource "aws_sqs_queue" "novos_pedidos" {
          name = "novos-pedidos"
        }

        output "tabela" {
          value = aws_dynamodb_table.pedidos.arn
        }
      `),
    }),

    problema({
      id: 'aws-rds',
      titulo: 'Banco PostgreSQL no RDS',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_db_subnet_group "banco"</code> com <code>name = "banco"</code> e as sub-redes <code>a</code> e <code>b</code>;</li>
          <li>crie <code>aws_db_instance "banco"</code>: <code>identifier = "loja-db"</code>, <code>engine = "postgres"</code>,
            <code>instance_class = "db.t4g.micro"</code>, <code>allocated_storage = 20</code>, <code>db_name = "loja"</code>,
            <code>username = "admin_loja"</code>;</li>
          <li>com <code>manage_master_user_password = true</code>, <code>db_subnet_group_name = aws_db_subnet_group.banco.name</code>
            e <code>skip_final_snapshot = true</code>.</li>
        </ul>`,
      dica: 'manage_master_user_password = true: a senha fica no Secrets Manager',
      inicial: comAws(VPC, DUAS_SUBNETS),
      solucao: comAws(VPC, DUAS_SUBNETS, tf`
        resource "aws_db_subnet_group" "banco" {
          name       = "banco"
          subnet_ids = [aws_subnet.a.id, aws_subnet.b.id]
        }

        resource "aws_db_instance" "banco" {
          identifier                  = "loja-db"
          engine                      = "postgres"
          engine_version              = "16.4"
          instance_class              = "db.t4g.micro"
          allocated_storage           = 20
          db_name                     = "loja"
          username                    = "admin_loja"
          manage_master_user_password = true
          db_subnet_group_name        = aws_db_subnet_group.banco.name
          skip_final_snapshot         = true
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_db_instance.banco', atributo: 'engine', igual: 'postgres' },
            { recurso: 'aws_db_instance.banco', atributo: 'manage_master_user_password', igual: true },
            { recurso: 'aws_db_instance.banco', atributo: 'db_subnet_group_name', igual: 'banco' },
            { recurso: 'aws_db_subnet_group.banco', atributo: 'subnet_ids', tamanho: 2 },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'aws_db_instance.banco', atributo: 'port', igual: 5432 }] },
      ],
    }),

    problema({
      id: 'aws-rds-senha',
      titulo: 'Senha do banco gerada pelo Terraform',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>random_password "banco"</code> com <code>length = 20</code> e <code>override_special = "!#%"</code>;</li>
          <li>no <code>aws_db_instance "banco"</code>, use <code>password = random_password.banco.result</code>;</li>
          <li>crie <code>output "endereco"</code> com <code>aws_db_instance.banco.address</code>;</li>
          <li>crie <code>output "senha"</code> com a senha, marcado como sensível.</li>
        </ul>`,
      dica: 'random_password já é sensível: o output precisa de sensitive = true',
      inicial: comAws(tf`
        resource "aws_db_instance" "banco" {
          identifier          = "loja-db"
          engine              = "mysql"
          instance_class      = "db.t4g.micro"
          allocated_storage   = 20
          username            = "admin_loja"
          skip_final_snapshot = true
        }
      `),
      solucao: comAws(tf`
        resource "random_password" "banco" {
          length           = 20
          override_special = "!#%"
        }

        resource "aws_db_instance" "banco" {
          identifier          = "loja-db"
          engine              = "mysql"
          instance_class      = "db.t4g.micro"
          allocated_storage   = 20
          username            = "admin_loja"
          password            = random_password.banco.result
          skip_final_snapshot = true
        }

        output "endereco" {
          value = aws_db_instance.banco.address
        }

        output "senha" {
          value     = random_password.banco.result
          sensitive = true
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'random_password.banco', atributo: 'length', igual: 20 },
            { recurso: 'aws_db_instance.banco', atributo: 'password', referencia: 'random_password.banco.result' },
            { saida: 'senha', sensivel: true },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'endereco', contem: 'rds.amazonaws.com' }] },
      ],
    }),

    problema({
      id: 'aws-dynamodb',
      titulo: 'Tabela no DynamoDB',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>aws_dynamodb_table "pedidos"</code> com <code>name = "pedidos"</code>;</li>
          <li><code>billing_mode = "PAY_PER_REQUEST"</code> e <code>hash_key = "id"</code>;</li>
          <li>declare a chave num bloco <code>attribute { name = "id"  type = "S" }</code> (S = texto).</li>
        </ul>`,
      dica: 'Todo hash_key precisa de um bloco attribute com o mesmo nome',
      inicial: comAws(tf`
        # resource "aws_dynamodb_table" "pedidos" { ... }
      `),
      solucao: comAws(tf`
        resource "aws_dynamodb_table" "pedidos" {
          name         = "pedidos"
          billing_mode = "PAY_PER_REQUEST"
          hash_key     = "id"

          attribute {
            name = "id"
            type = "S"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_dynamodb_table.pedidos', atributo: 'billing_mode', igual: 'PAY_PER_REQUEST' },
            { recurso: 'aws_dynamodb_table.pedidos', atributo: 'hash_key', igual: 'id' },
            { recurso: 'aws_dynamodb_table.pedidos', atributo: 'attribute.0.type', igual: 'S' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-dynamodb-ttl',
      titulo: 'DynamoDB com chave composta e TTL',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>a tabela <code>sessoes</code> usa <code>hash_key = "cliente"</code> e <code>range_key = "data"</code> (dois blocos <code>attribute</code>, ambos <code>"S"</code>);</li>
          <li>acrescente <code>ttl { attribute_name = "expira_em"  enabled = true }</code> para apagar itens vencidos;</li>
          <li>e <code>point_in_time_recovery { enabled = true }</code> para ter backup contínuo.</li>
        </ul>`,
      dica: 'Um bloco attribute para cada chave',
      inicial: comAws(tf`
        resource "aws_dynamodb_table" "sessoes" {
          name         = "sessoes"
          billing_mode = "PAY_PER_REQUEST"
          hash_key     = "cliente"

          attribute {
            name = "cliente"
            type = "S"
          }
        }
      `),
      solucao: comAws(tf`
        resource "aws_dynamodb_table" "sessoes" {
          name         = "sessoes"
          billing_mode = "PAY_PER_REQUEST"
          hash_key     = "cliente"
          range_key    = "data"

          attribute {
            name = "cliente"
            type = "S"
          }

          attribute {
            name = "data"
            type = "S"
          }

          ttl {
            attribute_name = "expira_em"
            enabled        = true
          }

          point_in_time_recovery {
            enabled = true
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_dynamodb_table.sessoes', atributo: 'range_key', igual: 'data' },
            { recurso: 'aws_dynamodb_table.sessoes', atributo: 'attribute', tamanho: 2 },
            { recurso: 'aws_dynamodb_table.sessoes', atributo: 'ttl.0.attribute_name', igual: 'expira_em' },
            { recurso: 'aws_dynamodb_table.sessoes', atributo: 'point_in_time_recovery.0.enabled', igual: true },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-lambda',
      titulo: 'Uma função Lambda em Python',
      dificuldade: 'medio',
      enunciado: `
        <p>O arquivo <code>app.py</code> tem a função. A Lambda recebe o código num .zip.</p>
        <ul>
          <li>crie <code>data "archive_file" "codigo"</code> com <code>type = "zip"</code>, <code>source_file = "app.py"</code> e <code>output_path = "app.zip"</code>;</li>
          <li>crie <code>aws_lambda_function "ola"</code>: <code>function_name = "ola"</code>, <code>role = aws_iam_role.lambda.arn</code>,
            <code>handler = "app.handler"</code>, <code>runtime = "python3.12"</code>;</li>
          <li>com <code>filename = data.archive_file.codigo.output_path</code> e
            <code>source_code_hash = data.archive_file.codigo.output_base64sha256</code> (para atualizar quando o código mudar).</li>
        </ul>`,
      dica: 'handler = "arquivo.função" → "app.handler"',
      inicial: { 'main.tf': comAws(ROLE_LAMBDA), 'app.py': APP_PY },
      solucao: { 'main.tf': comAws(ROLE_LAMBDA, LAMBDA), 'app.py': APP_PY },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_lambda_function.ola', atributo: 'runtime', igual: 'python3.12' },
            { recurso: 'aws_lambda_function.ola', atributo: 'handler', igual: 'app.handler' },
            { recurso: 'aws_lambda_function.ola', atributo: 'role', referencia: 'aws_iam_role.lambda.arn' },
            { recurso: 'aws_lambda_function.ola', atributo: 'filename', igual: 'app.zip' },
            { codigo: 'output_base64sha256', msg: 'O source_code_hash vem de output_base64sha256' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-lambda-role',
      titulo: 'Permissões da Lambda',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie a trust policy <code>data "aws_iam_policy_document" "assume_lambda"</code> com o principal
            <code>Service</code> <code>"lambda.amazonaws.com"</code>;</li>
          <li>crie <code>aws_iam_role "lambda"</code> com <code>name = "lambda-ola"</code> e essa política;</li>
          <li>anexe a política gerenciada <code>arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole</code>
            com <code>aws_iam_role_policy_attachment "logs"</code> (ela deixa a função escrever logs).</li>
        </ul>`,
      dica: 'Igual à role da EC2, trocando o serviço',
      inicial: comAws(tf`
        # data "aws_iam_policy_document" "assume_lambda" { ... }
      `),
      solucao: comAws(ROLE_LAMBDA, tf`
        resource "aws_iam_role_policy_attachment" "logs" {
          role       = aws_iam_role.lambda.name
          policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_iam_role.lambda', atributo: 'assume_role_policy', contem: 'lambda.amazonaws.com' },
            { recurso: 'aws_iam_role_policy_attachment.logs', atributo: 'policy_arn', igual: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' },
            { recurso: 'aws_iam_role_policy_attachment.logs', atributo: 'role', igual: 'lambda-ola' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-api-gateway',
      titulo: 'Uma API HTTP para a Lambda',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>aws_apigatewayv2_api "api"</code> com <code>name = "api-ola"</code> e <code>protocol_type = "HTTP"</code>;</li>
          <li>crie <code>aws_apigatewayv2_integration "ola"</code>: <code>integration_type = "AWS_PROXY"</code>,
            <code>integration_uri = aws_lambda_function.ola.invoke_arn</code> e <code>payload_format_version = "2.0"</code>;</li>
          <li>crie <code>aws_apigatewayv2_route "ola"</code> com <code>route_key = "GET /ola"</code> e
            <code>target = "integrations/\${aws_apigatewayv2_integration.ola.id}"</code>;</li>
          <li>crie <code>aws_apigatewayv2_stage "padrao"</code> com <code>name = "$default"</code> e <code>auto_deploy = true</code>;</li>
          <li>crie <code>output "url"</code> com o <code>invoke_url</code> do stage.</li>
        </ul>`,
      dica: 'Todos usam api_id = aws_apigatewayv2_api.api.id',
      inicial: { 'main.tf': comAws(ROLE_LAMBDA, LAMBDA), 'app.py': APP_PY },
      solucao: {
        'main.tf': comAws(ROLE_LAMBDA, LAMBDA, tf`
          resource "aws_apigatewayv2_api" "api" {
            name          = "api-ola"
            protocol_type = "HTTP"
          }

          resource "aws_apigatewayv2_integration" "ola" {
            api_id                 = aws_apigatewayv2_api.api.id
            integration_type       = "AWS_PROXY"
            integration_uri        = aws_lambda_function.ola.invoke_arn
            payload_format_version = "2.0"
          }

          resource "aws_apigatewayv2_route" "ola" {
            api_id    = aws_apigatewayv2_api.api.id
            route_key = "GET /ola"
            target    = "integrations/\${aws_apigatewayv2_integration.ola.id}"
          }

          resource "aws_apigatewayv2_stage" "padrao" {
            api_id      = aws_apigatewayv2_api.api.id
            name        = "$default"
            auto_deploy = true
          }

          output "url" {
            value = aws_apigatewayv2_stage.padrao.invoke_url
          }
        `),
        'app.py': APP_PY,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_apigatewayv2_api.api', atributo: 'protocol_type', igual: 'HTTP' },
            { recurso: 'aws_apigatewayv2_integration.ola', atributo: 'integration_uri', referencia: 'aws_lambda_function.ola.invoke_arn' },
            { recurso: 'aws_apigatewayv2_route.ola', atributo: 'route_key', igual: 'GET /ola' },
            { recurso: 'aws_apigatewayv2_stage.padrao', atributo: 'name', igual: '$default' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'url', contem: 'execute-api.us-east-1.amazonaws.com' }] },
      ],
    }),

    problema({
      id: 'aws-lambda-permissao',
      titulo: 'Deixar a API chamar a Lambda',
      dificuldade: 'medio',
      enunciado: `
        <p>Sem permissão, o API Gateway recebe "403" ao chamar a função.</p>
        <ul>
          <li>crie <code>aws_lambda_permission "api"</code> com <code>statement_id = "AllowAPIGateway"</code> e
            <code>action = "lambda:InvokeFunction"</code>;</li>
          <li><code>function_name = aws_lambda_function.ola.function_name</code> e <code>principal = "apigateway.amazonaws.com"</code>;</li>
          <li><code>source_arn = "\${aws_apigatewayv2_api.api.execution_arn}/*/*"</code> (só esta API).</li>
        </ul>`,
      dica: 'source_arn limita a permissão a uma API só',
      inicial: {
        'main.tf': comAws(ROLE_LAMBDA, LAMBDA, tf`
          resource "aws_apigatewayv2_api" "api" {
            name          = "api-ola"
            protocol_type = "HTTP"
          }
        `),
        'app.py': APP_PY,
      },
      solucao: {
        'main.tf': comAws(ROLE_LAMBDA, LAMBDA, tf`
          resource "aws_apigatewayv2_api" "api" {
            name          = "api-ola"
            protocol_type = "HTTP"
          }

          resource "aws_lambda_permission" "api" {
            statement_id  = "AllowAPIGateway"
            action        = "lambda:InvokeFunction"
            function_name = aws_lambda_function.ola.function_name
            principal     = "apigateway.amazonaws.com"
            source_arn    = "\${aws_apigatewayv2_api.api.execution_arn}/*/*"
          }
        `),
        'app.py': APP_PY,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_lambda_permission.api', atributo: 'principal', igual: 'apigateway.amazonaws.com' },
            { recurso: 'aws_lambda_permission.api', atributo: 'function_name', igual: 'ola' },
            { recurso: 'aws_lambda_permission.api', atributo: 'source_arn', referencia: 'aws_apigatewayv2_api.api.execution_arn' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-sqs',
      titulo: 'Fila com fila de mensagens mortas',
      dificuldade: 'medio',
      enunciado: `
        <p>Mensagens que falham várias vezes vão para uma "fila de mensagens mortas" (DLQ), para análise.</p>
        <ul>
          <li>crie <code>aws_sqs_queue "falhas"</code> com <code>name = "pedidos-dlq"</code>;</li>
          <li>na fila <code>pedidos</code>, use <code>visibility_timeout_seconds = 60</code>;</li>
          <li>e <code>redrive_policy = jsonencode({ deadLetterTargetArn = aws_sqs_queue.falhas.arn, maxReceiveCount = 3 })</code>.</li>
        </ul>`,
      dica: 'redrive_policy é um JSON: use jsonencode()',
      inicial: comAws(tf`
        resource "aws_sqs_queue" "pedidos" {
          name = "pedidos"
        }
      `),
      solucao: comAws(tf`
        resource "aws_sqs_queue" "falhas" {
          name = "pedidos-dlq"
        }

        resource "aws_sqs_queue" "pedidos" {
          name                       = "pedidos"
          visibility_timeout_seconds = 60
          redrive_policy = jsonencode({
            deadLetterTargetArn = aws_sqs_queue.falhas.arn
            maxReceiveCount     = 3
          })
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_sqs_queue.falhas', atributo: 'name', igual: 'pedidos-dlq' },
            { recurso: 'aws_sqs_queue.pedidos', atributo: 'visibility_timeout_seconds', igual: 60 },
            { dependencia: ['aws_sqs_queue.pedidos', 'aws_sqs_queue.falhas'] },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [
            { recurso: 'aws_sqs_queue.pedidos', atributo: 'redrive_policy', contem: '"maxReceiveCount":3' },
            { recurso: 'aws_sqs_queue.pedidos', atributo: 'redrive_policy', contem: 'pedidos-dlq' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-sns',
      titulo: 'Avisos por e-mail com SNS',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>aws_sns_topic "alertas"</code> com <code>name = "alertas"</code>;</li>
          <li>crie <code>aws_sns_topic_subscription "email"</code> com <code>topic_arn = aws_sns_topic.alertas.arn</code>,
            <code>protocol = "email"</code> e <code>endpoint = var.email</code>.</li>
        </ul>`,
      dica: 'protocol = "email"',
      inicial: comAws(tf`
        variable "email" {
          type    = string
          default = "ops@exemplo.com.br"
        }
      `),
      solucao: comAws(tf`
        variable "email" {
          type    = string
          default = "ops@exemplo.com.br"
        }

        resource "aws_sns_topic" "alertas" {
          name = "alertas"
        }

        resource "aws_sns_topic_subscription" "email" {
          topic_arn = aws_sns_topic.alertas.arn
          protocol  = "email"
          endpoint  = var.email
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_sns_topic_subscription.email', atributo: 'protocol', igual: 'email' },
            { recurso: 'aws_sns_topic_subscription.email', atributo: 'topic_arn', referencia: 'aws_sns_topic.alertas.arn' },
            { recurso: 'aws_sns_topic_subscription.email', atributo: 'endpoint', igual: 'ops@exemplo.com.br' },
          ],
        },
        { oculto: true, descricao: 'outro e-mail', variaveis: { email: 'turma@escola.edu.br' }, regras: [{ recurso: 'aws_sns_topic_subscription.email', atributo: 'endpoint', igual: 'turma@escola.edu.br' }] },
      ],
    }),

    problema({
      id: 'aws-cloudwatch',
      titulo: 'Logs e alarme no CloudWatch',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>aws_cloudwatch_log_group "app"</code> com <code>name = "/aula/app"</code> e <code>retention_in_days = 14</code>;</li>
          <li>crie <code>aws_cloudwatch_metric_alarm "cpu"</code>: <code>alarm_name = "cpu-alta"</code>,
            <code>comparison_operator = "GreaterThanThreshold"</code>, <code>evaluation_periods = 2</code>,
            <code>metric_name = "CPUUtilization"</code>, <code>namespace = "AWS/EC2"</code>, <code>period = 300</code>,
            <code>statistic = "Average"</code> e <code>threshold = 80</code>;</li>
          <li>e <code>alarm_actions = [aws_sns_topic.alertas.arn]</code>.</li>
        </ul>`,
      dica: 'O alarme avisa o tópico SNS quando a CPU passa de 80%',
      inicial: comAws(SNS),
      solucao: comAws(SNS, tf`
        resource "aws_cloudwatch_log_group" "app" {
          name              = "/aula/app"
          retention_in_days = 14
        }

        resource "aws_cloudwatch_metric_alarm" "cpu" {
          alarm_name          = "cpu-alta"
          comparison_operator = "GreaterThanThreshold"
          evaluation_periods  = 2
          metric_name         = "CPUUtilization"
          namespace           = "AWS/EC2"
          period              = 300
          statistic           = "Average"
          threshold           = 80
          alarm_actions       = [aws_sns_topic.alertas.arn]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_cloudwatch_log_group.app', atributo: 'retention_in_days', igual: 14 },
            { recurso: 'aws_cloudwatch_metric_alarm.cpu', atributo: 'threshold', igual: 80 },
            { recurso: 'aws_cloudwatch_metric_alarm.cpu', atributo: 'comparison_operator', igual: 'GreaterThanThreshold' },
            { dependencia: ['aws_cloudwatch_metric_alarm.cpu', 'aws_sns_topic.alertas'] },
          ],
        },
      ],
    }),

    licao({
      id: 'licao-aws-estado-remoto',
      titulo: 'Estado remoto, import e várias regiões',
      resumo: `
        <p>Em equipe, o estado não pode ficar no computador de uma pessoa. O <b>backend S3</b> guarda o
        <code>terraform.tfstate</code> num bucket, e <code>use_lockfile = true</code> impede dois applies ao mesmo tempo.</p>
        <ul>
          <li>o bloco <code>backend</code> é lido antes de tudo: <b>não aceita variáveis</b>;</li>
          <li>o bloco <code>import</code> traz para o estado um recurso que foi criado no console;</li>
          <li>com <code>provider "aws" { alias = "sp" ... }</code> você usa duas regiões no mesmo código,
            escolhendo em cada recurso com <code>provider = aws.sp</code>.</li>
        </ul>`,
      codigo: juntar(tf`
        terraform {
          backend "s3" {
            bucket       = "estado-terraform-aula"
            key          = "exemplo/terraform.tfstate"
            region       = "us-east-1"
            use_lockfile = true
          }
        }
      `, AWS, tf`
        resource "aws_s3_bucket" "dados" {
          bucket = "dados-com-estado-remoto"
        }
      `),
    }),

    problema({
      id: 'aws-backend-s3',
      titulo: 'Estado remoto no S3',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>no bloco <code>terraform</code>, crie <code>backend "s3"</code>;</li>
          <li>com <code>bucket = "estado-terraform-aula"</code>, <code>key = "rede/terraform.tfstate"</code> e <code>region = "us-east-1"</code>;</li>
          <li>e <code>use_lockfile = true</code> (trava o estado durante o apply) e <code>encrypt = true</code>.</li>
        </ul>`,
      dica: 'terraform { backend "s3" { ... } }',
      inicial: comAws(VPC),
      solucao: juntar(tf`
        terraform {
          backend "s3" {
            bucket       = "estado-terraform-aula"
            key          = "rede/terraform.tfstate"
            region       = "us-east-1"
            use_lockfile = true
            encrypt      = true
          }
        }
      `, AWS, VPC),
      testes: [
        {
          descricao: 'terraform init',
          regras: [
            { semErros: true },
            { backend: 's3', atributo: 'key', igual: 'rede/terraform.tfstate' },
            { backend: 's3', atributo: 'use_lockfile', igual: true },
            { texto: 'Successfully configured the backend "s3"' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-import',
      titulo: 'Importando um bucket que já existe',
      dificuldade: 'medio',
      enunciado: `
        <p>Alguém criou o bucket <code>bucket-legado-2019</code> pelo console. Traga-o para o Terraform sem recriar.</p>
        <ul>
          <li>escreva o <code>resource "aws_s3_bucket" "legado"</code> com <code>bucket = "bucket-legado-2019"</code>;</li>
          <li>e um bloco <code>import { to = aws_s3_bucket.legado  id = "bucket-legado-2019" }</code>;</li>
          <li>o plano deve dizer "1 to import" e não criar nada.</li>
        </ul>`,
      dica: 'import { to = ...  id = "..." }',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "legado" {
          bucket = "bucket-legado-2019"
        }
      `),
      solucao: comAws(tf`
        import {
          to = aws_s3_bucket.legado
          id = "bucket-legado-2019"
        }

        resource "aws_s3_bucket" "legado" {
          bucket = "bucket-legado-2019"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { plano: { importar: 1, criar: 0 } }, { recurso: 'aws_s3_bucket.legado', acao: 'importar' }] },
      ],
    }),

    problema({
      id: 'aws-dados-conta',
      titulo: 'Quem sou eu? (conta e região)',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>data "aws_caller_identity" "atual" {}</code> e <code>data "aws_region" "atual" {}</code>;</li>
          <li>crie <code>output "conta"</code> com o <code>account_id</code> e <code>output "regiao"</code> com o <code>region</code>.</li>
        </ul>`,
      dica: 'data.aws_caller_identity.atual.account_id',
      inicial: comAws(tf`
        # data "aws_caller_identity" "atual" {}
      `),
      solucao: comAws(tf`
        data "aws_caller_identity" "atual" {}

        data "aws_region" "atual" {}

        output "conta" {
          value = data.aws_caller_identity.atual.account_id
        }

        output "regiao" {
          value = data.aws_region.atual.region
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'conta', igual: '123456789012' }, { saida: 'regiao', igual: 'us-east-1' }] },
      ],
    }),

    problema({
      id: 'aws-multi-regiao',
      titulo: 'Duas regiões no mesmo código',
      dificuldade: 'dificil',
      enunciado: `
        <p>O backup deve ficar em São Paulo, longe do bucket principal na Virgínia.</p>
        <ul>
          <li>crie um segundo provider: <code>provider "aws" { alias = "sp"  region = "sa-east-1" }</code>;</li>
          <li>no <code>aws_s3_bucket "backup"</code>, use <code>provider = aws.sp</code>.</li>
        </ul>`,
      dica: 'provider = aws.sp (sem aspas)',
      inicial: comAws(tf`
        resource "aws_s3_bucket" "principal" {
          bucket = "dados-principais-2026"
        }

        resource "aws_s3_bucket" "backup" {
          bucket = "dados-backup-2026"
        }
      `),
      solucao: comAws(tf`
        provider "aws" {
          alias  = "sp"
          region = "sa-east-1"
        }

        resource "aws_s3_bucket" "principal" {
          bucket = "dados-principais-2026"
        }

        resource "aws_s3_bucket" "backup" {
          provider = aws.sp
          bucket   = "dados-backup-2026"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { provider: 'aws', alias: 'sp', atributo: 'region', igual: 'sa-east-1' },
            { meta: 'aws_s3_bucket.backup', provider: 'aws.sp' },
            { recurso: 'aws_s3_bucket.backup', atributo: 'region', igual: 'sa-east-1' },
            { recurso: 'aws_s3_bucket.principal', atributo: 'region', igual: 'us-east-1' },
          ],
        },
      ],
    }),

    problema({
      id: 'aws-secrets',
      titulo: 'Guardando um segredo',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>random_password "api"</code> com <code>length = 32</code> e <code>special = false</code>;</li>
          <li>crie <code>aws_secretsmanager_secret "api"</code> com <code>name = "chave-da-api"</code> e <code>recovery_window_in_days = 7</code>;</li>
          <li>crie <code>aws_secretsmanager_secret_version "api"</code> com <code>secret_id = aws_secretsmanager_secret.api.id</code>
            e <code>secret_string = random_password.api.result</code>.</li>
        </ul>`,
      dica: 'O secret é a "gaveta"; o secret_version é o conteúdo',
      inicial: comAws(tf`
        # random_password, aws_secretsmanager_secret e aws_secretsmanager_secret_version
      `),
      solucao: comAws(tf`
        resource "random_password" "api" {
          length  = 32
          special = false
        }

        resource "aws_secretsmanager_secret" "api" {
          name                    = "chave-da-api"
          recovery_window_in_days = 7
        }

        resource "aws_secretsmanager_secret_version" "api" {
          secret_id     = aws_secretsmanager_secret.api.id
          secret_string = random_password.api.result
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_secretsmanager_secret.api', atributo: 'recovery_window_in_days', igual: 7 },
            { recurso: 'aws_secretsmanager_secret_version.api', atributo: 'secret_id', referencia: 'aws_secretsmanager_secret.api.id' },
            { recurso: 'aws_secretsmanager_secret_version.api', atributo: 'secret_string', referencia: 'random_password.api.result' },
          ],
        },
      ],
    }),
  ],
};
