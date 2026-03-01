/**
 * Highlighter module - подсветка элементов при наведении мыши
 */

let highlightDiv: HTMLDivElement | null = null;
let isHighlighting = false;

/**
 * Создает div для подсветки элемента
 */
function createHighlightDiv(): HTMLDivElement {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.border = '2px solid red';
  div.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '999999';
  div.style.boxSizing = 'border-box';
  div.id = 'ai-playwright-highlighter';
  return div;
}

/**
 * Подсвечивает элемент
 */
export function highlightElement(element: HTMLElement): void {
  if (isHighlighting) return;
  
  const rect = element.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  if (!highlightDiv) {
    highlightDiv = createHighlightDiv();
    document.body.appendChild(highlightDiv);
  }

  highlightDiv.style.left = `${rect.left + scrollX}px`;
  highlightDiv.style.top = `${rect.top + scrollY}px`;
  highlightDiv.style.width = `${rect.width}px`;
  highlightDiv.style.height = `${rect.height}px`;
  
  isHighlighting = true;
}

/**
 * Убирает подсветку
 */
export function removeHighlight(): void {
  if (highlightDiv && highlightDiv.parentNode) {
    highlightDiv.parentNode.removeChild(highlightDiv);
    highlightDiv = null;
  }
  isHighlighting = false;
}

/**
 * Проверяет, является ли элемент хайлайтером
 */
export function isHighlightElement(element: HTMLElement | null): boolean {
  return element?.id === 'ai-playwright-highlighter' || false;
}
