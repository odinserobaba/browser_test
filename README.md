# 🎭 AI Playwright Recorder

**AI-powered Chrome Extension для записи браузерных взаимодействий и генерации устойчивых Playwright тестов с использованием LLM.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)

## 📋 Содержание

- [Описание](#описание)
- [Возможности](#возможности)
- [Архитектура](#архитектура)
- [Установка](#установка)
- [Настройка](#настройка)
- [Использование](#использование)
- [Примеры](#примеры)
- [API](#api)
- [Разработка](#разработка)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Лицензия](#лицензия)

---

## 🎯 Описание

**AI Playwright Recorder** — это Chrome расширение, которое решает главную проблему автотестов — хрупкость селекторов. Вместо генерации нестабильных XPath, расширение использует AI для создания устойчивых локаторов на основе контекста DOM.

### Проблема, которую решает проект

Традиционные рекордеры генерируют хрупкие селекторы:
```python
# ❌ Плохо: хрупкий XPath
page.locator('/html/body/div[2]/div[3]/button[1]').click()
```

AI Playwright Recorder генерирует устойчивые локаторы:
```python
# ✅ Хорошо: устойчивый локатор
page.get_by_test_id("submit-btn").click()
page.get_by_role("button", name="Submit").click()
page.get_by_label("Email").fill("user@test.com")
```

---

## ✨ Возможности

### 🎬 Запись действий
- ✅ Запись кликов, ввода текста, выбора опций
- ✅ Подсветка элементов при наведении мыши
- ✅ Автоматический сбор DOM-контекста
- ✅ Определение сигнатуры элементов (test-id, role, label, text)

### 🤖 AI-генерация локаторов
- ✅ Интеграция с OpenAI API (GPT-4, GPT-3.5)
- ✅ Поддержка локальных LLM через Ollama
- ✅ Умный выбор селекторов по приоритету:
  1. `get_by_test_id()` — самый надежный
  2. `get_by_role()` — семантический доступ
  3. `get_by_label()` / `get_by_placeholder()` — для форм
  4. `get_by_text()` — для текстовых элементов
  5. `locator()` с CSS — fallback

### 📝 Генерация кода
- ✅ Генерация готового Python + Playwright кода
- ✅ Автоматическая обработка чувствительных данных (пароли → env переменные)
- ✅ Генерация `.env.example` файла
- ✅ Сохранение JSON лога сессии

### 🔒 Безопасность
- ✅ Шифрование API ключей в `chrome.storage.local`
- ✅ Режим локального LLM для приватности
- ✅ Очистка чувствительных данных из HTML сниппетов

---

## 🏗 Архитектура

### Компоненты расширения

```
┌─────────────────────────────────────────┐
│         Chrome Extension                │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐ │
│  │  Content     │    │  Background  │ │
│  │  Script      │◄───┤  Service     │ │
│  │              │    │  Worker      │ │
│  │  • Recorder  │    │              │ │
│  │  • Highlighter│   │  • LLM API   │ │
│  │              │    │  • Code Gen  │ │
│  └──────────────┘    │  • FS API    │ │
│         ▲            └──────────────┘ │
│         │                    ▲         │
│         │                    │         │
│  ┌──────┴─────────┐  ┌──────┴──────┐ │
│  │   Popup UI      │  │  Side Panel │ │
│  │   (Controls)    │  │  (Logs)     │ │
│  └─────────────────┘  └─────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Технологический стек

- **Язык:** TypeScript 5.3+
- **Сборка:** Vite
- **Manifest:** V3 (современный стандарт)
- **LLM Provider:** OpenAI API / Anthropic / Local (Ollama)
- **Target Framework:** Playwright + Python
- **File System:** Chrome File System Access API

### Структура проекта

```
ai-playwright-recorder/
├── manifest.json              # Конфигурация расширения
├── package.json               # Зависимости и скрипты
├── tsconfig.json              # TypeScript конфигурация
├── vite.config.ts             # Vite конфигурация
├── popup.html                 # Popup интерфейс
├── popup.css                  # Стили popup
├── popup.js                   # Логика popup
├── src/
│   ├── background/            # Service Worker
│   │   ├── index.ts           # Точка входа
│   │   ├── llm.service.ts     # Интеграция с LLM
│   │   ├── fs.service.ts      # File System API
│   │   ├── code-generator.ts  # Генерация Python кода
│   │   └── types.ts           # TypeScript типы
│   ├── content/               # Content Script
│   │   ├── index.ts           # Главный модуль
│   │   ├── recorder.ts        # Запись действий
│   │   ├── highlighter.ts     # Подсветка элементов
│   │   └── types.ts           # Типы данных
│   └── templates/             # Шаблоны кода
│       └── playwright_py.tmpl # Python шаблон
├── icons/                     # Иконки расширения
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # Документация
```

---

## 🚀 Установка

### Предварительные требования

- **Node.js** 18+ и npm
- **Chrome/Edge** браузер (последняя версия)
- **Python** 3.8+ (для запуска сгенерированных тестов)
- **Playwright** (установится автоматически при первом запуске теста)

### Шаг 1: Клонирование репозитория

```bash
git clone https://github.com/yourusername/ai-playwright-recorder.git
cd ai-playwright-recorder
```

### Шаг 2: Установка зависимостей

```bash
npm install
```

### Шаг 3: Сборка расширения

```bash
# Development режим (с watch)
npm run dev

# Production сборка
npm run build
```

После сборки будет создана папка `dist/` с скомпилированными файлами.

### Шаг 4: Загрузка расширения в Chrome

1. Откройте Chrome и перейдите в `chrome://extensions/`
2. Включите **"Режим разработчика"** (Developer mode) в правом верхнем углу
3. Нажмите **"Загрузить распакованное расширение"** (Load unpacked)
4. Выберите папку `ai-playwright-recorder` (корневую папку проекта)
5. Расширение появится в списке установленных

### Шаг 5: Установка Playwright (для запуска тестов)

```bash
pip install playwright
playwright install chromium
```

---

## ⚙️ Настройка

### Настройка LLM провайдера

#### Вариант 1: OpenAI API (рекомендуется)

1. Откройте расширение (кликните на иконку в панели инструментов)
2. В разделе **"Настройки LLM"**:
   - **API Key:** Вставьте ваш OpenAI API ключ (начинается с `sk-...`)
   - **Провайдер:** Выберите `OpenAI`
   - **Модель:** `gpt-4-turbo-preview` или `gpt-3.5-turbo`
3. Нажмите **"💾 Сохранить настройки"**

**Где получить API ключ:**
- Зарегистрируйтесь на [OpenAI Platform](https://platform.openai.com/)
- Перейдите в [API Keys](https://platform.openai.com/api-keys)
- Создайте новый ключ

#### Вариант 2: Локальный LLM (Ollama)

Для полной приватности можно использовать локальный LLM:

1. Установите [Ollama](https://ollama.ai/)
2. Запустите модель:
   ```bash
   ollama pull llama2
   ```
3. В настройках расширения:
   - **Провайдер:** Выберите `Local (Ollama)`
   - **Base URL:** `http://localhost:11434` (по умолчанию)
4. Сохраните настройки

#### Вариант 3: Anthropic (Claude)

1. Получите API ключ на [Anthropic Console](https://console.anthropic.com/)
2. В настройках выберите `Anthropic`
3. Введите API ключ и модель (например, `claude-3-opus-20240229`)

---

## 📖 Использование

### Базовый workflow

#### 1. Начало записи

1. Откройте сайт, который хотите протестировать
2. Кликните на иконку расширения в панели инструментов
3. Нажмите **"▶ Начать запись"**
4. Вы увидите красную рамку при наведении мыши на элементы

#### 2. Выполнение действий

Выполните действия на странице:
- **Клик** по кнопкам, ссылкам
- **Ввод текста** в поля формы
- **Выбор опций** в select элементах
- **Навигация** между страницами

Все действия автоматически записываются.

#### 3. Остановка записи

1. Нажмите **"⏹ Остановить"** в popup
2. Вы увидите количество записанных действий

#### 4. Генерация теста

1. Нажмите **"✨ Сгенерировать тест"**
2. Расширение отправит данные в LLM для генерации локаторов
3. После генерации файлы будут сохранены:
   - `test_generated.py` — готовый Playwright тест
   - `.env.example` — переменные окружения
   - `session_log.json` — JSON лог всех действий

#### 5. Запуск теста

```bash
# Установите переменные окружения (если нужно)
export TEST_EMAIL="user@test.com"
export TEST_PASSWORD="yourpassword"

# Запустите тест
python test_generated.py
```

---

## 💡 Примеры

### Пример 1: Простая форма входа

**Действия пользователя:**
1. Открыть `https://example.com/login`
2. Ввести email в поле "Email"
3. Ввести пароль в поле "Password"
4. Нажать кнопку "Login"

**Сгенерированный код:**

```python
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Navigation
        page.goto("https://example.com/login")
        page.wait_for_load_state("networkidle")
        
        # Step 1: Fill Email
        page.get_by_label("Email").fill(os.getenv("TEST_EMAIL", "user@test.com"))
        
        # Step 2: Fill Password
        page.get_by_label("Password").fill(os.getenv("TEST_PASSWORD", "Qwerty123!"))
        
        # Step 3: Click Login
        page.get_by_test_id("login-btn").click()
        
        page.close()
        browser.close()

if __name__ == "__main__":
    run()
```

**`.env.example`:**
```env
TEST_EMAIL=user@test.com
TEST_PASSWORD=Qwerty123!
```

### Пример 2: E-commerce сценарий

**Действия:**
1. Поиск товара
2. Добавление в корзину
3. Переход в корзину
4. Оформление заказа

**Сгенерированный код:**

```python
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        page.goto("https://shop.example.com")
        page.wait_for_load_state("networkidle")
        
        # Step 1: Search product
        page.get_by_placeholder("Search products...").fill("laptop")
        page.get_by_role("button", name="Search").click()
        
        # Step 2: Add to cart
        page.get_by_test_id("product-card-123").get_by_role("button", name="Add to Cart").click()
        page.wait_for_load_state("networkidle")
        
        # Step 3: Go to cart
        page.get_by_role("link", name="Cart").click()
        
        # Step 4: Checkout
        page.get_by_test_id("checkout-btn").click()
        
        page.close()
        browser.close()

if __name__ == "__main__":
    run()
```

### Пример 3: Работа с файлами

**Действия:**
1. Загрузка файла через input[type="file"]

**Сгенерированный код:**

```python
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        page.goto("https://example.com/upload")
        page.wait_for_load_state("networkidle")
        
        # Step 1: Upload file
        # user must define FILE_PATH in env or config
        page.set_input_files('input[type="file"]', os.getenv("UPLOAD_FILE_PATH", "path/to/file.pdf"))
        
        page.close()
        browser.close()

if __name__ == "__main__":
    run()
```

**`.env.example`:**
```env
UPLOAD_FILE_PATH=path/to/your/file.pdf
```

---

## 🔌 API

### Content Script API

#### Сообщения от Background

- `START_RECORDING` — начать запись
- `STOP_RECORDING` — остановить запись
- `GET_RECORDING_STATE` — получить состояние записи

#### Сообщения в Background

- `RECORDING_STOPPED` — уведомление об остановке с массивом действий
- `CONTENT_SCRIPT_READY` — уведомление о готовности content script

### Background Service Worker API

#### Сообщения от Popup/Content

- `START_RECORDING` — начать запись
- `STOP_RECORDING` — остановить запись
- `GET_RECORDING_STATE` — получить состояние
- `GENERATE_TEST` — сгенерировать тест из действий
- `SAVE_CONFIG` — сохранить конфигурацию LLM
- `GET_CONFIG` — получить конфигурацию

### Типы данных

#### `RecordedAction`

```typescript
interface RecordedAction {
  type: 'click' | 'fill' | 'select' | 'navigate' | 'upload';
  timestamp: number;
  url: string;
  element?: ElementSignature;
  value?: string;
  domSnapshot?: string;
  selector?: string;
}
```

#### `ElementSignature`

```typescript
interface ElementSignature {
  tagName: string;
  id?: string;
  classes?: string[];
  text?: string;
  name?: string;
  placeholder?: string;
  type?: string;
  role?: string;
  testId?: string;
  href?: string;
  value?: string;
  checked?: boolean;
  selected?: boolean;
}
```

---

## 🛠 Разработка

### Структура модулей

#### Content Script (`src/content/`)

**`recorder.ts`** — сбор данных элементов:
- `collectElementSignature()` — собирает сигнатуру элемента
- `getDomSnapshot()` — получает HTML сниппет
- `createActionRecord()` — создает запись действия

**`highlighter.ts`** — подсветка элементов:
- `highlightElement()` — подсвечивает элемент
- `removeHighlight()` — убирает подсветку

**`index.ts`** — главный модуль:
- Обработка событий (click, input, change)
- Коммуникация с background script

#### Background Service Worker (`src/background/`)

**`llm.service.ts`** — интеграция с LLM:
- `generateLocator()` — генерирует локатор для действия
- `generateLocatorsForActions()` — пакетная генерация
- `generateFallbackLocator()` — fallback эвристика

**`code-generator.ts`** — генерация Python кода:
- `generatePythonCode()` — генерирует полный тест
- `generateEnvFile()` — генерирует .env файл

**`fs.service.ts`** — работа с файловой системой:
- `selectDirectory()` — выбор директории
- `saveFile()` — сохранение файла
- `saveFiles()` — пакетное сохранение

### Добавление нового типа действия

1. Добавьте тип в `src/content/types.ts`:
   ```typescript
   type: 'click' | 'fill' | 'select' | 'your_new_type';
   ```

2. Добавьте обработчик в `src/content/index.ts`:
   ```typescript
   function handleYourNewType(event: Event) {
     // логика обработки
   }
   ```

3. Обновите генератор кода в `src/background/code-generator.ts`

### Тестирование

```bash
# Запуск в dev режиме
npm run dev

# Проверка типов
npx tsc --noEmit

# Сборка для production
npm run build
```

### Отладка

1. **Content Script:** Откройте DevTools на странице → Console
2. **Background:** `chrome://extensions/` → "Service Worker" → Inspect
3. **Popup:** Правый клик на popup → Inspect

---

## 🐛 Troubleshooting

### Проблема: "API Key не работает"

**Решение:**
- Проверьте правильность ключа (должен начинаться с `sk-` для OpenAI)
- Убедитесь, что у ключа есть доступ к нужной модели
- Проверьте баланс на аккаунте OpenAI

### Проблема: "Локаторы не генерируются"

**Решение:**
- Проверьте консоль браузера на ошибки
- Убедитесь, что LLM API доступен
- Попробуйте fallback режим (без LLM)

### Проблема: "Файлы не сохраняются"

**Решение:**
- Проверьте разрешения расширения
- Используйте Chrome Downloads API (fallback)
- Убедитесь, что папка существует и доступна для записи

### Проблема: "Подсветка не работает"

**Решение:**
- Убедитесь, что запись активна
- Проверьте, что content script загружен (`chrome://extensions/` → Details → Inspect views)
- Перезагрузите страницу

### Проблема: "Тест не запускается"

**Решение:**
- Установите Playwright: `pip install playwright && playwright install chromium`
- Проверьте Python версию (требуется 3.8+)
- Убедитесь, что все переменные окружения установлены

---

## 🗺 Roadmap

### Этап 1: MVP ✅
- [x] Базовая запись действий
- [x] Подсветка элементов
- [x] Простая генерация кода
- [x] Popup UI

### Этап 2: LLM интеграция ✅
- [x] OpenAI API интеграция
- [x] Генерация умных локаторов
- [x] Fallback эвристики

### Этап 3: Продвинутые функции 🚧
- [ ] File System Access API
- [ ] Распознавание типов полей
- [ ] Генерация .env файлов
- [ ] Side Panel для логов

### Этап 4: Улучшения 🔜
- [ ] Обработка iframe
- [ ] Явные ожидания (waits)
- [ ] Поддержка других фреймворков (Cypress, Selenium)
- [ ] Экспорт в другие форматы (JSON, YAML)

### Этап 5: Полировка 🔜
- [ ] Шифрование API ключей
- [ ] Очистка чувствительных данных
- [ ] Улучшенная обработка ошибок
- [ ] Unit тесты

---

## 🤝 Contributing

Мы приветствуем вклад в проект! Пожалуйста:

1. Fork репозиторий
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

### Guidelines

- Следуйте TypeScript best practices
- Добавляйте комментарии к сложной логике
- Обновляйте README при добавлении новых функций
- Пишите понятные commit messages

---

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. См. файл `LICENSE` для деталей.

---

## 🙏 Благодарности

- [Playwright](https://playwright.dev/) — отличный инструмент для автоматизации
- [OpenAI](https://openai.com/) — мощные LLM модели
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/) — платформа для расширений

---

## 📞 Контакты

- **Issues:** [GitHub Issues](https://github.com/yourusername/ai-playwright-recorder/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/ai-playwright-recorder/discussions)

---

## ⭐ Поддержка проекта

Если проект оказался полезным, поставьте звезду ⭐ на GitHub!

---

**Сделано с ❤️ для сообщества QA Automation**
