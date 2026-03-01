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
  if (fs.existsSync(dir)) {
    copyDir(dir, path.join('dist', dir));
  } else {
    console.log(`⚠️  Warning: ${dir} directory not found. Icons will be missing.`);
    // Создаем пустую директорию для структуры
    const destDir = path.join('dist', dir);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      // Создаем README в папке иконок
      if (dir === 'icons') {
        fs.writeFileSync(
          path.join(destDir, 'README.txt'),
          'Place icon16.png, icon48.png, and icon128.png here'
        );
      }
    }
  }
});

console.log('\n✅ Static files copied successfully!');
console.log('⚠️  Note: If icons are missing, create icon16.png, icon48.png, and icon128.png in icons/ folder');
