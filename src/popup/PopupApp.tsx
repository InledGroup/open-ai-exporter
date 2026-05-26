import { useState, useEffect } from 'preact/hooks';
import { ExportService } from '../export_conversation/application/ExportService';
import { Message } from '../core/domain/entities';

export function PopupApp() {
  const [data, setData] = useState<{ messages: Message[], selectedIds: string[], title: string, selectionModeEnabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const exportService = new ExportService();

  const fetchData = () => {
    setLoading(true);
    setError(null);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        setError('Active tab not found.');
        setLoading(false);
        return;
      }

      chrome.tabs.sendMessage(tabId, { action: 'GET_MESSAGES' }, (response) => {
        if (chrome.runtime.lastError) {
          setError(`Connection error: Please refresh the chat page.`);
          setLoading(false);
          return;
        }
        
        if (!response) {
          setError('This page is not a compatible chat or no messages were detected.');
        } else {
          setData(response);
        }
        setLoading(false);
      });
    });
  };

  useEffect(() => {
    fetchData();

    // Escuchar cambios de selección en tiempo real
    const messageListener = (request: any) => {
      if (request.action === 'SELECTION_CHANGED') {
        setData(prev => prev ? { ...prev, selectedIds: request.selectedIds } : null);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const toggleSelectionMode = () => {
    if (!data) return;
    const nextMode = !data.selectionModeEnabled;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_SELECTION_MODE', enabled: nextMode }, () => {
          setData({ ...data, selectionModeEnabled: nextMode, selectedIds: nextMode ? data.selectedIds : [] });
        });
      }
    });
  };

  const handleSelectAll = (select: boolean) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'SELECT_ALL', select }, (response) => {
          if (response?.selectedIds) {
            setData(prev => prev ? { ...prev, selectedIds: response.selectedIds } : null);
          }
        });
      }
    });
  };

  const handleExport = (type: 'md' | 'pdf_advanced', onlySelected: boolean) => {
    if (!data || data.messages.length === 0) return;

    let messagesToExport = data.messages;
    if (onlySelected && data.selectedIds.length > 0) {
      messagesToExport = data.messages.filter(m => data.selectedIds.includes(m.id));
    }

    if (type === 'md') {
      const content = exportService.toMarkdown(messagesToExport, data.title);
      exportService.downloadFile(content, `${data.title}.md`, 'text/markdown');
    } else {
      chrome.storage.local.set({ 
        export_preview_data: { messages: messagesToExport, title: data.title } 
      }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('preview.html') });
        window.close();
      });
    }
  };

  if (loading) return (
    <div class="p-4 w-64 bg-white text-center">
      <p>Loading messages...</p>
    </div>
  );

  if (error) return (
    <div class="p-4 w-64 bg-white">
      <p class="text-red-600 mb-4 text-sm">{error}</p>
      <button onClick={fetchData} class="w-full bg-gray-200 py-2 rounded text-sm">Retry</button>
    </div>
  );

  return (
    <div class="p-4 w-64 bg-white">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-lg font-bold">AI Exporter</h1>
        <button 
          onClick={toggleSelectionMode}
          class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            data?.selectionModeEnabled 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}
        >
          {data?.selectionModeEnabled ? 'Mode: ON' : 'Mode: OFF'}
        </button>
      </div>
      
      <div class="space-y-2">
        {data?.selectionModeEnabled && (
          <div class="flex gap-2 mb-2">
            <button 
              onClick={() => handleSelectAll(true)}
              class="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-200 py-1 rounded text-xs font-medium"
            >
              Select All
            </button>
            <button 
              onClick={() => handleSelectAll(false)}
              class="flex-1 bg-stone-50 text-stone-700 border border-stone-200 py-1 rounded text-xs font-medium"
            >
              Clear
            </button>
          </div>
        )}

        <button 
          onClick={() => handleExport('md', false)}
          class="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
        >
          Export All (Markdown)
        </button>
        
        <button 
          onClick={() => handleExport('pdf_advanced', false)}
          class="w-full bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm"
        >
          Export All (PDF Pro)
        </button>

        <hr />

        <button 
          disabled={!data || data.selectedIds.length === 0}
          onClick={() => handleExport('md', true)}
          class="w-full border border-blue-600 text-blue-600 px-3 py-2 rounded hover:bg-blue-50 disabled:opacity-50 text-sm"
        >
          Selected ({data?.selectedIds.length || 0}) (MD)
        </button>

        <button 
          disabled={!data || data.selectedIds.length === 0}
          onClick={() => handleExport('pdf_advanced', true)}
          class="w-full border border-red-600 text-red-600 px-3 py-2 rounded hover:bg-red-50 disabled:opacity-50 text-sm"
        >
          Selected ({data?.selectedIds.length || 0}) (PDF Pro)
        </button>
      </div>
    </div>
  );
}
