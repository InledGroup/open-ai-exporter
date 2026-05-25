import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class NotebookLMAdapter implements IAAdapter {
  // Selectores para NotebookLM (basados en componentes de chat y contenedores comunes)
  private readonly MESSAGE_SELECTOR = 'chat-message, .message-container, .conversation-turn';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('notebooklm.google.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      // Detección de roles avanzada para NotebookLM
      const text = el.textContent || '';
      const html = el.innerHTML;
      
      // La IA suele tener el tag 'chat-message' o atributos específicos
      // También buscamos por clases comunes de Google o el icono del robot
      const isAssistant = el.tagName.toLowerCase() === 'chat-message' || 
                          el.getAttribute('author') === 'assistant' ||
                          el.classList.contains('assistant') || 
                          el.classList.contains('model-response') ||
                          html.includes('assistant-icon') ||
                          html.includes('mat-icon') && html.includes('notebook') ||
                          (text.length > 400 && !html.includes('user-avatar'));
      
      const role: Role = isAssistant ? 'assistant' : 'user';
      
      // Capturamos el contenido rico
      const contentEl = el.querySelector('.message-text') || el.querySelector('.content') || el;
      const clone = contentEl.cloneNode(true) as HTMLElement;

      // Limpieza de UI
      clone.querySelectorAll('button, .sr-only, svg, .ai-exporter-checkbox').forEach(node => node.remove());

      messages.push({
        id: `notebook-msg-${index}`,
        role,
        content: clone.innerHTML
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
      checkbox.dataset.id = `notebook-msg-${index}`;
      
      // Estilo que no interfiera con los iconos de NotebookLM
      checkbox.style.cssText = `
        position: absolute; left: -10px; top: 15px; z-index: 10000;
        width: 18px; height: 18px; cursor: pointer;
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
    const titleEl = document.querySelector('.notebook-title') || document.querySelector('h1');
    return titleEl?.textContent?.trim() || document.title || 'NotebookLM Conversation';
  }
}
