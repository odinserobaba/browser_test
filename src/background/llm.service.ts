/**
 * LLM Service - интеграция с AI для генерации локаторов
 */

import { LLMConfig, LLMResponse } from './types';
import { RecordedAction } from '../content/types';

const DEFAULT_SYSTEM_PROMPT = `You are a Senior SDET. Your task is to convert a recorded UI action into a robust Playwright (Python) command.

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
6. For fill actions, include .fill() method.
7. For click actions, include .click() method.
8. For select actions, use .select_option() method.`;

/**
 * Генерирует промпт для LLM на основе действия
 */
function buildPrompt(action: RecordedAction): string {
  const { type, element, value, domSnapshot } = action;
  
  let prompt = `Action Type: ${type}\n`;
  
  if (value) {
    prompt += `Target Value: ${value}\n`;
  }
  
  if (element) {
    prompt += `Element Info:\n`;
    if (element.testId) prompt += `- data-testid: ${element.testId}\n`;
    if (element.role) prompt += `- role: ${element.role}\n`;
    if (element.id) prompt += `- id: ${element.id}\n`;
    if (element.name) prompt += `- name: ${element.name}\n`;
    if (element.placeholder) prompt += `- placeholder: ${element.placeholder}\n`;
    if (element.type) prompt += `- type: ${element.type}\n`;
    if (element.text) prompt += `- text: ${element.text.substring(0, 50)}\n`;
  }
  
  if (domSnapshot) {
    prompt += `\nHTML Context:\n${domSnapshot.substring(0, 1000)}\n`;
  }
  
  return prompt;
}

/**
 * Генерирует локатор через OpenAI API
 */
async function generateWithOpenAI(
  action: RecordedAction,
  apiKey: string,
  model: string = 'gpt-4-turbo-preview'
): Promise<LLMResponse> {
  const prompt = buildPrompt(action);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const locator = data.choices[0]?.message?.content?.trim() || '';
    
    if (!locator) {
      throw new Error('Empty response from LLM');
    }

    return { locator };
  } catch (error) {
    return {
      locator: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Генерирует локатор через локальный LLM (Ollama)
 */
async function generateWithLocalLLM(
  action: RecordedAction,
  baseUrl: string = 'http://localhost:11434'
): Promise<LLMResponse> {
  const prompt = buildPrompt(action);
  const fullPrompt = `${DEFAULT_SYSTEM_PROMPT}\n\n${prompt}`;
  
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama2',
        prompt: fullPrompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error('Local LLM API error');
    }

    const data = await response.json();
    const locator = data.response?.trim() || '';
    
    return { locator };
  } catch (error) {
    return {
      locator: '',
      error: error instanceof Error ? error.message : 'Local LLM unavailable',
    };
  }
}

/**
 * Генерирует локатор для действия
 */
export async function generateLocator(
  action: RecordedAction,
  config: LLMConfig
): Promise<LLMResponse> {
  // Fallback на простую эвристику, если LLM недоступен
  if (!config.apiKey && config.provider !== 'local') {
    return generateFallbackLocator(action);
  }

  try {
    if (config.provider === 'openai' && config.apiKey) {
      return await generateWithOpenAI(action, config.apiKey, config.model);
    } else if (config.provider === 'local') {
      return await generateWithLocalLLM(action, config.baseUrl);
    } else {
      return generateFallbackLocator(action);
    }
  } catch (error) {
    console.error('[LLM Service] Error generating locator:', error);
    return generateFallbackLocator(action);
  }
}

/**
 * Простая эвристика для генерации локатора (fallback)
 */
function generateFallbackLocator(action: RecordedAction): LLMResponse {
  const { type, element, value } = action;
  
  if (!element) {
    return { locator: `# TODO: Element not found`, error: 'No element data' };
  }

  let locator = 'page.';

  // Приоритет 1: data-testid
  if (element.testId) {
    locator += `get_by_test_id("${element.testId}")`;
  }
  // Приоритет 2: role
  else if (element.role) {
    locator += `get_by_role("${element.role}"`;
    if (element.text) {
      locator += `, { name: "${element.text.substring(0, 50)}" }`;
    }
    locator += ')';
  }
  // Приоритет 3: label/placeholder для input
  else if ((element.type === 'text' || element.type === 'email' || element.type === 'password') && 
           (element.name || element.placeholder)) {
    const label = element.name || element.placeholder;
    locator += `get_by_label("${label}")`;
  }
  // Приоритет 4: text
  else if (element.text && element.text.length < 50) {
    locator += `get_by_text("${element.text}")`;
  }
  // Приоритет 5: CSS selector
  else if (element.id) {
    locator += `locator("#${element.id}")`;
  }
  else if (element.classes && element.classes.length > 0) {
    locator += `locator(".${element.classes[0]}")`;
  }
  else {
    locator += `locator("${element.tagName}")`;
  }

  // Добавляем действие
  if (type === 'click') {
    locator += '.click()';
  } else if (type === 'fill') {
    const fillValue = element.type === 'password' 
      ? 'os.getenv("TEST_PASSWORD", "Qwerty123!")'
      : value 
        ? `"${value}"` 
        : '""';
    locator += `.fill(${fillValue})`;
  } else if (type === 'select') {
    locator += `.select_option("${value || ''}")`;
  }

  return { locator };
}

/**
 * Генерирует локаторы для всех действий
 */
export async function generateLocatorsForActions(
  actions: RecordedAction[],
  config: LLMConfig
): Promise<string[]> {
  const locators: string[] = [];
  
  for (const action of actions) {
    const result = await generateLocator(action, config);
    if (result.error) {
      console.warn(`[LLM Service] Error for action ${action.type}:`, result.error);
    }
    locators.push(result.locator || `# TODO: ${result.error || 'Failed to generate'}`);
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return locators;
}
