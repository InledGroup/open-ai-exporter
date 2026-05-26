import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ChatGPTAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';
  // Selector primario basado en el HTML real analizado
  private readonly MESSAGE_SELECTOR = '[data-message-id]';

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];
    const seenIds = new Set<string>();

    elements.forEach((el, index) => {
      const container = el as HTMLElement;
      const { role, id } = this.findIdAndRole(container);
      
      const msgId = id || `chatgpt-msg-${index}`;
      if (seenIds.has(msgId)) return;
      seenIds.add(msgId);

      // Encontrar el contenido real:
      // - .markdown .prose para el asistente
      // - El div que contiene el texto para el usuario (usualmente hijo de flex-col)
      const contentEl = container.querySelector('.markdown, .prose') || 
                        container.querySelector('.text-message') ||
                        container.querySelector('.flex-col.gap-1.break-words') ||
                        container;

      const clone = contentEl.cloneNode(true) as HTMLElement;
      
      // Limpieza exhaustiva de la UI de ChatGPT
      clone.querySelectorAll('button, svg, .sr-only, .' + this.CHECKBOX_CLASS + ', [data-testid*="copy-button"], [data-testid*="voice-"], .text-token-text-tertiary').forEach(node => node.remove());
      
      // Limpiar bloques de código
      clone.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (code) {
          pre.innerHTML = '';
          pre.appendChild(code);
        }
      });

      messages.push({
        id: msgId,
        role: (role as Role) || 'user',
        content: clone.innerHTML.trim()
      });
    });

    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    
    elements.forEach((el, index) => {
      const container = el as HTMLElement;
      if (container.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      
      const { id } = this.findIdAndRole(container);
      checkbox.dataset.id = id || `chatgpt-msg-${index}`;
      
      Object.assign(checkbox.style, {
        position: 'absolute',
        left: '10px',
        top: '10px',
        zIndex: '9999',
        width: '22px',
        height: '22px',
        cursor: 'pointer',
        border: '2px solid #2563eb',
        borderRadius: '4px'
      });

      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        onSelectionChange(this.getSelectedMessageIds());
      });

      container.prepend(checkbox);
    });
  }

  removeCheckboxes(): void {
    document.querySelectorAll(`.${this.CHECKBOX_CLASS}`).forEach(el => el.remove());
  }

  selectAll(select: boolean): void {
    const checkboxes = document.querySelectorAll(`input.${this.CHECKBOX_CLASS}`);
    checkboxes.forEach(cb => {
      (cb as HTMLInputElement).checked = select;
    });
  }

  getSelectedMessageIds(): string[] {
    const checkboxes = document.querySelectorAll(`input.${this.CHECKBOX_CLASS}:checked`);
    return Array.from(checkboxes).map(cb => (cb as HTMLInputElement).dataset.id || '');
  }

  getConversationTitle(): string {
    const titleEl = document.querySelector('[data-active="true"]') || 
                    document.querySelector('nav li a.bg-token-sidebar-surface-tertiary') ||
                    document.querySelector('h1') ||
                    document.querySelector('title');
    return titleEl?.textContent?.trim() || 'ChatGPT Conversation';
  }

  private findIdAndRole(e: HTMLElement): { role: string, id: string } {
    // Buscar atributos directos
    let role = e.getAttribute('data-message-author-role') || '';
    let id = e.getAttribute('data-message-id') || '';

    // Si no están, buscar en el primer descendiente que los tenga
    if (!role || !id) {
      const target = e.querySelector('[data-message-author-role], [data-message-id]');
      if (target) {
        role = role || target.getAttribute('data-message-author-role') || '';
        id = id || target.getAttribute('data-message-id') || '';
      }
    }

    // Fallback de rol basado en clases de Tailwind/ChatGPT
    if (!role) {
      if (e.querySelector('.assistant') || e.querySelector('.markdown') || e.querySelector('.prose')) {
        role = 'assistant';
      } else {
        role = 'user';
      }
    }

    return { role, id };
  }
}
