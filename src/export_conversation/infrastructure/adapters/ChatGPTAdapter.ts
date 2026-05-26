import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ChatGPTAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';
  // Selector exacto del código de referencia (M9._selector)
  private readonly MESSAGE_SELECTOR = 'main article > div.text-base > div';

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const { role, id } = this.findIdAndRoleByParent(el as HTMLElement);
      
      // El contenido es el elemento en sí (o un clon para limpiar)
      const clone = el.cloneNode(true) as HTMLElement;
      
      // Limpiar elementos inyectados y botones (como en M9.getChatHtmls / transMarkdownHTML)
      clone.querySelectorAll('button, svg, .sr-only, .' + this.CHECKBOX_CLASS).forEach(node => node.remove());
      
      // ChatGPT a veces pone botones de "Copy" o selectores de modelo dentro
      // Limpiamos selectores de pre (como en M9.transMarkdownHTML)
      clone.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (code) {
          pre.innerHTML = '';
          pre.appendChild(code);
        }
      });

      messages.push({
        id: id || `chatgpt-msg-${index}`,
        role: (role as Role) || 'user',
        content: clone.innerHTML
      });
    });

    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    if (elements.length === 0) return;

    elements.forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      // Replicando M9.injectCheckbox: n.style.position="relative"
      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      
      const { id } = this.findIdAndRoleByParent(container);
      checkbox.dataset.id = id || `chatgpt-msg-${index}`;
      
      // Estilos exactos de Or.inject_checkbox + M9.injectCheckbox
      Object.assign(checkbox.style, {
        position: 'absolute',
        right: '-30px',
        top: '10px',
        zIndex: '1000',
        width: '24px',
        height: '24px',
        cursor: 'pointer'
      });

      checkbox.addEventListener('change', () => {
        onSelectionChange(this.getSelectedMessageIds());
      });

      container.appendChild(checkbox);
    });

    // Ocultar el contenedor inferior (M9.injectCheckbox)
    const threadBottom = document.querySelector('#thread-bottom-container');
    if (threadBottom) {
      (threadBottom as HTMLElement).style.display = 'none';
    }
  }

  getSelectedMessageIds(): string[] {
    const checkboxes = document.querySelectorAll(`input.${this.CHECKBOX_CLASS}:checked`);
    return Array.from(checkboxes).map(cb => (cb as HTMLInputElement).dataset.id || '');
  }

  getConversationTitle(): string {
    const activeTitle = document.querySelector('[data-active="true"]') || 
                        document.querySelector('nav li a.bg-token-sidebar-surface-tertiary');
    return activeTitle?.textContent?.trim() || document.title || 'ChatGPT Conversation';
  }

  // Replicando logic de M9.findIdByParent y detectChatType
  private findIdAndRoleByParent(e: HTMLElement): { role: string, id: string } {
    let role = 'user';
    let id = '';
    let curr: HTMLElement | null = e;

    // Buscar data-turn y data-turn-id (como en findIdByParent)
    for (let i = 0; i < 10 && curr; i++) {
      const turn = curr.getAttribute('data-turn');
      if (turn && !id) {
        role = turn === 'user' ? 'user' : 'assistant';
      }
      const turnId = curr.getAttribute('data-turn-id');
      if (turnId && !id) {
        id = turnId;
      }
      if (role && id) break;
      curr = curr.parentElement;
    }

    // Fallback para el rol usando detectChatType logic
    if (role === 'user') {
      curr = e;
      for (let i = 0; i < 5 && curr; i++) {
        if (curr.tagName === 'ARTICLE') {
          const srOnly = curr.querySelectorAll('.sr-only');
          for (let j = 0; j < srOnly.length; j++) {
            if ((srOnly[j].textContent?.toLowerCase() || '').includes('chatgpt')) {
              role = 'assistant';
              break;
            }
          }
          break;
        }
        curr = curr.parentElement;
      }
    }

    return { role, id };
  }
}
