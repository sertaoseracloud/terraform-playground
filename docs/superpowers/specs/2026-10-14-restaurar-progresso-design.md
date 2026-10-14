# Restaurar o progresso pelo certificado — design

Data: 2026-10-14 · Sites: DivergePython, DivergePHP e DivergeTerraform (o mesmo código nos três)

## Objetivo

O progresso fica só no `localStorage`. Quem troca de computador, limpa o navegador ou usa outro
navegador perde a trilha, mas continua com os links dos certificados. A ideia é que esse link,
validado no próprio site, devolva o progresso que ele comprova.

Critério de sucesso: o aluno valida um certificado seu num navegador "zerado", restaura o
progresso e o site emite de novo **o mesmo certificado**, com o mesmo selo e o mesmo código.

## Decisões (respostas do usuário)

- O nome comparado é **o que já está salvo neste navegador** (`lerNome()`).
- A comparação é **exatamente igual**: tira só os espaços das pontas. Maiúsculas e acentos contam.
- Volta **o módulo certificado e os anteriores da cadeia**.
- Vale **nos três sites**.

## Premissas (ditas ao usuário, sem objeção)

- A restauração só **acrescenta** progresso; nunca apaga nem rebaixa nada.
- Os rascunhos de código não voltam, porque o certificado não guarda código.
- A sequência 🔥 de dias não volta, e restaurar não conta como atividade do dia.

## Onde aparece

Só na validação por **link ou código**: no resultado inicial de `#/validar/<código>` e na aba
"Link ou código". Fica abaixo da caixa de resultado e só existe quando o selo é `confere`.

- O impresso fica fora porque não carrega as datas dos certificados anteriores.
- O XML também fica fora, para manter um caminho só. Quem tem o XML tem também o link do
  certificado (ele está dentro do arquivo), e é esse link que restaura.

## Os três casos do nome

Seja `salvo = lerNome().trim()` e `doCertificado = cert.nome.trim()`.

1. **Sem nome salvo** (`salvo === ''`):
   - O bloco explica que o progresso só volta para quem salvou o nome exatamente como está no
     certificado.
   - Ele tem um botão "✏️ Salvar o meu nome" que abre o diálogo de nome que já existe (`pedirNome`,
     exportado de `src/ui/inicio.js`). O diálogo não vem preenchido com o nome do certificado.
     Depois de salvar, o bloco é redesenhado na hora.
   - No caso do nome diferente, o mesmo botão aparece como "✏️ Trocar o nome deste navegador".
   - Não há botão de restaurar.
2. **Nome diferente** (`salvo !== doCertificado`):
   - O bloco mostra os dois nomes, o do certificado e o deste navegador.
   - O texto diz que o progresso só volta com o nome igual, inclusive acentos e maiúsculas.
   - Não há botão.
3. **Nome igual**:
   - O bloco lista o que volta, uma linha por módulo: "Fundamentos de Python · 40 exercícios e
     N lições · concluído em 13/10/2026", com os números tirados do conteúdo.
   - Abaixo da lista fica o botão **"↩️ Restaurar o meu progresso neste navegador"**.
   - Depois do clique, o bloco vira uma confirmação com um link "Ir para a trilha".
   - A confirmação também é anunciada para leitores de tela pelo `anunciar()` de
     `src/ui/anuncios.js`.

A comparação não impede ninguém de digitar o nome alheio e restaurar. Ela evita o engano, e não
uma fraude. Restaurar só copia neste navegador o que o certificado já prova publicamente, e o
certificado que sair de novo terá o nome do certificado original. Por isso, não há o que
proteger além disso.

## O que é restaurado

Para cada elo da cadeia, ou seja, `[...cert.cadeia, { modulo: cert.modulo, data: cert.data }]`:

- Se o módulo é `final` (DivergePHP e DivergeTerraform), ele não tem itens próprios e é pulado.
  A data dele sai sozinha, como a mais recente dos módulos.
- Senão, cada item do módulo em `conteudo/trilha.js` (lições e exercícios) passa a ter:
  - `progresso[id] = 'resolvido'`;
  - `datas[id] = data do elo`, a data de conclusão daquele módulo no certificado.

A data é sobrescrita mesmo em item que já estava resolvido. O certificado é a fonte da verdade:
como a conclusão do módulo é a data mais recente dos exercícios (`concluidoEm` em
`calcularJornada`), qualquer data diferente mudaria o selo do certificado emitido de novo.

Os módulos fora da cadeia e todos os outros dados ficam como estão: tentativas, rascunhos,
preferências e itens tentados.

Se o conteúdo ganhou exercícios depois da emissão, eles também voltam como resolvidos. O
certificado diz "concluiu o módulo", e o módulo de hoje é o que existe.

## Código

### `src/restaurar.js` (novo, idêntico nos três repos)

Funções puras, testáveis sem navegador:

```js
/**
 * O que um certificado válido devolve: um bloco por módulo da cadeia, com os itens dele.
 * `modulos` é o de conteudo/trilha.js.
 */
export function planoDeRestauracao(cert, modulos)
// → [{ modulo, titulo, data, licoes, exercicios, ids: [...] }]

/** 'sem-nome' | 'nome-diferente' | 'pode' */
export function situacaoDoNome(cert, nomeSalvo)
```

### `src/progresso.js` (os três ganham a mesma função)

```js
/** Marca os itens como resolvidos nas datas dadas, sem mexer no resto. [{ id, data }] */
export function restaurarItens(itens)
```

- Ela grava `progresso` e `datas` de uma vez.
- Ela não chama `registrarAtividade`.

### `src/ui/validador.js`

- `resultadoDoLink` continua devolvendo só HTML.
- O bloco de restauração é uma função separada, `blocoRestaurar(cert)`, que monta o HTML do caso.
- O `renderValidador` liga o botão: chama `restaurarItens`, troca o bloco pela confirmação e
  chama `anunciar`.
- `resultadoDoXml` continua sem o bloco, e o `titulo` opcional fica como está.

## Testes (os mesmos nos três repos)

- `tests/restaurar.test.js`:
  - O plano tem um bloco por elo, e o `final` não traz itens.
  - Os três casos do nome, incluindo espaços nas pontas (contam como igual) e a diferença de
    acento ou maiúscula (conta como diferente).
  - O teste de ida e volta: emitir um certificado com datas conhecidas, decodificá-lo, restaurar
    num `localStorage` vazio e recalcular `certificadosDaJornada`. O certificado gerado de novo
    tem o mesmo código.
- Ainda em `tests/restaurar.test.js` (não existe `tests/progresso.test.js`):
  - `restaurarItens` não rebaixa nada, sobrescreve a data e não registra atividade.
- `tests/restaurar-ui.test.js` (novo, happy-dom, idêntico nos três repos):
  - Selo `nao-confere` não mostra o bloco.
  - Nome igual mostra o botão.
  - O clique restaura e anuncia.

## Versões

| Site | Versão | Motivo |
|---|---|---|
| DivergePython | 0.4.1 | sai antes da fase 5 (0.5.0) |
| DivergePHP | 1.6.0 | recurso novo |
| DivergeTerraform | 1.7.0 | recurso novo |

As três passam pela rodada de acessibilidade de sempre (axe-core WCAG 2.2 AA nos 4 temas) antes de
publicar, e cada publicação espera o "sim".

## Fora do escopo

- Restaurar pelo impresso ou pelo XML.
- Restaurar rascunhos, sequência, tempo de tentativa ou preferências.
- Um "arquivo de backup" do progresso. O LGPD já exporta os dados, mas importar é outra conversa.
