// Assinatura digital Ed25519 dos certificados (@noble/ed25519, síncrona).
//
// Quem verifica precisa só da CHAVE PÚBLICA, publicada em chave-publica-ed25519.txt
// e dentro do XML. A semente da chave privada vem do build (vite.config.js), derivada
// da mesma palavra secreta do selo. Como o site não tem servidor, ela vai no JavaScript:
// a assinatura torna a verificação pública e independente do site, mas não impede quem
// extrair a semente de assinar certificados falsos. Para isso, só assinando num servidor.
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

ed.hashes.sha512 = sha512;

const texto = (s) => new TextEncoder().encode(s);
// A versão 3 só aceita bytes; as chaves e assinaturas continuam guardadas em hexadecimal.
const bytes = (hex) => ed.etc.hexToBytes(hex);

// Injetadas no build e nos testes. Fora do Vite (scripts) não existem.
const SEMENTE = typeof __SEMENTE_ED25519__ === 'undefined' ? null : __SEMENTE_ED25519__;
export const CHAVE_PUBLICA = typeof __CHAVE_PUBLICA_ED25519__ === 'undefined' ? null : __CHAVE_PUBLICA_ED25519__;

/** Assina a mensagem (texto UTF-8). Devolve a assinatura em hexadecimal (128 caracteres). */
export function assinar(mensagem) {
  if (!SEMENTE) throw new Error('Semente Ed25519 indisponível fora do build do site.');
  return ed.etc.bytesToHex(ed.sign(texto(mensagem), bytes(SEMENTE)));
}

/** Confere a assinatura com uma chave pública (hex). Nunca lança erro: devolve true/false. */
export function verificar(mensagem, assinaturaHex, chavePublicaHex = CHAVE_PUBLICA) {
  try {
    if (!/^[0-9a-f]{128}$/i.test(assinaturaHex ?? '') || !/^[0-9a-f]{64}$/i.test(chavePublicaHex ?? '')) return false;
    return ed.verify(bytes(assinaturaHex.toLowerCase()), texto(mensagem), bytes(chavePublicaHex.toLowerCase()));
  } catch {
    return false;
  }
}

/** Chave pública a partir da semente (usado no build para publicar a chave). */
export const chavePublicaDe = (sementeHex) => ed.etc.bytesToHex(ed.getPublicKey(bytes(sementeHex)));
