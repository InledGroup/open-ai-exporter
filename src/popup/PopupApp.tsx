import { useState, useEffect } from "preact/hooks";
import { ExportService } from "../export_conversation/application/ExportService";
import { Message } from "../core/domain/entities";
import {
  FileText,
  Download,
  CheckSquare,
  MousePointer2,
  RotateCcw,
  CheckCircle2,
} from "lucide-preact";

export function PopupApp() {
  const [data, setData] = useState<{
    messages: Message[];
    selectedIds: string[];
    title: string;
    selectionModeEnabled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const exportService = new ExportService();

  const fetchData = () => {
    setLoading(true);
    setError(null);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        setError("Pestaña no encontrada.");
        setLoading(false);
        return;
      }

      chrome.tabs.sendMessage(tabId, { action: "GET_MESSAGES" }, (response) => {
        if (chrome.runtime.lastError) {
          setError(`Error de conexión: Recarga la página.`);
          setLoading(false);
          return;
        }

        if (!response) {
          setError("Página no compatible o no hay mensajes.");
        } else {
          setData(response);
        }
        setLoading(false);
      });
    });
  };

  useEffect(() => {
    fetchData();

    const messageListener = (request: any) => {
      if (request.action === "SELECTION_CHANGED") {
        setData((prev) =>
          prev ? { ...prev, selectedIds: request.selectedIds } : null,
        );
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
        chrome.tabs.sendMessage(
          tabId,
          { action: "TOGGLE_SELECTION_MODE", enabled: nextMode },
          () => {
            setData({
              ...data,
              selectionModeEnabled: nextMode,
              selectedIds: nextMode ? data.selectedIds : [],
            });
          },
        );
      }
    });
  };

  const handleSelectAll = (select: boolean) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(
          tabId,
          { action: "SELECT_ALL", select },
          (response) => {
            if (response?.selectedIds) {
              setData((prev) =>
                prev ? { ...prev, selectedIds: response.selectedIds } : null,
              );
            }
          },
        );
      }
    });
  };

  const handleExport = (type: "md" | "pdf_advanced", onlySelected: boolean) => {
    if (!data || data.messages.length === 0) return;

    let messagesToExport = data.messages;
    if (onlySelected && data.selectedIds.length > 0) {
      messagesToExport = data.messages.filter((m) =>
        data.selectedIds.includes(m.id),
      );
    }

    if (type === "md") {
      const content = exportService.toMarkdown(messagesToExport, data.title);
      exportService.downloadFile(content, `${data.title}.md`, "text/markdown");
    } else {
      chrome.storage.local.set(
        {
          export_preview_data: {
            messages: messagesToExport,
            title: data.title,
          },
        },
        () => {
          chrome.tabs.create({ url: chrome.runtime.getURL("preview.html") });
          window.close();
        },
      );
    }
  };

  if (loading)
    return (
      <div className="popup-container loading-state">
        <div className="spinner-green"></div>
        <p>Buscando mensajes...</p>
      </div>
    );

  if (error)
    return (
      <div className="popup-container error-state">
        <p className="error-text">{error}</p>
        <button onClick={fetchData} className="btn-retry">
          <RotateCcw size={14} /> Reintentar
        </button>
      </div>
    );

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="header-logo-container">
          <img src="aiexporter.png" className="app-logo" alt="logo" />
          <h1 className="app-title">AI Exporter Pro</h1>
        </div>
        <button
          onClick={toggleSelectionMode}
          className={`mode-badge ${data?.selectionModeEnabled ? "mode-active" : "mode-inactive"}`}
        >
          {data?.selectionModeEnabled ? (
            <CheckCircle2 size={12} />
          ) : (
            <MousePointer2 size={12} />
          )}
          <span>
            {data?.selectionModeEnabled ? "MODO SELECCIÓN" : "SELECCIÓN"}
          </span>
        </button>
      </header>

      <div className="popup-body">
        {data?.selectionModeEnabled && (
          <div className="selection-controls animate-fade-in">
            <button
              onClick={() => handleSelectAll(true)}
              className="btn-control"
            >
              <CheckSquare size={13} /> Todo
            </button>
            <button
              onClick={() => handleSelectAll(false)}
              className="btn-control"
            >
              <RotateCcw size={13} /> Limpiar
            </button>
          </div>
        )}

        <div className="export-grid">
          <button
            onClick={() => handleExport("md", false)}
            className="export-card group"
          >
            <Download size={20} className="card-icon" />
            <span className="card-label">TODO (.MD)</span>
          </button>

          <button
            onClick={() => handleExport("pdf_advanced", false)}
            className="export-card group"
          >
            <FileText size={20} className="card-icon" />
            <span className="card-label">TODO (.PDF)</span>
          </button>
        </div>

        {(data?.selectionModeEnabled ||
          (data?.selectedIds.length || 0) > 0) && (
          <div className="selection-export animate-slide-up">
            <div className="selection-summary">
              Seleccionados ({data?.selectedIds.length})
            </div>
            <div className="btn-group">
              <button
                disabled={!data || data.selectedIds.length === 0}
                onClick={() => handleExport("md", true)}
                className="btn-action primary"
              >
                <Download size={14} /> MD
              </button>
              <button
                disabled={!data || data.selectedIds.length === 0}
                onClick={() => handleExport("pdf_advanced", true)}
                className="btn-action primary"
              >
                <FileText size={14} /> PDF PRO
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="popup-footer">
        <p>AI Exporter Pro • </p>
      </footer>

      <style>{`
        :root {
          --primary: #3ac200;
          --primary-hover: #32a800;
          --bg-gray: #f9fafb;
          --border: #e5e7eb;
          --text-dark: #1f2937;
          --text-muted: #6b7280;
        }

        .popup-container {
          width: 280px;
          padding: 16px;
          background: white;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        .loading-state, .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 12px;
          min-height: 150px;
        }

        .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header-logo-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .app-logo {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          object-fit: contain;
        }

        .app-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-dark);
          margin: 0;
        }

        .mode-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .mode-inactive {
          background: #f3f4f6;
          color: var(--text-muted);
          border-color: var(--border);
        }

        .mode-active {
          background: #ecfdf5;
          color: var(--primary);
          border-color: #3ac20044;
        }

        .selection-controls {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .btn-control {
          flex: 1;
          background: white;
          border: 1px solid var(--border);
          padding: 6px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-control:hover { background: #f9fafb; }

        .export-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .export-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-card:hover {
          background: white;
          border-color: var(--primary);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          transform: translateY(-1px);
        }

        .card-icon {
          color: #9ca3af;
          transition: color 0.2s;
        }

        .export-card:hover .card-icon { color: var(--primary); }

        .card-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
        }

        .selection-export {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .selection-summary {
          font-size: 10px;
          font-weight: 800;
          color: #9ca3af;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .btn-group {
          display: flex;
          gap: 8px;
        }

        .btn-action {
          flex: 1;
          padding: 8px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .primary {
          background: var(--primary);
          color: white;
        }

        .primary:hover {
          background: var(--primary-hover);
          box-shadow: 0 4px 12px rgba(58, 194, 0, 0.25);
        }

        .primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .btn-retry {
          background: #f3f4f6;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .error-text {
          color: #ef4444;
          font-size: 12px;
          font-weight: 500;
          margin: 0;
        }

        .popup-footer {
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
          text-align: center;
        }

        .popup-footer p {
          font-size: 10px;
          color: #d1d5db;
          font-weight: 600;
          margin: 0;
        }

        .spinner-green {
          width: 24px;
          height: 24px;
          border: 3px solid #f3f4f6;
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        .animate-slide-up { animation: slideUp 0.25s ease-out; }
      `}</style>
    </div>
  );
}
