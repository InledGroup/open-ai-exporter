import TurndownService from 'turndown';
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

  toPdfHtml(messages: Message[], title: string): string {
    const messagesHtml = messages.map(msg => {
      const isUser = msg.role === 'user';
      const alignClass = isUser ? 'user-row' : 'ai-row';
      const bubbleClass = isUser ? 'user-bubble' : 'ai-bubble';
      const avatar = isUser ? '👤' : '🤖';
      const roleLabel = isUser ? 'Tú' : 'Asistente IA';
      
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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <script>
          window.MathJax = {
            tex: {
              inlineMath: [['$', '$'], ['\\(', '\\)']],
              displayMath: [['$$', '$$'], ['\\[', '\\]']],
              processEscapes: true
            },
            options: {
              skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
            }
          };
        </script>
        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: #374151;
            background-color: #f9fafb;
            padding: 20px;
            max-width: 900px;
            margin: auto;
          }
          h1 {
            text-align: center;
            color: #111827;
            margin-bottom: 40px;
            font-size: 22px;
            font-weight: 600;
          }
          .message-row {
            display: flex;
            margin-bottom: 24px;
            gap: 12px;
            width: 100%;
          }
          .user-row { justify-content: flex-end; }
          .ai-row { justify-content: flex-start; }
          
          .message-wrapper {
            max-width: 80%;
            display: flex;
            flex-direction: column;
          }
          .user-row .message-wrapper { align-items: flex-end; }
          .ai-row .message-wrapper { align-items: flex-start; }

          .role-name {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            margin-bottom: 4px;
            margin-left: 4px;
            margin-right: 4px;
          }

          .avatar {
            width: 32px;
            height: 32px;
            background: #e5e7eb;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
            margin-top: 18px;
          }

          .bubble {
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 15px;
            word-wrap: break-word;
            position: relative;
          }
          .user-bubble {
            background-color: #2563eb;
            color: white;
            border-bottom-right-radius: 4px;
          }
          .ai-bubble {
            background-color: #ffffff;
            color: #1f2937;
            border: 1px solid #e5e7eb;
            border-bottom-left-radius: 4px;
          }

          .content {
            white-space: normal;
          }
          
          /* Formato de contenido */
          .content pre {
            background: rgba(0,0,0,0.05);
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            margin: 10px 0;
          }
          .user-bubble pre { background: rgba(255,255,255,0.1); }
          
          .content code {
            font-family: monospace;
            padding: 2px 4px;
            border-radius: 4px;
            background: rgba(0,0,0,0.05);
          }
          .user-bubble code { background: rgba(255,255,255,0.2); }

          .content table {
            border-collapse: collapse;
            width: 100%;
            margin: 12px 0;
          }
          .content th, .content td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
          }

          @media print {
            body { background-color: #fff; padding: 0; }
            .bubble { box-shadow: none; border: 1px solid #e5e7eb; }
            .user-bubble { color: #000; background: #f3f4f6; }
            .message-row { break-inside: avoid; }
          }
        </style>
        <script>
          window.onload = function() {
            // Dar tiempo a MathJax para renderizar
            setTimeout(() => {
              window.print();
            }, 1000);
          };
        </script>
      </head>
      <body>
        <h1>${title}</h1>
        ${messagesHtml}
        <div style="text-align: center; color: #9ca3af; font-size: 10px; margin-top: 50px;">
          Exportado con AI Exporter Hexagonal
        </div>
      </body>
      </html>
    `;
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
