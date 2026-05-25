import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class GeminiAdapter implements IAAdapter {
  // Selectores para Gemini: dvXlsc es el contenedor de mensajes en el código analizado
  private readonly MESSAGE_SELECTOR = '[jsname="dvXlsc"], .message-content, .query-text, .model-response-text';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('gemini.google.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      // Diferenciar rol en Gemini
      const isAssistant = el.closest('.model-response-container') || 
                          el.classList.contains('model-response-text') ||
                          el.getAttribute('jsname') === 'dvXlsc'; // dvXlsc suele ser respuesta
      const role: Role = isAssistant ? 'assistant' : 'user';
      
      messages.push({
        id: `gemini-msg-${index}`,
        role,
        content: (el as HTMLElement).innerText
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
      checkbox.style.marginRight = '10px';
      checkbox.style.width = '18px';
      checkbox.style.height = '18px';

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
    return document.title || 'Gemini Conversation';
  }
}
