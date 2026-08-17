const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'vc-letterHeaded.pdf');
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
const dest = path.join(assetsDir, 'vc-letterHeaded.pdf');
fs.copyFileSync(src, dest);
console.log('Copied PDF to assets successfully');
