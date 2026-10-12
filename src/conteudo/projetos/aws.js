// Projetos na AWS: site estático com CDN, rede de 3 camadas e API serverless.
import { tf } from '../util.js';
import { criarProjeto } from './base.js';

const PROVEDOR_AWS = tf`
  terraform {
    required_providers {
      aws = {
        source  = "hashicorp/aws"
        version = "~> 6.0"
      }
    }
  }

  provider "aws" {
    region = "us-east-1"
  }
`;

// ---------- 1. Site estático: S3 + CloudFront ----------

export const projetoSite = criarProjeto({
  id: 'proj-site',
  titulo: 'Site estático com S3 e CloudFront',
  icone: '🌐',
  descricao: 'Um portfólio publicado num bucket privado e entregue pelo CloudFront com HTTPS.',
  resumo: `
    <p>Neste projeto você publica um <b>site estático</b> (só HTML, CSS e imagens) do jeito que as empresas fazem:</p>
    <ul>
      <li>um <b>bucket S3 privado</b> guarda os arquivos;</li>
      <li>o <b>CloudFront</b> (a CDN da AWS) entrega o site com HTTPS, rápido no mundo todo;</li>
      <li>uma <b>política do bucket</b> deixa só o CloudFront ler os arquivos.</li>
    </ul>
    <p>Analogia: o bucket é o depósito trancado; o CloudFront são as lojas espalhadas pelo país, as únicas com a chave.</p>
    <p>Cada etapa cria um arquivo novo (<code>bucket.tf</code>, <code>arquivos.tf</code>...). Use o botão <b>+</b> para criar arquivos.</p>`,
  inicial: {
    'providers.tf': PROVEDOR_AWS,
    'variables.tf': tf`
      variable "nome_site" {
        type        = string
        description = "Nome do bucket (único no mundo)"
        default     = "portfolio-sertao-2026"
      }
    `,
    'site/index.html': '<h1>Portfólio do sertão</h1>\n<p>Infraestrutura feita com Terraform.</p>\n',
    'site/404.html': '<h1>Página não encontrada</h1>\n',
  },
  etapas: [
    {
      titulo: 'O bucket privado',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie o arquivo <code>bucket.tf</code> com:</p>
        <ul>
          <li><code>aws_s3_bucket "site"</code> com <code>bucket = var.nome_site</code>;</li>
          <li><code>aws_s3_bucket_public_access_block "site"</code> com os quatro bloqueios em <code>true</code>
            (<code>block_public_acls</code>, <code>block_public_policy</code>, <code>ignore_public_acls</code>, <code>restrict_public_buckets</code>).</li>
        </ul>`,
      dica: 'bucket = aws_s3_bucket.site.id no bloqueio de acesso público',
      alteracoes: {
        'bucket.tf': tf`
          resource "aws_s3_bucket" "site" {
            bucket = var.nome_site
          }

          resource "aws_s3_bucket_public_access_block" "site" {
            bucket                  = aws_s3_bucket.site.id
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
            { arquivo: 'bucket.tf' },
            { recurso: 'aws_s3_bucket.site', atributo: 'bucket', igual: 'portfolio-sertao-2026' },
            { recurso: 'aws_s3_bucket_public_access_block.site', atributo: 'block_public_policy', igual: true },
            { recurso: 'aws_s3_bucket_public_access_block.site', atributo: 'restrict_public_buckets', igual: true },
          ],
        },
      ],
    },
    {
      titulo: 'Enviando as páginas',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>arquivos.tf</code> com um <code>aws_s3_object "paginas"</code>:</p>
        <ul>
          <li><code>for_each = toset(["index.html", "404.html"])</code>;</li>
          <li><code>bucket = aws_s3_bucket.site.id</code> e <code>key = each.key</code>;</li>
          <li><code>source = "site/\${each.key}"</code> e <code>content_type = "text/html"</code>;</li>
          <li><code>etag = filemd5("site/\${each.key}")</code>: quando o arquivo mudar, o Terraform reenvia.</li>
        </ul>`,
      dica: 'Um bloco com for_each envia os dois arquivos',
      alteracoes: {
        'arquivos.tf': tf`
          resource "aws_s3_object" "paginas" {
            for_each     = toset(["index.html", "404.html"])
            bucket       = aws_s3_bucket.site.id
            key          = each.key
            source       = "site/\${each.key}"
            content_type = "text/html"
            etag         = filemd5("site/\${each.key}")
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { instancias: 'aws_s3_object.paginas', quantidade: 2 },
            { recurso: 'aws_s3_object.paginas["404.html"]', atributo: 'key', igual: '404.html' },
            { recurso: 'aws_s3_object.paginas["index.html"]', atributo: 'content_type', igual: 'text/html' },
            { codigo: 'filemd5\\(', msg: 'O etag usa filemd5(...)' },
          ],
        },
      ],
    },
    {
      titulo: 'A distribuição do CloudFront',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>cdn.tf</code>:</p>
        <ul>
          <li><code>aws_cloudfront_origin_access_control "site"</code>: <code>name = "oac-portfolio"</code>,
            <code>origin_access_control_origin_type = "s3"</code>, <code>signing_behavior = "always"</code> e <code>signing_protocol = "sigv4"</code>;</li>
          <li><code>aws_cloudfront_distribution "site"</code> com <code>enabled = true</code> e <code>default_root_object = "index.html"</code>;</li>
          <li>um <code>origin</code> com <code>domain_name = aws_s3_bucket.site.bucket_regional_domain_name</code>,
            <code>origin_id = "s3-site"</code> e o <code>origin_access_control_id</code>;</li>
          <li><code>default_cache_behavior</code>: métodos <code>["GET", "HEAD"]</code>, <code>target_origin_id = "s3-site"</code>,
            <code>viewer_protocol_policy = "redirect-to-https"</code> e
            <code>cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"</code> (a política "CachingOptimized");</li>
          <li><code>restrictions { geo_restriction { restriction_type = "none" } }</code> e
            <code>viewer_certificate { cloudfront_default_certificate = true }</code>.</li>
        </ul>`,
      dica: 'Os blocos restrictions e viewer_certificate são obrigatórios, mesmo sem nada especial',
      alteracoes: {
        'cdn.tf': tf`
          resource "aws_cloudfront_origin_access_control" "site" {
            name                              = "oac-portfolio"
            origin_access_control_origin_type = "s3"
            signing_behavior                  = "always"
            signing_protocol                  = "sigv4"
          }

          resource "aws_cloudfront_distribution" "site" {
            enabled             = true
            default_root_object = "index.html"

            origin {
              domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
              origin_id                = "s3-site"
              origin_access_control_id = aws_cloudfront_origin_access_control.site.id
            }

            default_cache_behavior {
              allowed_methods        = ["GET", "HEAD"]
              cached_methods         = ["GET", "HEAD"]
              target_origin_id       = "s3-site"
              viewer_protocol_policy = "redirect-to-https"
              cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
            }

            restrictions {
              geo_restriction {
                restriction_type = "none"
              }
            }

            viewer_certificate {
              cloudfront_default_certificate = true
            }
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_cloudfront_distribution.site', atributo: 'origin.0.domain_name', referencia: 'aws_s3_bucket.site.bucket_regional_domain_name' },
            { recurso: 'aws_cloudfront_distribution.site', atributo: 'origin.0.origin_access_control_id', referencia: 'aws_cloudfront_origin_access_control.site.id' },
            { recurso: 'aws_cloudfront_distribution.site', atributo: 'default_cache_behavior.0.viewer_protocol_policy', igual: 'redirect-to-https' },
            { recurso: 'aws_cloudfront_distribution.site', atributo: 'default_root_object', igual: 'index.html' },
          ],
        },
      ],
    },
    {
      titulo: 'Só o CloudFront pode ler',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>politica.tf</code>:</p>
        <ul>
          <li><code>data "aws_iam_policy_document" "site"</code> com um <code>statement</code>:
            <code>actions = ["s3:GetObject"]</code> e <code>resources = ["\${aws_s3_bucket.site.arn}/*"]</code>;</li>
          <li>no statement, <code>principals { type = "Service"  identifiers = ["cloudfront.amazonaws.com"] }</code>;</li>
          <li>e <code>condition { test = "StringEquals"  variable = "AWS:SourceArn"  values = [aws_cloudfront_distribution.site.arn] }</code>
            (só a <b>sua</b> distribuição);</li>
          <li><code>aws_s3_bucket_policy "site"</code> com <code>policy = data.aws_iam_policy_document.site.json</code>.</li>
        </ul>`,
      dica: 'A condition impede que a distribuição de outra pessoa leia o seu bucket',
      alteracoes: {
        'politica.tf': tf`
          data "aws_iam_policy_document" "site" {
            statement {
              actions   = ["s3:GetObject"]
              resources = ["\${aws_s3_bucket.site.arn}/*"]

              principals {
                type        = "Service"
                identifiers = ["cloudfront.amazonaws.com"]
              }

              condition {
                test     = "StringEquals"
                variable = "AWS:SourceArn"
                values   = [aws_cloudfront_distribution.site.arn]
              }
            }
          }

          resource "aws_s3_bucket_policy" "site" {
            bucket = aws_s3_bucket.site.id
            policy = data.aws_iam_policy_document.site.json
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { dado: 'aws_iam_policy_document.site' },
            { recurso: 'aws_s3_bucket_policy.site', atributo: 'policy', referencia: 'data.aws_iam_policy_document.site.json' },
            { codigo: 'AWS:SourceArn', msg: 'A política confere a origem com AWS:SourceArn' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ recurso: 'aws_s3_bucket_policy.site', atributo: 'policy', contem: 'cloudfront.amazonaws.com' }],
        },
      ],
    },
    {
      titulo: 'Tags e endereço do site',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>em <code>providers.tf</code>, acrescente ao provider <code>default_tags { tags = { Projeto = "portfolio", Gerenciado = "terraform" } }</code>;</li>
          <li>crie o arquivo <code>outputs.tf</code> com <code>output "url"</code> valendo
            <code>"https://\${aws_cloudfront_distribution.site.domain_name}"</code>;</li>
          <li>e <code>output "bucket"</code> com <code>aws_s3_bucket.site.bucket</code>.</li>
        </ul>
        <p>Rode o <b>✔ Apply</b> e veja o endereço na aba <b>Outputs</b>.</p>`,
      dica: 'default_tags vai dentro do bloco provider "aws"',
      alteracoes: {
        'providers.tf': tf`
          terraform {
            required_providers {
              aws = {
                source  = "hashicorp/aws"
                version = "~> 6.0"
              }
            }
          }

          provider "aws" {
            region = "us-east-1"

            default_tags {
              tags = {
                Projeto    = "portfolio"
                Gerenciado = "terraform"
              }
            }
          }
        `,
        'outputs.tf': tf`
          output "url" {
            value = "https://\${aws_cloudfront_distribution.site.domain_name}"
          }

          output "bucket" {
            value = aws_s3_bucket.site.bucket
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_s3_bucket.site', atributo: 'tags_all.Projeto', igual: 'portfolio' },
            { saida: 'bucket', igual: 'portfolio-sertao-2026' },
            { saida: 'url', existe: true },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'url', regex: '^https://d[0-9a-z]+\\.cloudfront\\.net$' }] },
      ],
    },
  ],
});

