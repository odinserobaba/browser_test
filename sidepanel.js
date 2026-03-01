/* =======================================================
   AI Playwright Recorder — Side Panel Logic
   Dark theme · Real-time logging · File System Save
   ======================================================= */

'use strict';

// ── IndexedDB (persist directory handle across sessions) ────────
const DB_NAME    = 'ai-playwright-db';
const DB_VERSION = 1;
const DB_STORE   = 'handles';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = () => reject(new Error('IndexedDB open failed'));
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx  = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => resolve(null);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(new Error('IndexedDB write failed'));
  });
}

// ── State ───────────────────────────────────────────────────────
let isRecording    = false;
let currentActions = [];
let currentPagesMeta = []; // [{url, title, capturedAt, htmlBytes}]
let dirHandle      = null;
let activeTab      = 'actions';

// ── DOM ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const btnRecord       = $('btnRecord');
const btnStop         = $('btnStop');
const btnGenerate     = $('btnGenerate');
const btnSaveSession  = $('btnSaveSession');
const btnLoadGenerate = $('btnLoadGenerate');
const sessionFileInput = $('sessionFileInput');
const btnFolder       = $('btnFolder');
const btnSaveConfig   = $('btnSaveConfig');
const btnClearActions = $('btnClearActions');
const btnClearLog     = $('btnClearLog');
const statusDot       = $('statusDot');
const folderLabel     = $('folderLabel');
const pagesBar        = $('pagesBar');
const pagesLabel      = $('pagesLabel');
const pagesList       = $('pagesList');
const actionList      = $('actionList');
const consoleLog      = $('consoleLog');
const actionBadge     = $('actionBadge');
const consoleBadge    = $('consoleBadge');
const actionsHint     = $('actionsHint');
const statusBar       = $('statusBar');
const settingsToggle  = $('settingsToggle');
const settingsBody    = $('settingsBody');
const settingsChevron = $('settingsChevron');
const tabActions      = $('tabActions');
const tabConsole      = $('tabConsole');
const llmProvider     = $('llmProvider');
const apiKeyInput     = $('apiKey');
const llmModelInput   = $('llmModel');
const baseUrlInput    = $('baseUrl');

// ── Helpers ─────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ''; }
}

let statusTimer = null;
function showStatus(msg, type = 'info', duration = 4000) {
  if (statusTimer) clearTimeout(statusTimer);
  statusBar.textContent = msg;
  statusBar.className   = `status-bar ${type}`;
  statusBar.style.display = 'flex';
  if (duration > 0) {
    statusTimer = setTimeout(() => { statusBar.style.display = 'none'; }, duration);
  }
}

function setRecordingUI(recording) {
  isRecording = recording;
  btnRecord.disabled = recording;
  btnStop.disabled   = !recording;
  btnRecord.classList.toggle('active', recording);
  statusDot.className = recording
    ? 'status-dot status-recording'
    : (currentActions.length ? 'status-dot status-done' : 'status-dot status-idle');
  statusDot.title = recording ? 'Recording…' : (currentActions.length ? 'Done' : 'Idle');
  // Save session button available whenever there are actions (even during recording)
  btnSaveSession.disabled = currentActions.length === 0;
}

// ── Element Description ─────────────────────────────────────────
function getElementDesc(el) {
  if (!el) return 'unknown';
  if (el.testId)       return `[testid="${el.testId}"]`;
  if (el.ariaLabel)    return `[aria="${el.ariaLabel}"]`;
  if (el.label)        return el.label;
  if (el.placeholder)  return `[placeholder="${el.placeholder}"]`;
  if (el.text)         return `"${String(el.text).slice(0, 35)}"`;
  return el.role || el.tag || 'element';
}

