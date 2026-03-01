import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const data = JSON.parse(readFileSync('tests/tests/session_2026-03-01T19-03-18.json', 'utf8'));

// ── Selector heuristic ───────────────────────────────────────────

function buildLocator(action) {
  const e   = action.element || {};
  const dom = action.domSnapshot || '';
  const cp  = e.cssPath || '';

  // 1. data-testid — most stable
  if (e.testId)
    return `page.get_by_test_id("${e.testId}")`;

  // 2. aria-label
  if (e.ariaLabel) {
    const role = e.role || (e.tag === 'button' ? 'button' : 'link');
    return `page.get_by_role("${role}", name="${e.ariaLabel}")`;
  }

  // 3. <label> — for form elements
  if (e.label && (action.type === 'fill' || action.type === 'select'))
    return `page.get_by_label("${e.label}")`;

  // 4. placeholder
  if (e.placeholder)
    return `page.get_by_placeholder("${e.placeholder}")`;

  // 5. role + text
  if (e.role && e.text && e.text.length < 80)
    return `page.get_by_role("${e.role}", name="${e.text.trim()}")`;

  // 6. link (tag=a) by text — scope to the stable ancestor if possible
  if (e.tag === 'a' && e.text && e.text.length < 80) {
    const cleanText = e.text.trim();

    // Breadcrumb nav context?
    const isBreadcrumb = dom.includes('t-breadcrumb') || dom.includes('breadcrumb')
      || cp.includes('nav') || dom.includes('"nav ') || dom.includes('"nav"');

    if (isBreadcrumb) {
      // Extract the most specific stable nav class from domSnapshot
      const navClassMatch = dom.match(/class="((?:nav)[^"]*)"/);
      const navClass = navClassMatch
        ? navClassMatch[1].trim().split(/\s+/).slice(0, 2).join('.')
        : 'nav';
      return `page.locator("td.${navClass}").get_by_text("${cleanText}", exact=True)`;
    }

    // Sub-forum list context?
    if (cp.includes('subforums') || cp.includes('sf_title') || dom.includes('subforums')) {
      return `page.locator("p.subforums").get_by_text("${cleanText}", exact=True)`;
    }

    // Forum link in list (e.g. h4.forumlink > a)?
    if (dom.includes('forumlink')) {
      return `page.locator("h4.forumlink").get_by_text("${cleanText}", exact=True)`;
    }

    // Generic link
    return `page.get_by_role("link", name="${cleanText}", exact=True)`;
  }

  // 7. button by text
  if ((e.tag === 'button' || e.role === 'button') && e.text)
    return `page.get_by_role("button", name="${e.text.trim()}")`;

  // 8. id
  if (e.id) return `page.locator("#${e.id}")`;

  // 9. cssPath fallback
  if (cp) return `page.locator("${cp}")`;

  return `page.locator("${e.tag || 'unknown'}")`;
}

function applyAction(loc, action) {
  switch (action.type) {
    case 'click':  return `${loc}.click()`;
    case 'fill': {
      const v = action.element?.type === 'password'
        ? `os.getenv("TEST_PASSWORD", "")`
        : `"${action.value || ''}"`;
      return `${loc}.fill(${v})`;
    }
    case 'select': return `${loc}.select_option("${action.value || ''}")`;
    default:       return `${loc}.click()`;
  }
}

// ── Analyse each action and pick best selector ───────────────────

console.log('\n══════════════════════════════════════════════════');
console.log('  Session analysis: session_2026-03-01T19-03-18');
console.log(`  Pages: ${data.pageCount}   Actions: ${data.actionCount}`);
console.log('══════════════════════════════════════════════════\n');

