// Projetos no Azure: app web completo e Kubernetes com registro de imagens.
import { tf } from '../util.js';
import { criarProjeto } from './base.js';

const PROVEDORES_AZURE = tf`
  terraform {
    required_providers {
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

  provider "azurerm" {
    features {}
  }
`;

const variaveis = (prefixo) => tf`
  variable "prefixo" {
    type        = string
    description = "Prefixo dos nomes dos recursos"
    default     = "${prefixo}"
  }

  variable "local" {
    type    = string
    default = "brazilsouth"
  }
`;

const grupo = (sufixo) => tf`
  resource "azurerm_resource_group" "rg" {
    name     = "rg-\${var.prefixo}-${sufixo}"
    location = var.local
  }
`;

// ---------- 4. App web no Azure ----------

const APP = tf`
  resource "azurerm_service_plan" "plano" {
    name                = "plan-\${var.prefixo}"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    os_type             = "Linux"
    sku_name            = "B1"
  }

  resource "azurerm_linux_web_app" "app" {
    name                = "app-\${var.prefixo}-sertao"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    service_plan_id     = azurerm_service_plan.plano.id
    https_only          = true

    site_config {
      minimum_tls_version = "1.2"

      application_stack {
        node_version = "20-lts"
      }
    }
  }
`;

const APP_COM_IDENTIDADE = tf`
  resource "azurerm_service_plan" "plano" {
    name                = "plan-\${var.prefixo}"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    os_type             = "Linux"
    sku_name            = "B1"
  }

  resource "azurerm_linux_web_app" "app" {
    name                = "app-\${var.prefixo}-sertao"
    resource_group_name = azurerm_resource_group.rg.name
    location            = azurerm_resource_group.rg.location
    service_plan_id     = azurerm_service_plan.plano.id
    https_only          = true

    identity {
      type = "SystemAssigned"
    }

    app_settings = {
      DB_SERVIDOR = azurerm_mssql_server.sql.fully_qualified_domain_name
      DB_SENHA    = "@Microsoft.KeyVault(SecretUri=\${azurerm_key_vault_secret.banco.versionless_id})"
    }

    site_config {
      minimum_tls_version = "1.2"

      application_stack {
        node_version = "20-lts"
      }
    }
  }
`;

