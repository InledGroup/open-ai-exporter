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
      const roleName = msg.role === 'user' ? '**Tú**' : '**AI Assistant**';
      const contentMd = this.turndown.turndown(msg.content);
      md += `### ${roleName}\n\n${contentMd}\n\n---\n\n`;
    });
    return md;
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
