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
      const roleName = msg.role === 'user' ? '**You**' : '**AI Assistant**';
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
      const roleLabel = isUser ? 'You' : 'AI Assistant';
      
      return `
        <div class="message-row ${alignClass}">
          ${!isUser ? `<div class="avatar">${avatar}</div>` : ''}
          <div class="message-wrapper">
            <div class="role-name">${roleLabel}</div>
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
          #ai-exporter-preview-container .preview-header { text-align: center; margin-bottom: 40px; }
          #ai-exporter-preview-container .message-row { display: flex; margin-bottom: 32px; gap: 15px; width: 100%; }
          #ai-exporter-preview-container .user-row { justify-content: flex-end; }
          #ai-exporter-preview-container .ai-row { justify-content: flex-start; }
          #ai-exporter-preview-container .message-wrapper { max-width: 85%; display: flex; flex-direction: column; }
          #ai-exporter-preview-container .user-row .message-wrapper { align-items: flex-end; }
          #ai-exporter-preview-container .ai-row .message-wrapper { align-items: flex-start; }
          #ai-exporter-preview-container .bubble { padding: 16px 20px; border-radius: 16px; font-size: 15px; word-wrap: break-word; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          #ai-exporter-preview-container .user-bubble { background-color: #2563eb; color: white !important; border-bottom-right-radius: 4px; }
          #ai-exporter-preview-container .ai-bubble { background-color: #ffffff; color: #1f2937 !important; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
          #ai-exporter-preview-container .avatar { width: 36px; height: 36px; background: #e5e7eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 15px; font-size: 20px; }
          
          /* CONTENT FORMATTING */
          #ai-exporter-preview-container .content p { margin: 0 0 1em 0; }
          #ai-exporter-preview-container .content pre { background: rgba(0,0,0,0.07); padding: 14px; border-radius: 10px; font-size: 14px; margin: 15px 0; overflow-x: auto; border: 1px solid rgba(0,0,0,0.1); }
          #ai-exporter-preview-container .user-bubble pre { background: rgba(255,255,255,0.15); color: white; border: none; }
          #ai-exporter-preview-container .content code { font-family: monospace; padding: 3px 6px; border-radius: 5px; background: rgba(0,0,0,0.07); }
          
          /* GEMINI AND CUSTOM TAG FIX */
          #ai-exporter-preview-container user-query, 
          #ai-exporter-preview-container model-response, 
          #ai-exporter-preview-container chat-message { 
            display: block !important; 
            width: 100% !important; 
            background: transparent !important; 
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          /* HIDE RESIDUALS */
          #ai-exporter-preview-container .ai-exporter-checkbox, 
          #ai-exporter-preview-container button, 
          #ai-exporter-preview-container .sr-only { 
            display: none !important; 
          }
        </style>
        <div class="preview-header">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">${title}</h1>
        </div>
        ${messagesHtml}
        <div style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 60px; padding-bottom: 20px;">
          Exported with AI Exporter Hexagonal
        </div>
      </div>
    `;
  }

  async exportToPdfWithCanvas(containerId: string, filename: string) {
    const element = document.getElementById(containerId);
    if (!element) return;

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