export const projetoWebApp = criarProjeto({
  id: 'proj-webapp',
  titulo: 'App web no Azure',
  icone: '🛒',
  descricao: 'App Service com Node.js, Azure SQL, senha no Key Vault lida por identidade gerenciada e monitoramento.',
  resumo: `
    <p>A loja virtual do sertão vai para o Azure. O caminho completo de um app de verdade:</p>
    <ul>
      <li><b>App Service</b>: o plano (a máquina) e o app Node.js;</li>
      <li><b>Azure SQL</b>: o banco, com senha gerada pelo Terraform;</li>
      <li><b>Key Vault</b>: o cofre onde a senha fica guardada;</li>
      <li><b>identidade gerenciada</b>: o app prova quem é e lê a senha do cofre, sem nenhuma senha no código;</li>
      <li><b>Application Insights</b> e alertas: para saber quando algo dá errado.</li>
    </ul>
    <p>Analogia: o app é um funcionário com crachá (identidade). O crachá abre o cofre, e ninguém precisa anotar a senha num papel.</p>`,
  inicial: {
    'providers.tf': PROVEDORES_AZURE,
    'variables.tf': variaveis('loja'),
    'main.tf': grupo('web'),
  },
  etapas: [
    {
      titulo: 'Plano e app web',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>app.tf</code>:</p>
        <ul>
          <li><code>azurerm_service_plan "plano"</code> com <code>name = "plan-\${var.prefixo}"</code>, <code>os_type = "Linux"</code> e <code>sku_name = "B1"</code>;</li>
          <li><code>azurerm_linux_web_app "app"</code> com <code>name = "app-\${var.prefixo}-sertao"</code>, o <code>service_plan_id</code> e <code>https_only = true</code>;</li>
          <li><code>site_config</code> com <code>minimum_tls_version = "1.2"</code> e <code>application_stack { node_version = "20-lts" }</code>.</li>
        </ul>`,
      dica: 'Use azurerm_resource_group.rg.name e .location nos dois recursos',
      alteracoes: { 'app.tf': APP },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_service_plan.plano', atributo: 'name', igual: 'plan-loja' },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'name', igual: 'app-loja-sertao' },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'https_only', igual: true },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'site_config.0.application_stack.0.node_version', igual: '20-lts' },
          ],
        },
        { oculto: true, descricao: 'prefixo = "vitrine"', variaveis: { prefixo: 'vitrine' }, regras: [{ recurso: 'azurerm_linux_web_app.app', atributo: 'name', igual: 'app-vitrine-sertao' }] },
      ],
    },
    {
      titulo: 'O banco Azure SQL',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>banco.tf</code>:</p>
        <ul>
          <li><code>random_password "sql"</code> com <code>length = 24</code>;</li>
          <li><code>azurerm_mssql_server "sql"</code>: <code>name = "sql-\${var.prefixo}-sertao"</code>, <code>version = "12.0"</code>,
            <code>administrator_login = "sqladmin"</code>, a senha gerada e <code>minimum_tls_version = "1.2"</code>;</li>
          <li><code>azurerm_mssql_database "loja"</code> com <code>name = "db-\${var.prefixo}"</code> e <code>sku_name = "S0"</code>;</li>
          <li><code>azurerm_mssql_firewall_rule "azure"</code> liberando os serviços do Azure (<code>0.0.0.0</code> a <code>0.0.0.0</code>).</li>
        </ul>`,
      dica: 'administrator_login_password = random_password.sql.result',
      alteracoes: {
        'banco.tf': tf`
          resource "random_password" "sql" {
            length = 24
          }

          resource "azurerm_mssql_server" "sql" {
            name                         = "sql-\${var.prefixo}-sertao"
            resource_group_name          = azurerm_resource_group.rg.name
            location                     = azurerm_resource_group.rg.location
            version                      = "12.0"
            administrator_login          = "sqladmin"
            administrator_login_password = random_password.sql.result
            minimum_tls_version          = "1.2"
          }

          resource "azurerm_mssql_database" "loja" {
            name      = "db-\${var.prefixo}"
            server_id = azurerm_mssql_server.sql.id
            sku_name  = "S0"
          }

          resource "azurerm_mssql_firewall_rule" "azure" {
            name             = "permitir-azure"
            server_id        = azurerm_mssql_server.sql.id
            start_ip_address = "0.0.0.0"
            end_ip_address   = "0.0.0.0"
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_mssql_server.sql', atributo: 'administrator_login_password', referencia: 'random_password.sql.result' },
            { recurso: 'azurerm_mssql_database.loja', atributo: 'name', igual: 'db-loja' },
            { recurso: 'azurerm_mssql_firewall_rule.azure', atributo: 'end_ip_address', igual: '0.0.0.0' },
          ],
        },
      ],
    },
    {
      titulo: 'A senha no Key Vault',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>segredos.tf</code>:</p>
        <ul>
          <li><code>data "azurerm_client_config" "atual" {}</code>;</li>
          <li><code>azurerm_key_vault "kv"</code>: <code>name = "kv-\${var.prefixo}-sertao"</code>, o <code>tenant_id</code>, <code>sku_name = "standard"</code>,
            <code>purge_protection_enabled = true</code> e <code>enable_rbac_authorization = true</code>;</li>
          <li><code>azurerm_role_assignment "eu"</code>: papel <code>"Key Vault Secrets Officer"</code> no cofre para
            <code>data.azurerm_client_config.atual.object_id</code> (você, que roda o Terraform);</li>
          <li><code>azurerm_key_vault_secret "banco"</code> com <code>name = "senha-banco"</code>, <code>value = random_password.sql.result</code>
            e <code>depends_on = [azurerm_role_assignment.eu]</code>.</li>
        </ul>`,
      dica: 'O depends_on garante que a permissão existe antes de gravar o segredo',
      alteracoes: {
        'segredos.tf': tf`
          data "azurerm_client_config" "atual" {}

          resource "azurerm_key_vault" "kv" {
            name                      = "kv-\${var.prefixo}-sertao"
            resource_group_name       = azurerm_resource_group.rg.name
            location                  = azurerm_resource_group.rg.location
            tenant_id                 = data.azurerm_client_config.atual.tenant_id
            sku_name                  = "standard"
            purge_protection_enabled  = true
            enable_rbac_authorization = true
          }

          resource "azurerm_role_assignment" "eu" {
            scope                = azurerm_key_vault.kv.id
            role_definition_name = "Key Vault Secrets Officer"
            principal_id         = data.azurerm_client_config.atual.object_id
          }

          resource "azurerm_key_vault_secret" "banco" {
            name         = "senha-banco"
            value        = random_password.sql.result
            key_vault_id = azurerm_key_vault.kv.id
            depends_on   = [azurerm_role_assignment.eu]
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_key_vault.kv', atributo: 'enable_rbac_authorization', igual: true },
            { recurso: 'azurerm_role_assignment.eu', atributo: 'role_definition_name', igual: 'Key Vault Secrets Officer' },
            { recurso: 'azurerm_key_vault_secret.banco', atributo: 'value', referencia: 'random_password.sql.result' },
            { meta: 'azurerm_key_vault_secret.banco', dependsOn: 'azurerm_role_assignment.eu' },
          ],
        },
      ],
    },
    {
      titulo: 'O app lê a senha com identidade',
      dificuldade: 'dificil',
      enunciado: `
        <ul>
          <li>em <code>app.tf</code>, dê ao app uma identidade: <code>identity { type = "SystemAssigned" }</code>;</li>
          <li>acrescente <code>app_settings</code> com <code>DB_SERVIDOR = azurerm_mssql_server.sql.fully_qualified_domain_name</code> e
            <code>DB_SENHA = "@Microsoft.KeyVault(SecretUri=\${azurerm_key_vault_secret.banco.versionless_id})"</code>
            (uma <b>referência</b> ao cofre, não a senha);</li>
          <li>crie o arquivo <code>acesso.tf</code> com <code>azurerm_role_assignment "app"</code>: papel <code>"Key Vault Secrets User"</code> (só leitura)
            no cofre, para <code>azurerm_linux_web_app.app.identity[0].principal_id</code>.</li>
        </ul>`,
      dica: 'identity[0] porque identity é um bloco (uma lista com um item)',
      alteracoes: {
        'app.tf': APP_COM_IDENTIDADE,
        'acesso.tf': tf`
          resource "azurerm_role_assignment" "app" {
            scope                = azurerm_key_vault.kv.id
            role_definition_name = "Key Vault Secrets User"
            principal_id         = azurerm_linux_web_app.app.identity[0].principal_id
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'identity.0.type', igual: 'SystemAssigned' },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'app_settings.DB_SERVIDOR', referencia: 'azurerm_mssql_server.sql.fully_qualified_domain_name' },
            { recurso: 'azurerm_role_assignment.app', atributo: 'role_definition_name', igual: 'Key Vault Secrets User' },
            { dependencia: ['azurerm_role_assignment.app', 'azurerm_linux_web_app.app'] },
            { codigo: '@Microsoft\\.KeyVault\\(SecretUri=', msg: 'DB_SENHA é uma referência ao Key Vault' },
          ],
        },
        {
          oculto: true,
          descricao: 'terraform apply',
          comando: 'apply',
          regras: [
            { recurso: 'azurerm_linux_web_app.app', atributo: 'app_settings.DB_SERVIDOR', igual: 'sql-loja-sertao.database.windows.net' },
            { recurso: 'azurerm_linux_web_app.app', atributo: 'app_settings.DB_SENHA', regex: '^@Microsoft\\.KeyVault\\(SecretUri=https://.+/secrets/senha-banco\\)$' },
          ],
        },
      ],
    },
    {
      titulo: 'Monitoramento e alerta',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>monitoramento.tf</code>:</p>
        <ul>
          <li><code>azurerm_log_analytics_workspace "log"</code> (<code>sku = "PerGB2018"</code>, <code>retention_in_days = 30</code>);</li>
          <li><code>azurerm_application_insights "appi"</code> com <code>application_type = "web"</code> e o <code>workspace_id</code>;</li>
          <li><code>azurerm_monitor_action_group "ops"</code> com <code>short_name = "ops"</code> e um <code>email_receiver</code>;</li>
          <li><code>azurerm_monitor_metric_alert "cpu"</code> no plano: <code>Microsoft.Web/serverfarms</code>, <code>CpuPercentage</code>,
            <code>Average</code> <code>GreaterThan</code> <code>80</code>, avisando o grupo <code>ops</code>;</li>
          <li><code>output "url"</code> com <code>"https://\${azurerm_linux_web_app.app.default_hostname}"</code>.</li>
        </ul>`,
      dica: 'Reaproveite o que você fez no módulo Azure: é a mesma receita',
      alteracoes: {
        'monitoramento.tf': tf`
          resource "azurerm_log_analytics_workspace" "log" {
            name                = "log-\${var.prefixo}"
            resource_group_name = azurerm_resource_group.rg.name
            location            = azurerm_resource_group.rg.location
            sku                 = "PerGB2018"
            retention_in_days   = 30
          }

          resource "azurerm_application_insights" "appi" {
            name                = "appi-\${var.prefixo}"
            resource_group_name = azurerm_resource_group.rg.name
            location            = azurerm_resource_group.rg.location
            application_type    = "web"
            workspace_id        = azurerm_log_analytics_workspace.log.id
          }

          resource "azurerm_monitor_action_group" "ops" {
            name                = "ag-ops"
            resource_group_name = azurerm_resource_group.rg.name
            short_name          = "ops"

            email_receiver {
              name          = "time"
              email_address = "ops@exemplo.com.br"
            }
          }

          resource "azurerm_monitor_metric_alert" "cpu" {
            name                = "alerta-cpu"
            resource_group_name = azurerm_resource_group.rg.name
            scopes              = [azurerm_service_plan.plano.id]

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

          output "url" {
            value = "https://\${azurerm_linux_web_app.app.default_hostname}"
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_application_insights.appi', atributo: 'workspace_id', referencia: 'azurerm_log_analytics_workspace.log.id' },
            { recurso: 'azurerm_monitor_metric_alert.cpu', atributo: 'criteria.0.metric_name', igual: 'CpuPercentage' },
            { recurso: 'azurerm_monitor_metric_alert.cpu', atributo: 'action.0.action_group_id', referencia: 'azurerm_monitor_action_group.ops.id' },
            { saida: 'url', existe: true },
          ],
        },
      ],
    },
  ],
});

