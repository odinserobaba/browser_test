/**
 * Popup Script - управление UI расширения
 */

let recordingState = {
  isRecording: false,
  actionCount: 0,
};

let selectedDirectoryHandle = null;

// Элементы UI
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const generateBtn = document.getElementById('generateBtn');
const selectDirBtn = document.getElementById('selectDirBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const actionsCount = document.getElementById('actionsCount');
const actionsCountValue = document.getElementById('actionsCountValue');
const apiKeyInput = document.getElementById('apiKey');
const llmProviderSelect = document.getElementById('llmProvider');
const llmModelInput = document.getElementById('llmModel');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const selectedDir = document.getElementById('selectedDir');
const selectedDirPath = document.getElementById('selectedDirPath');
const messageDiv = document.getElementById('message');

/**
 * Показывает сообщение
 */
function showMessage(text, type = 'info') {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 5000);
}

/**
 * Обновляет состояние UI
 */
function updateUI() {
  if (recordingState.isRecording) {
    statusIndicator.classList.add('recording');
    statusText.textContent = 'Идет запись...';
    startBtn.disabled = true;
    stopBtn.disabled = false;
    generateBtn.disabled = true;
  } else {
    statusIndicator.classList.remove('recording');
    statusText.textContent = 'Готов к записи';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    generateBtn.disabled = recordingState.actionCount === 0;
  }

  if (recordingState.actionCount > 0) {
    actionsCount.style.display = 'block';
    actionsCountValue.textContent = recordingState.actionCount;
  } else {
    actionsCount.style.display = 'none';
  }
}

/**
 * Загружает конфигурацию
 */
async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (response.config) {
      apiKeyInput.value = response.config.apiKey || '';
      llmProviderSelect.value = response.config.provider || 'openai';
      llmModelInput.value = response.config.model || 'gpt-4-turbo-preview';
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

/**
 * Загружает состояние записи
 */
async function loadRecordingState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
    if (response) {
      recordingState.isRecording = response.isRecording || false;
      recordingState.actionCount = response.actionCount || 0;
      updateUI();
    }
  } catch (error) {
    console.error('Error loading recording state:', error);
  }
}

/**
 * Начинает запись
 */
async function startRecording() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    if (response.success) {
      recordingState.isRecording = true;
      updateUI();
      showMessage('Запись начата', 'success');
      
      // Обновляем состояние периодически
      const interval = setInterval(async () => {
        if (!recordingState.isRecording) {
          clearInterval(interval);
          return;
        }
        await loadRecordingState();
      }, 1000);
    }
  } catch (error) {
    showMessage('Ошибка при запуске записи', 'error');
    console.error('Error starting recording:', error);
  }
}

/**
 * Останавливает запись
 */
async function stopRecording() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    if (response.success) {
      recordingState.isRecording = false;
      recordingState.actionCount = response.actionCount || 0;
      updateUI();
      showMessage(`Запись остановлена. Записано действий: ${recordingState.actionCount}`, 'success');
    }
  } catch (error) {
    showMessage('Ошибка при остановке записи', 'error');
    console.error('Error stopping recording:', error);
  }
}

/**
 * Выбирает директорию для сохранения
 */
async function selectDirectory() {
  try {
    // File System Access API должен вызываться из popup, не из background
    if ('showDirectoryPicker' in window) {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      selectedDirectoryHandle = handle;
      selectedDirPath.textContent = handle.name;
      selectedDir.style.display = 'block';
      showMessage('Директория выбрана', 'success');
    } else {
      showMessage('File System Access API не поддерживается. Используется Downloads API.', 'info');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      showMessage('Ошибка при выборе директории', 'error');
      console.error('Error selecting directory:', error);
    }
  }
}

/**
 * Генерирует тест
 */
async function generateTest() {
  if (recordingState.actionCount === 0) {
    showMessage('Нет записанных действий', 'error');
    return;
  }

  try {
    showMessage('Генерация теста...', 'info');
    generateBtn.disabled = true;

    const response = await chrome.runtime.sendMessage({ type: 'GENERATE_TEST' });
    
    if (response.error) {
      showMessage(`Ошибка: ${response.error}`, 'error');
      generateBtn.disabled = false;
      return;
    }

    if (response.files && response.files.length > 0) {
      // Сохраняем файлы
      if (selectedDirectoryHandle) {
        // Используем File System Access API через content script или downloads
        for (const file of response.files) {
          const blob = new Blob([file.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          
          await chrome.downloads.download({
            url,
            filename: file.filename,
            saveAs: false,
          });
          
          URL.revokeObjectURL(url);
        }
        showMessage('Тест сгенерирован и сохранен!', 'success');
      } else {
        // Используем downloads API
        for (const file of response.files) {
          const blob = new Blob([file.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          
          await chrome.downloads.download({
            url,
            filename: file.filename,
            saveAs: true,
          });
          
          URL.revokeObjectURL(url);
        }
        showMessage('Тест сгенерирован! Проверьте папку загрузок.', 'success');
      }
    }

    generateBtn.disabled = false;
  } catch (error) {
    showMessage('Ошибка при генерации теста', 'error');
    console.error('Error generating test:', error);
    generateBtn.disabled = false;
  }
}

/**
 * Сохраняет конфигурацию
 */
async function saveConfig() {
  try {
    const config = {
      apiKey: apiKeyInput.value.trim(),
      provider: llmProviderSelect.value,
      model: llmModelInput.value.trim() || 'gpt-4-turbo-preview',
    };

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config,
    });

    if (response.success) {
      showMessage('Настройки сохранены', 'success');
    }
  } catch (error) {
    showMessage('Ошибка при сохранении настроек', 'error');
    console.error('Error saving config:', error);
  }
}

// Обработчики событий
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
generateBtn.addEventListener('click', generateTest);
selectDirBtn.addEventListener('click', selectDirectory);
saveConfigBtn.addEventListener('click', saveConfig);

// Инициализация
loadConfig();
loadRecordingState();

// Обновляем состояние каждые 2 секунды
setInterval(loadRecordingState, 2000);
