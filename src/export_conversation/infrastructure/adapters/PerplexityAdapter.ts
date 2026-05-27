import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class PerplexityAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('perplexity.ai');
  }

  private extractConversationId(): string {
    const n = window.location.href.match(/\/search\/([^\/?#]+)/);
    if (!n) throw new Error("无法从URL中提取 thread ID");
    return n[1];
  }

  async getMessages(): Promise<Message[]> {
    const threadId = this.extractConversationId();
    const url = `https://www.perplexity.ai/rest/thread/${threadId}`;
    
    // Parámetros de búsqueda detallados de la versión 2.18
    const params = new URLSearchParams({
      with_parent_info: "true",
      with_schematized_response: "true",
      version: "2.18",
      source: "default",
      limit: "10",
      offset: "0",
      from_first: "true"
    });
    
    const useCases = [
      "answer_modes", "media_items", "knowledge_cards", "inline_entity_cards",
      "place_widgets", "finance_widgets", "sports_widgets", "flight_status_widgets",
      "shopping_widgets", "jobs_widgets", "search_result_widgets", "clarification_responses",
      "inline_images", "inline_assets", "placeholder_cards", "diff_blocks",
      "inline_knowledge_cards", "entity_group_v2", "refinement_filters", "canvas_mode",
      "maps_preview", "answer_tabs", "price_comparison_widgets"
    ];
    useCases.forEach(u => params.append("supported_block_use_cases", u));

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "x-app-apiclient": "default",
        "x-app-apiversion": "2.18"
      }
    });

    if (!response.ok) throw new Error(`HTTP请求失败: ${response.status}`);
    const data = await response.json();

    return this.convertToMessages(data, threadId);
  }

  private extractAssistantContents(blocks: any[]): any[] {
    const contents: any[] = [];
    const webResults: any[] = [];

    // Primero recolectar resultados web para las citas
    for (const b of blocks) {
      if (b.intended_usage === "web_results") {
        const results = b.web_result_block?.web_results ?? [];
        webResults.push(...results);
      }
    }

    const resolveCitations = (text: string) => {
      return text.replace(/\[(\d+)\]/g, (match, num) => {
        const idx = parseInt(num, 10) - 1;
        const res = webResults[idx];
        if (!res || !res.url) return match;
        
        let domain = res.meta_data?.citation_domain_name || res.meta_data?.domain_name;
        if (!domain) {
          try {
            const url = new URL(res.url);
            domain = url.hostname.replace(/^www\./, '').split('.')[0] || url.hostname;
          } catch {
            domain = num;
          }
        }
        return ` <sup class="citation"><a href="${res.url}" title="${domain}" target="_blank">${num}</a></sup>`;
      });
    };

    for (const b of blocks) {
      const usage = b.intended_usage;
      if (usage === "media_items") {
        const items = b.media_block?.media_items || [];
        for (const item of items) {
          if (item.medium === "image" && item.image) {
            contents.push({ type: "image", imageUrl: item.image });
          }
        }
      } else if (usage === "ask_text") {
        const answer = b.markdown_block?.answer;
        if (answer && answer.trim()) {
          contents.push({ type: "markdown", content: resolveCitations(answer) });
        }
        const items = b.markdown_block?.media_items || [];
        for (const item of items) {
          if (item.medium === "image" && item.image) {
            contents.push({ type: "image", imageUrl: item.image });
          }
        }
      }
    }
    return contents;
  }

  private convertToMessages(data: any, threadId: string): Message[] {
    const messages: Message[] = [];
    if (!data.entries) return messages;

    for (const entry of data.entries) {
      const timestamp = new Date(entry.entry_updated_datetime || entry.updated_datetime).getTime();
      
      if (entry.query_str && entry.query_str.trim()) {
        messages.push({
          id: `${entry.uuid}_user`,
          role: "user",
          content: entry.query_str,
          timestamp
        });
      }

      const assistantContents = this.extractAssistantContents(entry.blocks || []);
      if (assistantContents.length > 0) {
        // Concatenar contenidos del asistente en un solo string de markdown
        const content = assistantContents.map(c => {
          if (c.type === "image") return `![Image](${c.imageUrl})`;
          return c.content;
        }).join('\n\n');

        messages.push({
          id: `${entry.uuid}_assistant`,
          role: "assistant",
          content,
          timestamp
        });
      }
    }
    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    // Selector basado en el código fuente para Perplexity
    const elements = document.querySelectorAll('[class*=threadContentWidth] [role="group"], [data-testid="thread-message"]');
    elements.forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      container.style.position = 'relative';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = `perplexity-msg-${index}`;
      checkbox.style.cssText = `
        position: absolute;
        left: -35px;
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
    const titleEl = document.querySelector('h1') || 
                    document.querySelector('title');
    return titleEl?.textContent?.trim() || 'Perplexity Conversation';
  }
}
