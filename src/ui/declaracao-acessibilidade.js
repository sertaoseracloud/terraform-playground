// Declaração de acessibilidade (#/acessibilidade): o que o site faz por pessoas cegas
// ou com baixa visão, surdas, mudas e neurodivergentes, como usar com leitor de tela e
// teclado, os limites conhecidos e onde relatar uma barreira.
import { NOME, REPOSITORIO } from '../seo.js';
import { dataPorExtenso } from './util.js';

export const ATUALIZADA_EM = '2026-10-12';

/** Atalhos de teclado do site (também listados no painel ♿). */
export const ATALHOS = [
  ['Ctrl + Enter', 'Roda o seu código e os testes visíveis'],
  ['Ctrl + Shift + Enter', 'Envia: roda todos os testes, inclusive os ocultos'],
  ['Tab / Shift + Tab', 'Vai para a próxima área ou volta (o editor não prende o Tab)'],
  ['Ctrl + ]  e  Ctrl + [', 'Aumenta ou diminui o recuo da linha no editor'],
  ['Ctrl + F', 'Procura no código (dentro do editor)'],
  ['Ctrl + Alt + G', 'Vai para uma linha do código (dentro do editor)'],
  ['← → Home End', 'Troca de aba (Descrição, Testes, Terminal...)'],
  ['Esc', 'Fecha janelas e pula a animação do terminal'],
];

export function renderDeclaracaoAcessibilidade(el) {
  el.innerHTML = `
    <article class="pagina-texto pagina-acessibilidade">
      <p class="voltar-trilha"><a href="#/">← Página inicial</a></p>
      <h1>Acessibilidade</h1>
      <p class="atualizada">Última atualização: ${dataPorExtenso(ATUALIZADA_EM)}</p>
      <p>O ${NOME} foi feito para ser usado por todo mundo: com leitor de tela, só com o teclado,
        sem ouvir nada e sem falar nada. A meta é o nível AA das Diretrizes de Acessibilidade para
        Conteúdo Web (WCAG 2.2) do W3C, conferido com o axe-core em todas as telas e nos quatro temas
        de cores, a cada versão.</p>

      <h2>Pessoas cegas ou com baixa visão</h2>
      <ul>
        <li>Feito para os leitores de tela NVDA, JAWS e Narrador (Windows), VoiceOver (macOS e iPhone) e TalkBack (Android), com a marcação padrão do W3C: títulos, regiões, rótulos e avisos falados.</li>
        <li>Cada tela tem título, regiões nomeadas (Descrição, Código, Saída) e um link "Pular para o conteúdo". Ao trocar de página, o foco vai para o título dela.</li>
        <li>Quando você roda o código ou envia, o leitor fala o resultado: quantos casos passaram, qual falhou, o motivo e a dica. O terminal não é lido letra por letra.</li>
        <li>No painel ♿ Acessibilidade, o perfil <b>🦯 Leitor de tela</b> tira as animações do terminal e faz o leitor falar todas as falhas, não só a primeira.</li>
        <li>O grafo de dependências e o QR Code do PIX têm versão em texto (lista de dependências e código copia e cola).</li>
        <li>Temas de alto contraste e claro, texto até 175% e fonte Atkinson Hyperlegible. O site segue o modo claro e o contraste alto do seu sistema.</li>
      </ul>

      <h2>Pessoas surdas ou com deficiência auditiva</h2>
      <ul>
        <li>Nada no site depende de som: todo aviso aparece escrito na tela. Não há vídeos nem áudios.</li>
        <li>O único som é o botão 🔊 Ouvir, opcional, que lê em voz alta o texto que já está na tela.</li>
        <li>Tradução para Libras com o <b>VLibras</b>, do Governo Federal: ligue o perfil <b>🤟 Libras</b> no painel ♿ e use o botão azul com a mão, no lado direito da tela. O VLibras só é carregado se você ligar a opção (veja a <a href="#/privacidade">política de privacidade</a>).</li>
        <li>Os textos usam linguagem simples, com glossário das palavras técnicas.</li>
      </ul>

      <h2>Pessoas mudas ou com dificuldade de fala</h2>
      <ul>
        <li>Nada pede voz: não há comando por fala nem atendimento por telefone.</li>
        <li>Tudo funciona com teclado, mouse ou toque, e o contato é por escrito (veja abaixo).</li>
      </ul>

      <h2>Pessoas neurodivergentes</h2>
      <p>O painel ♿ tem perfis de Foco (TDAH), Leitura facilitada (dislexia), Calmo (autismo e sensibilidade sensorial) e Sem pressão (ansiedade), baseados nas recomendações do W3C para acessibilidade cognitiva.</p>

      <h2>Atalhos de teclado</h2>
      <table class="tabela-atalhos">
        <caption class="sr">Atalhos de teclado</caption>
        <thead><tr><th scope="col">Teclas</th><th scope="col">O que fazem</th></tr></thead>
        <tbody>${ATALHOS.map(([teclas, acao]) => `<tr><td><kbd>${teclas}</kbd></td><td>${acao}</td></tr>`).join('')}</tbody>
      </table>

      <h2>Limites conhecidos</h2>
      <ul>
        <li>O editor de código usa o CodeMirror. Ele funciona com leitores de tela, mas o Tab sai do editor em vez de recuar a linha: use Ctrl + ] para recuar.</li>
        <li>O VLibras é um serviço do Governo Federal: se ele estiver fora do ar, a tradução não aparece.</li>
        <li>O certificado em PDF é gerado pela impressão do navegador. Para conferir com leitor de tela, use a página do certificado ou a página de validação.</li>
      </ul>

      <h2>Encontrou uma barreira?</h2>
      <p>Conte para a gente, por escrito, numa <a href="${REPOSITORIO}/issues" target="_blank" rel="noopener noreferrer">issue no GitHub ↗</a>:
        o que você tentou fazer, em qual página e com qual leitor de tela ou recurso. A correção entra na próxima versão.</p>
    </article>`;
}
