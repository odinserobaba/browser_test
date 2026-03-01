# 📥 Установка Node.js

## Автоматическая установка (рекомендуется)

Запустите PowerShell скрипт:

```powershell
.\setup-and-build.ps1
```

Скрипт автоматически:
1. Проверит наличие Node.js
2. Скачает и установит Node.js LTS (если нужно)
3. Установит зависимости проекта
4. Соберет проект

## Ручная установка

### Вариант 1: С официального сайта (рекомендуется)

1. Откройте https://nodejs.org/
2. Скачайте **LTS версию** (рекомендуется)
3. Запустите установщик
4. **ВАЖНО:** Убедитесь, что опция **"Add to PATH"** включена
5. Следуйте инструкциям установщика
6. Перезапустите PowerShell/терминал

### Вариант 2: Через Chocolatey (если установлен)

```powershell
choco install nodejs-lts
```

### Вариант 3: Через winget (Windows 10/11)

```powershell
winget install OpenJS.NodeJS.LTS
```

## Проверка установки

После установки проверьте:

```powershell
node --version
npm --version
```

Должны отобразиться версии (например, `v20.11.0` и `10.2.3`).

## Проблемы?

### Node.js установлен, но команды не работают

1. Закройте и откройте PowerShell заново
2. Или перезагрузите компьютер
3. Проверьте PATH:
   ```powershell
   $env:Path -split ';' | Select-String node
   ```

### Ошибка "Execution Policy"

Если получаете ошибку о политике выполнения:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Затем запустите скрипт снова.

## После установки Node.js

Выполните:

```powershell
npm install
npm run build
```

Или просто запустите автоматический скрипт:

```powershell
.\setup-and-build.ps1
```
