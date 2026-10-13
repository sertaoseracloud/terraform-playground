// Painel "♿ Acessibilidade": perfis rápidos, tema, tamanho do texto e opções de
// leitura, foco e conforto. As mudanças valem na hora e ficam salvas.
// Quem precisa reagir (caminho, descrição, pausa) ouve o evento "preferencias".
import {
  TEMAS, TAMANHOS, GRUPOS, PERFIS, PADRAO,
  normalizarPreferencias, aplicarPreferencias, perfilAtivo, alternarPerfil, preferenciasDoSistema,
} from './preferencias.js';
import { lerPreferencia, gravarPreferencia } from '../progresso.js';
import { $ } from './util.js';
import { ativarLibras } from './libras.js';
import { anunciar } from './anuncios.js';

export function iniciarAcessibilidade() {
  let prefs = normalizarPreferencias(lerPreferencia('acessibilidade'));
  // Sem escolha salva, segue o sistema operacional: reduzir movimento, contraste
  // alto e modo claro.
  if (!lerPreferencia('acessibilidade')) prefs = preferenciasDoSistema(prefs);
  aplicarPreferencias(prefs);
  const libras = (ligar) => ativarLibras(ligar).catch(() => {
    anunciar('Não foi possível carregar o VLibras agora. Tente de novo mais tarde.');
  });
  if (prefs.libras) libras(true);

  const dialogo = $('dialogo-a11y');
  const temas = $('a11y-temas');
  const opcoes = $('a11y-opcoes');
  const perfis = $('a11y-perfis');
  const tamanho = $('a11y-tamanho');

  perfis.innerHTML = Object.entries(PERFIS).map(([id, perfil]) => `
    <button type="button" class="perfil" data-perfil="${id}" aria-pressed="false">
      <b>${perfil.rotulo}</b><span>${perfil.ajuda}</span>
    </button>`).join('');

  temas.innerHTML = Object.entries(TEMAS).map(([valor, rotulo]) => `
    <label class="opcao-tema" data-amostra="${valor}">
      <input type="radio" name="tema" value="${valor}">
      <span class="amostra" aria-hidden="true"></span> ${rotulo}
    </label>`).join('');
  opcoes.innerHTML = Object.entries(GRUPOS).map(([grupo, itens]) => `
    <fieldset>
      <legend>${grupo}</legend>
      <div class="opcoes-check">${Object.entries(itens).map(([chave, rotulo]) => `
        <label class="opcao-check"><input type="checkbox" name="${chave}"> ${rotulo}</label>`).join('')}
      </div>
    </fieldset>`).join('');

  function sincronizar() {
    temas.querySelectorAll('input').forEach((i) => { i.checked = i.value === prefs.tema; });
    opcoes.querySelectorAll('input').forEach((i) => { i.checked = prefs[i.name]; });
    perfis.querySelectorAll('[data-perfil]').forEach((b) => {
      b.setAttribute('aria-pressed', String(perfilAtivo(prefs, b.dataset.perfil)));
    });
    tamanho.value = `${prefs.tamanho}%`;
    tamanho.textContent = `${prefs.tamanho}%`;
    $('a11y-menor').disabled = prefs.tamanho === TAMANHOS[0];
    $('a11y-maior').disabled = prefs.tamanho === TAMANHOS.at(-1);
  }

  function mudar(novas) {
    const antes = prefs;
    prefs = { ...prefs, ...novas };
    if (prefs.libras !== antes.libras) libras(prefs.libras);
    aplicarPreferencias(prefs);
    gravarPreferencia('acessibilidade', prefs);
    sincronizar();
    window.dispatchEvent(new CustomEvent('preferencias', { detail: prefs }));
  }

  perfis.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-perfil]');
    if (botao) mudar(alternarPerfil(prefs, botao.dataset.perfil));
  });
  temas.addEventListener('change', (e) => mudar({ tema: e.target.value }));
  opcoes.addEventListener('change', (e) => mudar({ [e.target.name]: e.target.checked }));
  const passo = (delta) => {
    const i = TAMANHOS.indexOf(prefs.tamanho) + delta;
    if (TAMANHOS[i]) mudar({ tamanho: TAMANHOS[i] });
  };
  $('a11y-menor').onclick = () => passo(-1);
  $('a11y-maior').onclick = () => passo(1);
  $('a11y-padrao').onclick = () => mudar({ ...PADRAO });

  $('btn-acessibilidade').onclick = () => {
    sincronizar();
    dialogo.showModal();
  };
  // Clicar fora da janela, ou num link para outra página do site, fecha.
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo || e.target.closest('a[href^="#/"]')) dialogo.close();
  });

  sincronizar();
  return { atuais: () => prefs };
}

/** Botão "🔊 Ouvir": lê o texto do painel de descrição com a voz do navegador. */
export function iniciarLeitura(botao, obterTexto) {
  if (!('speechSynthesis' in window)) {
    botao.hidden = true;
    return { parar() {} };
  }
  const parar = () => {
    speechSynthesis.cancel();
    botao.setAttribute('aria-pressed', 'false');
    botao.textContent = '🔊';
    botao.title = 'Ouvir: ler a descrição em voz alta';
    botao.setAttribute('aria-label', 'Ouvir a descrição em voz alta');
  };
  botao.onclick = () => {
    if (speechSynthesis.speaking) {
      parar();
      return;
    }
    const fala = new SpeechSynthesisUtterance(obterTexto());
    fala.lang = 'pt-BR';
    const voz = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'));
    if (voz) fala.voice = voz;
    fala.onend = parar;
    fala.onerror = parar;
    speechSynthesis.speak(fala);
    botao.setAttribute('aria-pressed', 'true');
    botao.textContent = '⏹';
    botao.title = 'Parar a leitura';
    botao.setAttribute('aria-label', 'Parar a leitura');
  };
  return { parar };
}
