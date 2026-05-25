import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class ChatGPTAdapter implements IAAdapter {
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
      const role = this.detectChatType(el as HTMLElement);
      const isAssistant = role === 'chatgpt';
      
      const contentEl = el.querySelector('.markdown') || el;
      const clone = contentEl.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('button, .flex.justify-between, .sr-only, .ai-exporter-checkbox').forEach(node => node.remove());

      messages.push({
        id: `chatgpt-msg-${index}`,
        role: isAssistant ? 'assistant' : 'user',
        content: clone.innerHTML
      });
    });

    return messages;
  }

  private detectChatType(e: HTMLElement): string {
    let n = e.parentElement;
    for (let r = 0; r < 5 && n; r++) {
      if (n.tagName === "ARTICLE") {
        const i = n.querySelectorAll(".sr-only");
        for (let o = 0; o < i.length; o++) {
          if ((i[o].textContent?.toLowerCase() || "").includes("chatgpt")) {
            return "chatgpt";
          }
        }
        break;
      }
      n = n.parentElement;
    }
    return "prompt";
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
        position: absolute; left: -35px; top: 5px; z-index: 1000;
        width: 20px; height: 20px; cursor: pointer;
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
    const titleEl = document.querySelector('[data-active="true"]') || document.querySelector('h1');
    return titleEl?.textContent?.trim() || document.title || 'ChatGPT Conversation';
  }
}
