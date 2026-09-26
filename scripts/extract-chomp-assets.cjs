/* Extract the delivered CHOMP viewer without modifying the OneDrive originals.
 * Run from the repository root: node scripts/extract-chomp-assets.cjs
 * Then run scripts/optimize-chomp-texture.py with Python + Pillow.
 * The viewer controller is copied once and then maintained in js/vehicle-viewer.js.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const source = fs.readFileSync('CHOMP/CHOMP_viewer.html', 'utf8');
const scripts = [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const payload = scripts.find(match => match[1].includes('id="chomp-data"'));
const bundle = scripts.find(match => match[2].startsWith('/* three.js r160'));
const controller = scripts.find(match => match[1].includes('type="module"'));
if (!payload || !bundle || !controller) throw new Error('CHOMP source layout changed');

fs.mkdirSync('models/chomp', { recursive: true });
fs.writeFileSync('models/chomp/chomp.bin', Buffer.from(payload[2].trim(), 'base64'));
const texture = execFileSync('tar', ['-xOf', 'CHOMP/CHOMP_cic.zip', 'CHOMP_cic/chomp_camo.png'], { maxBuffer: 10 * 1024 * 1024 });
fs.writeFileSync('models/chomp/chomp_camo.png', texture);

const isolated = bundle[2]
  .replace('window.THREE=uu;window.OrbitControls=lc;', 'window.CHOMP_THREE=uu;window.CHOMP_OrbitControls=lc;')
  .replace('window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=ec', 'window.__CHOMP_THREE__=ec');
if (!isolated.includes('window.CHOMP_THREE=uu;window.CHOMP_OrbitControls=lc;')) throw new Error('Three.js namespace was not isolated');
fs.writeFileSync('js/chomp-three.js', isolated);

const controlPath = 'js/vehicle-viewer.js';
if (!fs.existsSync(controlPath)) {
  fs.writeFileSync(controlPath, controller[2]);
  console.log(`Wrote initial ${controlPath}; review and adapt it before use.`);
}
const bytes = fs.statSync('models/chomp/chomp.bin').size;
const headerBytes = fs.readFileSync('models/chomp/chomp.bin').readUInt32LE(0);
const header = JSON.parse(fs.readFileSync('models/chomp/chomp.bin').subarray(4, 4 + headerBytes).toString('utf8'));
console.log({ bytes, chunks: header.chunks.length, parts: header.names.length, textureBytes: texture.length, libraryBytes: isolated.length });
