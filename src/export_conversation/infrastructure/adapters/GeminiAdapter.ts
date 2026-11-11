import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';
import { hasMeaningfulContent, sanitizeMessageHtml } from '../../../core/infrastructure/sanitizeHtml';

export class GeminiAdapter implements IAAdapter {
  // Selectores de Google Gemini
  private readonly MESSAGE_SELECTOR = 'user-query, model-response';
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('gemini.google.com');
  }

  async getMessages(): Promise<Message[]> {
    const elements = document.querySelectorAll(this.MESSAGE_SELECTOR);
    const messages: Message[] = [];

    for (const [index, el] of Array.from(elements).entries()) {
      const tagName = el.tagName.toLowerCase();
      const role: Role = tagName === 'user-query' ? 'user' : 'assistant';

      // Clonamos para limpiar sin afectar a la UI original
      const clone = el.cloneNode(true) as HTMLElement;

      // El proceso de pensamiento no forma parte de la respuesta
      clone.querySelectorAll('model-thoughts, .model-thoughts, .thinking, .thoughts, thinking-overlay').forEach(th => th.remove());

      // Gemini ha cambiado varias veces los contenedores internos. Clonar el
      // bloque completo (user-query / model-response) es lo más estable y es
      // lo que hace la extensión de referencia. El sanitizador se encarga de
      // quitar botones, avatares, rótulos ocultos y widgets.
      const fallbackText = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      let content = sanitizeMessageHtml(clone.innerHTML, role);
      content = await this.inlineImages(content);

      // Si el sanitizador se ha quedado sin nada pero el bloque tiene texto,
      // conserva ese texto para no perder respuestas.
      if (!hasMeaningfulContent(content) && fallbackText) {
        content = sanitizeMessageHtml(`<p>${this.escapeHtml(fallbackText)}</p>`, role);
      }

      if (!hasMeaningfulContent(content)) continue;

      messages.push({
        id: `gemini-msg-${index}`,
        role,
        content
      });
    }

    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    document.querySelectorAll(this.MESSAGE_SELECTOR).forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      container.style.position = 'relative';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = `gemini-msg-${index}`;
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

      container.prepend(checkbox);
    });
  }

  removeCheckboxes(): void {
    document.querySelectorAll(`.${this.CHECKBOX_CLASS}`).forEach(el => el.remove());
  }

  selectAll(select: boolean): void {
    const checkboxes = document.querySelectorAll(`input.${this.CHECKBOX_CLASS}`);
    checkboxes.forEach(cb => {
      (cb as HTMLInputElement).checked = select;
    });
  }

  getSelectedMessageIds(): string[] {
    const checkboxes = document.querySelectorAll(`.${this.CHECKBOX_CLASS}:checked`);
    return Array.from(checkboxes).map(cb => (cb as HTMLInputElement).dataset.id || '');
  }

  getConversationTitle(): string {
    const titleEl = document.querySelector('.conversation.selected') ||
                    document.querySelector('[data-active-chat-title]') ||
                    document.querySelector('h1');
    return titleEl?.textContent?.trim() || document.title || 'Gemini Conversation';
  }

  /**
   * Gemini sirve las imágenes desde googleusercontent con URLs que no se
   * pueden abrir desde la página de preview. Se piden al service worker y se
   * incrustan como data: para que preview, PDF y Word las muestren.
   */
  private async inlineImages(html: string): Promise<string> {
    if (!/<img\b/i.test(html)) return html;

    const runtime = (globalThis as any).browser?.runtime ||
      (globalThis as any).chrome?.runtime;
    if (!runtime?.id) return html;

    const template = document.createElement('template');
    template.innerHTML = html;
    const images = Array.from(template.content.querySelectorAll('img'));

    await Promise.all(images.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!/^https?:\/\//i.test(src)) return;

      try {
        const result = await runtime.sendMessage({
          type: 'AI_EXPORTER_FETCH_IMAGE',
          url: src,
        });
        if (result?.ok && result.dataUrl) {
          img.setAttribute('src', result.dataUrl);
        }
      } catch {
        // Si el service worker no está disponible se conserva la URL original.
      }
    }));

    return template.innerHTML;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
