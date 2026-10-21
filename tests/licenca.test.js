// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TERCEIROS, CODIGO, CONTEUDO } from '../src/licenca.js';
import { renderLicenca, renderTermos } from '../src/ui/paginas-legais.js';
import { lerRota } from '../src/compartilhar.js';

const ler = (arquivo) => readFileSync(resolve(process.cwd(), arquivo), 'utf8');
const pacote = JSON.parse(ler('package.json'));

describe('licenciamento (copyleft)', () => {
  it('código AGPL-3.0-or-later, com o texto oficial no LICENSE', () => {
    expect(pacote.license).toBe('AGPL-3.0-or-later');
    expect(CODIGO.spdx).toBe(pacote.license);
    expect(ler('LICENSE')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  });

  it('conteúdo CC BY-SA 4.0, com o arquivo LICENSE-CONTEUDO.md', () => {
    expect(CONTEUDO.spdx).toBe('CC-BY-SA-4.0');
    expect(ler('LICENSE-CONTEUDO.md')).toContain('CC BY-SA 4.0');
  });

  it('toda dependência que vai para o site está na lista de terceiros, com a licença certa', () => {
    const listados = new Map(TERCEIROS.flatMap((t) => t.pacotes.map((p) => [p, t.licenca])));
    for (const dep of Object.keys(pacote.dependencies)) {
      expect(listados.has(dep), `${dep} sem licença listada`).toBe(true);
      const licenca = JSON.parse(ler(`node_modules/${dep}/package.json`)).license;
      expect(listados.get(dep), dep).toBe(licenca);
    }
  });

  it('o simulador de Terraform é código próprio: nenhuma dependência da HashiCorp', () => {
    expect(Object.keys(pacote.dependencies).some((d) => /hashicorp|terraform/i.test(d))).toBe(false);
  });
});

describe('páginas', () => {
  it('rotas /licenca/ e /termos/', () => {
    expect(lerRota({ pathname: '/licenca/' })).toEqual({ tela: 'licenca' });
    expect(lerRota({ pathname: '/termos/' })).toEqual({ tela: 'termos' });
  });

  it('licença explica copyleft e o que não está incluído', () => {
    const el = document.createElement('main');
    renderLicenca(el);
    expect(el.textContent).toContain('copyleft');
    expect(el.textContent).toContain('AGPL-3.0-or-later');
    expect(el.textContent).toContain('CC-BY-SA-4.0');
    expect(el.textContent).toMatch(/marca/);
    expect(el.querySelector('#lic-imagens').textContent).toContain('Imagens de arquitetura');
    expect(el.textContent).toContain('ícones oficiais');
    expect(el.querySelector('a[href$="icones-arquitetura/ATRIBUICAO.txt"]')).not.toBeNull();
    expect(el.querySelector('a[href="https://aws.amazon.com/architecture/icons/"]')).not.toBeNull();
    expect(el.querySelector('a[href="https://learn.microsoft.com/en-us/azure/architecture/icons/"]')).not.toBeNull();
    expect(el.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/"]')).not.toBeNull();
  });

  it('termos deixam claro que certificado não é diploma', () => {
    const el = document.createElement('main');
    renderTermos(el);
    expect(el.textContent).toMatch(/Não são diploma/);
    expect(el.querySelector('a[href="/privacidade/"]')).not.toBeNull();
    expect(el.querySelector('a[href="/licenca/"]')).not.toBeNull();
  });
});
