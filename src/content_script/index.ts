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
  new NotebookLMAdapter()
];

let activeAdapter: IAAdapter | null = null;
let injectTimer: number | null = null;

function scheduleInjection() {
  if (injectTimer) {
    window.clearTimeout(injectTimer);
  }
  injectTimer = window.setTimeout(() => {
    activeAdapter?.injectCheckboxes(() => {
      // Opcional: manejar cambios de selección si es necesario
    });
    injectTimer = null;
  }, 300); // Un poco más de tiempo para ser conservadores
}

function init() {
  activeAdapter = adapters.find(a => a.isCurrentPage()) || null;
  if (activeAdapter) {
    console.log('AI Exporter: Adaptador activo:', activeAdapter.constructor.name);
    
    // Inyección inicial
    scheduleInjection();

    // Observar cambios
    const observer = new MutationObserver((mutations) => {
      let shouldInject = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Si se añadieron nodos que no son nuestros checkboxes, re-inyectar
          const addedElements = Array.from(mutation.addedNodes).filter(n => n instanceof HTMLElement) as HTMLElement[];
          if (addedElements.some(el => !el.classList.contains('capture-my-checkbox'))) {
            shouldInject = true;
            break;
          }
        }
      }
      if (shouldInject) {
        scheduleInjection();
      }
    });

    // Para ChatGPT, observar 'main' es más eficiente si existe
    const target = (activeAdapter instanceof ChatGPTAdapter && document.querySelector('main')) || document.body;
    observer.observe(target, { childList: true, subtree: true });

    // Fallback: si es ChatGPT y no había main, esperar a que aparezca
    if (activeAdapter instanceof ChatGPTAdapter && target === document.body) {
      const mainWaiter = new MutationObserver(() => {
        const main = document.querySelector('main');
        if (main) {
          mainWaiter.disconnect();
          observer.disconnect();
          observer.observe(main, { childList: true, subtree: true });
          scheduleInjection();
        }
      });
      mainWaiter.observe(document.body, { childList: true, subtree: true });
    }
  }
}

// Escuchar mensajes del Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_MESSAGES') {
    if (activeAdapter) {
      const messages = activeAdapter.getMessages();
      const title = activeAdapter.getConversationTitle();
      const selectedIds = activeAdapter.getSelectedMessageIds();
      sendResponse({ messages, title, selectedIds });
    } else {
      sendResponse(null);
    }
    return true;
  }
});

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
