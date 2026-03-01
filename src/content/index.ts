/**
 * Content Script - главный модуль для записи действий на странице
 */

import { highlightElement, removeHighlight, isHighlightElement } from './highlighter';
import { getTargetElement, createActionRecord } from './recorder';
import { RecordedAction, RecordingState } from './types';

let isRecording = false;
let recordedActions: RecordedAction[] = [];

/**
 * Инициализация записи
 */
function initRecording(): void {
  if (isRecording) return;

  isRecording = true;
  recordedActions = [];
  
  // Подсветка при наведении
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  
  // Запись кликов
  document.addEventListener('click', handleClick, true);
  
  // Запись ввода текста
  document.addEventListener('input', handleInput, true);
  
  // Запись изменений select
  document.addEventListener('change', handleChange, true);
  
  console.log('[AI Playwright Recorder] Recording started');
}

/**
 * Остановка записи
 */
function stopRecording(): void {
  if (!isRecording) return;

  isRecording = false;
  removeHighlight();
  
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('change', handleChange, true);
  
  console.log('[AI Playwright Recorder] Recording stopped. Actions:', recordedActions);
  
  // Отправляем данные в background script
  chrome.runtime.sendMessage({
    type: 'RECORDING_STOPPED',
    actions: recordedActions,
  });
}

/**
 * Обработчик наведения мыши
 */
function handleMouseOver(event: MouseEvent): void {
  if (!isRecording) return;
  
  const element = getTargetElement(event);
  if (element && !isHighlightElement(element)) {
    highlightElement(element);
  }
}

/**
 * Обработчик ухода мыши
 */
function handleMouseOut(event: MouseEvent): void {
  if (!isRecording) return;
  removeHighlight();
}

/**
 * Обработчик клика
 */
function handleClick(event: MouseEvent): void {
  if (!isRecording) return;
  
  const element = getTargetElement(event);
  if (!element) return;

  // Игнорируем клики на хайлайтере
  if (isHighlightElement(element)) return;

  const action = createActionRecord('click', element);
  if (action) {
    recordedActions.push(action);
    console.log('[AI Playwright Recorder] Click recorded:', action);
  }
}

/**
 * Обработчик ввода текста
 */
function handleInput(event: Event): void {
  if (!isRecording) return;
  
  const element = getTargetElement(event);
  if (!element || !(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return;
  }

  const action = createActionRecord('fill', element, element.value);
  if (action) {
    // Обновляем последнее действие fill для того же элемента или добавляем новое
    const lastActionIndex = recordedActions.length - 1;
    if (lastActionIndex >= 0 && 
        recordedActions[lastActionIndex].type === 'fill' &&
        recordedActions[lastActionIndex].element?.testId === action.element?.testId) {
      recordedActions[lastActionIndex] = action;
    } else {
      recordedActions.push(action);
    }
    console.log('[AI Playwright Recorder] Input recorded:', action);
  }
}

/**
 * Обработчик изменения select
 */
function handleChange(event: Event): void {
  if (!isRecording) return;
  
  const element = getTargetElement(event);
  if (!element || !(element instanceof HTMLSelectElement)) {
    return;
  }

  const selectedOption = element.options[element.selectedIndex];
  const action = createActionRecord('select', element, selectedOption?.value || selectedOption?.text);
  if (action) {
    recordedActions.push(action);
    console.log('[AI Playwright Recorder] Select recorded:', action);
  }
}

/**
 * Слушаем сообщения от background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    initRecording();
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording();
    sendResponse({ success: true, actions: recordedActions });
  } else if (message.type === 'GET_RECORDING_STATE') {
    sendResponse({ 
      isRecording, 
      actionCount: recordedActions.length 
    });
  }
  
  return true; // Асинхронный ответ
});

// Отправляем состояние при загрузке страницы
chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
});
