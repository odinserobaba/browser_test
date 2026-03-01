export interface ElementSignature {
  /** Tag name, e.g. "button", "a", "input" */
  tag: string;
  /** @deprecated use tag */
  tagName?: string;

  id?: string;
  classes?: string[];
  text?: string;

  // Form / input attributes
  name?: string;
  placeholder?: string;
  type?: string;
  value?: string;
  checked?: boolean;
  selected?: boolean;

  // Link
  href?: string;

  // ARIA / accessibility
  role?: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
  title?: string;

  /** Text of the associated <label for="..."> element */
  label?: string;

  /** data-testid (highest priority for locator) */
  testId?: string;

  /** All other data-* attributes (e.g. { "data-qa": "submit-btn" }) */
  dataAttributes?: Record<string, string>;

  /** CSS selector path from the element up to the nearest stable ancestor */
  cssPath?: string;
}

export interface RecordedAction {
  type: 'click' | 'fill' | 'select' | 'navigate' | 'upload';
  timestamp: number;
  url: string;

  /** Structural attributes of the clicked/filled element */
  element?: ElementSignature;

  /** Value typed / selected */
  value?: string;

  /**
   * Serialized outerHTML of the element's ancestor (3–4 levels up).
   * Includes siblings so LLM can understand surrounding context.
   * The target element is marked with data-playwright-target="1".
   */
  domSnapshot?: string;

  /**
   * outerHTML of the nearest semantic ancestor
   * (form / section / main / article / nav / header / footer / dialog).
   * Gives LLM a wider view of the page region.
   */
  pageContext?: string;

  /** document.title at the moment of the action */
  pageTitle?: string;

  /** AI-generated Playwright locator (filled after LLM call) */
  selector?: string;
}

export interface RecordingState {
  isRecording: boolean;
  actions: RecordedAction[];
}
