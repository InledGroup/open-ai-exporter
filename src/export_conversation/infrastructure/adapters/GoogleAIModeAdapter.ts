import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message } from '../../../core/domain/entities';
import { hasMeaningfulContent, sanitizeMessageHtml } from '../../../core/infrastructure/sanitizeHtml';

/**
 * Adaptador para Google AI Mode (resultados de búsqueda con `udm=50` o `mtid`).
 *
 * La lógica está portada de la extensión de referencia:
 * - Cada turno se localiza con `[data-subtree="aimc"]` (o `.CKgc1d`).
 * - La pregunta está en `span[jsname="y5v2y"]`; si no, en `.iMqumd`.
 * - La respuesta son los `[data-container-id="main-col"]`, incluyendo los
 *   contenedores enlazados con `data-target-container-id`.
 * - Las fuentes son `ul.bTFeG li a[href]` y van aparte, nunca como pregunta.
 */
export class GoogleAIModeAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';
  private readonly ALLOWED_HOSTS = ['www.google.com', 'www.google.com.hk', 'www.google.co.uk'];
  private readonly LENS_IMAGE_PREFIX = 'https://lens.usercontent.google.com/banana';

  isCurrentPage(): boolean {
    const url = new URL(window.location.href);
    const isGoogleSearch = this.ALLOWED_HOSTS.includes(url.hostname) && url.pathname === '/search';
    const isAIMode = url.searchParams.has('mtid') || url.searchParams.get('udm') === '50';
    return isGoogleSearch && isAIMode;
  }

  async getMessages(): Promise<Message[]> {
    const messages: Message[] = [];
    const pageId = this.getPageId();

    this.getMessageRoots().forEach((root, index) => {
      const baseId = `google-ai-${pageId}-${index}`;
      const userContent = this.extractUserContent(root);
      const assistantContent = this.extractAssistantContent(root);

      if (hasMeaningfulContent(userContent)) {
        messages.push({
          id: `${baseId}-user`,
          role: 'user',
          content: userContent,
        });
      }

      if (hasMeaningfulContent(assistantContent)) {
        messages.push({
          id: `${baseId}-assistant`,
          role: 'assistant',
          content: assistantContent,
        });
      }
    });

    return messages;
  }

  private getPageId(): string {
    const url = new URL(window.location.href);
    return url.searchParams.get('mtid') || url.searchParams.get('q') || 'page';
  }

  private getMessageRoots(): HTMLElement[] {
    const resolved = Array.from(document.querySelectorAll('[data-subtree="aimc"]'))
      .map(el => this.resolveMessageRoot(el as HTMLElement))
      .filter((el): el is HTMLElement => !!el);

    const unique = Array.from(new Set(resolved));
    if (unique.length > 0) return unique;

    return Array.from(document.querySelectorAll('.CKgc1d')) as HTMLElement[];
  }

  private resolveMessageRoot(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;
    for (let i = 0; i < 10 && current; i += 1) {
      const marker = current.querySelector('span[jsname="y5v2y"], .iMqumd');
      const nestedBlocks = current.querySelectorAll('[data-subtree="aimc"]').length;
      if (marker && nestedBlocks === 1) return current;
      current = current.parentElement;
    }
    return null;
  }

  private extractUserContent(root: HTMLElement): string {
    // Pregunta explícita de AI Mode.
    const query = root.querySelector('span[jsname="y5v2y"]');
    if (query) {
      const text = this.normalizeText(query.textContent || '');
      if (text) return `<p>${this.escapeHtml(text)}</p>`;
    }

    // AI Mode titula la respuesta con "Respuesta del Modo IA para <pregunta>".
    // El nivel del encabezado cambia (H2, H3...), así que no se filtra por tag.
    const label = root.querySelector('.iMqumd');
    if (label) {
      let text = this.normalizeText(label.textContent || '');
      text = text
        .replace(/^(?:respuesta del modo ia|respuesta de ia|ai mode response|ai overview)\s+(?:para|sobre|for|about)\s+/i, '')
        .replace(/[:：]\s*$/, '')
        .trim();
      if (text) return `<p>${this.escapeHtml(text)}</p>`;
    }

    // Si cambia el encabezado, la URL sigue llevando la consulta original.
    const urlQuery = new URL(window.location.href).searchParams.get('q');
    if (urlQuery) {
      return `<p>${this.escapeHtml(urlQuery)}</p>`;
    }

    return '';
  }

  private extractAssistantContent(root: HTMLElement): string {
    const mainColumns = Array.from(root.querySelectorAll('[data-container-id="main-col"]'));
    const parts: string[] = [];

    mainColumns.forEach((main) => {
      const html = this.cleanAssistantBlock(main as HTMLElement);
      if (hasMeaningfulContent(html)) {
        parts.push(html);
        return;
      }

      // Algunos bloques se renderizan en contenedores enlazados fuera del main-col.
      const linked = document.createElement('div');
      const containerIds = Array.from(main.querySelectorAll('[data-container-id]'))
        .map(el => el.getAttribute('data-container-id') || '')
        .filter(id => !!id && id !== 'main-col');

      Array.from(new Set(containerIds)).forEach((id) => {
        Array.from(root.querySelectorAll('[data-target-container-id]'))
          .filter(el => el.getAttribute('data-target-container-id') === id)
          .forEach(extra => linked.appendChild(extra.cloneNode(true)));
      });

      const linkedHtml = this.cleanAssistantBlock(linked);
      if (hasMeaningfulContent(linkedHtml)) parts.push(linkedHtml);
    });

    const sources = this.extractSources(root);
    if (sources) parts.push(sources);

    // Nunca se usa todo el root como respuesta: la sidebar de fuentes y la
    // pregunta no deben acabar como mensaje del asistente.
    return parts.join('\n');
  }

  private cleanAssistantBlock(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;

    // Google genera varias imágenes candidatas para la misma respuesta; sólo
    // la imagen real de Lens interesa.
    clone.querySelectorAll('[jsaction*="aimRenderComplete:"]').forEach((wrapper) => {
      const images = Array.from(wrapper.querySelectorAll('img'));
      const keep = images.find(img => this.isLensImage(img as HTMLImageElement));
      images.forEach(img => {
        if (img !== keep) img.remove();
      });
    });

    // Sidebar/duplicados de fuentes dentro del bloque de respuesta.
    Array.from(clone.querySelectorAll('[id*="shrproxy"]')).forEach((el) => {
      const block = el.closest('.YHsVn');
      if (block && block !== clone) block.remove();
    });

    Array.from(clone.querySelectorAll('button[aria-label]')).forEach((button) => {
      const parent = button.parentElement;
      if (parent && parent !== clone) parent.remove();
    });

    clone.querySelectorAll(
      'ul.bTFeG, ul.EJw9bc, .BTkBWc, button, style, script, noscript, svg, ' +
      '[hidden], [style*="display:none"], [style*="display: none"], ' +
      '[role="status"], [role="alert"], [aria-live], [role="dialog"], ' +
      '[role="alertdialog"], [role="tooltip"]'
    ).forEach(el => el.remove());

    return sanitizeMessageHtml(clone.innerHTML, 'assistant');
  }

  private extractSources(root: HTMLElement): string {
    const links = Array.from(root.querySelectorAll('ul.bTFeG li a[href]')) as HTMLAnchorElement[];
    const seen = new Set<string>();
    const items: string[] = [];

    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href || seen.has(href)) return;
      seen.add(href);

      const title = this.normalizeText(
        link.getAttribute('aria-label') || link.textContent || href
      );
      items.push(
        `<li><a href="${this.escapeHtml(href)}">${this.escapeHtml(title)}</a></li>`
      );
    });

    if (items.length === 0) return '';
    return `<p><strong>Sources</strong></p><ul>${items.join('')}</ul>`;
  }

  private isLensImage(img: HTMLImageElement): boolean {
    const sources = [
      img.getAttribute('src') || '',
      img.currentSrc || '',
      img.getAttribute('data-src') || '',
    ];
    return sources.some(src => src.startsWith(this.LENS_IMAGE_PREFIX));
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    const pageId = this.getPageId();

    this.getMessageRoots().forEach((root, index) => {
      if (root.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const baseId = `google-ai-${pageId}-${index}`;
      const hasAssistant = !!root.querySelector('[data-container-id="main-col"], ul.bTFeG');
      const ids = hasAssistant ? [`${baseId}-user`, `${baseId}-assistant`] : [`${baseId}-user`];

      if (window.getComputedStyle(root).position === 'static') {
        root.style.position = 'relative';
      }

      ids.forEach((id, position) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = this.CHECKBOX_CLASS;
        checkbox.dataset.id = id;
        checkbox.title = position === 0 ? 'User message' : 'AI response';
        checkbox.style.cssText = `
          position: absolute;
          left: -30px;
          top: ${10 + position * 26}px;
          z-index: 1000;
          width: 20px;
          height: 20px;
          cursor: pointer;
        `;

        checkbox.addEventListener('change', () => {
          onSelectionChange(this.getSelectedMessageIds());
        });

        root.prepend(checkbox);
      });
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
    const ids = Array.from(document.querySelectorAll(`input.${this.CHECKBOX_CLASS}:checked`))
      .map(cb => (cb as HTMLInputElement).dataset.id || '');
    return Array.from(new Set(ids.filter(Boolean)));
  }

  getConversationTitle(): string {
    const title = document.title.trim();
    if (title) {
      const parts = title.split('-').map(part => part.trim()).filter(Boolean);
      if (parts.length > 1) return parts.slice(0, -1).join(' - ');
      return title;
    }

    const url = new URL(window.location.href);
    return url.searchParams.get('q') || 'Google AI Mode Conversation';
  }
}
