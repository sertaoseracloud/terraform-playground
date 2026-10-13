export const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const $ = (id) => document.getElementById(id);

/** "2026-10-12" → "12 de outubro de 2026". */
export const dataPorExtenso = (data) => new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
