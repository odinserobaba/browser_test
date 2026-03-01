/**
 * Script to verify project readiness for Chrome loading
 * Uses ES module syntax (package.json has "type": "module")
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('Checking project structure...\n');

const requiredFiles = [
  'dist/background/index.js',
  'dist/content/index.js',
  'dist/sidepanel.html',
  'dist/sidepanel.css',
  'dist/sidepanel.js',
  'dist/manifest.json',
];

const requiredDirs = [
  'dist',
  'dist/background',
  'dist/content',
];

let hasErrors = false;

// Check directories
console.log('Directories:');
requiredDirs.forEach(dir => {
  if (existsSync(dir)) {
    console.log(`  OK  ${dir}`);
  } else {
    console.log(`  MISSING  ${dir}`);
    hasErrors = true;
  }
});

// Check files
console.log('\nFiles:');
requiredFiles.forEach(file => {
  if (existsSync(file)) {
    const stats = statSync(file);
    console.log(`  OK  ${file} (${stats.size} bytes)`);
  } else {
    console.log(`  MISSING  ${file}`);
    hasErrors = true;
  }
});

// Check manifest.json paths
console.log('\nManifest check:');
try {
  const manifestPath = 'dist/manifest.json';
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    if (manifest.background?.service_worker) {
      const bgPath = manifest.background.service_worker;
      if (existsSync(join('dist', bgPath))) {
        console.log(`  OK  Background script: ${bgPath}`);
      } else {
        console.log(`  MISSING  Background script: ${bgPath}`);
        hasErrors = true;
      }
    }

    if (manifest.content_scripts?.[0]?.js) {
      manifest.content_scripts[0].js.forEach(jsPath => {
        const fullPath = join('dist', jsPath);
        if (existsSync(fullPath)) {
          console.log(`  OK  Content script: ${jsPath}`);
        } else {
          console.log(`  MISSING  Content script: ${jsPath}`);
          hasErrors = true;
        }
      });
    }

    if (manifest.side_panel?.default_path) {
      const spPath = manifest.side_panel.default_path;
      if (existsSync(join('dist', spPath))) {
        console.log(`  OK  Side panel: ${spPath}`);
      } else {
        console.log(`  MISSING  Side panel: ${spPath}`);
        hasErrors = true;
      }
    }
  } else {
    console.log('  MISSING  dist/manifest.json');
    hasErrors = true;
  }
} catch (error) {
  console.log(`  ERROR  reading manifest.json: ${error.message}`);
  hasErrors = true;
}

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('\nProject is NOT ready for Chrome');
  console.log('\nRun:');
  console.log('   1. npm install');
  console.log('   2. npm run build');
  console.log('   3. Load the dist/ folder in Chrome');
  process.exit(1);
} else {
  console.log('\nProject is ready for Chrome!');
  console.log('\nNext steps:');
  console.log('   1. Open chrome://extensions/');
  console.log('   2. Enable "Developer mode"');
  console.log('   3. Click "Load unpacked"');
  console.log('   4. Select the dist/ folder');
  process.exit(0);
}
