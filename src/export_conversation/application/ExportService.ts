import TurndownService from 'turndown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  BorderStyle,
  VerticalAlign
} from 'docx';
import { Message } from '../../core/domain/entities';

export class ExportService {
  private turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });

  toMarkdown(messages: Message[], title: string): string {
    let md = `# ${title}\n\n`;
    messages.forEach(msg => {
      const roleName = msg.role === 'user' ? '**Tú**' : '**AI Assistant**';
      const contentMd = this.turndown.turndown(msg.content);
      md += `### ${roleName}\n\n${contentMd}\n\n---\n\n`;
    });
    return md;
  }

  toText(messages: Message[], title: string): string {
    let text = `${title}\n\n`;
    messages.forEach(msg => {
      const roleName = msg.role === 'user' ? 'Tú' : 'AI Assistant';
      // Strip HTML tags for plain text
      const contentText = msg.content.replace(/<[^>]*>/g, '');
      text += `${roleName}:\n${contentText}\n\n-------------------\n\n`;
    });
    return text;
  }

  toJSON(messages: Message[]): string {
    return JSON.stringify(messages, null, 2);
  }

  async toWord(messages: Message[], title: string): Promise<Blob> {
    const children: any[] = [
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    ];

    messages.forEach(msg => {
      const isUser = msg.role === 'user';
      const roleName = isUser ? 'Tú' : 'AI Assistant';
      const roleColor = isUser ? '2563eb' : '3ac200';

      // Role header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: roleName,
              bold: true,
              color: roleColor,
              size: 28,
            }),
          ],
          spacing: { before: 400, after: 200 },
          border: {
            bottom: {
              color: 'E5E7EB',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 1,
            },
          },
        })
      );

      // Simple HTML to docx conversion
      // We'll split by paragraphs/lines and do some basic text formatting
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = msg.content;
      
      const nodes = Array.from(tempDiv.childNodes);
      
      nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            children.push(new Paragraph({
              children: [new TextRun({ text, size: 24 })],
              spacing: { after: 200 }
            }));
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const text = el.innerText.trim();
          if (text) {
            const isCode = el.tagName === 'PRE' || el.tagName === 'CODE';
            children.push(new Paragraph({
              children: [
                new TextRun({ 
                  text, 
                  size: 24,
                  font: isCode ? 'Courier New' : undefined,
                  shading: isCode ? { fill: 'F3F4F6' } : undefined
                })
              ],
              spacing: { after: 200 },
              indent: el.tagName === 'BLOCKQUOTE' ? { left: 720 } : undefined
            }));
          }
        }
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
    });

    return await Packer.toBlob(doc);
  }

  async exportToPdfWithCanvas(containerId: string, filename: string) {
    const element = document.getElementById(containerId);
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
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

  downloadFile(content: string | Blob, filename: string, type: string) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
