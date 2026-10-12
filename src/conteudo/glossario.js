// Glossário: cada termo técnico com uma explicação simples, uma analogia do dia a
// dia e um exemplo curto. A descrição de cada desafio mostra os termos que aparecem
// no texto dele (até MAX_TERMOS, na ordem em que aparecem), para não sobrecarregar.
//
// `padroes` são regex (sem flags; usamos 'iu'), testadas no texto visível do desafio.
// Bordas de palavra são tratadas em `termosDoTexto`, porque \b não entende acentos.
// A ordem importa: os termos são agrupados por nível (básico → AWS → Azure).

export const MAX_TERMOS = 6;

export const GLOSSARIO = [
  // ---------- Terraform: conceitos ----------
  {
    id: 'iac', termo: 'Infraestrutura como Código (IaC)', padroes: ['infraestrutura como código', 'iac'],
    definicao: 'Criar servidores, redes e bancos escrevendo código, em vez de clicar num painel.',
    analogia: 'Como uma receita de bolo: qualquer pessoa que seguir a receita chega no mesmo bolo, sempre.',
  },
  {
    id: 'terraform', termo: 'Terraform', padroes: ['terraform'],
    definicao: 'Ferramenta de IaC: lê os arquivos .tf, compara com o que já existe e cria, altera ou apaga o que for preciso.',
    analogia: 'Um mestre de obras: você entrega a planta da casa e ele cuida de construir e de reformar.',
    exemplo: 'terraform init\nterraform plan\nterraform apply',
  },
  {
    id: 'hcl', termo: 'HCL', padroes: ['hcl'],
    definicao: 'A linguagem dos arquivos .tf: blocos com rótulos e argumentos no formato nome = valor.',
    analogia: 'Uma ficha de cadastro bem organizada: cada campo tem um nome e um valor.',
    exemplo: 'resource "local_file" "ola" {\n  filename = "ola.txt"\n}',
  },
  {
    id: 'bloco', termo: 'Bloco', padroes: ['blocos?'],
    definicao: 'Um pedaço do código entre { }, com um tipo (resource, variable...) e rótulos entre aspas.',
    analogia: 'Uma caixa etiquetada: a etiqueta diz o que é, e dentro estão os detalhes.',
    exemplo: 'variable "regiao" {\n  default = "sa-east-1"\n}',
  },
  {
    id: 'argumento', termo: 'Argumento', padroes: ['argumentos?'],
    definicao: 'Uma linha nome = valor dentro de um bloco: é você dizendo como quer o recurso.',
    analogia: 'As opções de um pedido no restaurante: tamanho grande, sem cebola.',
    exemplo: 'instance_type = "t3.micro"',
  },
  {
    id: 'atributo', termo: 'Atributo', padroes: ['atributos?'],
    definicao: 'Um valor de um recurso que você pode ler, inclusive os que o provedor calcula (id, arn, ip).',
    analogia: 'Os dados da nota fiscal depois da compra: número, data e código, que só existem depois que a compra acontece.',
    exemplo: 'aws_instance.web.public_ip',
  },
  {
    id: 'provider', termo: 'Provedor (provider)', padroes: ['provedor(es)?', 'providers?'],
    definicao: 'O plugin que ensina o Terraform a falar com uma plataforma: aws, azurerm, random, local...',
    analogia: 'Um tradutor: o Terraform fala uma língua só, e cada provedor traduz para a nuvem certa.',
    exemplo: 'provider "aws" {\n  region = "sa-east-1"\n}',
  },
  {
    id: 'resource', termo: 'Recurso (resource)', padroes: ['recursos?', 'resource'],
    definicao: 'Uma coisa que o Terraform cria e cuida: um arquivo, um bucket, uma máquina virtual.',
    analogia: 'Cada móvel da planta da casa: o mestre de obras sabe que precisa construir e manter cada um.',
    exemplo: 'resource "aws_s3_bucket" "fotos" { ... }',
  },
  {
    id: 'data-source', termo: 'Data source', padroes: ['data source', 'data "', 'fontes? de dados'],
    definicao: 'Lê informações de algo que já existe, sem criar nada (por exemplo, a imagem mais nova do Ubuntu).',
    analogia: 'Consultar o catálogo da loja: você só olha o preço, não compra nada.',
    exemplo: 'data "aws_ami" "ubuntu" { ... }\n# use: data.aws_ami.ubuntu.id',
  },
  {
    id: 'init', termo: 'terraform init', padroes: ['init'],
    definicao: 'Prepara a pasta: baixa os provedores e configura onde o estado vai ficar.',
    analogia: 'Separar as ferramentas antes de começar a obra.',
    exemplo: 'terraform init',
  },
  {
    id: 'plan', termo: 'terraform plan', padroes: ['plan', 'plano'],
    definicao: 'Mostra o que vai ser criado (+), alterado (~) ou destruído (-), sem mudar nada.',
    analogia: 'O orçamento antes da reforma: você vê tudo o que vai mudar antes de autorizar.',
    exemplo: 'Plan: 2 to add, 0 to change, 0 to destroy.',
  },
  {
    id: 'apply', termo: 'terraform apply', padroes: ['apply'],
    definicao: 'Executa o plano: cria, altera e apaga de verdade e atualiza o estado.',
    analogia: 'Autorizar a reforma: agora a obra acontece.',
    exemplo: 'Apply complete! Resources: 2 added, 0 changed, 0 destroyed.',
  },
  {
    id: 'destroy', termo: 'terraform destroy', padroes: ['destroy', 'destruir'],
    definicao: 'Apaga tudo o que o Terraform criou nesta configuração.',
    analogia: 'Desmontar o palco depois do show: tudo o que foi montado sai.',
  },
  {
    id: 'estado', termo: 'Estado (state)', padroes: ['estado', 'state', 'tfstate'],
    definicao: 'O arquivo terraform.tfstate, onde o Terraform anota tudo o que criou e os IDs de cada coisa.',
    analogia: 'O caderno de anotações do mestre de obras: sem ele, ele não sabe o que já construiu.',
    exemplo: 'terraform.tfstate',
  },
  {
    id: 'known-after-apply', termo: '(known after apply)', padroes: ['known after apply', 'desconhecido'],
    definicao: 'Um valor que só existe depois que o recurso é criado, como o ID ou o IP.',
    analogia: 'O número do pedido: você só recebe depois de confirmar a compra.',
  },
  {
    id: 'interpolacao', termo: 'Interpolação ${...}', padroes: ['interpolação', '\\$\\{'],
    definicao: 'Coloca o valor de uma expressão dentro de um texto.',
    analogia: 'Um convite com espaço em branco para o nome: "Querido(a) ____, venha à festa".',
    exemplo: 'name = "web-${var.ambiente}"',
  },
  {
    id: 'heredoc', termo: 'Heredoc', padroes: ['heredoc', '<<-?eot'],
    definicao: 'Um jeito de escrever textos de várias linhas no HCL, entre <<-EOT e EOT.',
    analogia: 'Uma carta inteira dentro de um envelope, em vez de um bilhete de uma linha.',
    exemplo: 'content = <<-EOT\n  linha 1\n  linha 2\nEOT',
  },
  {
    id: 'variavel', termo: 'Variável (variable)', padroes: ['variáve(l|is)', 'variable', 'var\\.'],
    definicao: 'Um valor de entrada do código, com nome, tipo e (opcional) valor padrão. Use com var.nome.',
    analogia: 'Os campos de um formulário: o código é o mesmo, mas cada pessoa preenche com os seus dados.',
    exemplo: 'variable "regiao" {\n  type    = string\n  default = "sa-east-1"\n}',
  },
  {
    id: 'tfvars', termo: 'terraform.tfvars', padroes: ['tfvars'],
    definicao: 'Arquivo com os valores das variáveis, no formato nome = valor. É lido automaticamente.',
    analogia: 'O formulário já preenchido, entregue junto com o pedido.',
    exemplo: 'regiao   = "us-east-1"\nambiente = "prod"',
  },
  {
    id: 'output', termo: 'Output', padroes: ['outputs?', 'saídas?'],
    definicao: 'Um valor que o Terraform mostra no fim e que outros módulos podem ler.',
    analogia: 'O recibo no fim da compra, com as informações que importam.',
    exemplo: 'output "ip" {\n  value = aws_instance.web.public_ip\n}',
  },
  {
    id: 'local', termo: 'Local (locals)', padroes: ['locals?', 'local\\.'],
    definicao: 'Um valor calculado uma vez e reaproveitado no código: local.nome.',
    analogia: 'Um apelido: em vez de repetir "o filho mais velho da dona Maria", você diz "Zé".',
    exemplo: 'locals {\n  prefixo = "app-${var.ambiente}"\n}',
  },
  {
    id: 'tipo', termo: 'Tipos (string, number, bool, list, map, object)', padroes: ['type =', 'tipos?', 'list\\(', 'map\\(', 'object\\('],
    definicao: 'Dizem que tipo de valor uma variável aceita: texto, número, verdadeiro/falso, lista, mapa ou objeto.',
    analogia: 'Os formatos de tomada: um plugue só encaixa na tomada certa.',
    exemplo: 'type = list(string)',
  },
  {
    id: 'lista', termo: 'Lista', padroes: ['listas?'],
    definicao: 'Vários valores em ordem, entre colchetes. O primeiro é o [0].',
    analogia: 'A fila do pão: cada um tem uma posição, começando do primeiro.',
    exemplo: '["sa-east-1", "us-east-1"]',
  },
  {
    id: 'mapa', termo: 'Mapa', padroes: ['mapas?', 'map'],
    definicao: 'Pares chave = valor, entre chaves. Você pega um valor pela chave.',
    analogia: 'Uma agenda de telefones: você procura pelo nome e acha o número.',
    exemplo: '{ dev = "t3.micro", prod = "t3.large" }',
  },
  {
    id: 'conjunto', termo: 'Conjunto (set)', padroes: ['conjuntos?', 'toset', 'set\\('],
    definicao: 'Uma coleção sem repetição e sem ordem. É o que o for_each aceita além dos mapas.',
    analogia: 'Uma coleção de figurinhas: não importa a ordem, e não há duas iguais.',
    exemplo: 'toset(["web", "api"])',
  },
  {
    id: 'funcao', termo: 'Funções', padroes: ['funç(ão|ões)', 'lower\\(', 'join\\(', 'merge\\(', 'length\\(', 'lookup\\(', 'file\\(', 'templatefile', 'try\\('],
    definicao: 'Ferramentas prontas que transformam valores: upper, join, merge, length, cidrsubnet...',
    analogia: 'Os eletrodomésticos da cozinha: você coloca o ingrediente e sai transformado.',
    exemplo: 'upper("sertao") # "SERTAO"',
  },
  {
    id: 'condicional', termo: 'Expressão condicional', padroes: ['condicional', '\\? .* :'],
    definicao: 'Escolhe entre dois valores: condição ? valor_se_sim : valor_se_não.',
    analogia: 'Um semáforo: se está verde, passa; senão, espera.',
    exemplo: 'var.ambiente == "prod" ? 3 : 1',
  },
  {
    id: 'for', termo: 'Expressão for', padroes: ['\\[\\s*for', '\\{\\s*for', 'expressão for'],
    definicao: 'Transforma ou filtra cada item de uma lista ou mapa.',
    analogia: 'Uma linha de montagem: cada peça passa pela mesma etapa.',
    exemplo: '[for n in var.nomes : upper(n)]',
  },
  {
    id: 'count', termo: 'count', padroes: ['count'],
    definicao: 'Cria várias cópias de um recurso, numeradas a partir de 0 (count.index).',
    analogia: 'Fazer cópias numeradas de um documento: cópia 0, cópia 1, cópia 2.',
    exemplo: 'count = 3\nname  = "web-${count.index}"',
  },
  {
    id: 'for-each', termo: 'for_each', padroes: ['for_each', 'each\\.'],
    definicao: 'Cria uma cópia do recurso para cada chave de um mapa ou conjunto (each.key e each.value).',
    analogia: 'Crachás com nome: cada pessoa recebe o seu, e tirar uma pessoa não muda os outros.',
    exemplo: 'for_each = toset(["dev", "prod"])\nname     = each.key',
  },
  {
    id: 'splat', termo: 'Splat [*]', padroes: ['splat', '\\[\\*\\]'],
    definicao: 'Pega o mesmo atributo de todas as cópias de um recurso.',
    analogia: 'Pedir para a turma inteira levantar a mão: você recebe a resposta de todos de uma vez.',
    exemplo: 'aws_instance.web[*].public_ip',
  },
  {
    id: 'dynamic', termo: 'Bloco dynamic', padroes: ['dynamic'],
    definicao: 'Gera blocos aninhados repetidos a partir de uma lista ou mapa.',
    analogia: 'Uma impressora de etiquetas: você passa a lista e ela imprime uma etiqueta por item.',
    exemplo: 'dynamic "ingress" {\n  for_each = var.portas\n  content { from_port = ingress.value ... }\n}',
  },
  {
    id: 'depends-on', termo: 'depends_on', padroes: ['depends_on', 'dependências?'],
    definicao: 'Diz que um recurso precisa esperar outro, quando o Terraform não consegue descobrir sozinho.',
    analogia: 'Na obra, a pintura espera o reboco secar, mesmo sem usar nada do reboco.',
    exemplo: 'depends_on = [aws_iam_role_policy.logs]',
  },
  {
    id: 'grafo', termo: 'Grafo de dependências', padroes: ['grafo'],
    definicao: 'O desenho de quem depende de quem. O Terraform usa para decidir a ordem de criação.',
    analogia: 'A ordem de vestir: meia antes do sapato, camisa antes do paletó.',
  },
  {
    id: 'lifecycle', termo: 'lifecycle', padroes: ['lifecycle', 'prevent_destroy', 'create_before_destroy', 'ignore_changes'],
    definicao: 'Regras do ciclo de vida: criar antes de destruir, impedir destroy, ignorar mudanças.',
    analogia: 'Regras da casa: "nunca jogue fora o álbum de fotos", "troque a lâmpada antes de tirar a velha".',
    exemplo: 'lifecycle {\n  prevent_destroy = true\n}',
  },
  {
    id: 'recriar', termo: 'Recriar (forces replacement)', padroes: ['forces replacement', 'recria(r|ção)', 'substitui(r|ção)', '-/\\+'],
    definicao: 'Alguns argumentos não mudam com o recurso existindo: o Terraform apaga e cria de novo.',
    analogia: 'Mudar o tamanho de um sapato: não dá para esticar, é preciso trocar por outro.',
  },
  {
    id: 'sensitive', termo: 'Valor sensível (sensitive)', padroes: ['sensitive', 'sensíve(l|is)'],
    definicao: 'Marca um valor secreto (como senha) para não aparecer no terminal.',
    analogia: 'A tarja preta num documento: o dado está lá, mas não fica à vista.',
    exemplo: 'sensitive = true',
  },
  {
    id: 'validation', termo: 'Validação (validation)', padroes: ['validation', 'validaç(ão|ões)'],
    definicao: 'Uma regra que recusa valores errados de uma variável antes de criar qualquer coisa.',
    analogia: 'O porteiro conferindo o convite antes de deixar entrar.',
    exemplo: 'validation {\n  condition     = contains(["dev", "prod"], var.ambiente)\n  error_message = "Use dev ou prod."\n}',
  },
  {
    id: 'modulo', termo: 'Módulo', padroes: ['módulos?', 'module'],
    definicao: 'Uma pasta com arquivos .tf que você reaproveita, passando variáveis e recebendo outputs.',
    analogia: 'Uma peça de LEGO pronta: você encaixa em vários projetos.',
    exemplo: 'module "rede" {\n  source = "./modulos/rede"\n  cidr   = "10.0.0.0/16"\n}',
  },
  {
    id: 'workspace', termo: 'Workspace', padroes: ['workspaces?'],
    definicao: 'Estados separados para o mesmo código, como dev e prod.',
    analogia: 'Cadernos diferentes para cada matéria, todos com o mesmo tipo de anotação.',
    exemplo: 'terraform workspace select prod',
  },
  {
    id: 'backend', termo: 'Backend (estado remoto)', padroes: ['backend', 'estado remoto'],
    definicao: 'Onde o estado é guardado. Em equipe, fica num lugar compartilhado (S3, Azure Storage) com trava.',
    analogia: 'Um caderno guardado na secretaria, e não na mochila de um aluno: todo mundo consulta o mesmo.',
    exemplo: 'backend "s3" {\n  bucket = "estado-terraform"\n  key    = "prod.tfstate"\n  region = "sa-east-1"\n}',
  },
  {
    id: 'lock', termo: 'Trava do estado (lock)', padroes: ['lock', 'trava', 'lockfile', 'dynamodb_table'],
    definicao: 'Impede que duas pessoas rodem apply ao mesmo tempo no mesmo estado.',
    analogia: 'A placa de "ocupado" no banheiro: só entra um por vez.',
  },
  {
    id: 'versao', termo: 'Restrição de versão', padroes: ['required_providers', 'required_version', '~>'],
    definicao: 'Fixa quais versões do Terraform e dos provedores o código aceita.',
    analogia: 'A bula do remédio: "use só com tal versão", para não ter surpresas.',
    exemplo: 'version = "~> 6.0" # 6.x, mas não 7.0',
  },
  {
    id: 'moved', termo: 'moved', padroes: ['moved'],
    definicao: 'Avisa que um recurso mudou de nome, para o Terraform não apagar e criar de novo.',
    analogia: 'O aviso de mudança de endereço nos Correios: as cartas continuam chegando.',
    exemplo: 'moved {\n  from = aws_s3_bucket.velho\n  to   = aws_s3_bucket.novo\n}',
  },
  {
    id: 'import', termo: 'import', padroes: ['import', 'importa(r|ção)'],
    definicao: 'Traz para o estado um recurso que já existe e foi criado fora do Terraform.',
    analogia: 'Registrar no cartório uma casa que já estava construída.',
    exemplo: 'import {\n  to = aws_s3_bucket.antigo\n  id = "meu-bucket-antigo"\n}',
  },
  {
    id: 'drift', termo: 'Drift (desvio)', padroes: ['drift', 'desvio'],
    definicao: 'Quando alguém muda um recurso direto no console e ele fica diferente do código.',
    analogia: 'Alguém muda os móveis de lugar sem avisar: a planta não bate mais com a casa.',
  },
  {
    id: 'idempotencia', termo: 'Idempotência', padroes: ['idempot', 'no changes'],
    definicao: 'Rodar o mesmo código várias vezes dá o mesmo resultado: se já está tudo certo, nada muda.',
    analogia: 'Apertar o botão do elevador várias vezes: ele vem uma vez só.',
    exemplo: 'No changes. Your infrastructure matches the configuration.',
  },
  {
    id: 'random', termo: 'Provedor random', padroes: ['random_[a-z_]+'],
    definicao: 'Gera valores aleatórios (nomes, senhas, números) que ficam fixos no estado.',
    analogia: 'Um sorteio feito uma vez só: o resultado fica anotado e não muda a cada consulta.',
    exemplo: 'resource "random_pet" "nome" {}',
  },
  {
    id: 'json', termo: 'JSON', padroes: ['json'],
    definicao: 'Um formato de texto para dados (chaves e valores), muito usado em políticas e APIs.',
    analogia: 'Uma ficha padronizada que qualquer sistema sabe ler.',
    exemplo: 'jsonencode({ app = "loja", porta = 8080 })',
  },
  {
    id: 'cidr', termo: 'CIDR', padroes: ['cidr'],
    definicao: 'O jeito de escrever uma faixa de endereços IP: 10.0.0.0/16. Quanto menor o número depois da barra, maior a faixa.',
    analogia: 'Um CEP de bairro (/16) e um CEP de rua (/24): o de rua é um pedaço do bairro.',
    exemplo: 'cidrsubnet("10.0.0.0/16", 8, 1) # "10.0.1.0/24"',
  },
  {
    id: 'tags', termo: 'Tags', padroes: ['tags?'],
    definicao: 'Etiquetas chave = valor nos recursos, para organizar, achar e calcular custos.',
    analogia: 'Etiquetas coloridas nas pastas do arquivo: "financeiro", "2026", "urgente".',
    exemplo: 'tags = {\n  Projeto  = "loja"\n  Ambiente = "prod"\n}',
  },

  // ---------- AWS ----------
  {
    id: 'aws', termo: 'AWS', padroes: ['aws'],
    definicao: 'Amazon Web Services: a nuvem da Amazon, com centenas de serviços.',
    analogia: 'Um shopping de serviços de TI: você aluga só a loja que precisa, pelo tempo que usar.',
  },
  {
    id: 'regiao', termo: 'Região', padroes: ['regi(ão|ões)', 'region'],
    definicao: 'Um lugar do mundo com data centers da nuvem, como sa-east-1 (São Paulo).',
    analogia: 'As filiais de uma rede de lojas: cada cidade tem a sua.',
    exemplo: 'region = "sa-east-1"',
  },
  {
    id: 'az', termo: 'Zona de disponibilidade', padroes: ['zonas? de disponibilidade', 'availability_zone', 'azs?'],
    definicao: 'Data centers separados dentro de uma região. Usar duas zonas evita que uma falha derrube tudo.',
    analogia: 'Ter a chave de casa com você e uma cópia com um vizinho.',
    exemplo: 'availability_zone = "sa-east-1a"',
  },
  {
    id: 'arn', termo: 'ARN', padroes: ['arn'],
    definicao: 'O "endereço completo" de um recurso na AWS.',
    analogia: 'O endereço com CEP, rua, número e apartamento: identifica um lugar só no mundo.',
    exemplo: 'arn:aws:s3:::meu-bucket',
  },
  {
    id: 's3', termo: 'S3 e bucket', padroes: ['s3', 'buckets?', 'aws_s3_[a-z_]+'],
    definicao: 'O S3 guarda arquivos na nuvem. Cada "pasta raiz" é um bucket, com nome único no mundo.',
    analogia: 'Um guarda-volumes gigante: cada bucket é um armário com cadeado e nome próprio.',
    exemplo: 'resource "aws_s3_bucket" "fotos" {\n  bucket = "fotos-da-turma-2026"\n}',
  },
  {
    id: 'versionamento', termo: 'Versionamento', padroes: ['versionamento', 'versioning'],
    definicao: 'Guarda as versões antigas de cada arquivo, para recuperar se alguém apagar ou estragar.',
    analogia: 'O "histórico de versões" de um documento compartilhado.',
  },
  {
    id: 'criptografia', termo: 'Criptografia', padroes: ['criptograf', 'encryption', 'kms', 'sse'],
    definicao: 'Embaralha os dados com uma chave, para que só quem tem a chave consiga ler.',
    analogia: 'Um cofre com segredo: o conteúdo está lá, mas só abre quem sabe o código.',
  },
  {
    id: 'iam', termo: 'IAM', padroes: ['iam'],
    definicao: 'O serviço de identidades da AWS: usuários, grupos, papéis (roles) e permissões (policies).',
    analogia: 'O RH e a portaria de uma empresa: quem é quem e que salas cada um pode abrir.',
  },
  {
    id: 'policy', termo: 'Política (policy)', padroes: ['polític(a|as)', 'polic(y|ies)'],
    definicao: 'Um documento JSON que diz quem pode fazer o quê em quais recursos (Allow/Deny, Action, Resource).',
    analogia: 'O regulamento do condomínio: quem pode usar a piscina, em que horário.',
    exemplo: 'actions   = ["s3:GetObject"]\nresources = ["${aws_s3_bucket.b.arn}/*"]',
  },
  {
    id: 'role', termo: 'Papel (role)', padroes: ['papel', 'papéis', 'roles?', 'assume_role'],
    definicao: 'Um conjunto de permissões que um serviço ou pessoa "veste" temporariamente, sem senha fixa.',
    analogia: 'O crachá de visitante: dá acesso enquanto você está lá e depois é devolvido.',
    exemplo: 'assume_role_policy = data.aws_iam_policy_document.assume.json',
  },
  {
    id: 'menor-privilegio', termo: 'Menor privilégio', padroes: ['menor privilégio', 'só o necessário'],
    definicao: 'Dar só as permissões que cada um precisa, nada além.',
    analogia: 'Dar ao entregador a chave do portão, e não a da casa inteira.',
  },
  {
    id: 'vpc', termo: 'VPC', padroes: ['vpcs?'],
    definicao: 'Uma rede privada sua dentro da AWS, com a faixa de IPs que você escolher.',
    analogia: 'Um condomínio fechado: tem muros, ruas internas e uma portaria de entrada.',
    exemplo: 'resource "aws_vpc" "main" {\n  cidr_block = "10.0.0.0/16"\n}',
  },
  {
    id: 'subnet', termo: 'Sub-rede (subnet)', padroes: ['sub-redes?', 'subnets?'],
    definicao: 'Um pedaço da rede, numa zona. Sub-redes públicas falam com a internet; privadas, não.',
    analogia: 'As ruas do condomínio: algumas dão para a portaria, outras ficam só lá dentro.',
  },
  {
    id: 'igw', termo: 'Internet Gateway', padroes: ['internet gateway', 'igw'],
    definicao: 'A porta da VPC para a internet.',
    analogia: 'O portão principal do condomínio.',
  },
  {
    id: 'nat', termo: 'NAT Gateway', padroes: ['nat'],
    definicao: 'Deixa recursos de sub-redes privadas saírem para a internet sem receber conexões de fora.',
    analogia: 'Uma porta giratória que só gira para fora: você sai para comprar pão, mas ninguém entra por ela.',
  },
  {
    id: 'route-table', termo: 'Tabela de rotas', padroes: ['tabelas? de rotas?', 'route_table', 'rotas?'],
    definicao: 'Diz para onde vai o tráfego de cada sub-rede (por exemplo, 0.0.0.0/0 → internet gateway).',
    analogia: 'As placas de trânsito dentro do condomínio: "saída → portão principal".',
    exemplo: 'route {\n  cidr_block = "0.0.0.0/0"\n  gateway_id = aws_internet_gateway.igw.id\n}',
  },
  {
    id: 'security-group', termo: 'Security group', padroes: ['security groups?', 'grupos? de segurança'],
    definicao: 'Um firewall ligado a uma instância ou banco: lista as portas e origens que podem entrar e sair.',
    analogia: 'A lista de convidados na porta da festa.',
    exemplo: 'ingress {\n  from_port = 443\n  to_port   = 443\n  protocol  = "tcp"\n}',
  },
  {
    id: 'porta', termo: 'Porta', padroes: ['portas?'],
    definicao: 'Um número que indica o serviço numa máquina: 22 (SSH), 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL).',
    analogia: 'Os guichês de uma repartição: cada número atende um tipo de serviço.',
  },
  {
    id: 'ec2', termo: 'EC2 (instância)', padroes: ['ec2', 'instâncias?', 'instance'],
    definicao: 'Uma máquina virtual na AWS. O instance_type define o tamanho (CPU e memória).',
    analogia: 'Alugar um computador num data center, pagando por hora.',
    exemplo: 'instance_type = "t3.micro"',
  },
  {
    id: 'ami', termo: 'AMI', padroes: ['ami'],
    definicao: 'A imagem com o sistema operacional que a instância usa para ligar (Ubuntu, Amazon Linux...).',
    analogia: 'O "molde" de instalação: toda máquina criada a partir dele já vem com o sistema pronto.',
  },
  {
    id: 'user-data', termo: 'User data', padroes: ['user_data', 'cloud-init', 'custom_data'],
    definicao: 'Um script que roda quando a máquina liga pela primeira vez (instalar programas, por exemplo).',
    analogia: 'A lista de tarefas que você deixa para o primeiro dia do funcionário novo.',
  },
  {
    id: 'ebs', termo: 'EBS (volume)', padroes: ['ebs', 'volumes?'],
    definicao: 'Um disco virtual que você liga numa instância EC2.',
    analogia: 'Um HD externo plugado no computador.',
  },
  {
    id: 'chave-ssh', termo: 'Par de chaves SSH', padroes: ['ssh', 'key_pair', 'chaves? públicas?'],
    definicao: 'Uma chave pública (vai para o servidor) e uma privada (fica com você) para entrar sem senha.',
    analogia: 'Cadeado e chave: você deixa o cadeado no servidor e guarda a única chave.',
  },
  {
    id: 'load-balancer', termo: 'Load balancer', padroes: ['load balancers?', 'balanceador', 'alb', 'aws_lb'],
    definicao: 'Distribui as visitas entre várias máquinas e tira do ar as que ficam doentes.',
    analogia: 'A recepcionista que manda cada cliente para o caixa livre.',
  },
  {
    id: 'target-group', termo: 'Target group', padroes: ['target groups?', 'grupo de destino'],
    definicao: 'O grupo de máquinas para onde o load balancer manda o tráfego, com a verificação de saúde.',
    analogia: 'A lista de caixas abertos que a recepcionista consulta.',
  },
  {
    id: 'asg', termo: 'Auto Scaling', padroes: ['auto scaling', 'autoscaling', 'escalonamento'],
    definicao: 'Liga e desliga máquinas automaticamente conforme a demanda, entre um mínimo e um máximo.',
    analogia: 'Abrir mais caixas no supermercado quando a fila cresce.',
  },
  {
    id: 'rds', termo: 'RDS', padroes: ['rds', 'db_instance'],
    definicao: 'Banco de dados relacional gerenciado (PostgreSQL, MySQL...): a AWS cuida de backup e atualização.',
    analogia: 'Um restaurante em vez de cozinhar em casa: você só pede, a limpeza é por conta deles.',
  },
  {
    id: 'dynamodb', termo: 'DynamoDB', padroes: ['dynamodb'],
    definicao: 'Banco NoSQL chave-valor, sem servidor e muito rápido. Cada item é achado pela chave.',
    analogia: 'Um armário de chaves numeradas: você pega pelo número, sem procurar.',
  },
  {
    id: 'serverless', termo: 'Serverless', padroes: ['serverless', 'sem servidor'],
    definicao: 'O código roda sob demanda, sem você cuidar de servidor; paga só quando é usado.',
    analogia: 'Chamar um táxi em vez de ter carro: você só paga quando anda.',
  },
  {
    id: 'lambda', termo: 'Lambda', padroes: ['lambda'],
    definicao: 'Funções serverless da AWS: um pedaço de código que roda quando algo acontece.',
    analogia: 'Uma campainha que, quando apertada, faz uma tarefa e depois descansa.',
  },
  {
    id: 'api-gateway', termo: 'API Gateway', padroes: ['api gateway', 'apigateway', 'apigatewayv2'],
    definicao: 'A porta de entrada de uma API: recebe as requisições HTTP e chama a função certa.',
    analogia: 'A recepção de um prédio: ouve o pedido e chama o setor responsável.',
  },
  {
    id: 'sqs', termo: 'Fila (SQS)', padroes: ['sqs', 'filas?'],
    definicao: 'Guarda mensagens até alguém processar, uma de cada vez.',
    analogia: 'A senha do banco: as pessoas esperam a vez e ninguém é atendido duas vezes.',
  },
  {
    id: 'sns', termo: 'Tópico (SNS)', padroes: ['sns', 'tópicos?'],
    definicao: 'Envia a mesma mensagem para vários assinantes (e-mail, fila, função).',
    analogia: 'Um grupo de avisos: uma mensagem chega para todo mundo do grupo.',
  },
  {
    id: 'cloudwatch', termo: 'CloudWatch', padroes: ['cloudwatch', 'alarmes?', 'métricas?'],
    definicao: 'Logs, métricas e alarmes da AWS: avisa quando algo passa do limite.',
    analogia: 'O painel do carro com a luz que acende quando falta óleo.',
  },
  {
    id: 'cloudfront', termo: 'CloudFront (CDN)', padroes: ['cloudfront', 'cdn'],
    definicao: 'Rede de entrega que guarda cópias do site perto das pessoas, no mundo todo.',
    analogia: 'Filiais de uma padaria em vários bairros: o pão chega mais rápido.',
  },
  {
    id: 'dns', termo: 'DNS', padroes: ['dns', 'route ?53', 'zonas? dns'],
    definicao: 'Traduz nomes (www.exemplo.com.br) em endereços IP.',
    analogia: 'A lista telefônica da internet.',
  },
  {
    id: 'segredo', termo: 'Gerenciador de segredos', padroes: ['secrets? manager', 'segredos?', 'secret'],
    definicao: 'Guarda senhas e chaves com segurança, fora do código.',
    analogia: 'O cofre do banco, em vez de deixar o dinheiro na gaveta.',
  },
  {
    id: 'container', termo: 'Contêiner', padroes: ['contêineres?', 'containers?', 'docker', 'ecr', 'ecs'],
    definicao: 'Um pacote com o programa e tudo o que ele precisa para rodar igual em qualquer lugar.',
    analogia: 'Um contêiner de navio: o mesmo caixote viaja de caminhão, trem ou navio sem abrir.',
  },

  // ---------- Azure ----------
  {
    id: 'azure', termo: 'Azure', padroes: ['azure', 'azurerm'],
    definicao: 'A nuvem da Microsoft. No Terraform, o provedor se chama azurerm.',
    analogia: 'Outro shopping de serviços de TI, com lojas parecidas e nomes diferentes.',
  },
  {
    id: 'assinatura', termo: 'Assinatura e tenant', padroes: ['assinatura', 'subscription', 'tenant'],
    definicao: 'O tenant é a organização (o Entra ID); a assinatura é a "conta" onde os recursos são cobrados.',
    analogia: 'O tenant é a empresa; a assinatura é o centro de custo onde as despesas são lançadas.',
  },
  {
    id: 'resource-group', termo: 'Grupo de recursos', padroes: ['grupos? de recursos', 'resource_group', 'resource group'],
    definicao: 'A pasta que agrupa os recursos de um projeto no Azure. Apagar o grupo apaga tudo dentro.',
    analogia: 'Uma caixa organizadora por projeto: jogar a caixa fora leva tudo junto.',
    exemplo: 'resource "azurerm_resource_group" "rg" {\n  name     = "rg-loja"\n  location = "brazilsouth"\n}',
  },
  {
    id: 'location', termo: 'Location', padroes: ['location', 'localiza(ção|ções)'],
    definicao: 'A região do Azure onde o recurso fica, como brazilsouth ou eastus.',
    analogia: 'O endereço da filial onde o seu pedido vai ser preparado.',
  },
  {
    id: 'storage-account', termo: 'Conta de armazenamento', padroes: ['storage account', 'storage_account', 'contas? de armazenamento'],
    definicao: 'Guarda blobs (arquivos), filas, tabelas e compartilhamentos. O nome é único no mundo: 3 a 24 letras minúsculas e números.',
    analogia: 'Um galpão alugado com várias salas: blobs, filas, tabelas e arquivos.',
  },
  {
    id: 'blob', termo: 'Blob e container', padroes: ['blobs?', 'storage_container'],
    definicao: 'Um blob é um arquivo; um container (de armazenamento) é a pasta onde os blobs ficam.',
    analogia: 'Fotos (blobs) dentro de álbuns (containers), dentro do galpão (conta).',
  },
  {
    id: 'replicacao', termo: 'Replicação (LRS, ZRS, GRS)', padroes: ['replicação', 'replication', 'lrs', 'grs', 'zrs'],
    definicao: 'Quantas cópias dos dados o Azure guarda e onde: no mesmo data center, em zonas ou em outra região.',
    analogia: 'Guardar cópias das fotos: no mesmo HD, em outro cômodo ou na casa de um parente em outra cidade.',
  },
  {
    id: 'vnet', termo: 'Rede virtual (VNet)', padroes: ['vnets?', 'rede virtual', 'redes virtuais', 'virtual_network'],
    definicao: 'A rede privada dos recursos no Azure, como a VPC da AWS.',
    analogia: 'O condomínio fechado, versão Azure.',
  },
  {
    id: 'nsg', termo: 'NSG', padroes: ['nsg', 'network_security_group'],
    definicao: 'Grupo de segurança de rede: regras com prioridade que permitem ou bloqueiam tráfego.',
    analogia: 'A lista da portaria, lida de cima para baixo: a primeira regra que bate decide.',
    exemplo: 'security_rule {\n  name = "ssh"\n  priority = 100\n  direction = "Inbound"\n  access = "Allow"\n  ...\n}',
  },
  {
    id: 'ip-publico', termo: 'IP público', padroes: ['ip públicos?', 'public_ip'],
    definicao: 'Um endereço que a internet consegue alcançar.',
    analogia: 'O número de telefone que você divulga; o IP privado é o ramal interno.',
  },
  {
    id: 'nic', termo: 'Interface de rede (NIC)', padroes: ['nic', 'network_interface', 'interfaces? de rede'],
    definicao: 'A "placa de rede" virtual que liga a VM a uma sub-rede.',
    analogia: 'O cabo que liga o computador na tomada de rede da parede.',
  },
  {
    id: 'vm', termo: 'Máquina virtual (VM)', padroes: ['vms?', 'máquinas? virtua(l|is)', 'virtual_machine'],
    definicao: 'Um computador virtual no Azure. O size define CPU e memória.',
    analogia: 'Alugar um computador num data center, pagando por hora.',
    exemplo: 'size = "Standard_B1s"',
  },
  {
    id: 'disco', termo: 'Disco gerenciado', padroes: ['discos?', 'managed_disk', 'os_disk'],
    definicao: 'O disco virtual da VM, cuidado pelo Azure.',
    analogia: 'O HD do computador alugado.',
  },
  {
    id: 'app-service', termo: 'App Service', padroes: ['app service', 'service_plan', 'web app', 'web_app'],
    definicao: 'Hospeda sites e APIs sem você cuidar da máquina. O plano (service plan) define o tamanho e o preço.',
    analogia: 'Alugar uma loja num shopping: você cuida da vitrine, o shopping cuida do prédio.',
  },
  {
    id: 'function-app', termo: 'Azure Functions', padroes: ['functions?', 'function_app'],
    definicao: 'Funções serverless do Azure, como o Lambda da AWS.',
    analogia: 'A campainha que faz uma tarefa e descansa, versão Azure.',
  },
  {
    id: 'sql', termo: 'Banco SQL', padroes: ['sql', 'mssql', 'postgres(ql)?', 'banco de dados', 'bancos?'],
    definicao: 'Banco relacional: dados em tabelas com linhas e colunas, consultados com SQL.',
    analogia: 'Uma planilha muito organizada, que várias pessoas consultam ao mesmo tempo.',
  },
  {
    id: 'firewall', termo: 'Regra de firewall', padroes: ['firewall'],
    definicao: 'Libera o acesso ao banco só para os IPs que você escolher.',
    analogia: 'A lista de nomes liberados na portaria do prédio.',
  },
  {
    id: 'cosmos', termo: 'Cosmos DB', padroes: ['cosmos'],
    definicao: 'Banco NoSQL do Azure, distribuído pelo mundo.',
    analogia: 'Um arquivo com cópias em várias cidades, sempre sincronizadas.',
  },
  {
    id: 'key-vault', termo: 'Key Vault', padroes: ['key vault', 'key_vault', 'cofres?'],
    definicao: 'O cofre do Azure para senhas, chaves e certificados.',
    analogia: 'O cofre do banco, com registro de quem abriu.',
  },
  {
    id: 'managed-identity', termo: 'Identidade gerenciada', padroes: ['identidades? gerenciadas?', 'managed identity', 'identity', 'user_assigned'],
    definicao: 'Uma identidade que o próprio recurso usa para acessar outros, sem senha no código.',
    analogia: 'O crachá do funcionário: a porta reconhece o crachá, ninguém precisa decorar senha.',
  },
  {
    id: 'rbac', termo: 'RBAC (atribuição de papel)', padroes: ['rbac', 'role_assignment', 'atribuição de papel'],
    definicao: 'Dá a alguém um papel (Reader, Contributor...) num escopo (assinatura, grupo ou recurso).',
    analogia: 'Dar a chave de uma sala específica, com o tipo de uso permitido: só olhar ou também mexer.',
    exemplo: 'role_definition_name = "Storage Blob Data Reader"',
  },
  {
    id: 'aks', termo: 'AKS (Kubernetes)', padroes: ['aks', 'kubernetes'],
    definicao: 'Kubernetes gerenciado pelo Azure: roda e distribui contêineres em várias máquinas (nós).',
    analogia: 'Um porto que organiza sozinho onde cada contêiner fica e repõe os que caem no mar.',
  },
  {
    id: 'acr', termo: 'Container Registry (ACR)', padroes: ['acr', 'registry', 'container_registry'],
    definicao: 'Um depósito privado de imagens de contêiner.',
    analogia: 'O almoxarifado onde ficam os caixotes prontos para embarcar.',
  },
  {
    id: 'log-analytics', termo: 'Log Analytics', padroes: ['log analytics', 'log_analytics', 'logs?'],
    definicao: 'Onde os logs ficam guardados e podem ser consultados.',
    analogia: 'O diário de bordo do navio: tudo o que aconteceu fica anotado.',
  },
  {
    id: 'app-insights', termo: 'Application Insights', padroes: ['application insights', 'application_insights', 'monitoramento'],
    definicao: 'Monitora o app: tempo de resposta, erros e uso.',
    analogia: 'O médico que mede pressão e batimentos do paciente o tempo todo.',
  },
  {
    id: 'redis', termo: 'Cache (Redis)', padroes: ['redis', 'cache'],
    definicao: 'Uma memória rápida que guarda respostas prontas, para o app não ir ao banco toda hora.',
    analogia: 'O caderninho de recados ao lado do telefone: mais rápido do que abrir o arquivo do escritório.',
  },
  {
    id: 'action-group', termo: 'Grupo de ações', padroes: ['action group', 'action_group', 'grupos? de ações'],
    definicao: 'A lista de quem avisar (e-mail, SMS, webhook) quando um alerta do Azure dispara.',
    analogia: 'A lista de telefones de emergência colada na geladeira.',
  },
  {
    id: 'private-endpoint', termo: 'Private endpoint', padroes: ['private endpoint', 'private_endpoint', 'endpoint privado'],
    definicao: 'Liga um serviço (como um storage) à sua rede por um IP privado, sem passar pela internet.',
    analogia: 'Uma porta interna entre o seu prédio e o banco, em vez de sair na rua.',
  },

  // ---------- projetos ----------
  {
    id: 'site-estatico', termo: 'Site estático', padroes: ['site estático', 'static website', 'static_website'],
    definicao: 'Um site só com arquivos (HTML, CSS, imagens), sem programa rodando no servidor.',
    analogia: 'Um folheto impresso: todo mundo recebe a mesma página.',
  },
  {
    id: 'tres-camadas', termo: 'Arquitetura de 3 camadas', padroes: ['3 camadas', 'três camadas'],
    definicao: 'Separa a aplicação em web (pública), app (interna) e banco (mais protegido).',
    analogia: 'Restaurante: salão (clientes), cozinha (só funcionários) e despensa trancada.',
  },
  {
    id: 'multicloud', termo: 'Multicloud', padroes: ['multicloud', 'multinuvem'],
    definicao: 'Usar mais de uma nuvem no mesmo projeto, por exemplo AWS e Azure.',
    analogia: 'Ter conta em dois bancos: se um tiver problema, você usa o outro.',
  },
  {
    id: 'ambientes', termo: 'Ambientes (dev, hml, prod)', padroes: ['ambientes?', 'multiambiente'],
    definicao: 'Cópias separadas do sistema: desenvolvimento, homologação (testes) e produção (clientes).',
    analogia: 'Ensaio, ensaio geral e estreia de uma peça de teatro.',
  },
];

