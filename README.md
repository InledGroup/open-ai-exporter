# AI Exporter  
Completely free, fully compatible with Gemini, Claude, ChatGPT and NotebookLM.  

## Why?  
Because I dont found any completely free and auditable extension for exporting conversations that may can include confidential data.  

## What's this?  
This is a Chrome extension that allows you to export conversations from Gemini, ChatGPT, Claude and NotebookLM.  
It's completely free and local, nothing is uploaded to any server. Fully private and auditable.  

- Select individual messages or export all easily.  
- Export to many formats  
- Preview your export  

## Export formats  
- PDF
- DOCX  
- MD
- JSON
- TXT

## Build and test in the browser  

Requirements: Node.js 18+ and npm.  

Install dependencies once:  

```bash
npm install
```

### Chrome / Edge  

1. Build the extension:  

```bash
npm run build:chrome
```

2. Open `chrome://extensions` (or `edge://extensions`).  
3. Enable **Developer mode**.  
4. Click **Load unpacked** and select the generated `dist` folder.  
5. Open a supported chat (ChatGPT, Gemini, Claude, NotebookLM, Perplexity, Kimi, DeepSeek) or Google AI Mode (`https://www.google.com/search?udm=50`), then click the extension icon to test the export.  

After changing the code, run `npm run build:chrome` again and click the reload button on the extension card. Reload the chat tab afterwards so the content script is injected again.  

### Firefox  

1. Build the extension:  

```bash
npm run build:firefox
```

2. Open `about:debugging#/runtime/this-firefox`.  
3. Click **Load Temporary Add-on…** and select `dist/manifest.json`.  

Temporary add-ons are removed when Firefox closes, so load it again after restarting the browser.  

### Create distributable packages  

```bash
npm run package:chrome
npm run package:firefox
```

The ZIP files are written to `artifacts/chrome` and `artifacts/firefox`.  

> `npm run dev` only serves the popup/preview UI with Vite; it does not load the extension in the browser. Use the build commands above to test the full extension.  

## Tech stack  
- Preact  
- KateX  
- Lucide Icons
