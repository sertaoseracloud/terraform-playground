// Provedores que não dependem de nuvem: random, local, null, tls, archive e o
// embutido "terraform" (terraform_data). São ótimos para aprender a linguagem.
import { tipo, umDosValores, entre } from './dsl.js';

const PALAVRAS = [
  'ágil', 'alegre', 'brava', 'calma', 'curiosa', 'doce', 'esperta', 'feliz', 'forte', 'gentil', 'leve', 'livre', 'nobre',
  'rápida', 'sábia', 'serena', 'valente', 'viva',
];
const BICHOS = [
  'arara', 'tatu', 'onça', 'capivara', 'sabiá', 'jabuti', 'cutia', 'jandaia', 'preá', 'seriema', 'tamanduá', 'mocó',
  'acauã', 'carcará', 'asa-branca', 'calango', 'mandacaru', 'xique-xique',
];
// Os nomes reais do random_pet são em inglês; aqui usamos bichos e plantas da caatinga, só com letras ASCII.
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const hashes = {
  content_md5: (v, u) => u.hex(32),
  content_sha1: (v, u) => u.hex(40),
  content_sha256: (v, u) => u.hex(64),
  content_base64sha256: (v, u) => u.b64(44),
  content_sha512: (v, u) => u.hex(128),
  content_base64sha512: (v, u) => u.b64(88),
};

export const PROVEDOR_RANDOM = {
  nome: 'random',
  fonte: 'hashicorp/random',
  versoes: ['3.6.3', '3.7.2'],
  recursos: {
    random_pet: tipo('random_pet', {
      args: 'keepers?:map^ length?:number=2^ prefix?^ separator?=-^',
      calc: 'id',
      validar: { length: entre(1, 10) },
      gerar: {
        id: (v, u) => {
          const n = v.length ?? 2;
          const partes = [];
          for (let i = 0; i < n; i++) {
            const lista = i === n - 1 ? BICHOS : PALAVRAS;
            partes.push(semAcento(lista[parseInt(u.hex(4, `p${i}`), 16) % lista.length]));
          }
          if (v.prefix) partes.unshift(v.prefix);
          return partes.join(v.separator ?? '-');
        },
      },
      descricao: 'Gera um nome aleatório e legível, como "valente-tatu".',
    }),
    random_string: tipo('random_string', {
      args: 'length!:number^ special?:bool=true^ upper?:bool=true^ lower?:bool=true^ numeric?:bool=true^ min_upper?:number=0^ min_lower?:number=0^ min_numeric?:number=0^ min_special?:number=0^ override_special?^ keepers?:map^',
      calc: 'id result',
      gerar: {
        result: (v, u) => u.textoAleatorio(v),
        id: (v, u, f) => f.result,
      },
      descricao: 'Gera um texto aleatório (não use para senhas: use random_password).',
    }),
    random_password: tipo('random_password', {
      args: 'length!:number^ special?:bool=true^ upper?:bool=true^ lower?:bool=true^ numeric?:bool=true^ min_upper?:number=0^ min_lower?:number=0^ min_numeric?:number=0^ min_special?:number=0^ override_special?^ keepers?:map^',
      calc: 'id result$ bcrypt_hash$',
      gerar: {
        result: (v, u) => u.textoAleatorio(v),
        bcrypt_hash: (v, u) => `$2a$10$${u.b64(53)}`,
        id: () => 'none',
      },
      descricao: 'Gera uma senha aleatória. O valor fica marcado como sensível.',
    }),
    random_integer: tipo('random_integer', {
      args: 'min!:number^ max!:number^ seed?^ keepers?:map^',
      calc: 'id result:number',
      gerar: {
        result: (v, u) => v.min + (parseInt(u.hex(8), 16) % (v.max - v.min + 1)),
        id: (v, u, f) => String(f.result),
      },
    }),
    random_id: tipo('random_id', {
      args: 'byte_length!:number^ prefix?^ keepers?:map^',
      calc: 'id b64_url b64_std hex dec',
      gerar: {
        hex: (v, u) => `${v.prefix ?? ''}${u.hex(v.byte_length * 2)}`,
        b64_url: (v, u) => `${v.prefix ?? ''}${u.b64(Math.ceil((v.byte_length * 4) / 3)).replace(/\+/g, '-').replace(/\//g, '_')}`,
        b64_std: (v, u) => `${v.prefix ?? ''}${u.b64(Math.ceil((v.byte_length * 4) / 3))}`,
        dec: (v, u) => `${v.prefix ?? ''}${BigInt(`0x${u.hex(v.byte_length * 2)}`).toString()}`,
        id: (v, u, f) => f.b64_url,
      },
    }),
    random_uuid: tipo('random_uuid', {
      args: 'keepers?:map^',
      calc: 'id result',
      gerar: { result: (v, u) => u.uuid(), id: (v, u, f) => f.result },
    }),
    random_shuffle: tipo('random_shuffle', {
      args: 'input!:list^ result_count?:number^ seed?^ keepers?:map^',
      calc: 'id result:list',
      gerar: {
        result: (v, u) => {
          const itens = [...v.input];
          for (let i = itens.length - 1; i > 0; i--) {
            const j = parseInt(u.hex(4, `s${i}`), 16) % (i + 1);
            [itens[i], itens[j]] = [itens[j], itens[i]];
          }
          return itens.slice(0, v.result_count ?? itens.length);
        },
        id: () => '-',
      },
    }),
  },
  dados: {},
};

