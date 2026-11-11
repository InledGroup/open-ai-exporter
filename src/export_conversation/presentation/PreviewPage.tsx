import browser from "webextension-polyfill";
import { render } from "preact";
import { useEffect, useState, useMemo } from "preact/hooks";
import { marked } from "marked";
import katex from "katex";
import "katex/dist/katex.min.css";
import renderMathInElement from "katex/dist/contrib/auto-render.mjs";
import { ExportService, type WordStyle } from "../application/ExportService";
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
  Menu,
  AlignLeft,
} from "lucide-preact";

export function PreviewPage() {
  const [data, setData] = useState<{
    messages: Message[];
    title: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "done">("idle");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openExportMenu, setOpenExportMenu] = useState<"word" | "pdf" | null>(null);

  // New customization state
  const [fontSize, setFontSize] = useState(15);
  const [bubbleWidth, setBubbleWidth] = useState(85); // Percentage

  const exportService = useMemo(() => new ExportService(), []);

  // Configure marked with math support
  useEffect(() => {
    const mathExtension: any = {
      name: "math",
      level: "inline",
      start(src: string) {
        return src.match(/\$|\\\(|\\\[/)?.index;
      },
      tokenizer(src: string, tokens: any) {
        // Display math $$ ... $$
        const displayMatch = src.match(/^\$\$([\s\S]+?)\$\$/);
        if (displayMatch) {
          return {
            type: "math",
            raw: displayMatch[0],
            text: displayMatch[1],
            display: true,
          };
        }
        // Inline math $ ... $
        const inlineMatch = src.match(/^\$((?:[^\$]|\\\$)+)\$/);
        if (inlineMatch) {
          return {
            type: "math",
            raw: inlineMatch[0],
            text: inlineMatch[1],
            display: false,
          };
        }
        // Display math \[ ... \]
        const blockMatch = src.match(/^\\\[([\s\S]+?)\\\]/);
        if (blockMatch) {
          return {
            type: "math",
            raw: blockMatch[0],
            text: blockMatch[1],
            display: true,
          };
        }
        // Inline math \( ... \)
        const parenMatch = src.match(/^\\\(([\s\S]+?)\\\)/);
        if (parenMatch) {
          return {
            type: "math",
            raw: parenMatch[0],
            text: parenMatch[1],
            display: false,
          };
        }
        return;
      },
      renderer(token: any) {
        if (token.display) {
          return `$$${token.text}$$`;
        } else {
          return `$${token.text}$`;
        }
      },
    };

    marked.use({
      gfm: true,
      breaks: true,
      extensions: [mathExtension],
    });
  }, []);

  useEffect(() => {
    browser.storage.local.get(["export_preview_data"]).then((result: any) => {
      if (result.export_preview_data) {
        setData(result.export_preview_data);
        // Initially all selected
        const ids = new Set<string>(
          result.export_preview_data.messages.map((m: Message) => m.id),
        );
        setSelectedIds(ids);
      }
    });
  }, []);

  useEffect(() => {
    if (data) {
      setTimeout(() => {
        const container = document.getElementById("preview-content");
        if (container) {
          renderMathInElement(container, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
        }
      }, 100);
    }
  }, [data, isSelectionMode, selectedIds]);

  const getMessagesToExport = () => {
    if (!data) return [];
    return data.messages.filter((m) => selectedIds.has(m.id));
  };

  const handleDownloadPdf = async (style: "conversation" | "flat" = "conversation") => {
    if (!data) return;
    setStatus("generating");
    setIsMenuOpen(false);

    // Temporarily hide checkboxes and other non-pdf elements
    const wasSelectionMode = isSelectionMode;
    setIsSelectionMode(false);
    const mainWrapper = document.querySelector(".preview-container");
    const pdfContent = document.getElementById("preview-content");
    if (mainWrapper) mainWrapper.classList.add("exporting-pdf");
    // Las clases deben ir también en el elemento que captura html2canvas;
    // si sólo están en un ancestro, el clon del PDF no hereda los estilos
    // (y las imágenes se parten entre páginas).
    if (pdfContent) {
      pdfContent.classList.add("exporting-pdf");
      pdfContent.classList.toggle("pdf-flat", style === "flat");
    }

    // Wait a bit for the UI to update
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
      } finally {
        if (mainWrapper) mainWrapper.classList.remove("exporting-pdf");
        if (pdfContent) {
          pdfContent.classList.remove("exporting-pdf");
          pdfContent.classList.remove("pdf-flat");
        }
      }
    }, 800);
  };

  const handleDownloadMarkdown = () => {
    if (!data) return;
    setIsMenuOpen(false);
    const messagesToExport = getMessagesToExport();
    const md = exportService.toMarkdown(messagesToExport, data.title);
    exportService.downloadFile(md, `${data.title}.md`, "text/markdown");
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    setIsMenuOpen(false);
    const messagesToExport = getMessagesToExport();
    const json = exportService.toJSON(messagesToExport);
    exportService.downloadFile(json, `${data.title}.json`, "application/json");
  };

  const handleDownloadTXT = () => {
    if (!data) return;
    setIsMenuOpen(false);
    const messagesToExport = getMessagesToExport();
    const txt = exportService.toText(messagesToExport, data.title);
    exportService.downloadFile(txt, `${data.title}.txt`, "text/plain");
  };

  const handleDownloadWord = async (style: WordStyle = "formatted") => {
    if (!data) return;
    setStatus("generating");
    setIsMenuOpen(false);
    try {
      const messagesToExport = getMessagesToExport();
      const blob = await exportService.toWord(messagesToExport, data.title, style);
      exportService.downloadFile(
        blob,
        `${data.title}.docx`,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
          Loading preview...
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
          <h2>AI Exporter</h2>
        </div>

        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <XCircle size={24} /> : <Menu size={24} />}
        </button>

        <div className={`header-actions ${isMenuOpen ? 'mobile-open' : ''}`}>
          <div className="customizer-group">
            <div className="control-item">
              <span>Text: {fontSize}px</span>
              <input
                type="range"
                min="12"
                max="24"
                value={fontSize}
                onInput={(e) =>
                  setFontSize(parseInt((e.target as HTMLInputElement).value))
                }
              />
            </div>
            <div className="control-item">
              <span>Width: {bubbleWidth}%</span>
              <input
                type="range"
                min="50"
                max="100"
                value={bubbleWidth}
                onInput={(e) =>
                  setBubbleWidth(parseInt((e.target as HTMLInputElement).value))
                }
              />
            </div>
          </div>

          <div className="divider" />

          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (window.innerWidth < 768) setIsMenuOpen(false);
            }}
            className={`btn-secondary ${isSelectionMode ? "active" : ""}`}
          >
            {isSelectionMode ? (
              <XCircle size={18} />
            ) : (
              <ClipboardList size={18} />
            )}
            {isSelectionMode ? "Close select mode" : "Select messages"}
          </button>

          {isSelectionMode && (
            <div className="selection-quick-actions">
              <button onClick={selectAll} className="btn-text">
                <CheckSquare size={16} /> Select all
              </button>
              <button onClick={deselectAll} className="btn-text">
                <Square size={16} /> Deselect all
              </button>
            </div>
          )}

          <div className="divider" />

          <div className="export-buttons-group">
            <div className="export-dropdown-wrap">
              <button
                onClick={() => setOpenExportMenu(openExportMenu === "word" ? null : "word")}
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
              {openExportMenu === "word" && (
                <div className="export-dropdown-menu">
                  <button
                    className="export-dropdown-item"
                    onClick={() => {
                      setOpenExportMenu(null);
                      handleDownloadWord("formatted");
                    }}
                  >
                    <FileText size={15} /> Formatted (colors)
                  </button>
                  <button
                    className="export-dropdown-item"
                    onClick={() => {
                      setOpenExportMenu(null);
                      handleDownloadWord("basic");
                    }}
                  >
                    <AlignLeft size={15} /> Basic (plain)
                  </button>
                </div>
              )}
            </div>

            <div className="export-dropdown-wrap">
              <button
                onClick={() => setOpenExportMenu(openExportMenu === "pdf" ? null : "pdf")}
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
              {openExportMenu === "pdf" && (
                <div className="export-dropdown-menu">
                  <button
                    className="export-dropdown-item"
                    onClick={() => {
                      setOpenExportMenu(null);
                      handleDownloadPdf("conversation");
                    }}
                  >
                    <FileOutput size={15} /> Conversation design
                  </button>
                  <button
                    className="export-dropdown-item"
                    onClick={() => {
                      setOpenExportMenu(null);
                      handleDownloadPdf("flat");
                    }}
                  >
                    <AlignLeft size={15} /> Flat design
                  </button>
                </div>
              )}
            </div>

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
          </div>

          <button onClick={() => window.close()} className="btn-close desktop-only">
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
                className={`message-row ${isUser ? "user-row" : "ai-row"} ${isSelectionMode ? 'with-selection' : ''}`}
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
                  <div className="avatar ai-avatar no-pdf">
                    <Bot size={20} />
                  </div>
                )}

                <div className="message-wrapper">
                  <div className="role-name">
                    {isUser ? "You" : "AI Assistant"}
                  </div>
                  <div
                    className={`bubble ${isUser ? "user-bubble" : "ai-bubble"}`}
                  >
                    <div
                      className="content"
                      dangerouslySetInnerHTML={{
                        __html: marked.parse(msg.content) as string,
                      }}
                    />
                  </div>
                </div>

                {isUser && (
                  <div className="avatar user-avatar no-pdf">
                    <User size={20} />
                  </div>
                )}
              </div>
            );
          })}

          <footer className="content-footer">
            Exported with AI Exporter, by Inled Group
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
          -webkit-tap-highlight-color: transparent;
        }

        .preview-container {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          font-family: Inter, system-ui, -apple-system, sans-serif;
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
          gap: 15px;
          align-items: center;
        }

        .mobile-menu-toggle {
          display: none;
          background: none;
          border: none;
          color: var(--text-main);
          cursor: pointer;
          padding: 5px;
        }

        .customizer-group {
          display: flex;
          gap: 20px;
          background: #f3f4f6;
          padding: 6px 15px;
          border-radius: 10px;
          align-items: center;
        }

        .control-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .control-item span {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .control-item input {
          width: 80px;
          accent-color: var(--primary-color);
          cursor: pointer;
        }

        .export-buttons-group {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .export-dropdown-wrap {
          position: relative;
        }

        .export-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          min-width: 210px;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          padding: 6px;
          z-index: 2000;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .export-dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          border-radius: 7px;
          padding: 9px 10px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-main);
          cursor: pointer;
          white-space: nowrap;
        }

        .export-dropdown-item:hover {
          background: #f3f4f6;
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
          white-space: nowrap;
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
          white-space: nowrap;
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

        .selection-quick-actions {
          display: flex;
          gap: 5px;
        }

        .preview-main {
          flex: 1;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
          background: #f9fafb;
        }

        .preview-content-area {
          width: 100%;
          max-width: 900px;
          background: white;
          padding: 60px;
          box-sizing: border-box;
          color-scheme: light;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          border-radius: 12px;
        }

        .exporting-pdf .no-pdf {
          display: none !important;
        }

        .exporting-pdf .preview-content-area,
        .preview-content-area.exporting-pdf {
          box-shadow: none !important;
          padding: 40px !important;
          border-radius: 0 !important;
        }

        /* Diseño plano: sin burbujas ni avatares, pensado para lectura e impresión */
        .pdf-flat .preview-content-area {
          box-shadow: none !important;
          border-radius: 0 !important;
        }

        .pdf-flat .content-header {
          text-align: left;
          margin-bottom: 30px;
        }

        .pdf-flat .avatar {
          display: none !important;
        }

        .pdf-flat .message-row {
          display: block;
          margin-bottom: 22px;
        }

        .pdf-flat .message-wrapper,
        .pdf-flat .user-row .message-wrapper,
        .pdf-flat .ai-row .message-wrapper {
          max-width: 100%;
          align-items: flex-start;
        }

        .pdf-flat .role-name {
          text-transform: none;
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 6px;
        }

        .pdf-flat .bubble {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
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
          word-break: break-word;
        }

        .message-row {
          display: flex;
          margin-bottom: 35px;
          gap: 16px;
          width: 100%;
          position: relative;
          page-break-inside: avoid;
          break-inside: avoid;
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
          z-index: 10;
        }

        .selection-checkbox:hover {
          transform: scale(1.1);
        }

        .checkbox-empty {
          width: 22px;
          height: 22px;
          border: 2px solid #d1d5db;
          border-radius: 50%;
          background: white;
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
          max-width: ${bubbleWidth}%;
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
          font-size: ${fontSize}px;
          line-height: 1.6;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          width: 100%;
          word-break: break-word;
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

        .content img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 10px 0;
          border-radius: 8px;
          object-fit: contain;
        }

        .content picture {
          display: block;
          max-width: 100%;
        }

        /* html2pdf corta el lienzo por páginas; una imagen más alta que la
           página aparece partida. Se limita también su altura. */
        .exporting-pdf .content img {
          max-width: 100% !important;
          max-height: 165mm !important;
          width: auto !important;
          height: auto !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .content pre {
          background: #1e293b !important;
          color: #f8fafc !important;
          padding: 16px !important;
          border-radius: 12px !important;
          font-size: 14px !important;
          margin: 15px 0 !important;
          overflow-x: auto !important;
          white-space: pre-wrap !important;
          word-break: break-all !important;
          display: block !important;
        }

        .content table {
          display: block;
          overflow-x: auto;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .preview-header {
            padding: 10px 15px;
          }

          .mobile-menu-toggle {
            display: block;
          }

          .header-actions {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            flex-direction: column;
            padding: 20px;
            gap: 15px;
            border-bottom: 1px solid var(--border-color);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            align-items: stretch;
          }

          .header-actions.mobile-open {
            display: flex;
          }

          .customizer-group {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }

          .control-item input {
            width: 100%;
          }

          .export-buttons-group {
            flex-wrap: wrap;
            justify-content: center;
          }

          .btn-primary, .btn-secondary {
            justify-content: center;
          }

          .divider {
            display: none;
          }

          .desktop-only {
            display: none;
          }

          .preview-main {
            padding: 10px;
          }

          .preview-content-area {
            padding: 30px 15px;
          }

          .content-header h1 {
            font-size: 22px;
          }

          .message-row {
            gap: 8px;
            margin-bottom: 20px;
          }

          .avatar {
            width: 32px;
            height: 32px;
          }

          .bubble {
            padding: 12px 15px;
            font-size: ${fontSize}px;
          }

          .message-wrapper {
            max-width: ${bubbleWidth}%;
          }

          .selection-checkbox {
            left: -5px;
            top: -10px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .with-selection {
            padding-left: 10px;
          }
        }

        /* Tables & Pre again for mobile */
        .content table {
          font-size: 0.8em;
        }

        .content-footer {
          font-size: 11px;
          margin-top: 30px;
          padding: 20px 0;
        }
      `}</style>
    </div>
  );
}

const container = document.getElementById("preview-app");
if (container) {
  render(<PreviewPage />, container);
}
