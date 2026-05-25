import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ChatGPTAdapter implements IAAdapter {
  private readonly MESSAGE_SELECTOR = 'article';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const contentEl = el.querySelector('div.text-base') || el.querySelector('.markdown') || el;
      if (!contentEl) return;

      const isAssistant = el.querySelector('.sr-only')?.textContent?.toLowerCase().includes('chatgpt') || 
                          el.querySelector('svg.icon-sm') || 
                          el.querySelector('.agent-turn');

      const role: Role = isAssistant ? 'assistant' : 'user';
      
      messages.push({
        id: `chatgpt-msg-${index}`,
        role,
        content: (contentEl as HTMLElement).innerHTML // Cambiado a innerHTML
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
      checkbox.dataset.id = `chatgpt-msg-${index}`;
      checkbox.style.cssText = `
        position: absolute;
        left: 10px;
        top: 10px;
        z-index: 10000;
        width: 20px;
        height: 20px;
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
    return document.title || 'ChatGPT Conversation';
  }
}
