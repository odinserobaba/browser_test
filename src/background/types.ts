export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface LLMResponse {
  locator: string;
  error?: string;
}

export interface StorageData {
  apiKey?: string;
  selectedDirectory?: string;
  recordingState?: {
    isRecording: boolean;
    actions: any[];
  };
}
