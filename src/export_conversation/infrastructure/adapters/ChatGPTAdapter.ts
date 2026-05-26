import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ChatGPTAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';
  // Selector que cubre tanto la estructura antigua (article) como la nueva (section[data-turn-id])
  private readonly MESSAGE_SELECTOR = 'section[data-turn-id], article, [data-testid^="conversation-turn-"]';

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const container = el as HTMLElement;
      const { role, id } = this.findIdAndRole(container);
      
      // Intentar encontrar el contenido real del mensaje
      // 1. Clase markdown prose (típica del asistente)
      // 2. Clase text-message (típica del usuario o asistente en nuevas versiones)
      // 3. Fallback al propio contenedor si no hay nada más específico
      const contentEl = container.querySelector('.markdown, .prose, .text-message') || 
                        container.querySelector('[data-message-id] > div') ||
                        container;

      const clone = contentEl.cloneNode(true) as HTMLElement;
      
      // Limpiar ruidos: botones, SVGs, textos ocultos y nuestros propios checkboxes
      clone.querySelectorAll('button, svg, .sr-only, .' + this.CHECKBOX_CLASS + ', [data-testid*="copy-button"]').forEach(node => node.remove());
      
      // Limpiar bloques de código para que solo quede el <code> (mejor para MD/PDF)
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
        content: clone.innerHTML.trim()
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
      
      // Aseguramos posición relativa para que el checkbox absoluto se ubique bien
      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      
      const { id } = this.findIdAndRole(container);
      checkbox.dataset.id = id || `chatgpt-msg-${index}`;
      
      // Estilo del checkbox (basado en sourcecode/Or.inject_checkbox)
      Object.assign(checkbox.style, {
        position: 'absolute',
        left: '-10px',
        top: '15px',
        zIndex: '1000',
        width: '22px',
        height: '22px',
        cursor: 'pointer'
      });

      checkbox.addEventListener('change', () => {
        onSelectionChange(this.getSelectedMessageIds());
      });

      // Insertar al principio para que sea visible
      container.prepend(checkbox);
    });

    // Ocultar la barra de herramientas inferior si estorba (como en M9 de sourcecode)
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
    // Buscamos el título en el elemento activo de la barra lateral o en el h1
    const activeTitle = document.querySelector('[data-active="true"]') || 
                        document.querySelector('nav li a.bg-token-sidebar-surface-tertiary') ||
                        document.querySelector('h1');
    return activeTitle?.textContent?.trim() || document.title || 'ChatGPT Conversation';
  }

  private findIdAndRole(e: HTMLElement): { role: string, id: string } {
    let role = 'user';
    let id = '';

    // 1. Buscar en el propio elemento (Estructura moderna encontrada en chatgpt.html)
    const roleAttr = e.getAttribute('data-message-author-role') || 
                     e.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role');
    
    if (roleAttr) {
      role = roleAttr === 'user' ? 'user' : 'assistant';
    } else {
      // Fallbacks basados en contenido
      if (e.querySelector('[data-testid*="user-message"]') || e.innerHTML.includes('user-avatar')) {
        role = 'user';
      } else if (e.querySelector('.assistant, .prose, .markdown')) {
        role = 'assistant';
      }
    }

    // 2. Buscar ID del mensaje
    id = e.getAttribute('data-message-id') || 
         e.querySelector('[data-message-id]')?.getAttribute('data-message-id') || 
         e.getAttribute('data-turn-id') || '';

    return { role, id };
  }
}
