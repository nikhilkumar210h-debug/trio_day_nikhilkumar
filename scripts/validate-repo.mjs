import { readdir, readFile } from 'node:fs/promises';
import { join, relative, dirname, normalize } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const publicDir = join(root, 'public');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const files = await walk(publicDir);
const jsFiles = files.filter(f => f.endsWith('.js'));

let failed = false;

for (const file of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed = true;
    console.error('\nJS syntax error:', relative(root, file));
    console.error(r.stderr || r.stdout);
  }
}

const existing = new Set(files.map(f => normalize(relative(publicDir, f)).replaceAll('\\', '/')));
const htmlFiles = files.filter(f => f.endsWith('.html'));
const refRe = /(?:href|src)=["']([^"']+)["']/gi;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const baseDir = dirname(relative(publicDir, file));
  for (const match of html.matchAll(refRe)) {
    const ref = match[1].split('#')[0].split('?')[0];
    if (!ref || /^(https?:|data:|mailto:|tel:|javascript:|\/)/i.test(ref)) continue;
    const target = normalize(join(baseDir, ref)).replaceAll('\\', '/');
    if (target.startsWith('../') || !existing.has(target)) {
      failed = true;
      console.error('Broken local HTML reference:', relative(root, file), '->', ref);
    }
  }
}

try {
  JSON.parse(await readFile(join(root, 'firestore.indexes.json'), 'utf8'));
  JSON.parse(await readFile(join(root, 'firebase.json'), 'utf8'));
} catch (err) {
  failed = true;
  console.error('Invalid JSON config:', err.message);
}

if (failed) process.exit(1);
console.log('Trio Day release checks passed:', jsFiles.length, 'JS files and', htmlFiles.length, 'HTML files scanned.');
