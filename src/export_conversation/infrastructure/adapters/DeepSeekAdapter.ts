import { IAAdapter } from '../../../core/domain/IAAdapter';
import { Message, Role } from '../../../core/domain/entities';

export class DeepSeekAdapter implements IAAdapter {
  private readonly CHECKBOX_CLASS = 'ai-exporter-checkbox';

  isCurrentPage(): boolean {
    return window.location.hostname.includes('deepseek.com');
  }

  private getUserToken(): string | null {
    try {
      const e = localStorage.getItem("userToken");
      return e ? JSON.parse(e)?.value || null : null;
    } catch {
      return null;
    }
  }

  private extractConversationId(): string {
    const n = window.location.href.match(/\/a\/chat\/s\/([a-f0-9-]+)/);
    if (!n) throw new Error("无法从URL中提取 chat_session_id");
    return n[1];
  }

  async getMessages(): Promise<Message[]> {
    const conversationId = this.extractConversationId();
    const token = this.getUserToken();
    if (!token) throw new Error("无法获取 userToken，请确保已登录后重试");

    const url = `https://chat.deepseek.com/api/v0/chat/history_messages?chat_session_id=${conversationId}&cache_version=0`;
    
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error(`HTTP请求失败: ${response.status}`);
    const data = await response.json();

    return this.convertResponseToMessages(data, conversationId);
  }

  private convertResponseToMessages(e: any, n: string): Message[] {
    const r: Message[] = [];
    const i = e.data?.biz_data?.chat_messages || [];
    const o = e.data?.biz_data?.chat_session;
    const u = new Map();
    
    for (const p of i) u.set(p.message_id, p);
    
    const l = o?.current_message_id;
    if (l == null) return r;
    
    const c: any[] = [];
    let f = l;
    while (f !== null) {
      const p = u.get(f);
      if (!p) break;
      c.push(p);
      f = p.parent_id;
    }
    c.reverse();

    for (const p of c) {
      if (p.status !== "FINISHED") continue;
      const role: Role = p.role === "USER" ? "user" : "assistant";
      let content = p.content || "";
      
      // Manejar contenido de razonamiento (thinking) con una estructura HTML estirable
      if (p.thinking_content && p.thinking_content.trim()) {
        const thinkingHtml = `<div class="thinking-section">
          <div class="thinking-header">Proceso de razonamiento</div>
          <div class="thinking-content">${p.thinking_content.trim()}</div>
        </div>`;
        content = `${thinkingHtml}\n\n${content}`;
      }

      if (p.files && p.files.length > 0) {
        const filesInfo = p.files.map((s: any) => `[文件: ${s.file_name}]`).join('\n');
        content = `${filesInfo}\n\n${content}`;
      }

      r.push({
        id: `${n}_${p.message_id}`,
        role,
        content: content.trim()
      });
    }
    return r;
  }

  injectCheckboxes(onSelectionChange: (selectedIds: string[]) => void): void {
    // Usamos el selector encontrado en el código fuente para inyectar en la barra de acciones
    const elements = document.querySelectorAll('._965abe9, .ds-flex.ds-flex-col.ds-gap-4');
    elements.forEach((el, index) => {
      if (el.querySelector(`.${this.CHECKBOX_CLASS}`)) return;

      const container = el as HTMLElement;
      container.style.position = 'relative';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = this.CHECKBOX_CLASS;
      // El ID aquí debe coincidir con el ID generado en getMessages si es posible, 
      // pero como getMessages es dinámico y asíncrono, usaremos un ID basado en el índice 
      // o buscaremos el ID del mensaje en el DOM si DeepSeek lo expone.
      checkbox.dataset.id = `deepseek-msg-${index}`;
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
    const titleEl = document.querySelector('.ds-flex.ds-items-center.ds-overflow-hidden.ds-text-ellipsis') || 
                    document.querySelector('title');
    return titleEl?.textContent?.trim() || 'DeepSeek Conversation';
  }
}
