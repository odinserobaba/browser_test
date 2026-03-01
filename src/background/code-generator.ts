/**
 * Code Generator - генерация Python Playwright кода
 */

import { RecordedAction } from '../content/types';

/**
 * Генерирует Python код из действий и локаторов
 */
export function generatePythonCode(
  actions: RecordedAction[],
  locators: string[],
  initialUrl?: string
): string {
  const lines: string[] = [];
  
  // Импорты
  lines.push('import os');
  lines.push('from playwright.sync_api import sync_playwright');
  lines.push('');
  
  // Функция run
  lines.push('def run():');
  lines.push('    with sync_playwright() as p:');
  lines.push('        browser = p.chromium.launch(headless=False)');
  lines.push('        page = browser.new_page()');
  lines.push('');
  
  // Навигация
  if (initialUrl && actions.length > 0) {
    lines.push(`        # Navigation`);
    lines.push(`        page.goto("${initialUrl}")`);
    lines.push(`        page.wait_for_load_state("networkidle")`);
    lines.push('');
  }
  
  // Действия
  let currentUrl = initialUrl;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const locator = locators[i] || `# TODO: Failed to generate locator for ${action.type}`;
    
    // Проверяем изменение URL
    if (action.url !== currentUrl && action.type === 'navigate') {
      lines.push(`        # Navigation to ${action.url}`);
      lines.push(`        page.goto("${action.url}")`);
      lines.push(`        page.wait_for_load_state("networkidle")`);
      lines.push('');
      currentUrl = action.url;
    }
    
    // Комментарий с описанием действия
    const comment = getActionComment(action, i + 1);
    if (comment) {
      lines.push(`        # Step ${i + 1}: ${comment}`);
    }
    
    // Добавляем ожидание перед действием
    if (action.element) {
      lines.push(`        # Wait for element to be ready`);
    }
    
    // Локатор
    lines.push(`        ${locator}`);
    lines.push('');
  }
  
  // Закрытие браузера
  lines.push('        page.close()');
  lines.push('        browser.close()');
  lines.push('');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    run()');
  
  return lines.join('\n');
}

/**
 * Генерирует комментарий для действия
 */
function getActionComment(action: RecordedAction, stepNumber: number): string {
  const { type, element } = action;
  
  if (type === 'click') {
    const target = element?.text || element?.testId || element?.role || 'element';
    return `Click ${target}`;
  } else if (type === 'fill') {
    const field = element?.name || element?.placeholder || element?.testId || 'field';
    return `Fill ${field}`;
  } else if (type === 'select') {
    return `Select option`;
  } else if (type === 'upload') {
    return `Upload file`;
  } else if (type === 'navigate') {
    return `Navigate to ${action.url}`;
  }
  
  return `Action ${type}`;
}

/**
 * Генерирует .env файл с переменными окружения
 */
export function generateEnvFile(actions: RecordedAction[]): string {
  const envVars: Record<string, string> = {};
  
  for (const action of actions) {
    if (action.type === 'fill' && action.element) {
      const { type, name, placeholder } = action.element;
      
      if (type === 'password') {
        envVars['TEST_PASSWORD'] = 'Qwerty123!';
      } else if (type === 'email') {
        envVars['TEST_EMAIL'] = `test_${Date.now()}@example.com`;
      } else if (name) {
        const varName = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        envVars[`TEST_${varName}`] = action.value || '';
      }
    } else if (action.type === 'upload') {
      envVars['UPLOAD_FILE_PATH'] = 'path/to/your/file.pdf';
    }
  }
  
  if (Object.keys(envVars).length === 0) {
    return '# No environment variables needed\n';
  }
  
  const lines: string[] = ['# Environment variables for test execution'];
  for (const [key, value] of Object.entries(envVars)) {
    lines.push(`${key}=${value}`);
  }
  
  return lines.join('\n') + '\n';
}
