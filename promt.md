Это отличная и амбициозная идея. Создание инструмента, который объединяет **Record & Playback** с **AI-генерацией устойчивых локаторов**, решает главную проблему автотестов — хрупкость селекторов.

Как эксперт в указанных областях, я разработаю для вас детальную архитектуру, технический стек и план реализации этого расширения (назовем его **"AI Playwright Recorder"**).

---

## 1. Архитектура Расширения (Manifest V3)

Мы будем использовать современный стандарт **Manifest V3**.

### Компоненты:
1.  **Content Script:** Внедряется в страницу. Отвечает за перехват событий (клики, ввод), подсветку элементов и сбор DOM-контекста.
2.  **Service Worker (Background):** Логика управления записью, общение с LLM API, управление файловой системой.
3.  **Popup UI:** Интерфейс управления (Старт/Стоп, настройки API ключа, выбор папки).
4.  **Side Panel (Опционально):** Для отображения лога действий в реальном времени (удобнее, чем Popup).

### Стек технологий:
*   **Язык расширения:** TypeScript (для типизации и надежности).
*   **Сборка:** Vite или Webpack.
*   **LLM Provider:** OpenAI API (или совместимые, например, LocalLLM, Anthropic).
*   **Target Framework:** Playwright + Python.
*   **File System:** Chrome File System Access API.

---

## 2. Детальная проработка модулей

### Модуль 1: Запись действий и Подсветка (Content Script)

**Задача:** Понять, куда кликнул пользователь, и сохранить контекст.

1.  **Highlighter (Подсветка):**
    *   При наведении мыши (`mouseover`) вычисляем `getBoundingClientRect()`.
    *   Создаем `div` с `position: fixed`, красной рамкой (2px solid red), `pointer-events: none`, `z-index: 999999`.
    *   При уходе мыши (`mouseout`) удаляем `div`.
    *   *Нюанс:* Нужно игнорировать события на самом хайлайтере, чтобы не было мерцания.

2.  **Сбор данных элемента (Snapshot):**
    *   При событии `click` или `input` мы не должны полагаться только на `XPath`.
    *   Мы собираем "Сигнатуру элемента":
        *   `tagName`
        *   `id` (если не динамический)
        *   `classes`
        *   `text` (innerText)
        *   `name`, `placeholder`, `type`
        *   `role` (ARIA)
        *   `data-testid` (приоритет!)
        *   **DOM Path:** HTML snippet родителя (например, 3 уровня вложенности), чтобы LLM понял контекст.

3.  **Логирование:**
    *   Сохраняем объект в массив `actions`:
    ```json
    {
      "type": "click",
      "timestamp": 1715623400,
      "url": "https://example.com/login",
      "element": { ...сигнатура... },
      "dom_snapshot": "<div>...</div>" // HTML вокруг элемента
    }
    ```

### Модуль 2: Работа с файловой системой (File System Access API)

**Задача:** Сохранять логи и сгенерированные тесты в конкретную папку на компьютере пользователя.

*   Chrome Extensions не имеют прямого доступа к файловой системе по соображениям безопасности.
*   **Решение:** Использовать `window.showDirectoryPicker()`.
*   **Поток:**
    1.  Пользователь нажимает "Выбрать папку для тестов" в Popup.
    2.  Extension запрашивает разрешение.
    3.  Получаем `FileSystemDirectoryHandle`.
    4.  При остановке записи создаем файл `session_log.json` и `test_generated.py` внутри этой папки через `getFileHandle` -> `createWritable()`.

### Модуль 3: Интеграция с LLM (Генерация Локаторов)

Это "сердце" вашего продукта. Обычные рекордеры генерируют хрупкий XPath. LLM должен выбрать лучший селектор.

**Prompt Engineering (Промпт для LLM):**
Мы отправляем LLM не всю страницу, а контекст.

