# Cenários da trilha — design

Data: 2026-10-15 · Sites: DivergePython, DivergePHP e DivergeTerraform (o mesmo componente nos três)

## Objetivo

Hoje a trilha é um caminho em ziguezague sobre um fundo liso. A ideia é deixá-la parecida com o
mapa de um jogo:

- cada módulo ganha um **cenário** (sertão, gelo, fogo, rio…) atrás do seu trecho do caminho;
- **personagens** do cenário andam por ele.

O aluno sente que está atravessando regiões diferentes à medida que avança.

Critério de sucesso: ao rolar a trilha, cada módulo tem o seu cenário e personagens em movimento.
Nada disso atrapalha:
- o caminho continua com o mesmo contraste, as mesmas cores dos nós e o mesmo foco;
- o leitor de tela lê exatamente o que lê hoje;
- quem pede "reduzir movimento" vê tudo parado;
- a trilha continua leve no celular.

## Decisões (respostas do usuário)

- É **um cenário por módulo**, cada um ligado ao assunto do módulo. Os personagens andam por ele.
- Na primeira conferência, o usuário pediu **tiles em pixel art no estilo do Tibia** (16×16 ampliado 2×) e uma física de verdade: passo a passo de tile em tile, com colisão.
- Além de fogo, gelo e o normal, entram **outros cenários**.
- Os **três sites** recebem os cenários agora.
- O trabalho tem **spec e plano próprios**. Sai na DivergePython 0.5.0, junto com a fase 5, e numa
  versão nova dos outros dois sites.

## Cenários

| Id | Cenário | Elementos do fundo | Personagens |
|---|---|---|---|
| `sertao` | 🌵 Sertão (o normal) | serra, mandacarus, sol | vaqueiro, cabrita, calango |
| `vale` | 🌱 Vale verde | roçado em canteiros, cerca, açude | agricultora, jumento, asa-branca (voando) |
| `gelo` | ❄️ Gelo | geleira, cristais iguais lado a lado, neve caindo | pinguim, raposa-do-ártico, coruja-das-neves (voando) |
| `fogo` | 🔥 Fogo | vulcão, rios de lava, faíscas subindo | salamandra, ferreiro, fênix (voando) |
| `rio` | 💧 Rio e cachoeira | cachoeira, correnteza, pedras | jangadeiro (na água), peixe (saltando), garça |
| `cidade` | 🌃 Cidade à noite | prédios em construção, guindaste, janelas acesas | operária, robozinho, gato |
| `jardim` | 🌸 Jardim florido | canteiros de flores coloridas, arco | jardineira, borboleta (voando), beija-flor (voando) |

## Módulo → cenário

| Site | Módulo | Cenário |
|---|---|---|
| DivergePython | `basico` | `sertao` |
| | `dados` | `vale` |
| | `paralelismo` | `gelo` |
| | `pyspark` | `fogo` |
| | `alem` (fase 5) | `rio` |
| | `projetos` (fase 6) | `cidade` |
| DivergePHP | `html` | `tipografia` |
| | `w3css` | `feira` |
| | `php` | `forja` |
| | `pdo` | `arquivo` |
| | `projetos` | `cidade` |
| DivergeTerraform | `basico` | `canteiro` |
| | `aws` | `porto` |
| | `azure` | `ceu` |
| | `projetos` | `cidade` |

> **Revisão de 2026-10-15: cada site com os seus cenários.** Os cenários da tabela de cima ficam
> no DivergePython. O PHP e o Terraform ganharam cenários com o tema do assunto (só `cidade` é de
> todos), no mesmo formato: chão, estrada, bloqueio, 2 objetos e 3 personagens em 16×16.
>
> | Site | Id | Cenário | Chão / estrada | Bloqueio | Objetos | Personagens |
> |---|---|---|---|---|---|---|
> | PHP | `tipografia` | 🖨️ Tipografia | papel creme, tábuas | tinta derramada | prensa, caixa de tipos | tipógrafa, aprendiz, letra "A" (saltando na tinta) |
> | PHP | `feira` | 🧵 Feira de tecidos | lona colorida, pedras | rolos de pano | barraca listrada, carretel | costureira, vendedor, borboleta (voando) |
> | PHP | `forja` | ⚒️ Forja | pedra escura, pedras | brasas | bigorna, martelo | ferreira, ajudante, elefantinho azul do PHP |
> | PHP | `arquivo` | 🗄️ Arquivo | madeira, tábuas | pilhas de pastas | gaveteiro, fichário | arquivista, mensageiro, coruja (voando) |
> | Terraform | `canteiro` | 🏗️ Canteiro de obras | terra batida, tábuas | cones e fita | guindaste, pilha de blocos | mestre de obras, engenheira, pássaro (voando) |
> | Terraform | `porto` | ⚓ Porto laranja | cais de concreto, pedras | água | contêineres, guindaste do porto | estivador, rebocador (na água), gaivota (voando) |
> | Terraform | `ceu` | ☁️ Céu de nuvens | nuvem clara, nuvem azulada | vão do céu | torre de servidores, raio | técnica, balão e pipa (voando) |

