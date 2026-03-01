/**
 * Background Service Worker - главный модуль управления записью
 */

import { generateLocatorsForActions } from './llm.service';
import { generatePythonCode, generateEnvFile } from './code-generator';
import { saveFiles } from './fs.service';
import { LLMConfig, StorageData } from './types';
import { RecordedAction } from '../content/types';

let recordingState = {
  isRecording: false,
  actions: [] as RecordedAction[],
};

/**
 * Загружает конфигурацию из storage
 */
async function loadConfig(): Promise<LLMConfig> {
  const data = await chrome.storage.local.get(['apiKey', 'llmProvider', 'llmModel']) as StorageData;
  
  return {
    provider: (data as any).llmProvider || 'openai',
    apiKey: data.apiKey,
    model: (data as any).llmModel || 'gpt-4-turbo-preview',
  };
}

/**
 * Сохраняет конфигурацию в storage
 */
async function saveConfig(config: Partial<LLMConfig>): Promise<void> {
  const toSave: Record<string, any> = {};
  
  if (config.apiKey !== undefined) {
    toSave.apiKey = config.apiKey;
  }
  if (config.provider !== undefined) {
    toSave.llmProvider = config.provider;
  }
  if (config.model !== undefined) {
    toSave.llmModel = config.model;
  }
  
  await chrome.storage.local.set(toSave);
}

/**
 * Обработка сообщений
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Асинхронный ответ
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'START_RECORDING':
      recordingState.isRecording = true;
      recordingState.actions = [];
      
      // Отправляем сообщение всем content scripts
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'START_RECORDING' });
      }
      
      return { success: true };

    case 'STOP_RECORDING':
      recordingState.isRecording = false;
      
      // Получаем финальные действия от content script
      if (message.actions) {
        recordingState.actions = message.actions;
      }
      
      return { 
        success: true, 
        actionCount: recordingState.actions.length 
      };

    case 'GET_RECORDING_STATE':
      return {
        isRecording: recordingState.isRecording,
        actionCount: recordingState.actions.length,
      };

    case 'GENERATE_TEST':
      return await handleGenerateTest(message.actions || recordingState.actions);

    case 'SELECT_DIRECTORY':
      // Запрос выбора директории должен быть из popup, не из background
      return { error: 'Use selectDirectory from popup context' };

    case 'SAVE_CONFIG':
      await saveConfig(message.config);
      return { success: true };

    case 'GET_CONFIG':
      const config = await loadConfig();
      return { config };

    case 'CONTENT_SCRIPT_READY':
      // Content script готов, можно синхронизировать состояние
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}

/**
 * Генерирует тест из записанных действий
 */
async function handleGenerateTest(actions: RecordedAction[]) {
  try {
    if (!actions || actions.length === 0) {
      return { error: 'No actions recorded' };
    }

    const config = await loadConfig();
    
    // Генерируем локаторы через LLM
    console.log('[Background] Generating locators for', actions.length, 'actions');
    const locators = await generateLocatorsForActions(actions, config);
    
    // Генерируем Python код
    const initialUrl = actions[0]?.url;
    const pythonCode = generatePythonCode(actions, locators, initialUrl);
    
    // Генерируем .env файл
    const envContent = generateEnvFile(actions);
    
    // Генерируем JSON лог
    const logContent = JSON.stringify(actions, null, 2);
    
    return {
      success: true,
      files: [
        { filename: 'test_generated.py', content: pythonCode },
        { filename: '.env.example', content: envContent },
        { filename: 'session_log.json', content: logContent },
      ],
    };
  } catch (error) {
    console.error('[Background] Error generating test:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Обработчик установки расширения
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AI Playwright Recorder] Extension installed');
});
