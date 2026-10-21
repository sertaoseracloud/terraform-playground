// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { iconeDoRecurso, renderArquiteturaRecursos } from '../src/ui/arquitetura-recursos.js';

const no = (id, extra = {}) => ({ id, rotulo: id, tipo: 'recurso', ...extra });
const montar = (grafo) => {
  const el = document.createElement('div');
  el.innerHTML = renderArquiteturaRecursos(grafo);
  return el;
};

describe('arquitetura ilustrativa', () => {
  it('mostra rede e máscara nos contêineres e portas nos recursos, sem rótulo de ícone oficial', () => {
    const detalhes = [
      { rotulo: 'Rede (CIDR)', valor: '10.0.0.0/16' },
      { rotulo: 'Máscara', valor: '255.255.0.0' },
    ];
    const el = montar({
      nos: [no('aws_vpc.rede', { detalhes }), no('aws_instance.web', {
        detalhes: [{ rotulo: 'Porta', valor: '8080' }, { rotulo: 'Host', valor: '<script>perigo</script>' }],
      })],
      arestas: [], contencoes: [{ filho: 'aws_instance.web', pai: 'aws_vpc.rede', motivo: 'vpc_id' }],
    });
    expect(el.querySelector('.arq-contencao').textContent).toContain('Rede (CIDR): 10.0.0.0/16');
    expect(el.querySelector('.arq-contencao').textContent).toContain('Máscara: 255.255.0.0');
    expect(el.querySelector('.arq-recurso').textContent).toContain('Porta: 8080');
    expect(el.querySelector('.arq-lista').textContent).toContain('Host: <script>perigo</script>');
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).not.toContain('Ícone oficial');
    expect(el.querySelector('a[href$="licenca/"]')).not.toBeNull();
  });

  it('aumenta a altura conforme os detalhes, sem sobrepor recursos ou cabeçalhos', () => {
    const detalhes = Array.from({ length: 12 }, (_, i) => ({ rotulo: 'Porta', valor: String(8000 + i) }));
    const el = montar({
      nos: [no('aws_vpc.rede', { detalhes }), no('aws_instance.a', { detalhes }), no('aws_instance.b')],
      arestas: [], contencoes: [{ filho: 'aws_instance.a', pai: 'aws_vpc.rede', motivo: 'vpc_id' }, { filho: 'aws_instance.b', pai: 'aws_vpc.rede', motivo: 'vpc_id' }],
    });
    const [a, b] = [...el.querySelectorAll('.arq-recurso')];
    const y = (n) => Number(n.getAttribute('transform').match(/,([\d.]+)\)/)[1]);
    expect(y(b)).toBeGreaterThan(y(a) + Number(a.querySelector('rect').getAttribute('height')));
    const cabecalho = el.querySelector('.arq-contencao .arq-detalhe:last-child');
    expect(y(a)).toBeGreaterThan(Number(cabecalho.getAttribute('y')) + 18);
  });

  it.each([
    ['aws_instance.web', 'aws-ec2', 'Amazon EC2'],
    ['aws_vpc.rede', 'aws-vpc', 'Amazon VPC'],
    ['aws_s3_bucket.dados', 'aws-s3', 'Amazon S3'],
    ['aws_eks_cluster.aula', 'aws-eks', 'Amazon EKS'],
    ['aws_db_instance.db', 'aws-rds', 'Amazon RDS'],
    ['aws_lb.front', 'aws-elb', 'Elastic Load Balancing'],
    ['azurerm_linux_virtual_machine.web', 'azure-vm', 'Azure Virtual Machines'],
    ['azurerm_virtual_network.rede', 'azure-vnet', 'Azure Virtual Network'],
    ['azurerm_storage_account.dados', 'azure-storage', 'Azure Storage'],
    ['azurerm_kubernetes_cluster.aula', 'azure-aks', 'Azure Kubernetes Service (AKS)'],
    ['azurerm_mssql_database.db', 'azure-sql', 'Azure SQL Database'],
    ['azurerm_lb.front', 'azure-lb', 'Azure Load Balancer'],
    ['azurerm_resource_group.aula', 'azure-rg', 'Azure Resource Group'],
    ['data.aws_instance.web', 'aws-ec2', 'Amazon EC2'],
  ])('usa um SVG local oficial para %s', (id, arquivo, nome) => {
    const icone = iconeDoRecurso(no(id));
    expect(icone.src).toBe(`${import.meta.env.BASE_URL}icones-arquitetura/${arquivo}.svg`);
    expect(icone.nome).toBe(nome);
    const svg = readFileSync(resolve('public/icones-arquitetura', `${arquivo}.svg`), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/<script|<foreignObject|\bonload=/i);
  });

  it.each([
    ['Pod', 'pod'], ['Deployment', 'deploy'], ['Service', 'svc'],
    ['Ingress', 'ing'], ['ConfigMap', 'cm'], ['Secret', 'secret'],
    ['PersistentVolumeClaim', 'pvc'], ['PersistentVolume', 'pv'],
    ['StorageClass', 'sc'], ['Namespace', 'ns'], ['ServiceAccount', 'sa'],
    ['HorizontalPodAutoscaler', 'hpa'], ['StatefulSet', 'sts'], ['DaemonSet', 'ds'],
    ['Job', 'job'], ['CronJob', 'cronjob'], ['NetworkPolicy', 'netpol'], ['Role', 'role'],
  ])('usa ícone Kubernetes para %s, sem inferir um provedor cloud', (kind, arquivo) => {
    const icone = iconeDoRecurso(no(`${kind}/aula`, { kind }));
    expect(icone.src).toContain(`k8s-${arquivo}.svg`);
    expect(existsSync(resolve('public/icones-arquitetura', `k8s-${arquivo}.svg`))).toBe(true);
    expect(icone.nome).toBe(`Kubernetes ${kind}`);
  });

  it('mostra relações reais, nomes completos e direção sem prometer tráfego', () => {
    const grafo = {
      nos: [no('aws_instance.web'), no('aws_vpc.rede')],
      arestas: [{ de: 'aws_instance.web', para: 'aws_vpc.rede', motivo: 'vpc_id' }],
    };
    const antes = JSON.stringify(grafo);
    const el = montar(grafo);
    expect(el.querySelectorAll('image')).toHaveLength(2);
    expect(el.querySelectorAll('.arq-ligacao')).toHaveLength(1);
    expect(el.querySelector('.arq-lista').open).toBe(true);
    expect(el.querySelector('.arq-lista').textContent).toContain('aws_instance.web usa aws_vpc.rede (vpc_id)');
    expect(el.querySelector('[role="img"]').getAttribute('aria-label')).toContain('2 recursos e 1 relações');
    expect(el.querySelector('.arq-rolagem').tabIndex).toBe(0);
    expect(el.textContent).toContain('não representa tráfego');
    expect(el.textContent).toContain('código atual');
    expect(JSON.stringify(grafo)).toBe(antes);
  });

  it('explica recursos desconhecidos e não inventa ligações', () => {
    const el = montar({
      nos: [no('custom_coisa.aula'), no('ConfigCustom/aula', { kind: 'ConfigCustom' })],
      arestas: [{ de: 'custom_coisa.aula', para: 'ausente' }],
      avisos: ['Referência não encontrada: <recurso>'],
    });
    expect(el.querySelectorAll('image')).toHaveLength(0);
    expect(el.querySelectorAll('.arq-ligacao')).toHaveLength(0);
    expect(el.textContent).toContain('representação genérica');
    expect(el.textContent).toContain('Nenhuma relação foi identificada');
    expect(el.textContent).toContain('Referência não encontrada: <recurso>');
    expect(el.querySelector('recurso')).toBeNull();
    expect(iconeDoRecurso({ id: 'constructor.aula' })).toEqual({ src: null, nome: 'Recurso' });
  });

  it('mostra início vazio e erro sem manter desenho de sucesso', () => {
    const vazio = montar({ nos: [], arestas: [] });
    expect(vazio.querySelector('svg')).toBeNull();
    expect(vazio.textContent).toContain('não é preciso executar');
    const erro = montar({ erro: '<img src=x onerror=alert(1)>' });
    expect(erro.querySelector('svg')).toBeNull();
    expect(erro.querySelector('img')).toBeNull();
    expect(erro.querySelector('[role="status"]').textContent).toContain('Corrija o código');
  });

  it('escapa rótulos e motivos, preservando nomes longos na alternativa textual', () => {
    const longo = '<script>alert(1)</script>' + 'a'.repeat(60);
    const el = montar({
      nos: [no('a', { rotulo: longo }), { id: 'b', tipo: 'variavel' }],
      arestas: [{ de: 'a', para: 'b', motivo: '<img>' }],
    });
    expect(el.querySelector('script')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.arq-lista').textContent).toContain(longo);
    expect(el.querySelector('.arq-nome').textContent).toContain('…');
  });

  it('mantém ciclos finitos e relações sem motivo na lista', () => {
    const el = montar({ nos: [no('a'), no('b')], arestas: [{ de: 'a', para: 'b' }, { de: 'b', para: 'a' }] });
    expect(el.innerHTML).not.toContain('NaN');
    expect(el.querySelectorAll('.arq-ligacao')).toHaveLength(2);
    expect(el.querySelector('.arq-lista').textContent).toContain('a usa b.');
  });

  it('agrupa por plataforma e função com ícones grandes e conectores ortogonais', () => {
    const el = montar({
      nos: [
        no('aws_instance.web'), no('aws_db_instance.db'), no('aws_vpc.rede'),
        no('azurerm_virtual_network.rede'), no('Pod/web', { kind: 'Pod' }),
      ],
      arestas: [
        { de: 'aws_instance.web', para: 'aws_db_instance.db' },
        { de: 'aws_instance.web', para: 'aws_vpc.rede' },
        { de: 'Pod/web', para: 'azurerm_virtual_network.rede' },
      ],
    });
    expect([...el.querySelectorAll('.arq-plataforma-nome')].map((n) => n.textContent))
      .toEqual(['Amazon Web Services', 'Microsoft Azure', 'Kubernetes']);
    expect(el.querySelectorAll('.arq-area')).toHaveLength(5);
    expect(el.querySelectorAll('.arq-numero')).toHaveLength(0);
    for (const imagem of el.querySelectorAll('image')) {
      expect(imagem.getAttribute('width')).toBe('64');
      expect(imagem.getAttribute('height')).toBe('64');
    }
    for (const ligacao of el.querySelectorAll('.arq-ligacao')) {
      expect(ligacao.getAttribute('d')).toMatch(/^M[\d., -]+ H[\d.]+ V[\d.]+ H[\d.]+$/);
      expect(ligacao.querySelector('title').textContent).toContain(' usa ');
    }
    expect(el.querySelector('.arq-lista').textContent).toContain('Nenhum pertencimento explícito');
    expect(el.textContent).toContain('não são etapas de execução');
  });

  it('empilha recursos da mesma área sem sobrepor os ícones', () => {
    const el = montar({
      nos: [no('aws_instance.a'), no('aws_instance.b'), no('aws_instance.c')],
      arestas: [{ de: 'aws_instance.a', para: 'aws_instance.c' }],
    });
    const transformacoes = [...el.querySelectorAll('image')].map((i) => i.parentElement.getAttribute('transform'));
    expect(new Set(transformacoes).size).toBe(3);
    expect(el.querySelectorAll('.arq-area')).toHaveLength(1);
    expect(el.querySelector('.arq-ligacao').getAttribute('d')).toContain(' V');
  });

  it('aninha rede, sub-rede e aplicação somente com pertencimento explícito', () => {
    const grafo = {
      nos: [no('aws_vpc.rede'), no('aws_subnet.app'), no('aws_instance.web'), no('aws_s3_bucket.fora')],
      arestas: [{ de: 'aws_instance.web', para: 'aws_subnet.app' }, { de: 'aws_subnet.app', para: 'aws_vpc.rede' }, { de: 'aws_instance.web', para: 'aws_vpc.rede' }],
      contencoes: [
        { filho: 'aws_subnet.app', pai: 'aws_vpc.rede', motivo: 'vpc_id' },
        { filho: 'aws_instance.web', pai: 'aws_subnet.app', motivo: 'subnet_id' },
      ],
    };
    const antes = JSON.stringify(grafo);
    const el = montar(grafo);
    expect(el.querySelectorAll('.arq-contencao')).toHaveLength(2);
    expect(el.querySelectorAll('.arq-ligacao')).toHaveLength(0);
    expect(el.querySelector('.arq-lista').textContent).toContain('aws_instance.web usa aws_vpc.rede');
    expect(el.querySelector('.arq-lista').textContent).toContain('aws_instance.web está em aws_subnet.app (subnet_id)');
    const limite = (id) => el.querySelector(`.arq-contencao[data-recurso="${id}"] rect`);
    const numero = (r, a) => Number(r.getAttribute(a));
    const rede = limite('aws_vpc.rede');
    const sub = limite('aws_subnet.app');
    expect(numero(sub, 'x')).toBeGreaterThan(numero(rede, 'x'));
    expect(numero(sub, 'y')).toBeGreaterThan(numero(rede, 'y'));
    expect(numero(sub, 'x') + numero(sub, 'width')).toBeLessThan(numero(rede, 'x') + numero(rede, 'width'));
    expect(numero(sub, 'y') + numero(sub, 'height')).toBeLessThan(numero(rede, 'y') + numero(rede, 'height'));
    const posicao = (id) => el.querySelector(`.arq-recurso[data-recurso="${id}"]`).getAttribute('transform').match(/[\d.]+/g).map(Number);
    expect(posicao('aws_instance.web')[1]).toBeGreaterThan(numero(sub, 'y'));
    expect(posicao('aws_s3_bucket.fora')[1]).toBeLessThan(numero(rede, 'y'));
    expect(JSON.stringify(grafo)).toBe(antes);
  });

  it('recusa ciclos, pai ausente, contenção entre clouds e múltiplos pais com aviso', () => {
    const el = montar({
      nos: [no('aws_vpc.a'), no('aws_vpc.b'), no('azurerm_virtual_network.c')],
      arestas: [],
      contencoes: [
        { filho: 'aws_vpc.a', pai: 'aws_vpc.b', motivo: '<vpc_id>' },
        { filho: 'aws_vpc.b', pai: 'aws_vpc.a', motivo: 'ciclo' },
        { filho: 'aws_vpc.a', pai: 'azurerm_virtual_network.c', motivo: 'segundo pai' },
        { filho: 'azurerm_virtual_network.c', pai: 'aws_vpc.b', motivo: 'outro cloud' },
        { filho: 'ausente', pai: 'aws_vpc.b', motivo: 'ausente' },
      ],
    });
    expect(el.querySelectorAll('.arq-contencao')).toHaveLength(1);
    expect(el.querySelector('[role="note"]').textContent).toContain('ciclo ou plataformas diferentes');
    expect(el.querySelector('[role="note"]').textContent).toContain('Contenção ambígua');
    expect(el.querySelector('[role="note"]').textContent).toContain('recurso ausente');
    expect(el.getElementsByTagName('vpc_id')).toHaveLength(0);
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('oferece termos locais e não carrega assets de terceiros', () => {
    const el = montar({ nos: [no('aws_instance.web')], arestas: [] });
    for (const image of el.querySelectorAll('image')) {
      expect(image.getAttribute('href')).not.toMatch(/^https?:/);
      expect(image.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    }
    expect(el.querySelector('a').getAttribute('href')).toBe(`${import.meta.env.BASE_URL}licenca/`);
    expect(readFileSync(resolve('public/icones-arquitetura/ATRIBUICAO.txt'), 'utf8')).toContain('CC BY 4.0');
  });
});
