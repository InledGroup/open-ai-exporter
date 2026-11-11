/**
 * Convierte las imágenes de un mensaje a data: URLs antes de enviarlo al
 * preview. Es necesario porque muchas webs (ChatGPT, Claude, Gemini...) usan
 * URLs blob: de su propio origen o CDNs que rechazan la petición desde la
 * página de la extensión. El content script sí puede leerlas.
 */
export async function inlineMessageImages(html: string): Promise<string> {
  if (!/<img\b/i.test(html)) return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  const images = Array.from(template.content.querySelectorAll('img'));

  await Promise.all(images.map(async (img) => {
    const src = img.getAttribute('src') || '';
    if (!src || /^data:/i.test(src)) return;

    const dataUrl = await fetchAsDataUrl(src);
    if (dataUrl) img.setAttribute('src', dataUrl);
  }));

  return template.innerHTML;
}

async function fetchAsDataUrl(src: string): Promise<string | null> {
  // Las imágenes blob: sólo existen en el origen de la pestaña; se leen aquí,
  // no desde el service worker.
  try {
    const response = await fetch(src, { credentials: 'include' });
    if (response.ok) {
      const blob = await response.blob();
      if (blob.type.startsWith('image/')) return blobToDataUrl(blob);
    }
  } catch {
    // Puede ser una imagen cross-origin sin CORS; se prueba el service worker.
  }

  if (!/^https?:/i.test(src)) return null;

  try {
    const runtime = (globalThis as any).browser?.runtime ||
      (globalThis as any).chrome?.runtime;
    if (!runtime?.sendMessage) return null;

    const result = await runtime.sendMessage({
      type: 'AI_EXPORTER_FETCH_IMAGE',
      url: src,
    });
    return result?.ok && result.dataUrl ? result.dataUrl : null;
  } catch {
    // Si no se puede descargar, se conserva la URL original.
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
