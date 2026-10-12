import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { sha256, hmacSha256 } from '../src/sha256.js';

describe('SHA-256', () => {
  it('vetores oficiais (FIPS 180-4)', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('bate com o node:crypto em textos com acento e de vários tamanhos', () => {
    for (const texto of ['Sertão será cloud', 'ç'.repeat(55), 'a'.repeat(64), 'x'.repeat(1000)]) {
      expect(sha256(texto)).toBe(createHash('sha256').update(texto, 'utf8').digest('hex'));
    }
  });
});

describe('HMAC-SHA256', () => {
  it('vetor da RFC 4231 (caso 2)', () => {
    expect(hmacSha256('Jefe', 'what do ya want for nothing?'))
      .toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('bate com o node:crypto, inclusive com chave maior que o bloco', () => {
    for (const chave of ['k', 'ç'.repeat(40), 'z'.repeat(100)]) {
      expect(hmacSha256(chave, 'Maria|2026-10-11'))
        .toBe(createHmac('sha256', Buffer.from(chave, 'utf8')).update('Maria|2026-10-11', 'utf8').digest('hex'));
    }
  });
});
