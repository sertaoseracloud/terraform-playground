// Versão do site e resumo das alterações de cada release (página #/novidades e CHANGELOG.md).
// A versão vem do package.json (injetada pelo Vite); o histórico completo vem do git
// (scripts/plugin-historico.mjs).
import historico from 'virtual:historico';

export const VERSAO = typeof __VERSAO__ === 'undefined' ? '0.0.0' : __VERSAO__;
export const HISTORICO = historico;
export const REPOSITORIO = 'https://github.com/sertaoseracloud/terraform-playground';

/** Releases, da mais nova para a mais antiga. Escritas para quem usa o site, sem jargão. */
export const RELEASES = [
  {
    versao: '1.2.0',
    data: '2026-10-12',
    titulo: 'Carga horária',
    resumo: 'Os certificados agora mostram a carga horária, e cada exercício mostra quanto tempo leva, em média.',
    grupos: [
      {
        titulo: '⏱ Carga horária',
        itens: [
          'Cada certificado mostra a carga horária do módulo (no mínimo 1 hora); a trilha completa soma 102 horas.',
          'A carga aparece no certificado, no documento para imprimir, no post do LinkedIn, no arquivo XML e na validação.',
          'Cada módulo da trilha mostra as horas, e cada exercício mostra o tempo estimado ao lado da dificuldade.',
          'Certificados já emitidos continuam válidos e passam a mostrar a carga horária.',
        ],
      },
    ],
  },
  {
    versao: '1.1.0',
    data: '2026-10-12',
    titulo: 'Terminal de verdade e validador novo',
    resumo: 'O terminal agora se comporta como o Terraform de verdade, e a página de validar certificados ficou mais clara e funciona melhor no celular.',
    grupos: [
      {
        titulo: '🖥️ Terminal',
        itens: [
          'Os comandos são digitados no prompt, como num terminal, e a saída aparece no ritmo do Terraform.',
          'O primeiro terraform init baixa os provedores; os seguintes reaproveitam o que já foi instalado.',
          'O plan lê os data sources e atualiza o que já existe ("Refreshing state...") antes de mostrar o plano.',
          'O apply e o destroy pedem a confirmação ("Enter a value: yes"), e a troca de workspace aparece no terminal.',
          'No apply, cada recurso leva o tempo típico do serviço (um bucket leva segundos, um cluster leva minutos), vários ao mesmo tempo e na ordem das dependências.',
          'Botão ⏩ Pular (ou tecla Esc) para ver tudo na hora; com "Reduzir animações", a saída aparece de uma vez.',
        ],
      },
      {
        titulo: '🔎 Validar certificado',
        itens: [
          'Quem abre um link de validação vê o resultado primeiro, com o badge e os certificados da trilha numa linha do tempo.',
          'As três formas de validar (link, impresso e arquivo XML) ficam em abas.',
          'Cores diferentes para "válido", "alterado", "não consegui ler" e "link antigo".',
          'Contador de caracteres no selo e resultado que some quando você muda o texto.',
          'Correções: a página não passa mais da largura da tela no celular e o botão "Abrir o certificado" voltou a mostrar o texto.',
        ],
      },
    ],
  },
  {
    versao: '1.0.0',
    data: '2026-10-12',
    titulo: 'Primeira versão oficial',
    resumo: 'A trilha de Terraform completa, com simulador no navegador, projetos, certificados e as ferramentas de acessibilidade.',
    grupos: [
      {
        titulo: '🗺️ Trilha e exercícios',
        itens: [
          'Trilha de Terraform: básico (HCL), AWS, Azure e projetos, com 200 exercícios e lições.',
          'Simulador de Terraform no navegador: init, validate, plan, apply e destroy, com estado, workspaces e grafo de dependências. Não precisa de conta na nuvem e nada é cobrado.',
          'Erros no formato do Terraform, com a linha do código e a explicação em português.',
          'Exercícios corrigidos na hora por testes, no estilo LeetCode, com casos ocultos ao enviar.',
          'Módulo de 8 projetos completos (site estático, rede de 3 camadas, API serverless, app web e Kubernetes no Azure, módulos multiambiente, multicloud e estado remoto), feitos em etapas.',
          'Playground livre para experimentar, com o estado salvo no navegador.',
          'Instruções sempre na mesma ordem e palavras técnicas explicadas com analogias do dia a dia.',
        ],
      },
      {
        titulo: '🏆 Gamificação e certificados',
        itens: [
          'Caminho com XP, níveis e sequência de dias; cada módulo abre quando você faz 70% do anterior.',
          'Certificado e badge para cada módulo e um certificado final, emitidos pela Sertão será cloud.',
          'Compartilhamento no LinkedIn com a imagem do badge e opção de imprimir ou salvar em PDF.',
          'Selo de autenticidade: os certificados saem na ordem da trilha, ligados uns aos outros, e qualquer alteração invalida o certificado.',
          'Página para validar certificados por link, pelo certificado impresso ou pelo arquivo XML.',
        ],
      },
      {
        titulo: '♿ Acessibilidade e neurodiversidade',
        itens: [
          'Temas Dracula, Claro, Alto contraste e Suave, texto de 87,5% a 175% e fonte mais legível.',
          'Perfis prontos: Foco (TDAH), Leitura facilitada (dislexia), Calmo (autismo) e Sem pressão (ansiedade).',
          'Modo foco, lista de tarefas, régua de leitura, lembrete de pausa e leitura em voz alta.',
          'Navegação completa pelo teclado e contraste revisado em todas as telas.',
          'Tutorial passo a passo, que se adapta ao celular.',
        ],
      },
      {
        titulo: '📱 Telas e navegação',
        itens: [
          'Página inicial apresentando o projeto; a trilha fica em uma página própria.',
          'Código e terminal lado a lado ou empilhados, conforme o tamanho da tela.',
          'Aba Docs com os argumentos de cada recurso usado no exercício.',
          'Testes numa aba ao lado da descrição, com o resultado no nome da aba.',
          'Versão para celular com menu ☰, barra do exercício sempre visível e botões de ajuda flutuantes.',
        ],
      },
      {
        titulo: '🔒 Privacidade, licença e termos',
        itens: [
          'Sem cookies, sem rastreamento e sem cadastro: seus dados ficam só no seu navegador.',
          'Página de privacidade (LGPD), com botões para baixar e apagar seus dados.',
          'Software livre com copyleft: código sob AGPL-3.0 e conteúdo didático sob CC BY-SA 4.0.',
          'Página de termos de uso.',
        ],
      },
      {
        titulo: '🔍 Busca e compartilhamento',
        itens: [
          'Título, descrição e imagem de compartilhamento para buscadores e redes sociais.',
          'A página inicial já chega pronta para buscadores que não executam JavaScript.',
        ],
      },
    ],
  },
];
