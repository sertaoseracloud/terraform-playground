// Preferências de acessibilidade: tema, tamanho do texto, leitura, foco e conforto,
// mais perfis prontos para pessoas neurodivergentes (TDAH, dislexia, autismo,
// ansiedade), baseados nas recomendações do W3C para acessibilidade cognitiva (COGA),
// e para pessoas cegas (leitor de tela) e surdas (Libras com o VLibras).
// Aplicadas como atributos/classes no <html>; o CSS faz o resto (estilo.css).

export const TEMAS = {
  dracula: 'Dracula (escuro)',
  'alto-contraste': 'Alto contraste',
  claro: 'Claro',
  suave: 'Suave (cores calmas, pouco brilho)',
};

export const TAMANHOS = [87.5, 100, 112.5, 125, 150, 175];

/** Opções liga/desliga, em grupos para o painel. */
export const GRUPOS = {
  'Visão e audição': {
    leitorTela: 'Modo leitor de tela: terminal sem animação e resultados falados com todos os detalhes',
    libras: 'Tradução para Libras com o VLibras (carrega o tradutor do Governo Federal)',
  },
  Leitura: {
    fonteLegivel: 'Fonte mais legível (Atkinson Hyperlegible)',
    espacamento: 'Mais espaço entre linhas e letras',
    linhasCurtas: 'Linhas de texto mais curtas',
    reguaLeitura: 'Régua de leitura (destaca a linha sob o mouse)',
    sublinharLinks: 'Sublinhar links e destacar o foco',
  },
  'Foco e organização': {
    modoFoco: 'Modo foco: mostra só o módulo atual e esconde o que distrai',
    checklist: 'Transformar os pedidos do exercício em lista de tarefas',
    lembretePausa: 'Lembrar de fazer uma pausa a cada 25 minutos',
  },
  Conforto: {
    reduzirMovimento: 'Reduzir animações',
    semPressao: 'Sem pressão: esconder XP, nível e sequência; mensagens mais gentis',
  },
};

export const OPCOES = Object.assign({}, ...Object.values(GRUPOS));

const CLASSES = {
  leitorTela: 'a11y-leitor-tela',
  libras: 'a11y-libras',
  fonteLegivel: 'a11y-fonte-legivel',
  espacamento: 'a11y-espacamento',
  linhasCurtas: 'a11y-linhas-curtas',
  reguaLeitura: 'a11y-regua',
  sublinharLinks: 'a11y-links',
  modoFoco: 'a11y-foco',
  checklist: 'a11y-checklist',
  reduzirMovimento: 'a11y-sem-movimento',
  semPressao: 'a11y-sem-pressao',
};

export const PADRAO = {
  tema: 'dracula',
  tamanho: 100,
  ...Object.fromEntries(Object.keys(OPCOES).map((chave) => [chave, false])),
};

/**
 * Perfis: atalhos que ligam um conjunto de opções. Não são diagnósticos: cada
 * pessoa é diferente, e as opções continuam ajustáveis uma a uma.
 */
export const PERFIS = {
  leitorTela: {
    rotulo: '🦯 Leitor de tela',
    ajuda: 'Para pessoas cegas ou com baixa visão (NVDA, JAWS, VoiceOver, TalkBack): terminal sem animação e resultados falados com todos os detalhes.',
    valores: { leitorTela: true, reduzirMovimento: true },
  },
  libras: {
    rotulo: '🤟 Libras',
    ajuda: 'Para pessoas surdas: liga o VLibras, que traduz o texto para Libras com um avatar. Nada no site depende de som.',
    valores: { libras: true },
  },
  foco: {
    rotulo: '🎯 Foco',
    ajuda: 'Menos distrações, pedidos em lista de tarefas e lembrete de pausa. Pode ajudar quem tem TDAH.',
    valores: { modoFoco: true, checklist: true, lembretePausa: true, reduzirMovimento: true },
  },
  leitura: {
    rotulo: '📖 Leitura facilitada',
    ajuda: 'Fonte legível, mais espaço, linhas curtas e régua de leitura. Pode ajudar quem tem dislexia.',
    valores: { fonteLegivel: true, espacamento: true, linhasCurtas: true, reguaLeitura: true, sublinharLinks: true },
  },
  calmo: {
    rotulo: '🌿 Calmo',
    ajuda: 'Cores suaves, nada se mexe e nada de surpresas. Pode ajudar pessoas autistas ou com sensibilidade sensorial.',
    valores: { tema: 'suave', reduzirMovimento: true, semPressao: true, linhasCurtas: true },
  },
  semPressao: {
    rotulo: '🤝 Sem pressão',
    ajuda: 'Esconde pontuação e contagem de dias e troca "Resposta errada" por mensagens gentis. Pode ajudar em casos de ansiedade.',
    valores: { semPressao: true, reduzirMovimento: true },
  },
};

/** O perfil está ligado quando todas as opções dele estão ligadas. */
export const perfilAtivo = (prefs, id) =>
  Object.entries(PERFIS[id].valores).every(([chave, valor]) => prefs[chave] === valor);

/** Liga o perfil (mantendo o resto) ou, se já estava ligado, desliga as opções dele. */
export function alternarPerfil(prefs, id) {
  const { valores } = PERFIS[id];
  if (!perfilAtivo(prefs, id)) return { ...prefs, ...valores };
  return { ...prefs, ...Object.fromEntries(Object.keys(valores).map((chave) => [chave, PADRAO[chave]])) };
}

export function normalizarPreferencias(salvas) {
  const p = { ...PADRAO };
  if (!salvas || typeof salvas !== 'object') return p;
  if (salvas.tema in TEMAS) p.tema = salvas.tema;
  if (TAMANHOS.includes(salvas.tamanho)) p.tamanho = salvas.tamanho;
  for (const chave of Object.keys(OPCOES)) {
    if (typeof salvas[chave] === 'boolean') p[chave] = salvas[chave];
  }
  return p;
}

/** Cor da barra do navegador (meta theme-color) em cada tema: o --fundo-escuro dele. */
export const COR_DA_BARRA = {
  dracula: '#21222c',
  'alto-contraste': '#0b0b0b',
  claro: '#f4f0dc',
  suave: '#25272c',
};

/**
 * Ajustes vindos do sistema operacional, para quem ainda não escolheu nada no painel:
 * "reduzir movimento", "aumentar contraste" e o modo claro.
 */
export function preferenciasDoSistema(prefs, consultar = (q) => window.matchMedia?.(q).matches ?? false) {
  const p = { ...prefs };
  if (consultar('(prefers-reduced-motion: reduce)')) p.reduzirMovimento = true;
  if (consultar('(prefers-contrast: more)') || consultar('(forced-colors: active)')) p.tema = 'alto-contraste';
  else if (consultar('(prefers-color-scheme: light)')) p.tema = 'claro';
  return p;
}

export function aplicarPreferencias(p, raiz = document.documentElement) {
  raiz.dataset.tema = p.tema;
  raiz.ownerDocument?.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_DA_BARRA[p.tema] ?? COR_DA_BARRA.dracula);
  raiz.style.setProperty('--escala', String(p.tamanho / 100));
  for (const [chave, classe] of Object.entries(CLASSES)) raiz.classList.toggle(classe, Boolean(p[chave]));
}
