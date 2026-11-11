import browser from 'webextension-polyfill';

browser.runtime.onInstalled.addListener(() => {
  console.log("AI Exporter: Extensión instalada.");
});

/**
 * Algunas imágenes (Gemini) sólo se pueden descargar desde la página original:
 * su CDN rechaza el hotlink desde la página de preview. El service worker sí
 * tiene permisos de host, así que las convierte a data: para incrustarlas.
 */
async function blobToDataUrl(blob: Blob, mime: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Algunos CDNs devuelven application/octet-stream aunque el contenido sea una
 * imagen. Se detecta por la cabecera para no descartar imágenes válidas.
 */
async function detectImageMime(blob: Blob): Promise<string | null> {
  if (blob.type.startsWith('image/')) return blob.type;

  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);

  if (bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (ascii.startsWith('GIF8')) return 'image/gif';
  if (ascii.startsWith('BM')) return 'image/bmp';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.trimStart().startsWith('<svg') || ascii.includes('<svg')) return 'image/svg+xml';

  return null;
}

browser.runtime.onMessage.addListener((message: any) => {
  if (message?.type !== 'AI_EXPORTER_FETCH_IMAGE' || !message.url) {
    return;
  }

  return (async () => {
    try {
      const response = await fetch(message.url, {
        credentials: 'include',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) return { ok: false };

      const blob = await response.blob();
      const mime = await detectImageMime(blob);
      if (!mime) return { ok: false };

      return { ok: true, dataUrl: await blobToDataUrl(blob, mime) };
    } catch (err) {
      console.warn('AI Exporter: no se pudo descargar una imagen', err);
      return { ok: false };
    }
  })();
});
