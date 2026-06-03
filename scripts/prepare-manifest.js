import fs from 'fs';
import path from 'path';

const browser = process.env.BROWSER || 'chrome';
const isFirefox = browser === 'firefox';
const manifestPath = path.resolve('public/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (isFirefox) {
  // Para Firefox, preferimos usar background.scripts en lugar de service_worker
  // para mayor compatibilidad en MV3 (FF 109+)
  if (manifest.background && manifest.background.service_worker) {
    manifest.background.scripts = [manifest.background.service_worker];
    delete manifest.background.service_worker;
  }
  // Añadimos permiso de recolección de datos (requerido para nuevas extensiones en FF)
  if (manifest.browser_specific_settings && manifest.browser_specific_settings.gecko) {
    manifest.browser_specific_settings.gecko.data_collection_permissions = {
      policy_url: "https://inled.es/privacy",
      required: ["telemetry"]
    };
  }
} else {
  // Para Chrome, eliminamos settings específicos de Firefox que puedan dar warnings
  if (manifest.browser_specific_settings) {
    delete manifest.browser_specific_settings;
  }
  // Aseguramos que usamos service_worker (ya debería estar así en el original)
}

const distManifestPath = path.resolve('dist/manifest.json');
fs.writeFileSync(distManifestPath, JSON.stringify(manifest, null, 2));
console.log(`Manifest preparado para ${browser.toUpperCase()}`);
