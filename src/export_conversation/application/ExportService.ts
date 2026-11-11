import browser from 'webextension-polyfill';
import TurndownService from 'turndown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import html2pdf from 'html2pdf.js';
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
  WidthType,
  ImageRun
} from 'docx';
import { Message } from '../../core/domain/entities';

export type WordStyle = 'formatted' | 'basic';

type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp' | 'svg';

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

  toText(messages: Message[], title: string): string {
    let text = `${title}\n\n`;
    messages.forEach(msg => {
      const roleName = msg.role === 'user' ? 'You' : 'AI Assistant';
      // Strip HTML tags for plain text
      const contentText = msg.content.replace(/<[^>]*>/g, '');
      text += `${roleName}:\n${contentText}\n\n-------------------\n\n`;
    });
    return text;
  }

  toJSON(messages: Message[]): string {
    return JSON.stringify(messages, null, 2);
  }

  async toWord(messages: Message[], title: string, style: WordStyle = 'formatted'): Promise<Blob> {
    const docChildren: any[] = [
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    ];

    for (const msg of messages) {
      const isUser = msg.role === 'user';
      const roleName = isUser ? 'You' : 'AI Assistant';
      const roleColor = isUser ? '2563eb' : '3ac200';
      const bgColor = isUser ? 'F9FAFB' : 'F0FDF4';
      const borderColor = isUser ? 'E5E7EB' : 'DCFCE7';

      const contentParagraphs = await this.buildContentParagraphs(msg.content);

      if (style === 'basic') {
        // Formato básico: "You"/"AI Assistant" en negrita, mensaje y punto y aparte.
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: roleName, bold: true, size: 28 })],
          spacing: { before: 240, after: 120 },
        }));
        docChildren.push(...contentParagraphs);
        docChildren.push(new Paragraph({ text: '', spacing: { after: 240 } }));
        continue;
      }

      // Formato bonito: burbuja con color e identificación del rol.
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
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    return await Packer.toBlob(doc);
  }

  /**
   * Convierte el HTML de un mensaje en párrafos de Word.
   * Las imágenes se descargan y se incrustan; si no se pueden descargar se
   * conserva su texto alternativo para no perder la referencia.
   */
  private async buildContentParagraphs(html: string): Promise<Paragraph[]> {
    const contentParagraphs: Paragraph[] = [];
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const processNodes = async (nodes: ArrayLike<ChildNode>, styles: any = {}): Promise<any[]> => {
      let results: any[] = [];

      for (const node of Array.from(nodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (!text.trim()) continue;

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
          continue;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const el = node as HTMLElement;

        if (el.classList.contains('katex-mathml') || el.tagName === 'ANNOTATION') continue;
        if (el.classList.contains('katex-html')) {
          results.push(...await processNodes(el.childNodes, { ...styles, italics: true, font: 'Cambria Math' }));
          continue;
        }

        if (el.tagName === 'IMG') {
          const src = el.getAttribute('src') || '';
          const alt = el.getAttribute('alt') || 'Image';
          const imageRun = await this.createImageRun(src);
          if (imageRun) {
            results.push(imageRun);
          } else {
            results.push(new TextRun({ text: `[${alt}]`, size: 22, italics: true }));
          }
          continue;
        }

        const newStyles = { ...styles };

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
            for (const li of Array.from(el.querySelectorAll('li'))) {
              const liInline = await processNodes(li.childNodes, newStyles);
              if (liInline.length > 0) {
                contentParagraphs.push(new Paragraph({
                  children: liInline,
                  bullet: { level: 0 },
                  spacing: { after: 80 },
                }));
              }
            }
          } else {
            const innerInline = await processNodes(el.childNodes, newStyles);
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
          results.push(...await processNodes(el.childNodes, newStyles));
        }
      }

      return results;
    };

    const finalInline = await processNodes(tempDiv.childNodes);
    if (finalInline.length > 0) {
      contentParagraphs.push(new Paragraph({ children: finalInline, spacing: { after: 120 } }));
    }

    if (contentParagraphs.length === 0 && tempDiv.textContent?.trim()) {
      contentParagraphs.push(new Paragraph({ text: tempDiv.textContent.trim(), spacing: { after: 120 } }));
    }

    return contentParagraphs;
  }

  private async createImageRun(src: string): Promise<ImageRun | null> {
    if (!src) return null;

    try {
      let blob = await this.fetchImageBlob(src);
      if (!blob) return null;

      let type = this.getDocxImageType(blob.type, src);

      // Word no admite webp/avif. Gemini suele servir las imágenes generadas
      // en webp, por lo que antes se perdían y se exportaba sólo el alt.
      if (!type && blob.type.startsWith('image/')) {
        const png = await this.convertToPng(blob);
        if (!png) return null;
        blob = png;
        type = 'png';
      }
      if (!type) return null;

      const data = new Uint8Array(await blob.arrayBuffer());
      const dimensions = await this.getImageDimensions(blob);
      const maxWidth = 460;
      const scale = dimensions.width > 0 ? Math.min(1, maxWidth / dimensions.width) : 1;

      return new ImageRun({
        data,
        type,
        transformation: {
          width: Math.max(1, Math.round(dimensions.width * scale)),
          height: Math.max(1, Math.round(dimensions.height * scale)),
        },
      } as any);
    } catch (err) {
      console.warn('AI Exporter: no se pudo incrustar una imagen en Word', err);
      return null;
    }
  }

  /**
   * El preview es una página de extensión: muchas imágenes de ChatGPT o Gemini
   * no se pueden descargar desde ahí por CORS o por requerir la sesión de la
   * web. El service worker sí tiene permisos de host y sesión, así que se usa
   * como intermediario y se conserva el fetch directo como último recurso.
   */
  private async fetchImageBlob(src: string): Promise<Blob | null> {
    if (/^https?:\/\//i.test(src)) {
      try {
        const result = await browser.runtime.sendMessage({
          type: 'AI_EXPORTER_FETCH_IMAGE',
          url: src,
        }) as { ok?: boolean; dataUrl?: string };

        if (result?.ok && result.dataUrl) {
          const response = await fetch(result.dataUrl);
          if (response.ok) return await response.blob();
        }
      } catch (err) {
        console.warn('AI Exporter: fallo la descarga de imagen vía background', err);
      }
    }

    const response = await fetch(src, { credentials: 'omit' });
    return response.ok ? await response.blob() : null;
  }

  private async convertToPng(blob: Blob): Promise<Blob | null> {
    const url = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || 1;
      canvas.height = image.naturalHeight || 1;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(image, 0, 0);

      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((png) => resolve(png), 'image/png');
      });
    } catch (err) {
      console.warn('AI Exporter: no se pudo convertir una imagen a PNG', err);
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private getDocxImageType(mime: string, src: string): DocxImageType | null {
    const value = (mime || '').toLowerCase();
    if (value.includes('jpeg') || value.includes('jpg')) return 'jpg';
    if (value.includes('png')) return 'png';
    if (value.includes('gif')) return 'gif';
    if (value.includes('bmp')) return 'bmp';
    if (value.includes('svg')) return 'svg';

    const extension = src.split('?')[0].split('.').pop()?.toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') return 'jpg';
    if (extension === 'png') return 'png';
    if (extension === 'gif') return 'gif';
    if (extension === 'bmp') return 'bmp';
    if (extension === 'svg') return 'svg';

    return null;
  }

  private getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();

      const cleanup = (width: number, height: number) => {
        URL.revokeObjectURL(url);
        resolve({ width, height });
      };

      image.onload = () => cleanup(image.naturalWidth || 400, image.naturalHeight || 300);
      image.onerror = () => cleanup(400, 300);
      image.src = url;
    });
  }

  async exportToPdfWithCanvas(containerId: string, filename: string) {
    const element = document.getElementById(containerId);
    if (!element) return;

    const opt = {
      margin: [15, 15] as [number, number], // More breathing room
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: 'css' } // Rely on the CSS rules I just added
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      throw err;
    }
  }

  downloadFile(content: string | Blob, filename: string, type: string) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    // El enlace debe estar en el documento para que Chrome inicie la descarga.
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Revocar demasiado pronto puede cancelar la descarga.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
