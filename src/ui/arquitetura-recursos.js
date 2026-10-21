import { esc } from './util.js';
import { layoutGrafo } from './grafo.js';
import './arquitetura-recursos.css';

const ICONES = {
  aws_instance: ['aws-ec2', 'Amazon EC2'],
  aws_vpc: ['aws-vpc', 'Amazon VPC'],
  aws_s3_bucket: ['aws-s3', 'Amazon S3'],
  aws_eks_cluster: ['aws-eks', 'Amazon EKS'],
  aws_db_instance: ['aws-rds', 'Amazon RDS'],
  aws_lb: ['aws-elb', 'Elastic Load Balancing'],
  aws_elb: ['aws-elb', 'Elastic Load Balancing'],
  azurerm_linux_virtual_machine: ['azure-vm', 'Azure Virtual Machines'],
  azurerm_windows_virtual_machine: ['azure-vm', 'Azure Virtual Machines'],
  azurerm_virtual_machine: ['azure-vm', 'Azure Virtual Machines'],
  azurerm_virtual_network: ['azure-vnet', 'Azure Virtual Network'],
  azurerm_storage_account: ['azure-storage', 'Azure Storage'],
  azurerm_kubernetes_cluster: ['azure-aks', 'Azure Kubernetes Service (AKS)'],
  azurerm_mssql_database: ['azure-sql', 'Azure SQL Database'],
  azurerm_lb: ['azure-lb', 'Azure Load Balancer'],
  azurerm_resource_group: ['azure-rg', 'Azure Resource Group'],
  Pod: ['k8s-pod', 'Kubernetes Pod'],
  Deployment: ['k8s-deploy', 'Kubernetes Deployment'],
  Service: ['k8s-svc', 'Kubernetes Service'],
  Ingress: ['k8s-ing', 'Kubernetes Ingress'],
  ConfigMap: ['k8s-cm', 'Kubernetes ConfigMap'],
  Secret: ['k8s-secret', 'Kubernetes Secret'],
  PersistentVolumeClaim: ['k8s-pvc', 'Kubernetes PersistentVolumeClaim'],
  PersistentVolume: ['k8s-pv', 'Kubernetes PersistentVolume'],
  StorageClass: ['k8s-sc', 'Kubernetes StorageClass'],
  Namespace: ['k8s-ns', 'Kubernetes Namespace'],
  ServiceAccount: ['k8s-sa', 'Kubernetes ServiceAccount'],
  HorizontalPodAutoscaler: ['k8s-hpa', 'Kubernetes HorizontalPodAutoscaler'],
  StatefulSet: ['k8s-sts', 'Kubernetes StatefulSet'],
  DaemonSet: ['k8s-ds', 'Kubernetes DaemonSet'],
  Job: ['k8s-job', 'Kubernetes Job'],
  CronJob: ['k8s-cronjob', 'Kubernetes CronJob'],
  NetworkPolicy: ['k8s-netpol', 'Kubernetes NetworkPolicy'],
  Role: ['k8s-role', 'Kubernetes Role'],
};

export function iconeDoRecurso(no) {
  const partes = no.id.split('.');
  const tipo = no.kind ?? partes[partes[0] === 'data' ? 1 : 0];
  const icone = Object.hasOwn(ICONES, tipo) ? ICONES[tipo] : null;
  return icone
    ? { src: `${import.meta.env.BASE_URL}icones-arquitetura/${icone[0]}.svg`, nome: icone[1] }
    : { src: null, nome: no.kind ?? no.tipo ?? 'Recurso' };
}

const curto = (texto, limite) => texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;

