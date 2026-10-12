// Módulo 3: Terraform no Azure. Grupos de recursos, Storage, rede, VMs,
// App Service, Functions, bancos, Key Vault, identidades, contêineres e monitoramento.
import { tf, licao, problema, AZURE, RG, juntar } from './util.js';

const REQ = tf`
  terraform {
    required_providers {
      azurerm = {
        source  = "hashicorp/azurerm"
        version = "~> 4.0"
      }
    }
  }
`;

const ST = tf`
  resource "azurerm_storage_account" "st" {
    name                     = "staulasertao2026"
    resource_group_name      = azurerm_resource_group.rg.name
    location                 = azurerm_resource_group.rg.location
    account_tier             = "Standard"
    account_replication_type = "LRS"
  }
`;

const CONTAINER = tf`
  resource "azurerm_storage_container" "fotos" {
    name                  = "fotos"
    storage_account_id    = azurerm_storage_account.st.id
    container_access_type = "private"
  }
`;

const VNET = tf`
  resource "azurerm_virtual_network" "vnet" {
    name                = "vnet-aula"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    address_space       = ["10.0.0.0/16"]
  }
`;

const SUBNET = tf`
  resource "azurerm_subnet" "app" {
    name                 = "snet-app"
    resource_group_name  = azurerm_resource_group.rg.name
    virtual_network_name = azurerm_virtual_network.vnet.name
    address_prefixes     = ["10.0.1.0/24"]
  }
`;

const NSG = tf`
  resource "azurerm_network_security_group" "web" {
    name                = "nsg-web"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
  }
`;

const PIP = tf`
  resource "azurerm_public_ip" "web" {
    name                = "pip-web"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    allocation_method   = "Static"
    sku                 = "Standard"
  }
`;

const NIC = tf`
  resource "azurerm_network_interface" "web" {
    name                = "nic-web"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location

    ip_configuration {
      name                          = "interno"
      subnet_id                     = azurerm_subnet.app.id
      private_ip_address_allocation = "Dynamic"
      public_ip_address_id          = azurerm_public_ip.web.id
    }
  }
`;

const SSH = tf`
  resource "tls_private_key" "ssh" {
    algorithm = "RSA"
    rsa_bits  = 4096
  }
`;

const VM = tf`
  resource "azurerm_linux_virtual_machine" "web" {
    name                  = "vm-web"
    resource_group_name   = azurerm_resource_group.rg.name
    location              = azurerm_resource_group.rg.location
    size                  = "Standard_B1s"
    admin_username        = "azureuser"
    network_interface_ids = [azurerm_network_interface.web.id]

    admin_ssh_key {
      username   = "azureuser"
      public_key = tls_private_key.ssh.public_key_openssh
    }

    os_disk {
      caching              = "ReadWrite"
      storage_account_type = "Standard_LRS"
    }

    source_image_reference {
      publisher = "Canonical"
      offer     = "ubuntu-24_04-lts"
      sku       = "server"
      version   = "latest"
    }
  }
`;

const PLANO = tf`
  resource "azurerm_service_plan" "plano" {
    name                = "plan-web"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    os_type             = "Linux"
    sku_name            = "B1"
  }
`;

const CLIENTE = tf`
  data "azurerm_client_config" "atual" {}
`;

const KV = tf`
  resource "azurerm_key_vault" "kv" {
    name                       = "kv-loja-sertao"
    resource_group_name        = azurerm_resource_group.rg.name
    location                   = azurerm_resource_group.rg.location
    tenant_id                  = data.azurerm_client_config.atual.tenant_id
    sku_name                   = "standard"
    purge_protection_enabled   = true
    soft_delete_retention_days = 7
    enable_rbac_authorization  = true
  }
`;

const IDENTIDADE = tf`
  resource "azurerm_user_assigned_identity" "app" {
    name                = "id-app"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
  }
`;

const LOG = tf`
  resource "azurerm_log_analytics_workspace" "log" {
    name                = "log-aula"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    sku                 = "PerGB2018"
    retention_in_days   = 30
  }
`;

const ACAO = tf`
  resource "azurerm_monitor_action_group" "ops" {
    name                = "ag-ops"
    resource_group_name = azurerm_resource_group.rg.name
    short_name          = "ops"

    email_receiver {
      name          = "time"
      email_address = "ops@exemplo.com.br"
    }
  }
`;

const comAz = (...partes) => juntar(AZURE, RG, ...partes);

