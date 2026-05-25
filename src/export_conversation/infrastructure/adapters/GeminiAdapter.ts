import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class GeminiAdapter implements IAAdapter {
  // Selectores de Google Gemini
  private readonly MESSAGE_SELECTOR = 'user-query, model-response';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('gemini.google.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const tagName = el.tagName.toLowerCase();
      const role: Role = tagName === 'user-query' ? 'user' : 'assistant';
      
      // Clonamos para limpiar sin afectar la UI original
      const clone = el.cloneNode(true) as HTMLElement;
      
      // Limpiar pensamientos (thinking process) si existen
      clone.querySelectorAll('model-thoughts').forEach(th => th.remove());
      
      // Buscamos el contenedor de texto real
      const contentEl = clone.querySelector('.message-content') || 
                        clone.querySelector('.query-text') || 
                        clone.querySelector('.model-response-text') || 
                        clone;

      messages.push({
        id: `gemini-msg-${index}`,
        role,
        content: contentEl.innerHTML
      });
    });

    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    elements.forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      container.style.position = 'relative';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = `gemini-msg-${index}`;
      
      checkbox.style.cssText = `
        position: absolute;
        left: -35px;
        top: 15px;
        z-index: 10000;
        width: 18px;
        height: 18px;
        cursor: pointer;
      `;

      checkbox.addEventListener('change', () => {
        onSelectionChange(this.getSelectedMessageIds());
      });

      container.prepend(checkbox);
    });
  }

  getSelectedMessageIds(): string[] {
    const checkboxes = document.querySelectorAll(`.${this.CHECKBOX_CLASS}:checked`);
    return Array.from(checkboxes).map(cb => (cb as HTMLInputElement).dataset.id || '');
  }

  getConversationTitle(): string {
    const titleEl = document.querySelector('.conversation.selected') || 
                    document.querySelector('[data-active-chat-title]') ||
                    document.querySelector('h1');
    return titleEl?.textContent?.trim() || document.title || 'Gemini Conversation';
  }
}
