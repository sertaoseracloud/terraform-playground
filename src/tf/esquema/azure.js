// Provedor Azure (hashicorp/azurerm, versão 4) no simulador.
// O simulador finge que a assinatura já está configurada no ambiente
// (ARM_SUBSCRIPTION_ID), como numa conta de laboratório: por isso
// subscription_id é opcional no bloco provider. Na vida real, a partir da
// versão 4 ele é obrigatório (no provider ou na variável de ambiente).
import { tipo, umDosValores, entre, padrao, cidrValido, listaDe } from './dsl.js';

export const LOCAIS_AZURE = [
  'brazilsouth', 'brazilsoutheast', 'eastus', 'eastus2', 'westus', 'westus2', 'westus3', 'centralus', 'northcentralus',
  'southcentralus', 'canadacentral', 'northeurope', 'westeurope', 'uksouth', 'francecentral', 'germanywestcentral',
  'swedencentral', 'switzerlandnorth', 'japaneast', 'koreacentral', 'southeastasia', 'eastasia', 'australiaeast',
  'centralindia', 'southafricanorth', 'uaenorth',
];

/** "Brazil South" → "brazilsouth", como o provedor guarda no estado. */
export const normalizarLocal = (v) => (typeof v === 'string' ? v.replace(/\s+/g, '').toLowerCase() : v);

const nomeStorage = padrao(/^[a-z0-9]{3,24}$/,
  'name ("{valor}") can only consist of lowercase letters and numbers, and must be between 3 and 24 characters long');
const nomeGrupo = padrao(/^[-\w._()]{1,89}[-\w_()]$/u,
  'name ("{valor}") may only contain alphanumeric characters, dash, underscores, parentheses and periods, and must not end in a period');
const nomeKeyVault = padrao(/^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$/,
  'name ("{valor}") may only contain alphanumeric characters and dashes, must start with a letter, end with a letter or digit, and be 3 - 24 characters long');
const nomeAcr = padrao(/^[a-zA-Z0-9]{5,50}$/, 'alpha numeric characters only are allowed in "name": "{valor}" (5 - 50 caracteres)');
const nomeWebApp = padrao(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/, 'name ("{valor}") must be 2 - 60 characters long, contain only letters, numbers and hyphens, and not start or end with a hyphen');

const idGrupo = (u, rg) => `/subscriptions/${u.assinatura}/resourceGroups/${rg}`;
const idPrestador = (u, v, caminho) => `${idGrupo(u, v.resource_group_name)}/providers/${caminho}/${v.name}`;
const local = (v) => v.location;

// Nomes globais que "já estão em uso" no Azure: o apply falha (o nome precisa ser único no mundo).
const NOMES_OCUPADOS = new Set(['storage', 'teste', 'test', 'meustorage', 'contoso', 'webapp', 'meuapp', 'site', 'keyvault', 'cofre']);
const nomeLivre = (servico) => (v) => (NOMES_OCUPADOS.has(v.name)
  ? `creating ${servico} (Name "${v.name}"): StorageAccountAlreadyTaken/NameNotAvailable: o nome "${v.name}" já está em uso por outra pessoa no Azure. Ele precisa ser único no mundo: acrescente um sufixo (ex.: random_string).`
  : null);
const localValido = (v) => (v.location && !LOCAIS_AZURE.includes(normalizarLocal(v.location))
  ? `LocationNotAvailableForResourceGroup: The provided location '${v.location}' is not available. Confira o nome da região (ex.: brazilsouth, eastus).`
  : null);

