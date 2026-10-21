// Título e descrição de cada tela, e a lista das telas que viram páginas no build.
// O build (src/pages) escreve isto no <head> de cada página, e o site atualiza a cada troca de
// tela (main.js, definirPagina): um lugar só, para o título da aba nunca mudar ao carregar.
import { NOME, PRINCIPAL } from './seo.js';
import { buscarItem, itens, modulos } from './conteudo/trilha.js';
import { VERSAO } from './novidades.js';
import { ROTAS_FIXAS, lerRota, rota } from './compartilhar.js';

const NAO_ENCONTRADA = { titulo: `Página não encontrada · ${NOME}`, descricao: `Este endereço não existe no ${NOME}.` };

/** { titulo, descricao } da tela de uma rota (o resultado de lerRota). */
export function paginaDe(r) {
  switch (r.tela) {
    case 'landing': return PRINCIPAL;
    case 'item': {
      const item = buscarItem(r.id);
      if (!item) return NAO_ENCONTRADA;
      const modulo = modulos.find((m) => m.id === item.modulo);
      return {
        titulo: `${item.titulo} · ${NOME}`,
        descricao: r.id === 'livre'
          ? 'Playground livre de Terraform: escreva HCL e rode init, plan, apply e destroy direto no navegador, sem conta na nuvem.'
          : `${item.tipo === 'licao' ? 'Lição' : 'Exercício'} de ${modulo?.titulo ?? 'Terraform'}: ${item.titulo}. Escreva o código, rode o plan e veja os testes na hora.`,
      };
    }
    case 'validar': return {
      titulo: `Validar certificado · ${NOME}`,
      descricao: `Confira se um certificado ou badge do ${NOME}, emitido pela Sertão será cloud, é autêntico.`,
    };
    case 'acessibilidade': return {
      titulo: `Acessibilidade · ${NOME}`,
      descricao: `Como o ${NOME} atende pessoas cegas, surdas, mudas e neurodivergentes: leitor de tela, teclado, Libras (VLibras) e perfis prontos.`,
    };
    case 'instrutor': return {
      titulo: `${r.ancora === 'apoie' ? 'Apoie o projeto' : 'Quem é o instrutor?'} · ${NOME}`,
      descricao: 'Cláudio Filipe Lima Rapôso: arquiteto de soluções, Microsoft MVP, Docker Captain e professor. Apoie o projeto com um PIX de qualquer valor.',
    };
    case 'novidades': return { titulo: `Novidades (v${VERSAO}) · ${NOME}`, descricao: `Todas as alterações do ${NOME}, versão por versão.` };
    case 'licenca': return { titulo: `Licença · ${NOME}`, descricao: `O ${NOME} é software livre (AGPL-3.0) com conteúdo aberto (CC BY-SA 4.0).` };
    case 'termos': return { titulo: `Termos de uso · ${NOME}`, descricao: `Termos de uso do ${NOME}, da Sertão será cloud.` };
    case 'privacidade': return { titulo: `Privacidade e cookies · ${NOME}`, descricao: `Sem cookies e sem rastreamento: como o ${NOME} trata seus dados e atende à LGPD.` };
    case 'certificado': return { titulo: `Certificado · ${NOME}`, descricao: PRINCIPAL.descricao };
    case 'inicio': return {
      titulo: `Trilha · ${NOME}`,
      descricao: 'A trilha de Terraform: básico, AWS, Azure e projetos, com módulos que desbloqueiam aos 70%, XP, níveis e certificados.',
    };
    default: return NAO_ENCONTRADA;
  }
}

/** Telas que não entram no sitemap: precisam de um código no endereço ou repetem outra tela. */
const FORA_DO_SITEMAP = new Set(['certificado', 's', 'apoie']);

/**
 * Todas as páginas que o build gera: { caminho (sem o base, sem barras), rota, sitemap }.
 * A landing é o caminho vazio; cada lição e exercício tem a sua (p/<id>).
 */
export function paginasDoSite() {
  const caminhos = ['', ...ROTAS_FIXAS, ...itens.map((i) => `p/${i.id}`)];
  return caminhos.map((caminho) => ({
    caminho,
    rota: lerRota({ pathname: rota(caminho) }),
    sitemap: !FORA_DO_SITEMAP.has(caminho),
  }));
}
