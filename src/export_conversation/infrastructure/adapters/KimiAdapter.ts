import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class KimiAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';
  private readonly DEFAULT_LIST_MESSAGES_URL = "https://www.kimi.com/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages";

  isCurrentPage(): boolean {
    const host = window.location.hostname;
    return host.includes('kimi.ai') || host.includes('moonshot.cn') || host.includes('kimi.com');
  }

  private getAuthTokenFromCookie(): string | null {
    try {
      const n = document.cookie.match(/kimi-auth=([^;]+)/);
      if (n) return `Bearer ${n[1]}`;
    } catch {}
    return null;
  }

  private extractConversationId(): string {
    const n = window.location.href.match(/\/chat\/([^/?#]+)/);
    if (!n) throw new Error("Failed to extract Kimi chat_id from URL");
    return n[1];
  }

  async getMessages(): Promise<Message[]> {
    const chat_id = this.extractConversationId();
    const token = this.getAuthTokenFromCookie();
    if (!token) throw new Error("Failed to get Kimi auth token. Please make sure you are logged in.");

    const response = await fetch(this.DEFAULT_LIST_MESSAGES_URL, {
      method: "POST",
      credentials: "include",
      headers: {
        "accept": "*/*",
        "authorization": token,
        "content-type": "application/json",
        "origin": "https://www.kimi.com",
        "x-msh-platform": "web",
        "x-msh-version": "1.0.0"
      },
      body: JSON.stringify({ chat_id, page_size: 1000 })
    });

    if (!response.ok) throw new Error(`Kimi API request failed: ${response.status}`);
    const data = await response.json();

    return this.convertToMessages(data, chat_id);
  }

  private buildRefMap(blocks: any[], refs: any): Map<string, any> {
    const map = new Map();
    for (const i of refs?.searchChunks ?? []) map.set(String(i.id), i);
    for (const i of refs?.usedSearchChunks ?? []) map.set(String(i.id), i);
    return map;
  }

  private resolveCitations(text: string, refMap: Map<string, any>): string {
    if (!text) return "";
    if (refMap.size === 0) return text.replace(/\[\^\d+\^\]/g, "");
    return text.replace(/\[\^(\d+)\^\]/g, (match, num) => {
      const o = refMap.get(num);
      return o ? ` [${o.base?.siteName || o.base?.title || num}](${o.base?.url})` : "";
    });
  }

  private convertToMessages(data: any, chatId: string): Message[] {
    const rawMessages = data.messages || [];
    const messages: Message[] = [];
    const msgMap = new Map();
    for (const p of rawMessages) msgMap.set(p.id, p);

    // Encontrar el último mensaje (hoja)
    let current = rawMessages.find((m: any) => !rawMessages.some((other: any) => slums(other.parentId) === m.id));
    if (!current && rawMessages.length > 0) current = rawMessages[rawMessages.length - 1];

    const path: any[] = [];
    const seen = new Set();
    let temp = current;
    while (temp && !seen.has(temp.id)) {
      seen.add(temp.id);
      if ((temp.role === "user" || temp.role === "assistant") && temp.status === "MESSAGE_STATUS_COMPLETED") {
        path.push(temp);
      }
      temp = temp.parentId ? msgMap.get(temp.parentId) : null;
    }
    path.reverse();

    for (const m of path) {
      const refMap = this.buildRefMap(m.blocks ?? [], m.refs);
      let contentParts: string[] = [];
      
      for (const block of (m.blocks ?? [])) {
        if (block.text && typeof block.text.content === "string") {
          contentParts.push(this.resolveCitations(block.text.content, refMap));
        }
      }

      messages.push({
        id: m.id,
        role: m.role as Role,
        content: contentParts.join('\n\n').trim(),
        timestamp: new Date(m.createTime).getTime()
      });
    }

    return messages;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    const elements = document.querySelectorAll('[class*="message-wrapper"]');
    elements.forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      container.style.position = 'relative';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      checkbox.dataset.id = `kimi-msg-${index}`;
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
    const titleEl = document.querySelector('[class*="title-text"]') || 
                    document.querySelector('title');
    return titleEl?.textContent?.trim() || 'Kimi Conversation';
  }
}

function slums(id: any) {
  return typeof id === 'string' ? id : id?.id;
}