// ---------- 2. Rede de 3 camadas ----------

const REDE_VARIAVEIS = tf`
  variable "cidr_vpc" {
    type    = string
    default = "10.0.0.0/16"
  }

  variable "zonas" {
    type    = list(string)
    default = ["us-east-1a", "us-east-1b"]
  }
`;

export const projetoRede = criarProjeto({
  id: 'proj-rede',
  titulo: 'Rede de 3 camadas na AWS',
  icone: '🧱',
  descricao: 'VPC com sub-redes públicas, de aplicação e de dados, NAT, security groups em cadeia e um banco RDS.',
  resumo: `
    <p>A <b>arquitetura de 3 camadas</b> separa o sistema por nível de exposição:</p>
    <ul>
      <li><b>pública</b>: o load balancer, aberto para a internet;</li>
      <li><b>aplicação</b>: os servidores, que só recebem tráfego do load balancer;</li>
      <li><b>dados</b>: o banco, que só recebe tráfego da aplicação.</li>
    </ul>
    <p>Analogia: um restaurante. O salão recebe os clientes, a cozinha só fala com o salão e a despensa só abre para a cozinha.</p>
    <p>Tudo em duas zonas de disponibilidade (<code>var.zonas</code>) para aguentar a queda de um data center.</p>`,
  inicial: {
    'providers.tf': PROVEDOR_AWS,
    'variables.tf': REDE_VARIAVEIS,
  },
  etapas: [
    {
      titulo: 'A VPC e o internet gateway',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie o arquivo <code>vpc.tf</code>:</p>
        <ul>
          <li><code>aws_vpc "principal"</code> com <code>cidr_block = var.cidr_vpc</code>, <code>enable_dns_hostnames = true</code>
            e a tag <code>Name = "vpc-3-camadas"</code>;</li>
          <li><code>aws_internet_gateway "igw"</code> ligado à VPC.</li>
        </ul>`,
      dica: 'vpc_id = aws_vpc.principal.id',
      alteracoes: {
        'vpc.tf': tf`
          resource "aws_vpc" "principal" {
            cidr_block           = var.cidr_vpc
            enable_dns_hostnames = true

            tags = {
              Name = "vpc-3-camadas"
            }
          }

          resource "aws_internet_gateway" "igw" {
            vpc_id = aws_vpc.principal.id
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_vpc.principal', atributo: 'cidr_block', igual: '10.0.0.0/16' },
            { recurso: 'aws_vpc.principal', atributo: 'tags.Name', igual: 'vpc-3-camadas' },
            { recurso: 'aws_internet_gateway.igw', atributo: 'vpc_id', referencia: 'aws_vpc.principal.id' },
          ],
        },
      ],
    },
    {
      titulo: 'Seis sub-redes com cidrsubnet',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>subnets.tf</code> com três recursos <code>aws_subnet</code>, todos com <code>count = length(var.zonas)</code>
        e <code>availability_zone = var.zonas[count.index]</code>:</p>
        <ul>
          <li><code>"publica"</code>: <code>cidrsubnet(var.cidr_vpc, 8, count.index)</code> e <code>map_public_ip_on_launch = true</code>;</li>
          <li><code>"app"</code>: <code>cidrsubnet(var.cidr_vpc, 8, count.index + 10)</code>;</li>
          <li><code>"dados"</code>: <code>cidrsubnet(var.cidr_vpc, 8, count.index + 20)</code>.</li>
        </ul>
        <p>Assim a pública fica com 10.0.0.0/24 e 10.0.1.0/24, a de aplicação com 10.0.10.0/24...</p>`,
      dica: 'cidrsubnet("10.0.0.0/16", 8, 10) = "10.0.10.0/24"',
      alteracoes: {
        'subnets.tf': tf`
          resource "aws_subnet" "publica" {
            count                   = length(var.zonas)
            vpc_id                  = aws_vpc.principal.id
            cidr_block              = cidrsubnet(var.cidr_vpc, 8, count.index)
            availability_zone       = var.zonas[count.index]
            map_public_ip_on_launch = true
          }

          resource "aws_subnet" "app" {
            count             = length(var.zonas)
            vpc_id            = aws_vpc.principal.id
            cidr_block        = cidrsubnet(var.cidr_vpc, 8, count.index + 10)
            availability_zone = var.zonas[count.index]
          }

          resource "aws_subnet" "dados" {
            count             = length(var.zonas)
            vpc_id            = aws_vpc.principal.id
            cidr_block        = cidrsubnet(var.cidr_vpc, 8, count.index + 20)
            availability_zone = var.zonas[count.index]
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { tipo: 'aws_subnet', quantidade: 6 },
            { recurso: 'aws_subnet.publica[1]', atributo: 'cidr_block', igual: '10.0.1.0/24' },
            { recurso: 'aws_subnet.app[0]', atributo: 'cidr_block', igual: '10.0.10.0/24' },
            { recurso: 'aws_subnet.dados[1]', atributo: 'cidr_block', igual: '10.0.21.0/24' },
            { recurso: 'aws_subnet.dados[1]', atributo: 'availability_zone', igual: 'us-east-1b' },
          ],
        },
        {
          oculto: true,
          descricao: 'três zonas',
          variaveis: { zonas: ['us-east-1a', 'us-east-1b', 'us-east-1c'] },
          regras: [{ tipo: 'aws_subnet', quantidade: 9 }, { recurso: 'aws_subnet.app[2]', atributo: 'cidr_block', igual: '10.0.12.0/24' }],
        },
      ],
    },
    {
      titulo: 'Rotas e NAT gateway',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>rotas.tf</code>:</p>
        <ul>
          <li><code>aws_route_table "publica"</code> com <code>route { cidr_block = "0.0.0.0/0"  gateway_id = aws_internet_gateway.igw.id }</code>;</li>
          <li><code>aws_route_table_association "publica"</code> com <code>count = length(var.zonas)</code>, ligando <code>aws_subnet.publica[count.index].id</code>;</li>
          <li><code>aws_eip "nat"</code> com <code>domain = "vpc"</code> e <code>aws_nat_gateway "nat"</code> na <code>aws_subnet.publica[0]</code>;</li>
          <li><code>aws_route_table "privada"</code> com <code>route { cidr_block = "0.0.0.0/0"  nat_gateway_id = aws_nat_gateway.nat.id }</code>;</li>
          <li><code>aws_route_table_association "app"</code> (com count) ligando as sub-redes <code>app</code> à tabela privada.</li>
        </ul>`,
      dica: 'O NAT fica numa sub-rede pública; as sub-redes privadas saem para a internet por ele',
      alteracoes: {
        'rotas.tf': tf`
          resource "aws_route_table" "publica" {
            vpc_id = aws_vpc.principal.id

            route {
              cidr_block = "0.0.0.0/0"
              gateway_id = aws_internet_gateway.igw.id
            }
          }

          resource "aws_route_table_association" "publica" {
            count          = length(var.zonas)
            subnet_id      = aws_subnet.publica[count.index].id
            route_table_id = aws_route_table.publica.id
          }

          resource "aws_eip" "nat" {
            domain = "vpc"
          }

          resource "aws_nat_gateway" "nat" {
            allocation_id = aws_eip.nat.id
            subnet_id     = aws_subnet.publica[0].id
          }

          resource "aws_route_table" "privada" {
            vpc_id = aws_vpc.principal.id

            route {
              cidr_block     = "0.0.0.0/0"
              nat_gateway_id = aws_nat_gateway.nat.id
            }
          }

          resource "aws_route_table_association" "app" {
            count          = length(var.zonas)
            subnet_id      = aws_subnet.app[count.index].id
            route_table_id = aws_route_table.privada.id
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_route_table.publica', atributo: 'route.0.gateway_id', referencia: 'aws_internet_gateway.igw.id' },
            { recurso: 'aws_route_table.privada', atributo: 'route.0.nat_gateway_id', referencia: 'aws_nat_gateway.nat.id' },
            { recurso: 'aws_nat_gateway.nat', atributo: 'subnet_id', referencia: 'aws_subnet.publica[0].id' },
            { instancias: 'aws_route_table_association.app', quantidade: 2 },
            { instancias: 'aws_route_table_association.publica', quantidade: 2 },
          ],
        },
      ],
    },
    {
      titulo: 'Security groups em cadeia',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>seguranca.tf</code> com três <code>aws_security_group</code> na VPC (cada um com um <code>egress</code> liberando tudo):</p>
        <ul>
          <li><code>"web"</code>: <code>ingress</code> na porta 443 vindo de <code>["0.0.0.0/0"]</code>;</li>
          <li><code>"app"</code>: <code>ingress</code> na porta 8080 vindo <b>só</b> do grupo web: <code>security_groups = [aws_security_group.web.id]</code>;</li>
          <li><code>"dados"</code>: <code>ingress</code> na porta 5432 vindo só do grupo app.</li>
        </ul>
        <p>Em vez de IPs, um grupo aponta para o outro: quem estiver no grupo "web" pode falar com o "app".</p>`,
      dica: 'egress { from_port = 0  to_port = 0  protocol = "-1"  cidr_blocks = ["0.0.0.0/0"] }',
      alteracoes: {
        'seguranca.tf': tf`
          resource "aws_security_group" "web" {
            name   = "web"
            vpc_id = aws_vpc.principal.id

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

          resource "aws_security_group" "app" {
            name   = "app"
            vpc_id = aws_vpc.principal.id

            ingress {
              from_port       = 8080
              to_port         = 8080
              protocol        = "tcp"
              security_groups = [aws_security_group.web.id]
            }

            egress {
              from_port   = 0
              to_port     = 0
              protocol    = "-1"
              cidr_blocks = ["0.0.0.0/0"]
            }
          }

          resource "aws_security_group" "dados" {
            name   = "dados"
            vpc_id = aws_vpc.principal.id

            ingress {
              from_port       = 5432
              to_port         = 5432
              protocol        = "tcp"
              security_groups = [aws_security_group.app.id]
            }

            egress {
              from_port   = 0
              to_port     = 0
              protocol    = "-1"
              cidr_blocks = ["0.0.0.0/0"]
            }
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_security_group.web', atributo: 'ingress.0.from_port', igual: 443 },
            { recurso: 'aws_security_group.app', atributo: 'ingress.0.from_port', igual: 8080 },
            { recurso: 'aws_security_group.dados', atributo: 'ingress.0.to_port', igual: 5432 },
            { dependencia: ['aws_security_group.app', 'aws_security_group.web'] },
            { dependencia: ['aws_security_group.dados', 'aws_security_group.app'] },
          ],
        },
      ],
    },
    {
      titulo: 'O banco na camada de dados',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>banco.tf</code>:</p>
        <ul>
          <li><code>aws_db_subnet_group "dados"</code> com <code>name = "dados"</code> e <code>subnet_ids = aws_subnet.dados[*].id</code>;</li>
          <li><code>aws_db_instance "banco"</code>: <code>identifier = "banco-3-camadas"</code>, <code>engine = "postgres"</code>,
            <code>instance_class = "db.t4g.micro"</code>, <code>allocated_storage = 20</code>, <code>username = "app"</code>;</li>
          <li>senha gerenciada pela AWS: <code>manage_master_user_password = true</code>;</li>
          <li><code>db_subnet_group_name = aws_db_subnet_group.dados.name</code>,
            <code>vpc_security_group_ids = [aws_security_group.dados.id]</code> e <code>skip_final_snapshot = true</code>.</li>
        </ul>`,
      dica: 'O splat aws_subnet.dados[*].id junta os ids das duas sub-redes',
      alteracoes: {
        'banco.tf': tf`
          resource "aws_db_subnet_group" "dados" {
            name       = "dados"
            subnet_ids = aws_subnet.dados[*].id
          }

          resource "aws_db_instance" "banco" {
            identifier                  = "banco-3-camadas"
            engine                      = "postgres"
            instance_class              = "db.t4g.micro"
            allocated_storage           = 20
            username                    = "app"
            manage_master_user_password = true
            db_subnet_group_name        = aws_db_subnet_group.dados.name
            vpc_security_group_ids      = [aws_security_group.dados.id]
            skip_final_snapshot         = true
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_db_instance.banco', atributo: 'engine', igual: 'postgres' },
            { recurso: 'aws_db_instance.banco', atributo: 'manage_master_user_password', igual: true },
            { recurso: 'aws_db_instance.banco', atributo: 'db_subnet_group_name', igual: 'dados' },
            { dependencia: ['aws_db_instance.banco', 'aws_security_group.dados'] },
            { dependencia: ['aws_db_subnet_group.dados', 'aws_subnet.dados'] },
            { semCodigo: '\\bpassword\\s*=', msg: 'Nenhuma senha escrita no código' },
          ],
        },
      ],
    },
  ],
});

