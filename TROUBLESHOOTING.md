# 🔧 Решение проблем

## Ошибка: "Не удалось загрузить JavaScript"

### Причина
Расширение пытается загрузить файлы из папки `dist/`, которая еще не создана.

### Решение

1. **Убедитесь, что Node.js установлен:**
   ```bash
   node --version
   npm --version
   ```
   Если команды не работают, установите Node.js с [nodejs.org](https://nodejs.org/)

2. **Установите зависимости:**
   ```bash
   npm install
   ```

3. **Соберите проект:**
   ```bash
   npm run build
   ```

4. **Проверьте структуру:**
   ```bash
   npm run check
   ```

5. **Загрузите ПРАВИЛЬНУЮ папку:**
   - ❌ НЕ загружайте корневую папку проекта
   - ✅ Загрузите папку `dist/`

## Ошибка: "Failed to load manifest"

### Причины и решения

**1. Неправильная папка загружена:**
- Убедитесь, что вы загружаете папку `dist/`, а не корневую папку проекта

**2. manifest.json не найден:**
- Запустите `npm run build` еще раз
- Проверьте, что файл `dist/manifest.json` существует

**3. Синтаксическая ошибка в manifest.json:**
- Откройте `dist/manifest.json` в текстовом редакторе
- Проверьте JSON синтаксис (можно использовать [jsonlint.com](https://jsonlint.com/))

## Ошибка: "Icons not found"

### Решение

Иконки опциональны, но для лучшего опыта создайте их:

1. Создайте три PNG файла:
   - `icons/icon16.png` (16x16 пикселей)
   - `icons/icon48.png` (48x48 пикселей)
   - `icons/icon128.png` (128x128 пикселей)

2. Можно использовать онлайн генератор:
   - [favicon.io](https://favicon.io/)
   - [icon-generator.net](https://icon-generator.net/)

3. Пересоберите проект:
   ```bash
   npm run build
   ```

## Ошибка: "npm не является внутренней или внешней командой"

### Решение

1. Установите Node.js с [nodejs.org](https://nodejs.org/)
2. Выберите LTS версию
3. При установке убедитесь, что опция "Add to PATH" включена
4. Перезапустите терминал/PowerShell
5. Проверьте установку:
   ```bash
   node --version
   npm --version
   ```

## Ошибка: "Cannot find module"

### Решение

1. Удалите `node_modules` и `package-lock.json`:
   ```bash
   # Windows PowerShell
   Remove-Item -Recurse -Force node_modules
   Remove-Item package-lock.json
   ```

2. Переустановите зависимости:
   ```bash
   npm install
   ```

3. Если проблема сохраняется, очистите npm кэш:
   ```bash
   npm cache clean --force
   npm install
   ```

## Ошибка компиляции TypeScript

### Решение

1. Проверьте версию TypeScript:
   ```bash
   npx tsc --version
   ```

2. Проверьте типы вручную:
   ```bash
   npx tsc --noEmit
   ```

3. Если есть ошибки типов, исправьте их или временно отключите strict mode в `tsconfig.json`

## Расширение загружено, но не работает

### Проверка

1. **Откройте DevTools для расширения:**
   - `chrome://extensions/`
   - Найдите ваше расширение
   - Нажмите "Service Worker" (для background script)
   - Или "Inspect views: popup" (для popup)

2. **Проверьте консоль на ошибки**

3. **Проверьте, что content script загружен:**
   - Откройте любую веб-страницу
   - Откройте DevTools (F12)
   - Перейдите на вкладку Console
   - Должно быть сообщение: `[AI Playwright Recorder] Content script ready`

4. **Проверьте разрешения:**
   - Убедитесь, что расширение имеет доступ к нужным сайтам
   - Проверьте `host_permissions` в manifest.json

## Расширение не появляется в списке

### Решение

1. Убедитесь, что "Режим разработчика" включен
2. Попробуйте перезагрузить страницу `chrome://extensions/`
3. Проверьте, что вы загрузили папку `dist/`, а не корневую папку

## Дополнительная помощь

Если проблема не решена:

1. Проверьте логи в DevTools (Service Worker и Content Script)
2. Убедитесь, что все файлы собраны (`npm run check`)
3. Попробуйте пересобрать проект с нуля:
   ```bash
   Remove-Item -Recurse -Force dist
   npm run build
   ```

4. Создайте Issue на GitHub с описанием проблемы и логами из консоли
