// Badges digitais no estilo Credly: um hexágono por certificado.
// O mesmo SVG aparece na página do certificado e vira PNG (scripts/gerar-badges.mjs)
// para a prévia do post no LinkedIn, que não aceita SVG.
import { CERTIFICADOS, EMISSOR } from './certificados.js';

export const BADGES = {
  basico: { cor: '#bd93f9', simbolo: '{ }', faixa: 'TERRAFORM' },
  aws: { cor: '#ffb86c', simbolo: 'AWS', faixa: 'AWS' },
  azure: { cor: '#8be9fd', simbolo: 'AZ', faixa: 'AZURE' },
  projetos: { cor: '#ff79c6', simbolo: 'IaC', faixa: 'PROJETOS' },
  final: { cor: '#f1c40f', simbolo: '★', faixa: 'TRILHA COMPLETA' },
};

const SANS = "'Segoe UI', Arial, 'DejaVu Sans', sans-serif";
const MONO = "'Fira Code', Consolas, 'DejaVu Sans Mono', monospace";

const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function hexagono(cx, cy, r) {
  return [-90, -30, 30, 90, 150, 210]
    .map((g) => {
      const a = (g * Math.PI) / 180;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(' ');
}

/** Corpo do badge (600×600), sem a tag <svg>, para ser embutido em outros SVGs. */
function desenhoBadge(modulo, prefixo) {
  const { cor, simbolo, faixa } = BADGES[modulo];
  const final = modulo === 'final';
  const tamanhoSimbolo = simbolo.length > 2 ? 118 : 150;
  const tamanhoFaixa = faixa.length > 10 ? 30 : 40;
  return `
  <defs>
    <linearGradient id="${prefixo}fundo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#44475a"/>
      <stop offset="1" stop-color="#1e1f29"/>
    </linearGradient>
    <linearGradient id="${prefixo}borda" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${cor}"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="1" stop-color="${cor}"/>
    </linearGradient>
  </defs>
  <polygon points="${hexagono(300, 300, 288)}" fill="url(#${prefixo}borda)"/>
  <polygon points="${hexagono(300, 300, 268)}" fill="url(#${prefixo}fundo)"/>
  <polygon points="${hexagono(300, 300, 248)}" fill="none" stroke="${cor}" stroke-opacity="0.45" stroke-width="3"/>
  <text x="300" y="140" text-anchor="middle" font-family="${SANS}" font-size="21" font-weight="700" letter-spacing="3" fill="${cor}">${escXml(EMISSOR.organizacao.toUpperCase())}</text>
  ${final ? `<text x="300" y="174" text-anchor="middle" font-family="${SANS}" font-size="26" fill="${cor}" letter-spacing="10">★★★</text>` : ''}
  <text x="300" y="${final ? 330 : 318}" text-anchor="middle" font-family="${final ? SANS : MONO}" font-size="${tamanhoSimbolo}" font-weight="700" fill="#f8f8f2">${escXml(simbolo)}</text>
  <polygon points="40,370 90,370 90,450 40,450 62,410" fill="${cor}" opacity="0.7"/>
  <polygon points="560,370 510,370 510,450 560,450 538,410" fill="${cor}" opacity="0.7"/>
  <rect x="70" y="358" width="460" height="80" rx="6" fill="${cor}"/>
  <text x="300" y="${398 + tamanhoFaixa * 0.35}" text-anchor="middle" font-family="${SANS}" font-size="${tamanhoFaixa}" font-weight="800" letter-spacing="2" fill="#21222c">${escXml(faixa)}</text>
  <text x="300" y="490" text-anchor="middle" font-family="${SANS}" font-size="18" font-weight="600" letter-spacing="2" fill="#f8f8f2" opacity="0.8">DIVERGETERRAFORM</text>`;
}

// Ids únicos por desenho: o mesmo badge pode aparecer duas vezes na página e
// um gradiente dentro de uma tela oculta (display: none) não pinta o outro.
let contador = 0;

/** SVG do badge (quadrado). */
export function svgBadge(modulo, { tamanho = 600, titulo = CERTIFICADOS[modulo].titulo } = {}) {
  contador += 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="${tamanho}" height="${tamanho}" role="img" aria-label="Badge: ${escXml(titulo)}">${desenhoBadge(modulo, `b${contador}-`)}</svg>`;
}

/** Quebra o texto em linhas de até `largura` caracteres. */
function quebrar(texto, largura) {
  const linhas = [];
  let atual = '';
  for (const palavra of texto.split(' ')) {
    if (atual && (atual + ' ' + palavra).length > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = atual ? `${atual} ${palavra}` : palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Cartão 1200×627 (proporção pedida pelo LinkedIn) para a prévia do post. */
export function svgCartao(modulo) {
  const { cor } = BADGES[modulo];
  const def = CERTIFICADOS[modulo];
  const final = modulo === 'final';
  const linhas = quebrar(def.titulo, 18);
  const y0 = 300 - (linhas.length - 1) * 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 627" width="1200" height="627">
  <defs>
    <radialGradient id="c-luz" cx="0.25" cy="0.5" r="0.6">
      <stop offset="0" stop-color="${cor}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${cor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="627" fill="#21222c"/>
  <rect width="1200" height="627" fill="url(#c-luz)"/>
  <rect x="0" y="0" width="1200" height="10" fill="${cor}"/>
  <svg x="60" y="53" width="520" height="520" viewBox="0 0 600 600">${desenhoBadge(modulo, `c-${modulo}-`)}</svg>
  <text x="630" y="${y0 - 80}" font-family="${SANS}" font-size="26" font-weight="700" letter-spacing="5" fill="${cor}">${final ? 'CERTIFICADO DE CONCLUSÃO' : 'BADGE CONQUISTADO'}</text>
  ${linhas.map((l, i) => `<text x="630" y="${y0 + i * 60}" font-family="${SANS}" font-size="52" font-weight="800" fill="#f8f8f2">${escXml(l)}</text>`).join('\n  ')}
  <text x="630" y="${y0 + linhas.length * 60 + 20}" font-family="${SANS}" font-size="28" fill="#c9c6dc">Emitido por <tspan font-weight="700" fill="#f8f8f2">${escXml(EMISSOR.organizacao)}</tspan></text>
  <text x="630" y="${y0 + linhas.length * 60 + 62}" font-family="${SANS}" font-size="24" fill="#9e9bb8">${escXml(EMISSOR.curso.split(":")[0])} · Terraform, AWS e Azure</text>
</svg>`;
}

/** Ícone do site (favicon, PWA): "tf" em roxo num quadrado arredondado Dracula. */
export function svgIcone() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#282a36"/>
  <rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="#bd93f9" stroke-width="20"/>
  <text x="256" y="300" text-anchor="middle" font-family="${MONO}" font-size="210" font-weight="700" fill="#bd93f9">tf</text>
  <text x="256" y="405" text-anchor="middle" font-family="${MONO}" font-size="78" font-weight="700" fill="#50fa7b">{ }</text>
</svg>`;
}

/** Capa 1200×630 para compartilhar o site (og:image da página principal). */
export function svgCapa({ exercicios, projetos }) {
  const badge = (id, x, y, tamanho) =>
    `<svg x="${x}" y="${y}" width="${tamanho}" height="${tamanho}" viewBox="0 0 600 600">${desenhoBadge(id, `capa-${id}-`)}</svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="capa-luz" cx="0.78" cy="0.5" r="0.6">
      <stop offset="0" stop-color="#bd93f9" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#bd93f9" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#21222c"/>
  <rect width="1200" height="630" fill="url(#capa-luz)"/>
  <rect width="1200" height="10" fill="#bd93f9"/>
  <text x="70" y="120" font-family="${SANS}" font-size="26" font-weight="700" letter-spacing="5" fill="#8be9fd">${escXml(EMISSOR.organizacao.toUpperCase())}</text>
  <text x="70" y="215" font-family="${SANS}" font-size="58" font-weight="800" fill="#f8f8f2">Diverge<tspan fill="#bd93f9">Terraform</tspan></text>
  <text x="70" y="285" font-family="${SANS}" font-size="36" fill="#f8f8f2">Aprenda Terraform, AWS e Azure com</text>
  <text x="70" y="333" font-family="${SANS}" font-size="36" fill="#f8f8f2">acessibilidade para todas as pessoas.</text>
  <text x="70" y="420" font-family="${SANS}" font-size="28" fill="#50fa7b" font-weight="700">${exercicios} exercícios · ${projetos} projetos · certificados</text>
  <text x="70" y="468" font-family="${SANS}" font-size="26" fill="#9e9bb8">Leitor de tela, Libras, teclado e perfis para TDAH.</text>
  <rect x="70" y="510" width="330" height="62" rx="12" fill="#50fa7b"/>
  <text x="235" y="551" text-anchor="middle" font-family="${SANS}" font-size="28" font-weight="800" fill="#21222c">Começar a trilha</text>
  ${badge('basico', 760, 70, 230)}
  ${badge('aws', 930, 200, 230)}
  ${badge('final', 760, 330, 230)}
</svg>`;
}
