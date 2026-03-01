/**
 * Скрипт для копирования статических файлов в dist
 */

const fs = require('fs');
const path = require('path');

const staticFiles = ['popup.html', 'popup.css', 'popup.js', 'manifest.json'];
const staticDirs = ['icons'];

function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    
    if (stat.isFile()) {
      copyFile(srcPath, destPath);
    } else if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    }
  });
}

// Копируем файлы
staticFiles.forEach(file => {
  copyFile(file, path.join('dist', file));
});

// Копируем директории
staticDirs.forEach(dir => {
  copyDir(dir, path.join('dist', dir));
});

console.log('Static files copied successfully!');
