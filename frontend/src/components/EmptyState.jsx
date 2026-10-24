// src/components/EmptyState.jsx
const SUGGESTIONS = ['Explain how transformers work in simple terms', 'Write a bash script that renames files by date', 'Help me plan a 3-day trip to Kyoto'];

export default function EmptyState({ assistant, activeModel, onPick }) {
  return (
    <div className="empty-state">
      <div className="mark" aria-hidden="true">
        {assistant?.avatar || '✨'}
      </div>
      <h2>{assistant?.name || 'Your assistant'}</h2>
      <p>
        Private, local chat{activeModel ? <> with <strong>{activeModel}</strong></> : ''}. Ask anything, or drop in an image.
      </p>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="suggestion" onClick={() => onPick?.(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