// ---------- 5. AKS com ACR ----------

export const projetoAks = criarProjeto({
  id: 'proj-aks',
  titulo: 'Kubernetes no Azure (AKS + ACR)',
  icone: '☸️',
  descricao: 'Rede, registro de imagens, cluster AKS ligado à VNet, permissão AcrPull e um node pool com autoscaling.',
  resumo: `
    <p>Um ambiente de <b>contêineres</b> pronto para produção:</p>
    <ul>
      <li>uma <b>VNet</b> com a sub-rede dos nós do cluster;</li>
      <li>um <b>ACR</b>: o depósito privado das imagens Docker;</li>
      <li>um <b>AKS</b>: o Kubernetes gerenciado, com os nós dentro da sua rede;</li>
      <li>a permissão <b>AcrPull</b>: os nós podem baixar imagens do ACR, sem senha;</li>
      <li>um segundo <b>node pool</b> que cresce e diminui sozinho.</li>
    </ul>
    <p>Analogia: o ACR é o armazém de marmitas prontas; o AKS é a cozinha industrial que esquenta e serve quantas forem pedidas.</p>`,
  inicial: {
    'providers.tf': PROVEDORES_AZURE,
    'variables.tf': variaveis('vitrine'),
    'main.tf': grupo('aks'),
  },
  etapas: [
    {
      titulo: 'A rede do cluster',
      dificuldade: 'facil',
      enunciado: `
        <p>Crie o arquivo <code>rede.tf</code>:</p>
        <ul>
          <li><code>azurerm_virtual_network "vnet"</code> com <code>name = "vnet-\${var.prefixo}"</code> e <code>address_space = ["10.20.0.0/16"]</code>;</li>
          <li><code>azurerm_subnet "aks"</code> com <code>name = "snet-aks"</code> e <code>address_prefixes = ["10.20.0.0/22"]</code>
            (um /22 tem 1024 IPs: cada pod do AKS com CNI Azure usa um IP da sub-rede).</li>
        </ul>`,
      dica: 'virtual_network_name = azurerm_virtual_network.vnet.name',
      alteracoes: {
        'rede.tf': tf`
          resource "azurerm_virtual_network" "vnet" {
            name                = "vnet-\${var.prefixo}"
            resource_group_name = azurerm_resource_group.rg.name
            location            = azurerm_resource_group.rg.location
            address_space       = ["10.20.0.0/16"]
          }

          resource "azurerm_subnet" "aks" {
            name                 = "snet-aks"
            resource_group_name  = azurerm_resource_group.rg.name
            virtual_network_name = azurerm_virtual_network.vnet.name
            address_prefixes     = ["10.20.0.0/22"]
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_virtual_network.vnet', atributo: 'name', igual: 'vnet-vitrine' },
            { recurso: 'azurerm_subnet.aks', atributo: 'address_prefixes', igual: ['10.20.0.0/22'] },
          ],
        },
      ],
    },
    {
      titulo: 'O registro de imagens',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>acr.tf</code>:</p>
        <ul>
          <li><code>random_string "sufixo"</code> com <code>length = 6</code>, <code>upper = false</code> e <code>special = false</code>;</li>
          <li><code>azurerm_container_registry "acr"</code> com <code>name = "acr\${var.prefixo}\${random_string.sufixo.result}"</code>,
            <code>sku = "Standard"</code> e <code>admin_enabled = false</code>.</li>
        </ul>`,
      dica: 'O nome do ACR é único no mundo e só aceita letras e números',
      alteracoes: {
        'acr.tf': tf`
          resource "random_string" "sufixo" {
            length  = 6
            upper   = false
            special = false
          }

          resource "azurerm_container_registry" "acr" {
            name                = "acr\${var.prefixo}\${random_string.sufixo.result}"
            resource_group_name = azurerm_resource_group.rg.name
            location            = azurerm_resource_group.rg.location
            sku                 = "Standard"
            admin_enabled       = false
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_container_registry.acr', atributo: 'sku', igual: 'Standard' },
            { recurso: 'azurerm_container_registry.acr', atributo: 'admin_enabled', igual: false },
            { recurso: 'azurerm_container_registry.acr', atributo: 'name', referencia: 'random_string.sufixo.result' },
          ],
        },
        { oculto: true, descricao: 'terraform apply', comando: 'apply', regras: [{ recurso: 'azurerm_container_registry.acr', atributo: 'login_server', regex: '^acrvitrine[a-z0-9]{6}\\.azurecr\\.io$' }] },
      ],
    },
    {
      titulo: 'O cluster AKS na sua rede',
      dificuldade: 'dificil',
      enunciado: `
        <p>Crie o arquivo <code>aks.tf</code> com <code>azurerm_kubernetes_cluster "aks"</code>:</p>
        <ul>
          <li><code>name = "aks-\${var.prefixo}"</code> e <code>dns_prefix = var.prefixo</code>;</li>
          <li><code>default_node_pool</code>: <code>name = "sistema"</code>, <code>vm_size = "Standard_D2s_v5"</code>, <code>node_count = 2</code>
            e <code>vnet_subnet_id = azurerm_subnet.aks.id</code>;</li>
          <li><code>identity { type = "SystemAssigned" }</code>;</li>
          <li><code>network_profile</code> com <code>network_plugin = "azure"</code>, <code>service_cidr = "10.30.0.0/16"</code>
            e <code>dns_service_ip = "10.30.0.10"</code> (uma faixa que <b>não</b> se sobrepõe à VNet).</li>
        </ul>`,
      dica: 'O service_cidr é a rede "virtual" dos serviços do Kubernetes; não pode colidir com a VNet',
      alteracoes: {
        'aks.tf': tf`
          resource "azurerm_kubernetes_cluster" "aks" {
            name                = "aks-\${var.prefixo}"
            resource_group_name = azurerm_resource_group.rg.name
            location            = azurerm_resource_group.rg.location
            dns_prefix          = var.prefixo

            default_node_pool {
              name           = "sistema"
              vm_size        = "Standard_D2s_v5"
              node_count     = 2
              vnet_subnet_id = azurerm_subnet.aks.id
            }

            identity {
              type = "SystemAssigned"
            }

            network_profile {
              network_plugin = "azure"
              service_cidr   = "10.30.0.0/16"
              dns_service_ip = "10.30.0.10"
            }
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'default_node_pool.0.vnet_subnet_id', referencia: 'azurerm_subnet.aks.id' },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'network_profile.0.service_cidr', igual: '10.30.0.0/16' },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'network_profile.0.dns_service_ip', igual: '10.30.0.10' },
            { recurso: 'azurerm_kubernetes_cluster.aks', atributo: 'dns_prefix', igual: 'vitrine' },
          ],
        },
      ],
    },
    {
      titulo: 'Os nós podem baixar imagens',
      dificuldade: 'dificil',
      enunciado: `
        <p>Quem baixa as imagens não é o cluster, e sim o <b>kubelet</b> (o agente de cada nó), que tem a sua própria identidade.</p>
        <ul>
          <li>crie o arquivo <code>permissoes.tf</code> com <code>azurerm_role_assignment "acr_pull"</code>;</li>
          <li><code>scope = azurerm_container_registry.acr.id</code> e <code>role_definition_name = "AcrPull"</code>;</li>
          <li><code>principal_id = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id</code>.</li>
        </ul>`,
      dica: 'kubelet_identity[0].object_id, e não identity[0].principal_id',
      alteracoes: {
        'permissoes.tf': tf`
          resource "azurerm_role_assignment" "acr_pull" {
            scope                = azurerm_container_registry.acr.id
            role_definition_name = "AcrPull"
            principal_id         = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_role_assignment.acr_pull', atributo: 'role_definition_name', igual: 'AcrPull' },
            { recurso: 'azurerm_role_assignment.acr_pull', atributo: 'scope', referencia: 'azurerm_container_registry.acr.id' },
            { codigo: 'kubelet_identity\\[0\\]\\.object_id', msg: 'A permissão vai para a identidade do kubelet' },
          ],
        },
      ],
    },
    {
      titulo: 'Node pool com autoscaling',
      dificuldade: 'medio',
      enunciado: `
        <p>Crie o arquivo <code>pool.tf</code>:</p>
        <ul>
          <li><code>azurerm_kubernetes_cluster_node_pool "apps"</code> com <code>name = "apps"</code>, o <code>kubernetes_cluster_id</code>
            e <code>vm_size = "Standard_D4s_v5"</code>;</li>
          <li><code>auto_scaling_enabled = true</code>, <code>min_count = 1</code> e <code>max_count = 5</code>;</li>
          <li><code>vnet_subnet_id = azurerm_subnet.aks.id</code> e <code>node_labels = { carga = "apps" }</code>;</li>
          <li><code>output "kube_config"</code> com <code>azurerm_kubernetes_cluster.aks.kube_config_raw</code> e <code>sensitive = true</code>.</li>
        </ul>`,
      dica: 'O pool do sistema roda o Kubernetes; o pool "apps" roda os seus contêineres',
      alteracoes: {
        'pool.tf': tf`
          resource "azurerm_kubernetes_cluster_node_pool" "apps" {
            name                  = "apps"
            kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id
            vm_size               = "Standard_D4s_v5"
            auto_scaling_enabled  = true
            min_count             = 1
            max_count             = 5
            vnet_subnet_id        = azurerm_subnet.aks.id

            node_labels = {
              carga = "apps"
            }
          }

          output "kube_config" {
            value     = azurerm_kubernetes_cluster.aks.kube_config_raw
            sensitive = true
          }
        `,
      },
      testes: [
        {
          descricao: 'terraform plan',
          regras: [
            { semErros: true },
            { recurso: 'azurerm_kubernetes_cluster_node_pool.apps', atributo: 'max_count', igual: 5 },
            { recurso: 'azurerm_kubernetes_cluster_node_pool.apps', atributo: 'node_labels.carga', igual: 'apps' },
            { recurso: 'azurerm_kubernetes_cluster_node_pool.apps', atributo: 'kubernetes_cluster_id', referencia: 'azurerm_kubernetes_cluster.aks.id' },
            { saida: 'kube_config', sensivel: true },
          ],
        },
      ],
    },
  ],
});
