import { Role } from '../domain/entities';

/**
 * Limpia el HTML extraído de un mensaje para que sólo quede contenido real:
 * - Elimina controles e interfaz (botones, toolbars, svg, iframes, widgets...).
 * - Elimina elementos ocultos (incluidos los rótulos "Has dicho" / "You said").
 * - Conserva imágenes, enlaces, código, tablas y formato básico.
 *
 * Se ejecuta en el content script, donde hay DOM disponible.
 */

const DROP_SELECTOR = [
  'script',
  'style',
  'link',
  'meta',
  'noscript',
  'template',
  'button',
  'svg',
  'iframe',
  'frame',
  'frameset',
  'video',
  'audio',
  'canvas',
  'object',
  'embed',
  'input',
  'select',
  'textarea',
  'form',
  'g-snackbar',
  'model-thoughts',
  'thinking-section',
  '[role="toolbar"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="tooltip"]',
  '[role="progressbar"]',
  '[role="tablist"]',
  '[role="tab"]',
  '[hidden]',
  '.sr-only',
  '.cdk-visually-hidden',
  '.visually-hidden',
  '.screen-reader-text',
  '.RNowub',
  '.YHsVn',
  '.BTkBWc',
  'ul.EJw9bc',
  '[jscontroller="JHnpme"]',
].join(',');

// Rótulos que algunas webs añaden dentro del propio mensaje del usuario.
const ROLE_LABEL_RE = /^(has dicho|you said|dijiste|tú dijiste|tu dijiste|has preguntado|you asked|you wrote|escribiste|du hast gesagt|vous avez dit|hai detto|você disse|tu as dit)\s*[:：.,\-–—]?$/i;

// Mismo rótulo al principio de un nodo de texto.
const LEADING_ROLE_LABEL_RE = /^\s*(?:has dicho|you said|dijiste|tú dijiste|tu dijiste|has preguntado|you asked|you wrote|escribiste|du hast gesagt|vous avez dit|hai detto|você disse|tu as dit)\s*[:：.,\-–—]?\s*/i;

const ALLOWED_ATTRIBUTES = new Set([
  'href',
  'src',
  'alt',
  'title',
  'colspan',
  'rowspan',
  'class',
]);

// Contenedores de interfaz que pueden envolver una imagen real (por ejemplo,
// el visor ampliado de Gemini). Antes de eliminarlos hay que rescatar la imagen.
const IMAGE_RESCUE_SELECTOR = [
  'button',
  '[role="toolbar"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="tooltip"]',
  '[role="tablist"]',
  '[role="tab"]',
].join(',');

function isAllowedImageSource(src: string): boolean {
  return /^data:image\/[\w.+-]+;base64,/i.test(src) ||
    /^blob:/i.test(src) ||
    /^https?:\/\//i.test(src);
}

function isPlaceholderImageSource(src: string): boolean {
  if (!src) return true;
  if (src.startsWith('data:image/svg+xml')) return true;
  if (src.startsWith('data:image/gif') && src.length < 300) return true;
  return false;
}

function pickSrcsetUrl(srcset: string | null): string {
  if (!srcset) return '';
  const candidates = srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
  return candidates[candidates.length - 1] || '';
}

function normalizeImage(img: HTMLImageElement): void {
  const src = img.getAttribute('src') || '';
  const lazySrc = img.getAttribute('data-src') ||
    img.getAttribute('data-lazy-src') ||
    img.getAttribute('data-original') ||
    '';
  const srcset = pickSrcsetUrl(
    img.getAttribute('srcset') || img.getAttribute('data-srcset')
  );

  // Gemini y otras webs usan un SVG/GIF transparente como placeholder y
  // guardan la imagen real en data-src o srcset.
  let raw = !isPlaceholderImageSource(src) ? src : '';
  if (!raw && !isPlaceholderImageSource(lazySrc)) raw = lazySrc;
  if (!raw && srcset) raw = srcset;
  if (!raw) raw = src || lazySrc;

  if (!raw) {
    img.remove();
    return;
  }

  let absolute = raw;
  try {
    absolute = new URL(raw, document.baseURI).href;
  } catch {
    // Se deja tal cual y se valida abajo.
  }

  if (!isAllowedImageSource(absolute)) {
    img.remove();
    return;
  }

  img.setAttribute('src', absolute);
  if (!img.getAttribute('alt')) img.setAttribute('alt', 'Image');
}

function extractTex(element: Element): string {
  const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
  const annotationTex = annotation?.textContent?.trim();
  if (annotationTex) return annotationTex;

  const dataLatex = element.getAttribute('data-latex') ||
    element.querySelector('[data-latex]')?.getAttribute('data-latex');
  return dataLatex?.trim() || '';
}

/**
 * Convierte las fórmulas ya renderizadas por KaTeX/MathJax en delimitadores
 * TeX. Así el preview puede volver a renderizarlas con KaTeX y el PDF conserva
 * la fórmula; sin esto se exporta el HTML interno de KaTeX, que depende de su
 * CSS y acaba invisible o roto fuera de la página original.
 */
