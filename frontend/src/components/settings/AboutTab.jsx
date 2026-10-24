// src/components/settings/AboutTab.jsx
const REPO = 'https://github.com/ashuthe1/LocalMind';

export default function AboutTab({ health }) {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '');
  const mod = isMac ? '⌘' : 'Ctrl';
  return (
    <>
      <div className="settings-section">
        <h2>LocalMind</h2>
        <div className="desc">A private chat UI for any LLM provider. Your conversations stay on your machine.</div>
        <div className="kv">
          <span>Version</span>
          <span>{health?.version || '—'}</span>
          <span>Storage</span>
          <span>{health?.storage || '—'}</span>
          <span>Default provider</span>
          <span>{health?.activeProvider ? `${health.activeProvider.name} · ${health.activeProvider.model || 'default model'}` : 'none'}</span>
        </div>
        <div className="settings-row" style={{ justifyContent: 'flex-start' }}>
          <a className="btn" href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="btn" href={`${REPO}/issues`} target="_blank" rel="noreferrer">
            Report an issue
          </a>
        </div>
      </div>
      <div className="settings-section">
        <h2>Keyboard shortcuts</h2>
        <div className="shortcut-list">
          <span>
            <kbd>{mod}</kbd> + <kbd>K</kbd>
          </span>
          <span>Search chats</span>
          <span>
            <kbd>{mod}</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>
          </span>
          <span>New chat</span>
          <span>
            <kbd>Esc</kbd>
          </span>
          <span>Stop generating / cancel an edit</span>
          <span>
            <kbd>Shift</kbd> + <kbd>Enter</kbd>
          </span>
          <span>New line in the message box</span>
          <span>
            <kbd>{mod}</kbd> + <kbd>V</kbd>
          </span>
          <span>Paste an image to attach it</span>
        </div>
      </div>
      <div className="settings-section">
        <div className="field-hint">MIT licensed. Built with Go, React and Vite.</div>
      </div>
    </>
  );
}
