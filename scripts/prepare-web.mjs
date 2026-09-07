import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files = [
  'index.html',
  'styles.css',
  'charts.css',
  'nutrition.css',
  'manifest.webmanifest',
  'service-worker.js',
  'icon.svg'
];

await rm('www', { recursive: true, force: true });
await mkdir('www', { recursive: true });

for (const file of files) {
  if (existsSync(file)) await cp(file, `www/${file}`);
}

if (existsSync('js')) await cp('js', 'www/js', { recursive: true });

console.log('Prepared web assets in ./www for Capacitor iOS build.');
