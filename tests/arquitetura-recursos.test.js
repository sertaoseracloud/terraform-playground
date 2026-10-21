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
    expect(el.textContent).toContain('Representação genérica');
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

  it('oferece termos locais e não carrega assets de terceiros', () => {
    const el = montar({ nos: [no('aws_instance.web')], arestas: [] });
    for (const image of el.querySelectorAll('image')) {
      expect(image.getAttribute('href')).not.toMatch(/^https?:/);
      expect(image.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    }
    expect(el.querySelector('a').getAttribute('href')).toContain('icones-arquitetura/ATRIBUICAO.txt');
    expect(readFileSync(resolve('public/icones-arquitetura/ATRIBUICAO.txt'), 'utf8')).toContain('CC BY 4.0');
  });
});
