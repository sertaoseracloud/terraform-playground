# Usabilidade e acessibilidade: auditoria de 2026-10-20

Meta: WCAG 2.2 nível AA e uma experiência simples para quem nunca programou, inclusive pessoas cegas,
surdas, mudas e neurodivergentes (TDAH, dislexia, autismo). A mesma auditoria foi feita nos quatro
playgrounds (DivergePHP, DivergeTerraform, DivergePython e DivergeKubernetes); este relatório é o do
**DivergeTerraform**, e a tabela de consistência no fim compara os quatro.

**Resumo:** 16 problemas — 1 bloqueante(s), 1 de gravidade alta,
10 média(s) e 4 baixa(s).

## Como foi feito

- **axe-core 4.14 (WCAG 2.0, 2.1 e 2.2, A e AA, e boas práticas)**, no Chromium. Larguras de 1280 e 320 px
  nos 4 temas (padrão, claro, suave e alto contraste); 375 e 412 px no tema padrão.
  - **Telas:** landing, trilha, exercício (vazio, com erro e aceito), lição, playground livre,
    validador (vazio e com código inválido), certificado inválido, novidades, privacidade, licença,
    termos, acessibilidade, instrutor, apoie e um endereço que não existe.
- **Teclado:** ordem do Tab, foco visível e não encoberto, saída do editor e do terminal (Tab,
  Shift+Tab, Esc), diálogos (tutorial, painel ♿, mural de apoio) com foco preso e devolvido, "Pular
  para o conteúdo", troca de tela (foco e título da aba).
- **Reflow e texto:** 640 px (zoom de 200%), 320 px (zoom de 400%) e o espaçamento de texto do 1.4.12
  (altura de linha 1,5, letras 0,12 em, palavras 0,16 em, parágrafos 2 em).
- **Leitura do código:** regiões vivas (aria-live), anúncios, animações, a trava da solução, canvas e diagramas.
- **Lighthouse (acessibilidade):** roda no CI de cada PR (job lighthouse, mínimo de 0,9 na landing e na trilha).
- **Leitor de tela:** os anúncios foram conferidos pelo texto que chega às regiões vivas (Playwright).
  O teste com NVDA, JAWS, VoiceOver e TalkBack de verdade fica como pendência (veja o fim).

A auditoria virou teste permanente: `tests/e2e/usabilidade.spec.js` (axe em todas as telas e estados,
teclado e foco, 640 px e espaçamento) e `tests/usabilidade.test.js`.

## Problemas encontrados

Gravidade: **bloqueante** (impede alguém de usar), **alta** (atrapalha muito um grupo), **média**
(atrapalha, mas há como contornar), **baixa** (incômodo).

