import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const preloadJs = path.join(__dirname, '../dist-electron/preload.js');
const preloadCjs = path.join(__dirname, '../dist-electron/preload.cjs');

if (fs.existsSync(preloadJs)) {
  fs.renameSync(preloadJs, preloadCjs);
  console.log('Renamed preload.js to preload.cjs');
}

