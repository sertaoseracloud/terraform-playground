// Módulo extra: infraestruturas completas construídas em etapas encadeadas.
import { projetoSite, projetoRede, projetoApi } from './aws.js';
import { projetoWebApp, projetoAks } from './azure.js';
import { projetoModulos, projetoMulticloud, projetoEstado } from './avancados.js';

const projetos = [projetoSite, projetoRede, projetoApi, projetoWebApp, projetoAks, projetoModulos, projetoMulticloud, projetoEstado];

export const moduloProjetos = {
  id: 'projetos',
  titulo: 'Projetos',
  icone: '🏗️',
  extra: true,
  descricao: 'Infraestruturas completas construídas em etapas: cada etapa parte do código da anterior.',
  grupos: projetos.map((p) => p.grupo),
  itens: projetos.flatMap((p) => p.itens),
};
