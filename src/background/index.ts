import browser from 'webextension-polyfill';

browser.runtime.onInstalled.addListener(() => {
  console.log("AI Exporter: Extensión instalada.");
});

/**
 * Algunas imágenes (Gemini) sólo se pueden descargar desde la página original:
 * su CDN rechaza el hotlink desde la página de preview. El service worker sí
 * tiene permisos de host, así que las convierte a data: para incrustarlas.
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
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
      if (!blob.type.startsWith('image/')) return { ok: false };

      return { ok: true, dataUrl: await blobToDataUrl(blob) };
    } catch (err) {
      console.warn('AI Exporter: no se pudo descargar una imagen', err);
      return { ok: false };
    }
  })();
});
