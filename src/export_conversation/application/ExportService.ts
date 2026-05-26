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
  Table,
  TableRow,
  TableCell,
  WidthType
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
    const docChildren: any[] = [
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
      const bgColor = isUser ? 'F9FAFB' : 'F0FDF4'; 
      const borderColor = isUser ? 'E5E7EB' : 'DCFCE7';

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = msg.content;
      
      const contentParagraphs: Paragraph[] = [];
      
      const processNodes = (nodes: NodeList, styles: any = {}): any[] => {
        let results: any[] = [];
        nodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim()) {
              if (text.includes('$')) {
                const parts = text.split(/(\$\$?.*?\$\$?)/g);
                parts.forEach(part => {
                  if (!part) return;
                  const isMath = part.startsWith('$');
                  results.push(new TextRun({
                    text: part,
                    size: 24,
                    italics: isMath,
                    font: isMath ? 'Cambria Math' : undefined,
                    ...styles
                  }));
                });
              } else {
                results.push(new TextRun({
                  text,
                  size: 24,
                  ...styles
                }));
              }
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const newStyles = { ...styles };
            
            if (el.classList.contains('katex-mathml') || el.tagName === 'ANNOTATION') return;
            if (el.classList.contains('katex-html')) {
              results.push(...processNodes(el.childNodes, { ...newStyles, italics: true, font: 'Cambria Math' }));
              return;
            }

            if (['B', 'STRONG'].includes(el.tagName)) newStyles.bold = true;
            if (['I', 'EM'].includes(el.tagName)) newStyles.italics = true;
            if (['CODE'].includes(el.tagName)) {
              newStyles.font = 'Courier New';
              newStyles.shading = { fill: 'F3F4F6' };
              newStyles.size = 22;
            }

            if (['P', 'DIV', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 'PRE', 'UL', 'OL'].includes(el.tagName)) {
              // If there are current pending inline results, wrap them
              if (results.length > 0) {
                contentParagraphs.push(new Paragraph({ children: results, spacing: { after: 120 } }));
                results = [];
              }

              if (el.tagName === 'PRE') {
                contentParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: el.innerText.trim(), font: 'Courier New', size: 20 })],
                  spacing: { before: 120, after: 120 },
                  shading: { fill: 'F8FAFC' },
                  border: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                  }
                }));
              } else if (['UL', 'OL'].includes(el.tagName)) {
                el.querySelectorAll('li').forEach(li => {
                  const liInline = processNodes(li.childNodes, newStyles);
                  if (liInline.length > 0) {
                    contentParagraphs.push(new Paragraph({
                      children: liInline,
                      bullet: { level: 0 },
                      spacing: { after: 80 },
                    }));
                  }
                });
              } else {
                const innerInline = processNodes(el.childNodes, newStyles);
                if (innerInline.length > 0) {
                  contentParagraphs.push(new Paragraph({ 
                    children: innerInline, 
                    spacing: { after: 120 },
                    indent: el.tagName === 'BLOCKQUOTE' ? { left: 400 } : undefined,
                    border: el.tagName === 'BLOCKQUOTE' ? { 
                      left: { style: BorderStyle.SINGLE, size: 20, color: 'D1D5DB', space: 10 } 
                    } : undefined
                  }));
                }
              }
            } else if (el.tagName === 'BR') {
              results.push(new TextRun({ break: 1 }));
            } else {
              results.push(...processNodes(el.childNodes, newStyles));
            }
          }
        });
        return results;
      };

      const finalInline = processNodes(tempDiv.childNodes);
      if (finalInline.length > 0) {
        contentParagraphs.push(new Paragraph({ children: finalInline, spacing: { after: 120 } }));
      }

      // Add the message bubble as a Table
      docChildren.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: bgColor },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                  left: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                  right: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                },
                margins: { top: 200, bottom: 200, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: roleName,
                        bold: true,
                        color: roleColor,
                        size: 26,
                      }),
                    ],
                    spacing: { after: 150 },
                  }),
                  ...contentParagraphs
                ],
              }),
            ],
          }),
        ],
      }));

      // Add a spacer between bubbles
      docChildren.push(new Paragraph({ text: '', spacing: { before: 200 } }));
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
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
