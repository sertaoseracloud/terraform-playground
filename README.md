# 🏗️ Terraform Playground

Trilha de exercícios no estilo LeetCode para aprender **Terraform → AWS → Azure → Projetos** em aula.
O Terraform roda **simulado dentro do navegador**: `init`, `validate`, `plan`, `apply` e `destroy` com a
mesma saída do Terraform de verdade, mas **sem conta na nuvem, sem credenciais e sem custo**.
O site é estático e fica no GitHub Pages.

**Acesse:** https://sertaoseracloud.github.io/terraform-playground/

## O que tem

- **Landing page** (`#/`): apresenta o projeto, a trilha, os certificados e os recursos de
  acessibilidade. Os números (exercícios, módulos, projetos) vêm do próprio conteúdo. A trilha fica
  em `#/trilha`, e quem já começou vê "▶ Continuar" no topo.
- **200 exercícios** com dificuldade Fácil/Médio/Difícil, mais **lições** de conceito no começo de cada assunto:
  1. **Terraform básico** (50): blocos e HCL, providers, recursos, variáveis, `tfvars`, validação,
     outputs, `locals`, funções, expressões `for`, `count`, `for_each`, blocos `dynamic`,
     dependências, `lifecycle`, `moved`, workspaces e módulos.
  2. **AWS** (55): S3 (versionamento, criptografia, site, políticas), IAM, VPC, sub-redes, rotas, NAT,
     security groups, EC2, Auto Scaling, load balancer, RDS, DynamoDB, Lambda, API Gateway, SQS, SNS,
     CloudWatch, Secrets Manager, `import` e backend S3.
  3. **Azure** (55): grupos de recursos, Storage, VNet, NSG, VMs, scale sets, App Service, Functions,
     Azure SQL, PostgreSQL, Cosmos DB, Redis, Key Vault, identidades gerenciadas, RBAC, ACR, AKS,
     Container Apps, monitoramento, DNS, load balancer, private endpoint e backend `azurerm`.
- **🏗️ Módulo extra: Projetos**: 8 infraestruturas completas construídas em **etapas encadeadas**
  (40 etapas). Cada etapa cria um arquivo `.tf` novo, e o código de partida é o **código do próprio
  aluno** na etapa anterior (ou a referência, se ele não a resolveu):

  | Projeto | Destaques |
  | --- | --- |
  | 🌐 Site estático com S3 e CloudFront | bucket privado, `for_each` nos arquivos, OAC, política só para o CloudFront |
  | 🧱 Rede de 3 camadas na AWS | `cidrsubnet`, NAT, security groups em cadeia, RDS com senha gerenciada |
  | ⚡ API serverless na AWS | DynamoDB, IAM de menor privilégio, Lambda em Python, API Gateway, alarme |
  | 🛒 App web no Azure | App Service, Azure SQL, Key Vault, identidade gerenciada, Application Insights |
  | ☸️ Kubernetes no Azure (AKS + ACR) | AKS na VNet, AcrPull para o kubelet, node pool com autoscaling |
  | 🧩 Módulos para vários ambientes | módulos próprios, mapa de ambientes, workspaces dev/prod |
  | 🌎 Multicloud: AWS e Azure juntos | DNS na AWS apontando para o Azure, configurações cruzadas, provider alias |
  | 🔐 Estado remoto e boas práticas | backend S3 com trava, `import`, `moved`, `removed`, versões fixadas |

- **Como no LeetCode**: **▶ Plan** roda os casos visíveis; **⬆ Enviar** roda todos, inclusive os
  **casos ocultos** (outras variáveis, outro workspace, apply). Resposta fixa no código não passa.
- **Terminal simulado**: o plano sai como no Terraform (`+ create`, `~ update in-place`,
  `-/+ destroy and then create replacement`, `# forces replacement`, `(known after apply)`) e os erros
  saem na caixa `╷ │ ╵`, com uma explicação em português embaixo.
- **Abas de saída**: 🖥️ Terminal, 🕸️ **Grafo** de dependências (SVG), 📦 **Estado** (com exportação
  `terraform.tfstate` v4) e 📤 **Outputs**. O estado de cada exercício fica salvo no navegador, por
  workspace; **Limpar estado** recomeça do zero.
- **Aba 📘 Docs**: argumentos (obrigatórios, opcionais, que forçam recriação, sensíveis) e atributos
  de cada tipo de recurso usado no código.
