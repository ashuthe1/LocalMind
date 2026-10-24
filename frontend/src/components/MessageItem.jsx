// src/components/MessageItem.jsx
import { memo, useEffect, useRef, useState } from 'react';
import { Tooltip, Dialog } from '@mui/material';
import { Copy, Check, Pencil, RefreshCw, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import Markdown from './Markdown';
import { formatTime } from '../utils/dateUtils';
import { attachmentToDataUrl } from '../utils/images';
import { copyText } from '../utils/clipboard';

function Reasoning({ text, streaming, hasContent }) {
  const [open, setOpen] = useState(!hasContent);
  const userToggled = useRef(false);
  useEffect(() => {
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
        <span>{streaming && !hasContent ? 'Thinking…' : 'Thinking'}</span>
        <ChevronDown size={14} className={`chev ${open ? 'open' : ''}`} />
      </button>
      {open && <div className="reasoning-body">{text}</div>}
    </div>
  );
}

function statsText(stats) {
  if (!stats) return '';
  const parts = [];
  if (stats.tokensPerSecond) parts.push(`${Number(stats.tokensPerSecond).toFixed(1)} tok/s`);
  if (stats.outputTokens) parts.push(`${stats.outputTokens} tokens`);
  if (stats.stopped) parts.push('stopped');
  return parts.join(' · ');
}

function ActionButton({ title, onClick, children }) {
  return (
    <Tooltip title={title}>
      <button className="icon-btn" onClick={onClick} aria-label={title}>
        {children}
      </button>
    </Tooltip>
  );
}

function MessageItem({ message, isStreaming, status, assistant, appearance, isDark, canAct, onEdit, onEditAndResend, onRegenerate, onDelete }) {
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
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
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
    } catch {
      /* toast shown by caller */
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
      save(true);
    }
  };

  const time = appearance.showTimestamps ? formatTime(message.timestamp) : '';
  const showReasoning = appearance.showReasoning !== false && isAssistant && message.reasoning;
  const stats = isAssistant ? statsText(message.stats) : '';
  const modelLabel = isAssistant ? [message.providerName, message.model].filter(Boolean).join(' · ') : '';
  const meta = [time, message.editedAt ? 'edited' : '', modelLabel, stats].filter(Boolean);

  return (
    <div className={`message ${message.role}`}>
      <div className="avatar" aria-hidden="true">
        {isAssistant ? assistant?.avatar || '✨' : '⚙️'}
      </div>
      {editing ? (
        <div className="edit-box">
          <textarea ref={textareaRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onEditKey} disabled={saving} aria-label="Edit message" />
          <div className="edit-actions">
            <button className="btn text" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn" onClick={() => save(false)} disabled={saving || !draft.trim()}>
              Save
            </button>
            <button className="btn primary" onClick={() => save(true)} disabled={saving || !draft.trim()}>
              Save &amp; resend
            </button>
          </div>
        </div>
      ) : (
        <div className="body">
          <div className="bubble">
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
                  <Markdown content={message.content} isDark={isDark} />
                ) : isStreaming && !message.reasoning && !status ? (
                  <div className="typing-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                ) : null}
                {isStreaming && message.content && <span className="cursor" />}
                {hasError && <div className="error-note">{message.stats.error}</div>}
              </>
            ) : (
              message.content
            )}
          </div>
          <div className="meta-row">
            {meta.length > 0 && <span>{meta.join(' · ')}</span>}
            {!isStreaming && (
              <span className="actions">
                <ActionButton title={copied ? 'Copied' : 'Copy'} onClick={handleCopy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </ActionButton>
                {canAct && isUser && (
                  <ActionButton title="Edit" onClick={() => setEditing(true)}>
                    <Pencil size={14} />
                  </ActionButton>
                )}
                {canAct && isAssistant && (
                  <ActionButton title="Regenerate" onClick={() => onRegenerate?.(message)}>
                    <RefreshCw size={14} />
                  </ActionButton>
                )}
                {canAct && (
                  <ActionButton title="Delete" onClick={() => onDelete?.(message)}>
                    <Trash2 size={14} />
                  </ActionButton>
                )}
              </span>
            )}
          </div>
        </div>
      )}
      <Dialog open={Boolean(lightbox)} onClose={() => setLightbox(null)} maxWidth="lg">
        {lightbox && (
          <img src={attachmentToDataUrl(lightbox)} alt={lightbox.name || 'attachment'} style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'block' }} onClick={() => setLightbox(null)} />
        )}
      </Dialog>
    </div>
  );
}

export default memo(MessageItem);
