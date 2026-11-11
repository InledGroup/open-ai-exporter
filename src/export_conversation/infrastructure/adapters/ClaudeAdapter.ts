import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';
import { hasMeaningfulContent, sanitizeMessageHtml } from '../../../core/infrastructure/sanitizeHtml';

export class ClaudeAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  private getMessageElements(): HTMLElement[] {
    // DOM actual de Claude: una fila por turno, con data-perf-row
    // "human"/"assistant" y testids user-message/assistant-message.
    const rows = Array.from(
      document.querySelectorAll('[data-testid="transcript-row"]')
    ) as HTMLElement[];
    if (rows.length > 0) return rows;

    // Compatibilidad con versiones anteriores.
    return Array.from(
      document.querySelectorAll('[data-test-render-count], [data-testid="user-message"], [data-testid="assistant-message"]')
    ) as HTMLElement[];
  }

  private getRole(el: HTMLElement): Role {
    const perfRow = el.getAttribute('data-perf-row');
    if (perfRow === 'human' || perfRow === 'user') return 'user';
    if (perfRow === 'assistant') return 'assistant';

    if (el.matches('[data-testid="user-message"]') || el.querySelector('[data-testid="user-message"]')) {
      return 'user';
    }
    if (el.matches('[data-testid="assistant-message"]') || el.querySelector('[data-testid="assistant-message"]')) {
      return 'assistant';
    }

    return el.querySelector('[data-testid="user-message"]') ? 'user' : 'assistant';
  }

  private getContentElement(el: HTMLElement): HTMLElement {
    if (this.getRole(el) === 'user') {
      return (el.querySelector('[data-testid="user-message"]') as HTMLElement) ||
        (el.querySelector('.cds-user-message-body') as HTMLElement) ||
        el;
    }

    return (el.querySelector('[data-testid="assistant-message"]') as HTMLElement) || el;
  }

  private getMessageId(el: HTMLElement, index: number): string {
    const turnKey = el.querySelector('[data-turn-key]')?.getAttribute('data-turn-key') ||
      el.closest('[data-turn-key]')?.getAttribute('data-turn-key');
    return turnKey || `claude-msg-${index}`;
  }

  isCurrentPage(): boolean {
    return window.location.hostname.includes('claude.ai');
  }

  async getMessages(): Promise<Message[]> {
    const elements = this.getMessageElements();
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const role = this.getRole(el);
      const clone = this.getContentElement(el).cloneNode(true) as HTMLElement;

      clone.querySelectorAll(
        `[data-sheet-kind], [data-cds="TurnStatus"], [role="toolbar"], ` +
        `button, svg, .sr-only, .${this.CHECKBOX_CLASS}`
      ).forEach(node => node.remove());

      // Conservar sólo el código dentro de los bloques de código.
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
        top: 24px;
        z-index: 1000;
        width: 20px;
        height: 20px;
        cursor: pointer;
      `;

      checkbox.addEventListener('change', () => {
        onSelectionChange(this.getSelectedMessageIds());
      });

      el.appendChild(checkbox);
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
    return document.title || 'Claude Conversation';
  }
}
