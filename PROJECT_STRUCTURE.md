# 📁 Структура проекта

## Обзор

```
ai-playwright-recorder/
├── 📄 Конфигурационные файлы
│   ├── manifest.json          # Манифест расширения (Manifest V3)
│   ├── package.json           # npm зависимости и скрипты
│   ├── tsconfig.json          # TypeScript конфигурация
│   ├── vite.config.ts         # Vite конфигурация сборки
│   └── .gitignore             # Git ignore правила
│
├── 📂 src/                    # Исходный код
│   ├── background/            # Service Worker (Background Script)
│   │   ├── index.ts           # Главный модуль background
│   │   ├── llm.service.ts     # Интеграция с LLM API
│   │   ├── code-generator.ts  # Генерация Python кода
│   │   ├── fs.service.ts      # File System API
│   │   └── types.ts           # TypeScript типы
│   │
│   ├── content/               # Content Script
│   │   ├── index.ts           # Главный модуль content script
│   │   ├── recorder.ts        # Запись действий пользователя
│   │   ├── highlighter.ts     # Подсветка элементов
│   │   └── types.ts           # TypeScript типы
│   │
│   ├── templates/             # Шаблоны для генерации кода
│   │   └── playwright_py.tmpl # Python шаблон
│   │
│   └── types/                 # Глобальные типы
│       └── global.d.ts        # File System API типы
│
├── 🎨 UI файлы
│   ├── popup.html             # HTML popup интерфейса
│   ├── popup.css              # Стили popup
│   └── popup.js               # Логика popup
│
├── 🖼️ Иконки
│   └── icons/                 # Иконки расширения
│       ├── icon16.png         # 16x16 пикселей
│       ├── icon48.png         # 48x48 пикселей
│       └── icon128.png        # 128x128 пикселей
│
├── 📚 Документация
│   ├── README.md              # Основная документация
│   ├── SETUP.md               # Быстрый старт
│   ├── QUICK_REFERENCE.md     # Быстрая справка
│   ├── CONTRIBUTING.md        # Руководство для контрибьюторов
│   └── PROJECT_STRUCTURE.md   # Этот файл
│
├── 💡 Примеры
│   └── examples/              # Примеры использования
│       ├── example_test.py    # Пример сгенерированного теста
│       └── README.md          # Описание примеров
│
├── 🔧 Скрипты
│   └── scripts/
│       └── copy-static.js     # Копирование статических файлов
│
└── 📦 Сборка
    └── dist/                  # Скомпилированные файлы (генерируется)
```

## Описание модулей

### Background Service Worker (`src/background/`)

**Назначение:** Управление записью, генерация тестов, работа с LLM API

- **`index.ts`** - Точка входа, обработка сообщений от content script и popup
- **`llm.service.ts`** - Интеграция с OpenAI/Anthropic/Local LLM для генерации локаторов
- **`code-generator.ts`** - Генерация Python Playwright кода из записанных действий
- **`fs.service.ts`** - Работа с File System Access API (выбор папки, сохранение файлов)
- **`types.ts`** - TypeScript интерфейсы для конфигурации и данных

### Content Script (`src/content/`)

**Назначение:** Запись действий пользователя на странице

- **`index.ts`** - Главный модуль, обработка событий (click, input, change)
- **`recorder.ts`** - Сбор данных элементов (сигнатура, DOM сниппет)
- **`highlighter.ts`** - Подсветка элементов при наведении мыши
- **`types.ts`** - Типы для записанных действий и элементов

### Popup UI (`popup.*`)

**Назначение:** Интерфейс управления расширением

- **`popup.html`** - Разметка интерфейса
- **`popup.css`** - Стили
- **`popup.js`** - Логика управления (старт/стоп записи, настройки)

### Templates (`src/templates/`)

**Назначение:** Шаблоны для генерации кода

- **`playwright_py.tmpl`** - Шаблон Python Playwright теста (пока не используется, код генерируется напрямую)

## Поток данных

```
Пользователь → Popup UI → Background Service Worker
                                    ↓
                            Content Script
                                    ↓
                            Запись действий
                                    ↓
                            Background Service Worker
                                    ↓
                            LLM API (генерация локаторов)
                                    ↓
                            Генерация Python кода
                                    ↓
                            Сохранение файлов
```

## Зависимости

### Production
- `openai` - OpenAI API клиент (опционально, если используется OpenAI)

### Development
- `typescript` - TypeScript компилятор
- `vite` - Сборщик
- `@types/chrome` - Типы для Chrome Extensions API
- `@types/node` - Типы для Node.js

## Сборка

1. **TypeScript → JavaScript:** Vite компилирует `.ts` файлы в `.js`
2. **Копирование статики:** Скрипт `copy-static.js` копирует `popup.*`, `manifest.json`, `icons/` в `dist/`
3. **Результат:** Папка `dist/` готова для загрузки в Chrome

## Расширение проекта

### Добавление нового типа действия

1. Обновите `src/content/types.ts` - добавьте тип в `RecordedAction['type']`
2. Добавьте обработчик в `src/content/index.ts`
3. Обновите `src/background/code-generator.ts` - добавьте генерацию кода для нового типа

### Добавление нового LLM провайдера

1. Обновите `src/background/types.ts` - добавьте провайдера в `LLMConfig['provider']`
2. Добавьте функцию генерации в `src/background/llm.service.ts`
3. Обновите UI в `popup.html` - добавьте опцию выбора провайдера

### Добавление нового формата экспорта

1. Создайте новый генератор в `src/background/` (например, `cypress-generator.ts`)
2. Обновите `src/background/index.ts` - добавьте обработку нового формата
3. Обновите UI для выбора формата
