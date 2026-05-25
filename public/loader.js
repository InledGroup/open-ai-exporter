(async () => {
  // Cargamos el content script real como un módulo ESM
  const src = chrome.runtime.getURL('content.js');
  await import(src);
})();
