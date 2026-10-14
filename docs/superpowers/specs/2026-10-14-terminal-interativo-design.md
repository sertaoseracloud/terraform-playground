# DivergeTerraform: terminal interativo

Especificação de design aprovada na conversa de 14/10/2026. Versão de entrega: **1.6.0**.

## 1. Objetivo

O terminal do DivergeTerraform deve funcionar o mais perto possível de um terminal de verdade:
a pessoa digita os comandos do Terraform no prompt, o `apply` e o `destroy` perguntam
`Enter a value:` e só seguem com `yes`, e os comandos do dia a dia funcionam como no real.

**Critérios de sucesso**

- Os comandos da seção 4 funcionam digitados, com a saída no formato do Terraform 1.13.
- `apply` e `destroy` esperam a pessoa digitar `yes` (ou aceitam `-auto-approve`).
- Os botões ▶ Plan, ✔ Apply e 🗑 Destroy continuam, como atalhos que digitam o comando.
- A correção automática não muda.
- Tudo funciona pelo teclado e com leitor de tela (WCAG 2.2 AA nos quatro temas).

## 2. Decisões tomadas

| Pergunta | Decisão |
| --- | --- |
| Comandos | Os do dia a dia (seção 4) e os do shell (`ls`, `cat`, `clear`, `help`) |
| `apply`/`destroy` | Mostram o plano e terminam em `Enter a value:`; só `yes` aprova; `-auto-approve` pula |
| Botões | Continuam: digitam o comando no terminal; o ✔ Apply espera o `yes`, como no real |
| `init` | Passa a ser um passo de verdade: sem `init` (ou com um provedor novo no código), os outros comandos dão o erro do Terraform pedindo `terraform init`; os botões rodam o `init` antes quando precisa |
| Animação | A atual continua (o "Terraform pensando", o `Still creating...`), também nos comandos digitados; nada anima com "reduzir animações" |

## 3. O terminal (tela)

Igual ao do DivergePython:

- A saída rola e, embaixo, o prompt `aluno@sertao:~/<exercício>$` com um campo de digitação na
  mesma linha e o cursor piscando (sem piscar com "reduzir animações").
- Clicar no terminal põe o foco no campo.
- Teclas: Enter roda; ↑/↓ histórico (salvo, até 100 comandos); Tab completa comandos,
  subcomandos, nomes de arquivo e endereços de recurso (`state show aws_s3_bucket.<Tab>`);
  Ctrl+C cancela o comando (no `Enter a value:`, cancela o apply: `Apply cancelled.`);
  Ctrl+L limpa; Esc tira o foco do terminal; Esc durante a animação continua pulando a animação.
- Acessibilidade: campo com rótulo ("Comando do terminal", "Resposta do Terraform: digite yes
  para aprovar", "Expressão do terraform console"); a saída nova vai para uma região anunciada
  (`role="log"`); a pergunta do `apply` é falada.

## 4. Comandos

| Comando | Faz |
| --- | --- |
| `terraform init` | Inicializa: provedores, lock file, backend (a saída de hoje) |
| `terraform validate` | `Success! The configuration is valid.` ou os erros |
| `terraform fmt [-check] [-diff]` | Reformata os arquivos `.tf` no editor (alinha os `=`, recuo de 2 espaços) e lista os que mudaram; `-check` só lista e sai com erro; `-diff` mostra as diferenças |
| `terraform plan [-var 'x=1'] [-destroy]` | O plano (a saída de hoje) |
| `terraform apply [-auto-approve] [-var ...]` | Plano, pergunta e, com `yes`, o apply |
| `terraform destroy [-auto-approve]` | Plano de destruição, pergunta e, com `yes`, a destruição |
| `terraform output [nome] [-json] [-raw]` | Os outputs do estado |
| `terraform show [-json]` | O estado em texto (ou o tfstate em JSON) |
| `terraform state list` / `state show <endereço>` | Recursos no estado / atributos de um recurso |
| `terraform workspace list / show / select <n> / new <n>` | Ligado ao seletor 🗂 que já existe |
| `terraform graph` | Mostra o grafo em texto (DOT) e abre a aba 🕸️ Grafo |
| `terraform console` | Prompt `>` que avalia expressões HCL com as variáveis, locals, data sources e o estado; `exit` ou Ctrl+D saem |
| `terraform version` / `terraform -help` | Versão do simulador e ajuda |
| `ls`, `cat <arquivo>`, `clear`, `help` | Shell |
| outro | `bash: <comando>: command not found` (ou `Terraform has no command named "x"`) |

## 5. Arquitetura

```
src/ui/terminal.js     tela do terminal (a animação de hoje + campo, histórico, teclas)
src/ui/shell.js        interpreta a linha (aspas, -var, -auto-approve) e chama os comandos
src/tf/comandos.js     cada comando do Terraform sobre o motor (executarTerraform) e o estado
src/tf/formatar.js     terraform fmt (HCL canônico)
src/tf/console.js      terraform console (avalia expressões com o contexto da configuração)
src/tf/saida.js        as linhas de cada comando separadas (init, plan, confirmação, apply...)
```

- `linhasDoResultado` hoje junta `init` + `workspace` + comando. Ela vira funções por comando
  (`linhasDoInit`, `linhasDoPlano`, `linhasDaConfirmacao`, `linhasDoApply`...), reaproveitando o
  texto de hoje; a correção e os testes que usam a sessão inteira continuam com uma função que
  junta as partes.
- O `apply` roda em duas etapas na tela: o motor calcula o plano; o terminal mostra o plano e
  a pergunta; com `yes`, aplica o resultado já calculado (o mesmo de hoje) e grava o estado.
- O estado de "inicializado" (provedores e versões) fica por exercício e workspace, como o
  tfstate simulado.

## 6. O que muda no resto

- `src/ui/item.js`: os botões digitam `terraform plan`, `terraform apply`, `terraform destroy`
  (com `terraform init` antes, se precisar); abrir um exercício roda `terraform init` e
  `terraform plan` (como hoje).
- `src/progresso.js` e `src/privacidade.js`: entra `historico` (comandos do terminal) e o
  estado de inicialização.
- Correção (`corrigir.js`) e cenário dos casos: sem mudança.

## 7. Testes

- Unidade: shell (aspas, opções, `command not found`), cada comando da seção 4, `fmt`
  (alinhamento, recuo, idempotente), `console` (expressões, funções, referências), `apply` com
  `yes`, com outra resposta (`Apply cancelled.`) e com `-auto-approve`, erro sem `init`.
- happy-dom: terminal (histórico, Tab, Ctrl+C, Ctrl+L, Esc, rótulos, região anunciada) e os
  botões digitando os comandos.
- Os testes de hoje da trilha toda (simulador) continuam passando.
- axe-core nos 4 temas com o terminal esperando o `yes`.

## 8. Riscos

| Risco | Mitigação |
| --- | --- |
| `fmt` diferente do real em casos raros | Testes com exemplos tirados da documentação do Terraform; `fmt` só mexe em espaços e alinhamento |
| Quem só usa os botões estranhar o `yes` | O botão digita o comando, o terminal recebe o foco e a pergunta é falada; a dica do botão avisa |