// ---------- 3. API serverless ----------

const APP_PEDIDOS = `import json
import os

import boto3

tabela = boto3.resource("dynamodb").Table(os.environ["TABELA"])


def handler(event, context):
    if event["requestContext"]["http"]["method"] == "POST":
        pedido = json.loads(event["body"])
        tabela.put_item(Item=pedido)
        return {"statusCode": 201, "body": json.dumps(pedido)}
    item = tabela.get_item(Key={"id": event["pathParameters"]["id"]}).get("Item")
    return {"statusCode": 200 if item else 404, "body": json.dumps(item)}
`;

export const projetoApi = criarProjeto({
  id: 'proj-api',
  titulo: 'API serverless na AWS',
  icone: '⚡',
  descricao: 'API de pedidos com API Gateway, Lambda em Python, DynamoDB, permissões mínimas e alarme.',
  resumo: `
    <p>Uma API <b>serverless</b>: não existe servidor ligado esperando. A AWS roda o código só quando chega um pedido.</p>
    <ul>
      <li><b>API Gateway</b>: a porta de entrada (recebe <code>POST /pedidos</code> e <code>GET /pedidos/{id}</code>);</li>
      <li><b>Lambda</b>: o código Python em <code>app.py</code>;</li>
      <li><b>DynamoDB</b>: a tabela onde os pedidos ficam guardados;</li>
      <li><b>IAM</b>: a Lambda recebe só as permissões que usa (menor privilégio).</li>
    </ul>
    <p>Analogia: um balcão de atendimento que só acende a luz quando chega cliente; no resto do tempo, custo zero.</p>`,
  inicial: {
    'providers.tf': tf`
      terraform {
        required_providers {
          aws = {
            source  = "hashicorp/aws"
            version = "~> 6.0"
          }
          archive = {
            source  = "hashicorp/archive"
            version = "~> 2.7"
          }
        }
      }

      provider "aws" {
        region = "us-east-1"
      }
    `,
    'app.py': APP_PEDIDOS,
  },
  etapas: [
    {
      titulo: 'A tabela de pedidos',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie o arquivo <code>tabela.tf</code> com <code>aws_dynamodb_table "pedidos"</code>:</p>
        <ul>
          <li><code>name = "pedidos"</code> e <code>billing_mode = "PAY_PER_REQUEST"</code> (paga por uso);</li>
          <li><code>hash_key = "id"</code> e um bloco <code>attribute { name = "id"  type = "S" }</code>.</li>
        </ul>`,
      dica: 'type "S" = texto (string)',
      alteracoes: {
        'tabela.tf': tf`
          resource "aws_dynamodb_table" "pedidos" {
            name         = "pedidos"
            billing_mode = "PAY_PER_REQUEST"
            hash_key     = "id"

            attribute {
              name = "id"
              type = "S"
            }
          }
        `,
      },
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
    },
    {
      titulo: 'Permissões mínimas da Lambda',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>iam.tf</code>:</p>
        <ul>
          <li><code>data "aws_iam_policy_document" "assume"</code>: <code>actions = ["sts:AssumeRole"]</code> e o principal
            <code>Service</code> <code>lambda.amazonaws.com</code>;</li>
          <li><code>aws_iam_role "api"</code> com <code>name = "api-pedidos"</code> e essa política de confiança;</li>
          <li><code>aws_iam_role_policy_attachment "logs"</code> com a política
            <code>arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole</code>;</li>
          <li><code>data "aws_iam_policy_document" "tabela"</code> permitindo só <code>["dynamodb:PutItem", "dynamodb:GetItem"]</code>
            em <code>[aws_dynamodb_table.pedidos.arn]</code>, e <code>aws_iam_role_policy "tabela"</code> com ele.</li>
        </ul>`,
      dica: 'aws_iam_role_policy: role = aws_iam_role.api.id e policy = data.aws_iam_policy_document.tabela.json',
      alteracoes: {
        'iam.tf': tf`
          data "aws_iam_policy_document" "assume" {
            statement {
              actions = ["sts:AssumeRole"]

              principals {
                type        = "Service"
                identifiers = ["lambda.amazonaws.com"]
              }
            }
          }

          resource "aws_iam_role" "api" {
            name               = "api-pedidos"
            assume_role_policy = data.aws_iam_policy_document.assume.json
          }

          resource "aws_iam_role_policy_attachment" "logs" {
            role       = aws_iam_role.api.name
            policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
          }

          data "aws_iam_policy_document" "tabela" {
            statement {
              actions   = ["dynamodb:PutItem", "dynamodb:GetItem"]
              resources = [aws_dynamodb_table.pedidos.arn]
            }
          }

          resource "aws_iam_role_policy" "tabela" {
            name   = "acesso-tabela"
            role   = aws_iam_role.api.id
            policy = data.aws_iam_policy_document.tabela.json
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_iam_role.api', atributo: 'name', igual: 'api-pedidos' },
            { recurso: 'aws_iam_role_policy_attachment.logs', atributo: 'policy_arn', contem: 'AWSLambdaBasicExecutionRole' },
            { recurso: 'aws_iam_role_policy.tabela', atributo: 'policy', referencia: 'data.aws_iam_policy_document.tabela.json' },
            { semCodigo: 'dynamodb:\\*', msg: 'Nada de "dynamodb:*": só as ações usadas' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ recurso: 'aws_iam_role_policy.tabela', atributo: 'policy', contem: 'dynamodb:PutItem' }],
        },
      ],
    },
    {
      titulo: 'A função Lambda',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>lambda.tf</code>:</p>
        <ul>
          <li><code>data "archive_file" "codigo"</code> zipando <code>app.py</code> em <code>app.zip</code>;</li>
          <li><code>aws_lambda_function "api"</code>: <code>function_name = "api-pedidos"</code>, <code>role = aws_iam_role.api.arn</code>,
            <code>handler = "app.handler"</code>, <code>runtime = "python3.12"</code>, o <code>filename</code> e o <code>source_code_hash</code>;</li>
          <li><code>environment { variables = { TABELA = aws_dynamodb_table.pedidos.name } }</code>;</li>
          <li><code>aws_cloudwatch_log_group "api"</code> com <code>name = "/aws/lambda/api-pedidos"</code> e <code>retention_in_days = 14</code>.</li>
        </ul>`,
      dica: 'O app.py lê o nome da tabela em os.environ["TABELA"]',
      alteracoes: {
        'lambda.tf': tf`
          data "archive_file" "codigo" {
            type        = "zip"
            source_file = "app.py"
            output_path = "app.zip"
          }

          resource "aws_lambda_function" "api" {
            function_name    = "api-pedidos"
            role             = aws_iam_role.api.arn
            handler          = "app.handler"
            runtime          = "python3.12"
            filename         = data.archive_file.codigo.output_path
            source_code_hash = data.archive_file.codigo.output_base64sha256

            environment {
              variables = {
                TABELA = aws_dynamodb_table.pedidos.name
              }
            }
          }

          resource "aws_cloudwatch_log_group" "api" {
            name              = "/aws/lambda/api-pedidos"
            retention_in_days = 14
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_lambda_function.api', atributo: 'runtime', igual: 'python3.12' },
            { recurso: 'aws_lambda_function.api', atributo: 'environment.0.variables.TABELA', igual: 'pedidos' },
            { recurso: 'aws_lambda_function.api', atributo: 'role', referencia: 'aws_iam_role.api.arn' },
            { recurso: 'aws_cloudwatch_log_group.api', atributo: 'retention_in_days', igual: 14 },
          ],
        },
      ],
    },
    {
      titulo: 'As rotas da API',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>api.tf</code>:</p>
        <ul>
          <li><code>aws_apigatewayv2_api "api"</code> com <code>name = "pedidos"</code> e <code>protocol_type = "HTTP"</code>;</li>
          <li><code>aws_apigatewayv2_integration "lambda"</code>: <code>integration_type = "AWS_PROXY"</code>,
            <code>integration_uri = aws_lambda_function.api.invoke_arn</code> e <code>payload_format_version = "2.0"</code>;</li>
          <li><code>aws_apigatewayv2_route "rotas"</code> com <code>for_each = toset(["POST /pedidos", "GET /pedidos/{id}"])</code>,
            <code>route_key = each.key</code> e <code>target = "integrations/\${aws_apigatewayv2_integration.lambda.id}"</code>;</li>
          <li><code>aws_apigatewayv2_stage "padrao"</code> com <code>name = "$default"</code> e <code>auto_deploy = true</code>;</li>
          <li><code>aws_lambda_permission "api"</code>: <code>action = "lambda:InvokeFunction"</code>, <code>principal = "apigateway.amazonaws.com"</code>
            e <code>source_arn = "\${aws_apigatewayv2_api.api.execution_arn}/*/*"</code>.</li>
        </ul>`,
      dica: 'Sem a aws_lambda_permission, o API Gateway não tem licença para chamar a função',
      alteracoes: {
        'api.tf': tf`
          resource "aws_apigatewayv2_api" "api" {
            name          = "pedidos"
            protocol_type = "HTTP"
          }

          resource "aws_apigatewayv2_integration" "lambda" {
            api_id                 = aws_apigatewayv2_api.api.id
            integration_type       = "AWS_PROXY"
            integration_uri        = aws_lambda_function.api.invoke_arn
            payload_format_version = "2.0"
          }

          resource "aws_apigatewayv2_route" "rotas" {
            for_each  = toset(["POST /pedidos", "GET /pedidos/{id}"])
            api_id    = aws_apigatewayv2_api.api.id
            route_key = each.key
            target    = "integrations/\${aws_apigatewayv2_integration.lambda.id}"
          }

          resource "aws_apigatewayv2_stage" "padrao" {
            api_id      = aws_apigatewayv2_api.api.id
            name        = "$default"
            auto_deploy = true
          }

          resource "aws_lambda_permission" "api" {
            action        = "lambda:InvokeFunction"
            function_name = aws_lambda_function.api.function_name
            principal     = "apigateway.amazonaws.com"
            source_arn    = "\${aws_apigatewayv2_api.api.execution_arn}/*/*"
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { instancias: 'aws_apigatewayv2_route.rotas', quantidade: 2 },
            { recurso: 'aws_apigatewayv2_route.rotas["GET /pedidos/{id}"]', atributo: 'route_key', igual: 'GET /pedidos/{id}' },
            { recurso: 'aws_apigatewayv2_integration.lambda', atributo: 'integration_uri', referencia: 'aws_lambda_function.api.invoke_arn' },
            { recurso: 'aws_lambda_permission.api', atributo: 'principal', igual: 'apigateway.amazonaws.com' },
          ],
        },
      ],
    },
    {
      titulo: 'Alarme de erros e endereço da API',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>monitoramento.tf</code>:</p>
        <ul>
          <li><code>aws_sns_topic "alertas"</code> com <code>name = "alertas-api"</code>;</li>
          <li><code>aws_cloudwatch_metric_alarm "erros"</code>: <code>alarm_name = "api-pedidos-erros"</code>, <code>namespace = "AWS/Lambda"</code>,
            <code>metric_name = "Errors"</code>, <code>statistic = "Sum"</code>, <code>period = 300</code>, <code>evaluation_periods = 1</code>,
            <code>threshold = 5</code>, <code>comparison_operator = "GreaterThanThreshold"</code>;</li>
          <li><code>dimensions = { FunctionName = aws_lambda_function.api.function_name }</code> e
            <code>alarm_actions = [aws_sns_topic.alertas.arn]</code>;</li>
          <li><code>output "url"</code> com <code>aws_apigatewayv2_api.api.api_endpoint</code>.</li>
        </ul>`,
      dica: 'dimensions diz de qual função é a métrica',
      alteracoes: {
        'monitoramento.tf': tf`
          resource "aws_sns_topic" "alertas" {
            name = "alertas-api"
          }

          resource "aws_cloudwatch_metric_alarm" "erros" {
            alarm_name          = "api-pedidos-erros"
            namespace           = "AWS/Lambda"
            metric_name         = "Errors"
            statistic           = "Sum"
            period              = 300
            evaluation_periods  = 1
            threshold           = 5
            comparison_operator = "GreaterThanThreshold"
            alarm_actions       = [aws_sns_topic.alertas.arn]

            dimensions = {
              FunctionName = aws_lambda_function.api.function_name
            }
          }

          output "url" {
            value = aws_apigatewayv2_api.api.api_endpoint
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'aws_cloudwatch_metric_alarm.erros', atributo: 'metric_name', igual: 'Errors' },
            { recurso: 'aws_cloudwatch_metric_alarm.erros', atributo: 'dimensions.FunctionName', igual: 'api-pedidos' },
            { recurso: 'aws_cloudwatch_metric_alarm.erros', atributo: 'threshold', igual: 5 },
            { saida: 'url', existe: true },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'url', regex: '^https://[a-z0-9]+\\.execute-api\\.us-east-1\\.amazonaws\\.com$' }] },
      ],
    },
  ],
});
