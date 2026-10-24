// src/components/EmptyState.jsx
import { Button } from '@mui/material';
import { Settings } from 'lucide-react';

const SUGGESTIONS = [
  'Explain how transformers work in simple terms',
  'Write a bash script that renames files by date',
  'Help me plan a 3-day trip to Kyoto',
  'Review this paragraph for clarity: …',
];

export default function EmptyState({ assistant, hasProvider, activeModel, onOpenSettings, onPick }) {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '');
  const mod = isMac ? '⌘' : 'Ctrl';
  return (
    <div className="empty-state">
      <div className="avatar" aria-hidden="true">
        {assistant?.avatar || '✨'}
      </div>
      <h2>Hi, I&apos;m {assistant?.name || 'your assistant'}</h2>
      {hasProvider ? (
        <p>
          Everything you type stays on your machine. Currently talking to <strong>{activeModel || 'the default model'}</strong>.
          Ask anything, attach an image, or pick a suggestion below.
        </p>
      ) : (
        <>
          <p>
            No LLM provider is configured yet. Connect Ollama, LM Studio, llama.cpp, OpenAI, Anthropic, Gemini or any
            OpenAI-compatible server to start chatting.
          </p>
          <Button variant="contained" startIcon={<Settings size={18} />} onClick={onOpenSettings} sx={{ textTransform: 'none', borderRadius: 3 }}>
            Set up a provider
          </Button>
        </>
      )}
      {hasProvider && (
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="suggestion" onClick={() => onPick?.(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="hints">
        <span className="hint">
          <kbd>{mod}</kbd> + <kbd>K</kbd> search chats
        </span>
        <span className="hint">
          <kbd>{mod}</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> new chat
        </span>
        <span className="hint">
          <kbd>Esc</kbd> stop generating
        </span>
        <span className="hint">paste or drop images to attach</span>
      </div>
    </div>
  );
}
