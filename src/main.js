import '@fontsource/fira-code/latin-400.css';
import '@fontsource/fira-code/latin-500.css';
import '@fontsource/fira-code/latin-600.css';
import '@fontsource/fira-code/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './estilo.css';
import './caminho.css';
import './cenarios.css';
import './landing.css';
import './acessibilidade-ux.css';

import { lerRota } from './compartilhar.js';
import { iniciarAcessibilidade } from './ui/acessibilidade.js';
import { iniciarRegua, iniciarPausa } from './ui/neuro.js';
import { renderPrivacidade, iniciarAvisoPrivacidade } from './ui/privacidade.js';
import { renderLanding } from './ui/landing.js';
import { renderValidador } from './ui/validador.js';
import { renderLicenca, renderTermos } from './ui/paginas-legais.js';
import { renderNovidades } from './ui/novidades.js';
import { renderInstrutor } from './ui/instrutor.js';
import { renderDeclaracaoAcessibilidade } from './ui/declaracao-acessibilidade.js';
import { renderNaoEncontrada } from './ui/nao-encontrada.js';
import { anunciar } from './ui/anuncios.js';
import { VERSAO } from './novidades.js';
import { VERSAO_TERRAFORM } from './tf/esquema/index.js';
import { iniciarMenu, iniciarFlutuantes } from './ui/menu.js';
import { iniciarMaisAcoes } from './ui/mais-acoes.js';
import { renderInicio, resumoProgresso } from './ui/inicio.js';
import { criarTelaItem } from './ui/item.js';
import { renderCertificado } from './ui/certificado.js';
import { criarLayout } from './ui/layout.js';
import { iniciarTutorial } from './ui/tutorial.js';
import { iniciarMuralApoio } from './ui/mural-apoio.js';
import { $ } from './ui/util.js';
import { HOMOLOGACAO } from './ambiente.js';
import { definirPagina, PRINCIPAL, NOME } from './seo.js';
import { buscarItem, modulos } from './conteudo/trilha.js';

// Antes de tudo: tema e tamanho de texto escolhidos pelo aluno.
const acessibilidade = iniciarAcessibilidade();
if (HOMOLOGACAO) $('faixa-homologacao').hidden = false;
iniciarMenu();
iniciarFlutuantes();
iniciarMaisAcoes();
iniciarRegua();
iniciarPausa({ ativo: () => acessibilidade.atuais().lembretePausa });

const telaInicio = $('tela-inicio');
const telaItem = $('tela-item');
const telaCertificado = $('tela-certificado');
const telaPrivacidade = $('tela-privacidade');
const telaLanding = $('tela-landing');
const telaValidador = $('tela-validador');
const telaLicenca = $('tela-licenca');
const telaTermos = $('tela-termos');
const telaNovidades = $('tela-novidades');
const telaInstrutor = $('tela-instrutor');
const telaAcessibilidade = $('tela-acessibilidade');
const telaNaoEncontrada = $('tela-nao-encontrada');

function mostrarTela(tela) {
  telaInicio.hidden = tela !== telaInicio;
  telaItem.hidden = tela !== telaItem;
  telaCertificado.hidden = tela !== telaCertificado;
  telaPrivacidade.hidden = tela !== telaPrivacidade;
  telaLanding.hidden = tela !== telaLanding;
  telaValidador.hidden = tela !== telaValidador;
  telaLicenca.hidden = tela !== telaLicenca;
  telaTermos.hidden = tela !== telaTermos;
  telaNovidades.hidden = tela !== telaNovidades;
  telaInstrutor.hidden = tela !== telaInstrutor;
  telaAcessibilidade.hidden = tela !== telaAcessibilidade;
  telaNaoEncontrada.hidden = tela !== telaNaoEncontrada;
}

/**
 * Texto da barra de status. O leitor de tela fala o mesmo texto ou, com `falar`, um
 * mais completo (o resultado dos testes, por exemplo); `falar: false` não fala nada.
 */
const definirStatus = (texto, { falar = texto } = {}) => {
  $('status').textContent = texto;
  if (falar) anunciar(falar);
};

function atualizarProgressoTopo() {
  const { resolvidos, total, licoesLidas, totalLicoes } = resumoProgresso();
  const topo = $('progresso-topo');
  topo.innerHTML = `✅ ${resolvidos}/${total}<span class="rotulo-progresso"> exercícios</span>`;
  topo.title = `${resolvidos} de ${total} exercícios resolvidos · ${licoesLidas} de ${totalLicoes} lições lidas`;
  topo.setAttribute('aria-label', topo.title);
}

