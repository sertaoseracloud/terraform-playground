// Páginas "Licença" (#/licenca) e "Termos de uso" (#/termos), em linguagem simples.
import { ATUALIZADA_EM, TITULAR, REPOSITORIO, CODIGO, CONTEUDO, TERCEIROS } from '../licenca.js';
import { CONTROLADOR } from '../privacidade.js';
import { esc, dataPorExtenso } from './util.js';
import { rota } from '../compartilhar.js';

const link = (url, texto) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(texto)}</a>`;

export function renderLicenca(el) {
  el.innerHTML = `
    <article class="pagina-texto">
      <p class="voltar-trilha"><a href="${rota()}">← Página inicial</a></p>
      <h1>📜 Licença</h1>
      <p class="atualizada">Última atualização: ${dataPorExtenso(ATUALIZADA_EM)}</p>

      <section class="resumo-privacidade" aria-labelledby="lic-resumo">
        <h2 id="lic-resumo">Em resumo</h2>
        <ul>
          <li>✅ O DivergeTerraform é <b>software livre</b>: você pode usar, estudar, modificar e compartilhar.</li>
          <li>🔁 É <b>copyleft</b>: quem distribuir uma versão modificada, inclusive como site, precisa liberar o
            código e o conteúdo com a <b>mesma licença</b>.</li>
          <li>✍️ Ao reutilizar, <b>cite a fonte</b>: ${esc(CONTEUDO.atribuicao)}.</li>
          <li>🚫 O nome e a marca <b>${esc(TITULAR)}</b> e os certificados não fazem parte da licença.</li>
        </ul>
      </section>

      <section aria-labelledby="lic-codigo">
        <h2 id="lic-codigo">1. Código-fonte: ${esc(CODIGO.spdx)}</h2>
        <p>O código do site é distribuído sob a ${link(CODIGO.url, CODIGO.nome)}. Ela garante quatro liberdades:
          usar para qualquer fim, estudar como funciona, modificar e distribuir cópias, modificadas ou não.</p>
        <p>Em troca, quem distribuir o programa, ou <b>oferecer uma versão modificada para outras pessoas usarem pela
          internet</b>, precisa disponibilizar o código-fonte completo dessa versão, sob a mesma licença, e manter os
          avisos de direitos autorais.</p>
        <p>O código está em ${link(REPOSITORIO, 'github.com/sertaoseracloud/terraform-playground')}, e o texto completo da
          licença, no arquivo ${link(CODIGO.arquivo, 'LICENSE')}.</p>
      </section>

      <section aria-labelledby="lic-conteudo">
        <h2 id="lic-conteudo">2. Conteúdo didático: ${esc(CONTEUDO.spdx)}</h2>
        <p>Os enunciados, lições, exercícios, projetos, glossário e demais textos estão sob a
          ${link(CONTEUDO.url, CONTEUDO.nome)}. Você pode copiar, adaptar e usar em aula, inclusive
          comercialmente, desde que:</p>
        <ul>
          <li><b>dê o crédito</b>, por exemplo: "${esc(CONTEUDO.atribuicao)}", com o link do site;</li>
          <li><b>indique se fez mudanças</b>;</li>
          <li><b>compartilhe com a mesma licença</b> o material que você criar a partir deste.</li>
        </ul>
      </section>

      <section aria-labelledby="lic-fora">
        <h2 id="lic-fora">3. O que não está incluído</h2>
        <ul>
          <li>O <b>nome, a marca e o logotipo</b> da ${esc(TITULAR)}. Versões modificadas devem usar outro nome e não
            podem dar a entender que são oficiais.</li>
          <li>Os <b>certificados</b>: só a ${esc(TITULAR)} emite certificados em seu nome. Uma cópia do site não pode
            emitir certificados da ${esc(TITULAR)}.</li>
          <li>As <b>chaves usadas na emissão</b> dos certificados, que não fazem parte do código publicado.</li>
        </ul>
      </section>

      <section aria-labelledby="lic-terceiros">
        <h2 id="lic-terceiros">4. Componentes de terceiros</h2>
        <p>O site usa estes componentes, cada um com a sua licença:</p>
        <div class="tabela-rolagem"><table class="tabela-privacidade">
          <tr><th>Componente</th><th>Licença</th></tr>
          ${TERCEIROS.map((t) => `<tr><td>${esc(t.nome)}</td><td><code>${esc(t.licenca)}</code></td></tr>`).join('')}
        </table></div>
      </section>

      <section aria-labelledby="lic-imagens">
        <h2 id="lic-imagens">5. Imagens de arquitetura</h2>
        <p>Os ícones oficiais são de seus respectivos autores e não estão sob a licença do código
          nem do conteúdo didático. São usados sem alterar forma, cor ou proporção e não indicam endosso.</p>
        <ul>
          <li>Amazon Web Services: ${link('https://aws.amazon.com/architecture/icons/', 'AWS Architecture Icons')},
            usados conforme as permissões para diagramas e documentação.</li>
          <li>Microsoft Corporation: ${link('https://learn.microsoft.com/en-us/azure/architecture/icons/', 'Azure Architecture Icons')},
            usados conforme os termos para arquitetura, treinamento e documentação.</li>
          <li>Kubernetes Authors: ${link('https://github.com/kubernetes/community/tree/main/icons', 'Kubernetes Icons')},
            sem modificações, sob ${link('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0')}.</li>
        </ul>
        <p>${link(`${import.meta.env.BASE_URL}icones-arquitetura/ATRIBUICAO.txt`, 'Fontes, versões, atribuições e termos completos das imagens')}.</p>
      </section>

      <section aria-labelledby="lic-contato">
        <h2 id="lic-contato">6. Dúvidas</h2>
        <p>Fale com a gente pelas ${link(CONTROLADOR.contato, 'issues do projeto no GitHub')}.</p>
      </section>
    </article>`;
}

export function renderTermos(el) {
  el.innerHTML = `
    <article class="pagina-texto">
      <p class="voltar-trilha"><a href="${rota()}">← Página inicial</a></p>
      <h1>📄 Termos de uso</h1>
      <p class="atualizada">Última atualização: ${dataPorExtenso(ATUALIZADA_EM)}</p>

      <section class="resumo-privacidade" aria-labelledby="ter-resumo">
        <h2 id="ter-resumo">Em resumo</h2>
        <ul>
          <li>✅ O DivergeTerraform é <b>gratuito</b> e feito para <b>aprender e ensinar</b> programação.</li>
          <li>💾 Não há cadastro: seu progresso fica no seu navegador (veja a <a href="${rota('privacidade')}">privacidade</a>).</li>
          <li>🎓 Os certificados valem como <b>comprovante de participação</b> na trilha, não como diploma.</li>
          <li>🚫 Não use o site para prejudicar outras pessoas nem para falsificar certificados.</li>
        </ul>
      </section>

      <section aria-labelledby="ter-1">
        <h2 id="ter-1">1. Aceitação</h2>
        <p>Ao usar o DivergeTerraform, você concorda com estes termos. Se não concordar, não use o site. Se você for menor
          de idade, use com o acompanhamento de um responsável ou professor.</p>
      </section>

      <section aria-labelledby="ter-2">
        <h2 id="ter-2">2. O serviço</h2>
        <p>O site oferece lições, exercícios corrigidos automaticamente, projetos e um playground para escrever e executar
          Terraform direto no navegador, com um <b>simulador</b>: nada é criado na AWS nem no Azure. Ele é oferecido
          gratuitamente, <b>no estado em que se encontra</b>, e pode mudar, ficar fora do ar ou ser encerrado a qualquer momento.</p>
        <p>O simulador imita o Terraform e os provedores para fins de ensino. Ele não cobre todos os recursos e argumentos,
          e o comportamento pode diferir da ferramenta real: antes de aplicar em produção, confira na documentação oficial.</p>
        <p><b>Terraform</b> é marca da HashiCorp, e AWS e Azure são marcas da Amazon e da Microsoft. Este projeto é
          independente e não tem relação com essas empresas.</p>
      </section>

      <section aria-labelledby="ter-3">
        <h2 id="ter-3">3. Uso permitido</h2>
        <p>Você pode usar o site para estudar, ensinar, montar aulas e compartilhar links de exercícios e de código.
          Não é permitido:</p>
        <ul>
          <li>usar o playground ou os links compartilhados para enganar, atacar ou prejudicar outras pessoas ou sistemas;</li>
          <li>compartilhar por aqui conteúdo ilegal, ofensivo ou que viole direitos de terceiros;</li>
          <li>alterar, falsificar ou emitir certificados em nome de outra pessoa ou da ${esc(TITULAR)};</li>
          <li>tentar interferir no funcionamento do site.</li>
        </ul>
      </section>

      <section aria-labelledby="ter-4">
        <h2 id="ter-4">4. Seu código e seus dados</h2>
        <p>O código que você escreve é seu. Ele fica salvo só no seu navegador; quando você compartilha um link, o código
          vai dentro do link e qualquer pessoa com ele pode ver. Os detalhes estão na
          <a href="${rota('privacidade')}">página de privacidade</a>.</p>
      </section>

      <section aria-labelledby="ter-5">
        <h2 id="ter-5">5. Certificados</h2>
        <ul>
          <li>São emitidos pela ${esc(TITULAR)} para quem conclui os módulos da trilha, na ordem da trilha.</li>
          <li>O nome que aparece no certificado é informado por você: use o seu nome verdadeiro.</li>
          <li>Eles comprovam a conclusão das atividades do DivergeTerraform. <b>Não são diploma nem certificação
            reconhecida pelo MEC</b> ou por outros órgãos.</li>
          <li>Qualquer pessoa pode conferir um certificado na página <a href="${rota('validar')}">Validar certificado</a>.
            Certificados alterados deixam de valer.</li>
        </ul>
      </section>

      <section aria-labelledby="ter-6">
        <h2 id="ter-6">6. Licença e direitos autorais</h2>
        <p>O código é software livre (AGPL-3.0) e o conteúdo didático é aberto (CC BY-SA 4.0). O nome e a marca da
          ${esc(TITULAR)} não estão incluídos. Veja a <a href="${rota('licenca')}">licença</a>.</p>
      </section>

      <section aria-labelledby="ter-7">
        <h2 id="ter-7">7. Responsabilidade</h2>
        <p>O site é uma ferramenta educacional e não deve ser usado para hospedar sistemas reais nem dados sensíveis. Na
          medida permitida pela lei, a ${esc(TITULAR)} não se responsabiliza por perdas causadas pelo uso do site, como
          código ou progresso apagados junto com os dados do navegador.</p>
      </section>

      <section aria-labelledby="ter-8">
        <h2 id="ter-8">8. Mudanças e contato</h2>
        <p>Estes termos podem mudar; a data de atualização fica no topo da página. Eles seguem as leis do Brasil. Dúvidas:
          ${link(CONTROLADOR.contato, 'issues do projeto no GitHub')}.</p>
      </section>
    </article>`;
}
