// Passos do tutorial. `tela` diz em qual tela o passo acontece ('inicio' ou 'item');
// `alvo` é o seletor do elemento destacado (sem alvo, o modal fica no centro).
// tests/tutorial.test.js confere que todos os alvos existem na página.

export const PROBLEMA_DO_TUTORIAL = 'tf-ola-arquivo';

export const PASSOS = [
  {
    titulo: 'Bem-vindo ao DivergeTerraform 🏗️',
    texto: `<p>Aqui você aprende <b>Terraform</b> e cria infraestrutura na <b>AWS</b> e no <b>Azure</b>
      resolvendo problemas, no estilo do LeetCode.</p>
      <p>Tudo roda no seu navegador, num <b>simulador</b>: não precisa instalar nada nem ter conta na nuvem,
      e nada é cobrado. Este tutorial leva 1 minuto.</p>`,
  },
  {
    tela: 'inicio',
    alvo: '#tela-inicio .bloco-unidade',
    titulo: 'O caminho',
    texto: `<p>A trilha é um caminho: Terraform básico → AWS → Azure e, por fim, os Projetos.</p>
      <ul>
        <li>📖 <b>lições</b> e problemas ⭐ <span class="dificuldade facil">fácil</span>,
          🔥 <span class="dificuldade medio">médio</span> e 💎 <span class="dificuldade dificil">difícil</span>;</li>
        <li>o nó que pisca com <b>COMEÇAR</b> é o seu próximo passo;</li>
        <li>🔒 o próximo módulo abre quando você resolve <b>70%</b> do atual.</li>
      </ul>`,
  },
  {
    tela: 'inicio',
    alvo: '.painel-jogador',
    titulo: 'XP, nível e certificados',
    texto: `<p>Cada lição e problema resolvido dá <b>XP</b> e sobe o seu <b>nível</b>. Estudar em dias seguidos
      aumenta a sua sequência 🔥.</p>
      <p>Ao concluir um módulo, o 🏆 libera um <b>certificado</b> emitido pela <b>Sertão será cloud</b>, que você pode
      salvar em PDF e compartilhar no LinkedIn. Concluindo tudo, ganha o certificado final 🎓.</p>`,
  },
  {
    tela: 'inicio',
    alvo: '.menu',
    alvoCelular: '#btn-menu',
    titulo: 'Trilha e Playground livre',
    texto: `<p><b>Trilha</b> volta para este caminho. O <b>Playground livre</b> é para experimentar
      à vontade: o código e o estado ficam salvos.</p>
      <p class="so-celular">No celular, eles ficam no menu <b>☰</b>, no canto de cima.</p>`,
  },
  {
    tela: 'item',
    alvo: '#painel-descricao',
    titulo: 'O enunciado',
    texto: `<p>Leia o que o problema pede. A aba <b>📘 Docs</b> mostra os argumentos de cada tipo de recurso
      usado (obrigatórios, opcionais e quais forçam a recriação), e a <b>Solução</b> aparece depois do tempo estimado do exercício (o ⏱), se você ainda não resolveu.</p>
      <p>O botão <b>🔊</b> lê o enunciado em voz alta.</p>`,
  },
  {
    tela: 'item',
    alvo: '.painel-codigo',
    titulo: 'O editor de código',
    texto: `<p>Escreva HCL aqui. O <b>+</b> cria outros arquivos (<code>variables.tf</code>,
      <code>terraform.tfvars</code>) e pastas de módulos (<code>modulos/rede/main.tf</code>).
      Seu código é salvo sozinho enquanto você digita.</p>
      <p>Atalho: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> roda o plan.</p>`,
  },
  {
    tela: 'item',
    alvo: '.painel-preview',
    titulo: 'O terminal',
    texto: `<p>Mostra a saída do Terraform, em inglês, igual à de verdade: <code>terraform init</code>,
      o plano com <span class="l-criar">+ criar</span>, <span class="l-alterar">~ alterar</span> e
      <span class="l-destruir">- destruir</span>, e os erros com a linha e uma explicação em português.</p>
      <p>É um terminal de verdade: digite <code>terraform plan</code>, <code>terraform apply</code> (ele pergunta e só segue com <code>yes</code>),
      <code>terraform fmt</code>, <code>terraform console</code>, <code>terraform state list</code>... e <code>help</code> para ver todos.
      Os botões ▶ Plan, ✔ Apply e 🗑 Destroy digitam o comando para você. <kbd>Esc</kbd> sai do terminal.</p>
      <p>As outras abas mostram o <b>🕸️ Grafo</b> de dependências, o <b>📦 Estado</b> (terraform.tfstate)
      e os <b>📤 Outputs</b>. O seletor 🗂 troca o <b>workspace</b>.</p>`,
  },
  {
    tela: 'item',
    alvo: '#btn-executar',
    titulo: '▶ Plan, ✔ Apply e 🗑 Destroy',
    texto: `<p><b>Plan</b> mostra o que vai mudar e confere os <b>casos de teste visíveis</b>.
      <b>Apply</b> "cria" os recursos no estado simulado; rode o Plan de novo e veja "No changes".
      <b>Destroy</b> apaga tudo do estado.</p>`,
  },
  {
    tela: 'item',
    alvo: '#aba-testes',
    titulo: '🧪 Testes',
    texto: `<p>Os testes ficam nesta aba, ao lado da descrição. Ela abre sozinha quando você clica em
      <b>▶ Plan</b>, e o resultado aparece no nome da aba (ex.: ✅ 3/3).</p>
      <p>Cada cartão é um caso de teste: ⏳ ainda não rodou, ✅ passou, ❌ falhou.
      O cartão que falhou diz <b>o que faltou</b>, por exemplo "não encontrei local_file.ola no plano".</p>`,
  },
  {
    tela: 'item',
    alvo: '#btn-enviar',
    titulo: '⬆ Enviar',
    texto: `<p>Roda <b>todos</b> os testes, inclusive os 🔒 ocultos, que usam outros valores de variáveis.
      Se tudo passar, aparece <b>Aceito 🎉</b> e o problema fica marcado como resolvido.</p>
      <p>Atalho: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>.</p>`,
  },
  {
    tela: 'item',
    alvo: '#grupo-layout',
    soDesktop: true, // no celular o código e o terminal sempre ficam empilhados
    titulo: 'Posição do código e do terminal',
    texto: `<p><b>Auto</b> escolhe sozinho: lado a lado quando o terminal fica largo o bastante para o plano,
      senão o código fica em cima e o terminal embaixo.</p>
      <p>Use <b>⇆</b> ou <b>⇅</b> para fixar, <b>📄</b> para ocultar a descrição e arraste
      a divisória entre código e terminal para ajustar o tamanho.</p>`,
  },
  {
    alvo: '#btn-acessibilidade',
    titulo: '♿ Acessibilidade',
    texto: `<p>Mude o <b>tema</b>, o <b>tamanho do texto</b>, a fonte e o espaçamento.</p>
      <p>Há <b>perfis rápidos</b> para estudar do seu jeito: <b>🎯 Foco</b> (menos distrações, tarefas
      em lista, lembrete de pausa), <b>📖 Leitura facilitada</b> (fonte legível e régua de leitura),
      <b>🌿 Calmo</b> (cores suaves, nada se mexe) e <b>🤝 Sem pressão</b> (sem pontuação, mensagens gentis).</p>`,
  },
  {
    alvo: '#btn-tutorial',
    titulo: 'Pronto! 🚀',
    texto: `<p>Você pode rever este tutorial quando quiser no botão <b>❓</b>, no canto de baixo à direita.
      Ali também ficam <b>♿ Acessibilidade</b> e <b>🔒 Privacidade</b>.</p>
      <p>Comece pelo primeiro problema do Terraform básico. Bons estudos!</p>`,
  },
];
