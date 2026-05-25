import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class NotebookLMAdapter implements IAAdapter {
  // Selectores específicos para NotebookLM (contenedores de chat)
  private readonly MESSAGE_SELECTOR = 'chat-message, .message-container, .conversation-turn';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('notebooklm.google.com');
  }

  getMessages(): Message[] {
    // NotebookLM usa Web Components a veces, o estructuras de Google
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      // Detección de rol basada en clases o estructura
      const isAssistant = el.classList.contains('assistant') || 
                          el.querySelector('.assistant-icon') ||
                          el.getAttribute('author') === 'assistant';
      
      const role: Role = isAssistant ? 'assistant' : 'user';
      const contentEl = el.querySelector('.message-text') || el.querySelector('.content') || el;

      messages.push({
        id: `notebook-msg-${index}`,
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
      checkbox.dataset.id = `notebook-msg-${index}`;
      checkbox.style.cssText = 'margin-right: 10px; width: 18px; height: 18px;';

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
