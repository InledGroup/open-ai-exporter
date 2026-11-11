import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';
import { hasMeaningfulContent, sanitizeMessageHtml } from '../../../core/infrastructure/sanitizeHtml';

/**
 * NotebookLM expone cada turno como `chat-message`. Dentro hay un
 * `.from-user-container` (pregunta) o un `.to-user-container` (respuesta).
 * El host nuevo es notebook.google.com (antes notebooklm.google.com).
 */
export class NotebookLMAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';
  private readonly MESSAGE_SELECTOR = 'chat-message';
  private readonly FALLBACK_SELECTOR = [
    'chat-message',
    '.message-container',
    '.conversation-turn',
    '[data-testid="message"]',
    '.chat-message',
    '.message-bubble',
  ].join(',');

  private getMessageElements(): HTMLElement[] {
    const primary = Array.from(document.querySelectorAll(this.MESSAGE_SELECTOR)) as HTMLElement[];
    if (primary.length > 0) return primary;

    // Compatibilidad con versiones anteriores de NotebookLM.
    const fallback = Array.from(document.querySelectorAll(this.FALLBACK_SELECTOR)) as HTMLElement[];
    return fallback.filter(el =>
      el.classList.contains('from-user-container') ||
      el.classList.contains('to-user-container') ||
      !!el.querySelector('.message-text-content, .md3-body-text')
    );
  }

  private getRole(el: HTMLElement): Role {
    if (el.classList.contains('from-user-container') || el.querySelector('.from-user-container')) return 'user';
    if (el.classList.contains('to-user-container') || el.querySelector('.to-user-container')) return 'assistant';
    if (el.getAttribute('author') === 'assistant') return 'assistant';
    if (el.getAttribute('author') === 'user') return 'user';
    if (el.classList.contains('assistant')) return 'assistant';
    if (el.matches('[data-testid="user-message"]')) return 'user';

    const article = el.closest('article');
    if (article) {
      const labels = Array.from(article.querySelectorAll('.sr-only'));
      for (const label of labels) {
        const text = (label.textContent || '').toLowerCase();
        if (text.includes('notebook') || text.includes('gemini') || text.includes('assistant')) {
          return 'assistant';
        }
        if (text.includes('you said') || text.includes('you wrote')) return 'user';
      }
    }

    // En NotebookLM las respuestas suelen incluir acciones (copiar, guardar,
    // etc.) y las preguntas no.
    if (
      el.querySelector('chat-actions, mat-card-actions, [author="assistant"], .assistant-icon') ||
      el.querySelector('.mat-icon[svgicon*="notebook"]') ||
      el.querySelector('.response-content-markdown')
    ) {
      return 'assistant';
    }

    return 'user';
  }

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host === 'notebook.google.com' ||
      host === 'notebooklm.google.com' ||
      host.endsWith('.notebook.google.com') ||
      host.endsWith('.notebooklm.google.com');
  }

  async getMessages(): Promise<Message[]> {
    const elements = this.getMessageElements();
    const messages: Message[] = [];

    elements.forEach((el, index) => {
      const role = this.getRole(el);
      // Clonar el propio mensaje, nunca su padre: el padre suele envolver el
      // turno completo y mezclaría la pregunta del usuario con la respuesta.
      const contentEl = (el.querySelector('.message-text-content, .from-user-container, .to-user-container, .message-text, .response-content-markdown, .markdown, .prose') as HTMLElement) || el;
      const clone = contentEl.cloneNode(true) as HTMLElement;

      clone.querySelectorAll(`button, .sr-only, svg, .thinking-chain, .${this.CHECKBOX_CLASS}`)
        .forEach(node => node.remove());

      const content = sanitizeMessageHtml(clone.innerHTML, role);
      if (!hasMeaningfulContent(content)) return;

      messages.push({
        id: `notebook-msg-${index}`,
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
      checkbox.dataset.id = `notebook-msg-${index}`;
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
    return document.title || 'NotebookLM Conversation';
  }
}
