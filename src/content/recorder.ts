/**
 * Recorder — collects rich element context for reliable Playwright locator generation.
 *
 * Key improvements over the basic version:
 *  - domSnapshot   = outerHTML of ancestor 3-4 levels up (with siblings),
 *                    target element marked with data-playwright-target="1"
 *  - pageContext    = outerHTML of nearest semantic landmark (form/section/main…)
 *  - ElementSignature captures aria-label, associated <label>, all data-* attrs,
 *    a short CSS path, and normalised text
 */

import { ElementSignature, RecordedAction } from './types';
import { isHighlightElement } from './highlighter';

// ── Element Signature ────────────────────────────────────────────

/** Semantic / landmark tags that provide meaningful page context */
const LANDMARK_TAGS = new Set([
  'form', 'main', 'section', 'article',
  'nav', 'header', 'footer', 'aside', 'dialog',
]);

/** Tags we walk up to when looking for an interactive element */
const INTERACTIVE_TAGS = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'label',
]);

export function collectElementSignature(el: HTMLElement): ElementSignature {
  const sig: ElementSignature = {
    tag:     el.tagName.toLowerCase(),
    tagName: el.tagName.toLowerCase(), // backward compat
  };

  // ID (skip dynamic ones)
  if (el.id && !isDynamicId(el.id)) sig.id = el.id;

  // CSS class list (skip too-generic classes)
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(/\s+/).filter(c => c.length > 0 && c.length < 40);
    if (classes.length) sig.classes = classes;
  }

  // Visible text (trim whitespace, cap length)
  const rawText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (rawText && rawText.length < 120) sig.text = rawText;

  // data-testid (highest priority!)
  const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
  if (testId) sig.testId = testId;

  // All other data-* attributes
  const dataAttrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-') && attr.name !== 'data-testid' && attr.name !== 'data-test-id') {
      dataAttrs[attr.name] = attr.value;
    }
  }
  if (Object.keys(dataAttrs).length) sig.dataAttributes = dataAttrs;

  // ARIA
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) sig.ariaLabel = ariaLabel;

  const ariaLabelledby = el.getAttribute('aria-labelledby');
  if (ariaLabelledby) {
    // Resolve the referenced element's text
    const refEl = document.getElementById(ariaLabelledby);
    if (refEl) {
      sig.ariaLabelledby = (refEl.innerText || refEl.textContent || '').trim().slice(0, 80);
    }
  }

  const role = el.getAttribute('role');
  if (role) sig.role = role;

  const title = el.getAttribute('title');
  if (title) sig.title = title;

  // Associated <label> text (for inputs)
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const associatedLabel = findAssociatedLabel(el);
    if (associatedLabel) sig.label = associatedLabel;

    sig.name        = el.name        || undefined;
    sig.placeholder = (el as HTMLInputElement).placeholder || undefined;
    sig.type        = (el as HTMLInputElement).type        || undefined;
  }

  if (el instanceof HTMLInputElement)  sig.checked  = el.checked;
  if (el instanceof HTMLSelectElement) sig.selected = el.selectedIndex >= 0;
  if (el instanceof HTMLAnchorElement) sig.href = el.href || undefined;

  // Short CSS path (element → up to 3 stable ancestors)
  sig.cssPath = buildCssPath(el, 3);

  return sig;
}

/** Return the text of a <label> associated with a form element */
function findAssociatedLabel(el: HTMLElement): string | undefined {
  // By id attribute
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return (label.innerText || label.textContent || '').trim().slice(0, 80);
  }
  // Closest wrapping <label>
  const parent = el.closest('label');
  if (parent) {
    const clone = parent.cloneNode(true) as HTMLElement;
    // Remove the input from the clone so we get only the label text
    clone.querySelectorAll('input, select, textarea').forEach(n => n.remove());
    return (clone.innerText || clone.textContent || '').trim().slice(0, 80);
  }
  return undefined;
}

