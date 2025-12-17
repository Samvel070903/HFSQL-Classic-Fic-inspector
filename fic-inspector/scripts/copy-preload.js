const fs = require('fs');
const path = require('path');

// Copier preload.js depuis dist-electron vers dist-electron/preload.js
const preloadSource = path.join(__dirname, '../dist-electron/electron/preload.js');
const preloadDest = path.join(__dirname, '../dist-electron/preload.js');

if (fs.existsSync(preloadSource)) {
  fs.copyFileSync(preloadSource, preloadDest);
  console.log('Preload copied successfully');
} else {
  console.warn('Preload file not found, skipping copy');
}

