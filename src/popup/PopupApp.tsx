import { useState, useEffect } from 'preact/hooks';
import { ExportService } from '../export_conversation/application/ExportService';
import { Message } from '../core/domain/entities';

export function PopupApp() {
  const [data, setData] = useState<{ messages: Message[], selectedIds: string[], title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const exportService = new ExportService();

  const fetchData = () => {
    setLoading(true);
    setError(null);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        setError('No se pudo encontrar la pestaña activa.');
        setLoading(false);
        return;
      }

      // Enviar mensaje con timeout manual para evitar colgarse
      chrome.tabs.sendMessage(tabId, { action: 'GET_MESSAGES' }, (response) => {
        if (chrome.runtime.lastError) {
          setError(`Error de conexión: ${chrome.runtime.lastError.message}. Por favor, refresca la página del chat.`);
          setLoading(false);
          return;
        }
        
        if (!response) {
          setError('Esta página no es un chat compatible o no se detectaron mensajes.');
        } else {
          setData(response);
        }
        setLoading(false);
      });
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExport = (type: 'md' | 'pdf', onlySelected: boolean) => {
    if (!data || data.messages.length === 0) return;

    let messagesToExport = data.messages;
    if (onlySelected && data.selectedIds.length > 0) {
      messagesToExport = data.messages.filter(m => data.selectedIds.includes(m.id));
    }

    if (type === 'md') {
      const content = exportService.toMarkdown(messagesToExport, data.title);
      exportService.downloadFile(content, `${data.title}.md`, 'text/markdown');
    } else {
      const content = exportService.toPdfHtml(messagesToExport, data.title);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(content);
        win.document.close();
      }
    }
  };

  if (loading) return (
    <div class="p-4 w-64 bg-white text-center">
      <div class="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
      <p>Cargando mensajes...</p>
    </div>
  );

  if (error) return (
    <div class="p-4 w-64 bg-white">
      <p class="text-red-600 mb-4">{error}</p>
      <button onClick={fetchData} class="w-full bg-gray-200 py-2 rounded">Reintentar</button>
    </div>
  );

  return (
    <div class="p-4 w-64 bg-white">
      <h1 class="text-lg font-bold mb-4">AI Exporter</h1>
      
      <div class="space-y-2">
        <button 
          disabled={!data || data.messages.length === 0}
          onClick={() => handleExport('md', false)}
          class="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Exportar Todo (MD)
        </button>
        
        <button 
          disabled={!data || data.messages.length === 0}
          onClick={() => handleExport('pdf', false)}
          class="w-full bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          Exportar Todo (PDF)
        </button>

        <hr />

        <button 
          disabled={!data || data.selectedIds.length === 0}
          onClick={() => handleExport('md', true)}
          class="w-full border border-blue-600 text-blue-600 px-3 py-2 rounded hover:bg-blue-50 disabled:opacity-50"
        >
          Exportar Seleccionados ({data?.selectedIds.length || 0}) (MD)
        </button>

        <button 
          disabled={!data || data.selectedIds.length === 0}
          onClick={() => handleExport('pdf', true)}
          class="w-full border border-red-600 text-red-600 px-3 py-2 rounded hover:bg-red-50 disabled:opacity-50"
        >
          Exportar Seleccionados ({data?.selectedIds.length || 0}) (PDF)
        </button>
      </div>
    </div>
  );
}