/** Build a short, readable CSS selector path from el upward (max `depth` steps) */
function buildCssPath(el: HTMLElement, depth: number): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;

  for (let i = 0; i < depth && current && current !== document.body; i++) {
    parts.unshift(describeSingleElement(current));
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function describeSingleElement(el: HTMLElement): string {
  let desc = el.tagName.toLowerCase();
  if (el.id && !isDynamicId(el.id)) desc += `#${el.id}`;
  else {
    const testId = el.getAttribute('data-testid');
    if (testId) desc += `[data-testid="${testId}"]`;
    else if (el.className && typeof el.className === 'string') {
      const first = el.className.split(/\s+/)[0];
      if (first && first.length < 30) desc += `.${first}`;
    }
  }
  return desc;
}

function isDynamicId(id: string): boolean {
  return /^\d{5,}$/.test(id) ||
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ||
    /^[a-z0-9]{20,}$/i.test(id);
}

// ── DOM Snapshots ────────────────────────────────────────────────

const TARGET_ATTR = 'data-playwright-target';
const MAX_SNAPSHOT_BYTES = 5000;
const MAX_CONTEXT_BYTES  = 8000;

/**
 * Captures outerHTML of an ancestor `depth` levels above `el`.
 * Temporarily marks `el` with data-playwright-target="1" so the
 * LLM knows exactly which element to build a locator for.
 */
export function getDomSnapshot(el: HTMLElement, depth = 4): string {
  // Mark the target element
  el.setAttribute(TARGET_ATTR, '1');

  try {
    // Walk up `depth` levels
    let ancestor: HTMLElement = el;
    for (let i = 0; i < depth; i++) {
      if (ancestor.parentElement && ancestor.parentElement !== document.documentElement) {
        ancestor = ancestor.parentElement;
      } else break;
    }

    // Serialize and truncate
    const html = ancestor.outerHTML;
    return html.length > MAX_SNAPSHOT_BYTES
      ? html.slice(0, MAX_SNAPSHOT_BYTES) + '\n<!-- truncated -->'
      : html;
  } finally {
    el.removeAttribute(TARGET_ATTR);
  }
}

/**
 * Returns the outerHTML of the nearest semantic landmark ancestor
 * (form, main, section, article, nav, header, footer, dialog).
 * If none found, returns the direct parent's outerHTML.
 * Gives LLM a broader view of the page region.
 */
export function getPageContext(el: HTMLElement): string | undefined {
  let current: HTMLElement | null = el.parentElement;

  while (current && current !== document.documentElement) {
    if (LANDMARK_TAGS.has(current.tagName.toLowerCase())) {
      const html = current.outerHTML;
      return html.length > MAX_CONTEXT_BYTES
        ? html.slice(0, MAX_CONTEXT_BYTES) + '\n<!-- truncated -->'
        : html;
    }
    current = current.parentElement;
  }

  // Fallback: 5 levels up
  let ancestor: HTMLElement = el;
  for (let i = 0; i < 5 && ancestor.parentElement; i++) {
    ancestor = ancestor.parentElement;
  }
  if (ancestor === el) return undefined;
  const html = ancestor.outerHTML;
  return html.length > MAX_CONTEXT_BYTES
    ? html.slice(0, MAX_CONTEXT_BYTES) + '\n<!-- truncated -->'
    : html;
}

// ── Event helpers ────────────────────────────────────────────────

export function getTargetElement(event: Event): HTMLElement | null {
  const target = event.target as HTMLElement;
  if (!target) return null;
  if (isHighlightElement(target)) return null;

  // Walk up to the nearest interactive element
  let el: HTMLElement | null = target;
  while (el && el !== document.body) {
    const tag = el.tagName.toLowerCase();
    if (
      INTERACTIVE_TAGS.has(tag) ||
      el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'link' ||
      el.getAttribute('data-testid') ||
      el.onclick !== null
    ) {
      return el;
    }
    el = el.parentElement;
  }

  return target;
}

export function createActionRecord(
  type: RecordedAction['type'],
  element: HTMLElement | null,
  value?: string,
): RecordedAction | null {
  if (!element) return null;

  return {
    type,
    timestamp: Date.now(),
    url:         window.location.href,
    pageTitle:   document.title || undefined,
    element:     collectElementSignature(element),
    value,
    domSnapshot: getDomSnapshot(element, 4),
    pageContext: getPageContext(element),
  };
}
