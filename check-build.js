/**
 * Скрипт для проверки готовности проекта к загрузке в Chrome
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка структуры проекта...\n');

const requiredFiles = [
  'dist/background/index.js',
  'dist/content/index.js',
  'dist/popup.html',
  'dist/popup.css',
  'dist/popup.js',
  'dist/manifest.json',
];

const requiredDirs = [
  'dist',
  'dist/background',
  'dist/content',
];

let hasErrors = false;

// Проверка директорий
console.log('📁 Проверка директорий:');
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`  ✅ ${dir}`);
  } else {
    console.log(`  ❌ ${dir} - НЕ НАЙДЕНА`);
    hasErrors = true;
  }
});

console.log('\n📄 Проверка файлов:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`  ✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`  ❌ ${file} - НЕ НАЙДЕН`);
    hasErrors = true;
  }
});

// Проверка manifest.json
console.log('\n📋 Проверка manifest.json:');
try {
  const manifestPath = 'dist/manifest.json';
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Проверка путей
    if (manifest.background?.service_worker) {
      const bgPath = manifest.background.service_worker;
      if (fs.existsSync(path.join('dist', bgPath))) {
        console.log(`  ✅ Background script: ${bgPath}`);
      } else {
        console.log(`  ❌ Background script не найден: ${bgPath}`);
        hasErrors = true;
      }
    }
    
    if (manifest.content_scripts?.[0]?.js) {
      manifest.content_scripts[0].js.forEach(jsPath => {
        const fullPath = path.join('dist', jsPath);
        if (fs.existsSync(fullPath)) {
          console.log(`  ✅ Content script: ${jsPath}`);
        } else {
          console.log(`  ❌ Content script не найден: ${jsPath}`);
          hasErrors = true;
        }
      });
    }
    
    if (manifest.action?.default_popup) {
      const popupPath = manifest.action.default_popup;
      if (fs.existsSync(path.join('dist', popupPath))) {
        console.log(`  ✅ Popup: ${popupPath}`);
      } else {
        console.log(`  ❌ Popup не найден: ${popupPath}`);
        hasErrors = true;
      }
    }
  } else {
    console.log('  ❌ manifest.json не найден в dist/');
    hasErrors = true;
  }
} catch (error) {
  console.log(`  ❌ Ошибка чтения manifest.json: ${error.message}`);
  hasErrors = true;
}

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('\n❌ Проект НЕ готов к загрузке в Chrome');
  console.log('\n📝 Выполните:');
  console.log('   1. npm install');
  console.log('   2. npm run build');
  console.log('   3. Загрузите папку dist/ в Chrome');
  process.exit(1);
} else {
  console.log('\n✅ Проект готов к загрузке в Chrome!');
  console.log('\n📝 Следующие шаги:');
  console.log('   1. Откройте chrome://extensions/');
  console.log('   2. Включите "Режим разработчика"');
  console.log('   3. Нажмите "Загрузить распакованное расширение"');
  console.log('   4. Выберите папку dist/');
  process.exit(0);
}
