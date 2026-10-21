// Falas dos moradores dos cenários da trilha (src/ui/cenarios): clicar ou tocar num personagem, ou
// abrir "Conhecer a vila", mostra a definição curta de um conceito do curso, para revisar. Texto
// simples, sem resposta de exercício e sem detalhe de como a correção funciona. Cada site tem as suas.
export const FALAS_DA_VILA = {
  'mestre-de-obras': { nome: 'Mestre de obras', falas: ['Infraestrutura como código: a infraestrutura descrita em arquivos, versionada como qualquer código.', 'terraform plan: mostra o que vai ser criado, mudado ou destruído, sem mexer em nada.', 'terraform apply: executa o plano e deixa a infraestrutura igual ao código.'] },
  engenheira: { nome: 'Engenheira', falas: ['Resource: um bloco que descreve um objeto real da nuvem, como uma rede ou uma máquina.', 'Provider: o plugin que ensina o Terraform a falar com uma plataforma, como AWS ou Azure.', 'Declarativo: você descreve o resultado; o Terraform descobre os passos.'] },
  passaro: { nome: 'Passarinho', falas: ['terraform fmt: arruma a formatação dos arquivos .tf no padrão da linguagem.', 'terraform validate: confere se a configuração está escrita certo, antes do plano.'] },
  tecnica: { nome: 'Técnica de nuvem', falas: ['Resource group: a pasta do Azure que reúne os recursos de um projeto.', 'Virtual network: a rede privada de um projeto no Azure, dividida em sub-redes.'] },
  balao: { nome: 'Balão', falas: ['Região: o lugar do mundo onde os recursos da nuvem são criados.'] },
  pipa: { nome: 'Pipa', falas: ['Variable: um valor de entrada que deixa o mesmo código servir em lugares diferentes.', 'Output: um valor que o Terraform mostra (ou entrega a outro módulo) depois do apply.'] },
  operaria: { nome: 'Operária da noite', falas: ['Module: um pacote de arquivos .tf reaproveitável, chamado com o bloco module.', 'Workspace: uma cópia separada do estado, para ambientes como dev e produção.'] },
  robozinho: { nome: 'Robozinho', falas: ['for_each: cria uma cópia do recurso para cada item de um mapa ou conjunto.', 'count: cria um número de cópias iguais de um recurso.'] },
  gato: { nome: 'Gato da cidade', falas: ['Data source: lê algo que já existe na nuvem, sem criar nada.'] },
  estivador: { nome: 'Estivador', falas: ['VPC: a rede privada de um projeto na AWS, dividida em sub-redes.', 'Security group: o firewall da AWS que diz que tráfego entra e sai de um recurso.'] },
  rebocador: { nome: 'Rebocador', falas: ['State: o arquivo em que o Terraform guarda o que já criou, para comparar com o código.', 'Backend remoto: guarda o state num lugar compartilhado, como um bucket, com trava para a equipe.'] },
  gaivota: { nome: 'Gaivota', falas: ['Drift: quando a infraestrutura real muda fora do Terraform e fica diferente do código.', 'Tags: etiquetas chave=valor nos recursos, para achar, organizar e somar custos.'] },
};

/** Emojis das conversas, por cenário (o balão de quem conversa). */
export const EMOJIS_DA_CONVERSA = {
  canteiro: ['🏗️', '📐', '🧱'],
  porto: ['⚓', '📦', '☁️'],
  ceu: ['☁️', '🪁', '🎈'],
  cidade: ['🌙', '🏗️', '💡'],
};
