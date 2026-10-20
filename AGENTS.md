# Instrucoes de IA - Terraform Playground

Este e o ponto de entrada canonico dos agentes neste projeto. Siga tambem o README e as instrucoes mais especificas do escopo alterado.

## Segundo cerebro e decisoes entre projetos

Toda demanda de IA deve usar a base privada `sertaoseracloud/segundo-cerebro`. Ela e memoria cumulativa e referencia de comparacao entre PHP, Python, Terraform e Kubernetes, nao apenas um arquivo de resumos.

1. Antes de decidir ou implementar, identifique branch, revisao e mudancas locais do projeto. Preserve trabalho preexistente.
2. Localize o clone conhecido da base; por padrao, uma pasta irma `segundo-cerebro`, fora deste repositorio. Confira a raiz Git, a identidade de `origin` e o acesso ao repositorio privado. Nao reutilize pasta ocupada ou remoto divergente.
3. Se ausente, clone `https://github.com/sertaoseracloud/segundo-cerebro.git` na branch `develop`, em destino livre. Use autenticacao local existente, nunca tokens em arquivos/comandos.
4. Se existente e validado, execute `git fetch origin develop`. Atualize com `git merge --ff-only origin/develop` somente se estiver limpo, em `develop` e sem outra sessao escrevendo. Caso contrario, preserve o clone e use worktree isolado a partir de `origin/develop`; nao use stash, reset ou force push automaticos.
5. Leia `AGENTS.md` da revisao sincronizada da base, especialmente "Demandas de IA e padroes entre projetos", depois `index.md` e as paginas pertinentes dos quatro projetos. A base define o protocolo completo; nao duplique suas regras aqui.
6. Para cada decisao, compare os padroes pertinentes nos quatro repositorios com evidencias e revisoes identificadas. Registre uma matriz PHP/Python/Terraform/Kubernetes: alinhado, divergente, especifico/nao aplicavel com justificativa, ou nao verificado. Confira o codigo atual pertinente antes de afirmar conformidade; snapshots antigos e nomes iguais de testes nao provam paridade.
7. Implemente e teste apenas o escopo aprovado. Durante a demanda, integre evidencias finais, decisoes, divergencias e impactos nos outros projetos a base, preservando raw imutavel, fontes, links, indice e log. Nao altere os outros projetos automaticamente.
8. Entregue projeto e conhecimento com commits separados: branch/PR do projeto para `develop` segundo seu Gitflow e atualizacao da base em `develop` segundo seu protocolo. Revalide se outra sessao publicar primeiro. PR aberto nao equivale a merge; falha em um envio nao deve ser escondida pelo sucesso do outro.
9. Informe ao usuario o estado das duas entregas, checks executados, comparacao entre projetos e pendencias. Sem acesso a base ou a alguma evidencia, declare o bloqueio; nao invente alinhamento nem diga que a memoria foi atualizada.

## Limites de publicacao

Este projeto e publico e a base e privada. Nao copie paginas, raw, trechos, links privados ou segredos para codigo, documentacao, PRs, issues ou logs publicos. A autorizacao para consultar nao autoriza republicar conteudo privado. Nao adicione credenciais da base ao CI.

Mantenha a base fora do projeto, dos artefatos e dos commits deste repositorio. Nao crie hooks, servicos ou dependencias de build para sincroniza-la. Este fluxo e executado pelo agente na demanda.

Use caminhos explicitos ao preparar commits. Preserve as regras de PR/checks e branches protegidas. Nao publique diretamente em `main`/`develop`, nao faca release nem force push como parte deste fluxo. Diferencas legitimas entre runtimes e produtos devem ser justificadas, nao apagadas para obter uniformidade artificial.
