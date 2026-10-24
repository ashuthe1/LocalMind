// src/constants.js — shared defaults and option lists
export const DEFAULT_APPEARANCE = {
  theme: 'system',
  accent: '#3f51b5',
  fontSize: 'medium',
  codeTheme: 'material',
  showReasoning: true,
  showTimestamps: true,
  sendOnEnter: true,
  compact: false,
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

export const CODE_THEMES = [
  { id: 'material', label: 'Material' },
  { id: 'one', label: 'One Dark / Light' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'dracula', label: 'Dracula / GitHub' },
];
