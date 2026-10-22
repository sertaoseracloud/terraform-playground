import { sprite } from './pixel.js';

// Sprites de cenário extraídos do pacote Tiny Town (Kenney), licenciado em CC0 1.0.
const tinyTown0016 = sprite({ a: '#3f2631', b: '#84c669', c: '#479f4a', d: '#bd6c4a', e: '#eaa56c' }, `
.aaabcccbbbbaaa.
.aacbcbcbbbbcaa.
.aacbcccbbbbcaa.
.aacbbbbbbbbcaa.
aaacbbbbbbbbcaa.
aabccbbbbbbccaa.
aaaccccccccccaa.
.aaccccccccccaa.
.aaccccccccccaa.
.aaaccccccccaaa.
..aaaaccccaaaa..
...aaaaddaaaa...
.....aaeeaa.....
.....aaeeaa.....
.....aaeeaa.....
................
`);

const tinyTown0017 = sprite({ a: '#3f2631', b: '#84c669', c: '#479f4a' }, `
................
................
..aaaaa.........
.aaaaaaa........
aaabbbaaa.......
aabbbbcaaaaaaa..
aabccccaaaaaaaa.
aaccaccaaabbbaaa
aaaaaccaacbbbbaa
.aaaaccaaccccbaa
...aaccaaccaccaa
...aaccaaccaaaaa
...aaccaaccaaaa.
...aaccaa.......
................
................
`);

export const TILES_TINY_TOWN = [tinyTown0016, tinyTown0017];

export const comArvoresTinyTown = (cenario) => ({ ...cenario, objetos: [...TILES_TINY_TOWN, ...cenario.objetos] });
