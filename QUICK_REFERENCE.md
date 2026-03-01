# 📚 Быстрая справка

## Команды

```bash
# Установка зависимостей
npm install

# Разработка (watch mode)
npm run dev

# Production сборка
npm run build

# Проверка типов
npx tsc --noEmit
```

## Горячие клавиши (в разработке)

- `Ctrl+Shift+R` - Перезагрузить расширение
- `F12` - Открыть DevTools на странице
- `chrome://extensions/` - Управление расширениями

## Структура сообщений

### Content Script → Background

```javascript
// Начало записи
chrome.runtime.sendMessage({ type: 'START_RECORDING' });

// Остановка записи
chrome.runtime.sendMessage({ 
  type: 'STOP_RECORDING',
  actions: [...]
});

// Получение состояния
chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
```

### Popup → Background

```javascript
// Генерация теста
chrome.runtime.sendMessage({ type: 'GENERATE_TEST' });

// Сохранение конфигурации
chrome.runtime.sendMessage({ 
  type: 'SAVE_CONFIG',
  config: { apiKey: '...', provider: 'openai' }
});
```

## Приоритеты селекторов

1. **`get_by_test_id()`** - Самый надежный
2. **`get_by_role()`** - Семантический доступ
3. **`get_by_label()`** - Для форм
4. **`get_by_text()`** - Для текстовых элементов
5. **`locator()`** - CSS fallback

## Типы действий

- `click` - Клик по элементу
- `fill` - Ввод текста
- `select` - Выбор опции
- `navigate` - Навигация
- `upload` - Загрузка файла

## Переменные окружения

Автоматически генерируются для:
- `TEST_EMAIL` - Email поля
- `TEST_PASSWORD` - Пароль поля
- `UPLOAD_FILE_PATH` - Путь к файлу

## Отладка

### Content Script
```javascript
// В консоли страницы
console.log('[AI Playwright Recorder]', ...);
```

### Background Service Worker
```javascript
// В Service Worker DevTools
console.log('[Background]', ...);
```

### Popup
```javascript
// В Popup DevTools (правый клик → Inspect)
console.log('[Popup]', ...);
```

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| API ключ не работает | Проверьте баланс OpenAI |
| Локаторы не генерируются | Используйте fallback режим |
| Файлы не сохраняются | Используйте Downloads API |
| Подсветка не работает | Перезагрузите страницу |

## Полезные ссылки

- [Playwright Docs](https://playwright.dev/python/)
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)
- [OpenAI API](https://platform.openai.com/docs/)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
