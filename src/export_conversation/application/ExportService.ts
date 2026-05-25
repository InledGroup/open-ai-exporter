import { Message } from '../../core/domain/entities';

export class ExportService {
  toMarkdown(messages: Message[], title: string): string {
    let md = `# ${title}\n\n`;
    messages.forEach(msg => {
      const roleName = msg.role === 'user' ? '**Usuario**' : '**IA**';
      // Convertir HTML básico a MD (muy simplificado, idealmente usar turndown)
      const cleanContent = msg.content
        .replace(/<br[^>]*>/g, '\n')
        .replace(/<p[^>]*>/g, '\n')
        .replace(/<\/p>/g, '\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
        .replace(/<b[^>]*>(.*?)<\/b>/g, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
        .replace(/<i[^>]*>(.*?)<\/i>/g, '*$1*')
        .replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
        .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, '```\n$1\n```')
        .replace(/<[^>]+>/g, ''); // Eliminar resto de tags

      md += `### ${roleName}\n\n${cleanContent}\n\n---\n\n`;
    });
    return md;
  }

  toPdfHtml(messages: Message[], title: string): string {
    const messagesHtml = messages.map(msg => {
      const isUser = msg.role === 'user';
      const roleLabel = isUser ? 'Tú' : 'Asistente IA';
      const bgClass = isUser ? 'user-bg' : 'ai-bg';
      
      return `
        <div class="message-container ${bgClass}">
          <div class="role-label">${roleLabel}</div>
          <div class="content">${msg.content}</div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.5;
            color: #1f2937;
            background-color: #f3f4f6;
            padding: 40px 20px;
            max-width: 850px;
            margin: auto;
          }
          .no-print {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
          }
          button {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          h1 {
            text-align: center;
            color: #111827;
            margin-bottom: 40px;
            font-size: 24px;
          }
          .message-container {
            margin-bottom: 24px;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .user-bg {
            background-color: #e0f2fe;
            border-left: 5px solid #0ea5e9;
          }
          .ai-bg {
            background-color: #ffffff;
            border-left: 5px solid #10b981;
          }
          .role-label {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
            color: #6b7280;
          }
          .content {
            font-size: 16px;
            word-wrap: break-word;
          }
          /* Estilos para preservar formato de IA */
          .content pre {
            background: #f1f5f9;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-family: monospace;
          }
          .content code {
            background: #f1f5f9;
            padding: 2px 4px;
            border-radius: 4px;
            font-family: monospace;
          }
          .content blockquote {
            border-left: 4px solid #e5e7eb;
            padding-left: 12px;
            margin-left: 0;
            color: #4b5563;
          }
          .content table {
            border-collapse: collapse;
            width: 100%;
            margin: 10px 0;
          }
          .content th, .content td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
          }
          @media print {
            body { background-color: #fff; padding: 0; }
            .no-print { display: none; }
            .message-container { 
              box-shadow: none; 
              border: 1px solid #e5e7eb;
              break-inside: avoid;
            }
          }
        </style>
        <!-- Soporte básico para LaTeX si la IA usa KaTeX -->
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">Descargar PDF</button>
        </div>
        <h1>${title}</h1>
        ${messagesHtml}
        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 40px;">
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
