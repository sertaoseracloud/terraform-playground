import { detalhesCidr } from '../rede-arquitetura.js';

const CAMPOS = {
  cidr_block: 'Rede (CIDR)', ipv6_cidr_block: 'Rede IPv6 (CIDR)',
  address_space: 'Rede (CIDR)', address_prefix: 'Rede (CIDR)', address_prefixes: 'Rede (CIDR)',
  cidr_blocks: 'Rede (CIDR)', ipv6_cidr_blocks: 'Rede IPv6 (CIDR)',
  private_ip: 'IP privado', private_ip_address: 'IP privado',
  port: 'Porta', from_port: 'Porta inicial', to_port: 'Porta final',
  protocol: 'Protocolo', ip_protocol: 'Protocolo',
  source_port_range: 'Porta de origem', source_port_ranges: 'Portas de origem',
  destination_port_range: 'Porta de destino', destination_port_ranges: 'Portas de destino',
  source_address_prefix: 'Rede de origem', source_address_prefixes: 'Redes de origem',
  destination_address_prefix: 'Rede de destino', destination_address_prefixes: 'Redes de destino',
  direction: 'Direção', access: 'Ação',
};

function literais(expr) {
  if (expr.k === 'lit' && ['string', 'number'].includes(typeof expr.valor)) return [String(expr.valor)];
  if (expr.k === 'tpl' && expr.partes.every((p) => typeof p === 'string')) return [expr.partes.join('')];
  if (expr.k === 'tupla') return expr.itens.flatMap(literais);
  if (expr.k === 'paren') return literais(expr.x);
  return ['expressão não resolvida'];
}

export function detalhesRedeDoBloco(bloco) {
  const ler = (corpo, contexto = '') => {
    const detalhes = corpo.atributos.flatMap((at) => {
      if (!Object.hasOwn(CAMPOS, at.nome)) return [];
      return literais(at.expr).flatMap((valor) => {
        const campos = CAMPOS[at.nome].includes('CIDR') && valor !== 'expressão não resolvida'
          ? detalhesCidr(valor) : [{ rotulo: CAMPOS[at.nome], valor }];
        return campos.map((d) => ({ ...d, rotulo: contexto + d.rotulo }));
      });
    });
    for (const b of corpo.blocos) {
      const nome = { ingress: 'Entrada', egress: 'Saída', security_rule: 'Regra' }[b.tipo];
      if (nome) detalhes.push(...ler(b.corpo, `${nome} · `));
    }
    return detalhes;
  };
  return ler(bloco.corpo);
}