| # | Problema | WCAG | Telas | Gravidade | Quem é afetado | Correção | Situação |
|---|---|---|---|---|---|---|---|
| 1 | O campo do terminal prendia o Tab: ele sempre tentava completar o comando, mesmo com o campo vazio. Só o Esc (não anunciado) saía | 2.1.2 | exercício, livre | bloqueante | quem usa só o teclado, pessoas cegas | Com o campo vazio, o Tab segue para o próximo controle; com texto, completa. Dica para o leitor de tela no campo (aria-describedby) | ✅ corrigido |
| 2 | O botão "⭐ Dê uma estrela no GitHub" tinha texto claro sobre amarelo (contraste de 1,04:1) nos 4 temas | 1.4.3 | instrutor, apoie, mural | alta | baixa visão, daltonismo, quem usa o celular no sol | Texto escuro (`--sobre-cor`) | ✅ corrigido |
| 3 | O resultado do ▶ Plan era falado duas vezes: o resumo (#anuncio) e o terminal (região viva) | 4.1.3 | exercício, livre | média | pessoas cegas, TDAH | O terminal fica mudo enquanto o resumo é falado e volta a ser região viva para os comandos digitados (no tf, só no plan: o apply e o destroy perguntam "yes" e precisam ser ouvidos) | ✅ corrigido |
| 4 | Barra do exercício com muitos botões; no celular, vários só com ícone | 2.4.6, 3.3.2 e boas práticas cognitivas | exercício, livre | média | iniciantes, TDAH, autismo, dislexia | À vista só ▶ Plan e ⬆ Enviar; Apply, Destroy, Limpar estado, Restaurar e Compartilhar em "⋯ Mais ações" (botão com aria-expanded, Esc fecha), cada um com texto e uma frase de ajuda; os botões de posição ganharam texto | ✅ corrigido (aprovado) |
| 5 | O mural de apoio (PIX) abria em todo carregamento, inclusive por cima de um exercício aberto por link | 3.2.1 e 2.2.4 (AAA, boa prática) | todas | média | TDAH, autismo, leitor de tela | No máximo uma vez por dia, só na landing e na trilha | ✅ corrigido (aprovado) |
| 6 | No celular, ao andar com o Tab pela trilha, o botão fixo "Ir para o passo atual" cobria o nó focado; no exercício, a barra fixa do topo podia cobrir as abas | 2.4.11, 2.5.8 | trilha e exercício (≤ 900 px) | média | teclado, baixa visão | Folga de rolagem (scroll-margin) para o que recebe foco e para os painéis | ✅ corrigido |
| 7 | No celular, fechar o tutorial ou o painel ♿ deixava o foco perdido no `body` (o ❓ e o ♿ ficam escondidos atrás do ⚙️) | 2.4.3 | todas (≤ 760 px) | média | teclado, leitor de tela | O foco volta ao ⚙️ | ✅ corrigido |
| 8 | Um endereço que não existe (ou um link compartilhado cortado) caía calado na landing; um exercício que não existe caía na trilha | 3.3.1, 2.4.2 | 404 | média | todos, principalmente iniciantes | Tela "🧭 Página não encontrada" que diz o que houve e oferece a trilha e a página inicial | ✅ corrigido |
| 9 | Animações infinitas na trilha (próximo passo pulsando, troféu brilhando, "você está aqui" flutuando) | 2.2.2 | trilha | média | TDAH, autismo, enxaqueca | Param sozinhas depois de 2 ciclos (menos de 5 s). "Reduzir movimento" para tudo | ✅ corrigido |
| 10 | Se os testes não conseguiam rodar, o leitor de tela ouvia "Enviando…" e mais nada | 4.1.3, 3.3.1 | exercício | média | pessoas cegas | Fala o erro e o que fazer | ✅ corrigido |
| 11 | Fechar o mural de apoio deixava o foco no `body` | 2.4.3 | landing, trilha | baixa | teclado, leitor de tela | O foco vai para o título da tela (como já acontecia no php) | ✅ corrigido |
| 12 | No celular, o nome do exercício era cortado com "…" | 1.4.10 | exercício (≤ 900 px) | baixa | todos no celular, dislexia | O nome aparece inteiro | ✅ corrigido |
| 13 | A lista de atalhos do painel ♿ dizia "Executar" e "preview" (texto do PHP) | 3.3.2 | painel ♿ | baixa | teclado, leitor de tela | Lista com o nome certo do botão; no k8s, também o Ctrl+Shift+D do Diff | ✅ corrigido |
| 14 | Troféus e o nó "próximo passo" da trilha: o texto visível não está no nome acessível | 2.5.3 | trilha | média | quem usa comando de voz | — | ⏳ com a sessão de débito técnico (src/ui/inicio.js) |
| 15 | Personagens dos cenários andam sem parar; o único controle é "Reduzir movimento" no painel ♿ | 2.2.2 | trilha | média | TDAH, autismo | Botão visível "⏸ Pausar cenário" | ⏳ com a sessão dos cenários (PixiJS) |
| 16 | Com o espaçamento de texto do 1.4.12, a barra de status do topo corta o texto | 1.4.12 | todas | baixa | dislexia, baixa visão | O mesmo texto é falado e aparece no resultado | ⏸ pendente (baixa) |

### O que já estava bom (e continua)

- Fora o que está na tabela, nenhuma violação do axe nas telas auditadas, em 1280, 320, 375 e 412 px e nos 4 temas.
- Nada passa da borda a 320 px (zoom de 400%) nem a 640 px (200%), nem com o espaçamento do 1.4.12.
- O Tab sai do editor (Shift+Tab também); recuar a linha é Ctrl+[.
- O terminal tem histórico (↑/↓), Esc pula a animação e o modo leitor de tela desliga a animação de digitação.
- "Pular para o conteúdo" é o primeiro Tab e leva ao título da tela. Trocar de tela leva o foco ao título e muda o título da aba.
- Os diálogos (`<dialog>` modal) prendem o foco e fecham com Esc.
- O divisor entre os painéis tem alternativa ao arrasto: setas, Home, End e os botões de posição (2.5.7).
- O canvas dos cenários está escondido do leitor de tela (`aria-hidden`) e não recebe foco.
- A trava da solução ("a solução aparece depois de ~N min") mostra quanto falta, conta só com o exercício aberto, avisa uma vez quando libera e some no modo "sem pressão". Ela não limita o tempo para terminar a tarefa (2.2.1).
- O certificado não pede teste cognitivo: basta o nome (3.3.8). O validador aceita colar o link, o XML ou digitar o código.
- O painel ♿ tem perfis prontos (🦯 Leitor de tela, 🤟 Libras, 🎯 Foco, 📖 Leitura facilitada, 🌿 Calmo, 🤝 Sem pressão), tamanho do texto, 4 temas, régua de leitura, lembrete de pausa e "reduzir movimento", que também segue o `prefers-reduced-motion` do sistema.

## Antes e depois

| Antes | Depois |
|---|---|
| Barra: ▶ Plan, ✔ Apply, 🗑 Destroy, ⬆ Enviar, ⟲ Limpar estado, ↺ Restaurar, 🔗 Compartilhar + Auto ⇆ ⇅ 📄 (no celular, 5 só com ícone e o 🔗 cortado na borda) | ▶ Plan, ⬆ Enviar e "⋯ Mais ações" (Apply, Destroy, Limpar estado, Restaurar e Compartilhar, cada um com uma frase); Auto, ⇆ Lado a lado, ⇅ Empilhado, 📄 Descrição |
| Mural PIX a cada carregamento, até por cima do exercício | Uma vez por dia, só na landing e na trilha |
| `#/qualquer-coisa` → landing, sem aviso | "🧭 Página não encontrada", com "Ir para a trilha" e "Página inicial" |

## Consistência entre os quatro sites

Em **negrito**, o que destoava do padrão antes desta rodada.

| Padrão comum | PHP | Terraform | Python | Kubernetes | Depois (nos 4) |
|---|---|---|---|---|---|
| Botões à vista na barra do exercício | 5 + 4 de posição | 7 + 4 | 4 + 4 | 6 + 4 | ação principal, ⬆ Enviar e "⋯ Mais ações" |
| Ícone sem texto na barra (celular) | 3 | 5 | 2 | 0 (rolagem lateral) | nenhum |
| Ctrl+Enter no editor fala o resultado | sim | sim | sim | **não** | sim |
| Terminal prende o Tab | (sem terminal) | **sim** | **sim** | **sim** | não |
| Resultado falado duas vezes (resumo + terminal) | não | **sim** | sim (mantido: input()) | **sim** | só no Python, de propósito |
| Nome acessível da aba 🧪 Testes | **"Testes funcionais: …"** | "Testes: …" | **"Testes funcionais: …"** | "Testes: …" | "Testes: …" |
| Erro ao rodar os testes é falado | sim | **não** | sim | **não** | sim |
| Contraste do ⭐ GitHub | ok | **1,04:1** | **1,04:1** | **1,04:1** | ok |
| Foco ao fechar o mural | título | **perdido** | **perdido** | **perdido** | título |
| Foco ao fechar tutorial/♿ no celular | ⚙️ | **perdido** | **perdido** | **perdido** | ⚙️ |
| Tabela da privacidade rola sem foco (≤ 375 px) | **sim** | não | **sim** | não | não |
| Lista de atalhos no painel ♿ | certa | **"Executar", "preview"** | certa | **"Executar", "preview"** | certa |
| Mural de apoio | a cada carregamento | a cada carregamento | a cada carregamento | a cada carregamento | 1 vez por dia, landing e trilha |
| Endereço que não existe | landing | landing | landing | landing | "Página não encontrada" |
| Animações da trilha | infinitas | infinitas | infinitas | infinitas | param em < 5 s |
| Foco encoberto na trilha (celular) | sim | sim | sim | sim | não |
| Nome da ação principal | ▶ Executar | ▶ Plan | ▶ Executar | ▶ Apply | mantido: é o verbo de cada ferramenta |

Os arquivos comuns ficaram iguais nos quatro: `src/acessibilidade-ux.css`, `src/ui/mais-acoes.js`,
`src/ui/nao-encontrada.js`, `src/ui/menu.js` e `src/ui/mural-apoio.js`.

## Pendências

- **Teste com leitores de tela de verdade** (NVDA com Firefox, JAWS com Chrome, VoiceOver no iPhone e
  TalkBack): os anúncios foram conferidos pelo texto das regiões vivas, não pela fala.
- **VLibras:** o avatar de Libras é um serviço do Governo Federal. O código confirma que o script só
  carrega quando a pessoa liga a opção no painel ♿; a tradução em si não foi avaliada.
- Itens "com a sessão de débito técnico" e "com a sessão dos cenários": serão resolvidos nesses PRs.
- Itens de gravidade baixa marcados como pendentes: ficam para uma próxima rodada.
