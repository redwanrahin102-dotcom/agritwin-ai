import { cpSync, existsSync } from 'fs';
import { resolve } from 'path';

const src = resolve('public');
const dest = resolve('.');

if (!existsSync(src)) {
  console.error('public/ directory not found');
  process.exit(1);
}

console.log('Copying static files from public/ to root...');

const files = [
  'index.html', 'app.js', 'engine.js', 'crops.js', 'ui.js',
  'views-farm.js', 'views-analysis.js', 'supabase.js', 'logo.js',
  'env.js', 'logo.png'
];

for (const file of files) {
  const srcFile = resolve(src, file);
  const destFile = resolve(dest, file);
  if (existsSync(srcFile)) {
    cpSync(srcFile, destFile);
    console.log(`  ✓ ${file}`);
  }
}

console.log('\nBuild complete! Static files copied to root.');
