# Arquitetura ilustrativa

A aba **Arquitetura** desenha os recursos e dependências do código atual usando
o mesmo grafo que a aba Grafo. Não executa Apply, não consulta a nuvem e não é
uma confirmação de que o código passou nos testes.

## Como ler

- O desenho usa fundo branco, áreas retangulares, ícones oficiais grandes,
  nomes abaixo dos ícones e conexões em ângulo reto, como diagramas de referência
  de arquitetura cloud. As cores originais dos ícones são preservadas.
- Caixas nomeadas representam pertencimento explícito: VPC/VNet, sub-rede,
  Resource Group ou Namespace podem conter os recursos que os referenciam.
  Cabeçalhos têm ícone e nome do contêiner; recursos ficam dentro, em áreas
  suaves por função (rede/entrada, aplicação, dados e configuração/acesso).
  Essas áreas funcionais não são fronteiras de segurança nem etapas numeradas.
- Terraform reconhece referências diretas em `subnet_id`, `vpc_id`,
  `virtual_network_name` e `resource_group_name`, nessa prioridade.
  `depends_on` não cria pertencimento. Valores literais, referências indiretas
  por variáveis/locals, módulos e associações não reconhecidas não são adivinhados.
  Relações de pertencimento múltiplo não são representadas como vários pais.
- Kubernetes só cria caixa Namespace quando ele está declarado no YAML.
  Recursos sem `metadata.namespace` usam `default`; só entram numa caixa se
  `Namespace/default` também estiver declarado. Recursos de escopo do cluster
  reconhecidos (PV, StorageClass, ClusterRole etc.) ficam fora dos namespaces.
  Referências e selectors respeitam namespace; nomes iguais em namespaces
  diferentes não são unidos no desenho.
- Recursos sem pai identificado ficam fora das caixas nomeadas. Isso não
  significa que estejam na internet, sem proteção ou fora de uma rede real.
- Uma seta significa **usa ou referencia**, na direção de quem usa para quem
  é usado. Não significa tráfego de rede ou permissão de acesso.
- Dependências de um recurso para seu contêiner ou ancestral são representadas
  pelo aninhamento, sem setas redundantes atravessando cabeçalhos. A lista
  textual mantém todas as dependências e explicita filho, pai e atributo.
- Código vazio recebe orientação inicial; código inválido recebe uma mensagem,
  não um desenho antigo apresentado como resultado novo.
- Recursos sem ícone cadastrado permanecem visíveis com representação genérica.
- Os nomes completos e as relações também aparecem em uma lista textual aberta.
  O desenho tem rolagem própria acessível pelo teclado.

Os ícones cobrem serviços comuns da AWS (EC2, VPC, S3, EKS, RDS e balanceadores),
Azure (VMs, rede virtual, Storage, AKS, SQL, balanceadores e grupos de recursos)
e recursos Kubernetes. Não inferimos AWS/Azure somente porque um manifesto é
Kubernetes: um provedor só aparece quando identificado pelo tipo do recurso.

## Informações de rede no desenho

O espaço abaixo dos nomes mostra dados de rede do código, não a indicação
“ícone oficial”. Créditos, procedência e permissões ficam na página **Licença**
e em `LICENSE-CONTEUDO.md`, mantendo o vínculo para a atribuição completa.

- Terraform: CIDRs literais de VPC, VNet e sub-rede, IP privado, protocolos e
  portas; também campos de regras `ingress`, `egress` e `security_rule`.
  Expressões dinâmicas aparecem como “expressão não resolvida”, sem usar valores
  inventados do simulador. Somente campos de rede permitidos são extraídos;
  tags, credenciais e outros atributos não entram no desenho.
- Kubernetes: namespace, IP declarado do Service, portas de serviço/destino/nó
  e contêiner, host/caminho/porta de Ingress, CIDRs/exceções e portas de
  NetworkPolicy. Não se lê `status` nem se inventa uma sub-rede para os Pods.
- CIDR IPv4 válido recebe máscara decimal calculada, incluindo `/0` e `/32`.
  IPv6 mantém a notação com prefixo, sem produzir máscara IPv4.
- Máscara e portas são dados informativos: não provam roteamento, exposição
  pública ou acesso permitido. Campos ausentes não recebem valores presumidos.
- Cabeçalhos e cartões crescem com os detalhes. Texto longo pode ser abreviado
  no desenho, mas aparece inteiro no título e na lista textual equivalente.

## Atribuição das imagens

SVGs oficiais hospedados localmente em `public/icones-arquitetura`, sem CDN:

- [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/),
  pacote de julho de 2026, para diagramas de arquitetura.
- [Microsoft Azure Icons](https://learn.microsoft.com/en-us/azure/architecture/icons/),
  pacote V24, uso permitido em arquitetura, treinamento e documentação.
- [Kubernetes Icons](https://github.com/kubernetes/community/tree/main/icons),
  revisão `be4243382c61713fdb9aa809e8b70ce184471ec8`, CC BY 4.0.

Os originais não foram recoloridos, cortados, girados nem distorcidos.
Nomes de produto acompanham os ícones; marcas não representam o playground nem
indicam endosso. Os termos completos de origem, atribuição e escopo estão em
[`ATRIBUICAO.txt`](../public/icones-arquitetura/ATRIBUICAO.txt). A licença do código
não concede direitos adicionais sobre esses assets.

## Manutenção e validação

O mapeamento explícito fica em `src/ui/arquitetura-recursos.js`; não usar
heurísticas que associem recursos desconhecidos a produtos incorretos.
Ao acrescentar um ícone, conferir origem/permissão, preservar o SVG, atualizar
atribuição e adicionar um caso de teste. Recursos genéricos não desaparecem.

Testes cobrem ícones locais, grafo real, áreas aninhadas, pertencimento,
isolamento entre namespaces, conectores ortogonais, ciclos, texto equivalente,
rótulos escapados e mensagens de erro/vazio. A extração depende dos recursos e
referências reconhecidos pelo simulador; não substitui uma ferramenta de
modelagem completa nem uma validação real de conectividade.
