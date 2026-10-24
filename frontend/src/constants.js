// src/constants.js — shared defaults
export const DEFAULT_ACCENT = '#4f6df5';

export const DEFAULT_APPEARANCE = {
  theme: 'system',
  accent: DEFAULT_ACCENT,
  fontSize: 'medium',
  showReasoning: true,
  showTimestamps: true,
  sendOnEnter: true,
};

export const DEFAULT_SETTINGS = {
  activeProviderId: '',
  activeModel: '',
  systemPrompt: '',
  assistant: { name: 'Smriti', avatar: '✨' },
  generation: {
    temperature: null,
    topP: null,
    maxTokens: null,
    contextLength: null,
    reasoning: 'auto',
    seed: null,
    stopSequences: [],
  },
  features: { autoTitle: true, historyLimit: 40, sendUserProfile: true },
  appearance: DEFAULT_APPEARANCE,
  providers: [],
};

/** The short list shown during setup and when adding a provider. */
export const PROVIDER_CHOICES = [
  { id: 'ollama', name: 'Ollama', sub: 'Runs on this computer', type: 'ollama', baseUrl: 'http://localhost:11434', needsApiKey: false },
  { id: 'lmstudio', name: 'LM Studio', sub: 'Runs on this computer', type: 'lmstudio', baseUrl: 'http://localhost:1234', needsApiKey: false },
  { id: 'openai', name: 'OpenAI', sub: 'Cloud · API key', type: 'openai', baseUrl: 'https://api.openai.com/v1', needsApiKey: true },
  { id: 'anthropic', name: 'Anthropic', sub: 'Cloud · API key', type: 'anthropic', baseUrl: 'https://api.anthropic.com', needsApiKey: true },
  { id: 'gemini', name: 'Google Gemini', sub: 'Cloud · API key', type: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', needsApiKey: true },
  { id: 'custom', name: 'Something else', sub: 'Any OpenAI-compatible URL', type: 'openai', baseUrl: '', needsApiKey: false },
];
