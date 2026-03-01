/**
 * Recorder module - сбор данных элементов и запись действий
 */

import { ElementSignature, RecordedAction } from './types';
import { isHighlightElement } from './highlighter';

/**
 * Собирает сигнатуру элемента для последующей генерации локатора
 */
export function collectElementSignature(element: HTMLElement): ElementSignature {
  const signature: ElementSignature = {
    tagName: element.tagName.toLowerCase(),
  };

  // ID (если не динамический)
  if (element.id && !isDynamicId(element.id)) {
    signature.id = element.id;
  }

  // Classes
  if (element.className && typeof element.className === 'string') {
    signature.classes = element.className.split(/\s+/).filter(c => c.length > 0);
  }

  // Text content
  const text = element.innerText?.trim() || element.textContent?.trim();
  if (text && text.length < 100) {
    signature.text = text;
  }

  // Form attributes
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    signature.name = element.name || undefined;
    signature.placeholder = element.placeholder || undefined;
    signature.type = element.type || undefined;
    signature.value = element.value || undefined;
    if (element instanceof HTMLInputElement) {
      signature.checked = element.checked;
    }
  }

  if (element instanceof HTMLSelectElement) {
    signature.name = element.name || undefined;
    signature.selected = element.selectedIndex >= 0;
  }

  if (element instanceof HTMLAnchorElement) {
    signature.href = element.href || undefined;
  }

  // ARIA attributes
  signature.role = element.getAttribute('role') || undefined;

  // Test ID (приоритет!)
  signature.testId = element.getAttribute('data-testid') || undefined;

  return signature;
}

/**
 * Проверяет, является ли ID динамическим (содержит случайные символы)
 */
function isDynamicId(id: string): boolean {
  // Простая эвристика: если ID содержит длинные числа или UUID-подобные строки
  return /^\d{6,}$/.test(id) || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
}

/**
 * Получает HTML сниппет вокруг элемента (3 уровня вложенности)
 */
export function getDomSnapshot(element: HTMLElement, depth: number = 3): string {
  let current: HTMLElement | null = element;
  let html = '';

  // Поднимаемся вверх по DOM дереву
  for (let i = 0; i < depth && current; i++) {
    if (current.parentElement) {
      current = current.parentElement;
    } else {
      break;
    }
  }

  // Клонируем элемент с ограниченной глубиной
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Ограничиваем размер сниппета
  const serializer = new XMLSerializer();
  html = serializer.serializeToString(clone);
  
  // Обрезаем слишком длинные сниппеты
  if (html.length > 2000) {
    html = html.substring(0, 2000) + '...';
  }

  return html;
}

/**
 * Получает целевой элемент из события
 */
export function getTargetElement(event: Event): HTMLElement | null {
  const target = event.target as HTMLElement;
  
  if (!target) return null;
  
  // Игнорируем события на хайлайтере
  if (isHighlightElement(target)) {
    return null;
  }

  // Для событий на дочерних элементах, поднимаемся до интерактивного элемента
  let element: HTMLElement | null = target;
  
  while (element && element !== document.body) {
    const tagName = element.tagName.toLowerCase();
    if (['button', 'a', 'input', 'select', 'textarea', 'label', '[role="button"]'].includes(tagName) ||
        element.getAttribute('role') === 'button' ||
        element.onclick !== null ||
        element.getAttribute('data-testid')) {
      return element;
    }
    element = element.parentElement;
  }

  return target;
}

/**
 * Создает запись действия
 */
export function createActionRecord(
  type: RecordedAction['type'],
  element: HTMLElement | null,
  value?: string
): RecordedAction | null {
  if (!element) return null;

  const signature = collectElementSignature(element);
  const domSnapshot = getDomSnapshot(element);

  return {
    type,
    timestamp: Date.now(),
    url: window.location.href,
    element: signature,
    value,
    domSnapshot,
  };
}
