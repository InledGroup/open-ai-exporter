import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ExportService } from '../application/ExportService';
import { Message } from '../../core/domain/entities';

export function PreviewPage() {
  const [data, setData] = useState<{ messages: Message[], title: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');
  const exportService = new ExportService();

  useEffect(() => {
    chrome.storage.local.get(['export_preview_data'], (result) => {
      if (result.export_preview_data) {
        setData(result.export_preview_data);
      }
    });
  }, []);

  const handleDownload = async () => {
    if (!data) return;
    setStatus('generating');
    // Pequeño delay para permitir que el spinner se renderice
    setTimeout(async () => {
      try {
        await exportService.exportToPdfWithCanvas('preview-content', `${data.title}.pdf`);
        setStatus('done');
      } catch (err) {
        console.error(err);
        setStatus('idle');
        alert('Error al generar el PDF');
      }
    }, 100);
  };

  if (!data) return <div style="padding: 50px; text-align: center;">Cargando previsualización...</div>;

  return (
    <div style="display: flex; flex-direction: column; min-height: 100vh; background: #f3f4f6;">
      <div style="background: white; padding: 10px 40px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <h2 style="margin:0; font-size: 18px; color: #111827; font-family: sans-serif;">Previsualización Pro</h2>
        <div style="display: flex; gap: 10px; align-items: center;">
          {status === 'generating' && (
            <div style="display: flex; align-items: center; gap: 10px; margin-right: 15px;">
              <div style="width: 20px; height: 20px; border: 3px solid #eee; border-top: 3px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span style="font-size: 14px; color: #666; font-family: sans-serif;">Procesando...</span>
            </div>
          )}
          <button 
            onClick={handleDownload} 
            disabled={status === 'generating'}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: status === 'generating' ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              fontFamily: 'sans-serif',
              opacity: status === 'generating' ? 0.7 : 1
            }}
          >
            {status === 'generating' ? 'Generando...' : 'Descargar PDF'}
          </button>
          <button 
            onClick={() => window.close()} 
            style="background: white; color: #374151; border: 1px solid #d1d5db; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-family: sans-serif;"
          >
            Cerrar
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      <div style="flex: 1; padding: 40px 20px; display: flex; justify-content: center;">
        <div id="preview-content" style="width: 100%; max-width: 900px;" dangerouslySetInnerHTML={{ __html: exportService.generatePreviewHtml(data.messages, data.title) }} />
      </div>
    </div>
  );
}

const container = document.getElementById('preview-app');
if (container) {
  render(<PreviewPage />, container);
}
