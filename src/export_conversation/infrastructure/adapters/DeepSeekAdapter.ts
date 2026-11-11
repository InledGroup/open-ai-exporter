import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';
import { hasMeaningfulContent, sanitizeMessageHtml } from '../../../core/infrastructure/sanitizeHtml';

/**
 * Extractor de DeepSeek basado en el DOM, igual que la extensión de
 * referencia. Antes se usaba la API interna, pero depende de userToken,
 * endpoints y del id de la URL, y por eso no exportaba nada.
 */
export class DeepSeekAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('deepseek.com') ||
      window.location.hostname.includes('deepseek.ai');
  }

  private getMessageElements(): HTMLElement[] {
    const containers: HTMLElement[] = [];
    document.querySelectorAll('.ds-message').forEach((message) => {
      const container = (message.parentElement as HTMLElement) || (message as HTMLElement);
      if (!containers.includes(container)) containers.push(container);
    });
    return containers;
  }

  private getRole(el: HTMLElement): Role {
    return el.classList.contains('ds-markdown') || el.querySelector('.ds-markdown')
      ? 'assistant'
      : 'user';
  }

  private getMessageId(el: HTMLElement, index: number): string {
    const message = el.querySelector('.ds-message') || el;
    const id = message.getAttribute('data-message-id') ||
      message.getAttribute('data-id') ||
      el.getAttribute('data-message-id') ||
      el.getAttribute('id');
    return id || `deepseek-msg-${index}`;
  }

  async getMessages(): Promise<Message[]> {
    const elements = this.getMessageElements();
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const role = this.getRole(el);
      const clone = el.cloneNode(true) as HTMLElement;

      // UI y bloques que no forman parte de la respuesta.
      clone.querySelectorAll(
        '.ds-think-content, ._7d763a7, ._0a3d93b, ._11d6b3a, .efa13877, ' +
        `.${this.CHECKBOX_CLASS}`
      ).forEach(node => node.remove());

      const content = sanitizeMessageHtml(clone.innerHTML, role);
      if (!hasMeaningfulContent(content)) return;

      messages.push({
        id: this.getMessageId(el, index),
        role,
        content,
      });
    });

    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    this.getMessageElements().forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      if (window.getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = this.getMessageId(el, index);
      checkbox.style.cssText = `
        position: absolute;
        left: -30px;
        top: 10px;
        z-index: 1000;
        width: 20px;
        height: 20px;
        cursor: pointer;
      `;

      checkbox.addEventListener('change', () => {
        onSelectionChange(this.getSelectedMessageIds());
      });

      el.prepend(checkbox);
    });
  }

  removeCheckboxes(): void {
    document.querySelectorAll(`.${this.CHECKBOX_CLASS}`).forEach(el => el.remove());
  }

  selectAll(select: boolean): void {
    document.querySelectorAll(`input.${this.CHECKBOX_CLASS}`).forEach(cb => {
      (cb as HTMLInputElement).checked = select;
    });
  }

  getSelectedMessageIds(): string[] {
    return Array.from(document.querySelectorAll(`input.${this.CHECKBOX_CLASS}:checked`))
      .map(cb => (cb as HTMLInputElement).dataset.id || '')
      .filter(Boolean);
  }

  getConversationTitle(): string {
    const titleEl = document.querySelector('.b64fb9ae') ||
      document.querySelector('.ds-flex.ds-items-center.ds-overflow-hidden.ds-text-ellipsis');
    return titleEl?.textContent?.trim() || document.title || 'DeepSeek Conversation';
  }
}
