import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ClaudeAdapter implements IAAdapter {
  // Selectores extraídos del análisis: Claude usa data-test-render-count o classes específicas
  private readonly MESSAGE_SELECTOR = '[data-test-render-count], .font-claude-message, .font-user-message';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('claude.ai');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      // Heurística de rol basada en clases de Claude
      const isAssistant = el.classList.contains('font-claude-message') || 
                          el.querySelector('.lucide-claudebot') || 
                          el.closest('[data-testid="assistant-message"]');
      const role: Role = isAssistant ? 'assistant' : 'user';
      
      messages.push({
        id: `claude-msg-${index}`,
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
      checkbox.dataset.id = `claude-msg-${index}`;
      checkbox.style.position = 'absolute';
      checkbox.style.left = '-25px';
      checkbox.style.top = '10px';
      checkbox.style.zIndex = '1000';
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
    return document.title || 'Claude Conversation';
  }
}
