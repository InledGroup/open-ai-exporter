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
      // Detección de roles basada en data-testid
      const isUser = el.querySelector('[data-testid="user-message"]') !== null;
      const role: Role = isUser ? 'user' : 'assistant';
      
      // Intentamos capturar solo el cuerpo del mensaje, omitiendo la barra de herramientas
      const contentEl = el.querySelector('.font-claude-message, .font-user-message') || 
                        el.querySelector('.grid.gap-4') || 
                        el;

      const clone = contentEl.cloneNode(true) as HTMLElement;
      // Limpiar botones de la UI (Copiar, Reintentar, etc.)
      clone.querySelectorAll('button, [role="toolbar"], .flex.justify-end').forEach(ui => ui.remove());

      messages.push({
        id: `claude-msg-${index}`,
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
    return document.title || 'Claude Conversation';
  }
}
