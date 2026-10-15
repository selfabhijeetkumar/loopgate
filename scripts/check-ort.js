/**
 * scripts/check-ort.js
 * Verifies that onnxruntime-web wasm and mjs assets exist in public/ort
 * so in-browser execution has zero dependency on external CDNs.
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
];

const ortDir = path.join(__dirname, '..', 'public', 'ort');

if (!fs.existsSync(ortDir)) {
  console.error('[ERROR] public/ort directory does not exist!');
  process.exit(1);
}

for (const file of REQUIRED_FILES) {
  const filePath = path.join(ortDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] Missing required ORT asset: ${file}`);
    process.exit(1);
  }
}

console.log('✓ All required local onnxruntime-web assets exist in public/ort');