export const PROVEDOR_AZURE = {
  nome: 'azurerm',
  fonte: 'hashicorp/azurerm',
  versoes: ['3.117.1', '4.47.0'],
  configuracao: tipo('provider azurerm', {
    args: 'subscription_id? tenant_id? client_id? client_secret?$ use_cli?:bool use_oidc?:bool resource_provider_registrations? storage_use_azuread?:bool environment?',
    blocos: { features: { min: 1, max: 1, livre: true } },
  }),
  recursos: {
    azurerm_resource_group: tipo('azurerm_resource_group', {
      args: 'name!^ location!^ managed_by?^ tags?:map',
      calc: 'id',
      validar: { name: nomeGrupo },
      validarApi: localValido,
      gerar: { id: (v, u) => idGrupo(u, v.name) },
      descricao: 'Grupo de recursos: a "pasta" que guarda os recursos de um projeto no Azure.',
    }),

    // ---------- armazenamento ----------
    azurerm_storage_account: tipo('azurerm_storage_account', {
      args: 'name!^ resource_group_name!^ location!^ account_tier!^ account_replication_type! account_kind?=StorageV2 access_tier~ min_tls_version?=TLS1_2 https_traffic_only_enabled?:bool=true allow_nested_items_to_be_public?:bool=true shared_access_key_enabled?:bool=true public_network_access_enabled?:bool=true is_hns_enabled?:bool=false^ cross_tenant_replication_enabled?:bool=false tags?:map',
      blocos: {
        static_website: { max: 1, args: 'index_document? error_404_document?' },
        blob_properties: { max: 1, args: 'versioning_enabled?:bool=false change_feed_enabled?:bool', blocos: { delete_retention_policy: { max: 1, args: 'days?:number=7' } } },
        network_rules: { max: 1, args: 'default_action! bypass~:set ip_rules~:set virtual_network_subnet_ids~:set' },
        identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' },
      },
      calc: 'id primary_blob_endpoint primary_web_endpoint primary_web_host primary_location primary_access_key$ secondary_access_key$ primary_connection_string$ primary_blob_connection_string$',
      validar: {
        name: nomeStorage,
        account_tier: umDosValores('Standard', 'Premium'),
        account_replication_type: umDosValores('LRS', 'ZRS', 'GRS', 'RAGRS', 'GZRS', 'RAGZRS'),
        account_kind: umDosValores('BlobStorage', 'BlockBlobStorage', 'FileStorage', 'Storage', 'StorageV2'),
        access_tier: umDosValores('Hot', 'Cool', 'Cold', 'Premium'),
        min_tls_version: umDosValores('TLS1_0', 'TLS1_1', 'TLS1_2'),
      },
      validarApi: (v) => nomeLivre('Storage Account')(v) ?? localValido(v),
      obsoletos: {},
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Storage/storageAccounts'),
        access_tier: (v) => v.access_tier ?? 'Hot',
        primary_location: local,
        primary_blob_endpoint: (v) => `https://${v.name}.blob.core.windows.net/`,
        primary_web_endpoint: (v) => `https://${v.name}.z15.web.core.windows.net/`,
        primary_web_host: (v) => `${v.name}.z15.web.core.windows.net`,
        primary_access_key: (v, u) => `${u.b64(86)}==`,
        secondary_access_key: (v, u) => `${u.b64(86, 's')}==`,
        primary_connection_string: (v, u, f) => `DefaultEndpointsProtocol=https;AccountName=${v.name};AccountKey=${f.primary_access_key};EndpointSuffix=core.windows.net`,
        primary_blob_connection_string: (v, u, f) => `DefaultEndpointsProtocol=https;BlobEndpoint=${f.primary_blob_endpoint};AccountName=${v.name};AccountKey=${f.primary_access_key}`,
      },
      descricao: 'Conta de armazenamento: guarda blobs (arquivos), filas, tabelas e arquivos.',
    }),
    azurerm_storage_container: tipo('azurerm_storage_container', {
      args: 'name!^ storage_account_id?^ storage_account_name?^ container_access_type?=private metadata~:map',
      calc: 'id resource_manager_id has_immutability_policy:bool has_legal_hold:bool',
      umDe: [['storage_account_id', 'storage_account_name']],
      validar: {
        container_access_type: umDosValores('private', 'blob', 'container'),
        name: padrao(/^[a-z0-9](?!.*--)[a-z0-9-]{1,61}[a-z0-9]$/, 'name ("{valor}") must be 3 - 63 characters long, lowercase letters, numbers and single hyphens'),
      },
      obsoletos: { storage_account_name: 'the `storage_account_name` property has been deprecated in favour of `storage_account_id` and will be removed in version 5.0 of the Provider.' },
      gerar: {
        id: (v) => `https://${String(v.storage_account_name ?? String(v.storage_account_id).split('/').pop())}.blob.core.windows.net/${v.name}`,
        resource_manager_id: (v, u) => `${v.storage_account_id ?? `/subscriptions/${u.assinatura}/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/${v.storage_account_name}`}/blobServices/default/containers/${v.name}`,
        has_immutability_policy: () => false,
        has_legal_hold: () => false,
        metadata: (v) => v.metadata ?? {},
      },
    }),
    azurerm_storage_blob: tipo('azurerm_storage_blob', {
      args: 'name!^ storage_account_name!^ storage_container_name!^ type!^ source?^ source_content?^ source_uri?^ content_type?=application/octet-stream access_tier~ content_md5?^ metadata~:map',
      calc: 'id url',
      validar: { type: umDosValores('Append', 'Block', 'Page') },
      gerar: {
        url: (v) => `https://${v.storage_account_name}.blob.core.windows.net/${v.storage_container_name}/${v.name}`,
        id: (v, u, f) => f.url,
        access_tier: (v) => v.access_tier ?? 'Hot',
        metadata: (v) => v.metadata ?? {},
      },
    }),
    azurerm_storage_account_static_website: tipo('azurerm_storage_account_static_website', {
      args: 'storage_account_id!^ index_document? error_404_document?',
      calc: 'id',
      gerar: { id: (v) => v.storage_account_id },
    }),
    azurerm_storage_queue: tipo('azurerm_storage_queue', {
      args: 'name!^ storage_account_id?^ storage_account_name?^ metadata?:map',
      calc: 'id resource_manager_id',
      umDe: [['storage_account_id', 'storage_account_name']],
      gerar: {
        id: (v) => `https://${String(v.storage_account_name ?? String(v.storage_account_id).split('/').pop())}.queue.core.windows.net/${v.name}`,
        resource_manager_id: (v) => `${v.storage_account_id ?? ''}/queueServices/default/queues/${v.name}`,
      },
    }),
    azurerm_storage_share: tipo('azurerm_storage_share', {
      args: 'name!^ storage_account_id?^ storage_account_name?^ quota!:number access_tier~ enabled_protocol?=SMB^',
      calc: 'id resource_manager_id url',
      umDe: [['storage_account_id', 'storage_account_name']],
      gerar: {
        url: (v) => `https://${String(v.storage_account_name ?? String(v.storage_account_id).split('/').pop())}.file.core.windows.net/${v.name}`,
        id: (v, u, f) => f.url,
        resource_manager_id: (v) => `${v.storage_account_id ?? ''}/fileServices/default/shares/${v.name}`,
        access_tier: (v) => v.access_tier ?? 'TransactionOptimized',
      },
    }),

    // ---------- rede ----------
    azurerm_virtual_network: tipo('azurerm_virtual_network', {
      args: 'name!^ resource_group_name!^ location!^ address_space!:set dns_servers~:list bgp_community? edge_zone?^ flow_timeout_in_minutes?:number tags?:map',
      blocos: { subnet: { args: 'name! address_prefixes!:list security_group?', calc: 'id' } },
      calc: 'id guid',
      validar: { address_space: listaDe(cidrValido) },
      validarApi: localValido,
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Network/virtualNetworks'),
        guid: (v, u) => u.uuid(),
        dns_servers: (v) => v.dns_servers ?? [],
      },
      descricao: 'Rede virtual (VNet): a rede privada dos seus recursos no Azure.',
    }),
    azurerm_subnet: tipo('azurerm_subnet', {
      args: 'name!^ resource_group_name!^ virtual_network_name!^ address_prefixes!:list service_endpoints?:set default_outbound_access_enabled?:bool=true private_endpoint_network_policies?=Disabled',
      blocos: {
        delegation: { args: 'name!', blocos: { service_delegation: { min: 1, max: 1, args: 'name! actions?:set' } } },
      },
      calc: 'id',
      validar: { address_prefixes: listaDe(cidrValido) },
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/virtualNetworks/${v.virtual_network_name}/subnets/${v.name}` },
    }),
    azurerm_network_security_group: tipo('azurerm_network_security_group', {
      args: 'name!^ resource_group_name!^ location!^ tags?:map',
      blocos: {
        security_rule: {
          args: 'name! priority!:number direction! access! protocol! source_port_range? source_port_ranges?:set destination_port_range? destination_port_ranges?:set source_address_prefix? source_address_prefixes?:set destination_address_prefix? destination_address_prefixes?:set description?',
        },
      },
      calc: 'id',
      validarBlocos: {
        priority: entre(100, 4096),
        direction: umDosValores('Inbound', 'Outbound'),
        access: umDosValores('Allow', 'Deny'),
        protocol: umDosValores('Tcp', 'Udp', 'Icmp', 'Esp', 'Ah', '*'),
      },
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Network/networkSecurityGroups') },
      descricao: 'Grupo de segurança de rede (NSG): regras de firewall que permitem ou bloqueiam tráfego.',
    }),
    azurerm_network_security_rule: tipo('azurerm_network_security_rule', {
      args: 'name!^ resource_group_name!^ network_security_group_name!^ priority!:number direction! access! protocol! source_port_range? source_port_ranges?:set destination_port_range? destination_port_ranges?:set source_address_prefix? source_address_prefixes?:set destination_address_prefix? destination_address_prefixes?:set description?',
      calc: 'id',
      validar: {
        priority: entre(100, 4096),
        direction: umDosValores('Inbound', 'Outbound'),
        access: umDosValores('Allow', 'Deny'),
        protocol: umDosValores('Tcp', 'Udp', 'Icmp', 'Esp', 'Ah', '*'),
      },
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/networkSecurityGroups/${v.network_security_group_name}/securityRules/${v.name}` },
    }),
    azurerm_subnet_network_security_group_association: tipo('azurerm_subnet_network_security_group_association', {
      args: 'subnet_id!^ network_security_group_id!^',
      calc: 'id',
      gerar: { id: (v) => v.subnet_id },
    }),
    azurerm_public_ip: tipo('azurerm_public_ip', {
      args: 'name!^ resource_group_name!^ location!^ allocation_method! sku?=Standard^ sku_tier?=Regional^ domain_name_label? zones?:set^ idle_timeout_in_minutes?:number=4 ip_version?=IPv4^ tags?:map',
      calc: 'id ip_address fqdn',
      validar: { allocation_method: umDosValores('Static', 'Dynamic'), sku: umDosValores('Basic', 'Standard') },
      validarApi: (v) => (v.sku !== 'Basic' && v.allocation_method === 'Dynamic'
        ? 'creating Public Ip Address: StandardSkuPublicIPAddressesMustBeStatic: Standard sku publicIp addresses must use Static allocation (IPs do SKU Standard precisam de allocation_method = "Static").'
        : null),
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Network/publicIPAddresses'),
        ip_address: (v, u) => u.ip(),
        fqdn: (v) => (v.domain_name_label ? `${v.domain_name_label}.${normalizarLocal(v.location)}.cloudapp.azure.com` : ''),
      },
    }),
    azurerm_network_interface: tipo('azurerm_network_interface', {
      args: 'name!^ resource_group_name!^ location!^ dns_servers~:list ip_forwarding_enabled?:bool=false accelerated_networking_enabled?:bool=false tags?:map',
      blocos: {
        ip_configuration: {
          min: 1,
          args: 'name! subnet_id? private_ip_address_allocation! private_ip_address~ public_ip_address_id? primary~:bool private_ip_address_version?=IPv4',
        },
      },
      calc: 'id mac_address private_ip_address private_ip_addresses:list virtual_machine_id applied_dns_servers:list internal_domain_name_suffix',
      validarBlocos: { private_ip_address_allocation: umDosValores('Dynamic', 'Static') },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Network/networkInterfaces'),
        mac_address: (v, u) => u.hex(12).toUpperCase().match(/../g).join('-'),
        private_ip_address: (v, u) => u.ipPrivado('10.0.1.0/24'),
        private_ip_addresses: (v, u, f) => [f.private_ip_address],
        virtual_machine_id: () => '',
        dns_servers: (v) => v.dns_servers ?? [],
        applied_dns_servers: () => [],
        internal_domain_name_suffix: (v, u) => `${u.hex(26).toLowerCase()}.bx.internal.cloudapp.net`,
      },
    }),
    azurerm_network_interface_security_group_association: tipo('azurerm_network_interface_security_group_association', {
      args: 'network_interface_id!^ network_security_group_id!^',
      calc: 'id',
      gerar: { id: (v) => `${v.network_interface_id}|${v.network_security_group_id}` },
    }),
    azurerm_nat_gateway: tipo('azurerm_nat_gateway', {
      args: 'name!^ resource_group_name!^ location!^ sku_name?=Standard idle_timeout_in_minutes?:number=4 zones?:set^ tags?:map',
      calc: 'id resource_guid',
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Network/natGateways'), resource_guid: (v, u) => u.uuid() },
    }),
    azurerm_nat_gateway_public_ip_association: tipo('azurerm_nat_gateway_public_ip_association', {
      args: 'nat_gateway_id!^ public_ip_address_id!^',
      calc: 'id',
      gerar: { id: (v) => `${v.nat_gateway_id}|${v.public_ip_address_id}` },
    }),
    azurerm_subnet_nat_gateway_association: tipo('azurerm_subnet_nat_gateway_association', {
      args: 'subnet_id!^ nat_gateway_id!^',
      calc: 'id',
      gerar: { id: (v) => v.subnet_id },
    }),
    azurerm_virtual_network_peering: tipo('azurerm_virtual_network_peering', {
      args: 'name!^ resource_group_name!^ virtual_network_name!^ remote_virtual_network_id!^ allow_virtual_network_access?:bool=true allow_forwarded_traffic?:bool=false allow_gateway_transit?:bool=false use_remote_gateways?:bool=false',
      calc: 'id',
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/virtualNetworks/${v.virtual_network_name}/virtualNetworkPeerings/${v.name}` },
    }),
    azurerm_private_endpoint: tipo('azurerm_private_endpoint', {
      args: 'name!^ resource_group_name!^ location!^ subnet_id!^ custom_network_interface_name?^ tags?:map',
      blocos: {
        private_service_connection: { min: 1, max: 1, args: 'name!^ is_manual_connection!:bool private_connection_resource_id? subresource_names?:list', calc: 'private_ip_address' },
        private_dns_zone_group: { max: 1, args: 'name! private_dns_zone_ids!:list' },
      },
      calc: 'id network_interface:list custom_dns_configs:list',
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Network/privateEndpoints'), network_interface: () => [], custom_dns_configs: () => [] },
    }),
    azurerm_private_dns_zone: tipo('azurerm_private_dns_zone', {
      args: 'name!^ resource_group_name!^ tags?:map',
      calc: 'id number_of_record_sets:number max_number_of_record_sets:number',
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Network/privateDnsZones'), number_of_record_sets: () => 1, max_number_of_record_sets: () => 25000 },
    }),
    azurerm_private_dns_zone_virtual_network_link: tipo('azurerm_private_dns_zone_virtual_network_link', {
      args: 'name!^ resource_group_name!^ private_dns_zone_name!^ virtual_network_id!^ registration_enabled?:bool=false tags?:map',
      calc: 'id',
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/privateDnsZones/${v.private_dns_zone_name}/virtualNetworkLinks/${v.name}` },
    }),

    // ---------- máquinas virtuais ----------
    azurerm_linux_virtual_machine: tipo('azurerm_linux_virtual_machine', {
      args: 'name!^ resource_group_name!^ location!^ size! admin_username!^ network_interface_ids!:list admin_password?$^ disable_password_authentication?:bool=true^ computer_name~^ custom_data?$^ user_data? zone?^ availability_set_id?^ source_image_id?^ priority?=Regular^ eviction_policy?^ provision_vm_agent?:bool=true^ allow_extension_operations?:bool=true tags?:map',
      blocos: {
        admin_ssh_key: { args: 'username! public_key!' },
        os_disk: { min: 1, max: 1, args: 'caching! storage_account_type!^ disk_size_gb~:number name~^ write_accelerator_enabled?:bool=false' },
        source_image_reference: { max: 1, args: 'publisher!^ offer!^ sku!^ version!^' },
        identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' },
        boot_diagnostics: { max: 1, args: 'storage_account_uri?' },
      },
      calc: 'id private_ip_address public_ip_address private_ip_addresses:list public_ip_addresses:list virtual_machine_id vm_agent_platform_updates_enabled:bool',
      validar: { size: padrao(/^(Standard|Basic)_[A-Za-z0-9_]+$/, 'size ("{valor}") deve ser um tamanho de VM do Azure, como Standard_B1s') },
      validarBlocos: {
        caching: umDosValores('None', 'ReadOnly', 'ReadWrite'),
        storage_account_type: umDosValores('Standard_LRS', 'StandardSSD_LRS', 'Premium_LRS', 'StandardSSD_ZRS', 'Premium_ZRS'),
      },
      exige: [
        (v) => (v.disable_password_authentication !== false && !(v.admin_ssh_key?.length)
          ? 'at least one `admin_ssh_key` must be specified when `disable_password_authentication` is set to `true` (use uma chave SSH ou desative o login por senha e defina admin_password)'
          : null),
        (v) => (!v.source_image_reference?.length && !v.source_image_id ? 'One of either `source_image_id` or `source_image_reference` must be set.' : null),
      ],
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Compute/virtualMachines'),
        computer_name: (v) => v.computer_name ?? v.name,
        private_ip_address: (v, u) => u.ipPrivado('10.0.1.0/24'),
        private_ip_addresses: (v, u, f) => [f.private_ip_address],
        public_ip_address: () => '',
        public_ip_addresses: () => [],
        virtual_machine_id: (v, u) => u.uuid(),
        vm_agent_platform_updates_enabled: () => false,
      },
      descricao: 'Máquina virtual Linux no Azure.',
    }),
    azurerm_managed_disk: tipo('azurerm_managed_disk', {
      args: 'name!^ resource_group_name!^ location!^ storage_account_type! create_option!^ disk_size_gb~:number zone?^ tags?:map',
      calc: 'id',
      validar: { create_option: umDosValores('Empty', 'Copy', 'FromImage', 'Import', 'Restore', 'Upload') },
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Compute/disks'), disk_size_gb: (v) => v.disk_size_gb ?? 32 },
    }),
    azurerm_virtual_machine_data_disk_attachment: tipo('azurerm_virtual_machine_data_disk_attachment', {
      args: 'managed_disk_id!^ virtual_machine_id!^ lun!:number^ caching!',
      calc: 'id',
      gerar: { id: (v) => `${v.virtual_machine_id}/dataDisks/disco${v.lun}` },
    }),
    azurerm_linux_virtual_machine_scale_set: tipo('azurerm_linux_virtual_machine_scale_set', {
      args: 'name!^ resource_group_name!^ location!^ sku! instances?:number=0 admin_username!^ admin_password?$ disable_password_authentication?:bool=true^ custom_data?$ upgrade_mode?=Manual zones?:set tags?:map',
      blocos: {
        admin_ssh_key: { args: 'username! public_key!' },
        os_disk: { min: 1, max: 1, args: 'caching! storage_account_type!' },
        source_image_reference: { max: 1, args: 'publisher! offer! sku! version!' },
        network_interface: { min: 1, args: 'name! primary?:bool', blocos: { ip_configuration: { min: 1, args: 'name! subnet_id? primary?:bool load_balancer_backend_address_pool_ids?:set' } } },
      },
      calc: 'id unique_id',
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Compute/virtualMachineScaleSets'), unique_id: (v, u) => u.uuid() },
    }),

    // ---------- App Service e Functions ----------
    azurerm_service_plan: tipo('azurerm_service_plan', {
      args: 'name!^ resource_group_name!^ location!^ os_type!^ sku_name! worker_count~:number zone_balancing_enabled?:bool=false^ per_site_scaling_enabled?:bool=false tags?:map',
      calc: 'id kind reserved:bool',
      validar: {
        os_type: umDosValores('Windows', 'Linux', 'WindowsContainer'),
        sku_name: umDosValores('F1', 'D1', 'B1', 'B2', 'B3', 'S1', 'S2', 'S3', 'P0v3', 'P1v2', 'P2v2', 'P3v2', 'P1v3', 'P2v3', 'P3v3', 'Y1', 'EP1', 'EP2', 'EP3', 'FC1', 'WS1'),
      },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Web/serverFarms'),
        kind: (v) => (v.os_type === 'Linux' ? 'linux' : v.sku_name === 'Y1' ? 'functionapp' : 'app'),
        reserved: (v) => v.os_type === 'Linux',
        worker_count: (v) => v.worker_count ?? 1,
      },
      descricao: 'Plano do App Service: define a máquina (tamanho e preço) que roda os seus apps web.',
    }),
    azurerm_linux_web_app: tipo('azurerm_linux_web_app', {
      args: 'name!^ resource_group_name!^ location!^ service_plan_id! app_settings?:map https_only?:bool=false enabled?:bool=true client_affinity_enabled?:bool=false public_network_access_enabled?:bool=true virtual_network_subnet_id? key_vault_reference_identity_id~ tags?:map',
      blocos: {
        site_config: {
          min: 1,
          max: 1,
          args: 'always_on~:bool http2_enabled?:bool=false minimum_tls_version?=1.2 ftps_state?=Disabled health_check_path? app_command_line? use_32_bit_worker?:bool=true',
          blocos: {
            application_stack: { max: 1, args: 'node_version? python_version? php_version? dotnet_version? java_version? docker_image_name? docker_registry_url?' },
          },
        },
        connection_string: { args: 'name! type! value!$' },
        identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' },
        logs: { max: 1, args: 'detailed_error_messages?:bool failed_request_tracing?:bool' },
      },
      calc: 'id default_hostname kind outbound_ip_addresses outbound_ip_address_list:list possible_outbound_ip_addresses custom_domain_verification_id$',
      validar: { name: nomeWebApp },
      validarApi: nomeLivre('Linux Web App'),
      validarBlocos: {
        node_version: umDosValores('18-lts', '20-lts', '22-lts'),
        python_version: umDosValores('3.9', '3.10', '3.11', '3.12', '3.13'),
        php_version: umDosValores('8.2', '8.3', '8.4'),
      },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Web/sites'),
        default_hostname: (v) => `${v.name}.azurewebsites.net`,
        kind: () => 'app,linux',
        outbound_ip_address_list: (v, u) => [u.ip('o1'), u.ip('o2')],
        outbound_ip_addresses: (v, u, f) => f.outbound_ip_address_list.join(','),
        possible_outbound_ip_addresses: (v, u, f) => f.outbound_ip_addresses,
        custom_domain_verification_id: (v, u) => u.hex(64).toUpperCase(),
        key_vault_reference_identity_id: () => 'SystemAssigned',
      },
      descricao: 'App web Linux no App Service (o seu site ou API rodando no Azure).',
    }),
    azurerm_linux_function_app: tipo('azurerm_linux_function_app', {
      args: 'name!^ resource_group_name!^ location!^ service_plan_id! storage_account_name? storage_account_access_key?$ storage_uses_managed_identity?:bool app_settings?:map https_only?:bool=false functions_extension_version?=~4 enabled?:bool=true tags?:map',
      blocos: {
        site_config: {
          min: 1,
          max: 1,
          args: 'always_on~:bool application_insights_key?$ application_insights_connection_string?$ minimum_tls_version?=1.2',
          blocos: { application_stack: { max: 1, args: 'node_version? python_version? dotnet_version? java_version? powershell_core_version?' } },
        },
        identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' },
      },
      calc: 'id default_hostname kind outbound_ip_addresses',
      validar: { name: nomeWebApp },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Web/sites'),
        default_hostname: (v) => `${v.name}.azurewebsites.net`,
        kind: () => 'functionapp,linux',
        outbound_ip_addresses: (v, u) => `${u.ip('o1')},${u.ip('o2')}`,
      },
      descricao: 'Function App: funções que rodam sem servidor (serverless) no Azure.',
    }),

    // ---------- bancos de dados ----------
    azurerm_mssql_server: tipo('azurerm_mssql_server', {
      args: 'name!^ resource_group_name!^ location!^ version!^ administrator_login~^ administrator_login_password?$ minimum_tls_version?=1.2 public_network_access_enabled?:bool=true connection_policy?=Default tags?:map',
      blocos: {
        azuread_administrator: { max: 1, args: 'login_username! object_id! tenant_id~ azuread_authentication_only~:bool' },
        identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' },
      },
      calc: 'id fully_qualified_domain_name restorable_dropped_database_ids:list',
      validar: {
        version: umDosValores('2.0', '12.0'),
        name: padrao(/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/, 'name ("{valor}") must contain only lowercase letters, numbers and hyphens, and be 2 - 63 characters long'),
      },
      validarApi: (v) => (v.administrator_login && /^(admin|administrator|sa|root|dbmanager|guest|public)$/i.test(v.administrator_login)
        ? `creating Server: InvalidLoginName: '${v.administrator_login}' is a reserved word and cannot be used as an administrator login. Escolha outro nome (ex.: sqladmin).`
        : nomeLivre('MSSQL Server')(v)),
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Sql/servers'),
        fully_qualified_domain_name: (v) => `${v.name}.database.windows.net`,
        restorable_dropped_database_ids: () => [],
        administrator_login: (v) => v.administrator_login ?? '',
      },
    }),
    azurerm_mssql_database: tipo('azurerm_mssql_database', {
      args: 'name!^ server_id!^ sku_name~ max_size_gb~:number collation~^ zone_redundant~:bool read_scale~:bool storage_account_type?=Geo license_type~ auto_pause_delay_in_minutes~:number min_capacity~:number tags?:map',
      calc: 'id',
      gerar: {
        id: (v) => `${v.server_id}/databases/${v.name}`,
        sku_name: (v) => v.sku_name ?? 'GP_S_Gen5_2',
        max_size_gb: (v) => v.max_size_gb ?? 32,
        collation: (v) => v.collation ?? 'SQL_Latin1_General_CP1_CI_AS',
        zone_redundant: (v) => v.zone_redundant ?? false,
        read_scale: (v) => v.read_scale ?? false,
        license_type: (v) => v.license_type ?? '',
      },
    }),
    azurerm_mssql_firewall_rule: tipo('azurerm_mssql_firewall_rule', {
      args: 'name!^ server_id!^ start_ip_address! end_ip_address!',
      calc: 'id',
      gerar: { id: (v) => `${v.server_id}/firewallRules/${v.name}` },
    }),
    azurerm_postgresql_flexible_server: tipo('azurerm_postgresql_flexible_server', {
      args: 'name!^ resource_group_name!^ location!^ version~ sku_name~ storage_mb~:number storage_tier~ administrator_login~^ administrator_password?$ zone~ backup_retention_days~:number geo_redundant_backup_enabled?:bool=false^ public_network_access_enabled~:bool delegated_subnet_id?^ private_dns_zone_id~^ tags?:map',
      blocos: { authentication: { max: 1, args: 'active_directory_auth_enabled?:bool=false password_auth_enabled?:bool=true tenant_id~' } },
      calc: 'id fqdn',
      validar: { version: umDosValores('11', '12', '13', '14', '15', '16', '17') },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.DBforPostgreSQL/flexibleServers'),
        fqdn: (v) => `${v.name}.postgres.database.azure.com`,
        version: (v) => v.version ?? '16',
        sku_name: (v) => v.sku_name ?? 'GP_Standard_D2s_v3',
        storage_mb: (v) => v.storage_mb ?? 32768,
        storage_tier: (v) => v.storage_tier ?? 'P4',
        zone: (v) => v.zone ?? '1',
        backup_retention_days: (v) => v.backup_retention_days ?? 7,
        public_network_access_enabled: (v) => v.public_network_access_enabled ?? !v.delegated_subnet_id,
        administrator_login: (v) => v.administrator_login ?? '',
        private_dns_zone_id: (v) => v.private_dns_zone_id ?? '',
      },
    }),
    azurerm_postgresql_flexible_server_database: tipo('azurerm_postgresql_flexible_server_database', {
      args: 'name!^ server_id!^ charset?=UTF8^ collation?=en_US.utf8^',
      calc: 'id',
      gerar: { id: (v) => `${v.server_id}/databases/${v.name}` },
    }),
    azurerm_postgresql_flexible_server_firewall_rule: tipo('azurerm_postgresql_flexible_server_firewall_rule', {
      args: 'name!^ server_id!^ start_ip_address! end_ip_address!',
      calc: 'id',
      gerar: { id: (v) => `${v.server_id}/firewallRules/${v.name}` },
    }),
    azurerm_cosmosdb_account: tipo('azurerm_cosmosdb_account', {
      args: 'name!^ resource_group_name!^ location!^ offer_type! kind?=GlobalDocumentDB^ free_tier_enabled?:bool=false^ automatic_failover_enabled?:bool=false public_network_access_enabled?:bool=true local_authentication_disabled?:bool=false tags?:map',
      blocos: {
        consistency_policy: { min: 1, max: 1, args: 'consistency_level! max_interval_in_seconds?:number=5 max_staleness_prefix?:number=100' },
        geo_location: { min: 1, args: 'location! failover_priority!:number zone_redundant?:bool=false', calc: 'id' },
        capabilities: { args: 'name!' },
      },
      calc: 'id endpoint read_endpoints:list write_endpoints:list primary_key$ secondary_key$ primary_sql_connection_string$',
      validar: { offer_type: umDosValores('Standard'), kind: umDosValores('GlobalDocumentDB', 'MongoDB', 'Parse') },
      validarBlocos: { consistency_level: umDosValores('BoundedStaleness', 'Eventual', 'Session', 'Strong', 'ConsistentPrefix') },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.DocumentDB/databaseAccounts'),
        endpoint: (v) => `https://${v.name}.documents.azure.com:443/`,
        read_endpoints: (v, u, f) => [f.endpoint],
        write_endpoints: (v, u, f) => [f.endpoint],
        primary_key: (v, u) => `${u.b64(86)}==`,
        secondary_key: (v, u) => `${u.b64(86, 's')}==`,
        primary_sql_connection_string: (v, u, f) => `AccountEndpoint=${f.endpoint};AccountKey=${f.primary_key};`,
      },
      descricao: 'Conta do Cosmos DB: banco NoSQL distribuído globalmente.',
    }),
    azurerm_cosmosdb_sql_database: tipo('azurerm_cosmosdb_sql_database', {
      args: 'name!^ resource_group_name!^ account_name!^ throughput~:number',
      blocos: { autoscale_settings: { max: 1, args: 'max_throughput~:number' } },
      calc: 'id',
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.DocumentDB/databaseAccounts/${v.account_name}/sqlDatabases/${v.name}` },
    }),
    azurerm_cosmosdb_sql_container: tipo('azurerm_cosmosdb_sql_container', {
      args: 'name!^ resource_group_name!^ account_name!^ database_name!^ partition_key_paths!:list^ partition_key_kind?=Hash^ partition_key_version?:number throughput~:number default_ttl~:number',
      calc: 'id',
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.DocumentDB/databaseAccounts/${v.account_name}/sqlDatabases/${v.database_name}/containers/${v.name}` },
    }),
    azurerm_redis_cache: tipo('azurerm_redis_cache', {
      args: 'name!^ resource_group_name!^ location!^ capacity!:number family! sku_name! non_ssl_port_enabled?:bool=false minimum_tls_version?=1.2 tags?:map',
      calc: 'id hostname port:number ssl_port:number primary_access_key$ primary_connection_string$',
      validar: { family: umDosValores('C', 'P'), sku_name: umDosValores('Basic', 'Standard', 'Premium') },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Cache/redis'),
        hostname: (v) => `${v.name}.redis.cache.windows.net`,
        port: () => 6379,
        ssl_port: () => 6380,
        primary_access_key: (v, u) => `${u.b64(43)}=`,
        primary_connection_string: (v, u, f) => `${f.hostname}:6380,password=${f.primary_access_key},ssl=True,abortConnect=False`,
      },
    }),

    // ---------- segurança ----------
    azurerm_key_vault: tipo('azurerm_key_vault', {
      args: 'name!^ resource_group_name!^ location!^ tenant_id! sku_name! soft_delete_retention_days?:number=90 purge_protection_enabled?:bool enabled_for_deployment?:bool enabled_for_disk_encryption?:bool enabled_for_template_deployment?:bool enable_rbac_authorization?:bool public_network_access_enabled?:bool=true tags?:map',
      blocos: {
        access_policy: { args: 'tenant_id! object_id! application_id? key_permissions?:list secret_permissions?:list certificate_permissions?:list storage_permissions?:list' },
        network_acls: { max: 1, args: 'bypass! default_action! ip_rules?:set virtual_network_subnet_ids?:set' },
      },
      calc: 'id vault_uri',
      validar: { name: nomeKeyVault, sku_name: umDosValores('standard', 'premium'), soft_delete_retention_days: entre(7, 90) },
      validarApi: nomeLivre('Key Vault'),
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.KeyVault/vaults'),
        vault_uri: (v) => `https://${v.name}.vault.azure.net/`,
      },
      descricao: 'Key Vault: cofre para senhas, chaves e certificados.',
    }),
    azurerm_key_vault_secret: tipo('azurerm_key_vault_secret', {
      args: 'name!^ value?$ value_wo?$ key_vault_id!^ content_type? not_before_date? expiration_date? tags?:map',
      calc: 'id version versionless_id resource_id resource_versionless_id',
      validar: { name: padrao(/^[0-9a-zA-Z-]{1,127}$/, 'name ("{valor}") may only contain alphanumeric characters and dashes') },
      gerar: {
        version: (v, u) => u.hex(32),
        versionless_id: (v) => `https://cofre.vault.azure.net/secrets/${v.name}`,
        id: (v, u, f) => `${f.versionless_id}/${f.version}`,
        resource_versionless_id: (v) => `${v.key_vault_id}/secrets/${v.name}`,
        resource_id: (v, u, f) => `${f.resource_versionless_id}/versions/${f.version}`,
      },
    }),
    azurerm_key_vault_access_policy: tipo('azurerm_key_vault_access_policy', {
      args: 'key_vault_id!^ tenant_id!^ object_id!^ application_id?^ key_permissions?:list secret_permissions?:list certificate_permissions?:list',
      calc: 'id',
      gerar: { id: (v) => `${v.key_vault_id}/objectId/${v.object_id}` },
    }),
    azurerm_user_assigned_identity: tipo('azurerm_user_assigned_identity', {
      args: 'name!^ resource_group_name!^ location!^ tags?:map',
      calc: 'id principal_id client_id tenant_id',
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.ManagedIdentity/userAssignedIdentities'),
        principal_id: (v, u) => u.uuid('p'),
        client_id: (v, u) => u.uuid('c'),
        tenant_id: (v, u) => u.tenant,
      },
      descricao: 'Identidade gerenciada: uma "conta de serviço" que o recurso usa para acessar outros sem senha.',
    }),
    azurerm_role_assignment: tipo('azurerm_role_assignment', {
      args: 'scope!^ principal_id!^ role_definition_name~^ role_definition_id~^ principal_type~^ description?^ skip_service_principal_aad_check~:bool',
      calc: 'id name',
      umDe: [['role_definition_name', 'role_definition_id']],
      gerar: {
        name: (v, u) => u.uuid(),
        id: (v, u, f) => `${v.scope}/providers/Microsoft.Authorization/roleAssignments/${f.name}`,
        role_definition_id: (v, u) => v.role_definition_id ?? `/subscriptions/${u.assinatura}/providers/Microsoft.Authorization/roleDefinitions/${u.uuid('rd')}`,
        role_definition_name: (v) => v.role_definition_name ?? '',
        principal_type: (v) => v.principal_type ?? 'ServicePrincipal',
        skip_service_principal_aad_check: (v) => v.skip_service_principal_aad_check ?? false,
      },
      descricao: 'Atribuição de papel (RBAC): dá a alguém um papel, como "Reader", num escopo.',
    }),

    // ---------- contêineres e Kubernetes ----------
    azurerm_container_registry: tipo('azurerm_container_registry', {
      args: 'name!^ resource_group_name!^ location!^ sku! admin_enabled?:bool=false public_network_access_enabled?:bool=true anonymous_pull_enabled?:bool zone_redundancy_enabled?:bool=false^ tags?:map',
      blocos: { identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' } },
      calc: 'id login_server admin_username admin_password$',
      validar: { name: nomeAcr, sku: umDosValores('Basic', 'Standard', 'Premium') },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.ContainerRegistry/registries'),
        login_server: (v) => `${String(v.name).toLowerCase()}.azurecr.io`,
        admin_username: (v) => (v.admin_enabled ? v.name : ''),
        admin_password: (v, u) => (v.admin_enabled ? u.b64(52) : ''),
      },
    }),
    azurerm_kubernetes_cluster: tipo('azurerm_kubernetes_cluster', {
      args: 'name!^ resource_group_name!^ location!^ dns_prefix?^ dns_prefix_private_cluster?^ kubernetes_version~ sku_tier?=Free private_cluster_enabled?:bool=false^ oidc_issuer_enabled?:bool workload_identity_enabled?:bool=false local_account_disabled?:bool azure_policy_enabled?:bool role_based_access_control_enabled?:bool=true^ automatic_upgrade_channel? node_resource_group~^ tags?:map',
      blocos: {
        default_node_pool: {
          min: 1,
          max: 1,
          args: 'name!^ vm_size! node_count~:number auto_scaling_enabled?:bool min_count?:number max_count?:number max_pods~:number os_disk_size_gb~:number vnet_subnet_id?^ zones?:set temporary_name_for_rotation? type?=VirtualMachineScaleSets^',
        },
        identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' },
        service_principal: { max: 1, args: 'client_id! client_secret!$' },
        network_profile: { max: 1, args: 'network_plugin!^ network_policy~^ network_plugin_mode?^ service_cidr~^ dns_service_ip~^ load_balancer_sku?=standard^ outbound_type?=loadBalancer^' },
        oms_agent: { max: 1, args: 'log_analytics_workspace_id! msi_auth_for_monitoring_enabled?:bool' },
        azure_active_directory_role_based_access_control: { max: 1, args: 'tenant_id~ admin_group_object_ids?:list azure_rbac_enabled?:bool' },
      },
      calc: 'id fqdn private_fqdn kube_config_raw$ kube_admin_config_raw$ kube_config:list$ kubelet_identity:list oidc_issuer_url node_resource_group_id current_kubernetes_version',
      validar: { sku_tier: umDosValores('Free', 'Standard', 'Premium'), dns_prefix: padrao(/^[a-zA-Z][-a-zA-Z0-9]{0,52}[a-zA-Z0-9]$/, 'dns_prefix ("{valor}") must begin and end with a letter or number, contain only letters, numbers, and hyphens and be between 1 and 54 characters in length') },
      validarBlocos: {
        name: padrao(/^[a-z][a-z0-9]{0,11}$/, 'name ("{valor}") of the node pool must be lowercase alphanumeric, start with a letter and have at most 12 characters'),
        network_plugin: umDosValores('azure', 'kubenet', 'none'),
      },
      umDe: [['dns_prefix', 'dns_prefix_private_cluster']],
      exige: [
        (v) => (!v.identity?.length && !v.service_principal?.length ? 'one of either `identity` or `service_principal` must be specified (o mais comum hoje é identity { type = "SystemAssigned" })' : null),
        (v) => {
          const pool = v.default_node_pool?.[0];
          if (!pool) return null;
          if (pool.auto_scaling_enabled && (pool.min_count == null || pool.max_count == null)) return '`min_count` and `max_count` must be set when `auto_scaling_enabled` is set to `true`';
          if (!pool.auto_scaling_enabled && (pool.min_count != null || pool.max_count != null)) return '`min_count` and `max_count` must be null when `auto_scaling_enabled` is set to `false`';
          return null;
        },
      ],
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.ContainerService/managedClusters'),
        kubernetes_version: (v) => v.kubernetes_version ?? '1.32.6',
        current_kubernetes_version: (v) => v.kubernetes_version ?? '1.32.6',
        node_resource_group: (v) => v.node_resource_group ?? `MC_${v.resource_group_name}_${v.name}_${normalizarLocal(v.location)}`,
        node_resource_group_id: (v, u, f) => idGrupo(u, f.node_resource_group),
        fqdn: (v, u) => `${v.dns_prefix ?? v.dns_prefix_private_cluster}-${u.hex(8).toLowerCase()}.hcp.${normalizarLocal(v.location)}.azmk8s.io`,
        private_fqdn: () => '',
        kube_config_raw: (v, u, f) => `apiVersion: v1\nclusters:\n- cluster:\n    server: https://${f.fqdn}:443\n  name: ${v.name}\nkind: Config\n`,
        kube_admin_config_raw: () => '',
        kube_config: (v, u, f) => [{ host: `https://${f.fqdn}:443`, username: `clusterUser_${v.resource_group_name}_${v.name}`, password: u.hex(64), client_certificate: u.b64(64), client_key: u.b64(64), cluster_ca_certificate: u.b64(64) }],
        oidc_issuer_url: (v, u) => (v.oidc_issuer_enabled ? `https://${normalizarLocal(v.location)}.oic.prod-aks.azure.com/${u.tenant}/${u.uuid('oidc')}/` : ''),
        kubelet_identity: (v, u, f) => [{ client_id: u.uuid('kubelet-cliente'), object_id: u.uuid('kubelet'), user_assigned_identity_id: `${idGrupo(u, f.node_resource_group)}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${v.name}-agentpool` }],
      },
      descricao: 'Cluster do AKS: Kubernetes gerenciado pelo Azure.',
    }),
    azurerm_kubernetes_cluster_node_pool: tipo('azurerm_kubernetes_cluster_node_pool', {
      args: 'name!^ kubernetes_cluster_id!^ vm_size!^ node_count~:number auto_scaling_enabled?:bool min_count?:number max_count?:number mode?=User os_type?=Linux^ node_labels?:map node_taints?:list zones?:set^ vnet_subnet_id?^ priority?=Regular^ tags?:map',
      calc: 'id',
      validar: { name: padrao(/^[a-z][a-z0-9]{0,11}$/, 'name ("{valor}") must be lowercase alphanumeric, start with a letter and have at most 12 characters'), mode: umDosValores('System', 'User') },
      gerar: { id: (v) => `${v.kubernetes_cluster_id}/agentPools/${v.name}`, node_count: (v) => v.node_count ?? 1 },
    }),
    azurerm_container_app_environment: tipo('azurerm_container_app_environment', {
      args: 'name!^ resource_group_name!^ location!^ log_analytics_workspace_id?^ infrastructure_subnet_id?^ internal_load_balancer_enabled?:bool^ zone_redundancy_enabled?:bool^ tags?:map',
      calc: 'id default_domain static_ip_address docker_bridge_cidr platform_reserved_cidr',
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.App/managedEnvironments'),
        default_domain: (v, u) => `${u.hex(12).toLowerCase()}.${normalizarLocal(v.location)}.azurecontainerapps.io`,
        static_ip_address: (v, u) => u.ip(),
        docker_bridge_cidr: () => '',
        platform_reserved_cidr: () => '',
      },
    }),
    azurerm_container_app: tipo('azurerm_container_app', {
      args: 'name!^ resource_group_name!^ container_app_environment_id!^ revision_mode! workload_profile_name? max_inactive_revisions?:number tags?:map',
      blocos: {
        template: {
          min: 1,
          max: 1,
          args: 'min_replicas?:number=0 max_replicas?:number=10',
          blocos: { container: { min: 1, args: 'name! image! cpu!:number memory!', blocos: { env: { args: 'name! value? secret_name?' } } } },
        },
        ingress: { max: 1, args: 'external_enabled?:bool=false target_port!:number transport?=auto allow_insecure_connections?:bool=false', blocos: { traffic_weight: { min: 1, args: 'percentage!:number latest_revision?:bool' } }, calc: 'fqdn' },
        secret: { args: 'name! value?$' },
        identity: { max: 1, args: 'type! identity_ids?:set', calc: 'principal_id tenant_id' },
        registry: { args: 'server! username? password_secret_name? identity?' },
      },
      calc: 'id latest_revision_fqdn latest_revision_name outbound_ip_addresses:list location',
      validar: { revision_mode: umDosValores('Single', 'Multiple') },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.App/containerApps'),
        latest_revision_name: (v, u) => `${v.name}--${u.hex(7).toLowerCase()}`,
        latest_revision_fqdn: (v, u, f) => `${f.latest_revision_name}.${u.hex(12, 'dom').toLowerCase()}.brazilsouth.azurecontainerapps.io`,
        outbound_ip_addresses: (v, u) => [u.ip('out')],
        location: () => 'brazilsouth',
      },
    }),

    // ---------- monitoramento ----------
    azurerm_log_analytics_workspace: tipo('azurerm_log_analytics_workspace', {
      args: 'name!^ resource_group_name!^ location!^ sku~ retention_in_days~:number daily_quota_gb?:number=-1 internet_ingestion_enabled?:bool=true internet_query_enabled?:bool=true tags?:map',
      calc: 'id workspace_id primary_shared_key$ secondary_shared_key$',
      validar: { sku: umDosValores('Free', 'PerNode', 'Premium', 'Standard', 'Standalone', 'Unlimited', 'CapacityReservation', 'PerGB2018'), retention_in_days: entre(30, 730) },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.OperationalInsights/workspaces'),
        workspace_id: (v, u) => u.uuid(),
        primary_shared_key: (v, u) => `${u.b64(86)}==`,
        secondary_shared_key: (v, u) => `${u.b64(86, 's')}==`,
        sku: (v) => v.sku ?? 'PerGB2018',
        retention_in_days: (v) => v.retention_in_days ?? 30,
      },
    }),
    azurerm_application_insights: tipo('azurerm_application_insights', {
      args: 'name!^ resource_group_name!^ location!^ application_type!^ workspace_id? retention_in_days?:number=90 sampling_percentage?:number=100 disable_ip_masking?:bool=false tags?:map',
      calc: 'id app_id instrumentation_key$ connection_string$',
      validar: { application_type: umDosValores('ios', 'java', 'MobileCenter', 'Node.JS', 'other', 'phone', 'store', 'web') },
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Insights/components'),
        app_id: (v, u) => u.uuid('app'),
        instrumentation_key: (v, u) => u.uuid('ik'),
        connection_string: (v, u, f) => `InstrumentationKey=${f.instrumentation_key};IngestionEndpoint=https://${normalizarLocal(v.location)}-1.in.applicationinsights.azure.com/`,
      },
    }),
    azurerm_monitor_action_group: tipo('azurerm_monitor_action_group', {
      args: 'name!^ resource_group_name!^ short_name! enabled?:bool=true location?=global^ tags?:map',
      blocos: {
        email_receiver: { args: 'name! email_address! use_common_alert_schema?:bool' },
        sms_receiver: { args: 'name! country_code! phone_number!' },
        webhook_receiver: { args: 'name! service_uri! use_common_alert_schema?:bool' },
      },
      calc: 'id',
      validar: { short_name: padrao(/^.{1,12}$/, 'short_name ("{valor}") cannot be longer than 12 characters') },
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Insights/actionGroups') },
    }),
    azurerm_monitor_metric_alert: tipo('azurerm_monitor_metric_alert', {
      args: 'name!^ resource_group_name!^ scopes!:set description? severity?:number=3 enabled?:bool=true frequency?=PT1M window_size?=PT5M auto_mitigate?:bool=true target_resource_type~ target_resource_location~ tags?:map',
      blocos: {
        criteria: { args: 'metric_namespace! metric_name! aggregation! operator! threshold!:number', blocos: { dimension: { args: 'name! operator! values!:list' } } },
        action: { args: 'action_group_id! webhook_properties?:map' },
      },
      calc: 'id',
      validar: { severity: entre(0, 4) },
      validarBlocos: {
        aggregation: umDosValores('Average', 'Count', 'Minimum', 'Maximum', 'Total'),
        operator: umDosValores('Equals', 'GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual', 'NotEquals', 'Include', 'Exclude'),
      },
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Insights/metricAlerts'), target_resource_type: (v) => v.target_resource_type ?? '', target_resource_location: (v) => v.target_resource_location ?? '' },
    }),
    azurerm_monitor_diagnostic_setting: tipo('azurerm_monitor_diagnostic_setting', {
      args: 'name!^ target_resource_id!^ log_analytics_workspace_id? storage_account_id?^ log_analytics_destination_type~',
      blocos: { enabled_log: { args: 'category? category_group?' }, enabled_metric: { args: 'category!' } },
      calc: 'id',
      gerar: { id: (v) => `${v.target_resource_id}|${v.name}` },
    }),

    // ---------- DNS e balanceamento ----------
    azurerm_dns_zone: tipo('azurerm_dns_zone', {
      args: 'name!^ resource_group_name!^ tags?:map',
      calc: 'id name_servers:set number_of_record_sets:number max_number_of_record_sets:number',
      gerar: {
        id: (v, u) => idPrestador(u, v, 'Microsoft.Network/dnsZones'),
        name_servers: (v, u) => [`ns1-0${parseInt(u.hex(1), 16) % 9}.azure-dns.com.`, `ns2-0${parseInt(u.hex(1, 'b'), 16) % 9}.azure-dns.net.`, `ns3-0${parseInt(u.hex(1, 'c'), 16) % 9}.azure-dns.org.`, `ns4-0${parseInt(u.hex(1, 'd'), 16) % 9}.azure-dns.info.`],
        number_of_record_sets: () => 2,
        max_number_of_record_sets: () => 10000,
      },
    }),
    azurerm_dns_a_record: tipo('azurerm_dns_a_record', {
      args: 'name!^ zone_name!^ resource_group_name!^ ttl!:number records?:set target_resource_id? tags?:map',
      calc: 'id fqdn',
      umDe: [['records', 'target_resource_id']],
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/dnsZones/${v.zone_name}/A/${v.name}`, fqdn: (v) => `${v.name}.${v.zone_name}.` },
    }),
    azurerm_dns_cname_record: tipo('azurerm_dns_cname_record', {
      args: 'name!^ zone_name!^ resource_group_name!^ ttl!:number record? target_resource_id? tags?:map',
      calc: 'id fqdn',
      umDe: [['record', 'target_resource_id']],
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/dnsZones/${v.zone_name}/CNAME/${v.name}`, fqdn: (v) => `${v.name}.${v.zone_name}.` },
    }),
    azurerm_dns_txt_record: tipo('azurerm_dns_txt_record', {
      args: 'name!^ zone_name!^ resource_group_name!^ ttl!:number tags?:map',
      blocos: { record: { min: 1, args: 'value!' } },
      calc: 'id fqdn',
      gerar: { id: (v, u) => `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/dnsZones/${v.zone_name}/TXT/${v.name}`, fqdn: (v) => `${v.name}.${v.zone_name}.` },
    }),
    azurerm_lb: tipo('azurerm_lb', {
      args: 'name!^ resource_group_name!^ location!^ sku?=Basic^ sku_tier?=Regional^ edge_zone?^ tags?:map',
      blocos: {
        frontend_ip_configuration: {
          args: 'name! public_ip_address_id? subnet_id? private_ip_address~ private_ip_address_allocation~ zones?:set',
          calc: 'id inbound_nat_rules:set load_balancer_rules:set outbound_rules:set',
        },
      },
      calc: 'id private_ip_address private_ip_addresses:list',
      validar: { sku: umDosValores('Basic', 'Standard', 'Gateway') },
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Network/loadBalancers'), private_ip_address: () => '', private_ip_addresses: () => [] },
    }),
    azurerm_lb_backend_address_pool: tipo('azurerm_lb_backend_address_pool', {
      args: 'name!^ loadbalancer_id!^ virtual_network_id?',
      calc: 'id backend_ip_configurations:list load_balancing_rules:list outbound_rules:list',
      gerar: { id: (v) => `${v.loadbalancer_id}/backendAddressPools/${v.name}`, backend_ip_configurations: () => [], load_balancing_rules: () => [], outbound_rules: () => [] },
    }),
    azurerm_lb_probe: tipo('azurerm_lb_probe', {
      args: 'name!^ loadbalancer_id!^ port!:number protocol?=Tcp request_path? interval_in_seconds?:number=15 number_of_probes?:number=2 probe_threshold?:number=1',
      calc: 'id load_balancer_rules:set',
      validar: { protocol: umDosValores('Http', 'Https', 'Tcp') },
      gerar: { id: (v) => `${v.loadbalancer_id}/probes/${v.name}`, load_balancer_rules: () => [] },
    }),
    azurerm_lb_rule: tipo('azurerm_lb_rule', {
      args: 'name!^ loadbalancer_id!^ frontend_ip_configuration_name! protocol! frontend_port!:number backend_port!:number backend_address_pool_ids?:list probe_id? enable_floating_ip?:bool=false idle_timeout_in_minutes?:number=4 load_distribution?=Default disable_outbound_snat?:bool=false',
      calc: 'id frontend_ip_configuration_id',
      validar: { protocol: umDosValores('All', 'Tcp', 'Udp'), frontend_port: entre(0, 65534), backend_port: entre(0, 65535) },
      gerar: { id: (v) => `${v.loadbalancer_id}/loadBalancingRules/${v.name}`, frontend_ip_configuration_id: (v) => `${v.loadbalancer_id}/frontendIPConfigurations/${v.frontend_ip_configuration_name}` },
    }),
    azurerm_application_gateway: tipo('azurerm_application_gateway', {
      args: 'name!^ resource_group_name!^ location!^ zones?:set^ enable_http2?:bool tags?:map',
      blocos: {
        sku: { min: 1, max: 1, args: 'name! tier! capacity?:number' },
        gateway_ip_configuration: { min: 1, args: 'name! subnet_id!' },
        frontend_port: { min: 1, args: 'name! port!:number' },
        frontend_ip_configuration: { min: 1, args: 'name! public_ip_address_id? subnet_id? private_ip_address~' },
        backend_address_pool: { min: 1, args: 'name! fqdns?:set ip_addresses?:set' },
        backend_http_settings: { min: 1, args: 'name! port!:number protocol! cookie_based_affinity! request_timeout?:number=30 path?' },
        http_listener: { min: 1, args: 'name! frontend_ip_configuration_name! frontend_port_name! protocol! host_name?' },
        request_routing_rule: { min: 1, args: 'name! rule_type! http_listener_name! backend_address_pool_name? backend_http_settings_name? priority?:number' },
      },
      calc: 'id',
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Network/applicationGateways') },
    }),
    azurerm_static_web_app: tipo('azurerm_static_web_app', {
      args: 'name!^ resource_group_name!^ location!^ sku_tier?=Free sku_size?=Free app_settings?:map tags?:map',
      calc: 'id default_host_name api_key$',
      gerar: { id: (v, u) => idPrestador(u, v, 'Microsoft.Web/staticSites'), default_host_name: (v, u) => `${u.palavras(2)}-${u.hex(8).toLowerCase()}.azurestaticapps.net`, api_key: (v, u) => u.hex(64) },
    }),
  },

  dados: {
    azurerm_client_config: tipo('azurerm_client_config', {
      calc: 'id client_id tenant_id subscription_id object_id',
      ler: (v, u) => ({ id: `Y2xpZW50Q29uZmlncy9jbGllbnRJZD0`, client_id: '04b07795-8ddb-461a-bbee-02f9e1bf7b46', tenant_id: u.tenant, subscription_id: u.assinatura, object_id: '11111111-2222-3333-4444-555555555555' }),
      descricao: 'Lê quem está autenticado agora (tenant, assinatura e object_id).',
    }),
    azurerm_subscription: tipo('azurerm_subscription', {
      args: 'subscription_id~',
      calc: 'id display_name tenant_id state',
      ler: (v, u) => ({ id: `/subscriptions/${u.assinatura}`, subscription_id: u.assinatura, display_name: 'Assinatura de laboratório', tenant_id: u.tenant, state: 'Enabled' }),
    }),
    azurerm_resource_group: tipo('azurerm_resource_group', {
      args: 'name!',
      calc: 'id location tags:map managed_by',
      ler: (v, u) => ({ id: idGrupo(u, v.name), location: 'brazilsouth', tags: {}, managed_by: '' }),
      descricao: 'Lê um grupo de recursos que já existe (criado fora deste código).',
    }),
    azurerm_virtual_network: tipo('azurerm_virtual_network', {
      args: 'name! resource_group_name!',
      calc: 'id location address_space:list subnets:list dns_servers:list guid',
      ler: (v, u) => ({ id: idPrestador(u, v, 'Microsoft.Network/virtualNetworks'), location: 'brazilsouth', address_space: ['10.0.0.0/16'], subnets: ['default'], dns_servers: [], guid: u.uuid() }),
    }),
    azurerm_subnet: tipo('azurerm_subnet', {
      args: 'name! virtual_network_name! resource_group_name!',
      calc: 'id address_prefixes:list',
      ler: (v, u) => ({ id: `${idGrupo(u, v.resource_group_name)}/providers/Microsoft.Network/virtualNetworks/${v.virtual_network_name}/subnets/${v.name}`, address_prefixes: ['10.0.1.0/24'] }),
    }),
    azurerm_key_vault: tipo('azurerm_key_vault', {
      args: 'name! resource_group_name!',
      calc: 'id vault_uri tenant_id location sku_name',
      ler: (v, u) => ({ id: idPrestador(u, v, 'Microsoft.KeyVault/vaults'), vault_uri: `https://${v.name}.vault.azure.net/`, tenant_id: u.tenant, location: 'brazilsouth', sku_name: 'standard' }),
    }),
    azurerm_key_vault_secret: tipo('azurerm_key_vault_secret', {
      args: 'name! key_vault_id!',
      calc: 'id value$ version content_type',
      ler: (v, u) => ({ id: `https://cofre.vault.azure.net/secrets/${v.name}/${u.hex(32)}`, value: `segredo-${u.hex(12)}`, version: u.hex(32), content_type: '' }),
    }),
    azurerm_storage_account: tipo('azurerm_storage_account', {
      args: 'name! resource_group_name?',
      calc: 'id location primary_blob_endpoint primary_access_key$ account_tier account_replication_type',
      ler: (v, u) => ({ id: idPrestador(u, { ...v, resource_group_name: v.resource_group_name ?? 'rg' }, 'Microsoft.Storage/storageAccounts'), location: 'brazilsouth', primary_blob_endpoint: `https://${v.name}.blob.core.windows.net/`, primary_access_key: `${u.b64(86)}==`, account_tier: 'Standard', account_replication_type: 'LRS' }),
    }),
    azurerm_role_definition: tipo('azurerm_role_definition', {
      args: 'name~ role_definition_id~ scope?',
      calc: 'id description type permissions:list assignable_scopes:list',
      ler: (v, u) => ({ id: `/subscriptions/${u.assinatura}/providers/Microsoft.Authorization/roleDefinitions/${u.uuid('rd')}`, name: v.name ?? 'Reader', role_definition_id: u.uuid('rd'), description: `Papel ${v.name ?? 'Reader'}`, type: 'BuiltInRole', permissions: [], assignable_scopes: ['/'] }),
    }),
  },
};

for (const def of Object.values(PROVEDOR_AZURE.recursos)) {
  def.docs = `https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/${def.nome.replace(/^azurerm_/, '')}`;
}
for (const def of Object.values(PROVEDOR_AZURE.dados)) {
  def.docs = `https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/${def.nome.replace(/^azurerm_/, '')}`;
}
