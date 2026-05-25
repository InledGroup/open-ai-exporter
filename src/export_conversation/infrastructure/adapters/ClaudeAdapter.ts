import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ClaudeAdapter implements IAAdapter {
  private readonly MESSAGE_SELECTOR = '[data-test-render-count]';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('claude.ai');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      // Lógica de detección de roles de Claude extraída de sourcecode
      // Busca [data-testid="user-message"] dentro del contenedor
      const isUser = el.querySelector('[data-testid="user-message"]') !== null;
      const role: Role = isUser ? 'user' : 'assistant';
      
      // Capturamos el contenido. Claude a menudo tiene el texto dentro de .font-claude-message o similar
      // pero el contenedor [data-test-render-count] es el que tiene el bloque completo.
      const contentEl = el.querySelector('.font-claude-message, .font-user-message') || el;

      messages.push({
        id: `claude-msg-${index}`,
        role,
        content: (contentEl as HTMLElement).innerHTML
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
      checkbox.dataset.id = `claude-msg-${index}`;
      
      checkbox.style.cssText = `
        position: absolute;
        left: -30px;
        top: 10px;
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
    // Intenta sacar el título del chat del sidebar o la URL
    return document.title || 'Claude Conversation';
  }
}
