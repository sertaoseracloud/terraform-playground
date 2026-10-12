// Quem é o instrutor: dados públicos do currículo de Cláudio Filipe Lima Rapôso
// (sem telefone nem endereço). Usados na página #/instrutor e na landing.

export const INSTRUTOR = {
  nome: 'Cláudio Filipe Lima Rapôso',
  /** Foto em public/ (fundo transparente, 128×128). */
  foto: 'instrutor.webp',
  titulo: 'Arquiteto de Soluções, Staff Software Engineer e professor',
  resumo: [
    'Arquiteto de Soluções e Staff Software Engineer com mais de 10 anos de experiência em criar e modernizar sistemas corporativos distribuídos, de alta disponibilidade, na AWS e no Microsoft Azure.',
    'Especialista em arquitetura de software (DDD, Clean Architecture, arquitetura hexagonal e baseada em células), microsserviços, arquitetura orientada a eventos, Kubernetes, DevSecOps e infraestrutura como código com Terraform.',
    'Também atua em educação tecnológica: já mentorou mais de 1.000 profissionais e estudantes, no Brasil e no exterior.',
  ],
  reconhecimentos: [
    { nome: 'Microsoft MVP', detalhe: 'Most Valuable Professional' },
    { nome: 'Docker Captain', detalhe: 'Comunidade Docker' },
    { nome: 'AWS Golden Jacket', detalhe: 'Reconhecimento da AWS' },
  ],
  certificacoes: [
    'AWS Certified Solutions Architect – Professional',
    'AWS Certified Solutions Architect – Associate',
    'Microsoft Certified: Solutions Architect Expert',
    'Microsoft Certified Trainer (2021–2022 e 2023–2024)',
  ],
  atuacao: [
    { cargo: 'Especialista de Ensino IV em Big Data, Analytics e IA', onde: 'UniSENAI Santa Catarina', periodo: 'desde 07/2026' },
    { cargo: 'Lead Software Architecture & DevRel', onde: 'NTT DATA Europe & Latam', periodo: 'desde 01/2025', detalhe: 'Arquiteturas multicloud com AKS, EKS e Terraform para bancos e seguradoras.' },
    { cargo: 'Professor universitário (regente EAD)', onde: 'MoveEdu: Faculdade Prepara e Faculdade Microlins', periodo: 'desde 10/2024', detalhe: 'Algoritmos, estruturas de dados e programação client-side e server-side.' },
    { cargo: 'Professor universitário (regente EAD), curso Shift', onde: 'FIAP', periodo: '08/2025 a 04/2026' },
    { cargo: 'Professor universitário', onde: 'Grupo Anchieta', periodo: '09/2024 a 05/2025', detalhe: 'Cloud computing, TypeScript e Business Intelligence.' },
    { cargo: 'Arquiteto de Software Sênior', onde: 'CI&T', periodo: '09/2023 a 01/2025', detalhe: 'Arquiteturas de referência e automação no Azure e no Azure DevOps.' },
  ],
  formacao: [
    'Doutorado em Administração de Empresas (DSc BA), MUST University (em andamento)',
    'Mestrado em Administração de Empresas (MSc), MUST University (2022 a 2026)',
    'Pós-graduações em Database Administration, Gestão de Projetos e Metodologias Ágeis e Data Science e Big Data Analytics, Faculdade IMES (2025)',
  ],
  especialidades: ['AWS', 'Microsoft Azure', 'Terraform', 'Kubernetes', 'Docker', 'DDD', 'Microsserviços', 'Arquitetura orientada a eventos', 'DevSecOps', 'IA, LLMs e RAG'],
  idiomas: 'Português, inglês e espanhol (proficiência profissional)',
  links: [
    { rotulo: 'LinkedIn', url: 'https://www.linkedin.com/in/cfraposo' },
    { rotulo: 'Sertão será cloud', url: 'https://sertaoseracloud.live' },
  ],
};
