import { describe, it, expect } from 'vitest';
import { detalhesCidr } from '../src/rede-arquitetura.js';

describe('máscara de redes declaradas', () => {
  it.each([
    ['10.0.0.0/16', '255.255.0.0'], ['10.0.1.0/24', '255.255.255.0'],
    ['0.0.0.0/0', '0.0.0.0'], ['192.0.2.1/32', '255.255.255.255'],
    ['10.0.0.0/13', '255.248.0.0'],
  ])('converte %s sem consultar estado ou nuvem', (cidr, mascara) => {
    expect(detalhesCidr(cidr)).toEqual([
      { rotulo: 'Rede (CIDR)', valor: cidr }, { rotulo: 'Máscara', valor: mascara },
    ]);
  });

  it.each(['2001:db8::/64', '999.0.0.0/24', '10.0.0.0/33', '*', '10.0.0.0/-1'])(
    'não inventa máscara IPv4 para %s', (cidr) => {
      expect(detalhesCidr(cidr)).toEqual([{ rotulo: 'Rede (CIDR)', valor: cidr }]);
    }
  );
});
