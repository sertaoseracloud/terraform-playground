// Editor de código com abas de arquivos (main.tf, variables.tf, modulos/rede/main.tf...).
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { linguagemHcl } from './linguagem-hcl.js';
import { temaEditor } from './tema-editor.js';

// Pastas são permitidas (modulos/rede/main.tf), sem subir de nível (..).
const NOME_VALIDO = /^([\w-]+\/){0,3}[\w.-]+\.(tf|tfvars|tpl|json|txt|sh|py|js|html|yaml|yml|md)$/;

export class EditorArquivos {
  constructor({ abas, editor, aoMudar = () => {}, aoExecutar = () => {}, aoEnviar = () => {} }) {
    this.elAbas = abas;
    this.aoMudar = aoMudar;
    this.arquivos = {};
    this.atual = null;
    this.estados = new Map();
    this.extensoes = [
      basicSetup,
      linguagemHcl(),
      temaEditor,
      EditorView.lineWrapping,
      EditorState.tabSize.of(2),
      Prec.highest(keymap.of([
        { key: 'Mod-Enter', run: () => { aoExecutar(); return true; } },
        { key: 'Mod-Shift-Enter', run: () => { aoEnviar(); return true; } },
      ])),
      EditorView.contentAttributes.of({ 'aria-label': 'Editor de código Terraform', tabindex: '0', 'aria-describedby': 'ajuda-editor' }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          this.arquivos[this.atual] = u.state.doc.toString();
          this.aoMudar(this.arquivos);
        }
      }),
    ];
    this.view = new EditorView({ parent: editor });
  }

  /** Primeiro arquivo (em geral, main.tf). */
  get principal() {
    return Object.keys(this.arquivos)[0];
  }

  carregar(arquivos) {
    this.arquivos = { ...arquivos };
    this.estados.clear();
    this.atual = this.principal;
    this.view.setState(this.#estadoDe(this.atual));
    this.#renderAbas();
  }

  abrir(nome) {
    this.estados.set(this.atual, this.view.state);
    this.atual = nome;
    this.view.setState(this.estados.get(nome) ?? this.#estadoDe(nome));
    this.#renderAbas();
    this.view.focus();
  }

  #estadoDe(nome) {
    return EditorState.create({ doc: this.arquivos[nome] ?? '', extensions: this.extensoes });
  }

  #renderAbas() {
    this.elAbas.replaceChildren();
    for (const nome of Object.keys(this.arquivos)) {
      const grupo = document.createElement('span');
      grupo.className = 'aba-arquivo';
      const aba = document.createElement('button');
      aba.type = 'button';
      aba.className = 'aba' + (nome === this.atual ? ' ativa' : '');
      aba.textContent = nome;
      aba.title = nome;
      if (nome === this.atual) aba.setAttribute('aria-current', 'true');
      aba.onclick = () => this.abrir(nome);
      grupo.append(aba);
      if (nome !== this.principal) {
        const excluir = document.createElement('button');
        excluir.type = 'button';
        excluir.className = 'btn-excluir-arquivo';
        excluir.textContent = '×';
        excluir.title = `Excluir ${nome}`;
        excluir.setAttribute('aria-label', `Excluir ${nome}`);
        excluir.onclick = () => this.#excluir(nome);
        grupo.append(excluir);
      }
      this.elAbas.append(grupo);
    }
    const novo = document.createElement('button');
    novo.type = 'button';
    novo.className = 'aba';
    novo.textContent = '+';
    novo.title = 'Novo arquivo';
    novo.setAttribute('aria-label', 'Novo arquivo');
    novo.onclick = () => this.#novo();
    this.elAbas.append(novo);
  }

  #excluir(nome) {
    if (!confirm(`Excluir o arquivo ${nome}?`)) return;
    delete this.arquivos[nome];
    this.estados.delete(nome);
    this.aoMudar(this.arquivos);
    if (this.atual === nome) {
      this.atual = this.principal;
      this.view.setState(this.estados.get(this.atual) ?? this.#estadoDe(this.atual));
    }
    this.#renderAbas();
  }

  #novo() {
    const nome = prompt('Nome do novo arquivo (ex.: variables.tf, outputs.tf, terraform.tfvars ou modulos/rede/main.tf):', 'variables.tf')?.trim();
    if (!nome) return;
    if (!NOME_VALIDO.test(nome)) {
      alert('Use letras, números, - e _ (pastas com /), com extensão .tf, .tfvars, .tpl, .json, .sh, .py, .txt...');
      return;
    }
    if (nome in this.arquivos) {
      alert('Já existe um arquivo com esse nome.');
      return;
    }
    this.arquivos[nome] = nome.endsWith('.tf') ? `# ${nome}\n` : '';
    this.aoMudar(this.arquivos);
    this.abrir(nome);
  }
}
