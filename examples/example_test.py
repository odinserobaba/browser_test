"""
Пример сгенерированного теста от AI Playwright Recorder

Этот файл демонстрирует структуру теста, который генерирует расширение.
"""

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
        # AI выбрал get_by_label как наиболее устойчивый локатор
        page.get_by_label("Email").fill(os.getenv("TEST_EMAIL", "user@test.com"))
        
        # Step 2: Fill Password
        # Пароль заменен на переменную окружения для безопасности
        page.get_by_label("Password").fill(os.getenv("TEST_PASSWORD", "Qwerty123!"))
        
        # Step 3: Click Login Button
        # Приоритет отдан data-testid как самому надежному селектору
        page.get_by_test_id("login-btn").click()
        page.wait_for_load_state("networkidle")
        
        # Step 4: Verify successful login
        # Проверка успешного входа (пример)
        # page.wait_for_url("**/dashboard")
        
        page.close()
        browser.close()

if __name__ == "__main__":
    run()
