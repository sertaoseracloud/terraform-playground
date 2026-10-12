// Apoio ao projeto via PIX (conta PicPay do instrutor).
//
// O código "copia e cola" segue o BR Code do Banco Central: campos EMV no formato
// ID (2 dígitos) + tamanho (2 dígitos) + valor, com o CRC16 no fim. O mesmo texto vira
// o QR Code. Tudo é montado aqui no navegador: o site não recebe nem guarda nada do
// pagamento, que acontece no app do banco de quem apoia.
import qrcode from 'qrcode-generator';

/** Dados do recebedor. Sem `chave`, a página mostra o apoio como "em breve". */
export const PIX = {
  /** Chave aleatória do PicPay (formato UUID). */
  chave: '6350a760-6497-413d-b3c6-fc9cfebdc109',
  /** Nome do recebedor: até 25 caracteres, sem acentos (regra do BR Code). */
  nome: 'Claudio F L Raposo',
  /** Cidade do recebedor: até 15 caracteres, sem acentos. */
  cidade: 'Santa Catarina',
  /** Mensagem que aparece para quem paga (opcional). */
  descricao: 'Apoio Sertao sera cloud',
  instituicao: 'PicPay',
};

export const apoioDisponivel = () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(PIX.chave);

/** Texto só com letras sem acento, números, espaço e alguns sinais, cortado no tamanho máximo. */
export function semAcentos(texto, maximo) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 .,-]/g, '').trim().slice(0, maximo);
}

const campo = (id, valor) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), em 4 dígitos hexadecimais maiúsculos. */
export function crc16(texto) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Código PIX "copia e cola" (BR Code estático). `valor` é opcional: sem ele, quem
 * apoia escolhe o valor no app do banco.
 */
export function codigoPix({ chave, nome, cidade, descricao = '', valor, identificador = '***' } = PIX) {
  const descricaoLimpa = semAcentos(descricao, 40);
  const contaPix = campo('00', 'br.gov.bcb.pix') + campo('01', chave) + (descricaoLimpa ? campo('02', descricaoLimpa) : '');
  const corpo = [
    campo('00', '01'), // versão do payload
    campo('26', contaPix), // conta PIX: GUI do Banco Central + chave
    campo('52', '0000'), // categoria do recebedor (não informada)
    campo('53', '986'), // moeda: real
    valor ? campo('54', Number(valor).toFixed(2)) : '',
    campo('58', 'BR'),
    campo('59', semAcentos(nome, 25)),
    campo('60', semAcentos(cidade, 15)),
    campo('62', campo('05', identificador)),
    '6304', // CRC: calculado sobre tudo, inclusive "6304"
  ].join('');
  return corpo + crc16(corpo);
}

/** QR Code em SVG (preto no branco, com a margem que os leitores precisam). */
export function svgQrCode(texto, { tamanho = 220, rotulo = 'QR Code PIX' } = {}) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const margem = 4;
  let caminho = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (qr.isDark(y, x)) caminho += `M${x + margem},${y + margem}h1v1h-1z`;
  }
  const lado = n + margem * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${tamanho}" height="${tamanho}" role="img" aria-label="${rotulo}" shape-rendering="crispEdges"><rect width="${lado}" height="${lado}" fill="#fff"/><path d="${caminho}" fill="#000"/></svg>`;
}