O cartão "em breve" dos módulos futuros (`PROXIMOS_MODULOS`) fica sem cenário. O cenário só
aparece quando o módulo existe.

## Como funciona

> **Revisão de 2026-10-15** (pedido do usuário depois da primeira conferência). As paisagens
> vetoriais viraram um **mapa de tiles em pixel art, no estilo do Tibia**, e os personagens passaram
> a andar **de tile em tile**, com colisão. A primeira versão desta seção, com SVG e deslize em CSS,
> está no histórico do git (commit `1417278`).

### Mapa em tiles

- **Tiles e pixel art:** tiles quadrados de **32px**. Cada um é um sprite de **16×16 pixels**
  ampliado 2×, sem suavização (`imageSmoothingEnabled = false` e `image-rendering: pixelated`).
- **Cada cenário define:**
  - **chão:** 3 variações do tipo principal, sorteadas com pesos para não repetir o padrão;
  - **área bloqueada:** água, lava, gelo partido ou açude, desenhada em manchas (2 a 3 por tela);
  - **bordas:** desenhadas por código. Onde o chão toca a área bloqueada, uma faixa de 2px mais
    escura, mais uma linha de espuma ou brasa, como as margens do Tibia;
  - **objetos:** 2 a 3 tipos (mandacaru, pedra, árvore, cristal, poste, canteiro…), que também
    bloqueiam;
  - **estrada:** o tile da faixa central, por baixo do caminho dos exercícios (terra batida, ponte
    de madeira, pedra, calçada…).

| Cenário | Chão | Área bloqueada | Objetos | Estrada |
|---|---|---|---|---|
| sertao | terra e areia | açude | mandacaru, pedra | terra batida |
| vale | grama | água | árvore, cerca | terra |
| gelo | neve | gelo partido | cristal, pedra de gelo | gelo liso |
| fogo | rocha vulcânica | lava | pedra, braseiro | pedra escura |
| rio | grama da margem | água corrente | pedra, junco | ponte de madeira |
| cidade | calçada | — (sem área bloqueada) | poste, caixa | asfalto |
| jardim | grama | — (sem área bloqueada) | canteiro de flores, arbusto | pedrinhas |

- **O mapa de cada módulo** é gerado por `gerarMapa({ colunas, linhas, cenario, semente })`, uma
  função pura e determinística: a mesma semente sempre dá o mesmo mapa.
  - A semente vem do id do módulo.
  - A estrada ocupa as colunas centrais que ficam embaixo do ziguezague dos nós (±112px do centro).
  - Manchas e objetos ficam só fora da estrada.
- **Desenho:** o mapa é desenhado uma vez num `<canvas>` decorativo do tamanho do palco (o palco de
  100vh que acompanha a rolagem do módulo). É redesenhado quando o tamanho muda (com espera de
  200 ms) ou quando o tema muda.

### Física dos personagens

- Cada personagem ocupa um tile e anda **um tile por passo**, nas 4 direções (cima, baixo,
  esquerda, direita). O passo dura **0,4 s**, com transição CSS de `transform`, e alterna 2 quadros
  de caminhada.
- O personagem vira para o lado em que anda (o sprite é espelhado na horizontal). Em ~20% dos
  passos, fica parado.
- **Colisão:** quem anda ou nada nunca entra em área bloqueada, objeto ou estrada (assim nunca cobre
  um nó), nem sai do mapa.
  - **Voadores** (asa-branca, coruja, fênix, borboleta e beija-flor) passam por cima de tudo, menos da
    estrada. Têm uma sombra oval no chão e o sprite fica 8px acima.
  - O **peixe** só existe dentro da água: nada nela e às vezes salta, subindo e voltando no mesmo
    tile.
  - O **jangadeiro** só anda na água.
- A escolha do próximo passo é a função pura `proximoPasso(personagem, mapa, sorteio)`.
- Um único temporizador por página (`setInterval` de 400 ms) move os personagens dos cenários
  **visíveis**. Não há trabalho a cada quadro.
- **O temporizador não roda quando:**
  - nenhum cenário está na tela (`IntersectionObserver`);
  - a aba está oculta (`document.hidden`);
  - "reduzir movimento" está ligado (`prefers-reduced-motion` ou `a11y-sem-movimento`). Nesse caso,
    os personagens ficam parados no lugar inicial, e o temporizador nem é criado;
  - o tema é `alto-contraste`;
  - o módulo está bloqueado.
- **Quantos personagens:** 3 por cenário, nas laterais, fora da estrada. No celular (largura < 600px),
  só o personagem 1.

