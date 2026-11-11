import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';
import { hasMeaningfulContent, sanitizeMessageHtml } from '../../../core/infrastructure/sanitizeHtml';

export class ChatGPTAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  private getMessageElements(): HTMLElement[] {
    // DOM actual (2026): cada mensaje lleva data-conversation-role en su
    // encabezado accesible, dentro de un bloque de turno.
    const current = Array.from(
      document.querySelectorAll('[data-conversation-role="user"], [data-conversation-role="assistant"]')
    ) as HTMLElement[];
    if (current.length > 0) return current;

    // Selector de la extensión de referencia (versiones anteriores).
    const reference = Array.from(
      document.querySelectorAll('main article > div.text-base > div')
    ) as HTMLElement[];
    if (reference.length > 0) return reference;

    return Array.from(
      document.querySelectorAll('article[data-turn], [data-message-id]')
    ) as HTMLElement[];
  }

  private getRole(el: HTMLElement): Role {
    const attr = el.getAttribute('data-conversation-role');
    if (attr === 'user' || attr === 'assistant') return attr;

    const article = el.closest('article');
    if (article) {
      for (const label of Array.from(article.querySelectorAll('.sr-only'))) {
        const text = (label.textContent || '').toLowerCase();
        if (text.includes('chatgpt') || text.includes('assistant')) return 'assistant';
        if (text.includes('you said') || text.includes('you wrote')) return 'user';
      }
    }

    const directRole = el.getAttribute('data-message-author-role') ||
      el.closest('[data-message-author-role]')?.getAttribute('data-message-author-role');
    if (directRole === 'user' || directRole === 'assistant') return directRole;

    const turn = el.getAttribute('data-turn') ||
      el.closest('[data-turn]')?.getAttribute('data-turn');
    if (turn === 'user' || turn === 'assistant') return turn;

    return el.querySelector('.markdown, .prose') ? 'assistant' : 'user';
  }

  private getContentElement(el: HTMLElement): HTMLElement {
    if (el.getAttribute('data-conversation-role') === 'user') {
      return (el.parentElement?.querySelector('[data-user-message-bubble="true"]') as HTMLElement) ||
        (el.parentElement as HTMLElement) ||
        el;
    }

    const unit = el.closest('[data-content-search-unit-key]');
    if (unit) return unit as HTMLElement;

    // Compatibilidad con el DOM anterior.
    return (el.parentElement as HTMLElement) || el;
  }

  private getMessageId(el: HTMLElement, index: number): string {
    const content = this.getContentElement(el);
    const selectionId = content.querySelector('[data-chatgpt-selection-message-id]')
      ?.getAttribute('data-chatgpt-selection-message-id');
    if (selectionId) return selectionId;

    const searchIds = content.getAttribute('data-chatgpt-search-message-ids') ||
      el.parentElement?.querySelector('[data-chatgpt-search-message-ids]')
        ?.getAttribute('data-chatgpt-search-message-ids') ||
      el.getAttribute('data-chatgpt-search-message-ids');
    if (searchIds) {
      const first = searchIds.trim().split(/\s+/)[0];
      if (first) return first;
    }

    const unitKey = content.getAttribute('data-content-search-unit-key');
    if (unitKey) return unitKey;

    const turnKey = el.closest('[data-turn-key]')?.getAttribute('data-turn-key') ||
      content.getAttribute('data-turn-key') ||
      el.getAttribute('data-turn-key') ||
      el.closest('[data-turn-id]')?.getAttribute('data-turn-id');
    if (turnKey) return `${turnKey}-${this.getRole(el)}`;

    return `chatgpt-msg-${index}`;
  }

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('chatgpt.com') || host.includes('chat.openai.com');
  }

  async getMessages(): Promise<Message[]> {
    const elements = this.getMessageElements();
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const role = this.getRole(el);
      const clone = this.getContentElement(el).cloneNode(true) as HTMLElement;

      clone.querySelectorAll(
        `h4[data-conversation-role], .sr-only, .${this.CHECKBOX_CLASS}, ` +
        'img[src*="faviconV2"], img[src*="favicon"]'
      ).forEach(node => node.remove());

      // En ChatGPT el bloque de código suele tener una cabecera con botones.
      clone.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        pre.innerHTML = '';
        pre.appendChild(code.cloneNode(true));
      });

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
      const container = (el.parentElement as HTMLElement) || el;
      if (container.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = this.getMessageId(el, index);

      Object.assign(checkbox.style, {
        position: 'absolute',
        right: '-30px',
        top: '10px',
        zIndex: '1000',
        width: '22px',
        height: '22px',
        cursor: 'pointer',
        border: '2px solid #2563eb',
        borderRadius: '4px',
      });

      checkbox.addEventListener('change', () => {
        onSelectionChange(this.getSelectedMessageIds());
      });

      container.appendChild(checkbox);
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
    const titleEl = document.querySelector('[data-active="true"]') ||
      document.querySelector('nav li a.bg-token-sidebar-surface-tertiary') ||
      document.querySelector('h1') ||
      document.querySelector('title');
    return titleEl?.textContent?.trim() || 'ChatGPT Conversation';
  }
}
