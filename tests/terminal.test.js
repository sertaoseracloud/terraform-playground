// @vitest-environment happy-dom
// Terminal: o ritmo da saída (src/tf/saida.js) e a animação (src/ui/terminal.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executarTerraform } from '../src/tf/motor.js';
import { linhasDoResultado, textoDoResultado } from '../src/tf/saida.js';
import { criarTerminal } from '../src/ui/terminal.js';
import { buscarItem } from '../src/conteudo/trilha.js';

const BUCKET = {
  'main.tf': `provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "site" {
  bucket = "site-da-turma-2026"
}

resource "aws_db_instance" "banco" {
  identifier          = "banco"
  engine              = "postgres"
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  username            = "app"
  password            = "uma-senha-longa"
  skip_final_snapshot = true
  tags                = { Bucket = aws_s3_bucket.site.id }
}
`,
};

describe('saída do terraform, como no terminal de verdade', () => {
  it('init baixa os provedores na primeira vez e reaproveita depois', () => {
    const r = executarTerraform(BUCKET, { comando: 'plan' });
    const primeira = linhasDoResultado(r).map((l) => l.texto).join('\n');
    expect(primeira).toContain('- Installing hashicorp/aws v6');
    expect(primeira).toContain('Terraform has created a lock file .terraform.lock.hcl');
    const depois = linhasDoResultado(r, { primeiraVez: false }).map((l) => l.texto).join('\n');
    expect(depois).toContain('- Reusing previous version of hashicorp/aws from the dependency lock file');
    expect(depois).not.toContain('Installing');
  });

  it('apply pede confirmação e respeita as dependências, com "Still creating..." nos demorados', () => {
    const r = executarTerraform(BUCKET, { comando: 'apply' });
    const texto = textoDoResultado(r);
    expect(texto).toContain('Do you want to perform these actions?');
    expect(texto).toContain('  Enter a value: yes');
    const linhas = texto.split('\n');
    const pos = (t) => linhas.findIndex((l) => l.startsWith(t));
    // O banco usa o bucket: só começa depois que o bucket termina.
    expect(pos('aws_db_instance.banco: Creating...')).toBeGreaterThan(pos('aws_s3_bucket.site: Creation complete'));
    expect(texto).toMatch(/aws_db_instance\.banco: Still creating\.\.\. \[00m10s elapsed\]/);
    expect(texto).toMatch(/aws_db_instance\.banco: Creation complete after \d+m\d+s \[id=db-/);
    expect(texto).toContain('Apply complete! Resources: 2 added, 0 changed, 0 destroyed.');
  });

  it('comandos são digitados e o apply espera o "yes"', () => {
    const r = executarTerraform(BUCKET, { comando: 'apply', workspace: 'prod' });
    const linhas = linhasDoResultado(r);
    const digitadas = linhas.filter((l) => l.digitar !== undefined).map((l) => l.texto);
    expect(digitadas).toEqual(['$ terraform init', '$ terraform workspace select prod', '$ terraform apply', '  Enter a value: yes']);
    expect(linhas.find((l) => l.texto.startsWith('Do you want'))?.texto).toBe('Do you want to perform these actions in workspace "prod"?');
  });

  it('os tempos são sempre os mesmos para o mesmo código', () => {
    const a = textoDoResultado(executarTerraform(BUCKET, { comando: 'apply' }));
    const b = textoDoResultado(executarTerraform(BUCKET, { comando: 'apply' }));
    expect(a).toBe(b);
  });

  it('destroy sem nada no estado diz que não há o que destruir', () => {
    const r = executarTerraform(BUCKET, { comando: 'destroy' });
    expect(textoDoResultado(r)).toContain('No changes. No objects need to be destroyed.');
  });

  it('destroy apaga primeiro quem depende', () => {
    const item = buscarItem('proj-rede-5');
    const criado = executarTerraform(item.solucao, { comando: 'apply', semente: item.id });
    const r = executarTerraform(item.solucao, { comando: 'destroy', estado: criado.estado, semente: item.id });
    const linhas = textoDoResultado(r).split('\n');
    const pos = (t) => linhas.findIndex((l) => l.startsWith(t));
    expect(pos('aws_vpc.principal: Destroying...')).toBeGreaterThan(pos('aws_subnet.publica[0]: Destruction complete'));
    expect(pos('aws_security_group.web: Destroying...')).toBeGreaterThan(pos('aws_security_group.app: Destruction complete'));
  });
});

describe('terminal animado', () => {
  let pre;
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.className = '';
    pre = document.createElement('pre');
    document.body.append(pre);
  });
  afterEach(() => {
    vi.useRealTimers();
    pre.remove();
  });

  const linhas = () => linhasDoResultado(executarTerraform(BUCKET, { comando: 'apply' }));

  it('digita o comando aos poucos e termina com o prompt e o cursor', async () => {
    const mudancas = [];
    const t = criarTerminal(pre, { aoMudar: (a) => mudancas.push(a) });
    const fim = t.mostrar(linhas(), { pasta: 'aula' });
    await vi.advanceTimersByTimeAsync(120);
    expect(pre.textContent).toMatch(/^aluno@sertao:~\/aula\$ t(e|er|err)?$/);
    expect(pre.getAttribute('aria-busy')).toBe('true');
    await vi.runAllTimersAsync();
    await fim;
    expect(pre.textContent).toContain('Apply complete! Resources: 2 added');
    expect(pre.lastElementChild.className).toBe('cursor');
    expect(pre.textContent.trimEnd().endsWith('aluno@sertao:~/aula$')).toBe(true);
    expect(pre.getAttribute('aria-busy')).toBe('false');
    expect(mudancas).toEqual([true, false]);
  });

  it('⏩ Pular mostra tudo na hora', async () => {
    const t = criarTerminal(pre);
    const fim = t.mostrar(linhas(), { pasta: 'aula' });
    await vi.advanceTimersByTimeAsync(300);
    t.pular();
    await fim;
    expect(pre.textContent).toContain('Apply complete!');
    expect(pre.textContent).toContain('aluno@sertao:~/aula$ terraform apply');
    expect(t.animando).toBe(false);
  });

  it('com "Reduzir animações", aparece tudo de uma vez', async () => {
    document.documentElement.classList.add('a11y-sem-movimento');
    const t = criarTerminal(pre);
    await t.mostrar(linhas(), { pasta: 'aula' });
    expect(pre.textContent).toContain('Apply complete!');
  });

  it('uma execução nova cancela a anterior', async () => {
    const t = criarTerminal(pre);
    t.mostrar(linhas(), { pasta: 'aula' });
    await vi.advanceTimersByTimeAsync(500);
    await t.mostrar([{ texto: '$ terraform plan', classe: 'comando' }], { animar: false, pasta: 'aula' });
    await vi.runAllTimersAsync();
    expect(pre.textContent).not.toContain('init');
    expect(pre.textContent).toContain('terraform plan');
  });
});
