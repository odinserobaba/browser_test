/**
 * LLM Service — generates Playwright locators using AI.
 * Uses the enriched context fields captured by the updated recorder:
 *   - domSnapshot  : ancestor HTML with the target marked by data-playwright-target="1"
 *   - pageContext   : nearest semantic landmark (form / section / main …)
 *   - ElementSignature : testId, ariaLabel, associated label, cssPath, data-* attrs
 */

import { LLMConfig, LLMResponse } from './types';
import { RecordedAction } from '../content/types';

// ── System prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a Senior SDET specializing in Playwright test automation.
Your task: given a recorded browser action with its full DOM context, produce ONE
robust Playwright (Python) line that performs that action.

Rules:
1. Playwright Python syntax only.
2. NEVER use absolute XPath (/html/body/div[2]/span).
3. NEVER use CSS position selectors like :nth-child or index-based locators.
4. Prefer locators in this priority:
     1. page.get_by_test_id("…")        ← if data-playwright-target has data-testid
     2. page.get_by_role("…", name="…") ← use aria role + accessible name
     3. page.get_by_label("…")          ← for inputs with associated labels
     4. page.get_by_placeholder("…")    ← for inputs with placeholders
     5. page.get_by_text("…", exact=True) ← for buttons/links with stable text
     6. page.locator("css selector")    ← last resort; use only stable attributes
