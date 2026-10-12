// Tema do CodeMirror baseado no Dracula (https://draculatheme.com).
// As cores vêm das variáveis CSS do tema ativo (Dracula, Alto contraste ou Claro),
// então o editor acompanha a escolha feita no painel de acessibilidade.
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const v = (nome) => `var(--${nome})`;

const aparencia = EditorView.theme({
  '&': { color: v('texto'), backgroundColor: v('fundo'), height: '100%' },
  '.cm-scroller': {
    fontFamily: v('fonte-codigo'),
    fontVariantLigatures: 'contextual',
    lineHeight: v('altura-linha-codigo'),
  },
  '.cm-content': { caretColor: v('texto') },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: v('texto'), borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: `${v('selecao')} !important`,
  },
  '.cm-activeLine': { backgroundColor: v('linha-atual') },
  '.cm-gutters': { backgroundColor: v('fundo'), color: v('suave'), border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: v('linha-atual'), color: v('texto') },
  '.cm-foldPlaceholder': { backgroundColor: 'transparent', border: 'none', color: v('suave') },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: v('selecao'), outline: `1px solid ${v('suave')}` },
  '.cm-searchMatch': { outline: `1px solid ${v('laranja')}` },
  '.cm-tooltip': { backgroundColor: v('fundo-escuro'), border: `1px solid ${v('linha')}`, color: v('texto') },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: v('linha'), color: v('texto') },
  '.cm-panels': { backgroundColor: v('fundo-escuro'), color: v('texto') },
});

const cores = HighlightStyle.define([
  { tag: t.comment, color: v('suave'), fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.modifier, t.definitionKeyword], color: v('rosa') },
  { tag: [t.operator, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: v('rosa') },
  { tag: [t.string, t.special(t.string), t.attributeValue], color: v('amarelo') },
  { tag: [t.number, t.bool, t.null, t.atom], color: v('roxo') },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: v('verde') },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: v('verde') },
  { tag: [t.variableName, t.special(t.variableName)], color: v('texto') },
  { tag: [t.typeName, t.className, t.namespace], color: v('ciano'), fontStyle: 'italic' },
  { tag: [t.tagName, t.angleBracket], color: v('rosa') },
  { tag: t.attributeName, color: v('verde'), fontStyle: 'italic' },
  { tag: t.propertyName, color: v('ciano') },
  { tag: [t.processingInstruction, t.meta, t.documentMeta], color: v('rosa'), fontWeight: 'bold' },
  { tag: t.escape, color: v('rosa') },
  { tag: t.invalid, color: v('vermelho') },
  { tag: t.heading, color: v('roxo'), fontWeight: 'bold' },
  { tag: t.link, color: v('ciano'), textDecoration: 'underline' },
]);

export const temaEditor = [aparencia, syntaxHighlighting(cores)];
