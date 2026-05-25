import { ChatGPTAdapter } from '../export_conversation/infrastructure/adapters/ChatGPTAdapter';
import { ClaudeAdapter } from '../export_conversation/infrastructure/adapters/ClaudeAdapter';
import { GeminiAdapter } from '../export_conversation/infrastructure/adapters/GeminiAdapter';
import { NotebookLMAdapter } from '../export_conversation/infrastructure/adapters/NotebookLMAdapter';
import { IAAdapter } from '../core/domain/IAAdapter';
import './style.css';

const adapters: IAAdapter[] = [
  new ChatGPTAdapter(),
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new NotebookLMAdapter(),
];

let activeAdapter: IAAdapter | null = null;

function init() {
  activeAdapter = adapters.find(a => a.isCurrentPage()) || null;
  if (activeAdapter) {
    console.log('AI Exporter: Adaptador activo encontrado.');
    // Inyección inicial y observador de cambios en el DOM
    activeAdapter.injectCheckboxes(() => {
      // Opcional: Notificar al popup si está abierto
    });

    const observer = new MutationObserver(() => {
      activeAdapter?.injectCheckboxes(() => {});
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Escuchar mensajes del Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('AI Exporter: Mensaje recibido:', request.action);
  
  if (!activeAdapter) {
    console.warn('AI Exporter: No hay adaptador activo para esta página.');
    sendResponse(null);
    return true;
  }

  if (request.action === 'GET_MESSAGES') {
    try {
      const allMessages = activeAdapter.getMessages();
      const selectedIds = activeAdapter.getSelectedMessageIds();
      console.log(`AI Exporter: Enviando ${allMessages.length} mensajes (${selectedIds.length} seleccionados).`);
      sendResponse({ 
        messages: allMessages, 
        selectedIds,
        title: activeAdapter.getConversationTitle() 
      });
    } catch (err) {
      console.error('AI Exporter: Error obteniendo mensajes:', err);
      sendResponse(null);
    }
  }
  return true;
});

init();
