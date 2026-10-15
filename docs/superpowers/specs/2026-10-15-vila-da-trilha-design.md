# Vila da trilha: cenário na largura da tela, estrada curva e uma vila que cresce com o progresso

**Data:** 2026-10-15 · **Sites:** DivergePython, DivergePHP e DivergeTerraform (o código dos cenários é o mesmo nos três)
**Parte de:** [cenários da trilha](2026-10-15-cenarios-da-trilha-design.md)

## O que muda

1. **100vw.** O cenário de cada módulo vai de uma borda à outra da janela (também por trás da coluna da
   esquerda), com a altura do módulo, e rola junto com a página (como já faz desde a 0.4.2 / 1.8.1 / 1.9.1).
2. **Estrada curva.** A estrada é uma curva suave que passa pelo centro de cada nó do caminho, em vez de
   uma faixa reta no meio.
3. **Vila.** Cada exercício concluído no módulo faz a vila crescer: um personagem constrói uma casa,
   nasce um filho, um animal tem um filhote.

Continua sendo **só decoração**: `aria-hidden`, sem foco, sem clique, sem texto; "reduzir movimento" e
alto contraste valem como hoje.

## Decisões

| Pergunta | Decisão |
|---|---|
| O que faz a vila crescer? | O progresso do aluno: os exercícios (itens `problema`) concluídos no módulo. Lições não contam. |
| Onde a vila fica guardada? | Em lugar nenhum: ela é **calculada** de `(semente do módulo, exercícios concluídos)`. Restaurar pelo certificado, importar e apagar os dados já valem para ela, sem dado novo no navegador. |
| Até onde vai o 100vw? | A tela toda, inclusive por trás da coluna da esquerda, que ganha fundo sólido. |
| Quando a vila muda? | Quando a trilha é desenhada de novo (ao voltar para ela depois de resolver um exercício). |

## 1. Largura da tela

- A camada `.cenario` deixa o cartão do módulo: `left` e `width` vêm do palco em JS. O palco mede a
  distância da seção do módulo até a borda esquerda da janela (`getBoundingClientRect().left`) e a
  largura útil da janela (`document.documentElement.clientWidth`, que não conta a barra de rolagem), e
  grava em `--cenario-desvio` e `--cenario-largura`. Sem medida (testes, tela escondida), usa 0 e 100%.
- `border-radius` sai; a página **não ganha rolagem horizontal** (`html { overflow-x: clip }`).
- A coluna da esquerda (perfil, Continuar, certificados) fica acima do cenário, com o fundo do tema.
- Ao redimensionar a janela, o mapa é refeito (o palco já faz isso, com espera de 200 ms).

## 2. Estrada curva

- O palco mede o centro de cada nó (`.trilha .alvo`) do módulo, em pixels relativos ao palco, e passa a
  lista ao `gerarMapa({ ..., caminho })` em coordenadas de tile.
- A curva é uma Catmull-Rom pelos centros dos nós, amostrada a cada meio tile, e se estende até o topo
  e o fim do mapa. É estrada todo tile cujo centro fica a até **2 tiles** da curva (cerca de 5 tiles de
  largura). O meio-fio é desenhado na borda entre estrada e não estrada, em qualquer direção.
- **Sem nós medidos** (testes no happy-dom, módulo vazio): a curva é a linha reta do centro, ou seja,
  o comportamento de hoje.
- Manchas de bloqueio e objetos continuam fora da estrada, agora espalhados nos dois lados do mapa
  largo; quem anda continua sem pisar na estrada (regras de `fisica.js` iguais).

## 3. Vila

Módulo novo `src/ui/cenarios/vila.js`, função pura:

```js
vila({ mapa, cenario, semente, feitos }) → { casas: [{ c, l }], filhos: [{ pai }], filhotes: [{ mae }] }
```

- **Ciclo:** o exercício nº *i* (1, 2, 3…) acrescenta, na ordem, 🏠 casa, 👶 filho, 🐣 filhote, e repete.
  Com 7 exercícios: 3 casas, 2 filhos, 2 filhotes.
- **Casas:** candidatos são os tiles de chão livre a até 3 tiles da estrada, sem outra casa vizinha
  (nem na diagonal). Os candidatos são embaralhados **uma vez** com a semente `${semente}-vila`, e a
  vila usa os primeiros. Assim a vila com *n + 1* exercícios contém a de *n* (nada muda de lugar). Sem
  candidato, a casa não entra. A casa vira o tile `casa`: ninguém anda por ela.
- **Quem é pessoa e quem é animal:** cada personagem do cenário ganha `tipo: 'pessoa' | 'animal'`
  (robozinho, peixe e letra "A" contam como animal; o balão e a pipa também). O filho nº *k* é da pessoa
  `k % pessoas`; o filhote nº *k*, do animal `k % animais`. Cenário sem pessoa: o filho vira filhote;
  sem animal: o filhote vira filho.
- **Desenho:** filho e filhote usam o sprite do pai ou da mãe com `escala 1` (16 px), no pé do tile de
  32 px, e andam com as mesmas regras do pai ou da mãe.
- **Limite:** proporcional ao espaço, **10 personagens por tela de altura** do módulo (4 no celular).
  Primeiro os de sempre (3 por tela, 1 no celular); depois filhos e filhotes até o limite. Assim a
  vila cresce com o módulo: num módulo de 9 telas cabem 63 filhos e filhotes. (Revisão a pedido do
  usuário: antes era um teto fixo de 30, que num módulo alto deixava só 3 vagas para a vila.)
- **Módulo bloqueado:** nenhum exercício feito, então a vila é vazia (e continua cinza, como hoje).
- **Dados:** `inicio.js` conta os exercícios concluídos do módulo e passa `htmlDoCenario(id, semente,
  feitos)`, que grava `data-feitos` na camada.

### Casas (16×16, uma por cenário)

| Cenário | Casa |
|---|---|
| `sertao` | casa de taipa com telhado de palha |
| `vale` | casa de sítio com alpendre |
| `gelo` | iglu |
| `fogo` | cabana de rocha vulcânica |
| `rio` | palafita |
| `jardim` | casinha com flores na janela |
| `cidade` | prédio pequeno com janelas acesas |
| `tipografia` | oficina com a placa de uma letra |
| `feira` | casa de lona listrada |
| `forja` | casa de pedra com chaminé fumegando |
| `arquivo` | chalé de madeira |
| `canteiro` | casa em obra, com andaime |
| `porto` | casa feita de contêiner |
| `ceu` | casa flutuando numa nuvem |

Cada cenário ganha o campo `casa` (sprite). No alto contraste, a casa é desenhada só em contorno, como
os objetos.

## Testes

- `vila`: mesma semente e progresso dão a mesma vila; a vila de *n + 1* contém a de *n*; o ciclo
  casa → filho → filhote; o limite proporcional ao espaço (10 por tela, 4 no celular); as trocas sem pessoa ou sem animal; ninguém pisa numa casa.
- Estrada: com nós em zigue-zague, o tile de cada nó é estrada; sem nós, igual a hoje (testes atuais).
- Cada cenário tem `casa` 16×16 e personagens com `tipo`.
- Palco: `data-feitos` vira casas, filhos e filhotes no DOM; filhos e filhotes têm a classe `pequeno`.
- Largura: a camada recebe `--cenario-desvio` e `--cenario-largura`; o CSS tem `overflow-x: clip`.
- No navegador: sem rolagem horizontal, estrada sob os nós e axe sem violações nos 4 temas.

## Fora do escopo

Animações de construção ou de nascimento, nomes dos moradores e qualquer dado novo no navegador.
