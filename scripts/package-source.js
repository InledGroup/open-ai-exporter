import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const outputDir = 'artifacts';
const sourceZip = path.join(outputDir, 'source-code.zip');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Eliminamos el zip anterior si existe
if (fs.existsSync(sourceZip)) {
  fs.unlinkSync(sourceZip);
}

console.log('Empaquetando código fuente para revisión de Firefox...');

try {
  // Usamos zip directamente (disponible en la mayoría de sistemas Linux/Mac)
  // -r: recursivo
  // -x: excluir patrones
  const excludePatterns = [
    'node_modules/*',
    'dist/*',
    'sourcecode/*',
    'artifacts/*',
    '.git/*',
    '.DS_Store'
  ].map(p => `"${p}"`).join(' ');

  execSync(`zip -r ${sourceZip} . -x ${excludePatterns}`);
  
  console.log(`¡Éxito! Código fuente empaquetado en: ${sourceZip}`);
  console.log('Nota: Este es el archivo que debes subir a Firefox (AMO) cuando te pregunten por el "Source Code".');
} catch (error) {
  console.error('Error empaquetando el código fuente:', error.message);
  process.exit(1);
}
