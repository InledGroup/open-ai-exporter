import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ChatGPTAdapter implements IAAdapter {
  // Selector estable: cada turno de conversación es un 'article'
  private readonly MESSAGE_SELECTOR = 'article';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  getMessages(): Message[] {
    const articles = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    articles.forEach((el, index) => {
      // El contenido real está en .markdown o en el div de texto base
      const contentEl = el.querySelector('.markdown') || el.querySelector('.text-base') || el;
      
      // Detección de rol robusta
      const roleEl = el.querySelector('[data-message-author-role]');
      const roleAttr = roleEl?.getAttribute('data-message-author-role');
      
      let role: Role = 'user';
      if (roleAttr === 'assistant') {
        role = 'assistant';
      } else if (el.querySelector('.sr-only')?.textContent?.toLowerCase().includes('chatgpt') || 
                 el.querySelector('svg.icon-sm') || 
                 el.querySelector('.agent-turn')) {
        role = 'assistant';
      }

      // Clonamos para limpiar la UI sin romper la página
      const clone = contentEl.cloneNode(true) as HTMLElement;
      // Eliminamos botones de la UI (Copiar, Escuchar, etc.) y nuestro propio checkbox si se coló
      clone.querySelectorAll('button, .flex.justify-between, .sr-only, .ai-exporter-checkbox').forEach(node => node.remove());

      messages.push({
        id: `chatgpt-msg-${index}`,
        role,
        content: clone.innerHTML
      });
    });

    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    const articles = document.querySelectorAll(this.MESSAGE_SELECTOR);
    articles.forEach((el, index) => {
      // Evitamos inyectar si ya existe o si es un article vacío/layout
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      
      // Intentamos inyectar en un lugar que no rompa el flexbox original
      // Buscamos el div que envuelve el avatar o el contenido
      const target = el.querySelector('.flex.flex-1') || el;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = `chatgpt-msg-${index}`;
      
      // Estilos mínimos y aislados para no romper el CSS de ChatGPT
      checkbox.style.cssText = `
        margin-right: 10px;
        width: 18px;
        height: 18px;
        cursor: pointer;
        z-index: 10;
        flex-shrink: 0;
      `;

      checkbox.addEventListener('change', () => {
        onSelectionChange(this.getSelectedMessageIds());
      });

      // Insertamos al principio del contenedor interno
      if (target !== el) {
        target.prepend(checkbox);
      } else {
        // Fallback si no encontramos el flex-1
        container.style.display = 'flex';
        container.prepend(checkbox);
      }
    });
  }

  getSelectedMessageIds(): string[] {
    const checkboxes = document.querySelectorAll(`.${this.CHECKBOX_CLASS}:checked`);
    return Array.from(checkboxes).map(cb => (cb as HTMLInputElement).dataset.id || '');
  }

  getConversationTitle(): string {
    const titleEl = document.querySelector('[data-active="true"]') || document.querySelector('h1');
    return titleEl?.textContent?.trim() || document.title || 'ChatGPT Conversation';
  }
}
