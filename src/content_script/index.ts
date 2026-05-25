import { ChatGPTAdapter } from '../export_conversation/infrastructure/adapters/ChatGPTAdapter';
import { ClaudeAdapter } from '../export_conversation/infrastructure/adapters/ClaudeAdapter';
import { GeminiAdapter } from '../export_conversation/infrastructure/adapters/GeminiAdapter';
import { NotebookLMAdapter } from '../export_conversation/infrastructure/adapters/NotebookLMAdapter';
import { ExportService } from '../export_conversation/application/ExportService';
import { IAAdapter } from '../core/domain/IAAdapter';
import './style.css';

const adapters: IAAdapter[] = [
  new ChatGPTAdapter(),
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new NotebookLMAdapter(),
];

const exportService = new ExportService();
let activeAdapter: IAAdapter | null = null;

function init() {
  activeAdapter = adapters.find(a => a.isCurrentPage()) || null;
  if (activeAdapter) {
    console.log('AI Exporter: Adaptador activo encontrado:', activeAdapter.constructor.name);
    activeAdapter.injectCheckboxes(() => {});

    const observer = new MutationObserver(() => {
      activeAdapter?.injectCheckboxes(() => {});
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Escuchar mensajes del Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!activeAdapter) {
    sendResponse(null);
    return true;
  }

  if (request.action === 'GET_MESSAGES') {
    const allMessages = activeAdapter.getMessages();
    const selectedIds = activeAdapter.getSelectedMessageIds();
    sendResponse({ 
      messages: allMessages, 
      selectedIds,
      title: activeAdapter.getConversationTitle() 
    });
  }

  if (request.action === 'EXPORT_PDF_ADVANCED') {
    const { messages, title } = request.data;
    showAdvancedPreview(messages, title);
    sendResponse({ success: true });
  }
  
  return true;
});

function showAdvancedPreview(messages: any[], title: string) {
  // Crear overlay
  const overlay = document.createElement('div');
  overlay.id = 'ai-exporter-modal-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); z-index: 2147483647;
    display: flex; justify-content: center; align-items: center;
    overflow-y: auto; padding: 20px;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white; border-radius: 12px; max-width: 1000px; width: 90%;
    max-height: 90vh; display: flex; flex-direction: column; position: relative;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    padding: 15px 20px; border-bottom: 1px solid #eee;
    display: flex; justify-content: space-between; align-items: center;
  `;
  header.innerHTML = `
    <h2 style="margin:0; font-size: 18px;">Previsualización de Exportación</h2>
    <div>
      <button id="ai-exporter-btn-download" style="background:#2563eb; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; margin-right:10px;">Descargar PDF</button>
      <button id="ai-exporter-btn-close" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer;">Cerrar</button>
    </div>
  `;

  const body = document.createElement('div');
  body.id = 'ai-exporter-preview-body';
  body.style.cssText = `flex: 1; overflow-y: auto; padding: 20px; background: #f3f4f6;`;
  body.innerHTML = exportService.generatePreviewHtml(messages, title);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Eventos
  document.getElementById('ai-exporter-btn-close')?.addEventListener('click', () => {
    overlay.remove();
  });

  document.getElementById('ai-exporter-btn-download')?.addEventListener('click', async () => {
    const btn = document.getElementById('ai-exporter-btn-download') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Generando...';
    await exportService.exportToPdfWithCanvas('ai-exporter-preview-container', `${title}.pdf`);
    btn.disabled = false;
    btn.textContent = 'Descargar PDF';
  });
}

init();
