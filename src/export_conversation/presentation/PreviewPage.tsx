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
    setTimeout(async () => {
      try {
        await exportService.exportToPdfWithCanvas('preview-content', `${data.title}.pdf`);
        setStatus('done');
      } catch (err) {
        console.error(err);
        setStatus('idle');
        alert('Error generating PDF');
      }
    }, 100);
  };

  if (!data) return <div style="padding: 50px; text-align: center; font-family: sans-serif;">Loading Pro Preview...</div>;

  return (
    <div style="display: flex; flex-direction: column; min-height: 100vh; background: #f3f4f6; font-family: sans-serif;">
      <div style="background: white; padding: 10px 40px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <h2 style="margin:0; font-size: 16px; font-weight: 600; color: #111827;">AI Export Pro Preview</h2>
        
        <div style="display: flex; gap: 12px; align-items: center;">
          {status === 'generating' && (
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 14px; height: 16px; border: 2px solid #eee; border-top: 2px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span style="font-size: 13px; color: #666;">Exporting...</span>
            </div>
          )}
          
          <button 
            onClick={handleDownload} 
            disabled={status === 'generating'}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: status === 'generating' ? 'wait' : 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              transition: 'opacity 0.2s',
              opacity: status === 'generating' ? 0.7 : 1
            }}
          >
            {status === 'generating' ? 'Wait...' : 'Download PDF'}
          </button>
          
          <button 
            onClick={() => window.close()} 
            style="background: white; color: #374151; border: 1px solid #d1d5db; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;"
          >
            Close
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
