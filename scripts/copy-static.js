/**
 * Script to copy static files into dist/
 * Uses ES module syntax (package.json has "type": "module")
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const staticFiles = [
  'popup.html', 'popup.css', 'popup.js',
  'sidepanel.html', 'sidepanel.css', 'sidepanel.js',
  'manifest.json',
];
const staticDirs = ['icons'];

function copyFile(src, dest) {
  if (existsSync(src)) {
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  }
}

function copyDir(src, dest) {
  if (!existsSync(src)) return;

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const files = readdirSync(src);
  files.forEach(file => {
    const srcPath = join(src, file);
    const destPath = join(dest, file);
    const stat = statSync(srcPath);

    if (stat.isFile()) {
      copyFile(srcPath, destPath);
    } else if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    }
  });
}

// Copy static files
staticFiles.forEach(file => {
  copyFile(file, join('dist', file));
});

// Copy static directories
staticDirs.forEach(dir => {
  if (existsSync(dir)) {
    copyDir(dir, join('dist', dir));
  } else {
    console.log(`Warning: ${dir} directory not found. Icons will be missing.`);
    const destDir = join('dist', dir);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
      if (dir === 'icons') {
        writeFileSync(
          join(destDir, 'README.txt'),
          'Place icon16.png, icon48.png, and icon128.png here'
        );
      }
    }
  }
});

console.log('\nStatic files copied successfully!');
console.log('Note: If icons are missing, create icon16.png, icon48.png, and icon128.png in icons/ folder');
