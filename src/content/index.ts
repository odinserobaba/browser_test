/**
 * Content Script
 * - Records user interactions and sends each one immediately to the background
 * - Captures the FULL page HTML on start and on every navigation,
 *   so the session JSON can contain complete page state for offline LLM processing
 */

import { highlightElement, removeHighlight, isHighlightElement } from './highlighter';
import { getTargetElement, createActionRecord } from './recorder';
import { RecordedAction } from './types';

let isRecording      = false;
let recordedActions: RecordedAction[] = [];
let fillDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// ── Page snapshot ────────────────────────────────────────────────

const MAX_HTML_BYTES = 600_000; // 600 KB per page — enough for any real page
let lastSnapshotUrl  = '';

/** Captures full document HTML and sends it to background once per unique URL */
function capturePageSnapshot(reason = 'manual'): void {
  const url = window.location.href;

  // Avoid duplicate captures for the same URL
  if (url === lastSnapshotUrl) return;
  lastSnapshotUrl = url;

  // Wait one frame so dynamic content has rendered
  requestAnimationFrame(() => {
    try {
      let html = document.documentElement.outerHTML;
      if (html.length > MAX_HTML_BYTES) {
        html = html.slice(0, MAX_HTML_BYTES) + '\n<!-- HTML truncated at 600 KB -->';
      }

      chrome.runtime.sendMessage({
        type:        'PAGE_SNAPSHOT',
        url,
        title:       document.title || url,
        html,
        capturedAt:  new Date().toISOString(),
        reason,
      }).catch(() => {});
    } catch { /* ignore serialisation errors */ }
  });
}

/** Intercept pushState / replaceState for SPA navigation detection */
function patchHistory(): void {
  const wrap = (original: Function, name: string) =>
    function (this: History, ...args: any[]) {
      const result = original.apply(this, args);
      // Give the SPA framework a moment to render the new page
      setTimeout(() => isRecording && capturePageSnapshot(`${name} navigation`), 300);
      return result;
    };

  history.pushState    = wrap(history.pushState,    'pushState')    as typeof history.pushState;
  history.replaceState = wrap(history.replaceState, 'replaceState') as typeof history.replaceState;
}

patchHistory();
window.addEventListener('popstate',    () => isRecording && setTimeout(() => capturePageSnapshot('popstate'),    300));
window.addEventListener('hashchange',  () => isRecording && setTimeout(() => capturePageSnapshot('hashchange'),  300));

// ── Recording Control ────────────────────────────────────────────

function initRecording(): void {
  if (isRecording) return;

  isRecording     = true;
  recordedActions = [];

  // Capture the page we are starting on
  lastSnapshotUrl = ''; // reset so it fires even if same URL
  capturePageSnapshot('recording started');

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout',  handleMouseOut,  true);
  document.addEventListener('click',     handleClick,     true);
  document.addEventListener('input',     handleInput,     true);
  document.addEventListener('change',    handleChange,    true);

  console.log('[AI Playwright Recorder] Recording started');
}

function stopRecording(): void {
  if (!isRecording) return;

  isRecording = false;
  if (fillDebounceTimer) { clearTimeout(fillDebounceTimer); fillDebounceTimer = null; }

  removeHighlight();
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout',  handleMouseOut,  true);
  document.removeEventListener('click',     handleClick,     true);
  document.removeEventListener('input',     handleInput,     true);
  document.removeEventListener('change',    handleChange,    true);

  console.log('[AI Playwright Recorder] Recording stopped. Actions:', recordedActions.length);
}

// ── Send action to background ─────────────────────────────────────

function sendAction(action: RecordedAction): void {
  chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action }).catch(() => {});
}

// ── Event Handlers ───────────────────────────────────────────────

function handleMouseOver(event: MouseEvent): void {
  if (!isRecording) return;
  const el = getTargetElement(event);
  if (el && !isHighlightElement(el)) highlightElement(el);
}

function handleMouseOut(): void {
  if (!isRecording) return;
  removeHighlight();
}

function handleClick(event: MouseEvent): void {
  if (!isRecording) return;
  const el = getTargetElement(event);
  if (!el || isHighlightElement(el)) return;

  const action = createActionRecord('click', el);
  if (!action) return;

  recordedActions.push(action);
  sendAction(action);

  // After a click that triggers navigation, the new page will be captured
  // by the history patch or popstate listener above.
}

function handleInput(event: Event): void {
  if (!isRecording) return;
  const el = getTargetElement(event);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;

  const action = createActionRecord('fill', el, el.value);
  if (!action) return;

  // Merge consecutive fills on the same element
  const last = recordedActions[recordedActions.length - 1];
  if (last?.type === 'fill' && last?.element?.tag === action.element?.tag
      && last?.element?.testId === action.element?.testId) {
    recordedActions[recordedActions.length - 1] = action;
  } else {
    recordedActions.push(action);
  }

  // Debounce: send to background only after 600 ms of inactivity
  if (fillDebounceTimer) clearTimeout(fillDebounceTimer);
  fillDebounceTimer = setTimeout(() => {
    sendAction(action);
    fillDebounceTimer = null;
  }, 600);
}

function handleChange(event: Event): void {
  if (!isRecording) return;
  const el = getTargetElement(event);
  if (!(el instanceof HTMLSelectElement)) return;

  const selected = el.options[el.selectedIndex];
  const action   = createActionRecord('select', el, selected?.value || selected?.text);
  if (!action) return;

  recordedActions.push(action);
  sendAction(action);
}

// ── Message Listener ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING':
      initRecording();
      sendResponse({ success: true });
      break;

    case 'STOP_RECORDING':
      stopRecording();
      // NOTE: We do NOT send actions back — the background already has them
      // all from real-time ACTION_RECORDED messages. Sending them back here
      // caused a bug where navigating to a new page would return an empty
      // actions list, erasing everything recorded so far.
      sendResponse({ success: true });
      break;

    case 'GET_RECORDING_STATE':
      sendResponse({ isRecording, actionCount: recordedActions.length });
      break;

    default:
      sendResponse({ error: 'Unknown message' });
  }
  return true;
});

// Let the background know this content script is alive
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {});
