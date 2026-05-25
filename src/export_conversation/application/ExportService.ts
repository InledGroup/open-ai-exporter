import TurndownService from 'turndown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Message } from '../../core/domain/entities';

export class ExportService {
  private turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });

  toMarkdown(messages: Message[], title: string): string {
    let md = `# ${title}\n\n`;
    messages.forEach(msg => {
      const roleName = msg.role === 'user' ? '**Usuario**' : '**IA**';
      const contentMd = this.turndown.turndown(msg.content);
      md += `### ${roleName}\n\n${contentMd}\n\n---\n\n`;
    });
    return md;
  }

  generatePreviewHtml(messages: Message[], title: string): string {
    const messagesHtml = messages.map(msg => {
      const isUser = msg.role === 'user';
      const alignClass = isUser ? 'user-row' : 'ai-row';
      const bubbleClass = isUser ? 'user-bubble' : 'ai-bubble';
      const avatar = isUser ? '👤' : '🤖';
      
      return `
        <div class="message-row ${alignClass}">
          ${!isUser ? `<div class="avatar">${avatar}</div>` : ''}
          <div class="message-wrapper">
            <div class="bubble ${bubbleClass}">
              <div class="content">${msg.content}</div>
            </div>
          </div>
          ${isUser ? `<div class="avatar">${avatar}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div id="ai-exporter-preview-container">
        <style>
          #ai-exporter-preview-container {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #374151;
            background-color: #f3f4f6;
            padding: 40px;
            max-width: 900px;
            margin: auto;
            border-radius: 12px;
          }
          .preview-header { text-align: center; margin-bottom: 40px; }
          .message-row { display: flex; margin-bottom: 32px; gap: 15px; width: 100%; }
          .user-row { justify-content: flex-end; }
          .ai-row { justify-content: flex-start; }
          .message-wrapper { max-width: 85%; display: flex; flex-direction: column; }
          .user-row .message-wrapper { align-items: flex-end; }
          .ai-row .message-wrapper { align-items: flex-start; }
          .bubble { padding: 16px 20px; border-radius: 16px; font-size: 16px; word-wrap: break-word; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          .user-bubble { background-color: #2563eb; color: white !important; border-bottom-right-radius: 4px; }
          .ai-bubble { background-color: #ffffff; color: #1f2937 !important; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
          .avatar { width: 36px; height: 36px; background: #e5e7eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 15px; font-size: 20px; }
          
          /* CONTENIDO Y FORMATO */
          .content p { margin: 0 0 1em 0; }
          .content pre { background: rgba(0,0,0,0.07); padding: 14px; border-radius: 10px; font-size: 14px; margin: 15px 0; overflow-x: auto; border: 1px solid rgba(0,0,0,0.1); }
          .user-bubble pre { background: rgba(255,255,255,0.15); color: white; border: none; }
          .content code { font-family: monospace; padding: 3px 6px; border-radius: 5px; background: rgba(0,0,0,0.07); }
          
          /* FIX GEMINI */
          user-query, model-response, chat-message { 
            display: block !important; 
            width: 100% !important; 
            background: transparent !important; 
            margin: 0 !important;
            padding: 0 !important;
          }

          /* OCULTAR ELEMENTOS RESIDUALES */
          .ai-exporter-checkbox, button, .sr-only, .flex.justify-end { display: none !important; }
        </style>
        <div class="preview-header">
          <h1>${title}</h1>
        </div>
        ${messagesHtml}
      </div>
    `;
  }

  async exportToPdfWithCanvas(containerId: string, filename: string) {
    const element = document.getElementById(containerId);
    if (!element) return;

    // Usar una ventana temporal o asegurar visibilidad para captura
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f3f4f6',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  }

  downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