// ── Render: Actions ─────────────────────────────────────────────
function renderActions(actions) {
  currentActions = actions || [];
  actionBadge.textContent = currentActions.length;
  actionsHint.textContent  = currentActions.length
    ? `${currentActions.length} action${currentActions.length !== 1 ? 's' : ''} recorded`
    : 'No actions yet';

  actionList.innerHTML = '';

  if (!currentActions.length) {
    actionList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎬</div>
        <div>Press <strong>Record</strong> to start capturing browser actions</div>
      </div>`;
    if (!isRecording) btnGenerate.disabled = true;
    btnSaveSession.disabled = true;
    return;
  }

  const frag = document.createDocumentFragment();
  currentActions.forEach((action, i) => frag.appendChild(buildActionItem(action, i)));
  actionList.appendChild(frag);
  actionList.scrollTop = actionList.scrollHeight;

  if (!isRecording) btnGenerate.disabled = false;
  btnSaveSession.disabled = false;
}

function buildActionItem(action, index) {
  const row   = document.createElement('div');
  row.className = 'action-item';

  // Number badge
  const num = document.createElement('div');
  num.className   = 'action-num';
  num.textContent = index + 1;

  // Body
  const body = document.createElement('div');
  body.className = 'action-body';

  // Header row
  const hdr = document.createElement('div');
  hdr.className = 'action-header';

  const typeEl = document.createElement('span');
  typeEl.className   = `action-type ${action.type || 'click'}`;
  typeEl.textContent = action.type || 'action';

  const elemEl = document.createElement('span');
  elemEl.className   = 'action-element';
  const desc = getElementDesc(action.element);
  elemEl.textContent = desc;
  elemEl.title       = desc;

  hdr.appendChild(typeEl);
  hdr.appendChild(elemEl);
  body.appendChild(hdr);

  // Value row
  if (action.value) {
    const val = document.createElement('div');
    val.className   = 'action-value';
    val.textContent = action.value.length > 45
      ? action.value.slice(0, 45) + '…'
      : action.value;
    val.title = action.value;
    body.appendChild(val);
  }

  // Time
  const time = document.createElement('div');
  time.className   = 'action-time';
  time.textContent = formatTime(action.timestamp);

  row.appendChild(num);
  row.appendChild(body);
  row.appendChild(time);
  return row;
}

// ── Render: Console Log ─────────────────────────────────────────
const LOG_PREFIX = { info: '›', success: '✓', error: '✕', warn: '⚠' };

function renderLog(log) {
  const hasErrors = (log || []).some(e => e.level === 'error');
  consoleBadge.style.display = hasErrors ? '' : 'none';

  consoleLog.innerHTML = '';

  if (!log || !log.length) {
    consoleLog.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div>Log output will appear here</div>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  log.forEach(entry => {
    const row = document.createElement('div');
    row.className = `log-entry ${entry.level || 'info'}`;

    const pre = document.createElement('span');
    pre.className   = 'log-prefix';
    pre.textContent = LOG_PREFIX[entry.level] || '›';

    const msg = document.createElement('span');
    msg.className   = 'log-msg';
    msg.textContent = entry.message;

    const ts = document.createElement('span');
    ts.className   = 'log-time';
    ts.textContent = formatTime(entry.timestamp);

    row.appendChild(pre);
    row.appendChild(msg);
    row.appendChild(ts);
    frag.appendChild(row);
  });

  consoleLog.appendChild(frag);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

// ── Render: Pages Meta ──────────────────────────────────────────
function renderPagesMeta(pages) {
  currentPagesMeta = pages || [];
  if (!currentPagesMeta.length) {
    pagesBar.style.display = 'none';
    return;
  }

  pagesBar.style.display = 'flex';
  pagesLabel.textContent = `${currentPagesMeta.length} page${currentPagesMeta.length !== 1 ? 's' : ''} captured`;

  pagesList.innerHTML = '';
  currentPagesMeta.forEach(p => {
    const chip = document.createElement('span');
    chip.className = 'page-chip';
    const kb = Math.round((p.htmlBytes || 0) / 1024);
    const hostname = (() => { try { return new URL(p.url).hostname; } catch { return p.url.slice(0, 30); } })();
    chip.textContent = hostname;
    chip.title = `${p.title || p.url}\n${p.url}\n${kb} KB captured at ${p.capturedAt}`;
    pagesList.appendChild(chip);
  });
}

// ── Tabs ────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    activeTab = name;
    document.querySelectorAll('.tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === name));
    tabActions.classList.toggle('active', name === 'actions');
    tabConsole.classList.toggle('active', name === 'console');
  });
});

// ── Settings Toggle ─────────────────────────────────────────────
settingsToggle.addEventListener('click', () => {
  const isOpen = settingsBody.style.display !== 'none';
  settingsBody.style.display = isOpen ? 'none' : 'block';
  settingsChevron.classList.toggle('open', !isOpen);
});

// ── Record ──────────────────────────────────────────────────────
btnRecord.addEventListener('click', async () => {
  try {
    showStatus('Starting recording…', 'loading', 0);
    const resp = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    if (resp?.success) {
      setRecordingUI(true);
      renderActions([]);
      showStatus('● Recording — interact with the page', 'info', 0);
    } else {
      showStatus(resp?.error || 'Failed to start recording', 'error');
    }
  } catch (err) {
    showStatus('Error: ' + err.message, 'error');
  }
});

// ── Stop ────────────────────────────────────────────────────────
btnStop.addEventListener('click', async () => {
  try {
    showStatus('Stopping…', 'loading', 0);
    await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    setRecordingUI(false);

    // Fetch final actions from background
    const state = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
    if (state?.actions) renderActions(state.actions);

    if (currentActions.length > 0) {
      statusDot.className = 'status-dot status-done';
      btnGenerate.disabled = false;
      showStatus(`Stopped — ${currentActions.length} actions captured`, 'success', 4000);
    } else {
      showStatus('Stopped — no actions recorded', 'info', 3000);
    }
  } catch (err) {
    showStatus('Error: ' + err.message, 'error');
  }
});

// ── Generate Test ───────────────────────────────────────────────
btnGenerate.addEventListener('click', async () => {
  if (!currentActions.length) {
    showStatus('No actions to generate from', 'error');
    return;
  }

  btnGenerate.disabled = true;
  showStatus('Generating Playwright test via LLM…', 'loading', 0);

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'GENERATE_TEST',
      actions: currentActions,
    });

    if (resp?.error) {
      showStatus('Generation failed: ' + resp.error, 'error', 6000);
      btnGenerate.disabled = false;
      return;
    }

    if (resp?.success && resp.files) {
      await saveGeneratedFiles(resp.files);
      // Switch to console to show logs
      document.querySelector('.tab[data-tab="console"]').click();
    }
  } catch (err) {
    showStatus('Error: ' + err.message, 'error', 6000);
  } finally {
    btnGenerate.disabled = false;
  }
});

// ── Save Session (JSON only, no LLM) ───────────────────────────
btnSaveSession.addEventListener('click', async () => {
  if (!currentActions.length) {
    showStatus('No actions to save', 'error');
    return;
  }

  showStatus('Building session JSON…', 'loading', 0);

  // Fetch full page HTML snapshots from background
  let pages = [];
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_PAGES' });
    pages = resp?.pages || [];
  } catch { /* ignore */ }
  if (!pages.length) pages = currentPagesMeta; // fallback: metadata only

  const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `session_${ts}.json`;
  const content  = JSON.stringify(
    {
      savedAt:     new Date().toISOString(),
      actionCount: currentActions.length,
      pageCount:   pages.length,
      note: [
        'Load this file with "Load & Generate" to produce a Playwright test later.',
        'The "pages" array contains full HTML snapshots of every page visited during recording.',
        'Use pages[].html with an LLM to generate stable Playwright locators without re-visiting the site.',
      ].join(' '),
      pages,        // full HTML snapshots: url, title, capturedAt, html
      actions: currentActions,
    },
    null,
    2,
  );

  await saveSessionFile(filename, content);
});

async function saveSessionFile(filename, content) {
  if (dirHandle) {
    try {
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        const testsDir  = await dirHandle.getDirectoryHandle('tests', { create: true });
        const fileHandle = await testsDir.getFileHandle(filename, { create: true });
        const writable   = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        showStatus(`✓ Saved to tests/${filename}`, 'success', 6000);
        // Log it
        await chrome.storage.session.get(['log']).then(async (s) => {
          const log = s.log || [];
          log.push({ level: 'success', message: `Session saved: tests/${filename}`, timestamp: new Date().toISOString() });
          await chrome.storage.session.set({ log });
        });
        return;
      }
    } catch { /* fall through */ }
  }

  // Fallback: download
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: `playwright-tests/${filename}`, saveAs: false });
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  showStatus(`✓ Downloaded: playwright-tests/${filename}`, 'success', 6000);
}

// ── Load Saved Session & Generate ──────────────────────────────
btnLoadGenerate.addEventListener('click', () => {
  sessionFileInput.value = ''; // reset so same file can be picked again
  sessionFileInput.click();
});

sessionFileInput.addEventListener('change', async () => {
  const file = sessionFileInput.files?.[0];
  if (!file) return;

  showStatus(`Loading ${file.name}…`, 'loading', 0);

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Support both bare array and wrapped object formats
    const actions = Array.isArray(data) ? data : (data.actions || []);

    if (!actions.length) {
      showStatus('No actions found in file', 'error');
      return;
    }

    showStatus(`Loaded ${actions.length} actions — generating test…`, 'loading', 0);

    // Display loaded actions
    renderActions(actions);
    // Switch to console tab so user sees LLM log
    document.querySelector('.tab[data-tab="console"]').click();

    const resp = await chrome.runtime.sendMessage({
      type: 'GENERATE_TEST',
      actions,
    });

    if (resp?.error) {
      showStatus('Generation failed: ' + resp.error, 'error', 6000);
      return;
    }

    if (resp?.success && resp.files) {
      await saveGeneratedFiles(resp.files);
    }
  } catch (err) {
    showStatus('Failed to read file: ' + err.message, 'error', 6000);
  }
});

// ── Save Files ──────────────────────────────────────────────────
async function saveGeneratedFiles(files) {
  if (dirHandle) {
    try {
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await saveToDirectory(dirHandle, files);
        return;
      }
    } catch (e) {
      console.warn('[sidepanel] Directory permission denied, using downloads', e);
    }
  }
  // Fallback: chrome.downloads
  await saveViaDownloads(files);
}

async function saveToDirectory(rootHandle, files) {
  // Create tests/ folder in project root
  const testsDir = await rootHandle.getDirectoryHandle('tests', { create: true });

  // Timestamped session folder
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sessionDir = await testsDir.getDirectoryHandle(`session_${timestamp}`, { create: true });

  let savedCount = 0;
  for (const file of files) {
    const fh       = await sessionDir.getFileHandle(file.filename, { create: true });
    const writable = await fh.createWritable();
    await writable.write(file.content);
    await writable.close();
    savedCount++;
  }

  showStatus(
    `✓ Saved ${savedCount} file(s) → tests/session_${timestamp}/`,
    'success',
    8000,
  );
}

async function saveViaDownloads(files) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  for (const file of files) {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url,
      filename: `playwright-tests/session_${timestamp}/${file.filename}`,
      saveAs: false,
    });

    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  showStatus(
    `✓ Files downloaded → Downloads/playwright-tests/session_${timestamp}/`,
    'success',
    8000,
  );
}

// ── Folder Selection ────────────────────────────────────────────
btnFolder.addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    dirHandle = handle;
    await dbSet('dirHandle', handle);
    folderLabel.textContent = handle.name;
    folderLabel.classList.add('selected');
    showStatus(`Project folder: ${handle.name}`, 'success', 3000);
  } catch (err) {
    if (err.name !== 'AbortError') {
      showStatus('Could not select folder: ' + err.message, 'error');
    }
  }
});

async function restoreDirectoryHandle() {
  try {
    const handle = await dbGet('dirHandle');
    if (!handle) return;
    // Query permission without prompting
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    dirHandle = handle;
    folderLabel.textContent = perm === 'granted'
      ? handle.name
      : handle.name + ' (click Browse to unlock)';
    folderLabel.classList.add('selected');
  } catch {
    dirHandle = null;
  }
}

// ── Config ──────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (!resp?.config) return;
    const c = resp.config;
    llmProvider.value   = c.provider  || 'openai';
    apiKeyInput.value   = c.apiKey    || '';
    llmModelInput.value = c.model     || 'gpt-4o';
    baseUrlInput.value  = c.baseUrl   || '';
  } catch { /* extension may not be ready */ }
}

btnSaveConfig.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config: {
        provider: llmProvider.value,
        apiKey:   apiKeyInput.value.trim(),
        model:    llmModelInput.value.trim(),
        baseUrl:  baseUrlInput.value.trim(),
      },
    });
    showStatus('Settings saved ✓', 'success', 2500);
  } catch (err) {
    showStatus('Failed to save settings: ' + err.message, 'error');
  }
});

// ── Clear ───────────────────────────────────────────────────────
btnClearActions.addEventListener('click', async () => {
  await chrome.storage.session.set({ actions: [] });
});

btnClearLog.addEventListener('click', async () => {
  await chrome.storage.session.set({ log: [] });
});

// ── Real-time Storage Updates ───────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'session') return;

  if (changes.actions !== undefined) {
    renderActions(changes.actions.newValue || []);
  }
  if (changes.log !== undefined) {
    renderLog(changes.log.newValue || []);
  }
  if (changes.isRecording !== undefined) {
    const rec = !!changes.isRecording.newValue;
    if (rec !== isRecording) setRecordingUI(rec);
  }
  if (changes.pagesMeta !== undefined) {
    renderPagesMeta(changes.pagesMeta.newValue || []);
  }
});

// ── Init ────────────────────────────────────────────────────────
async function init() {
  // Load session state (in case panel was reopened mid-session)
  try {
    const session = await chrome.storage.session.get(['isRecording', 'actions', 'log', 'pagesMeta']);
    const actions = session.actions   || [];
    const log     = session.log       || [];
    const rec     = !!session.isRecording;
    renderPagesMeta(session.pagesMeta || []);

    renderActions(actions);
    renderLog(log);
    setRecordingUI(rec);

    if (actions.length && !rec) {
      btnGenerate.disabled    = false;
      btnSaveSession.disabled = false;
      statusDot.className     = 'status-dot status-done';
      showStatus(`${actions.length} actions ready — Save or Generate`, 'info', 5000);
    }
    if (rec) {
      showStatus('● Recording in progress…', 'info', 0);
    }
  } catch {
    renderActions([]);
    renderLog([]);
  }

  await loadConfig();
  await restoreDirectoryHandle();
}

init().catch(console.error);