const layout = criarLayout();
const STATUS_PRONTO = `Terraform ${VERSAO_TERRAFORM} (simulado) pronto`;
// O exercício só escreve no status enquanto está na tela: um plan que termina depois que
// o aluno foi para outra página não deixa "plan: 2 add..." no validador, por exemplo.
const telaDoItem = criarTelaItem({
  layout,
  definirStatus: (texto, opcoes) => { if (!telaItem.hidden) definirStatus(texto, opcoes); },
  aoMudarProgresso: atualizarProgressoTopo,
});
definirStatus(STATUS_PRONTO, { falar: false });

function marcarMenu(nome) {
  document.querySelectorAll('[data-menu]').forEach((a) => {
    a.classList.toggle('ativo', a.dataset.menu === nome);
    if (a.dataset.menu === nome) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function navegar() {
  // A landing vem pré-renderizada no HTML; daqui em diante quem mostra/esconde as telas é o JS.
  document.documentElement.classList.remove('rota-interna');
  const rota = lerRota(location.hash);
  if (rota.tela === 'item' && telaDoItem.abrir(rota.id, rota.arquivos)) {
    mostrarTela(telaItem);
    layout.aplicar();
    marcarMenu(rota.id === 'livre' ? 'livre' : '');
    const item = buscarItem(rota.id);
    const modulo = modulos.find((m) => m.id === item?.modulo);
    definirPagina({
      titulo: `${$('item-titulo').textContent} · ${NOME}`,
      descricao: rota.id === 'livre'
        ? 'Playground livre de Terraform: escreva HCL e rode init, plan, apply e destroy direto no navegador, sem conta na nuvem.'
        : `${item?.tipo === 'licao' ? 'Lição' : 'Exercício'} de ${modulo?.titulo ?? 'Terraform'}: ${item?.titulo}. Escreva o código, rode o plan e veja os testes na hora.`,
    });
    return;
  }
  // Fora do exercício: o terminal para de animar e o status volta ao padrão.
  telaDoItem.sair();
  definirStatus(STATUS_PRONTO, { falar: false });
  // Um exercício que não existe (link antigo, id digitado errado) também cai aqui.
  if (rota.tela === 'nao-encontrada' || rota.tela === 'item') {
    renderNaoEncontrada(telaNaoEncontrada, { motivo: rota.tela === 'item' ? 'item' : rota.motivo });
    mostrarTela(telaNaoEncontrada);
    marcarMenu('');
    definirPagina({ titulo: `Página não encontrada · ${NOME}`, descricao: `Este endereço não existe no ${NOME}.` });
    telaNaoEncontrada.scrollTop = 0;
    return;
  }
  if (rota.tela === 'landing') {
    renderLanding(telaLanding);
    mostrarTela(telaLanding);
    marcarMenu('');
    definirPagina(PRINCIPAL);
    telaLanding.scrollTop = 0;
    return;
  }
  if (rota.tela === 'validar') {
    renderValidador(telaValidador, rota.codigo, { aoRestaurar: atualizarProgressoTopo });
    mostrarTela(telaValidador);
    marcarMenu('validar');
    definirPagina({
      titulo: `Validar certificado · ${NOME}`,
      descricao: `Confira se um certificado ou badge do ${NOME}, emitido pela Sertão será cloud, é autêntico.`,
    });
    telaValidador.scrollTop = 0;
    return;
  }
  if (rota.tela === 'acessibilidade') {
    renderDeclaracaoAcessibilidade(telaAcessibilidade);
    mostrarTela(telaAcessibilidade);
    marcarMenu('');
    definirPagina({
      titulo: `Acessibilidade · ${NOME}`,
      descricao: `Como o ${NOME} atende pessoas cegas, surdas, mudas e neurodivergentes: leitor de tela, teclado, Libras (VLibras) e perfis prontos.`,
    });
    telaAcessibilidade.scrollTop = 0;
    return;
  }
  if (rota.tela === 'instrutor') {
    telaInstrutor.scrollTop = 0;
    mostrarTela(telaInstrutor);
    renderInstrutor(telaInstrutor, { ancora: rota.ancora });
    marcarMenu('instrutor');
    definirPagina({
      titulo: `${rota.ancora === 'apoie' ? 'Apoie o projeto' : 'Quem é o instrutor?'} · ${NOME}`,
      descricao: 'Cláudio Filipe Lima Rapôso: arquiteto de soluções, Microsoft MVP, Docker Captain e professor. Apoie o projeto com um PIX de qualquer valor.',
    });
    return;
  }
  if (rota.tela === 'novidades') {
    renderNovidades(telaNovidades);
    mostrarTela(telaNovidades);
    marcarMenu('');
    definirPagina({ titulo: `Novidades (v${VERSAO}) · ${NOME}`, descricao: `Todas as alterações do ${NOME}, versão por versão.` });
    telaNovidades.scrollTop = 0;
    return;
  }
  if (rota.tela === 'licenca' || rota.tela === 'termos') {
    const licenca = rota.tela === 'licenca';
    const tela = licenca ? telaLicenca : telaTermos;
    (licenca ? renderLicenca : renderTermos)(tela);
    mostrarTela(tela);
    marcarMenu('');
    definirPagina(licenca
      ? { titulo: `Licença · ${NOME}`, descricao: `O ${NOME} é software livre (AGPL-3.0) com conteúdo aberto (CC BY-SA 4.0).` }
      : { titulo: `Termos de uso · ${NOME}`, descricao: `Termos de uso do ${NOME}, da Sertão será cloud.` });
    tela.scrollTop = 0;
    return;
  }
  if (rota.tela === 'privacidade') {
    renderPrivacidade(telaPrivacidade, { definirStatus });
    mostrarTela(telaPrivacidade);
    marcarMenu('privacidade');
    definirPagina({ titulo: `Privacidade e cookies · ${NOME}`, descricao: `Sem cookies e sem rastreamento: como o ${NOME} trata seus dados e atende à LGPD.` });
    telaPrivacidade.scrollTop = 0;
    return;
  }
  if (rota.tela === 'certificado') {
    const cert = renderCertificado(telaCertificado, rota.codigo, { definirStatus });
    mostrarTela(telaCertificado);
    marcarMenu('');
    definirPagina({ titulo: cert ? `Certificado de ${cert.nome} · Sertão será cloud` : `Certificado · ${NOME}` });
    telaCertificado.scrollTop = 0;
    return;
  }
  mostrarTela(telaInicio);
  renderInicio(telaInicio);
  marcarMenu('inicio');
  definirPagina({ titulo: `Trilha · ${NOME}`, descricao: 'A trilha de Terraform: básico, AWS, Azure e projetos, com módulos que desbloqueiam aos 70%, XP, níveis e certificados.' });
}

// Atalhos fora do editor (dentro dele, o próprio editor trata).
document.addEventListener('keydown', (e) => {
  if (telaItem.hidden || !(e.ctrlKey || e.metaKey) || e.key !== 'Enter' || e.defaultPrevented) return;
  if (document.querySelector('dialog[open]')) return;
  e.preventDefault();
  $(e.shiftKey ? 'btn-enviar' : 'btn-executar').click();
});

/**
 * Leva o foco para o título da tela aberta: quem usa leitor de tela ouve em que página
 * está, e o Tab continua dali (e não do link clicado, que sumiu).
 */
function focarTitulo() {
  const tela = [...document.querySelectorAll('#conteudo > main')].find((m) => !m.hidden);
  const alvo = (location.hash === '#/apoie' && $('apoio-titulo')) || tela?.querySelector('h1') || $('conteudo');
  if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
  alvo.focus({ preventScroll: alvo !== $('apoio-titulo') });
}

window.addEventListener('hashchange', () => {
  // Âncoras da própria página (#conteudo, por exemplo) não são rotas: só rolam até lá.
  if (!location.hash.startsWith('#/') && location.hash.length > 1 && document.getElementById(location.hash.slice(1))) return;
  navegar();
  focarTitulo();
});
// "Pular para o conteúdo" vai para o título da tela aberta sem mudar o endereço (as
// rotas ficam no #: com o href puro, o link levava para a página inicial).
document.querySelector('.pular').addEventListener('click', (e) => {
  e.preventDefault();
  focarTitulo();
});
// Abas (role="tab"): ← e → passam para a aba vizinha, como pede o padrão de acessibilidade.
document.addEventListener('keydown', (e) => {
  const aba = e.target.closest?.('[role="tab"]');
  if (!aba || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const abas = [...aba.closest('[role="tablist"]').querySelectorAll('[role="tab"]')].filter((a) => !a.hidden);
  const i = abas.indexOf(aba);
  const alvo = { ArrowLeft: abas[i - 1] ?? abas.at(-1), ArrowRight: abas[i + 1] ?? abas[0], Home: abas[0], End: abas.at(-1) }[e.key];
  e.preventDefault();
  alvo.focus();
  alvo.click();
});
// Opções como modo foco e lista de tarefas mudam o conteúdo: redesenha a tela aberta.
window.addEventListener('preferencias', () => {
  if (!telaInicio.hidden) renderInicio(telaInicio);
  if (!telaItem.hidden) telaDoItem.redesenharDescricao();
});
atualizarProgressoTopo();
navegar();

iniciarAvisoPrivacidade();
iniciarMuralApoio();
iniciarTutorial({ telaAtual: () => (!telaItem.hidden ? 'item' : !telaInicio.hidden ? 'inicio' : 'outra') });