### Arquivos (idênticos nos três repos, menos o mapa)

| Arquivo | Conteúdo |
|---|---|
| `src/ui/cenarios/pixel.js` | `sprite(paleta, linhas)` (valida 16×16) e `desenharSprite(ctx, sprite, x, y, { escala, espelhar })` |
| `src/ui/cenarios/<id>.js` | Os sprites de chão, objetos e estrada de cada cenário, mais os 3 personagens com 2 quadros cada, e `bloqueio` (cor e borda da área bloqueada) |
| `src/ui/cenarios/mapa.js` | `gerarMapa` e o sorteio com semente (`sorteador(semente)`) |
| `src/ui/cenarios/fisica.js` | `proximoPasso` e `posicoesIniciais(mapa, personagens, sorteio)` |
| `src/ui/cenarios/palco.js` | `ligarCenarios(raiz)`: desenha os mapas, cria os personagens, liga o temporizador, o `IntersectionObserver`, o redimensionamento e a troca de tema; devolve `desligar()` |
| `src/ui/cenarios/index.js` | `CENARIOS` e `htmlDoCenario(id)`; a camada fica vazia até o `ligarCenarios` desenhar |
| `src/conteudo/cenarios.js` | O mapa `{ moduloId: cenarioId }` de cada site |
| `src/cenarios.css` | Palco, pixelização, transição do passo, sombra dos voadores e temas |

### Na trilha (`src/ui/inicio.js`)

- Como antes, cada `section.bloco-unidade` tem a camada `aria-hidden` como primeiro filho.
- Depois de renderizar, `renderInicio` chama `ligarCenarios(el)`.
- Na renderização seguinte, desliga os anteriores (temporizador e observadores).

### Acessibilidade e conforto

- Continua igual: toda a camada tem `aria-hidden`, sem texto, sem foco e sem clique
  (`pointer-events: none`). O caminho, os nós e as legendas mantêm as cores e o véu.
- **Temas:**
  - `dracula` e `claro`: o mapa com a opacidade de hoje (.45);
  - `suave`: `filter: saturate(.5) brightness(.9)`;
  - `alto-contraste`: o mapa vira uma grade de contorno, só a borda de cada área bloqueada e de cada
    objeto na cor `--suave`, sobre o fundo. Os personagens ficam parados e em contorno.

### Desempenho

- Os sprites de um cenário somam no máximo **12 KB** de definição.
- O canvas é desenhado uma vez por tamanho e por tema.
- O temporizador mexe só em `transform` e na troca de quadro dos personagens visíveis.

## Testes (os mesmos nos três repos)

- **`tests/cenarios.test.js`:**
  - os 7 cenários existem, com sprites 16×16 válidos (todas as cores da paleta definidas), 3
    personagens de 2 quadros cada e no máximo 12 KB;
  - `htmlDoCenario` devolve a camada com `aria-hidden`, sem texto, sem foco e sem ids;
  - um id desconhecido devolve `''`.
- **`tests/cenarios-mapa.test.js`:**
  - `gerarMapa` é determinístico pela semente;
  - a estrada cobre a faixa dos nós, e as manchas e os objetos não a tocam;
  - sobram tiles livres dos dois lados.
- **`tests/cenarios-fisica.test.js`**, em 2 000 passos simulados:
  - quem anda nunca entra em área bloqueada, objeto, estrada nem fora do mapa;
  - todo passo vai para um vizinho de 4 direções, ou fica parado;
  - voadores atravessam a área bloqueada, mas não a estrada;
  - o peixe e o jangadeiro nunca saem da água.
- **`tests/cenarios-trilha.test.js`:**
  - cada módulo tem o seu cenário;
  - o caminho não muda para o leitor de tela;
  - `ligarCenarios` não cria temporizador com "reduzir movimento", no alto contraste nem sem
    `IntersectionObserver`, e `desligar()` limpa tudo;
  - o CSS mantém `pointer-events: none`, o palco sticky, a pixelização e o véu da legenda.
- **Conferência manual:**
  - screenshots dos 7 cenários (no PHP e no Terraform, os deles), nos 4 temas;
  - axe WCAG 2.2 AA;
  - a 375px;
  - "reduzir movimento" ligado (nada se move);
  - o personagem nunca pisa na estrada nem na água.

## Versões

| Site | Versão |
|---|---|
| DivergePython | 0.5.0 (com a fase 5) |
| DivergePHP | 1.7.0 |
| DivergeTerraform | 1.8.0 |

O DivergePHP e o DivergeTerraform podem sair antes da DivergePython 0.5.0, assim que os cenários
estiverem prontos. Cada publicação espera o "sim".

## Fora do escopo

- Personagens interativos (clicar, falar) ou que reagem ao progresso.
- Som.
- Cenário na landing page e nas telas de exercício.
- Escolher o cenário no painel ♿. O cenário é do módulo.
