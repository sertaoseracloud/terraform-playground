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
const NOMES_GENERICOS = { aws_subnet: 'Sub-rede AWS', azurerm_subnet: 'Sub-rede Azure' };

function tipoDoRecurso(no) {
  const partes = no.id.split('.');
  return no.kind ?? no.tipoRecurso ?? partes[partes[0] === 'data' ? 1 : 0];
}

export function iconeDoRecurso(no) {
  const tipo = tipoDoRecurso(no);
  const icone = Object.hasOwn(ICONES, tipo) ? ICONES[tipo] : null;
  return icone
    ? { src: `${import.meta.env.BASE_URL}icones-arquitetura/${icone[0]}.svg`, nome: icone[1] }
    : { src: null, nome: Object.hasOwn(NOMES_GENERICOS, tipo) ? NOMES_GENERICOS[tipo] : no.kind ?? no.tipoRecurso ?? no.tipo ?? 'Recurso' };
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

function organizarAreas(nos, contencoes) {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const pais = new Map();
  const avisos = [];
  for (const c of contencoes) {
    if (!porId.has(c.filho) || !porId.has(c.pai)) {
      avisos.push(`Contenção não desenhada: ${c.filho} em ${c.pai}; recurso ausente.`);
      continue;
    }
    if (pais.has(c.filho)) {
      avisos.push(`Contenção ambígua para ${c.filho}; mantido o primeiro pai.`);
      continue;
    }
    let ancestral = c.pai;
    const visitados = new Set([c.filho]);
    while (ancestral && !visitados.has(ancestral)) {
      visitados.add(ancestral);
      ancestral = pais.get(ancestral)?.pai;
    }
    if (ancestral || plataformaDoRecurso(porId.get(c.filho)) !== plataformaDoRecurso(porId.get(c.pai))) {
      avisos.push(`Contenção não desenhada: ${c.filho} em ${c.pai}; ciclo ou plataformas diferentes.`);
      continue;
    }
    pais.set(c.filho, c);
  }
  const filhos = new Map(nos.map((n) => [n.id, []]));
  for (const c of pais.values()) filhos.get(c.pai).push(porId.get(c.filho));
  const medir = (recursos) => {
    const grupos = AREAS.map((area) => ({
      area,
      recursos: recursos.filter((n) => !filhos.get(n.id).length
        && (AREAS.find((a) => a.tipos.includes(tipoDoRecurso(n))) ?? AREAS.at(-1)) === area),
    })).filter((g) => g.recursos.length);
    const colunas = grupos.map((g) => ({ ...g, largura: 240, altura: 64 + g.recursos.length * 164 }));
    const caixas = recursos.filter((n) => filhos.get(n.id).length).map((no) => {
      const conteudo = medir(filhos.get(no.id));
      return { no, conteudo, largura: Math.max(320, conteudo.largura + 48), altura: conteudo.altura + 100 };
    });
    const largura = Math.max(0, colunas.length * 280 - 40, ...caixas.map((c) => c.largura));
    const topo = colunas.length ? Math.max(...colunas.map((c) => c.altura)) + 32 : 0;
    return { colunas, caixas, largura, altura: topo + caixas.reduce((s, c) => s + c.altura + 32, 0) };
  };
  const pos = new Map();
  const regioes = [];
  const caixas = [];
  const areas = [];
  const posicionar = (conteudo, x, y) => {
    conteudo.colunas.forEach((g, i) => {
      const gx = x + i * 280;
      areas.push({ nome: g.area.nome, indice: AREAS.indexOf(g.area), x: gx, y, largura: g.largura, altura: g.altura - 12 });
      g.recursos.forEach((n, j) => pos.set(n.id, { x: gx + 24, y: y + 48 + j * 164, largura: 192, altura: 144 }));
    });
    let cy = y + (conteudo.colunas.length ? Math.max(...conteudo.colunas.map((c) => c.altura)) + 32 : 0);
    for (const c of conteudo.caixas) {
      const caixa = { ...c, x, y: cy };
      caixas.push(caixa);
      pos.set(c.no.id, { x: x + 16, y: cy + 12, largura: c.largura - 32, altura: 52 });
      posicionar(c.conteudo, x + 24, cy + 88);
      cy += c.altura + 32;
    }
  };
  let y = 20;
  let largura = 0;
  for (const plataforma of new Set(nos.map(plataformaDoRecurso))) {
    const raizes = nos.filter((n) => plataformaDoRecurso(n) === plataforma && !pais.has(n.id));
    const conteudo = medir(raizes);
    const regiao = { plataforma, x: 20, y, largura: Math.max(368, conteudo.largura + 48), altura: conteudo.altura + 76 };
    regioes.push(regiao);
    posicionar(conteudo, 44, y + 56);
    largura = Math.max(largura, regiao.largura + 40);
    y += regiao.altura + 32;
  }
  return { pos, regioes, caixas, areas, pais, avisos, largura, altura: y - 12 };
}

function conector(de, para, indice) {
  const centroY = (p) => p.y + Math.min(38, p.altura / 2);
  if (de.x === para.x) {
    const corredor = de.x + Math.max(de.largura, para.largura) + 8 + (indice % 3) * 4;
    return `M${de.x + de.largura},${centroY(de)} H${corredor} V${centroY(para)} H${para.x + para.largura}`;
  }
  const direita = para.x > de.x;
  const x1 = de.x + (direita ? de.largura : 0);
  const x2 = para.x + (direita ? 0 : para.largura);
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
  const { nos, arestas, contencoes = [], avisos = [] } = grafo;
  if (!nos.length) {
    return `${introducao}<p>Seu desenho aparecerá aqui quando houver recursos no código.
      Comece pelo exemplo do exercício; não é preciso executar para visualizar.</p>`;
  }
  const ids = new Set(nos.map((n) => n.id));
  const ligacoes = arestas.filter((a) => ids.has(a.de) && ids.has(a.para));
  const { pos, regioes, caixas: limites, areas, pais, avisos: avisosLayout, largura, altura } = organizarAreas(nos, contencoes);
  const fundos = regioes.map((r) => `<g class="arq-plataforma">
    <rect class="arq-limite" x="${r.x}" y="${r.y}" width="${r.largura}" height="${r.altura}"/>
    <text class="arq-plataforma-nome" x="${r.x + 16}" y="${r.y + 28}">${esc(r.plataforma)}</text>
  </g>`).join('') + limites.map((c) => {
    const icone = iconeDoRecurso(c.no);
    return `<g class="arq-contencao" data-recurso="${esc(c.no.id)}">
      <title>${esc(c.no.id)} — contém recursos associados explicitamente no código</title>
      <rect class="arq-limite-recurso" x="${c.x}" y="${c.y}" width="${c.largura}" height="${c.altura}"/>
      ${icone.src ? `<image href="${esc(icone.src)}" x="${c.x + 16}" y="${c.y + 12}" width="32" height="32" preserveAspectRatio="xMidYMid meet" aria-hidden="true"/>` : ''}
      <text class="arq-container-nome" x="${c.x + 60}" y="${c.y + 32}">${esc(curto(icone.src ? icone.nome : tipoDoRecurso(c.no), Math.floor((c.largura - 76) / 10)))}</text>
      <text class="arq-nome" x="${c.x + 16}" y="${c.y + 64}">${esc(curto(c.no.rotulo ?? c.no.id, Math.floor(c.largura / 8)))}</text>
    </g>`;
  }).join('') + areas.map((a) => `<g class="arq-area">
      <rect class="arq-limite-area arq-funcao-${a.indice}" x="${a.x}" y="${a.y}" width="${a.largura}" height="${a.altura}"/>
      <text class="arq-area-nome" x="${a.x + 12}" y="${a.y + 26}">${esc(a.nome)}</text>
    </g>`).join('');
  const pertenceA = (filho, pai) => {
    for (let c = pais.get(filho); c; c = pais.get(c.pai)) if (c.pai === pai) return true;
    return false;
  };
  const linhas = ligacoes.filter((a) => !pertenceA(a.de, a.para)).map((a, indice) =>
    `<path class="arq-ligacao" d="${conector(pos.get(a.de), pos.get(a.para), indice)}" marker-end="url(#arq-seta)"><title>${esc(a.de)} usa ${esc(a.para)}</title></path>`
  ).join('');
  const caixas = nos.filter((n) => !limites.some((c) => c.no.id === n.id)).map((n) => {
    const p = pos.get(n.id);
    const icone = iconeDoRecurso(n);
    const nome = n.rotulo ?? n.id;
    return `<g class="arq-recurso" data-recurso="${esc(n.id)}" transform="translate(${p.x},${p.y})">
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
    <p>Caixas com nome de recurso representam pertencimento explícito no código.
      As áreas coloridas agrupam por função; não são etapas de execução nem fronteiras de segurança.
      Recursos sem pertencimento identificado ficam fora das caixas nomeadas, sem presumir acesso público.
      O aninhamento substitui setas para os contêineres; todas as dependências continuam na lista.
      Explore com a rolagem; nomes completos, pertencimento e relações estão na lista abaixo.</p>
    <div class="arq-rolagem" tabindex="0" role="region" aria-label="Desenho da arquitetura, área com rolagem">
      <svg viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img"
        aria-label="Arquitetura com ${nos.length} recursos e ${ligacoes.length} relações. Lista equivalente em texto logo abaixo.">
        <defs><marker id="arq-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="arq-ponta" d="M0,0 L10,5 L0,10 z"/></marker></defs>
        ${fundos}${linhas}${caixas}
      </svg>
    </div>
    <details class="arq-lista" open><summary>Recursos e relações em texto</summary>
      <ul>${[...pais.values()].map((c) => `<li><code>${esc(c.filho)}</code> está em <code>${esc(c.pai)}</code> (${esc(c.motivo)}).</li>`).join('') || '<li>Nenhum pertencimento explícito identificado; agrupamento apenas por função.</li>'}</ul>
      <ul>${nos.map((n) => `<li><code>${esc(n.rotulo ?? n.id)}</code> — ${esc(iconeDoRecurso(n).nome)}</li>`).join('')}</ul>
      <ul>${ligacoes.map((a) => `<li><code>${esc(a.de)}</code> usa <code>${esc(a.para)}</code>${a.motivo ? ` (${esc(a.motivo)})` : ''}.</li>`).join('') || '<li>Nenhuma relação foi identificada no código. Isso não comprova conectividade entre recursos.</li>'}</ul>
    </details>
    ${avisos.length || avisosLayout.length ? `<div role="note"><p><strong>Referências a conferir</strong></p><ul>${[...avisos, ...avisosLayout].map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    <p class="arq-creditos">Ícones oficiais AWS, Microsoft Azure e Kubernetes usados para documentação.
      Tipos sem ícone cadastrado usam representação genérica. <a href="${import.meta.env.BASE_URL}icones-arquitetura/ATRIBUICAO.txt" target="_blank" rel="noopener noreferrer">Fontes e termos de uso (abre em nova aba)</a>.</p>`;
}
