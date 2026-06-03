import browser from 'webextension-polyfill';
import { ChatGPTAdapter } from '../export_conversation/infrastructure/adapters/ChatGPTAdapter';
import { ClaudeAdapter } from '../export_conversation/infrastructure/adapters/ClaudeAdapter';
import { GeminiAdapter } from '../export_conversation/infrastructure/adapters/GeminiAdapter';
import { NotebookLMAdapter } from '../export_conversation/infrastructure/adapters/NotebookLMAdapter';
import { PerplexityAdapter } from '../export_conversation/infrastructure/adapters/PerplexityAdapter';
import { KimiAdapter } from '../export_conversation/infrastructure/adapters/KimiAdapter';
import { DeepSeekAdapter } from '../export_conversation/infrastructure/adapters/DeepSeekAdapter';
import { IAAdapter } from '../core/domain/IAAdapter';
import './style.css';

const adapters: IAAdapter[] = [
  new ChatGPTAdapter(),
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new NotebookLMAdapter(),
  new PerplexityAdapter(),
  new KimiAdapter(),
  new DeepSeekAdapter()
];

let activeAdapter: IAAdapter | null = null;
let injectTimer: number | null = null;
let selectionModeEnabled = false;

function scheduleInjection() {
  if (!selectionModeEnabled) return;
  if (injectTimer) {
    window.clearTimeout(injectTimer);
  }
  injectTimer = window.setTimeout(() => {
    activeAdapter?.injectCheckboxes(() => {
      // Notificar al popup si es necesario actualizar la cuenta de seleccionados
      browser.runtime.sendMessage({ action: 'SELECTION_CHANGED', selectedIds: activeAdapter?.getSelectedMessageIds() });
    });
    injectTimer = null;
  }, 150);
}

function init() {
  activeAdapter = adapters.find(a => a.isCurrentPage()) || null;
  if (activeAdapter) {
    console.log('AI Exporter: Adaptador activo:', activeAdapter.constructor.name);
    
    // Observar cambios siempre, pero solo inyectar si el modo está activo
    const observer = new MutationObserver((mutations) => {
      if (!selectionModeEnabled) return;
      
      let shouldInject = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const addedElements = Array.from(mutation.addedNodes).filter(n => n instanceof HTMLElement) as HTMLElement[];
          if (addedElements.some(el => !el.classList.contains('ai-exporter-checkbox'))) {
            shouldInject = true;
            break;
          }
        }
      }
      if (shouldInject) {
        scheduleInjection();
      }
    });

    const target = (activeAdapter instanceof ChatGPTAdapter && document.querySelector('main')) || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }
}

// Escuchar mensajes del Popup
browser.runtime.onMessage.addListener(async (request) => {
  if (request.action === 'GET_MESSAGES') {
    if (activeAdapter) {
      try {
        const messages = await activeAdapter.getMessages();
        const title = activeAdapter.getConversationTitle();
        const selectedIds = activeAdapter.getSelectedMessageIds();
        return { messages, title, selectedIds, selectionModeEnabled };
      } catch (err) {
        console.error('AI Exporter: Error obteniendo mensajes:', err);
        return null;
      }
    } else {
      return null;
    }
  }

  if (request.action === 'TOGGLE_SELECTION_MODE') {
    selectionModeEnabled = request.enabled;
    if (selectionModeEnabled) {
      scheduleInjection();
    } else {
      activeAdapter?.removeCheckboxes();
    }
    return { success: true };
  }

  if (request.action === 'SELECT_ALL') {
    activeAdapter?.selectAll(request.select);
    return { selectedIds: activeAdapter?.getSelectedMessageIds() };
  }
});

// Arrancar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
