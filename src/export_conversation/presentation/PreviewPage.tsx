import { render } from "preact";
import { useEffect, useState, useMemo } from "preact/hooks";
import { ExportService } from "../application/ExportService";
import { Message } from "../../core/domain/entities";
import {
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  User,
  Bot,
  CheckSquare,
  Square,
  ClipboardCheck,
  ClipboardList,
  FileJson,
  FileType,
  FileCode,
  FileOutput,
} from "lucide-preact";

export function PreviewPage() {
  const [data, setData] = useState<{
    messages: Message[];
    title: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "done">("idle");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const exportService = useMemo(() => new ExportService(), []);

  useEffect(() => {
    chrome.storage.local.get(["export_preview_data"], (result) => {
      if (result.export_preview_data) {
        setData(result.export_preview_data);
        // Initially all selected
        const ids = new Set(
          result.export_preview_data.messages.map((m: Message) => m.id),
        );
        setSelectedIds(ids);
      }
    });
  }, []);

  const getMessagesToExport = () => {
    if (!data) return [];
    return data.messages.filter((m) => selectedIds.has(m.id));
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setStatus("generating");

    // Temporarily hide checkboxes for canvas capture
    const wasSelectionMode = isSelectionMode;
    setIsSelectionMode(false);

    setTimeout(async () => {
      try {
        await exportService.exportToPdfWithCanvas(
          "preview-content",
          `${data.title}.pdf`,
        );
        setStatus("done");
        setIsSelectionMode(wasSelectionMode);
        setTimeout(() => setStatus("idle"), 3000);
      } catch (err) {
        console.error(err);
        setStatus("idle");
        setIsSelectionMode(wasSelectionMode);
        alert("Error generating PDF");
      }
    }, 500);
  };

  const handleDownloadMarkdown = () => {
    if (!data) return;
    const messagesToExport = getMessagesToExport();
    const md = exportService.toMarkdown(messagesToExport, data.title);
    exportService.downloadFile(md, `${data.title}.md`, "text/markdown");
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    const messagesToExport = getMessagesToExport();
    const json = exportService.toJSON(messagesToExport);
    exportService.downloadFile(json, `${data.title}.json`, "application/json");
  };

  const handleDownloadTXT = () => {
    if (!data) return;
    const messagesToExport = getMessagesToExport();
    const txt = exportService.toText(messagesToExport, data.title);
    exportService.downloadFile(txt, `${data.title}.txt`, "text/plain");
  };

  const handleDownloadWord = async () => {
    if (!data) return;
    setStatus("generating");
    try {
      const messagesToExport = getMessagesToExport();
      const blob = await exportService.toWord(messagesToExport, data.title);
      exportService.downloadFile(
        blob,
        `${data.title}.docx`,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      console.error(err);
      setStatus("idle");
      alert("Error generating Word document");
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (!data) return;
    setSelectedIds(new Set(data.messages.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  if (!data)
    return (
      <div style="padding: 50px; text-align: center; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 20px;">
        <div class="loader"></div>
        <div style="font-size: 18px; color: #3ac200; font-weight: 600;">
          Cargando vista previa...
        </div>
      </div>
    );

  const messagesToShow = isSelectionMode
    ? data.messages
    : data.messages.filter((m) => selectedIds.has(m.id));

  return (
    <div className="preview-container">
      <header className="preview-header">
        <div className="header-left">
          <img src="aiexporter.png" alt="Logo" className="header-logo" />
          <h2>AI Exporter Pro</h2>
        </div>

        <div className="header-actions">
          <button
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={`btn-secondary ${isSelectionMode ? "active" : ""}`}
          >
            {isSelectionMode ? (
              <XCircle size={18} />
            ) : (
              <ClipboardList size={18} />
            )}
            {isSelectionMode ? "Cerrar Selección" : "Seleccionar mensajes"}
          </button>

          {isSelectionMode && (
            <>
              <button onClick={selectAll} className="btn-text">
                <CheckSquare size={16} /> Seleccionar todo
              </button>
              <button onClick={deselectAll} className="btn-text">
                <Square size={16} /> Deseleccionar todo
              </button>
            </>
          )}

          <div className="divider" />

          <button
            onClick={handleDownloadWord}
            disabled={status === "generating"}
            className="btn-primary"
          >
            {status === "generating" ? (
              <div class="spinner"></div>
            ) : (
              <FileText size={18} />
            )}
            {status === "generating" ? "..." : "Word"}
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={status === "generating"}
            className="btn-primary"
          >
            {status === "generating" ? (
              <div class="spinner"></div>
            ) : (
              <FileOutput size={18} />
            )}
            {status === "generating" ? "..." : "PDF"}
          </button>

          <button onClick={handleDownloadMarkdown} className="btn-primary">
            <FileCode size={18} />
            MD
          </button>

          <button onClick={handleDownloadJSON} className="btn-primary">
            <FileJson size={18} />
            JSON
          </button>

          <button onClick={handleDownloadTXT} className="btn-primary">
            <FileType size={18} />
            TXT
          </button>

          <button onClick={() => window.close()} className="btn-close">
            <XCircle size={18} />
          </button>
        </div>
      </header>

      <main className="preview-main">
        <div id="preview-content" className="preview-content-area">
          <div className="content-header">
            <h1>{data.title}</h1>
          </div>

          {messagesToShow.map((msg) => {
            const isUser = msg.role === "user";
            const isSelected = selectedIds.has(msg.id);

            return (
              <div
                key={msg.id}
                className={`message-row ${isUser ? "user-row" : "ai-row"}`}
              >
                {isSelectionMode && (
                  <div
                    className="selection-checkbox"
                    onClick={() => toggleSelection(msg.id)}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={24} color="#3ac200" />
                    ) : (
                      <div className="checkbox-empty" />
                    )}
                  </div>
                )}

                {!isUser && (
                  <div className="avatar ai-avatar">
                    <Bot size={20} />
                  </div>
                )}

                <div className="message-wrapper">
                  <div className="role-name">
                    {isUser ? "Tú" : "AI Assistant"}
                  </div>
                  <div
                    className={`bubble ${isUser ? "user-bubble" : "ai-bubble"}`}
                  >
                    <div
                      className="content"
                      dangerouslySetInnerHTML={{ __html: msg.content }}
                    />
                  </div>
                </div>

                {isUser && (
                  <div className="avatar user-avatar">
                    <User size={20} />
                  </div>
                )}
              </div>
            );
          })}

          <footer className="content-footer">
            Exportado con AI Exporter Pro Inled
          </footer>
        </div>
      </main>

      <style>{`
        :root {
          --primary-color: #3ac200;
          --primary-hover: #32a800;
          --bg-color: #ffffff;
          --text-main: #111827;
          --text-muted: #6b7280;
          --user-bubble: #f3f4f6;
          --ai-bubble: #ffffff;
          --border-color: #e5e7eb;
        }

        body {
          margin: 0;
          padding: 0;
          background: #f9fafb;
        }

        .preview-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          font-family: 'Inter', -apple-system, sans-serif;
          color: var(--text-main);
        }

        .preview-header {
          background: white;
          padding: 12px 30px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-logo {
          width: 32px;
          height: 32px;
          border-radius: 6px;
        }

        .header-left h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--primary-color);
        }

        .header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .btn-primary {
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-primary:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(58, 194, 0, 0.2);
        }

        .btn-secondary {
          background: white;
          color: var(--text-main);
          border: 1px solid var(--border-color);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .btn-secondary.active {
          background: #ecfdf5;
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        .btn-text {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .btn-text:hover {
          color: var(--text-main);
          background: #f3f4f6;
        }

        .btn-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .btn-close:hover {
          color: #ef4444;
        }

        .divider {
          width: 1px;
          height: 24px;
          background: var(--border-color);
          margin: 0 5px;
        }

        .preview-main {
          flex: 1;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          background: white;
        }

        .preview-content-area {
          width: 100%;
          max-width: 850px;
          background: white;
        }

        .content-header {
          text-align: center;
          margin-bottom: 50px;
        }

        .content-header h1 {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          margin: 0;
        }

        .message-row {
          display: flex;
          margin-bottom: 35px;
          gap: 16px;
          width: 100%;
          position: relative;
        }

        .user-row { justify-content: flex-end; }
        .ai-row { justify-content: flex-start; }

        .selection-checkbox {
          position: absolute;
          left: -45px;
          top: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          transition: transform 0.2s;
        }

        .selection-checkbox:hover {
          transform: scale(1.1);
        }

        .checkbox-empty {
          width: 22px;
          height: 22px;
          border: 2px solid #d1d5db;
          border-radius: 50%;
        }

        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 5px;
          flex-shrink: 0;
        }

        .user-avatar { background: #f3f4f6; color: #6b7280; }
        .ai-avatar { background: #ecfdf5; color: var(--primary-color); }

        .message-wrapper {
          max-width: 80%;
          display: flex;
          flex-direction: column;
        }

        .user-row .message-wrapper { align-items: flex-end; }
        .ai-row .message-wrapper { align-items: flex-start; }

        .role-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .bubble {
          padding: 16px 20px;
          border-radius: 18px;
          font-size: 15px;
          line-height: 1.6;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .user-bubble {
          background-color: var(--user-bubble);
          color: #1f2937;
          border-top-right-radius: 4px;
        }

        .ai-bubble {
          background-color: var(--ai-bubble);
          color: #1f2937;
          border: 1px solid var(--border-color);
          border-top-left-radius: 4px;
        }

        .content p { margin: 0 0 1em 0; }
        .content p:last-child { margin-bottom: 0; }

        .content pre {
          background: #1e293b;
          color: #f8fafc;
          padding: 16px;
          border-radius: 12px;
          font-size: 14px;
          margin: 15px 0;
          overflow-x: auto;
        }

        .content code {
          font-family: 'Fira Code', monospace;
          background: #f1f5f9;
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 0.9em;
        }

        .content-footer {
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
          margin-top: 60px;
          padding: 40px 0;
          border-top: 1px solid var(--border-color);
        }

        /* Animations */
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loader {
          border: 4px solid #f3f4f6;
          border-top: 4px solid var(--primary-color);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

const container = document.getElementById("preview-app");
if (container) {
  render(<PreviewPage />, container);
}
