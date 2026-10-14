// Política de privacidade e cookies (LGPD): o que o site guarda, onde, por quanto
// tempo e com quem fala. A página #/privacidade é montada a partir daqui, e
// tests/privacidade.test.js confere que toda chave salva em progresso.js está listada.

export const ATUALIZADA_EM = '2026-10-11';

export const CONTROLADOR = {
  nome: 'Sertão será cloud',
  responsavel: 'Cláudio Raposo',
  // Canal público para dúvidas e pedidos sobre dados. Troque por um e-mail, se houver.
  contato: 'https://github.com/sertaoseracloud/terraform-playground/issues',
};

/** Dados guardados no navegador (localStorage), com o prefixo "terraform-playground:". */
export const DADOS_LOCAIS = [
  { chave: 'progresso', dado: 'Exercícios resolvidos ou tentados', finalidade: 'Mostrar seu avanço na trilha e liberar módulos' },
  { chave: 'datas', dado: 'Dia em que cada exercício foi resolvido', finalidade: 'Data dos certificados' },
  { chave: 'atividade', dado: 'Dias em que você estudou (até 400)', finalidade: 'Sequência de dias 🔥' },
  { chave: 'nome', dado: 'Nome que você digitou para o certificado', finalidade: 'Aparecer no certificado e no painel' },
  { chave: 'rascunho:*', dado: 'O código que você escreveu em cada exercício', finalidade: 'Não perder seu trabalho ao fechar a aba' },
  { chave: 'tentativa', dado: 'Quanto tempo você passou tentando cada exercício (só com ele aberto)', finalidade: 'Mostrar a aba Solução depois do tempo estimado do exercício' },
  { chave: 'tarefas:*', dado: 'Tarefas marcadas na lista de cada exercício', finalidade: 'Lembrar o que você já fez' },
  { chave: 'estado:*', dado: 'O estado simulado do Terraform (terraform.tfstate) de cada exercício e workspace', finalidade: 'O próximo plan comparar com o que já foi "criado"' },
  { chave: 'pref:*', dado: 'Preferências: acessibilidade, layout, tutorial visto, aviso de privacidade', finalidade: 'Abrir o site do jeito que você deixou' },
];

/** Serviços de terceiros que o navegador pode acessar ao usar o site. */
export const TERCEIROS = [
  {
    nome: 'GitHub Pages (GitHub, Inc.)',
    quando: 'Sempre: é quem hospeda o site.',
    dados: 'Endereço IP, navegador e páginas pedidas, como em qualquer site. Registros técnicos mantidos pelo GitHub.',
    link: 'https://docs.github.com/pt/site-policy/privacy-policies/github-general-privacy-statement',
  },
  {
    nome: 'GitHub (logo da Sertão será cloud)',
    quando: 'Ao abrir um certificado.',
    dados: 'O navegador baixa a imagem do perfil no GitHub.',
    link: 'https://docs.github.com/pt/site-policy/privacy-policies/github-general-privacy-statement',
  },
  {
    nome: 'LinkedIn',
    quando: 'Só se você clicar em "Publicar no LinkedIn" ou "Adicionar ao perfil".',
    dados: 'O LinkedIn recebe o título do certificado, o link e, pelo link, o seu nome. Vale a política do LinkedIn.',
    link: 'https://br.linkedin.com/legal/privacy-policy',
  },
  {
    nome: 'VLibras (Governo Federal)',
    quando: 'Só se você ligar "Tradução para Libras" no painel ♿ Acessibilidade.',
    dados: 'O navegador baixa o tradutor do servidor do VLibras, que recebe o endereço IP e o texto que você pede para traduzir. Vale a política do gov.br.',
    link: 'https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras',
  },
  {
    nome: 'Voz do navegador (🔊 Ouvir)',
    quando: 'Só se você clicar em "Ouvir".',
    dados: 'O navegador lê o enunciado em voz alta. Algumas vozes (como as "online" do Chrome e do Edge) enviam o texto ao serviço do navegador.',
  },
];