export const PROVEDOR_LOCAL = {
  nome: 'local',
  fonte: 'hashicorp/local',
  versoes: ['2.5.2', '2.5.3'],
  recursos: {
    local_file: tipo('local_file', {
      args: 'filename!^ content?^ content_base64?^ source?^ file_permission?=0777^ directory_permission?=0777^',
      calc: 'id content_md5 content_sha1 content_sha256 content_base64sha256 content_sha512 content_base64sha512',
      umDe: [['content', 'content_base64', 'source']],
      gerar: { ...hashes, id: (v, u, f) => f.content_sha1 },
      descricao: 'Cria um arquivo no computador onde o Terraform roda.',
    }),
    local_sensitive_file: tipo('local_sensitive_file', {
      args: 'filename!^ content?$^ content_base64?$^ source?^ file_permission?=0700^ directory_permission?=0700^',
      calc: 'id content_md5 content_sha1 content_sha256 content_base64sha256 content_sha512 content_base64sha512',
      umDe: [['content', 'content_base64', 'source']],
      gerar: { ...hashes, id: (v, u, f) => f.content_sha1 },
    }),
  },
  dados: {
    local_file: tipo('local_file', {
      args: 'filename!',
      calc: 'id content content_base64 content_md5 content_sha1 content_sha256',
      ler: (v, u) => {
        const conteudo = u.lerArquivo(v.filename);
        return { content: conteudo, content_base64: u.base64(conteudo), content_md5: u.hex(32), content_sha1: u.hex(40), content_sha256: u.hex(64), id: u.hex(40) };
      },
    }),
  },
};

export const PROVEDOR_NULL = {
  nome: 'null',
  fonte: 'hashicorp/null',
  versoes: ['3.2.3', '3.2.4'],
  recursos: {
    null_resource: tipo('null_resource', {
      args: 'triggers?:map^',
      calc: 'id',
      gerar: { id: (v, u) => String(parseInt(u.hex(12), 16)) },
      descricao: 'Recurso que não cria nada. Hoje prefira terraform_data.',
    }),
  },
  dados: {},
};

export const PROVEDOR_TERRAFORM = {
  nome: 'terraform',
  fonte: 'terraform.io/builtin/terraform',
  embutido: true,
  versoes: ['1.13.3'],
  recursos: {
    terraform_data: tipo('terraform_data', {
      args: 'input?:any triggers_replace?:any^',
      calc: 'id output:any',
      gerar: { id: (v, u) => u.uuid(), output: (v) => v.input ?? null },
      descricao: 'Guarda um valor no estado e pode forçar a recriação de outros recursos.',
    }),
  },
  dados: {},
};

export const PROVEDOR_TLS = {
  nome: 'tls',
  fonte: 'hashicorp/tls',
  versoes: ['4.0.6', '4.1.0'],
  recursos: {
    tls_private_key: tipo('tls_private_key', {
      args: 'algorithm!^ rsa_bits?:number=2048^ ecdsa_curve?=P224^',
      calc: 'id private_key_pem$ private_key_openssh$ private_key_pem_pkcs8$ public_key_pem public_key_openssh public_key_fingerprint_md5 public_key_fingerprint_sha256',
      validar: { algorithm: umDosValores('RSA', 'ECDSA', 'ED25519') },
      gerar: {
        private_key_pem: (v, u) => `-----BEGIN RSA PRIVATE KEY-----\n${u.b64(64)}\n-----END RSA PRIVATE KEY-----\n`,
        private_key_openssh: (v, u) => `-----BEGIN OPENSSH PRIVATE KEY-----\n${u.b64(64)}\n-----END OPENSSH PRIVATE KEY-----\n`,
        private_key_pem_pkcs8: (v, u) => `-----BEGIN PRIVATE KEY-----\n${u.b64(64)}\n-----END PRIVATE KEY-----\n`,
        public_key_pem: (v, u) => `-----BEGIN PUBLIC KEY-----\n${u.b64(64, 'pub')}\n-----END PUBLIC KEY-----\n`,
        public_key_openssh: (v, u) => `${v.algorithm === 'ED25519' ? 'ssh-ed25519' : v.algorithm === 'ECDSA' ? 'ecdsa-sha2-nistp256' : 'ssh-rsa'} ${u.b64(68, 'pub')}\n`,
        public_key_fingerprint_md5: (v, u) => u.hex(32, 'fp').match(/../g).join(':'),
        public_key_fingerprint_sha256: (v, u) => `SHA256:${u.b64(43, 'fp')}`,
        id: (v, u) => u.hex(40),
      },
    }),
  },
  dados: {},
};

export const PROVEDOR_ARCHIVE = {
  nome: 'archive',
  fonte: 'hashicorp/archive',
  versoes: ['2.6.0', '2.7.1'],
  recursos: {},
  dados: {
    archive_file: tipo('archive_file', {
      args: 'type! source_file? source_dir? source_content? source_content_filename? output_path! output_file_mode? excludes?:set',
      blocos: { source: { args: 'content! filename!' } },
      calc: 'id output_size:number output_md5 output_sha output_sha256 output_base64sha256 output_base64sha512',
      validar: { type: umDosValores('zip', 'tar.gz') },
      ler: (v, u) => ({
        id: u.hex(40),
        output_size: 200 + (parseInt(u.hex(4), 16) % 800),
        output_md5: u.hex(32),
        output_sha: u.hex(40),
        output_sha256: u.hex(64),
        output_base64sha256: u.b64(44),
        output_base64sha512: u.b64(88),
      }),
      descricao: 'Compacta arquivos em .zip (muito usado para enviar código ao Lambda e ao Azure Functions).',
    }),
  },
};
