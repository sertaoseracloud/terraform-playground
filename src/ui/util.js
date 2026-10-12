export const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const $ = (id) => document.getElementById(id);
