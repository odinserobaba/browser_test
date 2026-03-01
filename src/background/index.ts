/**
 * Background Service Worker
 * - Opens side panel on icon click
 * - Tracks recording state; accumulates actions via ACTION_RECORDED
 * - Stores full-page HTML snapshots per URL (PAGE_SNAPSHOT)
 * - Persists everything to chrome.storage.session so the side panel can
 *   show live updates via onChanged
 */

import { generateLocatorsForActions } from './llm.service';
import { generatePythonCode, generateEnvFile } from './code-generator';
import { LLMConfig, StorageData } from './types';
import { RecordedAction } from '../content/types';

// ── In-memory state ──────────────────────────────────────────────

interface PageSnapshot {
  url:        string;
  title:      string;
  html:       string;
  capturedAt: string;
  reason?:    string;
}

let recordingState = {
  isRecording:   false,
  actions:       [] as RecordedAction[],
  pageSnapshots: {} as Record<string, PageSnapshot>, // keyed by URL
};

// ── Session-storage helpers ──────────────────────────────────────

async function sessionSet(data: Record<string, unknown>) {
  await chrome.storage.session.set(data);
}

async function addLogEntry(
  level: 'info' | 'success' | 'error' | 'warn',
  message: string,
) {
  const result = await chrome.storage.session.get(['log']);
  const log: Array<{ level: string; message: string; timestamp: string }> =
    (result.log as any[]) || [];

  log.push({ level, message, timestamp: new Date().toISOString() });
  if (log.length > 300) log.splice(0, log.length - 300);
  await chrome.storage.session.set({ log });
}

// ── Config ───────────────────────────────────────────────────────

async function loadConfig(): Promise<LLMConfig> {
  const data = (await chrome.storage.local.get([
    'apiKey', 'llmProvider', 'llmModel', 'baseUrl',
  ])) as StorageData;

  return {
    provider: (data as any).llmProvider || 'openai',
    apiKey:   data.apiKey,
    model:    (data as any).llmModel  || 'gpt-4o',
    baseUrl:  (data as any).baseUrl   || undefined,
  };
}

async function saveConfig(config: Partial<LLMConfig & { baseUrl?: string }>): Promise<void> {
  const toSave: Record<string, unknown> = {};
  if (config.apiKey   !== undefined) toSave.apiKey      = config.apiKey;
  if (config.provider !== undefined) toSave.llmProvider = config.provider;
  if (config.model    !== undefined) toSave.llmModel    = config.model;
  if ((config as any).baseUrl !== undefined) toSave.baseUrl = (config as any).baseUrl;
  await chrome.storage.local.set(toSave);
}

// ── Message handler ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(err =>
      sendResponse({ error: err instanceof Error ? err.message : String(err) }),
    );
  return true;
});