> **System:** You are an expert QA Automation Engineer using Playwright with Python.
> **Task:** Generate a stable locator for the element based on the provided HTML snippet and action.
> **Rules:**
> 1. Prioritize `get_by_test_id`, `get_by_role`, `get_by_text`, `get_by_label`.
> 2. Avoid absolute XPaths.
> 3. If dynamic ID is detected, ignore it.
> 4. Return ONLY the python code line for the locator.
>
> **Input:**
> Action: Click
> HTML Context: `<form><button data-testid="submit-btn" class="btn-primary">Send</button></form>`
>
> **Output:**
> `page.get_by_test_id("submit-btn").click()`

**Логика:**
1.  После остановки записи, Service Worker проходит по массиву `actions`.
2.  Для каждого действия отправляет запрос к LLM API.
3.  Получает оптимальный локатор.
4.  Собирает итоговый скрипт.

### Модуль 4: Эмуляция ввода данных (Smart Input)

**Задача:** Не хардкодить чувствительные данные (пароли, реальные имена), а использовать параметры или генерацию.

1.  **Классификация полей:**
    *   Анализируем `type`, `name`, `placeholder`, `label`.
    *   Если `type="password"` -> Заменяем в коде на `os.getenv("USER_PASSWORD")` или фиксированный шаблон `"Qwerty123!"`.
    *   Если `type="email"` -> Генерируем `test_{timestamp}@example.com`.
    *   Если `type="date"` -> Форматируем в `YYYY-MM-DD`.
    *   Если `type="file"` -> См. ниже.

2.  **Загрузка файлов:**
    *   Браузеры блокируют программный путь к файлу (`C:\...`) в автотестах из соображений безопасности.
    *   **Решение:** В сгенерированном коде создаем переменную `FILE_PATH`.
    *   В коде: `page.set_input_files('input[type="file"]', FILE_PATH)`.
    *   В расширении: Предупредить пользователя, что нужно будет передать путь к файлу при запуске.

### Модуль 5: Генерация Python + Playwright Кода

Итоговый файл должен быть готов к запуску.

```python
import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Navigation
        page.goto("https://example.com")
        
        # Step 1: Login (Generated by LLM)
        page.get_by_label("Email").fill(os.getenv("TEST_EMAIL", "user@test.com"))
        page.get_by_label("Password").fill(os.getenv("TEST_PASS", "123456"))
        page.get_by_test_id("login-btn").click()
        
        # Step 2: Upload (Placeholder)
        # user must define FILE_PATH in env or config
        page.set_input_files('input[type="file"]', os.getenv("UPLOAD_FILE_PATH"))
        
        page.close()
        browser.close()

if __name__ == "__main__":
    run()
```

---

## 3. Структура Проекта

```text
ai-playwright-recorder/
├── manifest.json           # Конфигурация расширения
├── src/
│   ├── background/         # Service Worker
│   │   ├── index.ts        # Точка входа
│   │   ├── llm.service.ts  # Логика запросов к AI
│   │   └── fs.service.ts   # Работа с File System API
│   ├── content/            # Content Script
│   │   ├── index.ts        # Листенеры событий
│   │   ├── highlighter.ts  # Логика рамки
│   │   └── recorder.ts     # Сбор данных элементов
│   ├── popup/              # UI расширения
│   │   ├── App.tsx         # React/Vue компонент
│   │   └── styles.css
│   └── templates/          # Шаблоны кода
│       └── playwright_py.tmpl
├── package.json
└── tsconfig.json
```

---

## 4. План Реализации (Roadmap)

### Этап 1: MVP (Базовая запись)
1.  Настроить Manifest V3.
2.  Реализовать Content Script: подсветка элементов при наведении.
3.  Реализовать запись кликов в массив в памяти (Storage).
4.  Сделать Popup: кнопки Start/Stop, отображение количества шагов.
5.  Экспорт простого JSON лога в консоль.

### Этап 2: Генерация кода (Без LLM)
1.  Написать парсер лога в Python-код.
2.  Использовать простые эвристики для селекторов (сначала `data-testid`, потом `id`, потом `css`).
3.  Реализовать сохранение файла `.py` через `chrome.downloads` API (временное решение до File System API).

