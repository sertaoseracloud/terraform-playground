import { esc } from './util.js';
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

function tipoDoRecurso(no) {
  const partes = no.id.split('.');
  return no.kind ?? no.tipoRecurso ?? partes[partes[0] === 'data' ? 1 : 0];
}

export function iconeDoRecurso(no) {
  const tipo = tipoDoRecurso(no);
  const icone = Object.hasOwn(ICONES, tipo) ? ICONES[tipo] : null;
  return icone
    ? { src: `${import.meta.env.BASE_URL}icones-arquitetura/${icone[0]}.svg`, nome: icone[1] }
    : { src: null, nome: no.kind ?? no.tipo ?? 'Recurso' };
}

const curto = (texto, limite) => texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;

const AREAS = [
  { nome: 'Rede e entrada', tipos: ['aws_vpc', 'aws_subnet', 'aws_lb', 'aws_elb', 'aws_security_group', 'aws_internet_gateway', 'aws_route_table', 'azurerm_virtual_network', 'azurerm_subnet', 'azurerm_lb', 'azurerm_public_ip', 'azurerm_network_security_group', 'Service', 'Ingress', 'NetworkPolicy'] },
  { nome: 'Aplicação e execução', tipos: ['aws_instance', 'aws_eks_cluster', 'aws_lambda_function', 'azurerm_linux_virtual_machine', 'azurerm_windows_virtual_machine', 'azurerm_virtual_machine', 'azurerm_kubernetes_cluster', 'Pod', 'Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'HorizontalPodAutoscaler'] },
  { nome: 'Dados e volumes', tipos: ['aws_s3_bucket', 'aws_db_instance', 'aws_dynamodb_table', 'azurerm_storage_account', 'azurerm_mssql_database', 'PersistentVolume', 'PersistentVolumeClaim', 'StorageClass'] },
  { nome: 'Configuração e acesso', tipos: ['aws_iam_role', 'aws_iam_policy', 'azurerm_resource_group', 'azurerm_role_assignment', 'Namespace', 'ConfigMap', 'Secret', 'ServiceAccount', 'Role'] },
  { nome: 'Outros recursos', tipos: [] },
];

function plataformaDoRecurso(no) {
  if (no.kind) return 'Kubernetes';
  const tipo = tipoDoRecurso(no);
  if (tipo.startsWith('aws_')) return 'Amazon Web Services';
  if (tipo.startsWith('azurerm_')) return 'Microsoft Azure';
  return 'Outros recursos do código';
}

function organizarAreas(nos) {
  const plataformas = new Map();
  for (const no of nos) {
    const plataforma = plataformaDoRecurso(no);
    if (!plataformas.has(plataforma)) plataformas.set(plataforma, new Map());
    const grupos = plataformas.get(plataforma);
    const area = AREAS.find((a) => a.tipos.includes(tipoDoRecurso(no))) ?? AREAS.at(-1);
    if (!grupos.has(area)) grupos.set(area, []);
    grupos.get(area).push(no);
  }
  const pos = new Map();
  const regioes = [];
  let y = 20;
  let largura = 0;
  let numero = 0;
  for (const [plataforma, grupos] of plataformas) {
    const altura = 112 + Math.max(...[...grupos.values()].map((g) => g.length)) * 164;
    const regiao = { plataforma, x: 20, y, largura: grupos.size * 272 + 24, altura, areas: [] };
    let coluna = 0;
    for (const area of AREAS) {
      const recursos = grupos.get(area);
      if (!recursos) continue;
      const x = 40 + coluna++ * 272;
      regiao.areas.push({ nome: area.nome, numero: ++numero, x, y: y + 50, altura: altura - 70 });
      recursos.forEach((no, indice) => pos.set(no.id, { x: x + 20, y: y + 100 + indice * 164 }));
    }
    regioes.push(regiao);
    largura = Math.max(largura, regiao.largura + 40);
    y += altura + 32;
  }
  return { pos, regioes, largura, altura: y - 12 };
}

function conector(de, para, indice) {
  const largura = 192;
  const centroY = (p) => p.y + 38;
  if (de.x === para.x) {
    const corredor = de.x + largura + 8 + (indice % 3) * 4;
    return `M${de.x + largura},${centroY(de)} H${corredor} V${centroY(para)} H${para.x + largura}`;
  }
  const direita = para.x > de.x;
  const x1 = de.x + (direita ? largura : 0);
  const x2 = para.x + (direita ? 0 : largura);
  const meio = (x1 + x2) / 2;
  return `M${x1},${centroY(de)} H${meio} V${centroY(para)} H${x2}`;
}

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
  const { pos, regioes, largura, altura } = organizarAreas(nos);
  const fundos = regioes.map((r) => `<g class="arq-plataforma">
    <rect class="arq-limite" x="${r.x}" y="${r.y}" width="${r.largura}" height="${r.altura}"/>
    <text class="arq-plataforma-nome" x="${r.x + 16}" y="${r.y + 28}">${esc(r.plataforma)}</text>
    ${r.areas.map((a) => `<g class="arq-area">
      <rect class="arq-limite-area" x="${a.x}" y="${a.y}" width="232" height="${a.altura}"/>
      <circle class="arq-numero-fundo" cx="${a.x + 18}" cy="${a.y + 18}" r="12"/>
      <text class="arq-numero" x="${a.x + 18}" y="${a.y + 23}" text-anchor="middle">${a.numero}</text>
      <text class="arq-area-nome" x="${a.x + 38}" y="${a.y + 23}">${esc(a.nome)}</text>
    </g>`).join('')}
  </g>`).join('');
  const linhas = ligacoes.map((a, indice) =>
    `<path class="arq-ligacao" d="${conector(pos.get(a.de), pos.get(a.para), indice)}" marker-end="url(#arq-seta)"><title>${esc(a.de)} usa ${esc(a.para)}</title></path>`
  ).join('');
  const caixas = nos.map((n) => {
    const p = pos.get(n.id);
    const icone = iconeDoRecurso(n);
    const nome = n.rotulo ?? n.id;
    return `<g transform="translate(${p.x},${p.y})">
      <title>${esc(nome)} — ${esc(icone.nome)}</title>
      <rect class="arq-cartao" width="192" height="144"/>
      ${icone.src
        ? `<image href="${esc(icone.src)}" x="64" y="4" width="64" height="64" preserveAspectRatio="xMidYMid meet" aria-hidden="true"/>`
        : '<text x="96" y="50" text-anchor="middle" class="arq-generico" aria-hidden="true">{ }</text>'}
      <text x="96" y="92" text-anchor="middle" class="arq-servico">${esc(curto(icone.nome, 26))}</text>
      <text x="96" y="112" text-anchor="middle" class="arq-nome">${esc(curto(nome, 26))}</text>
      <text x="96" y="132" text-anchor="middle" class="arq-tipo">${icone.src ? 'Ícone oficial' : 'Representação genérica'}</text>
    </g>`;
  }).join('');
  return `${introducao}
    <p>Áreas numeradas agrupam serviços por função, não são etapas de execução nem fronteiras reais
      de rede ou cluster. Explore com a rolagem; nomes completos e relações estão na lista abaixo.</p>
    <div class="arq-rolagem" tabindex="0" role="region" aria-label="Desenho da arquitetura, área com rolagem">
      <svg viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img"
        aria-label="Arquitetura com ${nos.length} recursos e ${ligacoes.length} relações. Lista equivalente em texto logo abaixo.">
        <defs><marker id="arq-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="arq-ponta" d="M0,0 L10,5 L0,10 z"/></marker></defs>
        ${fundos}${linhas}${caixas}
      </svg>
    </div>
    <details class="arq-lista" open><summary>Recursos e relações em texto</summary>
      <ul>${regioes.flatMap((r) => r.areas.map((a) => `<li>Área ${a.numero}: ${esc(r.plataforma)} — ${esc(a.nome)}</li>`)).join('')}</ul>
      <ul>${nos.map((n) => `<li><code>${esc(n.rotulo ?? n.id)}</code> — ${esc(iconeDoRecurso(n).nome)}</li>`).join('')}</ul>
      <ul>${ligacoes.map((a) => `<li><code>${esc(a.de)}</code> usa <code>${esc(a.para)}</code>${a.motivo ? ` (${esc(a.motivo)})` : ''}.</li>`).join('') || '<li>Nenhuma relação foi identificada no código. Isso não comprova conectividade entre recursos.</li>'}</ul>
    </details>
    ${avisos.length ? `<div role="note"><p><strong>Referências a conferir</strong></p><ul>${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    <p class="arq-creditos">Ícones oficiais AWS, Microsoft Azure e Kubernetes usados para documentação.
      Tipos sem ícone cadastrado usam representação genérica. <a href="${import.meta.env.BASE_URL}icones-arquitetura/ATRIBUICAO.txt" target="_blank" rel="noopener noreferrer">Fontes e termos de uso (abre em nova aba)</a>.</p>`;
}