/** O grafo é do código atual, não uma consulta a recursos provisionados. */
export function renderArquiteturaRecursos(grafo) {
  const introducao = `<h2>Arquitetura do código</h2>
    <p>Este desenho representa o código atual do editor, não uma nuvem real nem a última aplicação.
    A seta vai de quem <strong>usa</strong> para quem <strong>é usado</strong>; não representa tráfego de rede.</p>`;
  if (grafo.erro) {
    return `${introducao}<p role="status">Não foi possível desenhar: ${esc(grafo.erro)} Corrija o código e tente novamente.</p>`;
  }
  const { nos, arestas, avisos = [] } = grafo;
  if (!nos.length) {
    return `${introducao}<p>Seu desenho aparecerá aqui quando houver recursos no código.
      Comece pelo exemplo do exercício; não é preciso executar para visualizar.</p>`;
  }
  const ids = new Set(nos.map((n) => n.id));
  const ligacoes = arestas.filter((a) => ids.has(a.de) && ids.has(a.para));
  const layout = layoutGrafo({ nos, arestas: ligacoes });
  const larguraNo = 264;
  const alturaNo = 106;
  const pos = new Map(nos.map((n) => {
    const p = layout.pos.get(n.id);
    return [n.id, {
      x: 16 + ((p.x - 10) / (layout.LARGURA + 60)) * 336,
      y: 16 + ((p.y - 10) / (layout.ALTURA + 14)) * 132,
    }];
  }));
  const largura = Math.max(...[...pos.values()].map((p) => p.x)) + larguraNo + 16;
  const altura = Math.max(...[...pos.values()].map((p) => p.y)) + alturaNo + 16;
  const linhas = ligacoes.map((a) => {
    const de = pos.get(a.de);
    const para = pos.get(a.para);
    const x1 = de.x;
    const x2 = para.x + larguraNo;
    const y1 = de.y + alturaNo / 2;
    const y2 = para.y + alturaNo / 2;
    const meio = (x1 + x2) / 2;
    return `<path class="arq-ligacao" d="M${x1},${y1} C${meio},${y1} ${meio},${y2} ${x2},${y2}" marker-end="url(#arq-seta)"/>`;
  }).join('');
  const caixas = nos.map((n) => {
    const p = pos.get(n.id);
    const icone = iconeDoRecurso(n);
    const nome = n.rotulo ?? n.id;
    return `<g transform="translate(${p.x},${p.y})">
      <title>${esc(nome)} — ${esc(icone.nome)}</title>
      <rect class="arq-cartao" width="${larguraNo}" height="${alturaNo}" rx="12"/>
      ${icone.src
        ? `<rect class="arq-fundo-icone" x="12" y="12" width="52" height="52" rx="4"/>
           <image href="${esc(icone.src)}" x="16" y="16" width="44" height="44" preserveAspectRatio="xMidYMid meet" aria-hidden="true"/>`
        : '<text x="20" y="45" class="arq-generico" aria-hidden="true">{ }</text>'}
      <text x="76" y="33" class="arq-servico">${esc(curto(icone.nome, 23))}</text>
      <text x="76" y="54" class="arq-tipo">${icone.src ? 'Ícone oficial' : 'Representação genérica'}</text>
      <text x="12" y="86" class="arq-nome">${esc(curto(nome, 32))}</text>
    </g>`;
  }).join('');
  return `${introducao}
    <p>Explore o desenho com a rolagem. Os nomes completos e as mesmas relações estão na lista abaixo.</p>
    <div class="arq-rolagem" tabindex="0" role="region" aria-label="Desenho da arquitetura, área com rolagem">
      <svg viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img"
        aria-label="Arquitetura com ${nos.length} recursos e ${ligacoes.length} relações. Lista equivalente em texto logo abaixo.">
        <defs><marker id="arq-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="arq-ponta" d="M0,0 L10,5 L0,10 z"/></marker></defs>
        ${linhas}${caixas}
      </svg>
    </div>
    <details class="arq-lista" open><summary>Recursos e relações em texto</summary>
      <ul>${nos.map((n) => `<li><code>${esc(n.rotulo ?? n.id)}</code> — ${esc(iconeDoRecurso(n).nome)}</li>`).join('')}</ul>
      <ul>${ligacoes.map((a) => `<li><code>${esc(a.de)}</code> usa <code>${esc(a.para)}</code>${a.motivo ? ` (${esc(a.motivo)})` : ''}.</li>`).join('') || '<li>Nenhuma relação foi identificada no código. Isso não comprova conectividade entre recursos.</li>'}</ul>
    </details>
    ${avisos.length ? `<div role="note"><p><strong>Referências a conferir</strong></p><ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    <p class="arq-creditos">Ícones oficiais AWS, Microsoft Azure e Kubernetes usados para documentação.
      Tipos sem ícone cadastrado usam representação genérica. <a href="${import.meta.env.BASE_URL}icones-arquitetura/ATRIBUICAO.txt" target="_blank" rel="noopener noreferrer">Fontes e termos de uso (abre em nova aba)</a>.</p>`;
}