// Letras (com acento), dígitos, _ e $ contam como parte de uma palavra.
const LETRA = '[\\p{L}\\p{N}_$]';
const REGEX = new Map(GLOSSARIO.map((t) => [
  t.id,
  new RegExp(`(?<!${LETRA})(?:${t.padroes.join('|')})(?!${LETRA})`, 'iu'),
]));

// Nível de cada termo: o módulo em que ele aparece primeiro (a ordem do glossário).
const ORDEM_MODULOS = ['basico', 'aws', 'azure', 'projetos'];
const INICIO_DO_NIVEL = { basico: 'iac', aws: 'aws', azure: 'azure', projetos: 'site-estatico' };
const NIVEL = new Map();
{
  let nivel = 0;
  for (const t of GLOSSARIO) {
    const novo = Object.entries(INICIO_DO_NIVEL).find(([, id]) => id === t.id);
    if (novo) nivel = ORDEM_MODULOS.indexOf(novo[0]);
    NIVEL.set(t.id, nivel);
  }
}

/**
 * Termos do glossário que aparecem no texto, na ordem em que aparecem.
 * Se passarem de `max`, ficam os do nível do módulo (ou o mais próximo dele):
 * num exercício de Azure, "NSG" importa mais do que "bloco", já visto no começo.
 */
export function termosDoTexto(texto, { max = MAX_TERMOS, modulo } = {}) {
  const nivelItem = modulo ? ORDEM_MODULOS.indexOf(modulo) : Infinity;
  const prioridade = (t) => Math.min(NIVEL.get(t.id), nivelItem);
  return GLOSSARIO
    .map((t) => ({ termo: t, posicao: texto.search(REGEX.get(t.id)) }))
    .filter((x) => x.posicao >= 0)
    .sort((a, b) => prioridade(b.termo) - prioridade(a.termo) || a.posicao - b.posicao)
    .slice(0, max)
    .sort((a, b) => a.posicao - b.posicao)
    .map((x) => x.termo);
}