export const moduloAzure = {
  id: 'azure',
  titulo: 'Terraform no Azure',
  icone: '🔷',
  descricao: 'Grupos de recursos, Storage, VNet, VMs, App Service, Functions, SQL, Cosmos DB, Key Vault, RBAC, AKS e monitoramento.',
  itens: [
    licao({
      id: 'licao-azure-provedor',
      titulo: 'O Azure e o provedor azurerm',
      resumo: `
        <p>O provedor do Azure se chama <code>azurerm</code> (Azure Resource Manager). Ele tem uma regra própria:
        o bloco <code>provider "azurerm"</code> precisa de um <code>features {}</code>, mesmo vazio.</p>
        <ul>
          <li>No Azure, tudo mora dentro de um <b>grupo de recursos</b> (<code>azurerm_resource_group</code>): a
            "pasta" do projeto. Apagar o grupo apaga tudo dentro.</li>
          <li>Cada recurso tem uma <b>location</b> (região): <code>brazilsouth</code> é São Paulo.</li>
          <li>Na versão 4 do provedor, a <b>assinatura</b> (<code>subscription_id</code>) é obrigatória: no provider
            ou na variável de ambiente <code>ARM_SUBSCRIPTION_ID</code>. O simulador finge que ela já está no ambiente.</li>
        </ul>
        <p>Os IDs do Azure são caminhos, como <code>/subscriptions/.../resourceGroups/rg-aula</code>.
        Rode o <b>✔ Apply</b> e veja na aba <b>📦 Estado</b>.</p>`,
      codigo: juntar(REQ, AZURE, RG, tf`
        output "id_do_grupo" {
          value = azurerm_resource_group.rg.id
        }
      `),
    }),

    problema({
      id: 'az-provedor',
      titulo: 'Configurando o provedor azurerm',
      dificuldade: 'facil',
      enunciado: `
        <p>Rode o plan: falta configurar o provedor do Azure.</p>
        <ul>
          <li>crie <code>terraform { required_providers { azurerm = { source = "hashicorp/azurerm", version = "~&gt; 4.0" } } }</code>;</li>
          <li>crie <code>provider "azurerm" { features {} }</code>.</li>
        </ul>`,
      dica: 'features {} é obrigatório, mesmo vazio',
      inicial: RG,
      solucao: juntar(REQ, AZURE, RG),
      testes: [
        {
          descricao: 'terraform init e plan',
          regras: [
            { semErros: true },
            { requerido: 'azurerm', source: 'hashicorp/azurerm', versao: '~> 4.0' },
            { provider: 'azurerm' },
            { texto: 'Installing hashicorp/azurerm v4' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-grupo',
      titulo: 'Um grupo de recursos',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_resource_group "loja"</code> com <code>name = "rg-loja"</code> e <code>location = "brazilsouth"</code>.</li>
        </ul>`,
      dica: 'resource "azurerm_resource_group" "loja" { ... }',
      inicial: juntar(AZURE, tf`
        # resource "azurerm_resource_group" "loja" { ... }
      `),
      solucao: juntar(AZURE, tf`
        resource "azurerm_resource_group" "loja" {
          name     = "rg-loja"
          location = "brazilsouth"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_resource_group.loja', atributo: 'name', igual: 'rg-loja' }, { recurso: 'azurerm_resource_group.loja', atributo: 'location', igual: 'brazilsouth' }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_resource_group.loja', atributo: 'id', regex: '^/subscriptions/[^/]+/resourceGroups/rg-loja$' }] },
      ],
    }),

    problema({
      id: 'az-grupo-variaveis',
      titulo: 'Grupo com variáveis e tags',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>use <code>var.nome</code> e <code>var.local</code> no grupo de recursos <code>rg</code>;</li>
          <li>acrescente as tags <code>Projeto = "loja"</code> e <code>Ambiente = "dev"</code>.</li>
        </ul>
        <p>Teste: o Azure aceita "Brazil South" ou "brazilsouth". No plano, o provedor sempre mostra a forma
        normalizada (minúsculas, sem espaço).</p>`,
      dica: 'name = var.nome e location = var.local',
      inicial: juntar(AZURE, tf`
        variable "nome" {
          type    = string
          default = "rg-loja"
        }

        variable "local" {
          type    = string
          default = "brazilsouth"
        }

        resource "azurerm_resource_group" "rg" {
          name     = "rg"
          location = "eastus"
        }
      `),
      solucao: juntar(AZURE, tf`
        variable "nome" {
          type    = string
          default = "rg-loja"
        }

        variable "local" {
          type    = string
          default = "brazilsouth"
        }

        resource "azurerm_resource_group" "rg" {
          name     = var.nome
          location = var.local

          tags = {
            Projeto  = "loja"
            Ambiente = "dev"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_resource_group.rg', atributo: 'name', igual: 'rg-loja' },
            { recurso: 'azurerm_resource_group.rg', atributo: 'location', igual: 'brazilsouth' },
            { recurso: 'azurerm_resource_group.rg', atributo: 'tags', igual: { Projeto: 'loja', Ambiente: 'dev' } },
          ],
        },
        { oculto: true, descricao: 'local = "East US"', variaveis: { local: 'East US' }, regras: [{ recurso: 'azurerm_resource_group.rg', atributo: 'location', igual: 'eastus' }] },
      ],
    }),

    problema({
      id: 'az-grupos-ambientes',
      titulo: 'Um grupo por ambiente',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_resource_group "ambiente"</code> com <code>for_each = toset(var.ambientes)</code>;</li>
          <li>o nome deve ser <code>"rg-loja-\${each.key}"</code> e a location <code>"brazilsouth"</code>.</li>
        </ul>`,
      dica: 'name = "rg-loja-${each.key}"',
      inicial: juntar(AZURE, tf`
        variable "ambientes" {
          type    = list(string)
          default = ["dev", "hml", "prod"]
        }
      `),
      solucao: juntar(AZURE, tf`
        variable "ambientes" {
          type    = list(string)
          default = ["dev", "hml", "prod"]
        }

        resource "azurerm_resource_group" "ambiente" {
          for_each = toset(var.ambientes)
          name     = "rg-loja-\${each.key}"
          location = "brazilsouth"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { instancias: 'azurerm_resource_group.ambiente', quantidade: 3 }, { recurso: 'azurerm_resource_group.ambiente["prod"]', atributo: 'name', igual: 'rg-loja-prod' }] },
        { oculto: true, descricao: 'dois ambientes', variaveis: { ambientes: ['qa', 'prod'] }, regras: [{ instancias: 'azurerm_resource_group.ambiente', quantidade: 2 }] },
      ],
    }),

    problema({
      id: 'az-local-validado',
      titulo: 'Só regiões permitidas',
      dificuldade: 'medio',
      enunciado: `
        <p>Por causa da LGPD, os dados do projeto só podem ficar no Brasil ou nos EUA.</p>
        <ul>
          <li>na <code>variable "local"</code>, crie um <code>validation</code> que só aceita <code>"brazilsouth"</code> ou <code>"eastus"</code>;</li>
          <li>com uma <code>error_message</code> explicando o motivo.</li>
        </ul>`,
      dica: 'contains(["brazilsouth", "eastus"], var.local)',
      inicial: juntar(AZURE, tf`
        variable "local" {
          type    = string
          default = "brazilsouth"
        }

        resource "azurerm_resource_group" "rg" {
          name     = "rg-dados"
          location = var.local
        }
      `),
      solucao: juntar(AZURE, tf`
        variable "local" {
          type    = string
          default = "brazilsouth"

          validation {
            condition     = contains(["brazilsouth", "eastus"], var.local)
            error_message = "Use brazilsouth ou eastus: os dados não podem sair dessas regiões."
          }
        }

        resource "azurerm_resource_group" "rg" {
          name     = "rg-dados"
          location = var.local
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { variavel: 'local', validacao: true }] },
        { descricao: 'local = "westeurope"', variaveis: { local: 'westeurope' }, regras: [{ erro: 'Invalid value for variable', msg: 'westeurope é recusado' }] },
        { oculto: true, descricao: 'local = "eastus"', variaveis: { local: 'eastus' }, regras: [{ semErros: true }] },
      ],
    }),

    problema({
      id: 'az-client-config',
      titulo: 'Quem está autenticado?',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>data "azurerm_client_config" "atual" {}</code>;</li>
          <li>crie <code>output "tenant"</code> com o <code>tenant_id</code> e <code>output "assinatura"</code> com o <code>subscription_id</code>.</li>
        </ul>`,
      dica: 'data.azurerm_client_config.atual.tenant_id',
      inicial: juntar(AZURE, tf`
        # data "azurerm_client_config" "atual" {}
      `),
      solucao: juntar(AZURE, CLIENTE, tf`
        output "tenant" {
          value = data.azurerm_client_config.atual.tenant_id
        }

        output "assinatura" {
          value = data.azurerm_client_config.atual.subscription_id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { dado: 'azurerm_client_config.atual' },
            { saida: 'tenant', regex: '^[0-9a-f-]{36}$' },
            { saida: 'assinatura', regex: '^[0-9a-f-]{36}$' },
          ],
        },
      ],
    }),

    licao({
      id: 'licao-azure-storage',
      titulo: 'Storage: contas, containers e blobs',
      resumo: `
        <p>A <b>conta de armazenamento</b> (<code>azurerm_storage_account</code>) é um galpão com várias salas:
        blobs (arquivos), filas, tabelas e compartilhamentos de arquivos.</p>
        <ul>
          <li>o nome é <b>único no mundo</b>: 3 a 24 caracteres, só letras minúsculas e números;</li>
          <li><code>account_tier</code>: <code>Standard</code> ou <code>Premium</code>;</li>
          <li><code>account_replication_type</code>: quantas cópias e onde (<code>LRS</code> = 3 cópias no mesmo data center,
            <code>GRS</code> = também em outra região);</li>
          <li>dentro dela, <b>containers</b> guardam os <b>blobs</b>.</li>
        </ul>`,
      codigo: comAz(ST, CONTAINER, tf`
        output "endpoint" {
          value = azurerm_storage_account.st.primary_blob_endpoint
        }
      `),
    }),

    problema({
      id: 'az-storage',
      titulo: 'Uma conta de armazenamento',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_storage_account "st"</code> com <code>name = "staulasertao2026"</code>;</li>
          <li>no grupo <code>rg</code> (use <code>azurerm_resource_group.rg.name</code> e <code>.location</code>);</li>
          <li>com <code>account_tier = "Standard"</code> e <code>account_replication_type = "LRS"</code>.</li>
        </ul>`,
      dica: 'resource_group_name = azurerm_resource_group.rg.name',
      inicial: comAz(),
      solucao: comAz(ST),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_storage_account.st', atributo: 'name', igual: 'staulasertao2026' },
            { recurso: 'azurerm_storage_account.st', atributo: 'account_tier', igual: 'Standard' },
            { recurso: 'azurerm_storage_account.st', atributo: 'account_replication_type', igual: 'LRS' },
            { recurso: 'azurerm_storage_account.st', atributo: 'location', igual: 'brazilsouth' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_storage_account.st', atributo: 'primary_blob_endpoint', igual: 'https://staulasertao2026.blob.core.windows.net/' }] },
      ],
    }),

    problema({
      id: 'az-storage-sufixo',
      titulo: 'Nome de storage sem conflito',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>random_string "sufixo"</code> com <code>length = 8</code>, <code>special = false</code> e <code>upper = false</code>;</li>
          <li>o nome da conta deve ser <code>"staula\${random_string.sufixo.result}"</code>.</li>
        </ul>`,
      dica: 'name = "staula${random_string.sufixo.result}"',
      inicial: comAz(tf`
        resource "azurerm_storage_account" "st" {
          name                     = "staula"
          resource_group_name      = azurerm_resource_group.rg.name
          location                 = azurerm_resource_group.rg.location
          account_tier             = "Standard"
          account_replication_type = "LRS"
        }
      `),
      solucao: comAz(tf`
        resource "random_string" "sufixo" {
          length  = 8
          special = false
          upper   = false
        }

        resource "azurerm_storage_account" "st" {
          name                     = "staula\${random_string.sufixo.result}"
          resource_group_name      = azurerm_resource_group.rg.name
          location                 = azurerm_resource_group.rg.location
          account_tier             = "Standard"
          account_replication_type = "LRS"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_storage_account.st', atributo: 'name', referencia: 'random_string.sufixo.result' }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_storage_account.st', atributo: 'name', regex: '^staula[a-z0-9]{8}$' }] },
      ],
    }),

    problema({
      id: 'az-storage-nome-invalido',
      titulo: 'Conserte o nome da conta',
      dificuldade: 'facil',
      enunciado: `
        <p>Rode o plan e leia o erro: o nome da conta de armazenamento tem caracteres proibidos.</p>
        <ul>
          <li>troque por <code>staulaturma2026</code> (só minúsculas e números, até 24 caracteres).</li>
        </ul>`,
      dica: 'Sem maiúsculas, sem hífen e sem sublinhado',
      inicial: comAz(tf`
        resource "azurerm_storage_account" "st" {
          name                     = "St_Aula-Turma"
          resource_group_name      = azurerm_resource_group.rg.name
          location                 = azurerm_resource_group.rg.location
          account_tier             = "Standard"
          account_replication_type = "LRS"
        }
      `),
      solucao: comAz(tf`
        resource "azurerm_storage_account" "st" {
          name                     = "staulaturma2026"
          resource_group_name      = azurerm_resource_group.rg.name
          location                 = azurerm_resource_group.rg.location
          account_tier             = "Standard"
          account_replication_type = "LRS"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_storage_account.st', atributo: 'name', igual: 'staulaturma2026' }] },
      ],
    }),

    problema({
      id: 'az-container',
      titulo: 'Um container privado',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_storage_container "fotos"</code> com <code>name = "fotos"</code>;</li>
          <li>ligado à conta: <code>storage_account_id = azurerm_storage_account.st.id</code>;</li>
          <li>com <code>container_access_type = "private"</code>.</li>
        </ul>`,
      dica: 'Na versão 4 do provedor, use storage_account_id (e não storage_account_name)',
      inicial: comAz(ST),
      solucao: comAz(ST, CONTAINER),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_storage_container.fotos', atributo: 'storage_account_id', referencia: 'azurerm_storage_account.st.id' },
            { recurso: 'azurerm_storage_container.fotos', atributo: 'container_access_type', igual: 'private' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-blob',
      titulo: 'Enviando um blob',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_storage_blob "pagina"</code> com <code>name = "index.html"</code> e <code>type = "Block"</code>;</li>
          <li><code>storage_account_name = azurerm_storage_account.st.name</code> e
            <code>storage_container_name = azurerm_storage_container.fotos.name</code>;</li>
          <li>com <code>source_content = "&lt;h1&gt;Olá, sertão!&lt;/h1&gt;"</code> e <code>content_type = "text/html"</code>.</li>
        </ul>`,
      dica: 'type = "Block" é o tipo comum para arquivos',
      inicial: comAz(ST, CONTAINER),
      solucao: comAz(ST, CONTAINER, tf`
        resource "azurerm_storage_blob" "pagina" {
          name                   = "index.html"
          storage_account_name   = azurerm_storage_account.st.name
          storage_container_name = azurerm_storage_container.fotos.name
          type                   = "Block"
          source_content         = "<h1>Olá, sertão!</h1>"
          content_type           = "text/html"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_storage_blob.pagina', atributo: 'type', igual: 'Block' },
            { recurso: 'azurerm_storage_blob.pagina', atributo: 'content_type', igual: 'text/html' },
            { recurso: 'azurerm_storage_blob.pagina', atributo: 'storage_container_name', igual: 'fotos' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_storage_blob.pagina', atributo: 'url', igual: 'https://staulasertao2026.blob.core.windows.net/fotos/index.html' }] },
      ],
    }),

    problema({
      id: 'az-site-estatico',
      titulo: 'Site estático no Storage',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_storage_account_static_website "site"</code> com <code>storage_account_id = azurerm_storage_account.st.id</code>;</li>
          <li>com <code>index_document = "index.html"</code> e <code>error_404_document = "404.html"</code>;</li>
          <li>crie <code>output "url"</code> com <code>azurerm_storage_account.st.primary_web_endpoint</code>.</li>
        </ul>`,
      dica: 'resource "azurerm_storage_account_static_website" "site" { ... }',
      inicial: comAz(ST),
      solucao: comAz(ST, tf`
        resource "azurerm_storage_account_static_website" "site" {
          storage_account_id = azurerm_storage_account.st.id
          index_document     = "index.html"
          error_404_document = "404.html"
        }

        output "url" {
          value = azurerm_storage_account.st.primary_web_endpoint
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_storage_account_static_website.site', atributo: 'index_document', igual: 'index.html' },
            { recurso: 'azurerm_storage_account_static_website.site', atributo: 'storage_account_id', referencia: 'azurerm_storage_account.st.id' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'url', contem: 'web.core.windows.net' }] },
      ],
    }),

    problema({
      id: 'az-chave-sensivel',
      titulo: 'A chave de acesso é segredo',
      dificuldade: 'medio',
      enunciado: `
        <p>Rode o plan: a <code>primary_access_key</code> é sensível, e o output não pode mostrá-la sem confirmar.</p>
        <ul>
          <li>acrescente <code>sensitive = true</code> ao <code>output "chave"</code>.</li>
        </ul>
        <p>Melhor ainda na vida real: não exponha a chave; use identidades gerenciadas (você vai ver mais adiante).</p>`,
      dica: 'sensitive = true no output',
      inicial: comAz(ST, tf`
        output "chave" {
          value = azurerm_storage_account.st.primary_access_key
        }
      `),
      solucao: comAz(ST, tf`
        output "chave" {
          value     = azurerm_storage_account.st.primary_access_key
          sensitive = true
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { saida: 'chave', sensivel: true }] },
      ],
    }),

    problema({
      id: 'az-fila-compartilhamento',
      titulo: 'Fila e compartilhamento de arquivos',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_storage_queue "pedidos"</code> com <code>name = "pedidos"</code> na conta <code>st</code>;</li>
          <li>crie <code>azurerm_storage_share "arquivos"</code> com <code>name = "arquivos"</code> e <code>quota = 50</code> (GB);</li>
          <li>ligue os dois com <code>storage_account_id = azurerm_storage_account.st.id</code>.</li>
        </ul>`,
      dica: 'quota é o tamanho máximo em GB',
      inicial: comAz(ST),
      solucao: comAz(ST, tf`
        resource "azurerm_storage_queue" "pedidos" {
          name               = "pedidos"
          storage_account_id = azurerm_storage_account.st.id
        }

        resource "azurerm_storage_share" "arquivos" {
          name               = "arquivos"
          storage_account_id = azurerm_storage_account.st.id
          quota              = 50
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_storage_queue.pedidos', atributo: 'name', igual: 'pedidos' },
            { recurso: 'azurerm_storage_share.arquivos', atributo: 'quota', igual: 50 },
            { recurso: 'azurerm_storage_share.arquivos', atributo: 'storage_account_id', referencia: 'azurerm_storage_account.st.id' },
          ],
        },
      ],
    }),

    licao({
      id: 'licao-azure-rede',
      titulo: 'Rede no Azure: VNet, sub-redes e NSG',
      resumo: `
        <p>A <b>VNet</b> é a rede privada (como a VPC da AWS). Dentro dela ficam as <b>sub-redes</b>.</p>
        <ul>
          <li>o <b>NSG</b> (grupo de segurança de rede) tem regras com <b>prioridade</b>: o número menor é lido
            primeiro (100 antes de 200), e a primeira regra que bate decide;</li>
          <li>o NSG pode ser ligado a uma sub-rede ou a uma placa de rede (NIC);</li>
          <li>a <b>NIC</b> liga a VM à sub-rede, e o <b>IP público</b> a deixa visível na internet.</li>
        </ul>`,
      codigo: comAz(VNET, SUBNET, tf`
        resource "azurerm_network_security_group" "web" {
          name                = "nsg-web"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location

          security_rule {
            name                       = "permitir-https"
            priority                   = 100
            direction                  = "Inbound"
            access                     = "Allow"
            protocol                   = "Tcp"
            source_port_range          = "*"
            destination_port_range     = "443"
            source_address_prefix      = "*"
            destination_address_prefix = "*"
          }
        }

        resource "azurerm_subnet_network_security_group_association" "app" {
          subnet_id                 = azurerm_subnet.app.id
          network_security_group_id = azurerm_network_security_group.web.id
        }
      `),
    }),

    problema({
      id: 'az-vnet',
      titulo: 'Uma rede virtual',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_virtual_network "vnet"</code> com <code>name = "vnet-aula"</code>;</li>
          <li>no grupo <code>rg</code> e com <code>address_space = ["10.0.0.0/16"]</code>.</li>
        </ul>`,
      dica: 'address_space é uma lista',
      inicial: comAz(),
      solucao: comAz(VNET),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_virtual_network.vnet', atributo: 'name', igual: 'vnet-aula' }, { recurso: 'azurerm_virtual_network.vnet', atributo: 'address_space', igual: ['10.0.0.0/16'] }] },
      ],
    }),

    problema({
      id: 'az-subnet',
      titulo: 'Uma sub-rede',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_subnet "app"</code> com <code>name = "snet-app"</code>;</li>
          <li><code>virtual_network_name = azurerm_virtual_network.vnet.name</code>;</li>
          <li><code>address_prefixes = ["10.0.1.0/24"]</code>.</li>
        </ul>`,
      dica: 'A sub-rede usa o nome da VNet, não o id',
      inicial: comAz(VNET),
      solucao: comAz(VNET, SUBNET),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_subnet.app', atributo: 'virtual_network_name', igual: 'vnet-aula' },
            { recurso: 'azurerm_subnet.app', atributo: 'address_prefixes', igual: ['10.0.1.0/24'] },
          ],
        },
      ],
    }),

    problema({
      id: 'az-subnets-mapa',
      titulo: 'Sub-redes a partir de um mapa',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_subnet "rede"</code> com <code>for_each = var.subredes</code>;</li>
          <li>o nome deve ser <code>"snet-\${each.key}"</code> e o prefixo <code>[each.value]</code>.</li>
        </ul>`,
      dica: 'address_prefixes = [each.value]',
      inicial: comAz(VNET, tf`
        variable "subredes" {
          type = map(string)
          default = {
            app   = "10.0.1.0/24"
            dados = "10.0.2.0/24"
          }
        }
      `),
      solucao: comAz(VNET, tf`
        variable "subredes" {
          type = map(string)
          default = {
            app   = "10.0.1.0/24"
            dados = "10.0.2.0/24"
          }
        }

        resource "azurerm_subnet" "rede" {
          for_each             = var.subredes
          name                 = "snet-\${each.key}"
          resource_group_name  = azurerm_resource_group.rg.name
          virtual_network_name = azurerm_virtual_network.vnet.name
          address_prefixes     = [each.value]
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { instancias: 'azurerm_subnet.rede', quantidade: 2 }, { recurso: 'azurerm_subnet.rede["dados"]', atributo: 'name', igual: 'snet-dados' }] },
        { oculto: true, descricao: 'três sub-redes', variaveis: { subredes: { a: '10.0.10.0/24', b: '10.0.11.0/24', c: '10.0.12.0/24' } }, regras: [{ instancias: 'azurerm_subnet.rede', quantidade: 3 }] },
      ],
    }),

    problema({
      id: 'az-nsg',
      titulo: 'NSG liberando SSH',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>no <code>azurerm_network_security_group "web"</code>, crie um bloco <code>security_rule</code>;</li>
          <li><code>name = "permitir-ssh"</code>, <code>priority = 100</code>, <code>direction = "Inbound"</code>,
            <code>access = "Allow"</code>, <code>protocol = "Tcp"</code>;</li>
          <li><code>source_port_range = "*"</code>, <code>destination_port_range = "22"</code>,
            <code>source_address_prefix = "*"</code> e <code>destination_address_prefix = "*"</code>.</li>
        </ul>`,
      dica: 'Na vida real, troque o "*" da origem pelo IP da sua casa ou escola',
      inicial: comAz(NSG),
      solucao: comAz(tf`
        resource "azurerm_network_security_group" "web" {
          name                = "nsg-web"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location

          security_rule {
            name                       = "permitir-ssh"
            priority                   = 100
            direction                  = "Inbound"
            access                     = "Allow"
            protocol                   = "Tcp"
            source_port_range          = "*"
            destination_port_range     = "22"
            source_address_prefix      = "*"
            destination_address_prefix = "*"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_network_security_group.web', atributo: 'security_rule.0.destination_port_range', igual: '22' },
            { recurso: 'azurerm_network_security_group.web', atributo: 'security_rule.0.priority', igual: 100 },
            { recurso: 'azurerm_network_security_group.web', atributo: 'security_rule.0.direction', igual: 'Inbound' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-nsg-dinamico',
      titulo: 'Regras do NSG a partir de uma lista',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie um <code>dynamic "security_rule"</code> com <code>for_each = var.regras</code>;</li>
          <li>no <code>content</code>: <code>name = security_rule.value.nome</code>, <code>priority = security_rule.value.prioridade</code>,
            <code>destination_port_range = security_rule.value.porta</code>;</li>
          <li>os demais: <code>direction = "Inbound"</code>, <code>access = "Allow"</code>, <code>protocol = "Tcp"</code>
            e os prefixos e porta de origem <code>"*"</code>.</li>
        </ul>`,
      dica: 'Dentro do content, o item da vez é security_rule.value',
      inicial: comAz(tf`
        variable "regras" {
          type = list(object({
            nome       = string
            prioridade = number
            porta      = string
          }))
          default = [
            { nome = "http", prioridade = 100, porta = "80" },
            { nome = "https", prioridade = 110, porta = "443" },
          ]
        }
      `, NSG),
      solucao: comAz(tf`
        variable "regras" {
          type = list(object({
            nome       = string
            prioridade = number
            porta      = string
          }))
          default = [
            { nome = "http", prioridade = 100, porta = "80" },
            { nome = "https", prioridade = 110, porta = "443" },
          ]
        }

        resource "azurerm_network_security_group" "web" {
          name                = "nsg-web"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location

          dynamic "security_rule" {
            for_each = var.regras
            content {
              name                       = security_rule.value.nome
              priority                   = security_rule.value.prioridade
              direction                  = "Inbound"
              access                     = "Allow"
              protocol                   = "Tcp"
              source_port_range          = "*"
              destination_port_range     = security_rule.value.porta
              source_address_prefix      = "*"
              destination_address_prefix = "*"
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { meta: 'azurerm_network_security_group.web', dinamico: 'security_rule' },
            { recurso: 'azurerm_network_security_group.web', atributo: 'security_rule', tamanho: 2 },
            { recurso: 'azurerm_network_security_group.web', atributo: 'security_rule.1.destination_port_range', igual: '443' },
          ],
        },
        {
          oculto: true,
          descricao: 'três regras',
          variaveis: { regras: [{ nome: 'a', prioridade: 100, porta: '80' }, { nome: 'b', prioridade: 200, porta: '22' }, { nome: 'c', prioridade: 300, porta: '3389' }] },
          regras: [{ recurso: 'azurerm_network_security_group.web', atributo: 'security_rule', tamanho: 3 }],
        },
      ],
    }),

    problema({
      id: 'az-nsg-associacao',
      titulo: 'Ligando o NSG à sub-rede',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_subnet_network_security_group_association "app"</code>;</li>
          <li>com <code>subnet_id = azurerm_subnet.app.id</code> e <code>network_security_group_id = azurerm_network_security_group.web.id</code>.</li>
        </ul>`,
      dica: 'A associação só liga os dois: dois ids',
      inicial: comAz(VNET, SUBNET, NSG),
      solucao: comAz(VNET, SUBNET, NSG, tf`
        resource "azurerm_subnet_network_security_group_association" "app" {
          subnet_id                 = azurerm_subnet.app.id
          network_security_group_id = azurerm_network_security_group.web.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_subnet_network_security_group_association.app', atributo: 'subnet_id', referencia: 'azurerm_subnet.app.id' },
            { recurso: 'azurerm_subnet_network_security_group_association.app', atributo: 'network_security_group_id', referencia: 'azurerm_network_security_group.web.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-ip-publico',
      titulo: 'Um IP público',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_public_ip "web"</code> com <code>name = "pip-web"</code>;</li>
          <li>com <code>allocation_method = "Static"</code> e <code>sku = "Standard"</code>.</li>
        </ul>
        <p>Com o SKU Standard, o IP precisa ser estático: o Azure recusa "Dynamic" no apply.</p>`,
      dica: 'allocation_method = "Static"',
      inicial: comAz(),
      solucao: comAz(PIP),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_public_ip.web', atributo: 'allocation_method', igual: 'Static' }, { recurso: 'azurerm_public_ip.web', atributo: 'sku', igual: 'Standard' }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_public_ip.web', atributo: 'ip_address', regex: '^\\d+\\.\\d+\\.\\d+\\.\\d+$' }] },
      ],
    }),

    problema({
      id: 'az-nic',
      titulo: 'Placa de rede (NIC)',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_network_interface "web"</code> com <code>name = "nic-web"</code>;</li>
          <li>com um bloco <code>ip_configuration</code>: <code>name = "interno"</code>, <code>subnet_id = azurerm_subnet.app.id</code>,
            <code>private_ip_address_allocation = "Dynamic"</code> e <code>public_ip_address_id = azurerm_public_ip.web.id</code>.</li>
        </ul>`,
      dica: 'ip_configuration { ... } é obrigatório',
      inicial: comAz(VNET, SUBNET, PIP),
      solucao: comAz(VNET, SUBNET, PIP, NIC),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_network_interface.web', atributo: 'ip_configuration.0.subnet_id', referencia: 'azurerm_subnet.app.id' },
            { recurso: 'azurerm_network_interface.web', atributo: 'ip_configuration.0.public_ip_address_id', referencia: 'azurerm_public_ip.web.id' },
            { recurso: 'azurerm_network_interface.web', atributo: 'ip_configuration.0.private_ip_address_allocation', igual: 'Dynamic' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-nat',
      titulo: 'NAT gateway no Azure',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_nat_gateway "nat"</code> com <code>name = "nat-aula"</code>;</li>
          <li>ligue o IP público: <code>azurerm_nat_gateway_public_ip_association "nat"</code> (<code>nat_gateway_id</code> e <code>public_ip_address_id</code>);</li>
          <li>ligue à sub-rede: <code>azurerm_subnet_nat_gateway_association "app"</code> (<code>subnet_id</code> e <code>nat_gateway_id</code>).</li>
        </ul>`,
      dica: 'Duas associações: uma com o IP, outra com a sub-rede',
      inicial: comAz(VNET, SUBNET, PIP),
      solucao: comAz(VNET, SUBNET, PIP, tf`
        resource "azurerm_nat_gateway" "nat" {
          name                = "nat-aula"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
        }

        resource "azurerm_nat_gateway_public_ip_association" "nat" {
          nat_gateway_id       = azurerm_nat_gateway.nat.id
          public_ip_address_id = azurerm_public_ip.web.id
        }

        resource "azurerm_subnet_nat_gateway_association" "app" {
          subnet_id      = azurerm_subnet.app.id
          nat_gateway_id = azurerm_nat_gateway.nat.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_nat_gateway_public_ip_association.nat', atributo: 'public_ip_address_id', referencia: 'azurerm_public_ip.web.id' },
            { recurso: 'azurerm_subnet_nat_gateway_association.app', atributo: 'nat_gateway_id', referencia: 'azurerm_nat_gateway.nat.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-peering',
      titulo: 'Ligando duas VNets (peering)',
      dificuldade: 'dificil',
      enunciado: `
        <p>A rede <code>hub</code> (10.0.0.0/16) e a <code>spoke</code> (10.1.0.0/16) precisam conversar. O peering é feito
        nos <b>dois sentidos</b>.</p>
        <ul>
          <li>crie <code>azurerm_virtual_network_peering "hub_para_spoke"</code> na VNet <code>hub</code>, com
            <code>remote_virtual_network_id = azurerm_virtual_network.spoke.id</code>;</li>
          <li>crie <code>azurerm_virtual_network_peering "spoke_para_hub"</code> na VNet <code>spoke</code>, apontando para o hub.</li>
        </ul>`,
      dica: 'Cada peering mora numa VNet (virtual_network_name) e aponta para a outra (remote_virtual_network_id)',
      inicial: comAz(tf`
        resource "azurerm_virtual_network" "hub" {
          name                = "vnet-hub"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          address_space       = ["10.0.0.0/16"]
        }

        resource "azurerm_virtual_network" "spoke" {
          name                = "vnet-spoke"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          address_space       = ["10.1.0.0/16"]
        }
      `),
      solucao: comAz(tf`
        resource "azurerm_virtual_network" "hub" {
          name                = "vnet-hub"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          address_space       = ["10.0.0.0/16"]
        }

        resource "azurerm_virtual_network" "spoke" {
          name                = "vnet-spoke"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          address_space       = ["10.1.0.0/16"]
        }

        resource "azurerm_virtual_network_peering" "hub_para_spoke" {
          name                      = "hub-para-spoke"
          resource_group_name       = azurerm_resource_group.rg.name
          virtual_network_name      = azurerm_virtual_network.hub.name
          remote_virtual_network_id = azurerm_virtual_network.spoke.id
        }

        resource "azurerm_virtual_network_peering" "spoke_para_hub" {
          name                      = "spoke-para-hub"
          resource_group_name       = azurerm_resource_group.rg.name
          virtual_network_name      = azurerm_virtual_network.spoke.name
          remote_virtual_network_id = azurerm_virtual_network.hub.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { tipo: 'azurerm_virtual_network_peering', quantidade: 2 },
            { recurso: 'azurerm_virtual_network_peering.hub_para_spoke', atributo: 'remote_virtual_network_id', referencia: 'azurerm_virtual_network.spoke.id' },
            { recurso: 'azurerm_virtual_network_peering.spoke_para_hub', atributo: 'remote_virtual_network_id', referencia: 'azurerm_virtual_network.hub.id' },
          ],
        },
      ],
    }),

    licao({
      id: 'licao-azure-computacao',
      titulo: 'Computação: VMs, App Service e Functions',
      resumo: `
        <p>Três jeitos de rodar código no Azure, do mais "mão na massa" ao mais gerenciado:</p>
        <ul>
          <li><b>VM</b> (<code>azurerm_linux_virtual_machine</code>): você cuida de tudo. Precisa de uma NIC, de um disco,
            de uma imagem e de uma chave SSH (o Azure exige chave RSA);</li>
          <li><b>App Service</b>: um <b>plano</b> (<code>azurerm_service_plan</code>, o "tamanho da máquina") e o
            <b>app</b> (<code>azurerm_linux_web_app</code>), onde você só sobe o código;</li>
          <li><b>Functions</b>: código que roda por evento, pago por execução (plano <code>Y1</code>).</li>
        </ul>`,
      codigo: comAz(PLANO, tf`
        resource "azurerm_linux_web_app" "app" {
          name                = "app-exemplo-sertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          service_plan_id     = azurerm_service_plan.plano.id

          site_config {
            application_stack {
              node_version = "20-lts"
            }
          }
        }

        output "endereco" {
          value = "https://\${azurerm_linux_web_app.app.default_hostname}"
        }
      `),
    }),

    problema({
      id: 'az-vm',
      titulo: 'Uma máquina virtual Linux',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>gere uma chave: <code>tls_private_key "ssh"</code> com <code>algorithm = "RSA"</code> e <code>rsa_bits = 4096</code>;</li>
          <li>crie <code>azurerm_linux_virtual_machine "web"</code>: <code>name = "vm-web"</code>, <code>size = "Standard_B1s"</code>,
            <code>admin_username = "azureuser"</code> e <code>network_interface_ids = [azurerm_network_interface.web.id]</code>;</li>
          <li>bloco <code>admin_ssh_key</code> com o usuário e <code>public_key = tls_private_key.ssh.public_key_openssh</code>;</li>
          <li>bloco <code>os_disk</code> com <code>caching = "ReadWrite"</code> e <code>storage_account_type = "Standard_LRS"</code>;</li>
          <li>bloco <code>source_image_reference</code>: <code>Canonical</code>, <code>ubuntu-24_04-lts</code>, <code>server</code>, <code>latest</code>.</li>
        </ul>`,
      dica: 'Use a aba 📘 Docs para ver os argumentos obrigatórios da VM',
      inicial: comAz(VNET, SUBNET, PIP, NIC),
      solucao: comAz(VNET, SUBNET, PIP, NIC, SSH, VM),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_linux_virtual_machine.web', atributo: 'size', igual: 'Standard_B1s' },
            { recurso: 'azurerm_linux_virtual_machine.web', atributo: 'admin_ssh_key.0.public_key', referencia: 'tls_private_key.ssh.public_key_openssh' },
            { recurso: 'azurerm_linux_virtual_machine.web', atributo: 'os_disk.0.caching', igual: 'ReadWrite' },
            { recurso: 'azurerm_linux_virtual_machine.web', atributo: 'source_image_reference.0.offer', igual: 'ubuntu-24_04-lts' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-vm-cloud-init',
      titulo: 'Configurando a VM ao ligar (cloud-init)',
      dificuldade: 'medio',
      enunciado: `
        <p>O arquivo <code>cloud-init.yaml</code> instala um pacote na primeira vez que a VM liga. No Azure, o
        <code>custom_data</code> vai em base64.</p>
        <ul>
          <li>na VM, acrescente <code>custom_data = base64encode(templatefile("cloud-init.yaml", { pacote = "nginx" }))</code>.</li>
        </ul>`,
      dica: 'base64encode(templatefile(...))',
      inicial: {
        'main.tf': comAz(VNET, SUBNET, PIP, NIC, SSH, VM),
        'cloud-init.yaml': '#cloud-config\npackages:\n  - ${pacote}\n',
      },
      solucao: {
        'main.tf': comAz(VNET, SUBNET, PIP, NIC, SSH, VM.replace('  network_interface_ids = [azurerm_network_interface.web.id]\n', '  network_interface_ids = [azurerm_network_interface.web.id]\n  custom_data           = base64encode(templatefile("cloud-init.yaml", { pacote = "nginx" }))\n')),
        'cloud-init.yaml': '#cloud-config\npackages:\n  - ${pacote}\n',
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_linux_virtual_machine.web', atributo: 'custom_data', existe: true },
            { codigo: 'base64encode\\(\\s*templatefile', msg: 'O custom_data usa base64encode(templatefile(...))' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-disco',
      titulo: 'Disco de dados',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_managed_disk "dados"</code>: <code>name = "disco-dados"</code>,
            <code>storage_account_type = "Standard_LRS"</code>, <code>create_option = "Empty"</code> e <code>disk_size_gb = 64</code>;</li>
          <li>ligue na VM com <code>azurerm_virtual_machine_data_disk_attachment "dados"</code>:
            <code>managed_disk_id</code>, <code>virtual_machine_id</code>, <code>lun = 0</code> e <code>caching = "ReadWrite"</code>.</li>
        </ul>`,
      dica: 'lun é o "número da porta" do disco na VM',
      inicial: comAz(VNET, SUBNET, PIP, NIC, SSH, VM),
      solucao: comAz(VNET, SUBNET, PIP, NIC, SSH, VM, tf`
        resource "azurerm_managed_disk" "dados" {
          name                 = "disco-dados"
          resource_group_name  = azurerm_resource_group.rg.name
          location             = azurerm_resource_group.rg.location
          storage_account_type = "Standard_LRS"
          create_option        = "Empty"
          disk_size_gb         = 64
        }

        resource "azurerm_virtual_machine_data_disk_attachment" "dados" {
          managed_disk_id    = azurerm_managed_disk.dados.id
          virtual_machine_id = azurerm_linux_virtual_machine.web.id
          lun                = 0
          caching            = "ReadWrite"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_managed_disk.dados', atributo: 'disk_size_gb', igual: 64 },
            { recurso: 'azurerm_virtual_machine_data_disk_attachment.dados', atributo: 'managed_disk_id', referencia: 'azurerm_managed_disk.dados.id' },
            { recurso: 'azurerm_virtual_machine_data_disk_attachment.dados', atributo: 'lun', igual: 0 },
          ],
        },
      ],
    }),

    problema({
      id: 'az-vmss',
      titulo: 'Conjunto de VMs (scale set)',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_linux_virtual_machine_scale_set "web"</code>: <code>name = "vmss-web"</code>,
            <code>sku = "Standard_B1s"</code>, <code>instances = 2</code> e <code>admin_username = "azureuser"</code>;</li>
          <li>com <code>admin_ssh_key</code>, <code>os_disk</code> e <code>source_image_reference</code> como na VM;</li>
          <li>e <code>network_interface { name = "nic"  primary = true  ip_configuration { name = "interno"  primary = true  subnet_id = azurerm_subnet.app.id } }</code>.</li>
        </ul>`,
      dica: 'O scale set não usa NIC separada: a placa de rede é um bloco dentro dele',
      inicial: comAz(VNET, SUBNET, SSH),
      solucao: comAz(VNET, SUBNET, SSH, tf`
        resource "azurerm_linux_virtual_machine_scale_set" "web" {
          name                = "vmss-web"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          sku                 = "Standard_B1s"
          instances           = 2
          admin_username      = "azureuser"

          admin_ssh_key {
            username   = "azureuser"
            public_key = tls_private_key.ssh.public_key_openssh
          }

          os_disk {
            caching              = "ReadWrite"
            storage_account_type = "Standard_LRS"
          }

          source_image_reference {
            publisher = "Canonical"
            offer     = "ubuntu-24_04-lts"
            sku       = "server"
            version   = "latest"
          }

          network_interface {
            name    = "nic"
            primary = true

            ip_configuration {
              name      = "interno"
              primary   = true
              subnet_id = azurerm_subnet.app.id
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_linux_virtual_machine_scale_set.web', atributo: 'instances', igual: 2 },
            { recurso: 'azurerm_linux_virtual_machine_scale_set.web', atributo: 'network_interface.0.ip_configuration.0.subnet_id', referencia: 'azurerm_subnet.app.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-plano',
      titulo: 'Plano do App Service',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_service_plan "plano"</code> com <code>name = "plan-web"</code>;</li>
          <li>com <code>os_type = "Linux"</code> e <code>sku_name = "B1"</code>.</li>
        </ul>`,
      dica: 'B1 é o tamanho básico, bom para estudo',
      inicial: comAz(),
      solucao: comAz(PLANO),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_service_plan.plano', atributo: 'os_type', igual: 'Linux' }, { recurso: 'azurerm_service_plan.plano', atributo: 'sku_name', igual: 'B1' }] },
      ],
    }),

    problema({
      id: 'az-web-app',
      titulo: 'App web com Node.js',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_linux_web_app "app"</code> com <code>name = "app-loja-sertao"</code>;</li>
          <li><code>service_plan_id = azurerm_service_plan.plano.id</code>;</li>
          <li>e <code>site_config { application_stack { node_version = "20-lts" } }</code>.</li>
        </ul>`,
      dica: 'O nome do app vira o endereço: app-loja-sertao.azurewebsites.net',
      inicial: comAz(PLANO),
      solucao: comAz(PLANO, tf`
        resource "azurerm_linux_web_app" "app" {
          name                = "app-loja-sertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          service_plan_id     = azurerm_service_plan.plano.id

          site_config {
            application_stack {
              node_version = "20-lts"
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'service_plan_id', referencia: 'azurerm_service_plan.plano.id' },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'site_config.0.application_stack.0.node_version', igual: '20-lts' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-app-settings',
      titulo: 'Configurações do app',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>no app, use <code>https_only = true</code>;</li>
          <li><code>app_settings = { AMBIENTE = "producao", WEBSITE_RUN_FROM_PACKAGE = "1" }</code>;</li>
          <li>no <code>site_config</code>, <code>always_on = true</code> e <code>minimum_tls_version = "1.2"</code>.</li>
        </ul>`,
      dica: 'app_settings vira variáveis de ambiente do app',
      inicial: comAz(PLANO, tf`
        resource "azurerm_linux_web_app" "app" {
          name                = "app-loja-sertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          service_plan_id     = azurerm_service_plan.plano.id

          site_config {}
        }
      `),
      solucao: comAz(PLANO, tf`
        resource "azurerm_linux_web_app" "app" {
          name                = "app-loja-sertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          service_plan_id     = azurerm_service_plan.plano.id
          https_only          = true

          app_settings = {
            AMBIENTE                 = "producao"
            WEBSITE_RUN_FROM_PACKAGE = "1"
          }

          site_config {
            always_on           = true
            minimum_tls_version = "1.2"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'https_only', igual: true },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'app_settings.AMBIENTE', igual: 'producao' },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'site_config.0.always_on', igual: true },
          ],
        },
      ],
    }),

    problema({
      id: 'az-function',
      titulo: 'Function App em Python',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie o plano <code>azurerm_service_plan "funcoes"</code> com <code>os_type = "Linux"</code> e <code>sku_name = "Y1"</code> (consumo);</li>
          <li>crie <code>azurerm_linux_function_app "pedidos"</code> com <code>name = "func-pedidos-sertao"</code>;</li>
          <li>ligue à conta <code>st</code>: <code>storage_account_name</code> e <code>storage_account_access_key</code>;</li>
          <li><code>site_config { application_stack { python_version = "3.12" } }</code>.</li>
        </ul>`,
      dica: 'A Function guarda o próprio estado numa conta de armazenamento',
      inicial: comAz(ST),
      solucao: comAz(ST, tf`
        resource "azurerm_service_plan" "funcoes" {
          name                = "plan-funcoes"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          os_type             = "Linux"
          sku_name            = "Y1"
        }

        resource "azurerm_linux_function_app" "pedidos" {
          name                       = "func-pedidos-sertao"
          resource_group_name        = azurerm_resource_group.rg.name
          location                   = azurerm_resource_group.rg.location
          service_plan_id            = azurerm_service_plan.funcoes.id
          storage_account_name       = azurerm_storage_account.st.name
          storage_account_access_key = azurerm_storage_account.st.primary_access_key

          site_config {
            application_stack {
              python_version = "3.12"
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_service_plan.funcoes', atributo: 'sku_name', igual: 'Y1' },
            { recurso: 'azurerm_linux_function_app.pedidos', atributo: 'storage_account_name', igual: 'staulasertao2026' },
            { recurso: 'azurerm_linux_function_app.pedidos', atributo: 'site_config.0.application_stack.0.python_version', igual: '3.12' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-static-web-app',
      titulo: 'Static Web App',
      dificuldade: 'facil',
      enunciado: `
        <p>Para sites estáticos com deploy automático pelo GitHub, o Azure tem o Static Web Apps (o plano Free é grátis).</p>
        <ul>
          <li>crie <code>azurerm_static_web_app "site"</code> com <code>name = "swa-portfolio"</code>;</li>
          <li>com <code>location = "eastus2"</code> (o serviço não existe em todas as regiões) e <code>sku_tier = "Free"</code>.</li>
        </ul>`,
      dica: 'location = "eastus2"',
      inicial: comAz(),
      solucao: comAz(tf`
        resource "azurerm_static_web_app" "site" {
          name                = "swa-portfolio"
          resource_group_name = azurerm_resource_group.rg.name
          location            = "eastus2"
          sku_tier            = "Free"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_static_web_app.site', atributo: 'location', igual: 'eastus2' }, { recurso: 'azurerm_static_web_app.site', atributo: 'sku_tier', igual: 'Free' }] },
      ],
    }),

    licao({
      id: 'licao-azure-dados',
      titulo: 'Bancos de dados no Azure',
      resumo: `
        <ul>
          <li><b>Azure SQL</b>: um <b>servidor</b> lógico (<code>azurerm_mssql_server</code>) e os <b>bancos</b> dentro dele
            (<code>azurerm_mssql_database</code>). O acesso é fechado por padrão: libere com regras de <b>firewall</b>;</li>
          <li><b>PostgreSQL flexível</b>: <code>azurerm_postgresql_flexible_server</code>;</li>
          <li><b>Cosmos DB</b>: banco NoSQL distribuído, com <b>consistência</b> configurável;</li>
          <li><b>Redis</b>: cache em memória, para deixar o app rápido.</li>
        </ul>
        <p>Senhas de banco nunca ficam escritas no código: gere com <code>random_password</code> e guarde no Key Vault.</p>`,
      codigo: comAz(tf`
        resource "random_password" "sql" {
          length = 24
        }

        resource "azurerm_mssql_server" "sql" {
          name                         = "sql-exemplo-sertao"
          resource_group_name          = azurerm_resource_group.rg.name
          location                     = azurerm_resource_group.rg.location
          version                      = "12.0"
          administrator_login          = "sqladmin"
          administrator_login_password = random_password.sql.result
        }

        resource "azurerm_mssql_database" "loja" {
          name      = "db-loja"
          server_id = azurerm_mssql_server.sql.id
          sku_name  = "S0"
        }
      `),
    }),

    problema({
      id: 'az-sql',
      titulo: 'Azure SQL: servidor e banco',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>gere a senha com <code>random_password "sql"</code> (<code>length = 24</code>);</li>
          <li>crie <code>azurerm_mssql_server "sql"</code>: <code>name = "sql-loja-sertao"</code>, <code>version = "12.0"</code>,
            <code>administrator_login = "sqladmin"</code> e a senha gerada;</li>
          <li>crie <code>azurerm_mssql_database "loja"</code> com <code>name = "db-loja"</code>, <code>server_id</code> e <code>sku_name = "S0"</code>.</li>
        </ul>`,
      dica: 'Logins como "admin" ou "sa" são proibidos no Azure SQL',
      inicial: comAz(tf`
        # random_password, azurerm_mssql_server e azurerm_mssql_database
      `),
      solucao: comAz(tf`
        resource "random_password" "sql" {
          length = 24
        }

        resource "azurerm_mssql_server" "sql" {
          name                         = "sql-loja-sertao"
          resource_group_name          = azurerm_resource_group.rg.name
          location                     = azurerm_resource_group.rg.location
          version                      = "12.0"
          administrator_login          = "sqladmin"
          administrator_login_password = random_password.sql.result
          minimum_tls_version          = "1.2"
        }

        resource "azurerm_mssql_database" "loja" {
          name      = "db-loja"
          server_id = azurerm_mssql_server.sql.id
          sku_name  = "S0"
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_mssql_server.sql', atributo: 'administrator_login_password', referencia: 'random_password.sql.result' },
            { recurso: 'azurerm_mssql_database.loja', atributo: 'server_id', referencia: 'azurerm_mssql_server.sql.id' },
            { recurso: 'azurerm_mssql_database.loja', atributo: 'sku_name', igual: 'S0' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_mssql_server.sql', atributo: 'fully_qualified_domain_name', igual: 'sql-loja-sertao.database.windows.net' }] },
      ],
    }),

    problema({
      id: 'az-sql-firewall',
      titulo: 'Liberar os serviços do Azure no SQL',
      dificuldade: 'facil',
      enunciado: `
        <p>A regra com início e fim <code>0.0.0.0</code> é especial: libera o acesso para serviços do próprio Azure (como o App Service).</p>
        <ul>
          <li>crie <code>azurerm_mssql_firewall_rule "azure"</code> com <code>name = "permitir-azure"</code>, o <code>server_id</code>,
            <code>start_ip_address = "0.0.0.0"</code> e <code>end_ip_address = "0.0.0.0"</code>.</li>
        </ul>`,
      dica: 'server_id = azurerm_mssql_server.sql.id',
      inicial: comAz(tf`
        resource "azurerm_mssql_server" "sql" {
          name                         = "sql-loja-sertao"
          resource_group_name          = azurerm_resource_group.rg.name
          location                     = azurerm_resource_group.rg.location
          version                      = "12.0"
          administrator_login          = "sqladmin"
          administrator_login_password = "Troque-esta-senha-123"
        }
      `),
      solucao: comAz(tf`
        resource "azurerm_mssql_server" "sql" {
          name                         = "sql-loja-sertao"
          resource_group_name          = azurerm_resource_group.rg.name
          location                     = azurerm_resource_group.rg.location
          version                      = "12.0"
          administrator_login          = "sqladmin"
          administrator_login_password = "Troque-esta-senha-123"
        }

        resource "azurerm_mssql_firewall_rule" "azure" {
          name             = "permitir-azure"
          server_id        = azurerm_mssql_server.sql.id
          start_ip_address = "0.0.0.0"
          end_ip_address   = "0.0.0.0"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_mssql_firewall_rule.azure', atributo: 'start_ip_address', igual: '0.0.0.0' }, { recurso: 'azurerm_mssql_firewall_rule.azure', atributo: 'server_id', referencia: 'azurerm_mssql_server.sql.id' }] },
      ],
    }),

    problema({
      id: 'az-postgres',
      titulo: 'PostgreSQL flexível',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_postgresql_flexible_server "pg"</code>: <code>name = "psql-loja-sertao"</code>, <code>version = "16"</code>,
            <code>sku_name = "B_Standard_B1ms"</code>, <code>storage_mb = 32768</code>,
            <code>administrator_login = "psqladmin"</code> e <code>administrator_password = random_password.pg.result</code>;</li>
          <li>crie <code>azurerm_postgresql_flexible_server_database "loja"</code> com <code>name = "loja"</code> e o <code>server_id</code>.</li>
        </ul>`,
      dica: 'B_Standard_B1ms é o tamanho mais barato (Burstable)',
      inicial: comAz(tf`
        resource "random_password" "pg" {
          length = 24
        }
      `),
      solucao: comAz(tf`
        resource "random_password" "pg" {
          length = 24
        }

        resource "azurerm_postgresql_flexible_server" "pg" {
          name                   = "psql-loja-sertao"
          resource_group_name    = azurerm_resource_group.rg.name
          location               = azurerm_resource_group.rg.location
          version                = "16"
          sku_name               = "B_Standard_B1ms"
          storage_mb             = 32768
          administrator_login    = "psqladmin"
          administrator_password = random_password.pg.result
        }

        resource "azurerm_postgresql_flexible_server_database" "loja" {
          name      = "loja"
          server_id = azurerm_postgresql_flexible_server.pg.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_postgresql_flexible_server.pg', atributo: 'version', igual: '16' },
            { recurso: 'azurerm_postgresql_flexible_server.pg', atributo: 'sku_name', igual: 'B_Standard_B1ms' },
            { recurso: 'azurerm_postgresql_flexible_server_database.loja', atributo: 'server_id', referencia: 'azurerm_postgresql_flexible_server.pg.id' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_postgresql_flexible_server.pg', atributo: 'fqdn', igual: 'psql-loja-sertao.postgres.database.azure.com' }] },
      ],
    }),

    problema({
      id: 'az-cosmos',
      titulo: 'Cosmos DB: conta, banco e container',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_cosmosdb_account "cosmos"</code>: <code>name = "cosmos-loja-sertao"</code>, <code>offer_type = "Standard"</code>,
            <code>consistency_policy { consistency_level = "Session" }</code> e
            <code>geo_location { location = azurerm_resource_group.rg.location  failover_priority = 0 }</code>;</li>
          <li>crie <code>azurerm_cosmosdb_sql_database "loja"</code> com <code>name = "loja"</code> e <code>account_name</code>;</li>
          <li>crie <code>azurerm_cosmosdb_sql_container "pedidos"</code> com <code>name = "pedidos"</code>, <code>database_name</code>
            e <code>partition_key_paths = ["/clienteId"]</code>.</li>
        </ul>`,
      dica: 'A chave de partição define como os dados se espalham',
      inicial: comAz(),
      solucao: comAz(tf`
        resource "azurerm_cosmosdb_account" "cosmos" {
          name                = "cosmos-loja-sertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          offer_type          = "Standard"

          consistency_policy {
            consistency_level = "Session"
          }

          geo_location {
            location          = azurerm_resource_group.rg.location
            failover_priority = 0
          }
        }

        resource "azurerm_cosmosdb_sql_database" "loja" {
          name                = "loja"
          resource_group_name = azurerm_resource_group.rg.name
          account_name        = azurerm_cosmosdb_account.cosmos.name
        }

        resource "azurerm_cosmosdb_sql_container" "pedidos" {
          name                = "pedidos"
          resource_group_name = azurerm_resource_group.rg.name
          account_name        = azurerm_cosmosdb_account.cosmos.name
          database_name       = azurerm_cosmosdb_sql_database.loja.name
          partition_key_paths = ["/clienteId"]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_cosmosdb_account.cosmos', atributo: 'consistency_policy.0.consistency_level', igual: 'Session' },
            { recurso: 'azurerm_cosmosdb_account.cosmos', atributo: 'geo_location.0.failover_priority', igual: 0 },
            { recurso: 'azurerm_cosmosdb_sql_container.pedidos', atributo: 'partition_key_paths', igual: ['/clienteId'] },
            { recurso: 'azurerm_cosmosdb_sql_container.pedidos', atributo: 'database_name', igual: 'loja' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-redis',
      titulo: 'Cache Redis',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_redis_cache "cache"</code> com <code>name = "redis-loja-sertao"</code>;</li>
          <li>com <code>capacity = 0</code>, <code>family = "C"</code> e <code>sku_name = "Basic"</code> (o menor tamanho).</li>
        </ul>`,
      dica: 'family "C" é a família básica/standard',
      inicial: comAz(),
      solucao: comAz(tf`
        resource "azurerm_redis_cache" "cache" {
          name                = "redis-loja-sertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          capacity            = 0
          family              = "C"
          sku_name            = "Basic"
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_redis_cache.cache', atributo: 'family', igual: 'C' }, { recurso: 'azurerm_redis_cache.cache', atributo: 'sku_name', igual: 'Basic' }] },
      ],
    }),

    licao({
      id: 'licao-azure-seguranca',
      titulo: 'Key Vault, identidades e RBAC',
      resumo: `
        <ul>
          <li>o <b>Key Vault</b> guarda segredos, chaves e certificados. O nome é único no mundo (3 a 24 caracteres);</li>
          <li>uma <b>identidade gerenciada</b> é uma "conta de serviço" sem senha: o recurso prova quem é pelo próprio Azure;</li>
          <li>o <b>RBAC</b> dá papéis a identidades num escopo: <code>azurerm_role_assignment</code> com
            <code>scope</code> (onde), <code>role_definition_name</code> (o papel) e <code>principal_id</code> (quem).</li>
        </ul>
        <p>O data source <code>azurerm_client_config</code> traz o tenant e o object_id de quem está rodando o Terraform.</p>`,
      codigo: comAz(CLIENTE, KV, IDENTIDADE, tf`
        resource "azurerm_role_assignment" "leitura_segredos" {
          scope                = azurerm_key_vault.kv.id
          role_definition_name = "Key Vault Secrets User"
          principal_id         = azurerm_user_assigned_identity.app.principal_id
        }
      `),
    }),

    problema({
      id: 'az-key-vault',
      titulo: 'Um Key Vault',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>data "azurerm_client_config" "atual" {}</code>;</li>
          <li>crie <code>azurerm_key_vault "kv"</code>: <code>name = "kv-loja-sertao"</code>,
            <code>tenant_id = data.azurerm_client_config.atual.tenant_id</code> e <code>sku_name = "standard"</code>;</li>
          <li>com <code>purge_protection_enabled = true</code>, <code>soft_delete_retention_days = 7</code> e
            <code>enable_rbac_authorization = true</code>.</li>
        </ul>`,
      dica: 'tenant_id vem do client_config',
      inicial: comAz(),
      solucao: comAz(CLIENTE, KV),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_key_vault.kv', atributo: 'name', igual: 'kv-loja-sertao' },
            { recurso: 'azurerm_key_vault.kv', atributo: 'purge_protection_enabled', igual: true },
            { recurso: 'azurerm_key_vault.kv', atributo: 'enable_rbac_authorization', igual: true },
            { recurso: 'azurerm_key_vault.kv', atributo: 'tenant_id', regex: '^[0-9a-f-]{36}$' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_key_vault.kv', atributo: 'vault_uri', igual: 'https://kv-loja-sertao.vault.azure.net/' }] },
      ],
    }),

    problema({
      id: 'az-kv-segredo',
      titulo: 'Guardando a senha no Key Vault',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>random_password "banco"</code> com <code>length = 24</code>;</li>
          <li>crie <code>azurerm_key_vault_secret "banco"</code> com <code>name = "senha-banco"</code>,
            <code>value = random_password.banco.result</code> e <code>key_vault_id = azurerm_key_vault.kv.id</code>.</li>
        </ul>`,
      dica: 'Nomes de segredo aceitam só letras, números e hífens',
      inicial: comAz(CLIENTE, KV),
      solucao: comAz(CLIENTE, KV, tf`
        resource "random_password" "banco" {
          length = 24
        }

        resource "azurerm_key_vault_secret" "banco" {
          name         = "senha-banco"
          value        = random_password.banco.result
          key_vault_id = azurerm_key_vault.kv.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_key_vault_secret.banco', atributo: 'name', igual: 'senha-banco' },
            { recurso: 'azurerm_key_vault_secret.banco', atributo: 'value', referencia: 'random_password.banco.result' },
            { recurso: 'azurerm_key_vault_secret.banco', atributo: 'key_vault_id', referencia: 'azurerm_key_vault.kv.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-identidade',
      titulo: 'Identidade gerenciada',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_user_assigned_identity "app"</code> com <code>name = "id-app"</code> no grupo <code>rg</code>;</li>
          <li>crie <code>output "principal_id"</code> com o <code>principal_id</code> dela.</li>
        </ul>`,
      dica: 'resource "azurerm_user_assigned_identity" "app" { ... }',
      inicial: comAz(),
      solucao: comAz(IDENTIDADE, tf`
        output "principal_id" {
          value = azurerm_user_assigned_identity.app.principal_id
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_user_assigned_identity.app', atributo: 'name', igual: 'id-app' }, { saida: 'principal_id', conhecido: false }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ saida: 'principal_id', regex: '^[0-9a-f-]{36}$' }] },
      ],
    }),

    problema({
      id: 'az-rbac',
      titulo: 'Dando permissão com RBAC',
      dificuldade: 'medio',
      enunciado: `
        <p>A identidade do app só precisa <b>ler</b> blobs da conta de armazenamento (menor privilégio).</p>
        <ul>
          <li>crie <code>azurerm_role_assignment "leitura_blobs"</code>;</li>
          <li>com <code>scope = azurerm_storage_account.st.id</code>, <code>role_definition_name = "Storage Blob Data Reader"</code>
            e <code>principal_id = azurerm_user_assigned_identity.app.principal_id</code>.</li>
        </ul>`,
      dica: 'scope = onde, role = o quê, principal = quem',
      inicial: comAz(ST, IDENTIDADE),
      solucao: comAz(ST, IDENTIDADE, tf`
        resource "azurerm_role_assignment" "leitura_blobs" {
          scope                = azurerm_storage_account.st.id
          role_definition_name = "Storage Blob Data Reader"
          principal_id         = azurerm_user_assigned_identity.app.principal_id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_role_assignment.leitura_blobs', atributo: 'role_definition_name', igual: 'Storage Blob Data Reader' },
            { recurso: 'azurerm_role_assignment.leitura_blobs', atributo: 'scope', referencia: 'azurerm_storage_account.st.id' },
            { recurso: 'azurerm_role_assignment.leitura_blobs', atributo: 'principal_id', referencia: 'azurerm_user_assigned_identity.app.principal_id' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-kv-politica',
      titulo: 'Política de acesso do Key Vault',
      dificuldade: 'medio',
      enunciado: `
        <p>Este Key Vault usa <b>políticas de acesso</b> (o modelo antigo, ainda muito comum) em vez de RBAC.</p>
        <ul>
          <li>crie <code>azurerm_key_vault_access_policy "eu"</code> com <code>key_vault_id</code>;</li>
          <li><code>tenant_id</code> e <code>object_id</code> do <code>data.azurerm_client_config.atual</code>;</li>
          <li>e <code>secret_permissions = ["Get", "List", "Set"]</code>.</li>
        </ul>`,
      dica: 'object_id = data.azurerm_client_config.atual.object_id',
      inicial: comAz(CLIENTE, KV.replace('  enable_rbac_authorization  = true\n', '')),
      solucao: comAz(CLIENTE, KV.replace('  enable_rbac_authorization  = true\n', ''), tf`
        resource "azurerm_key_vault_access_policy" "eu" {
          key_vault_id       = azurerm_key_vault.kv.id
          tenant_id          = data.azurerm_client_config.atual.tenant_id
          object_id          = data.azurerm_client_config.atual.object_id
          secret_permissions = ["Get", "List", "Set"]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_key_vault_access_policy.eu', atributo: 'secret_permissions', igual: ['Get', 'List', 'Set'] },
            { recurso: 'azurerm_key_vault_access_policy.eu', atributo: 'key_vault_id', referencia: 'azurerm_key_vault.kv.id' },
          ],
        },
      ],
    }),

    licao({
      id: 'licao-azure-conteineres',
      titulo: 'Contêineres e monitoramento',
      resumo: `
        <ul>
          <li><b>ACR</b> (<code>azurerm_container_registry</code>): depósito privado das suas imagens Docker;</li>
          <li><b>AKS</b> (<code>azurerm_kubernetes_cluster</code>): Kubernetes gerenciado. O <b>node pool</b> são as máquinas
            que rodam os contêineres;</li>
          <li><b>Container Apps</b>: contêineres sem cuidar de Kubernetes;</li>
          <li><b>Log Analytics</b> guarda os logs, <b>Application Insights</b> mede o app e os <b>alertas</b>
            avisam um <b>action group</b> (e-mail, SMS) quando algo passa do limite.</li>
        </ul>`,
      codigo: comAz(tf`
        resource "azurerm_container_registry" "acr" {
          name                = "acrexemplosertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          sku                 = "Basic"
        }

        output "servidor" {
          value = azurerm_container_registry.acr.login_server
        }
      `),
    }),

    problema({
      id: 'az-acr',
      titulo: 'Registro de contêineres (ACR)',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_container_registry "acr"</code> com <code>name = "acrlojasertao"</code> (só letras e números);</li>
          <li>com <code>sku = "Basic"</code> e <code>admin_enabled = false</code> (use identidades em vez de senha).</li>
        </ul>`,
      dica: 'O nome do ACR não aceita hífen',
      inicial: comAz(),
      solucao: comAz(tf`
        resource "azurerm_container_registry" "acr" {
          name                = "acrlojasertao"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          sku                 = "Basic"
          admin_enabled       = false
        }
      `),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_container_registry.acr', atributo: 'sku', igual: 'Basic' }, { recurso: 'azurerm_container_registry.acr', atributo: 'admin_enabled', igual: false }] },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_container_registry.acr', atributo: 'login_server', igual: 'acrlojasertao.azurecr.io' }] },
      ],
    }),

    problema({
      id: 'az-aks',
      titulo: 'Um cluster AKS',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_kubernetes_cluster "aks"</code> com <code>name = "aks-loja"</code> e <code>dns_prefix = "aksloja"</code>;</li>
          <li>com <code>default_node_pool { name = "sistema"  vm_size = "Standard_D2s_v5"  node_count = 2 }</code>;</li>
          <li>e <code>identity { type = "SystemAssigned" }</code>.</li>
        </ul>`,
      dica: 'O nome do node pool: só minúsculas e números, até 12 caracteres',
      inicial: comAz(),
      solucao: comAz(tf`
        resource "azurerm_kubernetes_cluster" "aks" {
          name                = "aks-loja"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          dns_prefix          = "aksloja"

          default_node_pool {
            name       = "sistema"
            vm_size    = "Standard_D2s_v5"
            node_count = 2
          }

          identity {
            type = "SystemAssigned"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'default_node_pool.0.node_count', igual: 2 },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'identity.0.type', igual: 'SystemAssigned' },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'dns_prefix', igual: 'aksloja' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-aks-autoscale',
      titulo: 'AKS com autoscaling',
      dificuldade: 'dificil',
      enunciado: `
        <p>Rode o plan e leia o erro: com autoscaling, o número de nós vira um intervalo.</p>
        <ul>
          <li>no <code>default_node_pool</code>, use <code>auto_scaling_enabled = true</code>, <code>min_count = 1</code> e <code>max_count = 3</code>
            (e tire o <code>node_count</code>);</li>
          <li>acrescente <code>network_profile { network_plugin = "azure" }</code>;</li>
          <li>e <code>oidc_issuer_enabled = true</code> com <code>workload_identity_enabled = true</code>.</li>
        </ul>`,
      dica: 'min_count e max_count só valem com auto_scaling_enabled = true',
      inicial: comAz(tf`
        resource "azurerm_kubernetes_cluster" "aks" {
          name                = "aks-loja"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          dns_prefix          = "aksloja"

          default_node_pool {
            name      = "sistema"
            vm_size   = "Standard_D2s_v5"
            min_count = 1
            max_count = 3
          }

          identity {
            type = "SystemAssigned"
          }
        }
      `),
      solucao: comAz(tf`
        resource "azurerm_kubernetes_cluster" "aks" {
          name                      = "aks-loja"
          resource_group_name       = azurerm_resource_group.rg.name
          location                  = azurerm_resource_group.rg.location
          dns_prefix                = "aksloja"
          oidc_issuer_enabled       = true
          workload_identity_enabled = true

          default_node_pool {
            name                 = "sistema"
            vm_size              = "Standard_D2s_v5"
            auto_scaling_enabled = true
            min_count            = 1
            max_count            = 3
          }

          identity {
            type = "SystemAssigned"
          }

          network_profile {
            network_plugin = "azure"
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'default_node_pool.0.auto_scaling_enabled', igual: true },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'default_node_pool.0.max_count', igual: 3 },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'network_profile.0.network_plugin', igual: 'azure' },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'workload_identity_enabled', igual: true },
          ],
        },
      ],
    }),

    problema({
      id: 'az-container-app',
      titulo: 'Container App com ingresso público',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_container_app_environment "ambiente"</code> com <code>name = "cae-aula"</code> e
            <code>log_analytics_workspace_id = azurerm_log_analytics_workspace.log.id</code>;</li>
          <li>crie <code>azurerm_container_app "api"</code> com <code>name = "app-api"</code>, o
            <code>container_app_environment_id</code> e <code>revision_mode = "Single"</code>;</li>
          <li><code>template { container { name = "api"  image = "mcr.microsoft.com/k8se/quickstart:latest"  cpu = 0.25  memory = "0.5Gi" } }</code>;</li>
          <li><code>ingress { external_enabled = true  target_port = 80  traffic_weight { percentage = 100  latest_revision = true } }</code>.</li>
        </ul>`,
      dica: 'cpu e memory andam juntos: 0.25 com 0.5Gi',
      inicial: comAz(LOG),
      solucao: comAz(LOG, tf`
        resource "azurerm_container_app_environment" "ambiente" {
          name                       = "cae-aula"
          resource_group_name        = azurerm_resource_group.rg.name
          location                   = azurerm_resource_group.rg.location
          log_analytics_workspace_id = azurerm_log_analytics_workspace.log.id
        }

        resource "azurerm_container_app" "api" {
          name                         = "app-api"
          resource_group_name          = azurerm_resource_group.rg.name
          container_app_environment_id = azurerm_container_app_environment.ambiente.id
          revision_mode                = "Single"

          template {
            container {
              name   = "api"
              image  = "mcr.microsoft.com/k8se/quickstart:latest"
              cpu    = 0.25
              memory = "0.5Gi"
            }
          }

          ingress {
            external_enabled = true
            target_port      = 80

            traffic_weight {
              percentage      = 100
              latest_revision = true
            }
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_container_app.api', atributo: 'revision_mode', igual: 'Single' },
            { recurso: 'azurerm_container_app.api', atributo: 'template.0.container.0.image', igual: 'mcr.microsoft.com/k8se/quickstart:latest' },
            { recurso: 'azurerm_container_app.api', atributo: 'ingress.0.external_enabled', igual: true },
            { recurso: 'azurerm_container_app_environment.ambiente', atributo: 'log_analytics_workspace_id', referencia: 'azurerm_log_analytics_workspace.log.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-log-analytics',
      titulo: 'Workspace do Log Analytics',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_log_analytics_workspace "log"</code> com <code>name = "log-aula"</code>;</li>
          <li><code>sku = "PerGB2018"</code> (paga por GB) e <code>retention_in_days = 30</code>.</li>
        </ul>`,
      dica: 'resource "azurerm_log_analytics_workspace" "log" { ... }',
      inicial: comAz(),
      solucao: comAz(LOG),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_log_analytics_workspace.log', atributo: 'sku', igual: 'PerGB2018' }, { recurso: 'azurerm_log_analytics_workspace.log', atributo: 'retention_in_days', igual: 30 }] },
      ],
    }),

    problema({
      id: 'az-app-insights',
      titulo: 'Application Insights',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_application_insights "appi"</code> com <code>name = "appi-loja"</code> e <code>application_type = "web"</code>;</li>
          <li>ligue ao workspace: <code>workspace_id = azurerm_log_analytics_workspace.log.id</code>;</li>
          <li>crie <code>output "conexao"</code> com o <code>connection_string</code> (é sensível).</li>
        </ul>`,
      dica: 'connection_string é sensível: output com sensitive = true',
      inicial: comAz(LOG),
      solucao: comAz(LOG, tf`
        resource "azurerm_application_insights" "appi" {
          name                = "appi-loja"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          application_type    = "web"
          workspace_id        = azurerm_log_analytics_workspace.log.id
        }

        output "conexao" {
          value     = azurerm_application_insights.appi.connection_string
          sensitive = true
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_application_insights.appi', atributo: 'application_type', igual: 'web' },
            { recurso: 'azurerm_application_insights.appi', atributo: 'workspace_id', referencia: 'azurerm_log_analytics_workspace.log.id' },
            { saida: 'conexao', sensivel: true },
          ],
        },
      ],
    }),

    problema({
      id: 'az-action-group',
      titulo: 'Grupo de ações (quem avisar)',
      dificuldade: 'facil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_monitor_action_group "ops"</code> com <code>name = "ag-ops"</code> e <code>short_name = "ops"</code>;</li>
          <li>com <code>email_receiver { name = "time"  email_address = "ops@exemplo.com.br" }</code>.</li>
        </ul>`,
      dica: 'short_name tem no máximo 12 caracteres',
      inicial: comAz(),
      solucao: comAz(ACAO),
      testes: [
        { descricao: 'terraform plan', regras: [{ semErros: true }, { recurso: 'azurerm_monitor_action_group.ops', atributo: 'short_name', igual: 'ops' }, { recurso: 'azurerm_monitor_action_group.ops', atributo: 'email_receiver.0.email_address', igual: 'ops@exemplo.com.br' }] },
      ],
    }),

    problema({
      id: 'az-alerta',
      titulo: 'Alerta de CPU alta',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_monitor_metric_alert "cpu"</code> com <code>name = "alerta-cpu"</code> e
            <code>scopes = [azurerm_service_plan.plano.id]</code>;</li>
          <li>um bloco <code>criteria</code>: <code>metric_namespace = "Microsoft.Web/serverfarms"</code>,
            <code>metric_name = "CpuPercentage"</code>, <code>aggregation = "Average"</code>, <code>operator = "GreaterThan"</code>
            e <code>threshold = 80</code>;</li>
          <li>e <code>action { action_group_id = azurerm_monitor_action_group.ops.id }</code>.</li>
        </ul>`,
      dica: 'scopes é uma lista de ids',
      inicial: comAz(PLANO, ACAO),
      solucao: comAz(PLANO, ACAO, tf`
        resource "azurerm_monitor_metric_alert" "cpu" {
          name                = "alerta-cpu"
          resource_group_name = azurerm_resource_group.rg.name
          scopes              = [azurerm_service_plan.plano.id]
          description         = "CPU do plano acima de 80%"

          criteria {
            metric_namespace = "Microsoft.Web/serverfarms"
            metric_name      = "CpuPercentage"
            aggregation      = "Average"
            operator         = "GreaterThan"
            threshold        = 80
          }

          action {
            action_group_id = azurerm_monitor_action_group.ops.id
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_monitor_metric_alert.cpu', atributo: 'criteria.0.threshold', igual: 80 },
            { recurso: 'azurerm_monitor_metric_alert.cpu', atributo: 'criteria.0.operator', igual: 'GreaterThan' },
            { recurso: 'azurerm_monitor_metric_alert.cpu', atributo: 'action.0.action_group_id', referencia: 'azurerm_monitor_action_group.ops.id' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-dns',
      titulo: 'Zona DNS e registro A',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_dns_zone "zona"</code> com <code>name = "lojadosertao.com.br"</code>;</li>
          <li>crie <code>azurerm_dns_a_record "www"</code> com <code>name = "www"</code>, <code>zone_name</code>, <code>ttl = 300</code>
            e <code>records = [azurerm_public_ip.web.ip_address]</code>.</li>
        </ul>`,
      dica: 'zone_name = azurerm_dns_zone.zona.name',
      inicial: comAz(PIP),
      solucao: comAz(PIP, tf`
        resource "azurerm_dns_zone" "zona" {
          name                = "lojadosertao.com.br"
          resource_group_name = azurerm_resource_group.rg.name
        }

        resource "azurerm_dns_a_record" "www" {
          name                = "www"
          zone_name           = azurerm_dns_zone.zona.name
          resource_group_name = azurerm_resource_group.rg.name
          ttl                 = 300
          records             = [azurerm_public_ip.web.ip_address]
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_dns_a_record.www', atributo: 'zone_name', igual: 'lojadosertao.com.br' },
            { recurso: 'azurerm_dns_a_record.www', atributo: 'ttl', igual: 300 },
            { recurso: 'azurerm_dns_a_record.www', atributo: 'records.0', referencia: 'azurerm_public_ip.web.ip_address' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-load-balancer',
      titulo: 'Load balancer',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>crie <code>azurerm_lb "web"</code> com <code>name = "lb-web"</code>, <code>sku = "Standard"</code> e
            <code>frontend_ip_configuration { name = "publico"  public_ip_address_id = azurerm_public_ip.web.id }</code>;</li>
          <li>crie <code>azurerm_lb_backend_address_pool "web"</code> com <code>name = "web"</code> e o <code>loadbalancer_id</code>;</li>
          <li>crie <code>azurerm_lb_probe "http"</code> na porta <code>80</code> com <code>protocol = "Http"</code> e <code>request_path = "/"</code>;</li>
          <li>crie <code>azurerm_lb_rule "http"</code>: <code>protocol = "Tcp"</code>, portas <code>80</code>,
            <code>frontend_ip_configuration_name = "publico"</code>, o pool e a sonda.</li>
        </ul>`,
      dica: 'backend_address_pool_ids = [azurerm_lb_backend_address_pool.web.id]',
      inicial: comAz(PIP),
      solucao: comAz(PIP, tf`
        resource "azurerm_lb" "web" {
          name                = "lb-web"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          sku                 = "Standard"

          frontend_ip_configuration {
            name                 = "publico"
            public_ip_address_id = azurerm_public_ip.web.id
          }
        }

        resource "azurerm_lb_backend_address_pool" "web" {
          name            = "web"
          loadbalancer_id = azurerm_lb.web.id
        }

        resource "azurerm_lb_probe" "http" {
          name            = "http"
          loadbalancer_id = azurerm_lb.web.id
          port            = 80
          protocol        = "Http"
          request_path    = "/"
        }

        resource "azurerm_lb_rule" "http" {
          name                           = "http"
          loadbalancer_id                = azurerm_lb.web.id
          protocol                       = "Tcp"
          frontend_port                  = 80
          backend_port                   = 80
          frontend_ip_configuration_name = "publico"
          backend_address_pool_ids       = [azurerm_lb_backend_address_pool.web.id]
          probe_id                       = azurerm_lb_probe.http.id
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_lb.web', atributo: 'frontend_ip_configuration.0.public_ip_address_id', referencia: 'azurerm_public_ip.web.id' },
            { recurso: 'azurerm_lb_probe.http', atributo: 'request_path', igual: '/' },
            { recurso: 'azurerm_lb_rule.http', atributo: 'probe_id', referencia: 'azurerm_lb_probe.http.id' },
            { recurso: 'azurerm_lb_rule.http', atributo: 'frontend_ip_configuration_name', igual: 'publico' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-backend',
      titulo: 'Estado remoto no Azure Storage',
      dificuldade: 'medio',
      enunciado: `
        <ul>
          <li>no bloco <code>terraform</code>, crie <code>backend "azurerm"</code>;</li>
          <li>com <code>resource_group_name = "rg-terraform-estado"</code>, <code>storage_account_name = "stestadoterraform"</code>,
            <code>container_name = "tfstate"</code> e <code>key = "aula.terraform.tfstate"</code>.</li>
        </ul>
        <p>O backend do Azure trava o estado sozinho (usando um "lease" no blob).</p>`,
      dica: 'terraform { backend "azurerm" { ... } }',
      inicial: comAz(),
      solucao: juntar(tf`
        terraform {
          backend "azurerm" {
            resource_group_name  = "rg-terraform-estado"
            storage_account_name = "stestadoterraform"
            container_name       = "tfstate"
            key                  = "aula.terraform.tfstate"
          }
        }
      `, AZURE, RG),
      testes: [
        {
          descricao: 'terraform init',
          regras: [
            { semErros: true },
            { backend: 'azurerm', atributo: 'container_name', igual: 'tfstate' },
            { backend: 'azurerm', atributo: 'key', igual: 'aula.terraform.tfstate' },
          ],
        },
      ],
    }),

    problema({
      id: 'az-private-endpoint',
      titulo: 'Acesso privado ao Storage (private endpoint)',
      dificuldade: 'dificil',
      enunciado: `
        <p>A conta de armazenamento deve ser acessada só pela rede interna, sem passar pela internet.</p>
        <ul>
          <li>crie <code>azurerm_private_dns_zone "blob"</code> com <code>name = "privatelink.blob.core.windows.net"</code>;</li>
          <li>ligue a zona à VNet: <code>azurerm_private_dns_zone_virtual_network_link "blob"</code>;</li>
          <li>crie <code>azurerm_private_endpoint "blob"</code> na sub-rede <code>app</code>, com
            <code>private_service_connection { name = "blob"  is_manual_connection = false  private_connection_resource_id = azurerm_storage_account.st.id  subresource_names = ["blob"] }</code>;</li>
          <li>e <code>private_dns_zone_group { name = "padrao"  private_dns_zone_ids = [azurerm_private_dns_zone.blob.id] }</code>.</li>
        </ul>`,
      dica: 'subresource_names = ["blob"] escolhe o serviço de blobs',
      inicial: comAz(ST, VNET, SUBNET),
      solucao: comAz(ST, VNET, SUBNET, tf`
        resource "azurerm_private_dns_zone" "blob" {
          name                = "privatelink.blob.core.windows.net"
          resource_group_name = azurerm_resource_group.rg.name
        }

        resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
          name                  = "link-blob"
          resource_group_name   = azurerm_resource_group.rg.name
          private_dns_zone_name = azurerm_private_dns_zone.blob.name
          virtual_network_id    = azurerm_virtual_network.vnet.id
        }

        resource "azurerm_private_endpoint" "blob" {
          name                = "pe-blob"
          resource_group_name = azurerm_resource_group.rg.name
          location            = azurerm_resource_group.rg.location
          subnet_id           = azurerm_subnet.app.id

          private_service_connection {
            name                           = "blob"
            is_manual_connection           = false
            private_connection_resource_id = azurerm_storage_account.st.id
            subresource_names              = ["blob"]
          }

          private_dns_zone_group {
            name                 = "padrao"
            private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
          }
        }
      `),
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_private_endpoint.blob', atributo: 'private_service_connection.0.private_connection_resource_id', referencia: 'azurerm_storage_account.st.id' },
            { recurso: 'azurerm_private_endpoint.blob', atributo: 'private_service_connection.0.subresource_names', igual: ['blob'] },
            { recurso: 'azurerm_private_dns_zone_virtual_network_link.blob', atributo: 'virtual_network_id', referencia: 'azurerm_virtual_network.vnet.id' },
          ],
        },
      ],
    }),
  ],
};
