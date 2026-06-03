(async () => {
  // Cargamos el content script real como un módulo ESM
  const browserAPI = globalThis.browser || globalThis.chrome;
  const src = browserAPI.runtime.getURL('content.js');
  await import(src);
})();
