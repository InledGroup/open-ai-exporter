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

  /**
   * Devuelve el turno completo del mensaje. El bloque
   * [data-content-search-unit-key] sólo contiene el texto; las imágenes
   * adjuntas o generadas viven en otros hijos del mismo turno, así que hay
   * que clonar el turno entero para no perderlas.
   */
  private getContentElement(el: HTMLElement): HTMLElement {
    const article = el.closest('article');
    if (article) return article as HTMLElement;

    const turn = el.closest(
      '[data-testid^="conversation-turn"], [data-testid*="conversation-turn"], [data-turn]'
    );
    if (turn) return turn as HTMLElement;

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

  /**
   * ChatGPT inserta las imágenes generadas/adjuntas un poco después del
   * texto, y la URL blob: tarda un instante en estar disponible. Si se clona
   * el turno demasiado pronto, la imagen se pierde.
   */
  private async waitForImages(elements: HTMLElement[]): Promise<void> {
    const started = Date.now();
    const maxWait = 5000;
    const noImageGrace = 1800;

    while (Date.now() - started < maxWait) {
      const images = elements.flatMap((el) =>
        Array.from(el.querySelectorAll('img'))
      ).filter((img) => {
        const src = img.currentSrc || img.src || '';
        return (src.startsWith('blob:') || /^https?:/i.test(src)) &&
          !/favicon/i.test(src);
      });

      if (images.length > 0) {
        const pending = images.some((img) => !img.complete || img.naturalWidth === 0);
        if (!pending) {
          // Pequeña espera extra por si se añade otra imagen del mismo turno.
          await new Promise((resolve) => setTimeout(resolve, 150));
          return;
        }
      } else if (Date.now() - started >= noImageGrace) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  async getMessages(): Promise<Message[]> {
    const elements = this.getMessageElements();
    await this.waitForImages(elements);
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

      const isUser = this.getRole(el) === 'user';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = this.getMessageId(el, index);

      Object.assign(checkbox.style, {
        position: 'absolute',
        // El contenedor de ChatGPT ocupa todo el ancho. Colocar el checkbox
        // fuera del contenedor lo deja invisible; se ancla al borde interior
        // del lado correspondiente al rol.
        left: isUser ? 'auto' : '6px',
        right: isUser ? '6px' : 'auto',
        top: '6px',
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
