# ✅ Скрипт исправлен!

## Что было исправлено

1. ✅ Исправлена проверка наличия Node.js (используется `Get-Command` вместо `try-catch` с `node --version`)
2. ✅ Исправлен синтаксис оператора `-and` в условии `if` (добавлены скобки)
3. ✅ Исправлено создание строки-разделителя (вынесено в переменную)

## Как использовать

```powershell
# Разрешите выполнение скриптов (один раз)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Запустите скрипт
.\setup-and-build.ps1
```

## Если всё ещё есть ошибки

Попробуйте запустить скрипт с явным указанием кодировки:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-and-build.ps1
```

Или используйте ручную установку (см. [QUICK_SETUP.md](./QUICK_SETUP.md))