const resolved = data.actions.map((action, i) => {
  const e   = action.element || {};
  const loc = buildLocator(action);
  const cmd = applyAction(loc, action);

  const reason = e.testId       ? 'data-testid (best)'
    : e.ariaLabel                ? 'aria-label'
    : e.label                    ? '<label> text'
    : e.placeholder              ? 'placeholder'
    : e.role                     ? 'role + text'
    : loc.includes('breadcrumb') ? 'scoped to breadcrumb nav'
    : loc.includes('subforums')  ? 'scoped to subforum list'
    : loc.includes('forumlink')  ? 'scoped to forum link'
    : e.text                     ? 'link text (exact)'
    : e.id                       ? 'id'
    :                              'cssPath fallback';

  console.log(`Step ${i + 1} — ${action.type.toUpperCase()}`);
  console.log(`  URL      : ${action.url}`);
  console.log(`  Element  : <${e.tag}> ${e.text ? `"${e.text.slice(0, 60)}"` : ''}`);
  console.log(`  Strategy : ${reason}`);
  console.log(`  Locator  : ${loc}`);
  console.log(`  Command  : ${cmd}`);
  console.log('');

  return { action, loc, cmd, reason };
});

// ── Generate Playwright Python test ─────────────────────────────

const lines = [];
lines.push('import os');
lines.push('import pytest');
lines.push('from playwright.sync_api import Page, expect');
lines.push('');
lines.push('');
lines.push('def test_rutracker_navigation(page: Page):');
lines.push('    """');
lines.push('    Auto-generated from: session_2026-03-01T19-03-18.json');
lines.push(`    Pages captured during recording: ${data.pageCount}`);
lines.push(`    Actions: ${data.actionCount}`);
lines.push('    Generated by: AI Playwright Recorder (heuristic fallback, no LLM)');
lines.push('    """');
lines.push('');

// Navigate to the starting URL
const startUrl = data.actions[0]?.url;
if (startUrl) {
  lines.push(`    page.goto("${startUrl}")`);
  // Wait for page to load using a stable element in the first action's context
  lines.push('    page.wait_for_load_state("domcontentloaded")');
}
lines.push('');

resolved.forEach(({ action, cmd, reason }, i) => {
  const e       = action.element || {};
  const display = e.text
    ? `"${e.text.slice(0, 50)}"`
    : (e.href ? `→ ${e.href.split('/').pop()}` : action.type);

  lines.push(`    # Step ${i + 1}: ${action.type.toUpperCase()} ${display}`);
  lines.push(`    # Selector strategy: ${reason}`);
  lines.push(`    ${cmd}`);

  // Wait for navigation if the next action is on a different URL
  const nextUrl = data.actions[i + 1]?.url;
  if (nextUrl && nextUrl !== action.url) {
    lines.push(`    page.wait_for_url("${nextUrl}")`);
  }
  lines.push('');
});

// Final assertion using captured page title
const lastAction   = data.actions[data.actions.length - 1];
const lastNextUrl  = /* url of final page: */ data.pages
  ?.find(p => p.url !== lastAction?.url && data.actions.some(a => a.url === lastAction?.url))?.url;
const finalPage    = data.pages?.find(p =>
  p.url !== lastAction?.url && !data.actions.some(a => a.url === p.url));
if (finalPage) {
  lines.push(`    # Verify final page`);
  lines.push(`    expect(page).to_have_title("${finalPage.title.replace(/"/g, '\\"')}")`);
  lines.push('');
}

// conftest.py hint
lines.push('');
lines.push('# ── conftest.py (add to your tests/ directory) ──────────────');
lines.push('# import pytest');
lines.push('# from playwright.sync_api import sync_playwright');
lines.push('#');
lines.push('# @pytest.fixture(scope="session")');
lines.push('# def browser_context_args(browser_context_args):');
lines.push('#     return { **browser_context_args, "locale": "ru-RU" }');

const pyCode = lines.join('\n');
console.log('══════════════════════════════════════════════════');
console.log('  Generated Playwright Python test:');
console.log('══════════════════════════════════════════════════\n');
console.log(pyCode);

// Save
mkdirSync('tests/tests', { recursive: true });
const outPath = 'tests/tests/test_rutracker_navigation.py';
writeFileSync(outPath, pyCode, 'utf8');
console.log(`\n✓ Saved to ${outPath}`);
