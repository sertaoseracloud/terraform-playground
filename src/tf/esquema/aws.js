// Provedor AWS (hashicorp/aws, versão 6) no simulador: os recursos usados na trilha.
// Os nomes de argumentos e blocos seguem a documentação oficial do provedor.
// IDs, ARNs e IPs são inventados de forma estável (mesmo endereço → mesmo valor);
// os IPs públicos usam as faixas reservadas para documentação (RFC 5737).
import { tipo, umDosValores, entre, padrao, cidrValido } from './dsl.js';

export const REGIOES_AWS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'sa-east-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-central-1', 'eu-north-1', 'eu-south-1', 'ap-south-1', 'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'af-south-1', 'me-south-1',
];

const nomeBucket = (v) => {
  if (typeof v !== 'string') return null;
  if (v.length < 3 || v.length > 63) return `validating S3 Bucket (${v}) name: length must be between 3 and 63 characters (tem ${v.length})`;
  if (!/^[a-z0-9.-]+$/.test(v)) return `validating S3 Bucket (${v}) name: only lowercase alphanumeric characters, hyphens and periods allowed in "${v}"`;
  if (!/^[a-z0-9]/.test(v) || !/[a-z0-9]$/.test(v)) return `validating S3 Bucket (${v}) name: must begin and end with a letter or number`;
  return null;
};
const protocolo = umDosValores('tcp', 'udp', 'icmp', 'icmpv6', '-1', 'all');
const porta = entre(-1, 65535);

// Nomes de bucket que "já existem" na AWS: o apply falha, como na vida real.
const BUCKETS_OCUPADOS = new Set(['teste', 'test', 'bucket', 'meu-bucket', 'my-bucket', 'site', 'backup', 'logs', 'terraform', 'aws']);

const ip = (u, ch) => u.ip(ch);