function normalizeMath(root: DocumentFragment): void {
  const replaceFormula = (element: Element, display: boolean, tex: string) => {
    if (!tex) return;
    const replacement = document.createElement(display ? 'div' : 'span');
    replacement.className = 'math-tex';
    replacement.textContent = display ? `$$${tex}$$` : `$${tex}$`;
    element.replaceWith(replacement);
  };

  root.querySelectorAll('.katex').forEach((element) => {
    const display = !!element.closest('.katex-display');
    const outer = element.closest('.katex-display') || element;
    const tex = extractTex(element);
    if (tex) replaceFormula(outer, display, tex);
  });

  root.querySelectorAll('mjx-container').forEach((element) => {
    const display = element.getAttribute('display') === 'true' ||
      element.getAttribute('display') === 'block';
    replaceFormula(element, display, extractTex(element));
  });

  root.querySelectorAll('math').forEach((element) => {
    if (element.closest('.katex, mjx-container')) return;
    const display = element.getAttribute('display') === 'block';
    replaceFormula(element, display, extractTex(element));
  });
}

function rescueImagesFromUi(root: DocumentFragment): void {
  const rescued = new Set<Element>();

  root.querySelectorAll(IMAGE_RESCUE_SELECTOR).forEach((wrapper) => {
    wrapper.querySelectorAll('img').forEach((img) => {
      if (rescued.has(img)) return;
      rescued.add(img);

      // Insertar la imagen fuera del contenedor eliminable más alto.
      let anchor: Element = wrapper;
      while (
        anchor.parentElement &&
        anchor.parentElement !== (root as unknown as Element) &&
        anchor.parentElement.matches(IMAGE_RESCUE_SELECTOR)
      ) {
        anchor = anchor.parentElement;
      }
      if (!anchor.parentNode) return;

      const holder = img.closest('picture') || img;
      anchor.parentNode.insertBefore(holder.cloneNode(true), anchor);
    });
  });
}

function stripAttributes(root: DocumentFragment): void {
  root.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (!ALLOWED_ATTRIBUTES.has(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
      }
    });
  });
}

function removeHiddenElements(root: DocumentFragment): void {
  root.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
    if (el.tagName === 'BR') return;
    if (el.querySelector('img, code, pre')) return;
    // KaTeX y MathJax marcan como aria-hidden la representación visual de una
    // fórmula. No es interfaz: es el contenido matemático.
    if (el.matches('.katex-html, .katex-mathml, mjx-container') ||
      el.querySelector('.katex, .katex-html, mjx-container, math')) return;
    el.remove();
  });

  // Los avisos de estado ("pensando", "generando"...) son UI, pero hay webs
  // que envuelven la respuesta completa en una región viva. Sólo se eliminan
  // si son cortos y no contienen contenido real.
  root.querySelectorAll('[role="status"], [role="alert"], [aria-live]').forEach((el) => {
    if (el.querySelector('img, code, pre, p, ul, ol, table')) return;
    const text = (el.textContent || '').trim();
    if (text.length <= 120) el.remove();
  });

  root.querySelectorAll('*').forEach((el) => {
    const element = el as HTMLElement;
    if (element.style && (element.style.display === 'none' || element.style.visibility === 'hidden')) {
      element.remove();
    }
  });
}

function removeRoleLabels(root: DocumentFragment, role?: Role): void {
  root.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span, strong, b').forEach((el) => {
    if (el.children.length > 0) return;
    const text = (el.textContent || '').trim();
    if (text && ROLE_LABEL_RE.test(text)) el.remove();
  });

  // Algunas webs insertan el rótulo como texto suelto ("Has dicho: ...").
  if (role !== 'user') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeValue && node.nodeValue.trim()) {
      node.nodeValue = node.nodeValue.replace(LEADING_ROLE_LABEL_RE, '');
      break;
    }
    node = walker.nextNode();
  }
}

function unwrapCustomElements(root: DocumentFragment): void {
  root.querySelectorAll('*').forEach((el) => {
    if (!el.tagName.includes('-')) return;
    if (!el.parentNode) return;
    el.replaceWith(...Array.from(el.childNodes));
  });
}

export function sanitizeMessageHtml(html: string, role?: Role): string {
  if (!html) return '';

  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;

  normalizeMath(root);
  rescueImagesFromUi(root);
  root.querySelectorAll(DROP_SELECTOR).forEach((el) => el.remove());
  removeHiddenElements(root);
  unwrapCustomElements(root);
  removeRoleLabels(root, role);

  root.querySelectorAll('img').forEach((img) => normalizeImage(img as HTMLImageElement));

  stripAttributes(root);

  return template.innerHTML.replace(/\s+$/g, '').trim();
}

/** Comprueba si, tras limpiar, el mensaje tiene contenido relevante. */
export function hasMeaningfulContent(html: string): boolean {
  if (!html) return false;
  if (/<img\b/i.test(html)) return true;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
  return text.length > 0;
}
