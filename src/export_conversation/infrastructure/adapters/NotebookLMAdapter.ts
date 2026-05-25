import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class NotebookLMAdapter implements IAAdapter {
  private readonly MESSAGE_SELECTOR = 'chat-message, .message-container, .conversation-turn';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('notebooklm.google.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const text = el.textContent || '';
      
      // Detección de roles mejorada para NotebookLM
      // El asistente suele tener un icono específico o estar en un tag 'chat-message' con atributos
      const isAssistant = el.tagName.toLowerCase() === 'chat-message' || 
                          el.classList.contains('assistant') || 
                          el.querySelector('.assistant-icon') ||
                          el.querySelector('.mat-icon[svgicon*="notebook"]') ||
                          (text.length > 300 && !el.querySelector('.user-avatar'));
      
      const role: Role = isAssistant ? 'assistant' : 'user';
      
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
      checkbox.style.cssText = `
        position: absolute; left: 5px; top: 10px; z-index: 10000;
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
    return document.title || 'NotebookLM Conversation';
  }
}