export const PROVEDOR_AWS = {
  nome: 'aws',
  fonte: 'hashicorp/aws',
  versoes: ['4.67.0', '5.100.0', '6.14.0'],
  configuracao: tipo('provider aws', {
    args: 'region? profile? access_key?$ secret_key?$ token?$ allowed_account_ids?:set forbidden_account_ids?:set skip_credentials_validation?:bool',
    blocos: {
      default_tags: { max: 1, args: 'tags?:map' },
      assume_role: { max: 1, args: 'role_arn? session_name? external_id?' },
    },
    validar: { region: umDosValores(...REGIOES_AWS) },
  }),
  recursos: {
    // ---------- S3 ----------
    aws_s3_bucket: tipo('aws_s3_bucket', {
      args: 'bucket~^ bucket_prefix?^ force_destroy?:bool=false object_lock_enabled~^:bool tags?:map',
      calc: 'id arn bucket_domain_name bucket_regional_domain_name hosted_zone_id',
      validar: { bucket: nomeBucket },
      validarApi: (v) => (BUCKETS_OCUPADOS.has(v.bucket)
        ? `creating S3 Bucket (${v.bucket}): BucketAlreadyExists: The requested bucket name is not available. O nome de um bucket é único no mundo inteiro: escolha outro.`
        : null),
      gerar: {
        bucket: (v, u) => v.bucket ?? `${v.bucket_prefix ?? 'terraform-'}${u.hex(26)}`,
        id: (v, u, f) => f.bucket,
        arn: (v, u, f) => `arn:aws:s3:::${f.bucket}`,
        bucket_domain_name: (v, u, f) => `${f.bucket}.s3.amazonaws.com`,
        bucket_regional_domain_name: (v, u, f) => `${f.bucket}.s3.${u.regiao}.amazonaws.com`,
        hosted_zone_id: () => 'Z3AQBSTGFYJSTF',
        object_lock_enabled: (v) => v.object_lock_enabled ?? false,
      },
      descricao: 'Bucket do S3: um "disco" de arquivos na nuvem.',
    }),
    aws_s3_bucket_versioning: tipo('aws_s3_bucket_versioning', {
      args: 'bucket!^ expected_bucket_owner?^',
      blocos: { versioning_configuration: { min: 1, max: 1, args: 'status! mfa_delete~' } },
      calc: 'id',
      gerar: { id: (v) => v.bucket },
      validarBlocos: { status: umDosValores('Enabled', 'Suspended', 'Disabled') },
    }),
    aws_s3_bucket_public_access_block: tipo('aws_s3_bucket_public_access_block', {
      args: 'bucket!^ block_public_acls?:bool=false block_public_policy?:bool=false ignore_public_acls?:bool=false restrict_public_buckets?:bool=false',
      calc: 'id',
      gerar: { id: (v) => v.bucket },
    }),
    aws_s3_bucket_ownership_controls: tipo('aws_s3_bucket_ownership_controls', {
      args: 'bucket!^',
      blocos: { rule: { min: 1, max: 1, args: 'object_ownership!' } },
      calc: 'id',
      gerar: { id: (v) => v.bucket },
    }),
    aws_s3_bucket_website_configuration: tipo('aws_s3_bucket_website_configuration', {
      args: 'bucket!^ expected_bucket_owner?^ routing_rules~',
      blocos: {
        index_document: { max: 1, args: 'suffix!' },
        error_document: { max: 1, args: 'key!' },
        redirect_all_requests_to: { max: 1, args: 'host_name! protocol?' },
      },
      calc: 'id website_endpoint website_domain',
      gerar: {
        id: (v) => v.bucket,
        website_endpoint: (v, u) => `${v.bucket}.s3-website-${u.regiao}.amazonaws.com`,
        website_domain: (v, u) => `s3-website-${u.regiao}.amazonaws.com`,
      },
    }),
    aws_s3_bucket_policy: tipo('aws_s3_bucket_policy', {
      args: 'bucket!^ policy!',
      calc: 'id',
      gerar: { id: (v) => v.bucket },
    }),
    aws_s3_bucket_server_side_encryption_configuration: tipo('aws_s3_bucket_server_side_encryption_configuration', {
      args: 'bucket!^ expected_bucket_owner?^',
      blocos: {
        rule: {
          min: 1,
          args: 'bucket_key_enabled?:bool',
          blocos: { apply_server_side_encryption_by_default: { max: 1, args: 'sse_algorithm! kms_master_key_id?' } },
        },
      },
      calc: 'id',
      gerar: { id: (v) => v.bucket },
    }),
    aws_s3_bucket_lifecycle_configuration: tipo('aws_s3_bucket_lifecycle_configuration', {
      args: 'bucket!^ expected_bucket_owner?^',
      blocos: {
        rule: {
          min: 1,
          args: 'id! status!',
          blocos: {
            filter: { max: 1, args: 'prefix? object_size_greater_than?:number object_size_less_than?:number' },
            expiration: { max: 1, args: 'days?:number date? expired_object_delete_marker~:bool' },
            transition: { args: 'days?:number date? storage_class!' },
            noncurrent_version_expiration: { max: 1, args: 'noncurrent_days?:number newer_noncurrent_versions?:number' },
            abort_incomplete_multipart_upload: { max: 1, args: 'days_after_initiation?:number' },
          },
        },
      },
      calc: 'id',
      gerar: { id: (v) => v.bucket },
    }),
    aws_s3_bucket_cors_configuration: tipo('aws_s3_bucket_cors_configuration', {
      args: 'bucket!^',
      blocos: { cors_rule: { min: 1, args: 'allowed_methods!:set allowed_origins!:set allowed_headers?:set expose_headers?:set max_age_seconds?:number id?' } },
      calc: 'id',
      gerar: { id: (v) => v.bucket },
    }),
    aws_s3_object: tipo('aws_s3_object', {
      args: 'bucket!^ key!^ source? content? content_base64? content_type~ etag~ cache_control? acl? storage_class~ server_side_encryption~ force_destroy?:bool=false tags?:map',
      calc: 'id arn version_id',
      gerar: {
        id: (v) => v.key,
        arn: (v) => `arn:aws:s3:::${v.bucket}/${v.key}`,
        etag: (v, u) => v.etag ?? u.hex(32),
        content_type: (v) => v.content_type ?? (/\.html?$/.test(v.key) ? 'text/html' : /\.css$/.test(v.key) ? 'text/css' : /\.js$/.test(v.key) ? 'application/javascript' : 'binary/octet-stream'),
        storage_class: (v) => v.storage_class ?? 'STANDARD',
        server_side_encryption: (v) => v.server_side_encryption ?? 'AES256',
        version_id: () => '',
      },
    }),

    // ---------- rede (VPC) ----------
    aws_vpc: tipo('aws_vpc', {
      args: 'cidr_block~^ instance_tenancy?=default enable_dns_support?:bool=true enable_dns_hostnames~:bool assign_generated_ipv6_cidr_block?:bool=false tags?:map',
      calc: 'id arn default_security_group_id default_route_table_id default_network_acl_id main_route_table_id owner_id dhcp_options_id ipv6_cidr_block',
      validar: { cidr_block: cidrValido, instance_tenancy: umDosValores('default', 'dedicated') },
      prefixo: 'vpc',
      arn: 'ec2:{regiao}:{conta}:vpc/{id}',
      gerar: {
        enable_dns_hostnames: (v) => v.enable_dns_hostnames ?? false,
        default_security_group_id: (v, u) => `sg-${u.hex(17, 'sg')}`,
        default_route_table_id: (v, u) => `rtb-${u.hex(17, 'rtb')}`,
        main_route_table_id: (v, u) => `rtb-${u.hex(17, 'rtb')}`,
        default_network_acl_id: (v, u) => `acl-${u.hex(17, 'acl')}`,
        dhcp_options_id: (v, u) => `dopt-${u.hex(17, 'dopt')}`,
        owner_id: (v, u) => u.conta,
        ipv6_cidr_block: () => '',
      },
      descricao: 'VPC: a sua rede privada dentro da AWS.',
    }),
    aws_subnet: tipo('aws_subnet', {
      args: 'vpc_id!^ cidr_block?^ availability_zone~^ availability_zone_id~^ map_public_ip_on_launch?:bool=false assign_ipv6_address_on_creation?:bool=false tags?:map',
      calc: 'id arn owner_id',
      validar: { cidr_block: cidrValido },
      prefixo: 'subnet',
      arn: 'ec2:{regiao}:{conta}:subnet/{id}',
      gerar: {
        availability_zone: (v, u) => v.availability_zone ?? `${u.regiao}a`,
        availability_zone_id: (v, u) => `${u.regiao.split('-').map((p, i) => (i === 1 ? p[0] : p)).join('')}-az${1 + (parseInt(u.hex(2), 16) % 3)}`,
        owner_id: (v, u) => u.conta,
      },
      descricao: 'Sub-rede: um pedaço da VPC numa zona de disponibilidade.',
    }),
    aws_internet_gateway: tipo('aws_internet_gateway', {
      args: 'vpc_id? tags?:map',
      calc: 'id arn owner_id',
      prefixo: 'igw',
      arn: 'ec2:{regiao}:{conta}:internet-gateway/{id}',
      gerar: { owner_id: (v, u) => u.conta },
    }),
    aws_eip: tipo('aws_eip', {
      args: 'domain~^ instance~ network_interface~ tags?:map',
      calc: 'id arn public_ip private_ip public_dns allocation_id association_id',
      prefixo: 'eipalloc',
      validar: { domain: umDosValores('vpc', 'standard') },
      gerar: {
        domain: (v) => v.domain ?? 'vpc',
        public_ip: (v, u) => ip(u),
        allocation_id: (v, u, f) => f.id,
        public_dns: (v, u, f) => `ec2-${f.public_ip.replaceAll('.', '-')}.compute-1.amazonaws.com`,
        private_ip: () => '',
        association_id: () => '',
      },
    }),
    aws_nat_gateway: tipo('aws_nat_gateway', {
      args: 'subnet_id!^ allocation_id?^ connectivity_type?=public^ private_ip~^ tags?:map',
      calc: 'id public_ip network_interface_id',
      prefixo: 'nat',
      validar: { connectivity_type: umDosValores('public', 'private') },
      gerar: {
        public_ip: (v, u) => ip(u),
        private_ip: (v, u) => u.ipPrivado('10.0.0.0/16'),
        network_interface_id: (v, u) => `eni-${u.hex(17, 'eni')}`,
      },
      descricao: 'NAT Gateway: deixa as sub-redes privadas acessarem a internet sem ficarem expostas.',
    }),
    aws_route_table: tipo('aws_route_table', {
      args: 'vpc_id!^ tags?:map',
      blocos: { route: { args: 'cidr_block? ipv6_cidr_block? gateway_id? nat_gateway_id? network_interface_id? transit_gateway_id? vpc_peering_connection_id?' } },
      calc: 'id arn owner_id',
      prefixo: 'rtb',
      arn: 'ec2:{regiao}:{conta}:route-table/{id}',
      gerar: { owner_id: (v, u) => u.conta },
    }),
    aws_route: tipo('aws_route', {
      args: 'route_table_id!^ destination_cidr_block?^ destination_ipv6_cidr_block?^ gateway_id? nat_gateway_id? network_interface_id? transit_gateway_id? vpc_peering_connection_id?',
      calc: 'id state origin',
      gerar: {
        id: (v, u) => `r-${v.route_table_id}${u.hex(8)}`,
        state: () => 'active',
        origin: () => 'CreateRoute',
      },
    }),
    aws_route_table_association: tipo('aws_route_table_association', {
      args: 'subnet_id?^ gateway_id?^ route_table_id!',
      calc: 'id',
      prefixo: 'rtbassoc',
      umDe: [['subnet_id', 'gateway_id']],
    }),
    aws_security_group: tipo('aws_security_group', {
      args: 'name~^ name_prefix?^ description?=Managed_by_Terraform^ vpc_id~^ revoke_rules_on_delete?:bool=false tags?:map',
      blocos: {
        ingress: { args: 'from_port!:number to_port!:number protocol! cidr_blocks?:list ipv6_cidr_blocks?:list security_groups?:set self?:bool=false description? prefix_list_ids?:list' },
        egress: { args: 'from_port!:number to_port!:number protocol! cidr_blocks?:list ipv6_cidr_blocks?:list security_groups?:set self?:bool=false description? prefix_list_ids?:list' },
      },
      calc: 'id arn owner_id',
      prefixo: 'sg',
      arn: 'ec2:{regiao}:{conta}:security-group/{id}',
      validarBlocos: { from_port: porta, to_port: porta, protocol: protocolo },
      gerar: {
        name: (v, u) => v.name ?? `${v.name_prefix ?? 'terraform-'}${u.hex(26)}`,
        vpc_id: (v, u) => v.vpc_id ?? `vpc-${u.hex(17, 'vpcpadrao')}`,
        owner_id: (v, u) => u.conta,
      },
      descricao: 'Security group: o firewall de uma instância ou banco.',
    }),
    aws_vpc_security_group_ingress_rule: tipo('aws_vpc_security_group_ingress_rule', {
      args: 'security_group_id!^ ip_protocol! from_port?:number to_port?:number cidr_ipv4? cidr_ipv6? referenced_security_group_id? prefix_list_id? description? tags?:map',
      calc: 'id arn security_group_rule_id',
      prefixo: 'sgr',
      validar: { ip_protocol: protocolo, from_port: porta, to_port: porta, cidr_ipv4: cidrValido },
      arn: 'ec2:{regiao}:{conta}:security-group-rule/{id}',
      gerar: { security_group_rule_id: (v, u, f) => f.id },
    }),
    aws_vpc_security_group_egress_rule: tipo('aws_vpc_security_group_egress_rule', {
      args: 'security_group_id!^ ip_protocol! from_port?:number to_port?:number cidr_ipv4? cidr_ipv6? referenced_security_group_id? prefix_list_id? description? tags?:map',
      calc: 'id arn security_group_rule_id',
      prefixo: 'sgr',
      validar: { ip_protocol: protocolo, from_port: porta, to_port: porta, cidr_ipv4: cidrValido },
      arn: 'ec2:{regiao}:{conta}:security-group-rule/{id}',
      gerar: { security_group_rule_id: (v, u, f) => f.id },
    }),
    aws_network_acl: tipo('aws_network_acl', {
      args: 'vpc_id!^ subnet_ids~:set tags?:map',
      blocos: {
        ingress: { args: 'rule_no!:number action! protocol! from_port!:number to_port!:number cidr_block?' },
        egress: { args: 'rule_no!:number action! protocol! from_port!:number to_port!:number cidr_block?' },
      },
      calc: 'id arn owner_id',
      prefixo: 'acl',
      gerar: { owner_id: (v, u) => u.conta },
    }),
    aws_vpc_endpoint: tipo('aws_vpc_endpoint', {
      args: 'vpc_id!^ service_name!^ vpc_endpoint_type?=Gateway^ route_table_ids~:set subnet_ids~:set security_group_ids~:set private_dns_enabled~:bool policy~ tags?:map',
      calc: 'id arn state prefix_list_id',
      prefixo: 'vpce',
      gerar: { state: () => 'available', prefix_list_id: (v, u) => `pl-${u.hex(8)}` },
    }),
    aws_vpc_peering_connection: tipo('aws_vpc_peering_connection', {
      args: 'vpc_id!^ peer_vpc_id!^ peer_owner_id~^ peer_region~^ auto_accept?:bool tags?:map',
      calc: 'id accept_status',
      prefixo: 'pcx',
      gerar: { accept_status: (v) => (v.auto_accept ? 'active' : 'pending-acceptance') },
    }),
    aws_flow_log: tipo('aws_flow_log', {
      args: 'traffic_type! vpc_id?^ subnet_id?^ log_destination~^ log_destination_type?=cloud-watch-logs^ iam_role_arn?^ tags?:map',
      calc: 'id arn',
      prefixo: 'fl',
      validar: { traffic_type: umDosValores('ACCEPT', 'REJECT', 'ALL') },
    }),

    // ---------- EC2 ----------
    aws_key_pair: tipo('aws_key_pair', {
      args: 'key_name~^ key_name_prefix?^ public_key!^ tags?:map',
      calc: 'id arn fingerprint key_pair_id key_type',
      gerar: {
        key_name: (v, u) => v.key_name ?? `${v.key_name_prefix ?? 'terraform-'}${u.hex(26)}`,
        id: (v, u, f) => f.key_name,
        arn: (v, u, f) => `arn:aws:ec2:${u.regiao}:${u.conta}:key-pair/${f.key_name}`,
        fingerprint: (v, u) => u.hex(32).match(/../g).join(':'),
        key_pair_id: (v, u) => `key-${u.hex(17)}`,
        key_type: (v) => (String(v.public_key).startsWith('ssh-ed25519') ? 'ed25519' : 'rsa'),
      },
    }),
    aws_instance: tipo('aws_instance', {
      args: 'ami!^ instance_type! subnet_id~^ vpc_security_group_ids~:set security_groups~:set key_name~^ associate_public_ip_address~^:bool private_ip~^ user_data?^ user_data_base64?^ user_data_replace_on_change?:bool=false iam_instance_profile? availability_zone~^ monitoring~:bool disable_api_termination~:bool ebs_optimized~:bool source_dest_check?:bool=true tags?:map volume_tags?:map',
      blocos: {
        root_block_device: { max: 1, args: 'volume_size~:number volume_type~ encrypted~:bool delete_on_termination?:bool=true iops~:number throughput~:number kms_key_id~', calc: 'device_name volume_id' },
        ebs_block_device: { args: 'device_name!^ volume_size~^:number volume_type~^ encrypted~^:bool delete_on_termination?:bool=true', calc: 'volume_id' },
        metadata_options: { max: 1, args: 'http_endpoint~ http_tokens~ http_put_response_hop_limit~:number instance_metadata_tags~' },
        credit_specification: { max: 1, args: 'cpu_credits~' },
      },
      calc: 'id arn public_ip private_dns public_dns primary_network_interface_id instance_state password_data outpost_arn host_id placement_group cpu_core_count:number',
      prefixo: 'i',
      arn: 'ec2:{regiao}:{conta}:instance/{id}',
      validar: { instance_type: padrao(/^[a-z0-9]+\.[a-z0-9]+$/, 'expected instance_type to be a valid EC2 instance type (ex.: t3.micro), got {valor}') },
      validarApi: (v) => (/^ami-[0-9a-f]{8,17}$/.test(String(v.ami)) ? null
        : `creating EC2 Instance: operation error EC2: RunInstances, api error InvalidAMIID.Malformed: Invalid id: "${v.ami}". Um ID de AMI tem o formato ami-0123456789abcdef0.`),
      gerar: {
        availability_zone: (v, u) => v.availability_zone ?? `${u.regiao}a`,
        subnet_id: (v, u) => v.subnet_id ?? `subnet-${u.hex(17, 'subpadrao')}`,
        private_ip: (v, u) => v.private_ip ?? u.ipPrivado('172.31.0.0/16'),
        public_ip: (v, u) => (v.associate_public_ip_address === false ? '' : ip(u)),
        associate_public_ip_address: (v) => v.associate_public_ip_address ?? true,
        private_dns: (v, u, f) => `ip-${f.private_ip.replaceAll('.', '-')}.ec2.internal`,
        public_dns: (v, u, f) => (f.public_ip ? `ec2-${f.public_ip.replaceAll('.', '-')}.compute-1.amazonaws.com` : ''),
        primary_network_interface_id: (v, u) => `eni-${u.hex(17, 'eni')}`,
        instance_state: () => 'running',
        key_name: (v) => v.key_name ?? '',
        monitoring: (v) => v.monitoring ?? false,
        disable_api_termination: (v) => v.disable_api_termination ?? false,
        ebs_optimized: (v) => v.ebs_optimized ?? false,
        vpc_security_group_ids: (v, u) => v.vpc_security_group_ids ?? [`sg-${u.hex(17, 'sgpadrao')}`],
        security_groups: (v) => v.security_groups ?? [],
        password_data: () => '',
        outpost_arn: () => '',
        host_id: () => '',
        placement_group: () => '',
        cpu_core_count: () => 1,
      },
      descricao: 'Instância EC2: uma máquina virtual na AWS.',
    }),
    aws_ebs_volume: tipo('aws_ebs_volume', {
      args: 'availability_zone!^ size~:number type~ iops~:number throughput~:number encrypted~^:bool kms_key_id~^ snapshot_id~^ tags?:map',
      calc: 'id arn',
      prefixo: 'vol',
      arn: 'ec2:{regiao}:{conta}:volume/{id}',
      gerar: { type: (v) => v.type ?? 'gp3', encrypted: (v) => v.encrypted ?? false, size: (v) => v.size ?? 8 },
    }),
    aws_volume_attachment: tipo('aws_volume_attachment', {
      args: 'device_name!^ instance_id!^ volume_id!^ force_detach?:bool skip_destroy?:bool stop_instance_before_detaching?:bool',
      calc: 'id',
      gerar: { id: (v, u) => `vai-${parseInt(u.hex(8), 16)}` },
    }),
    aws_launch_template: tipo('aws_launch_template', {
      args: 'name~^ name_prefix?^ description? image_id? instance_type? key_name? user_data? vpc_security_group_ids?:set update_default_version?:bool tags?:map',
      blocos: {
        iam_instance_profile: { max: 1, args: 'name? arn?' },
        network_interfaces: { args: 'associate_public_ip_address? security_groups?:set subnet_id? device_index?:number' },
        tag_specifications: { args: 'resource_type? tags?:map' },
        block_device_mappings: { args: 'device_name?', blocos: { ebs: { max: 1, args: 'volume_size?:number volume_type? encrypted? delete_on_termination?' } } },
        metadata_options: { max: 1, args: 'http_endpoint~ http_tokens~' },
      },
      calc: 'id arn latest_version:number default_version:number',
      prefixo: 'lt',
      arn: 'ec2:{regiao}:{conta}:launch-template/{id}',
      gerar: {
        name: (v, u) => v.name ?? `${v.name_prefix ?? 'terraform-'}${u.hex(26)}`,
        latest_version: () => 1,
        default_version: () => 1,
      },
    }),
    aws_autoscaling_group: tipo('aws_autoscaling_group', {
      args: 'name~^ name_prefix?^ min_size!:number max_size!:number desired_capacity~:number vpc_zone_identifier~:set availability_zones~:set target_group_arns~:set health_check_type~ health_check_grace_period?:number=300 launch_configuration? force_delete?:bool termination_policies?:list',
      blocos: {
        launch_template: { max: 1, args: 'id~ name~ version?' },
        tag: { args: 'key! value! propagate_at_launch!:bool' },
        instance_refresh: { max: 1, args: 'strategy!', blocos: { preferences: { max: 1, args: 'min_healthy_percentage?:number' } } },
      },
      calc: 'id arn',
      validar: { health_check_type: umDosValores('EC2', 'ELB') },
      gerar: {
        name: (v, u) => v.name ?? `${v.name_prefix ?? 'terraform-'}${u.hex(26)}`,
        id: (v, u, f) => f.name,
        arn: (v, u, f) => `arn:aws:autoscaling:${u.regiao}:${u.conta}:autoScalingGroup:${u.uuid()}:autoScalingGroupName/${f.name}`,
        desired_capacity: (v) => v.desired_capacity ?? v.min_size,
        health_check_type: (v) => v.health_check_type ?? 'EC2',
      },
    }),
    aws_autoscaling_policy: tipo('aws_autoscaling_policy', {
      args: 'name!^ autoscaling_group_name!^ policy_type?=SimpleScaling adjustment_type? scaling_adjustment?:number cooldown?:number',
      blocos: {
        target_tracking_configuration: {
          max: 1,
          args: 'target_value!:number disable_scale_in?:bool',
          blocos: { predefined_metric_specification: { max: 1, args: 'predefined_metric_type! resource_label?' } },
        },
      },
      calc: 'id arn',
      gerar: { id: (v) => v.name, arn: (v, u) => `arn:aws:autoscaling:${u.regiao}:${u.conta}:scalingPolicy:${u.uuid()}:autoScalingGroupName/${v.autoscaling_group_name}:policyName/${v.name}` },
    }),

    // ---------- balanceamento ----------
    aws_lb: tipo('aws_lb', {
      args: 'name~^ name_prefix?^ internal~^:bool load_balancer_type?=application^ security_groups~:set subnets~:set ip_address_type~ enable_deletion_protection?:bool=false idle_timeout?:number=60 tags?:map',
      blocos: { access_logs: { max: 1, args: 'bucket! prefix? enabled?:bool' } },
      calc: 'id arn arn_suffix dns_name zone_id vpc_id',
      validar: { load_balancer_type: umDosValores('application', 'network', 'gateway') },
      gerar: {
        name: (v, u) => v.name ?? `tf-lb-${u.hex(20)}`,
        internal: (v) => v.internal ?? false,
        ip_address_type: (v) => v.ip_address_type ?? 'ipv4',
        arn_suffix: (v, u, f) => `app/${f.name}/${u.hex(16)}`,
        arn: (v, u, f) => `arn:aws:elasticloadbalancing:${u.regiao}:${u.conta}:loadbalancer/${f.arn_suffix}`,
        id: (v, u, f) => f.arn,
        dns_name: (v, u, f) => `${f.name}-${parseInt(u.hex(8), 16)}.${u.regiao}.elb.amazonaws.com`,
        zone_id: () => 'Z35SXDOTRQ7X7K',
        vpc_id: (v, u) => `vpc-${u.hex(17, 'vpc')}`,
      },
      descricao: 'Load balancer: distribui o tráfego entre várias instâncias.',
    }),
    aws_lb_target_group: tipo('aws_lb_target_group', {
      args: 'name~^ name_prefix?^ port?^:number protocol?^ vpc_id?^ target_type?=instance^ deregistration_delay?:number=300 tags?:map',
      blocos: {
        health_check: { max: 1, args: 'enabled?:bool=true path~ port~ protocol~ matcher~ interval?:number=30 timeout~:number healthy_threshold?:number=3 unhealthy_threshold?:number=3' },
        stickiness: { max: 1, args: 'type! enabled?:bool cookie_duration?:number' },
      },
      calc: 'id arn arn_suffix',
      validar: { target_type: umDosValores('instance', 'ip', 'lambda', 'alb'), protocol: umDosValores('HTTP', 'HTTPS', 'TCP', 'TLS', 'UDP', 'TCP_UDP', 'GENEVE') },
      gerar: {
        name: (v, u) => v.name ?? `tf-${u.hex(26)}`,
        arn_suffix: (v, u, f) => `targetgroup/${f.name}/${u.hex(16)}`,
        arn: (v, u, f) => `arn:aws:elasticloadbalancing:${u.regiao}:${u.conta}:${f.arn_suffix}`,
        id: (v, u, f) => f.arn,
      },
    }),
    aws_lb_listener: tipo('aws_lb_listener', {
      args: 'load_balancer_arn!^ port?:number protocol~ ssl_policy~ certificate_arn? tags?:map',
      blocos: {
        default_action: {
          min: 1,
          args: 'type! target_group_arn? order~:number',
          blocos: {
            fixed_response: { max: 1, args: 'content_type! message_body? status_code~' },
            redirect: { max: 1, args: 'status_code! host? path? port? protocol? query?' },
            forward: { max: 1, blocos: { target_group: { min: 1, args: 'arn! weight?:number' } } },
          },
        },
      },
      calc: 'id arn',
      validar: { protocol: umDosValores('HTTP', 'HTTPS', 'TCP', 'TLS', 'UDP', 'TCP_UDP', 'GENEVE') },
      gerar: {
        protocol: (v) => v.protocol ?? 'HTTP',
        arn: (v, u) => `arn:aws:elasticloadbalancing:${u.regiao}:${u.conta}:listener/app/lb/${u.hex(16)}/${u.hex(16, 'l')}`,
        id: (v, u, f) => f.arn,
        ssl_policy: (v) => v.ssl_policy ?? '',
      },
    }),
    aws_lb_listener_rule: tipo('aws_lb_listener_rule', {
      args: 'listener_arn!^ priority~:number tags?:map',
      blocos: {
        action: { min: 1, args: 'type! target_group_arn?' },
        condition: {
          min: 1,
          blocos: {
            path_pattern: { max: 1, args: 'values!:set' },
            host_header: { max: 1, args: 'values!:set' },
          },
        },
      },
      calc: 'id arn',
      gerar: { arn: (v, u) => `arn:aws:elasticloadbalancing:${u.regiao}:${u.conta}:listener-rule/app/lb/${u.hex(16)}`, id: (v, u, f) => f.arn },
    }),
    aws_lb_target_group_attachment: tipo('aws_lb_target_group_attachment', {
      args: 'target_group_arn!^ target_id!^ port?^:number availability_zone?^',
      calc: 'id',
      gerar: { id: (v, u) => `${v.target_group_arn}-${u.hex(20)}` },
    }),

    // ---------- bancos de dados ----------
    aws_db_subnet_group: tipo('aws_db_subnet_group', {
      args: 'name~^ name_prefix?^ description?=Managed_by_Terraform subnet_ids!:set tags?:map',
      calc: 'id arn vpc_id',
      gerar: {
        name: (v, u) => v.name ?? `terraform-${u.hex(26)}`,
        id: (v, u, f) => f.name,
        arn: (v, u, f) => `arn:aws:rds:${u.regiao}:${u.conta}:subgrp:${f.name}`,
        vpc_id: (v, u) => `vpc-${u.hex(17, 'vpc')}`,
      },
    }),
    aws_db_instance: tipo('aws_db_instance', {
      args: 'identifier~^ identifier_prefix?^ engine~^ engine_version~ instance_class! allocated_storage~:number max_allocated_storage?:number storage_type~ storage_encrypted~^:bool kms_key_id~^ db_name~^ username~^ password?$ manage_master_user_password?:bool port~:number db_subnet_group_name~^ vpc_security_group_ids~:set parameter_group_name~ publicly_accessible?:bool=false multi_az~:bool skip_final_snapshot?:bool=false final_snapshot_identifier? backup_retention_period~:number deletion_protection?:bool apply_immediately?:bool auto_minor_version_upgrade?:bool=true availability_zone~^ tags?:map',
      calc: 'id arn address endpoint hosted_zone_id resource_id status',
      validar: { engine: umDosValores('mysql', 'postgres', 'mariadb', 'oracle-se2', 'sqlserver-ex', 'sqlserver-web', 'sqlserver-se', 'sqlserver-ee') },
      validarApi: (v) => {
        if (!v.engine && !v.snapshot_identifier) return 'creating RDS DB Instance: InvalidParameterValue: engine é obrigatório para criar um banco do zero.';
        if (v.password && String(v.password).length < 8) return 'creating RDS DB Instance: InvalidParameterValue: The parameter MasterUserPassword is not a valid password because it is shorter than 8 characters.';
        if (!v.skip_final_snapshot && !v.final_snapshot_identifier) return null;
        return null;
      },
      gerar: {
        identifier: (v, u) => v.identifier ?? `${v.identifier_prefix ?? 'terraform-'}${u.hex(26)}`,
        id: (v, u) => `db-${u.hex(26).toUpperCase()}`,
        resource_id: (v, u, f) => f.id,
        arn: (v, u, f) => `arn:aws:rds:${u.regiao}:${u.conta}:db:${f.identifier}`,
        engine_version: (v) => v.engine_version ?? ({ mysql: '8.0.39', postgres: '16.4', mariadb: '10.11.9' }[v.engine] ?? '1.0'),
        port: (v) => v.port ?? ({ mysql: 3306, mariadb: 3306, postgres: 5432 }[v.engine] ?? 1433),
        address: (v, u, f) => `${f.identifier}.${u.hex(12)}.${u.regiao}.rds.amazonaws.com`,
        endpoint: (v, u, f) => `${f.address}:${f.port}`,
        allocated_storage: (v) => v.allocated_storage ?? 20,
        storage_type: (v) => v.storage_type ?? 'gp2',
        storage_encrypted: (v) => v.storage_encrypted ?? false,
        multi_az: (v) => v.multi_az ?? false,
        backup_retention_period: (v) => v.backup_retention_period ?? 0,
        hosted_zone_id: () => 'Z2R2ITUGPM61AM',
        status: () => 'available',
        username: (v) => v.username ?? 'admin',
        db_name: (v) => v.db_name ?? '',
      },
      descricao: 'Banco de dados relacional gerenciado (MySQL, PostgreSQL...).',
    }),
    aws_dynamodb_table: tipo('aws_dynamodb_table', {
      args: 'name!^ billing_mode?=PROVISIONED hash_key~^ range_key?^ read_capacity~:number write_capacity~:number stream_enabled?:bool stream_view_type~ table_class~ deletion_protection_enabled?:bool tags?:map',
      blocos: {
        attribute: { args: 'name! type!' },
        ttl: { max: 1, args: 'attribute_name? enabled?:bool' },
        point_in_time_recovery: { max: 1, args: 'enabled!:bool' },
        server_side_encryption: { max: 1, args: 'enabled!:bool kms_key_arn~' },
        global_secondary_index: { args: 'name! hash_key! range_key? projection_type! non_key_attributes?:set read_capacity?:number write_capacity?:number' },
      },
      calc: 'id arn stream_arn stream_label',
      validar: { billing_mode: umDosValores('PROVISIONED', 'PAY_PER_REQUEST') },
      validarBlocos: { type: umDosValores('S', 'N', 'B') },
      gerar: {
        id: (v) => v.name,
        arn: (v, u) => `arn:aws:dynamodb:${u.regiao}:${u.conta}:table/${v.name}`,
        stream_arn: (v, u) => (v.stream_enabled ? `arn:aws:dynamodb:${u.regiao}:${u.conta}:table/${v.name}/stream/2026-01-01T00:00:00.000` : ''),
        stream_label: (v) => (v.stream_enabled ? '2026-01-01T00:00:00.000' : ''),
        read_capacity: (v) => v.read_capacity ?? 0,
        write_capacity: (v) => v.write_capacity ?? 0,
        table_class: (v) => v.table_class ?? 'STANDARD',
        stream_view_type: (v) => v.stream_view_type ?? '',
      },
      descricao: 'Tabela do DynamoDB: banco NoSQL chave-valor.',
    }),
    aws_elasticache_cluster: tipo('aws_elasticache_cluster', {
      args: 'cluster_id!^ engine~^ node_type~ num_cache_nodes~:number parameter_group_name~ port~:number subnet_group_name~^ security_group_ids~:set tags?:map',
      calc: 'arn cache_nodes:list cluster_address configuration_endpoint',
      gerar: {
        id: (v) => v.cluster_id,
        arn: (v, u) => `arn:aws:elasticache:${u.regiao}:${u.conta}:cluster:${v.cluster_id}`,
        cluster_address: (v, u) => `${v.cluster_id}.${u.hex(6)}.cfg.use1.cache.amazonaws.com`,
        configuration_endpoint: (v, u, f) => `${f.cluster_address}:${v.port ?? 6379}`,
        cache_nodes: () => [],
        port: (v) => v.port ?? 6379,
      },
    }),

    // ---------- IAM ----------
    aws_iam_role: tipo('aws_iam_role', {
      args: 'name~^ name_prefix?^ assume_role_policy! description? path?=/^ max_session_duration?:number=3600 force_detach_policies?:bool=false managed_policy_arns~:set permissions_boundary? tags?:map',
      blocos: { inline_policy: { args: 'name? policy?' } },
      calc: 'id arn unique_id create_date',
      global: true,
      gerar: {
        name: (v, u) => v.name ?? `${v.name_prefix ?? 'terraform-'}${u.hex(26)}`,
        id: (v, u, f) => f.name,
        arn: (v, u, f) => `arn:aws:iam::${u.conta}:role${v.path ?? '/'}${f.name}`,
        unique_id: (v, u) => `AROA${u.hex(17).toUpperCase()}`,
        create_date: () => '2026-01-01T00:00:00Z',
        managed_policy_arns: () => [],
      },
      descricao: 'Papel (role) do IAM: um conjunto de permissões que serviços ou pessoas podem assumir.',
    }),
    aws_iam_policy: tipo('aws_iam_policy', {
      args: 'name~^ name_prefix?^ description?^ path?=/^ policy! tags?:map',
      calc: 'id arn policy_id attachment_count:number',
      global: true,
      gerar: {
        name: (v, u) => v.name ?? `terraform-${u.hex(26)}`,
        arn: (v, u, f) => `arn:aws:iam::${u.conta}:policy${v.path ?? '/'}${f.name}`,
        id: (v, u, f) => f.arn,
        policy_id: (v, u) => `ANPA${u.hex(17).toUpperCase()}`,
        attachment_count: () => 0,
      },
    }),
    aws_iam_role_policy_attachment: tipo('aws_iam_role_policy_attachment', {
      args: 'role!^ policy_arn!^',
      calc: 'id',
      global: true,
      gerar: { id: (v, u) => `${v.role}-${u.hex(26)}` },
    }),
    aws_iam_role_policy: tipo('aws_iam_role_policy', {
      args: 'name~^ name_prefix?^ role!^ policy!',
      calc: 'id',
      global: true,
      gerar: { name: (v, u) => v.name ?? `terraform-${u.hex(26)}`, id: (v, u, f) => `${v.role}:${f.name}` },
    }),
    aws_iam_instance_profile: tipo('aws_iam_instance_profile', {
      args: 'name~^ name_prefix?^ path?=/^ role? tags?:map',
      calc: 'id arn unique_id create_date',
      global: true,
      gerar: {
        name: (v, u) => v.name ?? `terraform-${u.hex(26)}`,
        id: (v, u, f) => f.name,
        arn: (v, u, f) => `arn:aws:iam::${u.conta}:instance-profile/${f.name}`,
        unique_id: (v, u) => `AIPA${u.hex(17).toUpperCase()}`,
        create_date: () => '2026-01-01T00:00:00Z',
      },
    }),
    aws_iam_user: tipo('aws_iam_user', {
      args: 'name! path?=/ force_destroy?:bool=false permissions_boundary? tags?:map',
      calc: 'id arn unique_id',
      global: true,
      validar: { name: padrao(/^[\w+=,.@-]{1,64}$/, 'invalid value for name ({valor}): must only contain alphanumeric characters, hyphens, underscores, commas, periods, @ symbols, plus and equals signs') },
      gerar: {
        id: (v) => v.name,
        arn: (v, u) => `arn:aws:iam::${u.conta}:user${v.path ?? '/'}${v.name}`,
        unique_id: (v, u) => `AIDA${u.hex(17).toUpperCase()}`,
      },
    }),
    aws_iam_group: tipo('aws_iam_group', {
      args: 'name! path?=/',
      calc: 'id arn unique_id',
      global: true,
      gerar: {
        id: (v) => v.name,
        arn: (v, u) => `arn:aws:iam::${u.conta}:group${v.path ?? '/'}${v.name}`,
        unique_id: (v, u) => `AGPA${u.hex(17).toUpperCase()}`,
      },
    }),
    aws_iam_user_group_membership: tipo('aws_iam_user_group_membership', {
      args: 'user!^ groups!:set',
      calc: 'id',
      global: true,
      gerar: { id: (v, u) => `terraform-${u.hex(26)}` },
    }),
    aws_iam_group_policy_attachment: tipo('aws_iam_group_policy_attachment', {
      args: 'group!^ policy_arn!^',
      calc: 'id',
      global: true,
      gerar: { id: (v, u) => `${v.group}-${u.hex(26)}` },
    }),
    aws_iam_user_policy_attachment: tipo('aws_iam_user_policy_attachment', {
      args: 'user!^ policy_arn!^',
      calc: 'id',
      global: true,
      gerar: { id: (v, u) => `${v.user}-${u.hex(26)}` },
    }),
    aws_iam_openid_connect_provider: tipo('aws_iam_openid_connect_provider', {
      args: 'url!^ client_id_list!:set thumbprint_list~:list tags?:map',
      calc: 'id arn',
      global: true,
      gerar: {
        arn: (v, u) => `arn:aws:iam::${u.conta}:oidc-provider/${String(v.url).replace(/^https:\/\//, '')}`,
        id: (v, u, f) => f.arn,
        thumbprint_list: (v) => v.thumbprint_list ?? [],
      },
    }),

    // ---------- Lambda e API Gateway ----------
    aws_lambda_function: tipo('aws_lambda_function', {
      args: 'function_name!^ role! handler? runtime? filename? s3_bucket? s3_key? image_uri? package_type?=Zip^ source_code_hash~ memory_size?:number=128 timeout?:number=3 description? publish?:bool=false architectures~:list layers?:list reserved_concurrent_executions?:number=-1 tags?:map',
      blocos: {
        environment: { max: 1, args: 'variables?:map' },
        vpc_config: { max: 1, args: 'subnet_ids!:set security_group_ids!:set', calc: 'vpc_id' },
        dead_letter_config: { max: 1, args: 'target_arn!' },
        tracing_config: { max: 1, args: 'mode!' },
      },
      calc: 'id arn invoke_arn qualified_arn qualified_invoke_arn version last_modified source_code_size:number',
      validar: {
        runtime: umDosValores('nodejs20.x', 'nodejs22.x', 'python3.11', 'python3.12', 'python3.13', 'java21', 'dotnet8', 'ruby3.3', 'provided.al2023'),
        memory_size: entre(128, 10240),
        timeout: entre(1, 900),
      },
      gerar: {
        id: (v) => v.function_name,
        arn: (v, u) => `arn:aws:lambda:${u.regiao}:${u.conta}:function:${v.function_name}`,
        invoke_arn: (v, u, f) => `arn:aws:apigateway:${u.regiao}:lambda:path/2015-03-31/functions/${f.arn}/invocations`,
        version: () => '$LATEST',
        qualified_arn: (v, u, f) => `${f.arn}:$LATEST`,
        qualified_invoke_arn: (v, u, f) => `arn:aws:apigateway:${u.regiao}:lambda:path/2015-03-31/functions/${f.qualified_arn}/invocations`,
        last_modified: () => '2026-01-01T00:00:00.000+0000',
        source_code_hash: (v, u) => v.source_code_hash ?? u.b64(44),
        source_code_size: (v, u) => 300 + (parseInt(u.hex(4), 16) % 2000),
        architectures: (v) => v.architectures ?? ['x86_64'],
      },
      descricao: 'Função Lambda: código que roda sem servidor, só quando é chamado.',
    }),
    aws_lambda_permission: tipo('aws_lambda_permission', {
      args: 'action!^ function_name!^ principal!^ source_arn?^ source_account?^ statement_id~^ statement_id_prefix?^ qualifier?^',
      calc: 'id',
      gerar: { statement_id: (v, u) => v.statement_id ?? `terraform-${u.hex(26)}`, id: (v, u, f) => f.statement_id },
    }),
    aws_lambda_function_url: tipo('aws_lambda_function_url', {
      args: 'function_name!^ authorization_type! qualifier?^',
      blocos: { cors: { max: 1, args: 'allow_origins?:set allow_methods?:set allow_headers?:set max_age?:number' } },
      calc: 'id function_arn function_url url_id',
      validar: { authorization_type: umDosValores('NONE', 'AWS_IAM') },
      gerar: {
        id: (v) => v.function_name,
        function_arn: (v, u) => `arn:aws:lambda:${u.regiao}:${u.conta}:function:${v.function_name}`,
        url_id: (v, u) => u.hex(32),
        function_url: (v, u, f) => `https://${f.url_id}.lambda-url.${u.regiao}.on.aws/`,
      },
    }),
    aws_apigatewayv2_api: tipo('aws_apigatewayv2_api', {
      args: 'name! protocol_type!^ description? route_selection_expression? target? tags?:map',
      blocos: { cors_configuration: { max: 1, args: 'allow_origins?:set allow_methods?:set allow_headers?:set max_age?:number' } },
      calc: 'id arn api_endpoint execution_arn',
      validar: { protocol_type: umDosValores('HTTP', 'WEBSOCKET') },
      gerar: {
        id: (v, u) => u.hex(10).toLowerCase(),
        arn: (v, u, f) => `arn:aws:apigateway:${u.regiao}::/apis/${f.id}`,
        api_endpoint: (v, u, f) => `https://${f.id}.execute-api.${u.regiao}.amazonaws.com`,
        execution_arn: (v, u, f) => `arn:aws:execute-api:${u.regiao}:${u.conta}:${f.id}`,
      },
      descricao: 'API HTTP do API Gateway: a porta de entrada da sua API.',
    }),
    aws_apigatewayv2_integration: tipo('aws_apigatewayv2_integration', {
      args: 'api_id!^ integration_type!^ integration_uri? integration_method? payload_format_version?=1.0 connection_type?=INTERNET description? timeout_milliseconds~:number',
      calc: 'id',
      validar: { integration_type: umDosValores('AWS', 'AWS_PROXY', 'HTTP', 'HTTP_PROXY', 'MOCK'), payload_format_version: umDosValores('1.0', '2.0') },
      gerar: { id: (v, u) => u.hex(7).toLowerCase(), timeout_milliseconds: (v) => v.timeout_milliseconds ?? 30000 },
    }),
    aws_apigatewayv2_route: tipo('aws_apigatewayv2_route', {
      args: 'api_id!^ route_key! target? authorization_type?=NONE authorizer_id?',
      calc: 'id',
      validar: { route_key: padrao(/^(\$default|(ANY|GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/.*)$/, 'route_key ({valor}) must be "$default" or a method followed by a path, like "GET /items"') },
      gerar: { id: (v, u) => u.hex(7).toLowerCase() },
    }),
    aws_apigatewayv2_stage: tipo('aws_apigatewayv2_stage', {
      args: 'api_id!^ name!^ auto_deploy?:bool deployment_id~ description? tags?:map',
      blocos: { access_log_settings: { max: 1, args: 'destination_arn! format!' } },
      calc: 'id arn invoke_url execution_arn',
      gerar: {
        id: (v) => v.name,
        arn: (v, u) => `arn:aws:apigateway:${u.regiao}::/apis/${v.api_id}/stages/${v.name}`,
        invoke_url: (v, u) => `https://${v.api_id}.execute-api.${u.regiao}.amazonaws.com/${v.name === '$default' ? '' : v.name}`,
        execution_arn: (v, u) => `arn:aws:execute-api:${u.regiao}:${u.conta}:${v.api_id}/${v.name}`,
        deployment_id: (v, u) => v.deployment_id ?? u.hex(6).toLowerCase(),
      },
    }),

    // ---------- CloudFront, Route 53 e ACM ----------
    aws_cloudfront_origin_access_control: tipo('aws_cloudfront_origin_access_control', {
      args: 'name! description?=Managed_by_Terraform origin_access_control_origin_type! signing_behavior! signing_protocol!',
      calc: 'id etag arn',
      global: true,
      validar: {
        origin_access_control_origin_type: umDosValores('s3', 'lambda', 'mediastore', 'mediapackagev2'),
        signing_behavior: umDosValores('always', 'never', 'no-override'),
        signing_protocol: umDosValores('sigv4'),
      },
      gerar: { id: (v, u) => `E${u.hex(13).toUpperCase()}`, etag: (v, u) => `E${u.hex(12).toUpperCase()}`, arn: (v, u, f) => `arn:aws:cloudfront::${u.conta}:origin-access-control/${f.id}` },
    }),
    aws_cloudfront_distribution: tipo('aws_cloudfront_distribution', {
      args: 'enabled!:bool comment? default_root_object? aliases?:set price_class?=PriceClass_All is_ipv6_enabled?:bool http_version?=http2 web_acl_id? wait_for_deployment?:bool=true retain_on_delete?:bool=false tags?:map',
      blocos: {
        origin: {
          min: 1,
          args: 'domain_name! origin_id! origin_path? origin_access_control_id? connection_attempts?:number=3 connection_timeout?:number=10',
          blocos: {
            s3_origin_config: { max: 1, args: 'origin_access_identity!' },
            custom_origin_config: { max: 1, args: 'http_port!:number https_port!:number origin_protocol_policy! origin_ssl_protocols!:set' },
          },
        },
        default_cache_behavior: {
          min: 1,
          max: 1,
          args: 'allowed_methods!:set cached_methods!:set target_origin_id! viewer_protocol_policy! cache_policy_id? origin_request_policy_id? compress?:bool=false min_ttl?:number=0 default_ttl~:number max_ttl~:number',
          blocos: {
            forwarded_values: { max: 1, args: 'query_string!:bool headers?:set', blocos: { cookies: { min: 1, max: 1, args: 'forward! whitelisted_names?:set' } } },
          },
        },
        ordered_cache_behavior: { args: 'path_pattern! allowed_methods!:set cached_methods!:set target_origin_id! viewer_protocol_policy! cache_policy_id?' },
        restrictions: { min: 1, max: 1, blocos: { geo_restriction: { min: 1, max: 1, args: 'restriction_type! locations~:set' } } },
        viewer_certificate: { min: 1, max: 1, args: 'cloudfront_default_certificate?:bool acm_certificate_arn? ssl_support_method? minimum_protocol_version?=TLSv1' },
        custom_error_response: { args: 'error_code!:number response_code?:number response_page_path? error_caching_min_ttl?:number' },
      },
      calc: 'id arn caller_reference domain_name etag hosted_zone_id status in_progress_validation_batches:number last_modified_time',
      global: true,
      validar: { price_class: umDosValores('PriceClass_All', 'PriceClass_200', 'PriceClass_100') },
      validarBlocos: { viewer_protocol_policy: umDosValores('allow-all', 'https-only', 'redirect-to-https') },
      gerar: {
        id: (v, u) => `E${u.hex(13).toUpperCase()}`,
        arn: (v, u, f) => `arn:aws:cloudfront::${u.conta}:distribution/${f.id}`,
        caller_reference: (v, u) => `terraform-${u.hex(20)}`,
        domain_name: (v, u) => `d${u.hex(13).toLowerCase()}.cloudfront.net`,
        etag: (v, u) => `E${u.hex(12).toUpperCase()}`,
        hosted_zone_id: () => 'Z2FDTNDATAQYW2',
        status: () => 'Deployed',
        in_progress_validation_batches: () => 0,
        last_modified_time: () => '2026-01-01 00:00:00 +0000 UTC',
      },
      descricao: 'Distribuição do CloudFront: CDN que entrega o seu site rápido no mundo todo.',
    }),
    aws_route53_zone: tipo('aws_route53_zone', {
      args: 'name!^ comment?=Managed_by_Terraform force_destroy?:bool delegation_set_id?^ tags?:map',
      blocos: { vpc: { args: 'vpc_id! vpc_region~' } },
      calc: 'id arn zone_id name_servers:list primary_name_server',
      global: true,
      gerar: {
        zone_id: (v, u) => `Z${u.hex(20).toUpperCase()}`,
        id: (v, u, f) => f.zone_id,
        arn: (v, u, f) => `arn:aws:route53:::hostedzone/${f.zone_id}`,
        name_servers: (v, u) => [`ns-${parseInt(u.hex(3), 16) % 2000}.awsdns-01.com`, `ns-${parseInt(u.hex(3, 'b'), 16) % 2000}.awsdns-02.net`, `ns-${parseInt(u.hex(3, 'c'), 16) % 2000}.awsdns-03.org`, `ns-${parseInt(u.hex(3, 'd'), 16) % 2000}.awsdns-04.co.uk`],
        primary_name_server: (v, u, f) => f.name_servers[0],
      },
    }),
    aws_route53_record: tipo('aws_route53_record', {
      args: 'zone_id!^ name!^ type! ttl?:number records?:set set_identifier? allow_overwrite~:bool health_check_id?',
      blocos: {
        alias: { max: 1, args: 'name! zone_id! evaluate_target_health!:bool' },
        weighted_routing_policy: { max: 1, args: 'weight!:number' },
      },
      calc: 'id fqdn',
      global: true,
      validar: { type: umDosValores('A', 'AAAA', 'CAA', 'CNAME', 'DS', 'MX', 'NAPTR', 'NS', 'PTR', 'SOA', 'SPF', 'SRV', 'TXT') },
      gerar: {
        fqdn: (v) => v.name,
        id: (v) => `${v.zone_id}_${v.name}_${v.type}`,
        allow_overwrite: (v) => v.allow_overwrite ?? false,
      },
    }),
    aws_acm_certificate: tipo('aws_acm_certificate', {
      args: 'domain_name~^ subject_alternative_names~:set validation_method~ key_algorithm~^ private_key?$ certificate_body? tags?:map',
      calc: 'id arn status domain_validation_options:set not_after not_before type',
      validar: { validation_method: umDosValores('DNS', 'EMAIL', 'NONE') },
      gerar: {
        arn: (v, u) => `arn:aws:acm:${u.regiao}:${u.conta}:certificate/${u.uuid()}`,
        id: (v, u, f) => f.arn,
        status: () => 'PENDING_VALIDATION',
        type: () => 'AMAZON_ISSUED',
        key_algorithm: (v) => v.key_algorithm ?? 'RSA_2048',
        subject_alternative_names: (v) => v.subject_alternative_names ?? [v.domain_name],
        domain_validation_options: (v, u) => [v.domain_name, ...(v.subject_alternative_names ?? [])].filter((d, i, a) => a.indexOf(d) === i).map((d) => ({
          domain_name: d,
          resource_record_name: `_${u.hex(32, d)}.${d}.`,
          resource_record_type: 'CNAME',
          resource_record_value: `_${u.hex(32, `v${d}`)}.acm-validations.aws.`,
        })),
        not_after: () => '',
        not_before: () => '',
      },
    }),
    aws_acm_certificate_validation: tipo('aws_acm_certificate_validation', {
      args: 'certificate_arn!^ validation_record_fqdns?:set^',
      calc: 'id',
      gerar: { id: () => '2026-01-01 00:00:00 +0000 UTC' },
    }),

    // ---------- monitoramento e mensagens ----------
    aws_cloudwatch_log_group: tipo('aws_cloudwatch_log_group', {
      args: 'name~^ name_prefix?^ retention_in_days?:number=0 kms_key_id? skip_destroy?:bool=false log_group_class~ tags?:map',
      calc: 'id arn',
      validar: { retention_in_days: (v, n) => ([0, 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653].includes(v) ? null : `expected ${n} to be one of [0 1 3 5 7 14 30 60 90 120 150 180 365 400 545 731 1096 1827 2192 2557 2922 3288 3653], got ${v}`) },
      gerar: {
        name: (v, u) => v.name ?? `terraform-${u.hex(26)}`,
        id: (v, u, f) => f.name,
        arn: (v, u, f) => `arn:aws:logs:${u.regiao}:${u.conta}:log-group:${f.name}`,
        log_group_class: (v) => v.log_group_class ?? 'STANDARD',
      },
    }),
    aws_cloudwatch_metric_alarm: tipo('aws_cloudwatch_metric_alarm', {
      args: 'alarm_name!^ comparison_operator! evaluation_periods!:number metric_name? namespace? period?:number statistic? threshold?:number alarm_description? alarm_actions?:set ok_actions?:set insufficient_data_actions?:set dimensions?:map treat_missing_data?=missing datapoints_to_alarm?:number actions_enabled?:bool=true unit? tags?:map',
      calc: 'id arn',
      validar: {
        comparison_operator: umDosValores('GreaterThanOrEqualToThreshold', 'GreaterThanThreshold', 'LessThanThreshold', 'LessThanOrEqualToThreshold', 'LessThanLowerOrGreaterThanUpperThreshold', 'LessThanLowerThreshold', 'GreaterThanUpperThreshold'),
        statistic: umDosValores('SampleCount', 'Average', 'Sum', 'Minimum', 'Maximum'),
      },
      gerar: { id: (v) => v.alarm_name, arn: (v, u) => `arn:aws:cloudwatch:${u.regiao}:${u.conta}:alarm:${v.alarm_name}` },
    }),
    aws_cloudwatch_dashboard: tipo('aws_cloudwatch_dashboard', {
      args: 'dashboard_name!^ dashboard_body!',
      calc: 'id dashboard_arn',
      gerar: { id: (v) => v.dashboard_name, dashboard_arn: (v, u) => `arn:aws:cloudwatch::${u.conta}:dashboard/${v.dashboard_name}` },
    }),
    aws_cloudwatch_event_rule: tipo('aws_cloudwatch_event_rule', {
      args: 'name~^ name_prefix?^ schedule_expression? event_pattern? description? state?=ENABLED event_bus_name?=default^ tags?:map',
      calc: 'id arn',
      gerar: { name: (v, u) => v.name ?? `terraform-${u.hex(26)}`, id: (v, u, f) => f.name, arn: (v, u, f) => `arn:aws:events:${u.regiao}:${u.conta}:rule/${f.name}` },
    }),
    aws_cloudwatch_event_target: tipo('aws_cloudwatch_event_target', {
      args: 'rule!^ arn! target_id~^ input? role_arn? event_bus_name?=default^',
      calc: 'id',
      gerar: { target_id: (v, u) => v.target_id ?? `terraform-${u.hex(26)}`, id: (v, u, f) => `${v.rule}-${f.target_id}` },
    }),
    aws_sns_topic: tipo('aws_sns_topic', {
      args: 'name~^ name_prefix?^ display_name? fifo_topic?^:bool=false kms_master_key_id? policy~ tags?:map',
      calc: 'id arn owner',
      gerar: {
        name: (v, u) => v.name ?? `terraform-${u.hex(26)}`,
        arn: (v, u, f) => `arn:aws:sns:${u.regiao}:${u.conta}:${f.name}`,
        id: (v, u, f) => f.arn,
        owner: (v, u) => u.conta,
        policy: (v) => v.policy ?? '',
      },
    }),
    aws_sns_topic_subscription: tipo('aws_sns_topic_subscription', {
      args: 'topic_arn!^ protocol!^ endpoint!^ raw_message_delivery?:bool=false filter_policy?',
      calc: 'id arn pending_confirmation:bool',
      validar: { protocol: umDosValores('application', 'email', 'email-json', 'firehose', 'http', 'https', 'lambda', 'sms', 'sqs') },
      gerar: {
        arn: (v, u) => `${v.topic_arn}:${u.uuid()}`,
        id: (v, u, f) => f.arn,
        pending_confirmation: (v) => String(v.protocol).startsWith('email'),
      },
    }),
    aws_sqs_queue: tipo('aws_sqs_queue', {
      args: 'name~^ name_prefix?^ delay_seconds?:number=0 max_message_size?:number=262144 message_retention_seconds?:number=345600 receive_wait_time_seconds?:number=0 visibility_timeout_seconds?:number=30 fifo_queue?:bool=false^ content_based_deduplication?:bool=false redrive_policy~ policy~ sqs_managed_sse_enabled~:bool tags?:map',
      calc: 'id arn url',
      validar: { message_retention_seconds: entre(60, 1209600), visibility_timeout_seconds: entre(0, 43200), delay_seconds: entre(0, 900) },
      gerar: {
        name: (v, u) => v.name ?? `terraform-${u.hex(26)}${v.fifo_queue ? '.fifo' : ''}`,
        url: (v, u, f) => `https://sqs.${u.regiao}.amazonaws.com/${u.conta}/${f.name}`,
        id: (v, u, f) => f.url,
        arn: (v, u, f) => `arn:aws:sqs:${u.regiao}:${u.conta}:${f.name}`,
        redrive_policy: (v) => v.redrive_policy ?? '',
        policy: (v) => v.policy ?? '',
        sqs_managed_sse_enabled: (v) => v.sqs_managed_sse_enabled ?? true,
      },
    }),
    aws_sqs_queue_policy: tipo('aws_sqs_queue_policy', {
      args: 'queue_url!^ policy!',
      calc: 'id',
      gerar: { id: (v) => v.queue_url },
    }),
    aws_lambda_event_source_mapping: tipo('aws_lambda_event_source_mapping', {
      args: 'function_name! event_source_arn?^ batch_size~:number enabled?:bool=true starting_position?^',
      calc: 'id uuid function_arn state',
      gerar: { uuid: (v, u) => u.uuid(), id: (v, u, f) => f.uuid, function_arn: (v, u) => `arn:aws:lambda:${u.regiao}:${u.conta}:function:${v.function_name}`, state: () => 'Enabled', batch_size: (v) => v.batch_size ?? 10 },
    }),

    // ---------- contêineres ----------
    aws_ecr_repository: tipo('aws_ecr_repository', {
      args: 'name!^ image_tag_mutability?=MUTABLE force_delete?:bool tags?:map',
      blocos: {
        image_scanning_configuration: { max: 1, args: 'scan_on_push!:bool' },
        encryption_configuration: { args: 'encryption_type?=AES256^ kms_key~^' },
      },
      calc: 'id arn registry_id repository_url',
      validar: { image_tag_mutability: umDosValores('MUTABLE', 'IMMUTABLE') },
      gerar: {
        id: (v) => v.name,
        arn: (v, u) => `arn:aws:ecr:${u.regiao}:${u.conta}:repository/${v.name}`,
        registry_id: (v, u) => u.conta,
        repository_url: (v, u) => `${u.conta}.dkr.ecr.${u.regiao}.amazonaws.com/${v.name}`,
      },
    }),
    aws_ecs_cluster: tipo('aws_ecs_cluster', {
      args: 'name!^ tags?:map',
      blocos: { setting: { args: 'name! value!' } },
      calc: 'id arn',
      gerar: { arn: (v, u) => `arn:aws:ecs:${u.regiao}:${u.conta}:cluster/${v.name}`, id: (v, u, f) => f.arn },
    }),
    aws_ecs_task_definition: tipo('aws_ecs_task_definition', {
      args: 'family!^ container_definitions!^ requires_compatibilities?:set^ network_mode~^ cpu?^ memory?^ execution_role_arn?^ task_role_arn?^ skip_destroy?:bool tags?:map',
      blocos: { runtime_platform: { max: 1, args: 'operating_system_family? cpu_architecture?' } },
      calc: 'id arn arn_without_revision revision:number',
      validar: { network_mode: umDosValores('bridge', 'host', 'awsvpc', 'none') },
      gerar: {
        revision: () => 1,
        arn_without_revision: (v, u) => `arn:aws:ecs:${u.regiao}:${u.conta}:task-definition/${v.family}`,
        arn: (v, u, f) => `${f.arn_without_revision}:1`,
        id: (v) => v.family,
        network_mode: (v) => v.network_mode ?? 'bridge',
      },
    }),
    aws_ecs_service: tipo('aws_ecs_service', {
      args: 'name!^ cluster~^ task_definition? desired_count?:number=0 launch_type~^ platform_version~ health_check_grace_period_seconds?:number force_new_deployment?:bool wait_for_steady_state?:bool=false enable_execute_command?:bool tags?:map',
      blocos: {
        network_configuration: { max: 1, args: 'subnets!:set security_groups?:set assign_public_ip?:bool=false' },
        load_balancer: { args: 'target_group_arn? container_name! container_port!:number elb_name?' },
        deployment_circuit_breaker: { max: 1, args: 'enable!:bool rollback!:bool' },
      },
      calc: 'id',
      validar: { launch_type: umDosValores('EC2', 'FARGATE', 'EXTERNAL') },
      gerar: {
        id: (v, u) => `arn:aws:ecs:${u.regiao}:${u.conta}:service/${v.name}`,
        cluster: (v, u) => v.cluster ?? `arn:aws:ecs:${u.regiao}:${u.conta}:cluster/default`,
        launch_type: (v) => v.launch_type ?? 'EC2',
        platform_version: (v) => v.platform_version ?? (v.launch_type === 'FARGATE' ? 'LATEST' : ''),
      },
    }),

    // ---------- segurança e segredos ----------
    aws_kms_key: tipo('aws_kms_key', {
      args: 'description~ deletion_window_in_days?:number enable_key_rotation?:bool=false is_enabled?:bool=true key_usage?=ENCRYPT_DECRYPT^ customer_master_key_spec?=SYMMETRIC_DEFAULT^ multi_region~^:bool policy~ tags?:map',
      calc: 'id arn key_id',
      validar: { deletion_window_in_days: entre(7, 30) },
      gerar: {
        key_id: (v, u) => u.uuid(),
        id: (v, u, f) => f.key_id,
        arn: (v, u, f) => `arn:aws:kms:${u.regiao}:${u.conta}:key/${f.key_id}`,
        description: (v) => v.description ?? '',
        multi_region: (v) => v.multi_region ?? false,
        policy: (v, u) => v.policy ?? JSON.stringify({ Version: '2012-10-17', Id: 'key-default-1', Statement: [{ Sid: 'Enable IAM User Permissions', Effect: 'Allow', Principal: { AWS: `arn:aws:iam::${u.conta}:root` }, Action: 'kms:*', Resource: '*' }] }),
      },
    }),
    aws_kms_alias: tipo('aws_kms_alias', {
      args: 'name~^ name_prefix?^ target_key_id!',
      calc: 'id arn target_key_arn',
      validar: { name: padrao(/^alias\//, 'name ({valor}) must begin with "alias/"') },
      gerar: {
        name: (v, u) => v.name ?? `alias/terraform-${u.hex(26)}`,
        id: (v, u, f) => f.name,
        arn: (v, u, f) => `arn:aws:kms:${u.regiao}:${u.conta}:${f.name}`,
        target_key_arn: (v, u) => `arn:aws:kms:${u.regiao}:${u.conta}:key/${v.target_key_id}`,
      },
    }),
    aws_secretsmanager_secret: tipo('aws_secretsmanager_secret', {
      args: 'name~^ name_prefix?^ description? kms_key_id? recovery_window_in_days?:number=30 force_overwrite_replica_secret?:bool=false policy~ tags?:map',
      calc: 'id arn',
      validar: { recovery_window_in_days: (v, n) => (v === 0 || (v >= 7 && v <= 30) ? null : `expected ${n} to be 0 or in the range (7 - 30), got ${v}`) },
      gerar: {
        name: (v, u) => v.name ?? `terraform-${u.hex(26)}`,
        arn: (v, u, f) => `arn:aws:secretsmanager:${u.regiao}:${u.conta}:secret:${f.name}-${u.hex(6)}`,
        id: (v, u, f) => f.arn,
        policy: (v) => v.policy ?? '',
      },
    }),
    aws_secretsmanager_secret_version: tipo('aws_secretsmanager_secret_version', {
      args: 'secret_id!^ secret_string?$ secret_binary?$ version_stages~:set',
      calc: 'id arn version_id',
      gerar: {
        version_id: (v, u) => u.uuid(),
        id: (v, u, f) => `${v.secret_id}|${f.version_id}`,
        arn: (v) => v.secret_id,
        version_stages: () => ['AWSCURRENT'],
      },
    }),
    aws_ssm_parameter: tipo('aws_ssm_parameter', {
      args: 'name!^ type! value?$ insecure_value? description? tier~ key_id~ overwrite?:bool data_type~ tags?:map',
      calc: 'id arn version:number',
      validar: { type: umDosValores('String', 'StringList', 'SecureString') },
      gerar: {
        id: (v) => v.name,
        arn: (v, u) => `arn:aws:ssm:${u.regiao}:${u.conta}:parameter/${String(v.name).replace(/^\//, '')}`,
        version: () => 1,
        tier: (v) => v.tier ?? 'Standard',
        data_type: (v) => v.data_type ?? 'text',
        key_id: (v) => v.key_id ?? (v.type === 'SecureString' ? 'alias/aws/ssm' : ''),
      },
    }),
    aws_wafv2_web_acl: tipo('aws_wafv2_web_acl', {
      args: 'name!^ scope!^ description? tags?:map',
      blocos: {
        default_action: { min: 1, max: 1, blocos: { allow: { max: 1 }, block: { max: 1 } } },
        visibility_config: { min: 1, max: 1, args: 'cloudwatch_metrics_enabled!:bool metric_name! sampled_requests_enabled!:bool' },
        rule: { args: 'name! priority!:number', blocos: { override_action: { max: 1, livre: true }, action: { max: 1, livre: true }, statement: { min: 1, max: 1, livre: true }, visibility_config: { min: 1, max: 1, args: 'cloudwatch_metrics_enabled!:bool metric_name! sampled_requests_enabled!:bool' } } },
      },
      calc: 'id arn capacity:number lock_token',
      validar: { scope: umDosValores('REGIONAL', 'CLOUDFRONT') },
      gerar: {
        id: (v, u) => u.uuid(),
        arn: (v, u, f) => `arn:aws:wafv2:${u.regiao}:${u.conta}:${String(v.scope).toLowerCase()}/webacl/${v.name}/${f.id}`,
        capacity: () => 50,
        lock_token: (v, u) => u.uuid(),
      },
    }),

    // ---------- estado remoto ----------
    aws_s3_bucket_acl: tipo('aws_s3_bucket_acl', {
      args: 'bucket!^ acl?',
      calc: 'id',
      gerar: { id: (v) => `${v.bucket},${v.acl ?? ''}` },
    }),
  },

  dados: {
    aws_ami: tipo('aws_ami', {
      args: 'most_recent?:bool=false owners?:list name_regex? executable_users?:list include_deprecated?:bool',
      blocos: { filter: { args: 'name! values!:list' } },
      calc: 'id arn image_id name description architecture root_device_name root_device_type virtualization_type owner_id platform_details creation_date',
      ler: (v, u) => {
        const filtroNome = v.filter?.find((f) => f.name === 'name')?.values?.[0] ?? '';
        const nome = filtroNome.includes('ubuntu') ? 'ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-20260101'
          : filtroNome.includes('al2023') ? 'al2023-ami-2023.6.20260101.0-kernel-6.1-x86_64'
            : filtroNome.replace(/\*/g, '2026') || 'amzn2-ami-hvm-2.0.20260101.0-x86_64-gp2';
        const id = `ami-0${u.hex(16, `ami:${nome}`)}`;
        return {
          id, image_id: id, name: nome, arn: `arn:aws:ec2:${u.regiao}::image/${id}`,
          description: `Imagem simulada ${nome}`, architecture: nome.includes('arm64') ? 'arm64' : 'x86_64',
          root_device_name: '/dev/xvda', root_device_type: 'ebs', virtualization_type: 'hvm',
          owner_id: v.owners?.[0] === 'amazon' ? '137112412989' : v.owners?.[0] ?? '099720109477',
          platform_details: 'Linux/UNIX', creation_date: '2026-01-01T00:00:00.000Z',
        };
      },
    }),
    aws_availability_zones: tipo('aws_availability_zones', {
      args: 'state? all_availability_zones?:bool exclude_names?:set',
      blocos: { filter: { args: 'name! values!:list' } },
      calc: 'id names:list zone_ids:list group_names:set',
      ler: (v, u) => {
        const letras = u.regiao === 'sa-east-1' ? ['a', 'b', 'c'] : u.regiao === 'us-east-1' ? ['a', 'b', 'c', 'd', 'e', 'f'] : ['a', 'b', 'c'];
        const names = letras.map((l) => `${u.regiao}${l}`).filter((n) => !(v.exclude_names ?? []).includes(n));
        return { id: u.regiao, names, zone_ids: names.map((n, i) => `${u.regiao.split('-').map((p) => p[0]).join('')}1-az${i + 1}`), group_names: [u.regiao] };
      },
    }),
    aws_caller_identity: tipo('aws_caller_identity', {
      calc: 'id account_id arn user_id',
      ler: (v, u) => ({ id: u.conta, account_id: u.conta, arn: `arn:aws:iam::${u.conta}:user/aluno`, user_id: 'AIDASIMULADO00000001' }),
    }),
    aws_region: tipo('aws_region', {
      args: 'region~ name~ endpoint~',
      calc: 'id description',
      ler: (v, u) => ({ id: u.regiao, region: u.regiao, name: u.regiao, endpoint: `ec2.${u.regiao}.amazonaws.com`, description: u.regiao === 'sa-east-1' ? 'South America (Sao Paulo)' : 'US East (N. Virginia)' }),
    }),
    aws_partition: tipo('aws_partition', {
      calc: 'id partition dns_suffix reverse_dns_prefix',
      ler: () => ({ id: 'aws', partition: 'aws', dns_suffix: 'amazonaws.com', reverse_dns_prefix: 'com.amazonaws' }),
    }),
    aws_vpc: tipo('aws_vpc', {
      args: 'id~ default~:bool cidr_block~ tags~:map',
      blocos: { filter: { args: 'name! values!:list' } },
      calc: 'arn main_route_table_id owner_id',
      ler: (v, u) => ({
        id: v.id ?? `vpc-${u.hex(17, 'vpcpadrao')}`, default: v.default ?? true, cidr_block: v.cidr_block ?? '172.31.0.0/16',
        arn: `arn:aws:ec2:${u.regiao}:${u.conta}:vpc/vpc-${u.hex(17, 'vpcpadrao')}`, main_route_table_id: `rtb-${u.hex(17, 'rtbpadrao')}`, owner_id: u.conta, tags: v.tags ?? {},
      }),
    }),
    aws_subnets: tipo('aws_subnets', {
      args: 'tags?:map',
      blocos: { filter: { args: 'name! values!:list' } },
      calc: 'id ids:list',
      ler: (v, u) => ({ id: u.regiao, ids: ['a', 'b', 'c'].map((l) => `subnet-${u.hex(17, `sub${l}`)}`) }),
    }),
    aws_iam_policy_document: tipo('aws_iam_policy_document', {
      args: 'version?=2012-10-17 policy_id? source_policy_documents?:list override_policy_documents?:list',
      blocos: {
        statement: {
          args: 'sid? effect?=Allow actions?:set not_actions?:set resources?:set not_resources?:set',
          blocos: {
            principals: { args: 'type! identifiers!:set' },
            not_principals: { args: 'type! identifiers!:set' },
            condition: { args: 'test! variable! values!:list' },
          },
        },
      },
      calc: 'id json minified_json',
      ler: (v) => {
        const unico = (l) => (l.length === 1 ? l[0] : l);
        const statements = (v.statement ?? []).map((s) => {
          const st = {};
          if (s.sid) st.Sid = s.sid;
          st.Effect = s.effect ?? 'Allow';
          if (s.principals?.length) {
            st.Principal = {};
            for (const p of s.principals) st.Principal[p.type] = unico([...p.identifiers]);
          }
          if (s.actions?.length) st.Action = unico([...s.actions]);
          if (s.not_actions?.length) st.NotAction = unico([...s.not_actions]);
          if (s.resources?.length) st.Resource = unico([...s.resources]);
          if (s.condition?.length) {
            st.Condition = {};
            for (const c of s.condition) (st.Condition[c.test] ??= {})[c.variable] = unico([...c.values]);
          }
          return st;
        });
        const doc = { Version: v.version ?? '2012-10-17', ...(v.policy_id ? { Id: v.policy_id } : {}), Statement: statements };
        const json = JSON.stringify(doc, null, 2);
        return { id: String(json.length), json, minified_json: JSON.stringify(doc) };
      },
      descricao: 'Monta o JSON de uma política do IAM a partir de blocos HCL (mais fácil de ler e validar).',
    }),
    aws_s3_bucket: tipo('aws_s3_bucket', {
      args: 'bucket!',
      calc: 'id arn bucket_domain_name bucket_regional_domain_name hosted_zone_id region',
      ler: (v, u) => ({
        id: v.bucket, arn: `arn:aws:s3:::${v.bucket}`, bucket_domain_name: `${v.bucket}.s3.amazonaws.com`,
        bucket_regional_domain_name: `${v.bucket}.s3.${u.regiao}.amazonaws.com`, hosted_zone_id: 'Z3AQBSTGFYJSTF', region: u.regiao,
      }),
    }),
    aws_route53_zone: tipo('aws_route53_zone', {
      args: 'name~ zone_id~ private_zone?:bool',
      calc: 'arn name_servers:list',
      ler: (v, u) => ({ name: v.name ?? 'exemplo.com.br', zone_id: v.zone_id ?? `Z${u.hex(20, 'zona').toUpperCase()}`, id: v.zone_id ?? `Z${u.hex(20, 'zona').toUpperCase()}`, arn: `arn:aws:route53:::hostedzone/Z${u.hex(20, 'zona').toUpperCase()}`, name_servers: ['ns-1.awsdns-01.com', 'ns-2.awsdns-02.net'], private_zone: v.private_zone ?? false }),
    }),
    aws_secretsmanager_secret_version: tipo('aws_secretsmanager_secret_version', {
      args: 'secret_id! version_stage?=AWSCURRENT',
      calc: 'id arn secret_string$ version_id',
      ler: (v, u) => ({ id: `${v.secret_id}|AWSCURRENT`, arn: v.secret_id, secret_string: `segredo-${u.hex(12)}`, version_id: u.uuid() }),
    }),
  },
};

// Cada recurso da AWS ganha `region` (provedor v6) e `tags_all`, calculados pelo motor.
for (const def of Object.values(PROVEDOR_AWS.recursos)) {
  if (!def.global) def.args.region = { obrigatorio: false, calculado: true, forcaNova: true, sensivel: false, tipo: 'string' };
  if (def.args.tags) def.calc.tags_all = { sensivel: false, tipo: 'map' };
  def.docs = `https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/${def.nome.replace(/^aws_/, '')}`;
}
for (const def of Object.values(PROVEDOR_AWS.dados)) {
  def.docs = `https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/${def.nome.replace(/^aws_/, '')}`;
}