- **Playground livre** (`#/livre`) com vários arquivos e pastas de módulos.
- **♿ Acessibilidade**: temas Dracula, Alto contraste, Claro e Suave; tamanho do texto (87,5% a 175%,
  editor incluído); fonte Atkinson Hyperlegible; mais espaçamento; links sublinhados e foco reforçado;
  reduzir animações; **🔊 Ouvir** o enunciado; atalhos de teclado; "Pular para o conteúdo";
  rótulos e regiões `aria-live` para leitores de tela.
- **🧠 Neurodiversidade** (recomendações do W3C para acessibilidade cognitiva, COGA): perfis rápidos
  (🎯 Foco, 📖 Leitura facilitada, 🌿 Calmo, 🤝 Sem pressão), modo foco, lista de tarefas com caixas de
  marcar, régua de leitura, linhas curtas e lembrete de pausa.
- **Instruções com estrutura previsível**: todo desafio mostra um roteiro curto, 🎯 **O que fazer**
  em lista, 📚 **Palavras técnicas** (até 6 termos com explicação simples, **analogia do dia a dia** e
  exemplo; glossário em `src/conteudo/glossario.js`), ✅ **Como saber que deu certo** e 💡 Dica.
- **❓ Tutorial** passo a passo, **progresso** por módulo e **compartilhar** com o código no link.

### Trilha gamificada e certificados

- A trilha (`#/trilha`) é um **caminho** em zigue-zague. Lição vale 5 XP, fácil 10, médio 20 e difícil 40.
  O aluno sobe de **nível** (Iniciante → Mestre do Terraform) e ganha uma **sequência de dias** 🔥.
- O próximo módulo **desbloqueia quando o atual chega a 70%**.
- Ao concluir 100% de um módulo, o 🏆 libera o **certificado do módulo**; com todos, o 🎓 libera o
  **certificado final**. Os certificados são emitidos pela **Sertão será cloud** e assinados por
  **Cláudio Raposo**, com **badge digital no estilo Credly** e botões para **publicar no LinkedIn** e
  **adicionar ao perfil**.
- **Selo de verificação** (HMAC-SHA256) e **cadeia de certificados** Terraform → AWS → Azure →
  Projetos → Final: cada certificado inclui no selo o hash do anterior, então mudar uma data ou um
  nome em qualquer ponto quebra os seguintes.
- **🔎 Validador** (`#/validar`), **📄 XML do certificado** e **✍️ assinatura Ed25519** com a chave
  pública em `chave-publica-ed25519.txt`.
- **A palavra secreta nunca entra no código nem no site.** Ela fica no secret
  `CERTIFICADO_SEGREDO` do GitHub Actions; o build injeta só um valor derivado dela
  (`vite.config.js`) e falha se o secret não existir. Para gerar o build localmente:
  `CERTIFICADO_SEGREDO='...' npm run build`. Trocar a palavra invalida os selos já emitidos.
- **Limite:** sem servidor, a chave derivada vai no JavaScript do site. O selo pega alterações no
  link, mas quem estudar o código publicado consegue gerar selos.

Cada badge tem uma página estática em `public/badge/<módulo>/` com as meta tags `og:` para a prévia do
LinkedIn. Esses arquivos, a capa `og-capa.png` e os ícones saem de `src/badges.js` e `src/certificados.js`;
depois de mudar um deles, rode `npm run badges` e faça commit de `public/`.

### Privacidade, cookies e LGPD

A página **🔒 Privacidade** (`#/privacidade`) explica como os dados são tratados:

- **Sem cookies e sem rastreamento**: não há analytics, anúncios nem servidor próprio.
- **Dados só no navegador** (`localStorage`, prefixo `terraform-playground:`): progresso, datas, dias
  de estudo, nome do certificado, código, estado simulado de cada exercício e preferências. A tabela
  completa fica em [`src/privacidade.js`](src/privacidade.js), e um teste falha se o código passar a
  gravar uma chave que não está documentada.
- **Nada vai para a AWS ou para o Azure**: o simulador não faz chamadas de rede e não pede credenciais.
- **LGPD**: finalidade, base legal do nome (consentimento), direitos do art. 18 com
  **📥 Baixar meus dados** e **🗑️ Apagar meus dados**, e cuidado com menores (art. 14).

## O simulador

```
Editor (CodeMirror, HCL) ──arquivos .tf──▶ lexer + parser HCL ──▶ avaliador de expressões e funções
                                                                      │
             esquemas dos provedores (aws, azurerm, random, local, null, tls, archive)
                                                                      ▼
   terminal / grafo / estado / outputs ◀── init → validate → plan → apply/destroy ──▶ regras dos testes
```

