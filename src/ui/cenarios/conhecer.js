// "Conhecer a vila": a alternativa em texto para o cenário, que é decorativo (aria-hidden). Um botão
// por módulo abre a lista dos moradores com as definições que cada um ensina (as mesmas que aparecem
// ao clicar no personagem) e quanto a vila já cresceu. Funciona por teclado e no leitor de tela.
import { CENARIOS } from './index.js';
import { FALAS_DA_VILA } from '../../conteudo/falas-da-vila.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Quantas casas, crianças e filhotes a vila ganhou (o mesmo ciclo de vila.js, sem contar o espaço). */
export function contarDaVila(cenario, feitos) {
  const temPessoa = cenario.personagens.some((p) => p.tipo === 'pessoa');
  const temAnimal = cenario.personagens.some((p) => p.tipo !== 'pessoa');
  const conta = { casas: 0, filhos: 0, filhotes: 0 };
  for (let i = 0; i < feitos; i++) {
    const passo = ['casa', 'filho', 'filhote'][i % 3];
    if (passo === 'casa') conta.casas += 1;
    else if ((passo === 'filho' && temPessoa) || !temAnimal) conta.filhos += 1;
    else conta.filhotes += 1;
  }
  return conta;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O botão e a lista (fechada) do módulo `idModulo`, com o cenário `idCenario`; '' sem cenário. */
export function htmlConhecerVila(idCenario, idModulo, feitos = 0) {
  const cen = CENARIOS[idCenario];
  if (!cen) return '';
  // Todas as definições de cada morador: a lista é a revisão completa do que a vila ensina.
  const moradores = cen.personagens.flatMap((p) => {
    const info = FALAS_DA_VILA[p.id];
    return info ? info.falas.map((fala) => `<li><b>${esc(info.nome)}</b> — ${esc(fala)}</li>`) : [];
  }).join('');
  const { casas, filhos, filhotes } = contarDaVila(cen, feitos);
  const crescimento = feitos
    ? `Com os seus ${plural(feitos, 'exercício resolvido', 'exercícios resolvidos')} aqui, a vila ganhou ${plural(casas, 'casa', 'casas')}, ${plural(filhos, 'criança', 'crianças')} e ${plural(filhotes, 'filhote', 'filhotes')}.`
    : 'A cada exercício resolvido neste módulo, a vila ganha uma casa, uma criança ou um filhote.';
  return `
      <div class="vila-acoes">
        <button type="button" class="btn-vila" aria-expanded="false" aria-controls="vila-${esc(idModulo)}"><span aria-hidden="true">🏘️</span> Conhecer a vila</button>
      </div>
      <div class="vila-lista" id="vila-${esc(idModulo)}" hidden>
        <p>Cenário: <b>${esc(cen.nome)}</b>. É só enfeite: a trilha não depende dele.</p>
        <ul>${moradores}</ul>
        <p>${crescimento}</p>
      </div>`;
}
