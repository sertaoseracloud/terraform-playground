# Débito técnico dos playgrounds

Diagnóstico de 2026-10-20 dos quatro playgrounds da Sertão será cloud: DivergePHP (`php-playground`),
DivergeTerraform (`terraform-playground`), DivergePython (`python-playground`) e DivergeKubernetes
(`kubernetes-playground`). Este arquivo é igual nos quatro repositórios (faz parte dos arquivos
comuns, veja [Arquivos comuns](#arquivos-comuns)).

Escala usada nas tabelas:

- **Impacto:** alto (afeta quem estuda ou pode quebrar produção), médio (atrasa quem mantém), baixo (higiene).
- **Esforço:** P (até 1 hora), M (algumas horas), G (um dia ou mais).

## O que é débito técnico, em poucas palavras

- **Débito técnico** é o atalho de hoje que cobra juros amanhã.
  - Analogia: consertar o cano com fita adesiva. Funciona, mas cada vazamento novo custa mais caro.
- **Código duplicado** é a mesma peça copiada em vários repositórios.
  - Analogia: quatro cópias da mesma receita em cadernos diferentes. Corrigir o sal em uma não corrige as outras.
- **Divisão do código (code splitting)** é baixar só o pedaço do site que a pessoa vai usar agora.
  - Analogia: o garçom traz o prato principal quando você pede, não o cardápio inteiro já servido na mesa.

## Situação comum aos quatro

| Débito | Impacto | Esforço | Correção proposta |
| --- | --- | --- | --- |
| **Código duplicado.** Medido nesta data: 20 arquivos idênticos em todos os repositórios onde existem e 65 quase iguais (80% ou mais das linhas em comum), entre eles a interface de acessibilidade, certificados, `restaurar.js`, cenários (vila, mapa, palco), tutorial, privacidade, `validador.js`, `neuro.js` e os scripts de badges e histórico. Uma correção feita num repositório não chega aos outros. | médio | M | `scripts/comuns.mjs` + `comuns.json`: a lista dos arquivos que devem ser iguais, com o hash de cada um. O job `qualidade` falha se um arquivo comum mudar sem atualizar a lista; a auditoria semanal compara as listas dos quatro repositórios e avisa quando divergem; `npm run comuns:copiar -- ../outro-repo` leva a versão nova para os irmãos. Sem pacote publicado e sem mudar URLs: cada site continua sendo um build independente no GitHub Pages. |
| **`@noble/ed25519` 2 → 3 e `@noble/hashes` 1 → 2** ficaram para depois. | médio | P | Atualizar. Conferido antes: com a mesma semente, a versão 3 gera a mesma chave pública e a mesma assinatura da versão 2, e verifica assinaturas antigas. Certificados já emitidos continuam válidos. |
| **`qrcode-generator` 1 → 2.** | baixo | P | Atualizar. Conferido: o QR Code do PIX sai idêntico, bit a bit. |
| **`npm audit`.** | — | — | Nenhuma vulnerabilidade nos quatro (0 em todas as severidades). |
| **Releases param de ser publicadas.** O job `tag` cria só a tag; a última release publicada é bem mais antiga que a última tag (php: release v1.7.0, tag v1.9.5; terraform: v1.8.0 e v1.10.3; python: v0.4.1 e v1.0.4; kubernetes: nenhuma release, tag v0.7.0). | médio | P | O job `tag` passa a criar a release com o texto da versão em `src/novidades.js`. As tags que ficaram sem release ganham a sua. Tags de versões intermediárias que nunca foram para a `main` não são recriadas: elas nunca foram publicadas. |
| **Node no CI.** O diagnóstico anterior apontava Node 22 no php e no terraform. | — | — | Já resolvido: os quatro usam Node 24 em todos os jobs. |
| **`feature-pr.yml`.** O `--head dono:branch` não encontra o PR aberto e o workflow tenta criar outro a cada push. | médio | P | php e python recebem a correção já feita no kubernetes e no terraform (busca só pelo nome do branch e não sobrescreve título e descrição escritos por pessoas). O `token:` duplicado do terraform já saiu no PR #14. |
| **Branches antigos.** 25 branches remotos fora de `main` e `develop`, todos com o conteúdo já no `develop` (conferido com `git cherry`: nenhum commit sem equivalente). | baixo | P | Apagar, **com confirmação**. |
| **Bundle principal grande.** No php, `index.js` tem 1,16 MB (373 kB com gzip): CodeMirror, todas as telas e todo o conteúdo vão juntos, inclusive na landing. | alto | G | Carregar a tela do exercício (editor CodeMirror incluído) só quando a pessoa abre um exercício, com `import()` dinâmico. Medir com Lighthouse antes e depois. Fica para uma segunda etapa, porque toca `src/main.js`, que a sessão de usabilidade também está alterando. |
| **Runtime carregando na landing.** | — | — | Já resolvido: `MotorPHP.garantir()` e `MotorPython.garantir()` só criam o worker no primeiro exercício. A landing e a trilha não baixam o PHP nem o Python. |
| **Botões de troféu** com `aria-label` que não contém o texto visível (axe: `label-content-name-mismatch`). Quem usa comando de voz fala o que vê ("Certificado liberado") e o botão não responde. | alto | P | Tirar o `aria-label`: o nome acessível passa a ser o texto visível, e o complemento ("Certificado: nome do módulo") vai num texto só para leitores de tela, depois dele. |

## DivergePHP (`php-playground`)

| Débito | Impacto | Esforço | Correção proposta |
| --- | --- | --- | --- |
| Sem limite de cobertura e sem `@vitest/coverage-v8`: a cobertura pode cair sem ninguém notar. | médio | P | Medir, configurar o limite igual à medida arredondada para baixo e rodar com cobertura no CI. |
| O tutorial abre sozinho em cima do editor para quem chega por link direto num exercício; o aviso de privacidade cobre o editor; a descrição pode ficar com 280 px. | alto | P | Levar as melhorias do kubernetes e do terraform: tutorial abre sozinho só na trilha, aviso dentro da coluna da descrição, descrição com no mínimo 320 px. |
| Branch padrão do GitHub é `main`, não `develop`. PRs e clones novos partem do lugar errado. | médio | P | Trocar para `develop` (configuração do repositório: **com confirmação**). |
| Releases v1.8.x e v1.9.x não publicadas (última release v1.7.0, tag v1.9.5). | médio | P | Release da v1.9.5 e da versão desta entrega. |

## DivergeTerraform (`terraform-playground`)

| Débito | Impacto | Esforço | Correção proposta |
| --- | --- | --- | --- |
| PR #15 (develop → main, v1.10.4) aberto com todos os checks verdes. | médio | P | Mesclar antes desta entrega, criar a tag e fazer o back-merge. |
| Limite de cobertura (72/65/65/74) abaixo do medido hoje. | baixo | P | Subir até a medida atual. |
| Releases v1.9.x e v1.10.x não publicadas. | médio | P | Releases da v1.10.3, v1.10.4 e desta entrega. |

## DivergePython (`python-playground`)

| Débito | Impacto | Esforço | Correção proposta |
| --- | --- | --- | --- |
| Sem limite de cobertura. | médio | P | Igual ao php. |
| Mesmas melhorias da tela do exercício que faltam no php. | alto | P | Igual ao php. |
| Branch padrão é `main`. | médio | P | Trocar para `develop`, **com confirmação**. |
| 9 branches antigos (`fase-4`, `fase5`, `fase6`, `fase6-2`, `fase6-3`, `cenarios-do-python`, `celular-iphone`, `rodada-validacao`, `feature/mural-apoio`). | baixo | P | Apagar, **com confirmação**. |
| Release v1.0.x não publicada (última release v0.4.1, tag v1.0.4). | médio | P | Release da v1.0.4 e desta entrega. |

## DivergeKubernetes (`kubernetes-playground`)

| Débito | Impacto | Esforço | Correção proposta |
| --- | --- | --- | --- |
| 91 dos 256 exercícios não têm casos ocultos: os 50 de Fundamentos, os 35 de Recursos Avançados e os 6 do projeto de microsserviços. AWS, Azure, projetos e o projeto multicloud já têm. Sem casos ocultos, dá para passar decorando os casos visíveis. | alto | G | Um caso oculto por exercício, conferindo o resto do que os passos pedem, no mesmo formato de `comOcultos` usado na AWS. Um teste garante que todo exercício tem pelo menos um. |
| Faltam 5 exercícios em Recursos Avançados para a trilha chegar a 261. O branch `feature/avancados-extra` não existe (nem no GitHub nem em cópias locais): o trabalho do agente anterior se perdeu. | médio | M | Escrever os 5 exercícios novos, já com casos ocultos, com ids novos (nenhum id existente muda). |
| Nenhuma release publicada (tags v0.1.0 a v0.7.0). | médio | P | Releases das tags existentes e desta entrega. |
| `# TODO` em `avancados-escala.js`. | — | — | Não é débito: são os esqueletos didáticos que o aluno completa no editor. |

## Arquivos comuns

- `comuns.json` lista os arquivos que precisam ser iguais nos quatro repositórios e o hash SHA-256 de cada um (com finais de linha LF).
- `npm run comuns` confere os arquivos contra a lista. Roda no job `qualidade`.
- `npm run comuns:copiar -- ../terraform-playground ../python-playground ../kubernetes-playground` copia os arquivos comuns deste repositório para os outros e atualiza a lista de cada um.
- `npm run comuns:comparar` baixa o `comuns.json` do `develop` dos outros três e mostra o que diverge. Roda na auditoria semanal.
- Para mudar um arquivo comum: altere num repositório, rode `comuns:copiar` para os outros e abra um PR em cada um.
- Fica de fora da lista o que é de propósito diferente em cada playground (conteúdo, motor da linguagem, textos com o nome do curso).

## Fora do escopo desta rodada

- Arquivos de cenários (`src/ui/cenarios/*`, `src/cenarios.css`): a migração para PixiJS está em andamento numa sessão separada. Entram na lista de comuns quando ela terminar.
- Usabilidade e acessibilidade geral (foco, alvos de toque, reflow, `index.html`): em andamento na sessão de usabilidade.