- [`src/tf/lexer.js`](src/tf/lexer.js) e [`src/tf/parser.js`](src/tf/parser.js): HCL com templates,
  heredocs e erros com linha e coluna.
- [`src/tf/funcoes.js`](src/tf/funcoes.js): funções do Terraform (texto, números, coleções, `cidrsubnet`,
  `jsonencode`, `templatefile`, `file`, `try`, `can`, `sensitive`...).
- [`src/tf/esquema/`](src/tf/esquema/): os recursos e data sources de cada provedor, numa DSL curta
  (`'bucket~^ tags?:map'`: `!` obrigatório, `?` opcional, `~` calculado, `^` força recriação, `$` sensível),
  com validações e erros da API (nome de bucket ocupado, nome de storage inválido...).
- [`src/tf/motor.js`](src/tf/motor.js): `count`, `for_each`, `dynamic`, módulos locais, `lifecycle`,
  `moved`, `import`, `removed`, workspaces, `tfvars`, backends, aliases de provider, `default_tags`,
  valores desconhecidos até o apply e IDs falsos determinísticos.

**Importante:** é um simulador para aprender. Ele não substitui o Terraform de verdade nem cobre
todos os argumentos dos provedores. Antes de criar recursos reais, teste num ambiente controlado e
confira os custos.

## Como adicionar conteúdo

Cada módulo fica num arquivo em [`src/conteudo/`](src/conteudo/) (`basico.js`, `aws.js`, `azure.js` e
`projetos/`), com uma lista `itens` de lições e problemas, na ordem em que aparecem. Escreva o HCL com a
tag `` tf`...` `` e use `\${...}` para a interpolação do Terraform.

Um problema tem `enunciado`, `dica`, `dificuldade`, `inicial`, `solucao` e `testes`. Cada teste pode
trocar o comando (`comando: 'apply'`), as variáveis, o workspace, aplicar uma versão anterior antes
(`antes`) e ser oculto (`oculto: true`). As regras ficam documentadas em
[`src/verificacoes.js`](src/verificacoes.js):

| Regra | Confere |
| --- | --- |
| `{ semErros }` / `{ erro }` | o plano roda sem erro / o Terraform recusa com uma mensagem |
| `{ recurso, atributo, igual \| contem \| regex \| referencia }` | um atributo de um recurso do plano |
| `{ tipo, quantidade }` / `{ instancias }` | quantos recursos de um tipo ou de um bloco |
| `{ variavel }`, `{ local }`, `{ saida }`, `{ dado }`, `{ modulo }` | variáveis, locals, outputs, data sources e módulos |
| `{ plano }`, `{ movido }`, `{ lifecycle }`, `{ meta }`, `{ dependencia }` | resumo do plano e meta-argumentos |
| `{ backend }`, `{ requerido }`, `{ provider }` | bloco `terraform` e providers |
| `{ codigo }` / `{ semCodigo }` / `{ arquivo }` | regex no código e arquivos criados |

Os testes do projeto rodam **toda a trilha** no simulador: as lições não têm erros, cada solução passa
em todos os casos e cada código inicial ainda não passa.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local com recarga
npm run lint     # ESLint
npm test         # testes (motor, regras e toda a trilha)
npm run build    # gera dist/ (precisa de CERTIFICADO_SEGREDO)
npm run badges   # regenera badges, capa e ícones em public/
```

A cada push na `main`, o GitHub Actions ([`.github/workflows/pages.yml`](.github/workflows/pages.yml))
roda o lint e os testes, faz o build e publica no GitHub Pages.

## Licença

O Terraform Playground é **software livre com copyleft**:

- **Código**: [GNU AGPL-3.0-or-later](LICENSE).
- **Conteúdo didático** (lições, exercícios, projetos, glossário): [CC BY-SA 4.0](LICENSE-CONTEUDO.md).
  Crédito sugerido: "Terraform Playground, Sertão será cloud (CC BY-SA 4.0)".
- **Fora da licença**: o nome, a marca e o logotipo da Sertão será cloud e a emissão de certificados
  em nome dela.

**Marcas**: Terraform e HCL são marcas da HashiCorp; AWS é marca da Amazon; Azure é marca da Microsoft.
Este projeto é independente, não usa código da HashiCorp e não é afiliado nem endossado por elas.

Copyright (C) 2026 Sertão será cloud.
