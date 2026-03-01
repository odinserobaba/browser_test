# Examples

Эта папка содержит примеры сгенерированных тестов.

## Структура

- `example_test.py` - пример Playwright теста
- `.env.example` - пример файла с переменными окружения

## Запуск примера

```bash
# Установите Playwright (если еще не установлен)
pip install playwright
playwright install chromium

# Установите переменные окружения
export TEST_EMAIL="your@email.com"
export TEST_PASSWORD="yourpassword"

# Запустите тест
python example_test.py
```

## Примечания

- Эти файлы служат только для демонстрации структуры
- Реальные тесты будут генерироваться расширением при записи действий
- Убедитесь, что URL в тестах существуют и доступны
