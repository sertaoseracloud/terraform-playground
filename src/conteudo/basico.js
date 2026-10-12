// Módulo 1: Terraform básico. Só provedores que não precisam de nuvem (random,
// local, terraform_data, archive), para aprender a linguagem sem pensar em conta.
import { tf, licao, problema } from './util.js';

const MOD_ARQUIVO = tf`
  variable "nome" {
    type        = string
    description = "Nome do arquivo, sem extensão"
  }

  variable "conteudo" {
    type    = string
    default = ""
  }

  resource "local_file" "este" {
    filename = "\${var.nome}.txt"
    content  = var.conteudo
  }

  output "caminho" {
    value = local_file.este.filename
  }
`;

export const moduloBasico = {
  id: 'basico',
  titulo: 'Terraform básico',
  icone: '🧱',
  descricao: 'A linguagem HCL, variáveis, outputs, expressões, count, for_each, estado, ciclo de vida e módulos.',
  itens: [
    licao({
      id: 'licao-o-que-e-terraform',
      titulo: 'O que é Terraform (e por que usar)',
      resumo: `
        <p><b>Terraform</b> cria infraestrutura (servidores, redes, bancos, arquivos...) a partir de <b>código</b>.
        Isso se chama <b>Infraestrutura como Código (IaC)</b>: em vez de clicar no console da nuvem, você escreve
        o que quer e o Terraform faz.</p>
        <p>O código é escrito em <b>HCL</b> e fica em arquivos <code>.tf</code>. Ele é feito de <b>blocos</b>:</p>
        <ul>
          <li><code>resource "tipo" "nome" { ... }</code>: algo que o Terraform cria e cuida.</li>
          <li>Dentro do bloco, <b>argumentos</b>: <code>nome = valor</code>.</li>
        </ul>
        <p>O fluxo de trabalho tem 4 comandos:</p>
        <ol>
          <li><code>terraform init</code>: baixa os <b>provedores</b> (plugins que falam com cada nuvem).</li>
          <li><code>terraform plan</code>: mostra o que <b>vai</b> mudar, sem mudar nada.</li>
          <li><code>terraform apply</code>: aplica o plano e cria de verdade.</li>
          <li><code>terraform destroy</code>: apaga tudo o que foi criado.</li>
        </ol>
        <p>Aqui tudo é <b>simulado</b> no navegador: clique em <b>▶ Plan</b>, depois em <b>✔ Apply</b> e veja o
        <b>📦 Estado</b>. Rode o Plan de novo: o Terraform diz "No changes", porque já está tudo criado.</p>`,
      codigo: tf`
        # Um recurso que cria um arquivo no computador.
        resource "local_file" "bem_vindo" {
          filename = "bem-vindo.txt"
          content  = "Olá! Este arquivo foi criado pelo Terraform."
        }
      `,
    }),

    problema({
      id: 'tf-ola-arquivo',
      titulo: 'Olá, Terraform!',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie o seu primeiro recurso: um arquivo de texto.</p>
        <ul>
          <li>um <code>resource "local_file"</code> com o nome <code>ola</code>;</li>
          <li>o argumento <code>filename</code> com o valor <code>"ola.txt"</code>;</li>
          <li>o argumento <code>content</code> com o texto <code>"Olá, Terraform!"</code>.</li>
        </ul>`,
      dica: 'resource "local_file" "ola" { filename = "ola.txt" ... }',
      inicial: tf`
        # Escreva aqui o bloco resource "local_file" "ola" { ... }
      `,
      solucao: tf`
        resource "local_file" "ola" {
          filename = "ola.txt"
          content  = "Olá, Terraform!"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'local_file.ola', acao: 'criar' },
            { recurso: 'local_file.ola', atributo: 'filename', igual: 'ola.txt' },
            { recurso: 'local_file.ola', atributo: 'content', igual: 'Olá, Terraform!' },
          ],
        },
        {
          oculto: true,
          descricao: 'apply e plan de novo: nada muda',
          passos: [{ comando: 'apply' }, { comando: 'plan', regras: [{ plano: { criar: 0, alterar: 0, destruir: 0 } }] }],
        },
      ],
    }),

    problema({
      id: 'tf-random-pet',
      titulo: 'Um nome aleatório',
      dificuldade: 'facil',
      enunciado: `
        <p>O provedor <b>random</b> gera valores aleatórios. O <code>random_pet</code> gera nomes como "valente-tatu".</p>
        <ul>
          <li>crie um <code>resource "random_pet"</code> chamado <code>servidor</code>;</li>
          <li>com <code>length = 3</code> (três palavras);</li>
          <li>e <code>separator = "_"</code> (separadas por sublinhado).</li>
        </ul>`,
      dica: 'resource "random_pet" "servidor" { length = 3 ... }',
      inicial: tf`
        # Crie o resource "random_pet" "servidor"
      `,
      solucao: tf`
        resource "random_pet" "servidor" {
          length    = 3
          separator = "_"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'random_pet.servidor', atributo: 'length', igual: 3 },
            { recurso: 'random_pet.servidor', atributo: 'separator', igual: '_' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ recurso: 'random_pet.servidor', atributo: 'id', regex: '^[^_]+_[^_]+_[^_]+$' }],
        },
      ],
    }),

    problema({
      id: 'tf-referencia',
      titulo: 'Um recurso usando outro',
      dificuldade: 'facil',
      enunciado: `
        <p>Um recurso pode usar um valor de outro. A referência tem a forma <code>TIPO.NOME.ATRIBUTO</code>.</p>
        <ul>
          <li>mantenha o <code>random_pet "nome"</code>;</li>
          <li>crie um <code>local_file "cartao"</code> com <code>filename = "cartao.txt"</code>;</li>
          <li>o <code>content</code> do arquivo deve ser o nome gerado: <code>random_pet.nome.id</code> (sem aspas!).</li>
        </ul>
        <p>No plano, o conteúdo aparece como <code>(known after apply)</code>: o nome só existe depois do apply.</p>`,
      dica: 'content = random_pet.nome.id',
      inicial: tf`
        resource "random_pet" "nome" {
          length = 2
        }

        # Crie o local_file "cartao" aqui
      `,
      solucao: tf`
        resource "random_pet" "nome" {
          length = 2
        }

        resource "local_file" "cartao" {
          filename = "cartao.txt"
          content  = random_pet.nome.id
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'local_file.cartao', atributo: 'filename', igual: 'cartao.txt' },
            { recurso: 'local_file.cartao', atributo: 'content', referencia: 'random_pet.nome.id' },
            { dependencia: ['local_file.cartao', 'random_pet.nome'] },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ recurso: 'local_file.cartao', atributo: 'content', regex: '^[a-z-]+-[a-z-]+$' }],
        },
      ],
    }),

    problema({
      id: 'tf-interpolacao',
      titulo: 'Texto com ${...}',
      dificuldade: 'facil',
      enunciado: `
        <p>Para colocar um valor <b>dentro</b> de um texto, use <code>\${ }</code> (interpolação).</p>
        <ul>
          <li>o <code>content</code> do <code>local_file "cartao"</code> deve ficar <code>"Servidor: \${random_pet.nome.id}"</code>;</li>
          <li>depois do apply, o arquivo terá algo como <code>Servidor: valente-tatu</code>.</li>
        </ul>`,
      dica: 'content = "Servidor: ${random_pet.nome.id}"',
      inicial: tf`
        resource "random_pet" "nome" {
          length = 2
        }

        resource "local_file" "cartao" {
          filename = "cartao.txt"
          content  = "Servidor: "
        }
      `,
      solucao: tf`
        resource "random_pet" "nome" {
          length = 2
        }

        resource "local_file" "cartao" {
          filename = "cartao.txt"
          content  = "Servidor: \${random_pet.nome.id}"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'local_file.cartao', atributo: 'content', referencia: 'random_pet.nome.id' },
            { codigo: 'Servidor: \\$\\{\\s*random_pet\\.nome\\.id\\s*\\}', msg: 'O texto usa "Servidor: ${random_pet.nome.id}"' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ recurso: 'local_file.cartao', atributo: 'content', regex: '^Servidor: [a-z-]+$' }],
        },
      ],
    }),

    problema({
      id: 'tf-heredoc',
      titulo: 'Texto de várias linhas (heredoc)',
      dificuldade: 'facil',
      enunciado: `
        <p>Para textos com várias linhas, use um <b>heredoc</b>: <code>&lt;&lt;-EOT</code> abre, e uma linha só com
        <code>EOT</code> fecha. O <code>-</code> permite recuar o texto junto com o código.</p>
        <ul>
          <li>o <code>content</code> do <code>local_file "lista"</code> deve ter 3 linhas: <code>arroz</code>,
            <code>feijão</code> e <code>farinha</code>;</li>
          <li>escreva com <code>&lt;&lt;-EOT</code> ... <code>EOT</code>.</li>
        </ul>`,
      dica: 'content = <<-EOT\n    arroz\n    feijão\n    farinha\n  EOT',
      inicial: tf`
        resource "local_file" "lista" {
          filename = "compras.txt"
          content  = "arroz"
        }
      `,
      solucao: tf`
        resource "local_file" "lista" {
          filename = "compras.txt"
          content  = <<-EOT
            arroz
            feijão
            farinha
          EOT
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'local_file.lista', atributo: 'content', igual: 'arroz\nfeijão\nfarinha\n' },
            { codigo: '<<-?EOT', msg: 'O código usa um heredoc (<<-EOT)' },
          ],
        },
      ],
    }),

    problema({
      id: 'tf-corrigir-sintaxe',
      titulo: 'Caça aos erros de sintaxe',
      dificuldade: 'facil',
      enunciado: `
        <p>Este código tem <b>3 erros</b> de digitação. Rode o <b>▶ Plan</b>, leia cada erro no terminal (ele diz a linha)
        e corrija um de cada vez.</p>
        <ul>
          <li>o resultado deve criar o <code>local_file "nota"</code>;</li>
          <li>com <code>filename = "nota.txt"</code> e <code>content = "Aprendendo HCL"</code>.</li>
        </ul>`,
      dica: 'Argumentos usam "=" (não ":"), textos ficam entre aspas e todo { precisa de }.',
      inicial: tf`
        resource "local_file" "nota" {
          filename: "nota.txt"
          content  = "Aprendendo HCL
      `,
      solucao: tf`
        resource "local_file" "nota" {
          filename = "nota.txt"
          content  = "Aprendendo HCL"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'local_file.nota', atributo: 'filename', igual: 'nota.txt' },
            { recurso: 'local_file.nota', atributo: 'content', igual: 'Aprendendo HCL' },
          ],
        },
      ],
    }),

    licao({
      id: 'licao-variaveis-outputs',
      titulo: 'Variáveis e outputs',
      resumo: `
        <p><b>Variáveis</b> (<code>variable</code>) deixam o código reutilizável: o mesmo código cria o ambiente de
        dev e o de produção, só mudando os valores.</p>
        <ul>
          <li><code>type</code>: o tipo do valor (<code>string</code>, <code>number</code>, <code>bool</code>,
            <code>list(string)</code>, <code>map(string)</code>, <code>object({...})</code>);</li>
          <li><code>default</code>: o valor usado se ninguém passar outro;</li>
          <li><code>description</code>: explica para que serve (aparece na documentação).</li>
        </ul>
        <p>Para usar: <code>var.nome</code>. Os valores podem vir do <code>default</code>, de um arquivo
        <code>terraform.tfvars</code> ou da linha de comando (<code>-var="nome=valor"</code>).</p>
        <p><b>Outputs</b> (<code>output</code>) mostram valores no fim do apply, como o IP de um servidor.
        Eles também são o jeito de um módulo devolver valores.</p>
        <p>Rode <b>▶ Plan</b>, depois <b>✔ Apply</b> e veja a aba <b>📤 Outputs</b>.</p>`,
      codigo: tf`
        variable "projeto" {
          type        = string
          description = "Nome do projeto"
          default     = "sertao"
        }

        variable "copias" {
          type    = number
          default = 2
        }

        resource "random_pet" "servidor" {
          prefix = var.projeto
        }

        output "nome_do_servidor" {
          description = "Nome gerado para o servidor"
          value       = random_pet.servidor.id
        }

        output "copias" {
          value = var.copias
        }
      `,
    }),

    problema({
      id: 'tf-variavel-default',
      titulo: 'Sua primeira variável',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>declare uma <code>variable "nome_arquivo"</code> do tipo <code>string</code> com <code>default = "notas.txt"</code>;</li>
          <li>use a variável no <code>filename</code> do <code>local_file "notas"</code>: <code>filename = var.nome_arquivo</code>.</li>
        </ul>`,
      dica: 'variable "nome_arquivo" { type = string  default = "notas.txt" }',
      inicial: tf`
        # Declare a variable "nome_arquivo" aqui

        resource "local_file" "notas" {
          filename = "notas.txt"
          content  = "Minhas anotações"
        }
      `,
      solucao: tf`
        variable "nome_arquivo" {
          type    = string
          default = "notas.txt"
        }

        resource "local_file" "notas" {
          filename = var.nome_arquivo
          content  = "Minhas anotações"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { variavel: 'nome_arquivo', tipo: 'string', padrao: 'notas.txt' },
            { recurso: 'local_file.notas', atributo: 'filename', igual: 'notas.txt' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform plan -var="nome_arquivo=diario.txt"',
          variaveis: { nome_arquivo: 'diario.txt' },
          regras: [{ recurso: 'local_file.notas', atributo: 'filename', igual: 'diario.txt' }],
        },
      ],
    }),

    problema({
      id: 'tf-variavel-numero',
      titulo: 'Variáveis numéricas',
      dificuldade: 'facil',
      enunciado: `
        <p>Vamos simular um dado de jogo com o <code>random_integer</code>.</p>
        <ul>
          <li>declare <code>variable "minimo"</code> (tipo <code>number</code>, default <code>1</code>);</li>
          <li>declare <code>variable "maximo"</code> (tipo <code>number</code>, default <code>6</code>);</li>
          <li>use as duas no <code>random_integer "dado"</code>: <code>min = var.minimo</code> e <code>max = var.maximo</code>.</li>
        </ul>`,
      dica: 'type = number e default sem aspas: default = 1',
      inicial: tf`
        resource "random_integer" "dado" {
          min = 1
          max = 6
        }
      `,
      solucao: tf`
        variable "minimo" {
          type    = number
          default = 1
        }

        variable "maximo" {
          type    = number
          default = 6
        }

        resource "random_integer" "dado" {
          min = var.minimo
          max = var.maximo
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { variavel: 'minimo', tipo: 'number', padrao: 1 },
            { variavel: 'maximo', tipo: 'number', padrao: 6 },
            { recurso: 'random_integer.dado', atributo: 'max', igual: 6 },
          ],
        },
        {
          oculto: true,
          descricao: 'dado de 20 lados',
          variaveis: { minimo: 1, maximo: 20 },
          regras: [{ recurso: 'random_integer.dado', atributo: 'max', igual: 20 }],
        },
      ],
    }),

    problema({
      id: 'tf-variavel-descricao',
      titulo: 'Variável bem documentada',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>declare <code>variable "ambiente"</code> com <code>type = string</code>, <code>default = "dev"</code>
            e uma <code>description</code> explicando o que ela é;</li>
          <li>o <code>content</code> do <code>local_file "config"</code> deve ser <code>"ambiente=\${var.ambiente}"</code>.</li>
        </ul>`,
      dica: 'description = "Ambiente de implantação (dev ou prod)"',
      inicial: tf`
        resource "local_file" "config" {
          filename = "app.env"
          content  = "ambiente=dev"
        }
      `,
      solucao: tf`
        variable "ambiente" {
          type        = string
          description = "Ambiente de implantação (dev, hml ou prod)"
          default     = "dev"
        }

        resource "local_file" "config" {
          filename = "app.env"
          content  = "ambiente=\${var.ambiente}"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { variavel: 'ambiente', tipo: 'string', padrao: 'dev', descricao: true },
            { recurso: 'local_file.config', atributo: 'content', igual: 'ambiente=dev' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform plan -var="ambiente=prod"',
          variaveis: { ambiente: 'prod' },
          regras: [{ recurso: 'local_file.config', atributo: 'content', igual: 'ambiente=prod' }],
        },
      ],
    }),

    problema({
      id: 'tf-tfvars',
      titulo: 'Valores no terraform.tfvars',
      dificuldade: 'medio',
      enunciado: `
        <p>A variável <code>projeto</code> não tem default, então o plan falha pedindo um valor. Em vez de pôr um default,
        crie um arquivo de valores.</p>
        <ul>
          <li>clique no <b>+</b> do editor e crie o arquivo <code>terraform.tfvars</code>;</li>
          <li>dentro dele, escreva <code>projeto = "caatinga"</code>;</li>
          <li>não coloque default na variável: o valor deve vir do arquivo.</li>
        </ul>`,
      dica: 'O terraform.tfvars só tem linhas nome = valor, sem blocos.',
      inicial: tf`
        variable "projeto" {
          type = string
        }

        resource "random_pet" "servidor" {
          prefix = var.projeto
        }
      `,
      solucao: {
        'main.tf': tf`
          variable "projeto" {
            type = string
          }

          resource "random_pet" "servidor" {
            prefix = var.projeto
          }
        `,
        'terraform.tfvars': tf`
          projeto = "caatinga"
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { arquivo: 'terraform.tfvars' },
            { variavel: 'projeto', semPadrao: true },
            { recurso: 'random_pet.servidor', atributo: 'prefix', igual: 'caatinga' },
          ],
        },
        {
          oculto: true,
          descricao: '-var vence o tfvars',
          variaveis: { projeto: 'sertao' },
          regras: [{ recurso: 'random_pet.servidor', atributo: 'prefix', igual: 'sertao' }],
        },
      ],
    }),

    problema({
      id: 'tf-validacao',
      titulo: 'Validar a entrada',
      dificuldade: 'medio',
      enunciado: `
        <p>Um bloco <code>validation</code> recusa valores errados <b>antes</b> de criar qualquer coisa.</p>
        <ul>
          <li>na <code>variable "ambiente"</code>, crie um bloco <code>validation</code>;</li>
          <li>com <code>condition = contains(["dev", "hml", "prod"], var.ambiente)</code>;</li>
          <li>e uma <code>error_message</code> explicando os valores aceitos.</li>
        </ul>`,
      dica: 'validation { condition = contains([...], var.ambiente)  error_message = "..." }',
      inicial: tf`
        variable "ambiente" {
          type    = string
          default = "dev"
        }

        resource "local_file" "config" {
          filename = "\${var.ambiente}.env"
          content  = "AMBIENTE=\${var.ambiente}"
        }
      `,
      solucao: tf`
        variable "ambiente" {
          type    = string
          default = "dev"

          validation {
            condition     = contains(["dev", "hml", "prod"], var.ambiente)
            error_message = "O ambiente deve ser dev, hml ou prod."
          }
        }

        resource "local_file" "config" {
          filename = "\${var.ambiente}.env"
          content  = "AMBIENTE=\${var.ambiente}"
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { variavel: 'ambiente', validacao: true }] },
        {
          descricao: 'terraform plan -var="ambiente=teste"',
          variaveis: { ambiente: 'teste' },
          regras: [{ erro: 'Invalid value for variable', msg: 'Com ambiente = "teste", o Terraform recusa' }],
        },
        {
          oculto: true,
          descricao: 'terraform plan -var="ambiente=prod"',
          variaveis: { ambiente: 'prod' },
          regras: [{ semErros: true }, { recurso: 'local_file.config', atributo: 'filename', igual: 'prod.env' }],
        },
      ],
    }),

    problema({
      id: 'tf-sensivel',
      titulo: 'Segredos com sensitive',
      dificuldade: 'medio',
      enunciado: `
        <p>Rode o plan: o Terraform recusa mostrar uma senha num output. Valores sensíveis precisam ser marcados.</p>
        <ul>
          <li>na <code>variable "senha_banco"</code>, acrescente <code>sensitive = true</code>;</li>
          <li>no <code>output "senha"</code>, também acrescente <code>sensitive = true</code>;</li>
          <li>assim o valor aparece como <code>&lt;sensitive&gt;</code> no terminal.</li>
        </ul>`,
      dica: 'sensitive = true nos dois blocos',
      inicial: tf`
        variable "senha_banco" {
          type    = string
          default = "troque-me-123"
        }

        output "senha" {
          value = var.senha_banco
        }
      `,
      solucao: tf`
        variable "senha_banco" {
          type      = string
          default   = "troque-me-123"
          sensitive = true
        }

        output "senha" {
          value     = var.senha_banco
          sensitive = true
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { variavel: 'senha_banco', sensivel: true },
            { saida: 'senha', sensivel: true },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [{ texto: 'senha = <sensitive>', msg: 'O apply mostra senha = <sensitive>' }],
        },
      ],
    }),

    problema({
      id: 'tf-lista',
      titulo: 'Listas',
      dificuldade: 'facil',
      enunciado: `
        <p>Uma lista guarda vários valores em ordem. O primeiro item é o <code>[0]</code>.</p>
        <ul>
          <li>declare <code>variable "regioes"</code> com <code>type = list(string)</code> e default
            <code>["sa-east-1", "us-east-1", "eu-west-1"]</code>;</li>
          <li>crie <code>output "primeira"</code> com o primeiro item: <code>var.regioes[0]</code>;</li>
          <li>crie <code>output "quantidade"</code> com <code>length(var.regioes)</code>.</li>
        </ul>`,
      dica: 'output "quantidade" { value = length(var.regioes) }',
      inicial: tf`
        # variable "regioes" { ... }
        # output "primeira" { ... }
        # output "quantidade" { ... }
      `,
      solucao: tf`
        variable "regioes" {
          type    = list(string)
          default = ["sa-east-1", "us-east-1", "eu-west-1"]
        }

        output "primeira" {
          value = var.regioes[0]
        }

        output "quantidade" {
          value = length(var.regioes)
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { variavel: 'regioes', tipo: 'list of string' },
            { saida: 'primeira', igual: 'sa-east-1' },
            { saida: 'quantidade', igual: 3 },
          ],
        },
        {
          oculto: true,
          descricao: 'outra lista',
          variaveis: { regioes: ['eu-north-1', 'ap-south-1'] },
          regras: [{ saida: 'primeira', igual: 'eu-north-1' }, { saida: 'quantidade', igual: 2 }],
        },
      ],
    }),

    problema({
      id: 'tf-mapa',
      titulo: 'Mapas e lookup',
      dificuldade: 'medio',
      enunciado: `
        <p>Um mapa liga chaves a valores, como uma agenda. Aqui, cada ambiente tem um tamanho de servidor.</p>
        <ul>
          <li>a <code>variable "tamanhos"</code> já existe (tipo <code>map(string)</code>);</li>
          <li>crie <code>output "tamanho"</code> com <code>lookup(var.tamanhos, var.ambiente, "t3.nano")</code>;</li>
          <li>se o ambiente não estiver no mapa, o valor deve ser <code>"t3.nano"</code>.</li>
        </ul>`,
      dica: 'lookup(mapa, chave, valor_padrao)',
      inicial: tf`
        variable "tamanhos" {
          type = map(string)
          default = {
            dev  = "t3.micro"
            prod = "t3.large"
          }
        }

        variable "ambiente" {
          type    = string
          default = "dev"
        }

        # output "tamanho" { ... }
      `,
      solucao: tf`
        variable "tamanhos" {
          type = map(string)
          default = {
            dev  = "t3.micro"
            prod = "t3.large"
          }
        }

        variable "ambiente" {
          type    = string
          default = "dev"
        }

        output "tamanho" {
          value = lookup(var.tamanhos, var.ambiente, "t3.nano")
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'tamanho', igual: 't3.micro' }] },
        { descricao: 'ambiente = "prod"', variaveis: { ambiente: 'prod' }, regras: [{ saida: 'tamanho', igual: 't3.large' }] },
        { oculto: true, descricao: 'ambiente fora do mapa', variaveis: { ambiente: 'qa' }, regras: [{ semErros: true }, { saida: 'tamanho', igual: 't3.nano' }] },
      ],
    }),

    problema({
      id: 'tf-objeto',
      titulo: 'Objetos com campos opcionais',
      dificuldade: 'dificil',
      enunciado: `
        <p>Um <code>object</code> agrupa campos com tipos diferentes. Com <code>optional()</code>, um campo pode faltar.</p>
        <ul>
          <li>declare <code>variable "servidor"</code> com
            <code>type = object({ nome = string, cpu = number, publico = optional(bool, false) })</code>;</li>
          <li>default: <code>{ nome = "web", cpu = 2 }</code> (sem o publico);</li>
          <li>crie <code>output "resumo"</code> com o texto <code>"web com 2 vCPU (público: false)"</code>, montado a partir da variável.</li>
        </ul>`,
      dica: '"${var.servidor.nome} com ${var.servidor.cpu} vCPU (público: ${var.servidor.publico})"',
      inicial: tf`
        # variable "servidor" { ... }
        # output "resumo" { ... }
      `,
      solucao: tf`
        variable "servidor" {
          type = object({
            nome    = string
            cpu     = number
            publico = optional(bool, false)
          })
          default = {
            nome = "web"
            cpu  = 2
          }
        }

        output "resumo" {
          value = "\${var.servidor.nome} com \${var.servidor.cpu} vCPU (público: \${var.servidor.publico})"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { variavel: 'servidor', tipo: 'object' },
            { saida: 'resumo', igual: 'web com 2 vCPU (público: false)' },
          ],
        },
        {
          oculto: true,
          descricao: 'outro servidor',
          variaveis: { servidor: { nome: 'api', cpu: 4, publico: true } },
          regras: [{ saida: 'resumo', igual: 'api com 4 vCPU (público: true)' }],
        },
      ],
    }),

    problema({
      id: 'tf-output',
      titulo: 'Output de um valor calculado',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie um <code>random_integer "porta"</code> entre <code>8000</code> e <code>8999</code>;</li>
          <li>crie <code>output "porta"</code> com o número sorteado: <code>random_integer.porta.result</code>;</li>
          <li>dê uma <code>description</code> ao output.</li>
        </ul>
        <p>No plan, o output aparece como <code>(known after apply)</code>. Rode <b>✔ Apply</b> para ver o número.</p>`,
      dica: 'output "porta" { description = "..."  value = random_integer.porta.result }',
      inicial: tf`
        # resource "random_integer" "porta" { ... }
        # output "porta" { ... }
      `,
      solucao: tf`
        resource "random_integer" "porta" {
          min = 8000
          max = 8999
        }

        output "porta" {
          description = "Porta sorteada para o serviço"
          value       = random_integer.porta.result
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'random_integer.porta', atributo: 'min', igual: 8000 },
            { recurso: 'random_integer.porta', atributo: 'max', igual: 8999 },
            { saida: 'porta', conhecido: false },
            { saida: 'porta', descricao: true },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'porta', tipo: 'number' }] },
      ],
    }),

    problema({
      id: 'tf-output-colecoes',
      titulo: 'Outputs com listas e objetos',
      dificuldade: 'medio',
      enunciado: `
        <p>Um output pode devolver uma lista ou um objeto inteiro.</p>
        <ul>
          <li><code>output "portas"</code> com a lista <code>[80, 443]</code>;</li>
          <li><code>output "servidor"</code> com o objeto <code>{ nome = random_pet.nome.id, porta = 443 }</code>.</li>
        </ul>`,
      dica: 'value = { nome = random_pet.nome.id, porta = 443 }',
      inicial: tf`
        resource "random_pet" "nome" {}

        # output "portas" { ... }
        # output "servidor" { ... }
      `,
      solucao: tf`
        resource "random_pet" "nome" {}

        output "portas" {
          value = [80, 443]
        }

        output "servidor" {
          value = {
            nome  = random_pet.nome.id
            porta = 443
          }
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'portas', igual: [80, 443] }, { saida: 'servidor', tipo: 'map' }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'servidor', contem: '"porta":443' }] },
      ],
    }),

    licao({
      id: 'licao-expressoes',
      titulo: 'Locals, expressões e funções',
      resumo: `
        <p><b>Locals</b> são valores calculados uma vez e reutilizados: <code>local.nome</code>. Pense neles como
        "apelidos" para expressões longas.</p>
        <p>Algumas expressões úteis:</p>
        <ul>
          <li>condição: <code>var.ambiente == "prod" ? 3 : 1</code>;</li>
          <li>for: <code>[for n in var.nomes : upper(n)]</code>;</li>
          <li>funções: <code>upper()</code>, <code>join()</code>, <code>merge()</code>, <code>length()</code>,
            <code>cidrsubnet()</code>, <code>jsonencode()</code>, <code>file()</code>, <code>templatefile()</code>.</li>
        </ul>
        <p>Rode o plan e veja os valores na aba <b>📤 Outputs</b>. Mude a variável e rode de novo.</p>`,
      codigo: tf`
        variable "ambiente" {
          type    = string
          default = "dev"
        }

        locals {
          prefixo   = "sertao-\${var.ambiente}"
          servidores = var.ambiente == "prod" ? 3 : 1
          tags = {
            projeto  = "sertao"
            ambiente = var.ambiente
          }
        }

        output "prefixo" {
          value = upper(local.prefixo)
        }

        output "servidores" {
          value = local.servidores
        }

        output "subredes" {
          value = [for i in range(3) : cidrsubnet("10.0.0.0/16", 8, i)]
        }
      `,
    }),

    problema({
      id: 'tf-locals',
      titulo: 'Um prefixo com locals',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie um bloco <code>locals</code> com <code>prefixo = "\${var.projeto}-\${var.ambiente}"</code>;</li>
          <li>use o local no nome do arquivo: <code>filename = "\${local.prefixo}.txt"</code>.</li>
        </ul>`,
      dica: 'locals { prefixo = "..." } e depois local.prefixo (no singular)',
      inicial: tf`
        variable "projeto" {
          default = "sertao"
        }

        variable "ambiente" {
          default = "dev"
        }

        resource "local_file" "info" {
          filename = "info.txt"
          content  = "gerado pelo Terraform"
        }
      `,
      solucao: tf`
        variable "projeto" {
          default = "sertao"
        }

        variable "ambiente" {
          default = "dev"
        }

        locals {
          prefixo = "\${var.projeto}-\${var.ambiente}"
        }

        resource "local_file" "info" {
          filename = "\${local.prefixo}.txt"
          content  = "gerado pelo Terraform"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { local: 'prefixo', igual: 'sertao-dev' },
            { recurso: 'local_file.info', atributo: 'filename', igual: 'sertao-dev.txt' },
          ],
        },
        {
          oculto: true,
          descricao: 'ambiente = "prod"',
          variaveis: { ambiente: 'prod' },
          regras: [{ recurso: 'local_file.info', atributo: 'filename', igual: 'sertao-prod.txt' }],
        },
      ],
    }),

    problema({
      id: 'tf-condicional',
      titulo: 'Expressão condicional',
      dificuldade: 'medio',
      enunciado: `
        <p>Produção precisa de mais servidores do que desenvolvimento.</p>
        <ul>
          <li>crie <code>locals { quantidade = ... }</code> que vale <code>3</code> se <code>var.ambiente</code> for
            <code>"prod"</code> e <code>1</code> nos outros casos;</li>
          <li>crie <code>output "servidores"</code> com <code>local.quantidade</code>.</li>
        </ul>`,
      dica: 'condição ? valor_se_sim : valor_se_não',
      inicial: tf`
        variable "ambiente" {
          type    = string
          default = "dev"
        }
      `,
      solucao: tf`
        variable "ambiente" {
          type    = string
          default = "dev"
        }

        locals {
          quantidade = var.ambiente == "prod" ? 3 : 1
        }

        output "servidores" {
          value = local.quantidade
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'servidores', igual: 1 }] },
        { descricao: 'ambiente = "prod"', variaveis: { ambiente: 'prod' }, regras: [{ saida: 'servidores', igual: 3 }] },
        { oculto: true, descricao: 'ambiente = "hml"', variaveis: { ambiente: 'hml' }, regras: [{ saida: 'servidores', igual: 1 }] },
      ],
    }),

    problema({
      id: 'tf-funcoes-texto',
      titulo: 'Funções de texto',
      dificuldade: 'facil',
      enunciado: `
        <p>Nomes de recursos costumam ser em minúsculas e sem espaços.</p>
        <ul>
          <li>crie <code>output "slug"</code> que transforma <code>var.nome</code> em minúsculas e troca os espaços por <code>-</code>;</li>
          <li>com o default <code>"Meu Projeto Legal"</code>, o resultado é <code>"meu-projeto-legal"</code>.</li>
        </ul>`,
      dica: 'lower(replace(var.nome, " ", "-"))',
      inicial: tf`
        variable "nome" {
          type    = string
          default = "Meu Projeto Legal"
        }
      `,
      solucao: tf`
        variable "nome" {
          type    = string
          default = "Meu Projeto Legal"
        }

        output "slug" {
          value = lower(replace(var.nome, " ", "-"))
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'slug', igual: 'meu-projeto-legal' }] },
        { oculto: true, descricao: 'outro nome', variaveis: { nome: 'Loja Do Sertao' }, regras: [{ saida: 'slug', igual: 'loja-do-sertao' }] },
      ],
    }),

    problema({
      id: 'tf-join-split',
      titulo: 'split e join',
      dificuldade: 'facil',
      enunciado: `
        <p><code>split</code> quebra um texto numa lista; <code>join</code> junta uma lista num texto.</p>
        <ul>
          <li><code>output "lista"</code>: quebre <code>var.csv</code> nas vírgulas → <code>["web", "api", "db"]</code>;</li>
          <li><code>output "texto"</code>: junte essa lista com <code>" | "</code> → <code>"web | api | db"</code>.</li>
        </ul>`,
      dica: 'split(",", var.csv) e join(" | ", ...)',
      inicial: tf`
        variable "csv" {
          type    = string
          default = "web,api,db"
        }
      `,
      solucao: tf`
        variable "csv" {
          type    = string
          default = "web,api,db"
        }

        output "lista" {
          value = split(",", var.csv)
        }

        output "texto" {
          value = join(" | ", split(",", var.csv))
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'lista', igual: ['web', 'api', 'db'] }, { saida: 'texto', igual: 'web | api | db' }] },
        { oculto: true, descricao: 'outro csv', variaveis: { csv: 'a,b' }, regras: [{ saida: 'texto', igual: 'a | b' }] },
      ],
    }),

    problema({
      id: 'tf-merge',
      titulo: 'Juntar mapas de tags',
      dificuldade: 'medio',
      enunciado: `
        <p>É comum ter tags padrão para todos os recursos e tags extras por projeto.</p>
        <ul>
          <li>crie <code>output "tags"</code> com a junção de <code>local.tags_padrao</code> e <code>var.tags_extras</code>;</li>
          <li>use <code>merge()</code>: quando a mesma chave aparece nos dois, vale a do último mapa.</li>
        </ul>`,
      dica: 'merge(local.tags_padrao, var.tags_extras)',
      inicial: tf`
        locals {
          tags_padrao = {
            projeto        = "sertao"
            gerenciado_por = "terraform"
          }
        }

        variable "tags_extras" {
          type    = map(string)
          default = { time = "infra" }
        }
      `,
      solucao: tf`
        locals {
          tags_padrao = {
            projeto        = "sertao"
            gerenciado_por = "terraform"
          }
        }

        variable "tags_extras" {
          type    = map(string)
          default = { time = "infra" }
        }

        output "tags" {
          value = merge(local.tags_padrao, var.tags_extras)
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'tags', igual: { projeto: 'sertao', gerenciado_por: 'terraform', time: 'infra' } }] },
        {
          oculto: true,
          descricao: 'a tag extra sobrescreve a padrão',
          variaveis: { tags_extras: { projeto: 'cangaco' } },
          regras: [{ saida: 'tags', igual: { projeto: 'cangaco', gerenciado_por: 'terraform' } }],
        },
      ],
    }),

    problema({
      id: 'tf-for-lista',
      titulo: 'for em listas',
      dificuldade: 'medio',
      enunciado: `
        <p>A expressão <code>for</code> transforma cada item de uma lista.</p>
        <ul>
          <li>crie <code>output "usuarios"</code> com todos os nomes em maiúsculas;</li>
          <li>use <code>[for n in var.nomes : upper(n)]</code>.</li>
        </ul>`,
      dica: '[for item in lista : transformação]',
      inicial: tf`
        variable "nomes" {
          type    = list(string)
          default = ["ana", "bruno", "carla"]
        }
      `,
      solucao: tf`
        variable "nomes" {
          type    = list(string)
          default = ["ana", "bruno", "carla"]
        }

        output "usuarios" {
          value = [for n in var.nomes : upper(n)]
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'usuarios', igual: ['ANA', 'BRUNO', 'CARLA'] }, { codigo: '\\[\\s*for\\s', msg: 'O código usa uma expressão for' }] },
        { oculto: true, descricao: 'outros nomes', variaveis: { nomes: ['davi'] }, regras: [{ saida: 'usuarios', igual: ['DAVI'] }] },
      ],
    }),

    problema({
      id: 'tf-for-mapa',
      titulo: 'for com filtro em mapas',
      dificuldade: 'dificil',
      enunciado: `
        <p>Com <code>for</code> também dá para montar um mapa e filtrar com <code>if</code>.</p>
        <ul>
          <li>crie <code>output "grandes"</code> só com os servidores que têm <code>4</code> CPUs ou mais;</li>
          <li>o resultado deve ser um mapa: <code>{ api = 4, db = 8 }</code>.</li>
        </ul>`,
      dica: '{ for nome, cpu in var.servidores : nome => cpu if cpu >= 4 }',
      inicial: tf`
        variable "servidores" {
          type = map(number)
          default = {
            web = 2
            api = 4
            db  = 8
          }
        }
      `,
      solucao: tf`
        variable "servidores" {
          type = map(number)
          default = {
            web = 2
            api = 4
            db  = 8
          }
        }

        output "grandes" {
          value = { for nome, cpu in var.servidores : nome => cpu if cpu >= 4 }
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'grandes', igual: { api: 4, db: 8 } }] },
        { oculto: true, descricao: 'outros servidores', variaveis: { servidores: { cache: 1, fila: 16 } }, regras: [{ saida: 'grandes', igual: { fila: 16 } }] },
      ],
    }),

    problema({
      id: 'tf-cidr',
      titulo: 'Calculando sub-redes',
      dificuldade: 'medio',
      enunciado: `
        <p><code>cidrsubnet(rede, bits_novos, número)</code> divide uma rede em pedaços. Com uma rede /16 e 8 bits
        novos, cada sub-rede vira um /24.</p>
        <ul>
          <li>crie <code>output "subredes"</code> com as 3 primeiras sub-redes /24 de <code>var.rede</code>;</li>
          <li>com o default, o resultado é <code>["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24"]</code>.</li>
        </ul>`,
      dica: '[for i in range(3) : cidrsubnet(var.rede, 8, i)]',
      inicial: tf`
        variable "rede" {
          type    = string
          default = "10.0.0.0/16"
        }
      `,
      solucao: tf`
        variable "rede" {
          type    = string
          default = "10.0.0.0/16"
        }

        output "subredes" {
          value = [for i in range(3) : cidrsubnet(var.rede, 8, i)]
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'subredes', igual: ['10.0.0.0/24', '10.0.1.0/24', '10.0.2.0/24'] }] },
        { oculto: true, descricao: 'outra rede', variaveis: { rede: '172.16.0.0/16' }, regras: [{ saida: 'subredes', igual: ['172.16.0.0/24', '172.16.1.0/24', '172.16.2.0/24'] }] },
      ],
    }),

    problema({
      id: 'tf-jsonencode',
      titulo: 'Gerando JSON',
      dificuldade: 'medio',
      enunciado: `
        <p>Muitos serviços recebem configuração em JSON. Em vez de escrever o texto à mão, monte um objeto HCL e
        converta com <code>jsonencode()</code>.</p>
        <ul>
          <li>o <code>content</code> do <code>local_file "config"</code> deve ser
            <code>jsonencode({ app = "loja", porta = 8080, debug = false })</code>.</li>
        </ul>`,
      dica: 'content = jsonencode({ ... })',
      inicial: tf`
        resource "local_file" "config" {
          filename = "config.json"
          content  = "{}"
        }
      `,
      solucao: tf`
        resource "local_file" "config" {
          filename = "config.json"
          content = jsonencode({
            app   = "loja"
            porta = 8080
            debug = false
          })
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'local_file.config', atributo: 'content', igual: '{"app":"loja","debug":false,"porta":8080}' },
            { codigo: 'jsonencode\\(', msg: 'O código usa jsonencode()' },
          ],
        },
      ],
    }),

    problema({
      id: 'tf-templatefile',
      titulo: 'Arquivos de modelo (templatefile)',
      dificuldade: 'medio',
      enunciado: `
        <p>O arquivo <code>boas-vindas.tpl</code> é um modelo com lacunas <code>\${nome}</code> e <code>\${ambiente}</code>.</p>
        <ul>
          <li>no <code>content</code>, use <code>templatefile("boas-vindas.tpl", { ... })</code>;</li>
          <li>passe <code>nome = var.nome</code> e <code>ambiente = "dev"</code>;</li>
          <li>com o default, o arquivo fica <code>"Olá, Ana! Seu ambiente é dev."</code> (com quebra de linha no fim).</li>
        </ul>`,
      dica: 'templatefile("boas-vindas.tpl", { nome = var.nome, ambiente = "dev" })',
      inicial: {
        'main.tf': tf`
          variable "nome" {
            type    = string
            default = "Ana"
          }

          resource "local_file" "mensagem" {
            filename = "mensagem.txt"
            content  = ""
          }
        `,
        'boas-vindas.tpl': 'Olá, ${nome}! Seu ambiente é ${ambiente}.\n',
      },
      solucao: {
        'main.tf': tf`
          variable "nome" {
            type    = string
            default = "Ana"
          }

          resource "local_file" "mensagem" {
            filename = "mensagem.txt"
            content = templatefile("boas-vindas.tpl", {
              nome     = var.nome
              ambiente = "dev"
            })
          }
        `,
        'boas-vindas.tpl': 'Olá, ${nome}! Seu ambiente é ${ambiente}.\n',
      },
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'local_file.mensagem', atributo: 'content', igual: 'Olá, Ana! Seu ambiente é dev.\n' }] },
        { oculto: true, descricao: 'outro nome', variaveis: { nome: 'Rui' }, regras: [{ recurso: 'local_file.mensagem', atributo: 'content', igual: 'Olá, Rui! Seu ambiente é dev.\n' }] },
      ],
    }),

    problema({
      id: 'tf-file',
      titulo: 'Lendo um arquivo com file()',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>o <code>local_file "copia"</code> deve ter o mesmo conteúdo do arquivo <code>mensagem.txt</code>;</li>
          <li>use <code>content = file("mensagem.txt")</code>.</li>
        </ul>`,
      dica: 'file("caminho/do/arquivo")',
      inicial: {
        'main.tf': tf`
          resource "local_file" "copia" {
            filename = "copia.txt"
            content  = "?"
          }
        `,
        'mensagem.txt': 'Bem-vindo ao sertão\n',
      },
      solucao: {
        'main.tf': tf`
          resource "local_file" "copia" {
            filename = "copia.txt"
            content  = file("mensagem.txt")
          }
        `,
        'mensagem.txt': 'Bem-vindo ao sertão\n',
      },
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'local_file.copia', atributo: 'content', igual: 'Bem-vindo ao sertão\n' }, { codigo: 'file\\(', msg: 'O código usa file()' }] },
      ],
    }),

    problema({
      id: 'tf-try',
      titulo: 'Valores que podem faltar: try()',
      dificuldade: 'dificil',
      enunciado: `
        <p><code>try(a, b)</code> devolve <code>a</code> se funcionar; se der erro (por exemplo, um campo que não existe), devolve <code>b</code>.</p>
        <ul>
          <li><code>output "porta"</code>: <code>var.config.porta</code> ou <code>8080</code> se não houver porta;</li>
          <li><code>output "nome"</code>: <code>var.config.nome</code> ou <code>"padrao"</code> se não houver nome.</li>
        </ul>`,
      dica: 'try(var.config.porta, 8080)',
      inicial: tf`
        variable "config" {
          type    = any
          default = { nome = "app" }
        }

        output "porta" {
          value = var.config.porta
        }
      `,
      solucao: tf`
        variable "config" {
          type    = any
          default = { nome = "app" }
        }

        output "porta" {
          value = try(var.config.porta, 8080)
        }

        output "nome" {
          value = try(var.config.nome, "padrao")
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'porta', igual: 8080 }, { saida: 'nome', igual: 'app' }] },
        { oculto: true, descricao: 'config só com porta', variaveis: { config: { porta: 9000 } }, regras: [{ saida: 'porta', igual: 9000 }, { saida: 'nome', igual: 'padrao' }] },
      ],
    }),

    licao({
      id: 'licao-repeticao',
      titulo: 'Repetição: count e for_each',
      resumo: `
        <p>Para criar vários recursos iguais, não copie o bloco: use <b>count</b> ou <b>for_each</b>.</p>
        <ul>
          <li><code>count = 3</code> cria 3 instâncias: <code>recurso[0]</code>, <code>[1]</code> e <code>[2]</code>.
            Dentro do bloco, <code>count.index</code> diz qual é a vez.</li>
          <li><code>for_each = toset(["a", "b"])</code> ou um mapa cria uma instância por chave:
            <code>recurso["a"]</code>. Dentro, use <code>each.key</code> e <code>each.value</code>.</li>
        </ul>
        <p>Prefira <b>for_each</b> quando os itens têm nome: se você tirar um item do meio da lista, o count
        "empurra" os índices e recria recursos; o for_each não.</p>
        <p>Para pegar um atributo de todas as instâncias, use o <b>splat</b>: <code>random_pet.nome[*].id</code>.</p>`,
      codigo: tf`
        resource "random_pet" "servidor" {
          count = 3
          prefix = "srv\${count.index}"
        }

        resource "local_file" "time" {
          for_each = toset(["infra", "dados"])
          filename = "\${each.key}.txt"
          content  = "Time \${each.value}"
        }

        output "servidores" {
          value = random_pet.servidor[*].id
        }
      `,
    }),

    problema({
      id: 'tf-count',
      titulo: 'Três de uma vez com count',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>acrescente <code>count = 3</code> ao <code>random_pet "servidor"</code>;</li>
          <li>o plano deve criar <code>random_pet.servidor[0]</code>, <code>[1]</code> e <code>[2]</code>.</li>
        </ul>`,
      dica: 'count = 3 na primeira linha do bloco',
      inicial: tf`
        resource "random_pet" "servidor" {
          length = 2
        }
      `,
      solucao: tf`
        resource "random_pet" "servidor" {
          count  = 3
          length = 2
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { instancias: 'random_pet.servidor', quantidade: 3 }, { meta: 'random_pet.servidor', count: true }] },
      ],
    }),

    problema({
      id: 'tf-count-index',
      titulo: 'Usando count.index',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie 3 páginas numeradas a partir de 1 (o <code>count.index</code> começa em 0).</p>
        <ul>
          <li><code>count = 3</code> no <code>local_file "pagina"</code>;</li>
          <li><code>filename = "pagina-\${count.index + 1}.txt"</code>;</li>
          <li><code>content = "Página \${count.index + 1}"</code>.</li>
        </ul>`,
      dica: '${count.index + 1}',
      inicial: tf`
        resource "local_file" "pagina" {
          filename = "pagina.txt"
          content  = "Página"
        }
      `,
      solucao: tf`
        resource "local_file" "pagina" {
          count    = 3
          filename = "pagina-\${count.index + 1}.txt"
          content  = "Página \${count.index + 1}"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { instancias: 'local_file.pagina', quantidade: 3 },
            { recurso: 'local_file.pagina[0]', atributo: 'filename', igual: 'pagina-1.txt' },
            { recurso: 'local_file.pagina[2]', atributo: 'content', igual: 'Página 3' },
          ],
        },
      ],
    }),

    problema({
      id: 'tf-count-condicional',
      titulo: 'Criar ou não criar (count 0 ou 1)',
      dificuldade: 'medio',
      enunciado: `
        <p>Um truque comum: <code>count = var.ligado ? 1 : 0</code> liga e desliga um recurso.</p>
        <ul>
          <li>declare <code>variable "criar_backup"</code> do tipo <code>bool</code> com default <code>false</code>;</li>
          <li>o <code>local_file "backup"</code> só deve existir quando ela for <code>true</code>.</li>
        </ul>`,
      dica: 'count = var.criar_backup ? 1 : 0',
      inicial: tf`
        resource "local_file" "backup" {
          filename = "backup.txt"
          content  = "cópia de segurança"
        }
      `,
      solucao: tf`
        variable "criar_backup" {
          type    = bool
          default = false
        }

        resource "local_file" "backup" {
          count    = var.criar_backup ? 1 : 0
          filename = "backup.txt"
          content  = "cópia de segurança"
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { variavel: 'criar_backup', tipo: 'bool', padrao: false }, { instancias: 'local_file.backup', quantidade: 0 }] },
        { descricao: 'criar_backup = true', variaveis: { criar_backup: true }, regras: [{ instancias: 'local_file.backup', quantidade: 1 }] },
      ],
    }),

    problema({
      id: 'tf-for-each-set',
      titulo: 'for_each com conjunto',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie um arquivo por time, usando o nome do time como chave.</p>
        <ul>
          <li>no <code>local_file "time"</code>, use <code>for_each = toset(var.times)</code>;</li>
          <li><code>filename = "\${each.key}.txt"</code> e <code>content = "Time \${each.value}"</code>.</li>
        </ul>`,
      dica: 'for_each só aceita conjunto ou mapa: toset() converte a lista',
      inicial: tf`
        variable "times" {
          type    = list(string)
          default = ["infra", "dados", "web"]
        }

        resource "local_file" "time" {
          filename = "time.txt"
          content  = "Time"
        }
      `,
      solucao: tf`
        variable "times" {
          type    = list(string)
          default = ["infra", "dados", "web"]
        }

        resource "local_file" "time" {
          for_each = toset(var.times)
          filename = "\${each.key}.txt"
          content  = "Time \${each.value}"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { meta: 'local_file.time', forEach: true },
            { instancias: 'local_file.time', quantidade: 3 },
            { recurso: 'local_file.time["dados"]', atributo: 'filename', igual: 'dados.txt' },
          ],
        },
        { oculto: true, descricao: 'outros times', variaveis: { times: ['seguranca', 'mobile'] }, regras: [{ instancias: 'local_file.time', quantidade: 2 }, { recurso: 'local_file.time["mobile"]', atributo: 'content', igual: 'Time mobile' }] },
      ],
    }),

    problema({
      id: 'tf-for-each-mapa',
      titulo: 'for_each com mapa',
      dificuldade: 'medio',
      enunciado: `
        <p>Com um mapa, <code>each.key</code> é a chave e <code>each.value</code> é o valor.</p>
        <ul>
          <li>crie um <code>local_file "perfil"</code> para cada usuário de <code>var.usuarios</code>;</li>
          <li><code>filename = "\${each.key}.txt"</code> e <code>content = "papel: \${each.value}"</code>.</li>
        </ul>`,
      dica: 'for_each = var.usuarios',
      inicial: tf`
        variable "usuarios" {
          type = map(string)
          default = {
            ana   = "admin"
            bruno = "leitor"
          }
        }
      `,
      solucao: tf`
        variable "usuarios" {
          type = map(string)
          default = {
            ana   = "admin"
            bruno = "leitor"
          }
        }

        resource "local_file" "perfil" {
          for_each = var.usuarios
          filename = "\${each.key}.txt"
          content  = "papel: \${each.value}"
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { instancias: 'local_file.perfil', quantidade: 2 },
            { recurso: 'local_file.perfil["ana"]', atributo: 'content', igual: 'papel: admin' },
          ],
        },
        { oculto: true, descricao: 'outros usuários', variaveis: { usuarios: { carla: 'dev' } }, regras: [{ recurso: 'local_file.perfil["carla"]', atributo: 'filename', igual: 'carla.txt' }] },
      ],
    }),

    problema({
      id: 'tf-splat',
      titulo: 'Todos os nomes com [*]',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>o <code>random_pet "nome"</code> tem <code>count = 3</code>;</li>
          <li>crie <code>output "nomes"</code> com o <code>id</code> de todos eles usando o splat <code>[*]</code>.</li>
        </ul>`,
      dica: 'random_pet.nome[*].id',
      inicial: tf`
        resource "random_pet" "nome" {
          count = 3
        }
      `,
      solucao: tf`
        resource "random_pet" "nome" {
          count = 3
        }

        output "nomes" {
          value = random_pet.nome[*].id
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'nomes', tamanho: 3 }, { codigo: '\\[\\*\\]', msg: 'O código usa o splat [*]' }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'nomes', tamanho: 3 }, { saida: 'nomes', contem: '-' }] },
      ],
    }),

    problema({
      id: 'tf-corrigir-for-each',
      titulo: 'Conserte o for_each',
      dificuldade: 'medio',
      enunciado: `
        <p>Rode o plan: o Terraform recusa o <code>for_each</code> com uma <b>lista</b>. Ele precisa de um
        <b>conjunto de strings</b> ou de um <b>mapa</b>, porque cada item vira uma chave.</p>
        <ul>
          <li>corrija o <code>for_each</code> para o plano criar os 2 arquivos.</li>
        </ul>`,
      dica: 'toset(var.ambientes)',
      inicial: tf`
        variable "ambientes" {
          type    = list(string)
          default = ["dev", "prod"]
        }

        resource "local_file" "env" {
          for_each = var.ambientes
          filename = "\${each.key}.env"
          content  = "AMBIENTE=\${each.key}"
        }
      `,
      solucao: tf`
        variable "ambientes" {
          type    = list(string)
          default = ["dev", "prod"]
        }

        resource "local_file" "env" {
          for_each = toset(var.ambientes)
          filename = "\${each.key}.env"
          content  = "AMBIENTE=\${each.key}"
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { instancias: 'local_file.env', quantidade: 2 }, { recurso: 'local_file.env["prod"]', atributo: 'filename', igual: 'prod.env' }] },
      ],
    }),

    problema({
      id: 'tf-dynamic',
      titulo: 'Blocos dinâmicos (dynamic)',
      dificuldade: 'dificil',
      enunciado: `
        <p>O data source <code>archive_file</code> monta um .zip. Cada arquivo do zip é um bloco <code>source { }</code>.
        Para gerar um bloco por item de um mapa, use <code>dynamic</code>.</p>
        <ul>
          <li>dentro do <code>data "archive_file" "pacote"</code>, crie <code>dynamic "source"</code>;</li>
          <li>com <code>for_each = var.arquivos</code>;</li>
          <li>e um bloco <code>content</code> com <code>filename = source.key</code> e <code>content = source.value</code>.</li>
        </ul>`,
      dica: 'dynamic "source" { for_each = var.arquivos  content { filename = source.key  content = source.value } }',
      inicial: tf`
        variable "arquivos" {
          type = map(string)
          default = {
            "index.html" = "<h1>Oi</h1>"
            "estilo.css" = "h1 { color: red; }"
          }
        }

        data "archive_file" "pacote" {
          type        = "zip"
          output_path = "pacote.zip"
        }

        output "tamanho" {
          value = data.archive_file.pacote.output_size
        }
      `,
      solucao: tf`
        variable "arquivos" {
          type = map(string)
          default = {
            "index.html" = "<h1>Oi</h1>"
            "estilo.css" = "h1 { color: red; }"
          }
        }

        data "archive_file" "pacote" {
          type        = "zip"
          output_path = "pacote.zip"

          dynamic "source" {
            for_each = var.arquivos
            content {
              filename = source.key
              content  = source.value
            }
          }
        }

        output "tamanho" {
          value = data.archive_file.pacote.output_size
        }
      `,
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { codigo: 'dynamic\\s+"source"', msg: 'O código usa dynamic "source"' },
            { dado: 'archive_file.pacote', atributo: 'source', tamanho: 2 },
          ],
        },
        { oculto: true, descricao: 'três arquivos', variaveis: { arquivos: { 'a.txt': 'a', 'b.txt': 'b', 'c.txt': 'c' } }, regras: [{ dado: 'archive_file.pacote', atributo: 'source', tamanho: 3 }] },
      ],
    }),

    licao({
      id: 'licao-ciclo-de-vida',
      titulo: 'Estado, dependências e ciclo de vida',
      resumo: `
        <p>Depois do apply, o Terraform guarda no <b>estado</b> (<code>terraform.tfstate</code>) tudo o que criou.
        No próximo plan, ele compara o código com o estado e mostra só as diferenças:</p>
        <ul>
          <li><code>+</code> criar, <code>~</code> alterar no lugar, <code>-</code> destruir;</li>
          <li><code>-/+</code> <b>recriar</b>: alguns argumentos não podem mudar com o recurso vivo (o plano mostra
            <code># forces replacement</code>).</li>
        </ul>
        <p><b>Dependências</b>: se um recurso usa um valor de outro, o Terraform cria o outro primeiro (veja a aba
        <b>🕸️ Grafo</b>). Quando não há referência, use <code>depends_on</code>.</p>
        <p>O bloco <code>lifecycle</code> muda o jeito de recriar: <code>create_before_destroy</code>,
        <code>prevent_destroy</code> e <code>ignore_changes</code>.</p>
        <p>Experimente: <b>✔ Apply</b>, mude o <code>length</code> abaixo e rode <b>▶ Plan</b>.</p>`,
      codigo: tf`
        resource "random_pet" "nome" {
          length = 2
        }

        resource "local_file" "registro" {
          filename = "registro.txt"
          content  = "Servidor \${random_pet.nome.id}"

          lifecycle {
            create_before_destroy = true
          }
        }
      `,
    }),

    problema({
      id: 'tf-depends-on',
      titulo: 'Dependência explícita (depends_on)',
      dificuldade: 'medio',
      enunciado: `
        <p>O <code>terraform_data "deploy"</code> só pode rodar depois que o arquivo de configuração existir, mas ele não
        usa nenhum valor do arquivo. Diga isso ao Terraform.</p>
        <ul>
          <li>acrescente <code>depends_on = [local_file.config]</code> ao <code>terraform_data "deploy"</code>.</li>
        </ul>`,
      dica: 'depends_on = [local_file.config] (sem aspas)',
      inicial: tf`
        resource "local_file" "config" {
          filename = "app.conf"
          content  = "modo=producao"
        }

        resource "terraform_data" "deploy" {
          input = "versao-1"
        }
      `,
      solucao: tf`
        resource "local_file" "config" {
          filename = "app.conf"
          content  = "modo=producao"
        }

        resource "terraform_data" "deploy" {
          input      = "versao-1"
          depends_on = [local_file.config]
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { meta: 'terraform_data.deploy', dependsOn: 'local_file.config' }, { dependencia: ['terraform_data.deploy', 'local_file.config'] }] },
      ],
    }),

    problema({
      id: 'tf-dependencia-implicita',
      titulo: 'Dependência implícita',
      dificuldade: 'facil',
      enunciado: `
        <p>Quando um recurso usa o valor de outro, o Terraform descobre a ordem sozinho. Não precisa de depends_on.</p>
        <ul>
          <li>crie um <code>random_id "sufixo"</code> com <code>byte_length = 4</code>;</li>
          <li>no <code>local_file "nome"</code>, use <code>filename = "servidor-\${random_id.sufixo.hex}.txt"</code>;</li>
          <li>confira na aba <b>🕸️ Grafo</b> a seta de <code>local_file.nome</code> para <code>random_id.sufixo</code>.</li>
        </ul>`,
      dica: 'random_id.sufixo.hex',
      inicial: tf`
        resource "local_file" "nome" {
          filename = "servidor.txt"
          content  = "olá"
        }
      `,
      solucao: tf`
        resource "random_id" "sufixo" {
          byte_length = 4
        }

        resource "local_file" "nome" {
          filename = "servidor-\${random_id.sufixo.hex}.txt"
          content  = "olá"
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { dependencia: ['local_file.nome', 'random_id.sufixo'] }, { semCodigo: 'depends_on', msg: 'O código não usa depends_on' }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'local_file.nome', atributo: 'filename', regex: '^servidor-[0-9a-f]{8}\\.txt$' }] },
      ],
    }),

    problema({
      id: 'tf-create-before-destroy',
      titulo: 'Criar antes de destruir',
      dificuldade: 'medio',
      enunciado: `
        <p>Mudar os <code>keepers</code> recria o <code>random_pet</code>. Por padrão o Terraform apaga o velho e depois
        cria o novo (<code>-/+</code>). Para nunca ficar sem nome, inverta a ordem.</p>
        <ul>
          <li>acrescente um bloco <code>lifecycle { create_before_destroy = true }</code>;</li>
          <li>no plano de troca de versão, o símbolo passa a ser <code>+/-</code>.</li>
        </ul>`,
      dica: 'lifecycle { create_before_destroy = true }',
      inicial: tf`
        variable "versao" {
          type    = string
          default = "1"
        }

        resource "random_pet" "release" {
          keepers = {
            versao = var.versao
          }
        }
      `,
      solucao: tf`
        variable "versao" {
          type    = string
          default = "1"
        }

        resource "random_pet" "release" {
          keepers = {
            versao = var.versao
          }

          lifecycle {
            create_before_destroy = true
          }
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { lifecycle: 'random_pet.release', create_before_destroy: true }] },
        {
          descricao: 'apply com versão 1, depois plan com versão 2',
          passos: [
            { comando: 'apply', variaveis: { versao: '1' } },
            { comando: 'plan', variaveis: { versao: '2' }, regras: [{ recurso: 'random_pet.release', acao: 'substituir' }, { texto: '+/- resource "random_pet" "release"' }] },
          ],
        },
      ],
    }),

    problema({
      id: 'tf-prevent-destroy',
      titulo: 'Proteger contra destroy',
      dificuldade: 'medio',
      enunciado: `
        <p>Alguns recursos não podem ser apagados por acidente (um banco de dados com dados de clientes, por exemplo).</p>
        <ul>
          <li>proteja o <code>local_file "contrato"</code> com <code>lifecycle { prevent_destroy = true }</code>;</li>
          <li>depois do apply, um <code>terraform destroy</code> deve ser recusado.</li>
        </ul>`,
      dica: 'lifecycle { prevent_destroy = true }',
      inicial: tf`
        resource "local_file" "contrato" {
          filename = "contrato.txt"
          content  = "Contrato assinado"
        }
      `,
      solucao: tf`
        resource "local_file" "contrato" {
          filename = "contrato.txt"
          content  = "Contrato assinado"

          lifecycle {
            prevent_destroy = true
          }
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { lifecycle: 'local_file.contrato', prevent_destroy: true }] },
        {
          descricao: 'apply e depois destroy',
          passos: [{ comando: 'apply' }, { comando: 'destroy', regras: [{ erro: 'cannot be destroyed', msg: 'O terraform destroy é recusado' }] }],
        },
      ],
    }),

    problema({
      id: 'tf-ignore-changes',
      titulo: 'Ignorar mudanças feitas fora',
      dificuldade: 'medio',
      enunciado: `
        <p>Outro sistema também edita o conteúdo deste arquivo. O Terraform não deve desfazer essas mudanças.</p>
        <ul>
          <li>acrescente <code>lifecycle { ignore_changes = [content] }</code> ao <code>local_file "relatorio"</code>;</li>
          <li>com isso, mudar o <code>content</code> no código não gera nenhuma ação no plano.</li>
        </ul>`,
      dica: 'ignore_changes = [content] (o nome do argumento, sem aspas)',
      inicial: tf`
        resource "local_file" "relatorio" {
          filename = "relatorio.txt"
          content  = "versão 2"
        }
      `,
      solucao: tf`
        resource "local_file" "relatorio" {
          filename = "relatorio.txt"
          content  = "versão 2"

          lifecycle {
            ignore_changes = [content]
          }
        }
      `,
      testes: [
        {
          descricao: 'já existe com "versão 1": o plan não muda nada',
          antes: { 'main.tf': 'resource "local_file" "relatorio" {\n  filename = "relatorio.txt"\n  content  = "versão 1"\n}\n' },
          regras: [{ semErros: true }, { lifecycle: 'local_file.relatorio', ignore_changes: ['content'] }, { recurso: 'local_file.relatorio', acao: 'nada' }],
        },
      ],
    }),

    problema({
      id: 'tf-terraform-data',
      titulo: 'Guardando um valor com terraform_data',
      dificuldade: 'medio',
      enunciado: `
        <p>O <code>terraform_data</code> guarda um valor no estado. O atributo <code>output</code> devolve o <code>input</code>
        depois do apply.</p>
        <ul>
          <li>crie <code>resource "terraform_data" "build"</code> com <code>input = var.versao_app</code>;</li>
          <li>crie <code>output "build"</code> com <code>terraform_data.build.output</code>.</li>
        </ul>`,
      dica: 'terraform_data.build.output',
      inicial: tf`
        variable "versao_app" {
          type    = string
          default = "1.0.0"
        }
      `,
      solucao: tf`
        variable "versao_app" {
          type    = string
          default = "1.0.0"
        }

        resource "terraform_data" "build" {
          input = var.versao_app
        }

        output "build" {
          value = terraform_data.build.output
        }
      `,
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'terraform_data.build', atributo: 'input', igual: '1.0.0' }, { saida: 'build', conhecido: false }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', variaveis: { versao_app: '2.1.0' }, regras: [{ saida: 'build', igual: '2.1.0' }] },
      ],
    }),

    problema({
      id: 'tf-recriar',
      titulo: 'Alterar ou recriar?',
      dificuldade: 'facil',
      enunciado: `
        <p>Este <code>random_pet</code> já foi criado com <code>length = 2</code>. Alguns argumentos não podem mudar com
        o recurso existindo: mudar o tamanho do nome obriga a <b>recriar</b>.</p>
        <ul>
          <li>mude para <code>length = 3</code>;</li>
          <li>rode o plan e veja <code>-/+</code> e <code># forces replacement</code>.</li>
        </ul>`,
      dica: 'Mude só o número do length.',
      inicial: tf`
        resource "random_pet" "nome" {
          length = 2
        }
      `,
      solucao: tf`
        resource "random_pet" "nome" {
          length = 3
        }
      `,
      testes: [
        {
          descricao: 'já existe com length = 2',
          antes: { 'main.tf': 'resource "random_pet" "nome" {\n  length = 2\n}\n' },
          regras: [{ semErros: true }, { recurso: 'random_pet.nome', acao: 'substituir' }, { texto: '# forces replacement' }],
        },
      ],
    }),

    problema({
      id: 'tf-moved',
      titulo: 'Renomear sem recriar (moved)',
      dificuldade: 'medio',
      enunciado: `
        <p>O recurso se chamava <code>random_pet.servidor</code> e já existe. Você quer chamá-lo de <code>web</code>.
        Só trocar o nome faria o Terraform destruir um e criar outro!</p>
        <ul>
          <li>renomeie o bloco para <code>resource "random_pet" "web"</code>;</li>
          <li>acrescente <code>moved { from = random_pet.servidor  to = random_pet.web }</code>;</li>
          <li>o plano não deve criar nem destruir nada.</li>
        </ul>`,
      dica: 'moved { from = random_pet.servidor\n  to = random_pet.web }',
      inicial: tf`
        resource "random_pet" "servidor" {
          length = 2
        }
      `,
      solucao: tf`
        resource "random_pet" "web" {
          length = 2
        }

        moved {
          from = random_pet.servidor
          to   = random_pet.web
        }
      `,
      testes: [
        {
          descricao: 'já existe random_pet.servidor',
          antes: { 'main.tf': 'resource "random_pet" "servidor" {\n  length = 2\n}\n' },
          regras: [{ semErros: true }, { movido: ['random_pet.servidor', 'random_pet.web'] }, { plano: { criar: 0, destruir: 0 } }],
        },
      ],
    }),

    problema({
      id: 'tf-workspace',
      titulo: 'Workspaces',
      dificuldade: 'medio',
      enunciado: `
        <p>Workspaces deixam o mesmo código ter estados separados (dev, prod...). O nome do workspace atual está em
        <code>terraform.workspace</code>. Troque o workspace no seletor 🗂 do terminal para testar.</p>
        <ul>
          <li>o <code>filename</code> deve ser <code>"\${terraform.workspace}.env"</code>;</li>
          <li>o <code>content</code> deve ser <code>"AMBIENTE=\${terraform.workspace}"</code>.</li>
        </ul>`,
      dica: 'terraform.workspace',
      inicial: tf`
        resource "local_file" "env" {
          filename = "app.env"
          content  = "AMBIENTE=?"
        }
      `,
      solucao: tf`
        resource "local_file" "env" {
          filename = "\${terraform.workspace}.env"
          content  = "AMBIENTE=\${terraform.workspace}"
        }
      `,
      testes: [
        { descricao: 'workspace default', regras: [{ semErros: true }, { recurso: 'local_file.env', atributo: 'filename', igual: 'default.env' }] },
        { descricao: 'workspace prod', workspace: 'prod', regras: [{ recurso: 'local_file.env', atributo: 'content', igual: 'AMBIENTE=prod' }] },
      ],
    }),

    licao({
      id: 'licao-modulos',
      titulo: 'Módulos: código reutilizável',
      resumo: `
        <p>Um <b>módulo</b> é uma pasta com arquivos <code>.tf</code>. Você chama o módulo como se fosse uma função:
        passa <b>variáveis</b> e recebe <b>outputs</b>.</p>
        <ul>
          <li>chamada: <code>module "site" { source = "./modulos/arquivo"  nome = "blog" }</code>;</li>
          <li>valor devolvido: <code>module.site.caminho</code>;</li>
          <li>os recursos de dentro aparecem com o prefixo <code>module.site.</code> no plano.</li>
        </ul>
        <p>Neste playground, crie a pasta do módulo pelo <b>+</b> do editor, com nomes como
        <code>modulos/arquivo/main.tf</code>. Também existem módulos prontos no <b>Terraform Registry</b>
        (como <code>terraform-aws-modules/vpc/aws</code>), mas o simulador só roda módulos locais.</p>`,
      codigo: {
        'main.tf': tf`
          module "blog" {
            source   = "./modulos/arquivo"
            nome     = "blog"
            conteudo = "Meu blog"
          }

          output "arquivo_do_blog" {
            value = module.blog.caminho
          }
        `,
        'modulos/arquivo/main.tf': MOD_ARQUIVO,
      },
    }),

    problema({
      id: 'tf-modulo-usar',
      titulo: 'Usando um módulo',
      dificuldade: 'medio',
      enunciado: `
        <p>O módulo em <code>modulos/arquivo</code> já está pronto: ele recebe <code>nome</code> e <code>conteudo</code>
        e devolve o <code>caminho</code> do arquivo criado.</p>
        <ul>
          <li>chame o módulo com <code>module "boas_vindas"</code> e <code>source = "./modulos/arquivo"</code>;</li>
          <li>passe <code>nome = "ola"</code> e <code>conteudo = "Oi, turma!"</code>;</li>
          <li>crie <code>output "caminho"</code> com <code>module.boas_vindas.caminho</code>.</li>
        </ul>`,
      dica: 'module "boas_vindas" { source = "./modulos/arquivo" ... }',
      inicial: {
        'main.tf': tf`
          # Chame o módulo aqui
        `,
        'modulos/arquivo/main.tf': MOD_ARQUIVO,
      },
      solucao: {
        'main.tf': tf`
          module "boas_vindas" {
            source   = "./modulos/arquivo"
            nome     = "ola"
            conteudo = "Oi, turma!"
          }

          output "caminho" {
            value = module.boas_vindas.caminho
          }
        `,
        'modulos/arquivo/main.tf': MOD_ARQUIVO,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { modulo: 'boas_vindas', source: './modulos/arquivo', entradas: ['nome', 'conteudo'] },
            { recurso: 'module.boas_vindas.local_file.este', atributo: 'content', igual: 'Oi, turma!' },
            { saida: 'caminho', igual: 'ola.txt' },
          ],
        },
      ],
    }),

    problema({
      id: 'tf-modulo-criar',
      titulo: 'Criando um módulo',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie um módulo que gera senhas e use-o.</p>
        <ul>
          <li>crie o arquivo <code>modulos/senha/main.tf</code> (botão <b>+</b>);</li>
          <li>dentro dele: <code>variable "tamanho"</code> (number, default 16), um
            <code>random_password "esta"</code> com <code>length = var.tamanho</code> e um
            <code>output "valor"</code> com a senha, marcado como <code>sensitive = true</code>;</li>
          <li>no <code>main.tf</code>, chame <code>module "senha"</code> com <code>tamanho = 20</code>;</li>
          <li>crie <code>output "senha"</code> com <code>module.senha.valor</code> (também sensível).</li>
        </ul>`,
      dica: 'Outputs de módulo que carregam segredos também precisam de sensitive = true.',
      inicial: tf`
        # module "senha" { ... }
      `,
      solucao: {
        'main.tf': tf`
          module "senha" {
            source  = "./modulos/senha"
            tamanho = 20
          }

          output "senha" {
            value     = module.senha.valor
            sensitive = true
          }
        `,
        'modulos/senha/main.tf': tf`
          variable "tamanho" {
            type    = number
            default = 16
          }

          resource "random_password" "esta" {
            length = var.tamanho
          }

          output "valor" {
            value     = random_password.esta.result
            sensitive = true
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { arquivo: 'modulos/senha/main.tf' },
            { modulo: 'senha', source: './modulos/senha' },
            { recurso: 'module.senha.random_password.esta', atributo: 'length', igual: 20 },
            { saida: 'senha', sensivel: true },
          ],
        },
      ],
    }),

    problema({
      id: 'tf-modulo-for-each',
      titulo: 'Um módulo, várias cópias',
      dificuldade: 'dificil',
      enunciado: `
        <p>Módulos também aceitam <code>for_each</code>.</p>
        <ul>
          <li>chame <code>module "site"</code> com <code>for_each = toset(["blog", "loja"])</code>;</li>
          <li>passe <code>nome = each.key</code> e <code>conteudo = "Site \${each.key}"</code>;</li>
          <li>crie <code>output "arquivos"</code> com <code>[for m in module.site : m.caminho]</code>.</li>
        </ul>`,
      dica: 'module.site vira um mapa: module.site["blog"].caminho',
      inicial: {
        'main.tf': tf`
          module "site" {
            source   = "./modulos/arquivo"
            nome     = "blog"
            conteudo = "Site blog"
          }
        `,
        'modulos/arquivo/main.tf': MOD_ARQUIVO,
      },
      solucao: {
        'main.tf': tf`
          module "site" {
            source   = "./modulos/arquivo"
            for_each = toset(["blog", "loja"])
            nome     = each.key
            conteudo = "Site \${each.key}"
          }

          output "arquivos" {
            value = [for m in module.site : m.caminho]
          }
        `,
        'modulos/arquivo/main.tf': MOD_ARQUIVO,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { modulo: 'site', forEach: true },
            { recurso: 'module.site["loja"].local_file.este', atributo: 'content', igual: 'Site loja' },
            { saida: 'arquivos', igual: ['blog.txt', 'loja.txt'] },
          ],
        },
      ],
    }),

    problema({
      id: 'tf-versoes',
      titulo: 'Fixando versões',
      dificuldade: 'facil',
      enunciado: `
        <p>Para o código funcionar igual daqui a um ano, fixe as versões do Terraform e dos provedores.</p>
        <ul>
          <li>crie um bloco <code>terraform { }</code> com <code>required_version = "&gt;= 1.5.0"</code>;</li>
          <li>dentro dele, <code>required_providers { random = { source = "hashicorp/random", version = "~&gt; 3.7" } }</code>.</li>
        </ul>
        <p><code>~&gt; 3.7</code> aceita 3.7, 3.8, 3.9... mas não 4.0, que pode quebrar o código.</p>`,
      dica: 'terraform { required_version = ">= 1.5.0"  required_providers { random = { ... } } }',
      inicial: tf`
        resource "random_pet" "nome" {}
      `,
      solucao: tf`
        terraform {
          required_version = ">= 1.5.0"

          required_providers {
            random = {
              source  = "hashicorp/random"
              version = "~> 3.7"
            }
          }
        }

        resource "random_pet" "nome" {}
      `,
      testes: [
        {
          descricao: 'terraform init e plan',
          regras: [
            { semErros: true },
            { versaoTerraform: true, igual: '>= 1.5.0' },
            { requerido: 'random', source: 'hashicorp/random', versao: '~> 3.7' },
            { texto: 'Installing hashicorp/random v3.7' },
          ],
        },
      ],
    }),
  ],
};
