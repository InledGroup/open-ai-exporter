import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ChatGPTAdapter implements IAAdapter {
  // Absolute first selector that worked (from Turn 11)
  private readonly MESSAGE_SELECTOR = 'main article > div.text-base > div';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  getMessages(): Message[] {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const role = this.detectRole(el as HTMLElement);
      
      // Use innerHTML to preserve bold, italics, code, etc.
      const clone = el.cloneNode(true) as HTMLElement;
      // Clean up UI buttons and extra labels
      clone.querySelectorAll('button, .sr-only, .ai-exporter-checkbox').forEach(node => node.remove());

      messages.push({
        id: `chatgpt-msg-${index}`,
        role,
        content: clone.innerHTML
      });
    });

    return messages;
  }

  private detectRole(element: HTMLElement): Role {
    let parent = element.parentElement;
    for (let i = 0; i < 6 && parent; i++) {
      if (parent.tagName === 'ARTICLE') {
        const srOnly = parent.querySelectorAll('.sr-only');
        for (let j = 0; j < srOnly.length; j++) {
          if ((srOnly[j].textContent?.toLowerCase() || '').includes('chatgpt')) {
            return 'assistant';
          }
        }
        // Fallback for role attribute
        if (parent.querySelector('[data-message-author-role="assistant"]')) return 'assistant';
        break;
      }
      parent = parent.parentElement;
    }
    return 'user';
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    elements.forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      // We don't change container style to avoid breaking layout
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = `chatgpt-msg-${index}`;
      
      // Minimal inline styles to ensure visibility without breaking anything
      checkbox.style.cssText = `
        float: left;
        margin-right: 15px;
        margin-top: 5px;
        width: 18px;
        height: 18px;
        cursor: pointer;
        z-index: 999;
        position: relative;
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
