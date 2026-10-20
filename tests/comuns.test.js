// Arquivos comuns aos quatro playgrounds: a lista confere com os arquivos deste repositório.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { divergentes, hashDe } from '../scripts/comuns.mjs';

const lista = JSON.parse(readFileSync(resolve(process.cwd(), 'comuns.json'), 'utf8'));

describe('arquivos comuns', () => {
  it('lista os quatro repositórios', () => {
    expect(lista.repositorios).toHaveLength(4);
    expect(lista.repositorios.every((r) => r.startsWith('sertaoseracloud/'))).toBe(true);
  });

  it('todos os arquivos da lista estão iguais ao hash registrado', () => {
    expect(divergentes()).toEqual([]);
  });

  it('o hash ignora a diferença entre finais de linha CRLF e LF', () => {
    expect(hashDe('a\r\nb\n')).toBe(hashDe('a\nb\n'));
    expect(hashDe('a\nb\n')).not.toBe(hashDe('a\nc\n'));
  });
});
