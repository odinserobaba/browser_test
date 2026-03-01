export interface ElementSignature {
  tagName: string;
  id?: string;
  classes?: string[];
  text?: string;
  name?: string;
  placeholder?: string;
  type?: string;
  role?: string;
  testId?: string;
  href?: string;
  value?: string;
  checked?: boolean;
  selected?: boolean;
}

export interface RecordedAction {
  type: 'click' | 'fill' | 'select' | 'navigate' | 'upload';
  timestamp: number;
  url: string;
  element?: ElementSignature;
  value?: string;
  domSnapshot?: string;
  selector?: string;
}

export interface RecordingState {
  isRecording: boolean;
  actions: RecordedAction[];
}