async function handleMessage(
  message: { type: string; [key: string]: unknown },
  sender: chrome.runtime.MessageSender,
) {
  switch (message.type) {

    // ── Start Recording ─────────────────────────────────────────
    case 'START_RECORDING': {
      recordingState.isRecording   = true;
      recordingState.actions       = [];
      recordingState.pageSnapshots = {};

      await sessionSet({
        isRecording:  true,
        actions:      [],
        log:          [],
        pagesMeta:    [],
      });
      await addLogEntry('info', 'Recording started');

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'START_RECORDING' });
          await addLogEntry('success', `Capturing on: ${tabs[0].url || 'current tab'}`);
        } catch {
          await addLogEntry(
            'warn',
            'Cannot reach content script — reload the tab and try again',
          );
        }
      }

      return { success: true };
    }

    // ── Stop Recording ──────────────────────────────────────────
    case 'STOP_RECORDING': {
      recordingState.isRecording = false;

      // Just tell the content script to stop listening — do NOT fetch its
      // action list, because if the user navigated away the new page's
      // content script has zero actions and would overwrite everything.
      // We already have all actions via real-time ACTION_RECORDED messages.
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        try {
          await chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_RECORDING' });
        } catch { /* content script may not be reachable */ }
      }

      await sessionSet({
        isRecording: false,
        actions:     recordingState.actions,
      });

      await addLogEntry(
        'success',
        `Recording stopped — ${recordingState.actions.length} action(s), ` +
        `${Object.keys(recordingState.pageSnapshots).length} page(s) captured`,
      );

      return {
        success:    true,
        actionCount: recordingState.actions.length,
        pageCount:   Object.keys(recordingState.pageSnapshots).length,
      };
    }

    // ── Real-time Action (from content script) ──────────────────
    case 'ACTION_RECORDED': {
      const action = message.action as RecordedAction;
      if (!action) return { error: 'No action provided' };

      // Merge consecutive fill events on the same element
      const last = recordingState.actions[recordingState.actions.length - 1];
      if (
        action.type === 'fill' && last?.type === 'fill' &&
        last?.element?.tag     === action.element?.tag &&
        last?.element?.testId  === action.element?.testId
      ) {
        recordingState.actions[recordingState.actions.length - 1] = action;
      } else {
        recordingState.actions.push(action);
      }

      await sessionSet({ actions: recordingState.actions });

      const elDesc = action.element?.testId
        ? `[${action.element.testId}]`
        : action.element?.ariaLabel ||
          action.element?.label ||
          (action.element?.text ? `"${String(action.element.text).slice(0, 30)}"` : '') ||
          action.element?.tag || 'element';
      const valDesc = action.value ? ` → "${action.value}"` : '';
      await addLogEntry('info', `${String(action.type).toUpperCase()}: ${elDesc}${valDesc}`);

      return { success: true };
    }

    // ── Full-page HTML Snapshot ─────────────────────────────────
    case 'PAGE_SNAPSHOT': {
      const { url, title, html, capturedAt, reason } = message as any;
      if (!url || !html) return { error: 'Missing url or html' };

      // Store indexed by URL (later navigation to same URL overwrites)
      recordingState.pageSnapshots[url] = { url, title, html, capturedAt, reason };

      const pageMeta = Object.values(recordingState.pageSnapshots).map(p => ({
        url:       p.url,
        title:     p.title,
        capturedAt: p.capturedAt,
        htmlBytes: p.html.length,
      }));
      await sessionSet({ pagesMeta: pageMeta });

      const kb = Math.round(html.length / 1024);
      await addLogEntry(
        'success',
        `Page captured: "${title || url}" — ${kb} KB` +
        (reason ? ` (${reason})` : ''),
      );

      return { success: true };
    }

    // ── State getters ───────────────────────────────────────────
    case 'GET_RECORDING_STATE': {
      return {
        isRecording: recordingState.isRecording,
        actionCount: recordingState.actions.length,
        pageCount:   Object.keys(recordingState.pageSnapshots).length,
      };
    }

    case 'GET_ACTIONS': {
      return {
        actions:      recordingState.actions,
        isRecording:  recordingState.isRecording,
        pageCount:    Object.keys(recordingState.pageSnapshots).length,
        pagesMeta:    Object.values(recordingState.pageSnapshots).map(p => ({
          url: p.url, title: p.title, capturedAt: p.capturedAt, htmlBytes: p.html.length,
        })),
      };
    }

    // ── Full pages (with HTML) for Save Session ─────────────────
    case 'GET_PAGES': {
      return {
        pages: Object.values(recordingState.pageSnapshots),
      };
    }

    // ── Generate Test ───────────────────────────────────────────
    case 'GENERATE_TEST': {
      const actions = (message.actions as RecordedAction[]) || recordingState.actions;
      return handleGenerateTest(actions);
    }

    // ── Config ──────────────────────────────────────────────────
    case 'SAVE_CONFIG': {
      await saveConfig(message.config as Partial<LLMConfig>);
      await addLogEntry('success', 'LLM settings saved');
      return { success: true };
    }

    case 'GET_CONFIG': {
      return { config: await loadConfig() };
    }

    // ── Content Script Ready ─────────────────────────────────────
    case 'CONTENT_SCRIPT_READY': {
      if (recordingState.isRecording && sender.tab?.id) {
        try {
          await chrome.tabs.sendMessage(sender.tab.id, { type: 'START_RECORDING' });
          await addLogEntry('info', 'Content script connected — recording resumed');
        } catch { /* ignore */ }
      }
      return { success: true };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// ── Test Generation ──────────────────────────────────────────────

async function handleGenerateTest(actions: RecordedAction[]) {
  if (!actions || actions.length === 0) {
    return { error: 'No actions recorded' };
  }

  await addLogEntry('info', `Generating test for ${actions.length} action(s)…`);

  try {
    const config = await loadConfig();
    if (!config.apiKey) {
      await addLogEntry('warn', 'No API key — using heuristic locators (no LLM)');
    }

    const locators = await generateLocatorsForActions(actions, config);
    await addLogEntry('success', 'Locators generated');

    const initialUrl = actions[0]?.url;
    const pythonCode = generatePythonCode(actions, locators, initialUrl);
    const envContent = generateEnvFile(actions);

    // Build the session JSON — include full page HTML snapshots
    const pages = Object.values(recordingState.pageSnapshots).map(p => ({
      url:        p.url,
      title:      p.title,
      capturedAt: p.capturedAt,
      htmlBytes:  p.html.length,
      html:       p.html,           // ← full HTML for offline LLM processing
    }));

    const sessionJson = JSON.stringify(
      {
        generatedAt:  new Date().toISOString(),
        actionCount:  actions.length,
        pageCount:    pages.length,
        note:         'Pages[] contains full HTML snapshots captured during recording. ' +
                      'Use them with an LLM to regenerate stable locators offline.',
        pages,
        actions,
      },
      null,
      2,
    );

    const ts           = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const testFilename = `test_${ts}.py`;
    const logFilename  = `session_${ts}.json`;

    await addLogEntry('success', `Test ready: ${testFilename}`);

    return {
      success: true,
      files: [
        { filename: testFilename,   content: pythonCode },
        { filename: '.env.example', content: envContent },
        { filename: logFilename,    content: sessionJson },
      ],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await addLogEntry('error', `Test generation failed: ${msg}`);
    return { error: msg };
  }
}

// ── Provide pages in "Save Session" call too ─────────────────────
// The sidepanel calls saveSessionFile() directly, so we expose pages via GET_ACTIONS.
// The sidepanel.js saveSessionFile() should attach pages when building the JSON.
// (handled in sidepanel.js by calling GET_ACTIONS before building the blob)

// ── Extension Lifecycle ──────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AI Playwright Recorder] Installed/updated');

  // @ts-ignore — sidePanel API may not be in older @types/chrome
  await chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);

  await sessionSet({ isRecording: false, actions: [], log: [], pagesMeta: [] });
  await addLogEntry('success', 'AI Playwright Recorder initialized');
});

// Restore side-panel behaviour on SW startup
// @ts-ignore
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch?.(() => {});