### Этап 3: Интеграция LLM и Умные селекторы
1.  Добавить поле для API Key в настройках.
2.  Реализовать отправку HTML-сниппетов в LLM.
3.  Внедрить логику "Retry", если LLM вернул ошибку.
4.  Оптимизировать промпты для стабильности.

### Этап 4: Продвинутые инпуты и Файловая система
1.  Внедрить File System Access API для выбора папки.
2.  Добавить логику распознавания типов полей (email, date, file).
3.  Добавить генерацию `.env` файла рядом с тестом для переменных.

### Этап 5: Полировка и Безопасность
1.  Шифрование API ключа (хранить в `chrome.storage.local`, но предупреждать пользователя).
2.  Обработка iframe (сложно, можно оставить на v2).
3.  Обработка ожиданий (добавить `page.wait_for_load_state` между шагами).

---

## 5. Технические нюансы и Риски

1.  **Безопасность данных:**
    *   **Внимание:** Вы будете отправлять HTML-код страниц пользователей на сервер LLM. Если это корпоративный инструмент, это может быть нарушением безопасности (утечка верстки/данных).
    *   **Решение:** Предусмотреть режим "Local LLM" (через Ollama), если пользователь хочет полной приватности, либо очищать HTML от текстовых данных перед отправкой (оставлять только теги и атрибуты).

2.  **Динамический контент (SPA):**
    *   React/Vue приложения могут перерисовывать DOM. Снимок (snapshot), сделанный в момент клика, может устареть к моменту генерации теста.
    *   **Решение:** LLM должен понимать, что селектор должен быть устойчивым к перерисовке (искать по тексту или роли, а не по индексу в DOM).

3.  **File System Access API:**
    *   Работает только в Secure Contexts (HTTPS).
    *   Работает только по жесту пользователя (нельзя сохранить файл автоматически в фоне без подтверждения).
    *   **Решение:** При нажатии "Stop Recording" открывать диалог сохранения.

4.  **Ожидания (Waits):**
    *   Самая частая ошибка тестов — `Element not found`.
    *   **Решение:** В шаблон генерации обязательно включать `page.wait_for_selector(...)` перед действием, если LLM не указал иное. Playwright по умолчанию ждет, но явное ожидание надежнее.

## 6. Пример Промпта для LLM (System Message)

Чтобы получить качественный код, промпт должен быть строгим:

```text
You are a Senior SDET. Your task is to convert a recorded UI action into a robust Playwright (Python) command.
Input Data:
- Action Type: {action_type} (click, fill, select)
- Target Value: {value} (text to type, etc.)
- HTML Context: {html_snippet}

Guidelines:
1. Use Playwright Python syntax (page.locator, page.get_by_text, etc.).
2. NEVER use absolute XPath like /div/div[2]/span.
3. PRIORITY ORDER for selectors:
   1. get_by_test_id()
   2. get_by_role()
   3. get_by_label() / get_by_placeholder()
   4. get_by_text()
   5. locator() with CSS (only if others fail)
4. If input is sensitive (password), use variable placeholder like os.getenv("VAR_NAME").
5. Output ONLY the code line, no markdown, no explanations.
```

## 7. Следующие шаги для вас

1.  **Инициализация:** `npm init` и настройка `vite-plugin-cr` для быстрой разработки расширений.
2.  **Прототип:** Сделать так, чтобы при клике в консоль выводился JSON с данными элемента.
3.  **Тест LLM:** Взять этот JSON и вручную прогнать через ChatGPT, чтобы понять, насколько хороши селекторы.
4.  **Сборка:** Написать скрипт генерации `.py` файла.

Это очень востребованный инструмент. Рынок движется в сторону AI-assisted testing. Если вы реализуете качественную работу с локаторами через LLM, это будет киллер-фичей по сравнению со стандартными рекордерами.

В начальном случае необходимо предусмотреть генерацию с помощью cursor , так же нужно сгенереровать обьемный readme файл с полной инструкцией и примерами 
