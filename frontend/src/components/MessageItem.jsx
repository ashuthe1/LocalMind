// src/components/MessageItem.jsx
import { memo, useEffect, useRef, useState } from 'react';
import { IconButton, Tooltip, Button, Dialog } from '@mui/material';
import { Copy, Check, Pencil, RefreshCw, Trash2, ChevronDown, Brain, Loader2 } from 'lucide-react';
import Markdown from './Markdown';
import { formatTime } from '../utils/dateUtils';
import { attachmentToDataUrl } from '../utils/images';
import { copyText } from '../utils/clipboard';

function Reasoning({ text, streaming, hasContent }) {
  const [open, setOpen] = useState(!hasContent);
  const userToggled = useRef(false);
  useEffect(() => {
    // Expand while only reasoning is streaming; collapse once the answer starts (unless the user toggled).
    if (!userToggled.current) setOpen(streaming && !hasContent);
  }, [streaming, hasContent]);
  if (!text) return null;
  return (
    <div className="reasoning">
      <button
        className="reasoning-toggle"
        onClick={() => {
          userToggled.current = true;
          setOpen((o) => !o);
        }}
        aria-expanded={open}
      >
        <Brain size={14} />
        <span>{streaming && !hasContent ? 'Thinking…' : 'Thinking'}</span>
        <ChevronDown size={16} className={`chev ${open ? 'open' : ''}`} />
      </button>
      {open && <div className="reasoning-body">{text}</div>}
    </div>
  );
}

function Stats({ stats }) {
  if (!stats) return null;
  const parts = [];
  if (stats.tokensPerSecond) parts.push(`${Number(stats.tokensPerSecond).toFixed(1)} tok/s`);
  if (stats.outputTokens) parts.push(`${stats.outputTokens} tokens`);
  if (stats.durationMs) parts.push(`${(stats.durationMs / 1000).toFixed(1)}s`);
  if (stats.stopped) parts.push('stopped');
  if (parts.length === 0) return null;
  return <span>{parts.join(' · ')}</span>;
}

function MessageItem({
  message,
  isStreaming,
  status,
  assistant,
  appearance,
  isDark,
  canAct,
  onEdit,
  onEditAndResend,
  onRegenerate,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const textareaRef = useRef(null);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const hasError = Boolean(message.stats?.error);

  useEffect(() => {
    if (editing) {
      setDraft(message.content);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
      }, 0);
    }
  }, [editing, message.content]);

  const handleCopy = async () => {
    if (await copyText(message.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const save = async (resend) => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      if (resend) await onEditAndResend?.(message, content);
      else await onEdit?.(message, content);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onEditKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save(isUser);
    }
  };

  const time = appearance.showTimestamps ? formatTime(message.timestamp) : '';
  const showReasoning = appearance.showReasoning !== false && isAssistant && message.reasoning;

  return (
    <div className={`message ${message.role}`}>
      <div className="avatar" aria-hidden="true">
        {isUser ? '🧑‍💻' : isAssistant ? assistant?.avatar || '✨' : '⚙️'}
      </div>
      {editing ? (
        <div className="edit-box">
          <textarea ref={textareaRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEditKey} disabled={saving} />
          <div className="edit-actions">
            <Button size="small" onClick={() => setEditing(false)} disabled={saving} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button size="small" variant="outlined" onClick={() => save(false)} disabled={saving || !draft.trim()} sx={{ textTransform: 'none' }}>
              Save
            </Button>
            {isUser && (
              <Button size="small" variant="contained" onClick={() => save(true)} disabled={saving || !draft.trim()} sx={{ textTransform: 'none' }}>
                Save &amp; resend
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="body">
          <div className={`bubble ${hasError ? 'error' : ''}`}>
            {message.images?.length > 0 && (
              <div className="images-grid">
                {message.images.map((img, i) => (
                  <img key={i} src={attachmentToDataUrl(img)} alt={img.name || 'attachment'} onClick={() => setLightbox(img)} />
                ))}
              </div>
            )}
            {showReasoning && <Reasoning text={message.reasoning} streaming={isStreaming} hasContent={Boolean(message.content)} />}
            {isStreaming && status && (
              <div className="status-line">
                <Loader2 size={14} className="spin" /> {status}
              </div>
            )}
            {isAssistant ? (
              <>
                {message.content ? (
                  <Markdown content={message.content} isDark={isDark} codeTheme={appearance.codeTheme} />
                ) : isStreaming && !message.reasoning && !status ? (
                  <div className="typing-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                ) : null}
                {isStreaming && message.content && <span className="cursor" />}
                {hasError && <div className="muted" style={{ fontSize: '0.85em', marginTop: 6 }}>⚠️ {message.stats.error}</div>}
              </>
            ) : (
              message.content
            )}
          </div>
          <div className="meta-row">
            {time && <span>{time}</span>}
            {message.editedAt && <span>edited</span>}
            {isAssistant && (message.model || message.providerName) && (
              <span className="badge" title={`${message.providerName || ''} ${message.model || ''}`.trim()}>
                {[message.providerName, message.model].filter(Boolean).join(' · ')}
              </span>
            )}
            {isAssistant && <Stats stats={message.stats} />}
            {!isStreaming && (
              <span className="actions">
                <Tooltip title={copied ? 'Copied' : 'Copy'}>
                  <IconButton size="small" onClick={handleCopy} aria-label="Copy message">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </IconButton>
                </Tooltip>
                {canAct && (
                  <>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditing(true)} aria-label="Edit message">
                        <Pencil size={14} />
                      </IconButton>
                    </Tooltip>
                    {isAssistant && (
                      <Tooltip title="Regenerate">
                        <IconButton size="small" onClick={() => onRegenerate?.(message)} aria-label="Regenerate response">
                          <RefreshCw size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => onDelete?.(message)} aria-label="Delete message">
                        <Trash2 size={14} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      )}
      <Dialog open={Boolean(lightbox)} onClose={() => setLightbox(null)} maxWidth="lg">
        {lightbox && (
          <img
            src={attachmentToDataUrl(lightbox)}
            alt={lightbox.name || 'attachment'}
            style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'block' }}
            onClick={() => setLightbox(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

export default memo(MessageItem);
