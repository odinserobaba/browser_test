# 🔧 Инструкции по сборке

## Проблема: "Не удалось загрузить JavaScript"

Эта ошибка возникает, когда расширение пытается загрузить файлы из папки `dist/`, которая еще не создана.

## Решение

### Шаг 1: Установите Node.js и npm

Если у вас не установлен Node.js:
1. Скачайте с [nodejs.org](https://nodejs.org/)
2. Установите LTS версию
3. Перезапустите терминал

Проверьте установку:
```bash
node --version
npm --version
```

### Шаг 2: Установите зависимости

```bash
npm install
```

### Шаг 3: Соберите проект

```bash
npm run build
```

Это создаст папку `dist/` с скомпилированными файлами:
- `dist/background/index.js`
- `dist/content/index.js`
- `dist/popup.html`, `dist/popup.css`, `dist/popup.js`
- `dist/manifest.json`
- `dist/icons/`

### Шаг 4: Загрузите расширение

1. Откройте `chrome://extensions/`
2. Включите "Режим разработчика"
3. Нажмите "Загрузить распакованное расширение"
4. **ВАЖНО:** Выберите папку `dist/` (не корневую папку проекта!)

### Альтернатива: Разработка без сборки

Если вы хотите разрабатывать без постоянной сборки, можно временно изменить пути в `manifest.json`:

```json
{
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [{
    "js": ["src/content/index.ts"]
  }]
}
```

Но это не будет работать, так как Chrome не понимает TypeScript напрямую. Нужна сборка.

## Автоматическая пересборка при изменениях

Для разработки используйте watch режим:

```bash
npm run dev
```

Это будет автоматически пересобирать проект при изменении файлов.

## Проверка структуры dist/

После сборки структура должна быть:

```
dist/
├── background/
│   └── index.js
├── content/
│   └── index.js
├── popup.html
├── popup.css
├── popup.js
├── manifest.json
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Troubleshooting

**Ошибка: "npm не является внутренней или внешней командой"**
- Node.js не установлен или не добавлен в PATH
- Переустановите Node.js

**Ошибка: "Cannot find module"**
- Запустите `npm install` еще раз
- Удалите `node_modules` и `package-lock.json`, затем `npm install`

**Ошибка: "Failed to load manifest"**
- Убедитесь, что вы загружаете папку `dist/`, а не корневую папку
- Проверьте, что `dist/manifest.json` существует

**Ошибка: "Failed to load JavaScript"**
- Убедитесь, что файлы `dist/background/index.js` и `dist/content/index.js` существуют
- Запустите `npm run build` еще раз
