// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  PADRAO, PERFIS, TEMAS, OPCOES, TAMANHOS,
  normalizarPreferencias, aplicarPreferencias, alternarPerfil, perfilAtivo,
} from '../src/ui/preferencias.js';

describe('normalizarPreferencias', () => {
  it('sem nada salvo usa o padrão', () => {
    expect(normalizarPreferencias(null)).toEqual(PADRAO);
  });

  it('ignora valores inválidos e mantém os válidos', () => {
    expect(normalizarPreferencias({ tema: 'rosa-choque', tamanho: 999, fonteLegivel: true, extra: 1 })).toEqual({
      ...PADRAO,
      fonteLegivel: true,
    });
    expect(normalizarPreferencias({ tema: 'claro', tamanho: TAMANHOS[3] })).toEqual({ ...PADRAO, tema: 'claro', tamanho: TAMANHOS[3] });
  });
});

describe('aplicarPreferencias', () => {
  it('define tema, escala e classes no elemento raiz', () => {
    const raiz = document.createElement('html');
    aplicarPreferencias({ ...PADRAO, tema: 'alto-contraste', tamanho: 125, espacamento: true, sublinharLinks: true }, raiz);
    expect(raiz.dataset.tema).toBe('alto-contraste');
    expect(raiz.style.getPropertyValue('--escala')).toBe('1.25');
    expect(raiz.classList.contains('a11y-espacamento')).toBe(true);
    expect(raiz.classList.contains('a11y-links')).toBe(true);
    expect(raiz.classList.contains('a11y-fonte-legivel')).toBe(false);

    aplicarPreferencias(PADRAO, raiz);
    expect(raiz.classList.contains('a11y-espacamento')).toBe(false);
    expect(raiz.dataset.tema).toBe('dracula');
  });
});

describe('perfis para pessoas neurodivergentes', () => {
  it('cada perfil só usa opções e temas que existem', () => {
    for (const perfil of Object.values(PERFIS)) {
      for (const [chave, valor] of Object.entries(perfil.valores)) {
        if (chave === 'tema') expect(valor in TEMAS).toBe(true);
        else expect(chave in OPCOES).toBe(true);
      }
    }
  });

  it('ligar um perfil mantém as outras escolhas; ligar de novo desliga', () => {
    const base = { ...PADRAO, tamanho: 125, sublinharLinks: true };
    const comFoco = alternarPerfil(base, 'foco');
    expect(perfilAtivo(comFoco, 'foco')).toBe(true);
    expect(comFoco).toMatchObject({ tamanho: 125, sublinharLinks: true, modoFoco: true, checklist: true });
    const semFoco = alternarPerfil(comFoco, 'foco');
    expect(perfilAtivo(semFoco, 'foco')).toBe(false);
    expect(semFoco).toEqual(base);
  });

  it('o perfil calmo troca para o tema suave e para as animações', () => {
    expect(alternarPerfil(PADRAO, 'calmo')).toMatchObject({ tema: 'suave', reduzirMovimento: true, semPressao: true });
  });

  it('as novas opções viram classes no <html>', () => {
    const raiz = document.createElement('html');
    aplicarPreferencias({ ...PADRAO, modoFoco: true, reguaLeitura: true, semPressao: true }, raiz);
    expect([...raiz.classList]).toEqual(expect.arrayContaining(['a11y-foco', 'a11y-regua', 'a11y-sem-pressao']));
  });
});
