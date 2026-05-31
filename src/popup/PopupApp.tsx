import { useState, useEffect } from "preact/hooks";
import { ExportService } from "../export_conversation/application/ExportService";
import { Message } from "../core/domain/entities";
import {
  FileText,
  CheckSquare,
  MousePointer2,
  RotateCcw,
  CheckCircle2,
  FileJson,
  FileType,
  FileCode,
  FileOutput,
  Github,
  Star,
  ExternalLink,
} from "lucide-preact";

type ExportType = "md" | "pdf_advanced" | "word" | "json" | "txt";

export function PopupApp() {
  const [data, setData] = useState<{
    messages: Message[];
    selectedIds: string[];
    title: string;
    selectionModeEnabled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportType | null>(null);
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
          setError(`Connection error. Please, reload the page.`);
          setLoading(false);
          return;
        }

        if (!response) {
          setError(
            "No compatible website. Please, contact us if you need support for this website.",
          );
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

  const handleExport = async (type: ExportType, onlySelected: boolean) => {
    if (!data || data.messages.length === 0) return;

    let messagesToExport = data.messages;
    if (onlySelected && data.selectedIds.length > 0) {
      messagesToExport = data.messages.filter((m) =>
        data.selectedIds.includes(m.id),
      );
    }

    if (type === "pdf_advanced") {
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
      return;
    }

    setExporting(type);
    try {
      if (type === "md") {
        const content = exportService.toMarkdown(messagesToExport, data.title);
        exportService.downloadFile(
          content,
          `${data.title}.md`,
          "text/markdown",
        );
      } else if (type === "json") {
        const content = exportService.toJSON(messagesToExport);
        exportService.downloadFile(
          content,
          `${data.title}.json`,
          "application/json",
        );
      } else if (type === "txt") {
        const content = exportService.toText(messagesToExport, data.title);
        exportService.downloadFile(content, `${data.title}.txt`, "text/plain");
      } else if (type === "word") {
        const blob = await exportService.toWord(messagesToExport, data.title);
        exportService.downloadFile(
          blob,
          `${data.title}.docx`,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
      }
      setTimeout(() => setExporting(null), 1500);
    } catch (err) {
      console.error(err);
      setExporting(null);
      alert("Error al exportar");
    }
  };

  if (loading)
    return (
      <div className="popup-container loading-state">
        <div className="spinner-green"></div>
        <p>Searching messages...</p>
      </div>
    );

  if (error)
    return (
      <div className="popup-container error-state">
        <p className="error-text">{error}</p>
        <button onClick={fetchData} className="btn-retry">
          <RotateCcw size={14} /> Retry
        </button>
      </div>
    );

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="header-logo-container">
          <img src="aiexporter.png" className="app-logo" alt="logo" />
          <h1 className="app-title">AI Exporter</h1>
        </div>
      </header>

      <div className="popup-body">
        <div className="export-grid">
          <button
            onClick={() => handleExport("md", false)}
            disabled={!!exporting}
            className="export-card"
          >
            <FileCode size={18} className="card-icon" />
            <span className="card-label">MD</span>
          </button>

          <button
            onClick={() => handleExport("pdf_advanced", false)}
            disabled={!!exporting}
            className="export-card"
          >
            <FileOutput size={18} className="card-icon" />
            <span className="card-label">PDF</span>
          </button>

          <button
            onClick={() => handleExport("word", false)}
            disabled={!!exporting}
            className="export-card"
          >
            {exporting === "word" ? (
              <div className="spinner-small" />
            ) : (
              <FileText size={18} className="card-icon" />
            )}
            <span className="card-label">WORD</span>
          </button>

          <button
            onClick={() => handleExport("json", false)}
            disabled={!!exporting}
            className="export-card"
          >
            <FileJson size={18} className="card-icon" />
            <span className="card-label">JSON</span>
          </button>

          <button
            onClick={() => handleExport("txt", false)}
            disabled={!!exporting}
            className="export-card"
          >
            <FileType size={18} className="card-icon" />
            <span className="card-label">TXT</span>
          </button>

          <button
            onClick={toggleSelectionMode}
            className={`filter-toggle-btn ${data?.selectionModeEnabled ? "active" : ""}`}
          >
            {data?.selectionModeEnabled ? (
              <>
                <CheckCircle2 size={14} />
                <span>Filtering enabled</span>
              </>
            ) : (
              <>
                <MousePointer2 size={14} />
                <span>Filter messages to export</span>
              </>
            )}
          </button>
        </div>

        {data?.selectionModeEnabled && (
          <div className="selection-section animate-slide-up">
            <div className="selection-controls">
              <button
                onClick={() => handleSelectAll(true)}
                className="btn-control"
              >
                <CheckSquare size={13} /> Select all
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="btn-control"
              >
                <RotateCcw size={13} /> Clear
              </button>
            </div>

            <div className="selection-export">
              <div className="selection-summary">
                Selected messages ({data?.selectedIds.length})
              </div>
              <div className="export-grid mini">
                <button
                  disabled={
                    !data || data.selectedIds.length === 0 || !!exporting
                  }
                  onClick={() => handleExport("md", true)}
                  className="btn-action primary"
                >
                  <FileCode size={12} /> MD
                </button>
                <button
                  disabled={
                    !data || data.selectedIds.length === 0 || !!exporting
                  }
                  onClick={() => handleExport("word", true)}
                  className="btn-action primary"
                >
                  {exporting === "word" ? (
                    <div className="spinner-small white" />
                  ) : (
                    <FileText size={12} />
                  )}{" "}
                  WORD
                </button>
                <button
                  disabled={
                    !data || data.selectedIds.length === 0 || !!exporting
                  }
                  onClick={() => handleExport("pdf_advanced", true)}
                  className="btn-action primary"
                >
                  <FileOutput size={12} /> PDF
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="cta-section">
          <p className="cta-title">Help us grow! 🚀</p>
          <p className="cta-text">
            Contribute features, suggestions or give us a star on GitHub.
          </p>
          <a
            href="https://github.com/InledGroup/open-ai-exporter"
            target="_blank"
            className="cta-button"
          >
            <Github size={14} />
            <span>GitHub</span>
            <Star size={14} className="star-icon" />
          </a>
        </div>
      </div>

      <footer className="popup-footer">
        <p>AI Exporter • v1.0</p>
      </footer>

      <style>{`
        :root {
          --primary: #3ac200;
          --primary-hover: #32a800;
          --bg-gray: #f9fafb;
          --border: #e5e7eb;
          --text-dark: #1f2937;
          --text-muted: #6b7280;
          --cta-bg: #f0fdf4;
          --cta-border: #dcfce7;
          --cta-text: #166534;
        }

        .popup-container {
          width: 320px;
          padding: 20px;
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
          min-height: 200px;
        }

        .popup-header {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-logo-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .app-logo {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          object-fit: contain;
        }

        .app-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-dark);
          margin: 0;
          letter-spacing: -0.02em;
        }

        .export-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .export-grid.mini {
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .export-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          padding: 12px 4px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-card:hover:not(:disabled) {
          background: white;
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transform: translateY(-2px);
        }

        .export-card:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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

        .filter-toggle-btn {
          grid-column: span 3;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--border);
          background: #f9fafb;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .filter-toggle-btn:hover {
          border-color: var(--primary);
          background: white;
          color: var(--primary);
        }

        .filter-toggle-btn.active {
          background: #ecfdf5;
          color: var(--primary);
          border-color: #3ac20066;
          box-shadow: inset 0 2px 4px rgba(58, 194, 0, 0.05);
        }

        .selection-section {
          margin-top: 16px;
          border-top: 1px dashed var(--border);
          padding-top: 16px;
        }

        .selection-controls {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }

        .btn-control {
          flex: 1;
          background: white;
          border: 1px solid var(--border);
          padding: 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-dark);
        }

        .btn-control:hover { 
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .selection-export {
          background: #f8fafc;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #f1f5f9;
        }

        .selection-summary {
          font-size: 10px;
          font-weight: 800;
          color: #9ca3af;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .btn-action {
          padding: 10px 4px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 10px;
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

        .primary:hover:not(:disabled) {
          background: var(--primary-hover);
          box-shadow: 0 4px 12px rgba(58, 194, 0, 0.3);
        }

        .primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cta-section {
          margin-top: 24px;
          padding: 16px;
          background: var(--cta-bg);
          border: 1px solid var(--cta-border);
          border-radius: 16px;
          text-align: center;
        }

        .cta-title {
          font-size: 13px;
          font-weight: 800;
          color: var(--cta-text);
          margin: 0 0 6px 0;
        }

        .cta-text {
          font-size: 11px;
          color: #15803d;
          margin: 0 0 14px 0;
          line-height: 1.5;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--cta-text);
          color: white;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.2s;
        }

        .cta-button:hover {
          background: #14532d;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(20, 83, 45, 0.2);
        }

        .star-icon {
          color: #fde047;
          fill: #fde047;
        }

        .popup-footer {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;
          text-align: center;
        }

        .popup-footer p {
          font-size: 10px;
          color: #9ca3af;
          font-weight: 600;
          margin: 0;
        }

        .btn-retry {
          background: #f3f4f6;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .error-text {
          color: #ef4444;
          font-size: 13px;
          font-weight: 600;
          margin: 0;
        }

        .spinner-green {
          width: 32px;
          height: 32px;
          border: 4px solid #f3f4f6;
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spinner-small {
          width: 14px;
          height: 14px;
          border: 2px solid #f3f4f6;
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .spinner-small.white {
          border-color: rgba(255,255,255,0.3);
          border-top-color: white;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