5. For password fields use: os.getenv("TEST_PASSWORD", "")
6. The target element inside the HTML is marked with the attribute data-playwright-target="1".
7. Output ONLY the single Python code line. No markdown, no comments, no explanation.`;

// ── Prompt builder ───────────────────────────────────────────────

function buildPrompt(action: RecordedAction): string {
  const { type, element, value, domSnapshot, pageContext, pageTitle, url } = action;

  const lines: string[] = [];

  lines.push(`Action: ${type.toUpperCase()}`);
  if (value)      lines.push(`Value to use: ${value}`);
  if (pageTitle)  lines.push(`Page title: ${pageTitle}`);
  if (url)        lines.push(`URL: ${url}`);

  if (element) {
    lines.push('');
    lines.push('Element attributes:');
    if (element.testId)       lines.push(`  data-testid   : ${element.testId}`);
    if (element.ariaLabel)    lines.push(`  aria-label    : ${element.ariaLabel}`);
    if (element.ariaLabelledby) lines.push(`  aria-labelledby text: ${element.ariaLabelledby}`);
    if (element.role)         lines.push(`  role          : ${element.role}`);
    if (element.label)        lines.push(`  <label> text  : ${element.label}`);
    if (element.id)           lines.push(`  id            : ${element.id}`);
    if (element.name)         lines.push(`  name          : ${element.name}`);
    if (element.placeholder)  lines.push(`  placeholder   : ${element.placeholder}`);
    if (element.type)         lines.push(`  type          : ${element.type}`);
    if (element.title)        lines.push(`  title         : ${element.title}`);
    if (element.href)         lines.push(`  href          : ${element.href}`);
    if (element.text)         lines.push(`  visible text  : ${element.text.slice(0, 80)}`);
    if (element.cssPath)      lines.push(`  css path      : ${element.cssPath}`);
    if (element.tag)          lines.push(`  tag           : ${element.tag}`);

    if (element.dataAttributes && Object.keys(element.dataAttributes).length) {
      lines.push('  data-* attrs  :');
      for (const [k, v] of Object.entries(element.dataAttributes)) {
        lines.push(`    ${k} = "${v}"`);
      }
    }
  }

  // DOM snapshot: ancestor 4 levels up with the target marked
  if (domSnapshot) {
    lines.push('');
    lines.push('DOM context (target element has data-playwright-target="1"):');
    lines.push(domSnapshot.slice(0, 4000));
  }

  // Broader semantic context
  if (pageContext && pageContext !== domSnapshot) {
    lines.push('');
    lines.push('Semantic ancestor context (form/section/main/…):');
    lines.push(pageContext.slice(0, 3000));
  }

  return lines.join('\n');
}

// ── OpenAI ───────────────────────────────────────────────────────

async function generateWithOpenAI(
  action: RecordedAction,
  apiKey: string,
  model  = 'gpt-4o',
  baseUrl = 'https://api.openai.com/v1',
): Promise<LLMResponse> {
  const prompt = buildPrompt(action);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt },
        ],
        temperature: 0.1,
        max_tokens:  256,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const locator = (data.choices?.[0]?.message?.content || '').trim();
    if (!locator) throw new Error('Empty response from LLM');
    return { locator };
  } catch (error) {
    return { locator: '', error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Anthropic ────────────────────────────────────────────────────

async function generateWithAnthropic(
  action: RecordedAction,
  apiKey: string,
  model  = 'claude-3-5-sonnet-20241022',
): Promise<LLMResponse> {
  const prompt = buildPrompt(action);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        system:   SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const locator = (data.content?.[0]?.text || '').trim();
    if (!locator) throw new Error('Empty response from Anthropic');
    return { locator };
  } catch (error) {
    return { locator: '', error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Local / Ollama ───────────────────────────────────────────────

async function generateWithLocalLLM(
  action: RecordedAction,
  baseUrl = 'http://localhost:11434',
  model   = 'llama3',
): Promise<LLMResponse> {
  const prompt = `${SYSTEM_PROMPT}\n\n${buildPrompt(action)}`;

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

    const data  = await response.json();
    const locator = (data.response || '').trim();
    return { locator };
  } catch (error) {
    return { locator: '', error: error instanceof Error ? error.message : 'Local LLM unavailable' };
  }
}

// ── Fallback heuristic (no LLM) ──────────────────────────────────

function generateFallbackLocator(action: RecordedAction): LLMResponse {
  const { type, element, value } = action;

  if (!element) return { locator: '# TODO: no element data', error: 'No element' };

  let loc = 'page.';

  if (element.testId) {
    loc += `get_by_test_id("${element.testId}")`;
  } else if (element.ariaLabel) {
    loc += `get_by_role("${element.role || element.tag}", name="${element.ariaLabel}")`;
  } else if (element.label) {
    loc += `get_by_label("${element.label}")`;
  } else if (element.placeholder) {
    loc += `get_by_placeholder("${element.placeholder}")`;
  } else if (element.role && element.text) {
    loc += `get_by_role("${element.role}", name="${element.text.slice(0, 50)}")`;
  } else if (element.text && element.text.length < 60 && element.tag !== 'div') {
    loc += `get_by_text("${element.text.slice(0, 60)}", exact=True)`;
  } else if (element.id) {
    loc += `locator("#${element.id}")`;
  } else if (element.cssPath) {
    loc += `locator("${element.cssPath}")`;
  } else {
    loc += `locator("${element.tag}")`;
  }

  // Append action method
  if (type === 'click') {
    loc += '.click()';
  } else if (type === 'fill') {
    const v = element.type === 'password'
      ? 'os.getenv("TEST_PASSWORD", "")'
      : value ? `"${value}"` : '""';
    loc += `.fill(${v})`;
  } else if (type === 'select') {
    loc += `.select_option("${value || ''}")`;
  }

  return { locator: loc };
}

// ── Public API ───────────────────────────────────────────────────

export async function generateLocator(
  action: RecordedAction,
  config: LLMConfig,
): Promise<LLMResponse> {
  if (!config.apiKey && config.provider !== 'local') {
    return generateFallbackLocator(action);
  }

  try {
    switch (config.provider) {
      case 'openai':
        return await generateWithOpenAI(
          action,
          config.apiKey!,
          config.model,
          (config as any).baseUrl || 'https://api.openai.com/v1',
        );
      case 'anthropic':
        return await generateWithAnthropic(action, config.apiKey!, config.model);
      case 'local':
        return await generateWithLocalLLM(
          action,
          (config as any).baseUrl || 'http://localhost:11434',
          config.model || 'llama3',
        );
      default:
        return generateFallbackLocator(action);
    }
  } catch (error) {
    console.error('[LLM Service] Error:', error);
    return generateFallbackLocator(action);
  }
}

export async function generateLocatorsForActions(
  actions: RecordedAction[],
  config: LLMConfig,
): Promise<string[]> {
  const locators: string[] = [];

  for (const action of actions) {
    const result = await generateLocator(action, config);
    if (result.error) {
      console.warn(`[LLM] Error for ${action.type}:`, result.error);
    }
    locators.push(result.locator || `# TODO: ${result.error || 'generation failed'}`);

    // Small delay to respect API rate limits
    await new Promise(r => setTimeout(r, 150));
  }

  return locators;
}
