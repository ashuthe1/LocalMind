// src/components/Composer.jsx
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Send, Square, ImagePlus, X } from 'lucide-react';
import { fileToAttachment, filesFromDataTransfer, attachmentToDataUrl, MAX_IMAGES } from '../utils/images';
import { useToast } from '../context/ToastContext';

const Composer = forwardRef(function Composer(
  { onSend, onStop, streaming, disabled, disabledReason, onOpenSettings, sendOnEnter, assistantName },
  ref
) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const toast = useToast();

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    setText: (v) => {
      setText(v);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
  }));

  // auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  const addFiles = useCallback(
    async (files) => {
      const list = Array.from(files || []);
      if (list.length === 0) return;
      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        toast.warning(`You can attach up to ${MAX_IMAGES} images`);
        return;
      }
      const results = await Promise.allSettled(list.slice(0, room).map(fileToAttachment));
      const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      results.filter((r) => r.status === 'rejected').forEach((r) => toast.error(r.reason?.message || 'Could not attach file'));
      if (list.length > room) toast.warning(`Only ${room} more image${room === 1 ? '' : 's'} could be attached`);
      if (ok.length) setImages((prev) => [...prev, ...ok]);
    },
    [images.length, toast]
  );

  const canSend = !disabled && !streaming && (text.trim().length > 0 || images.length > 0);

  const submit = () => {
    if (!canSend) return;
    const content = text.trim();
    onSend({ content, images });
    setText('');
    setImages([]);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && streaming) {
      e.preventDefault();
      onStop?.();
      return;
    }
    if (e.key !== 'Enter') return;
    const mod = e.ctrlKey || e.metaKey;
    if (sendOnEnter) {
      if (!e.shiftKey && !e.altKey && !mod && !e.nativeEvent?.isComposing) {
        e.preventDefault();
        submit();
      }
    } else if (mod) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e) => {
    const files = filesFromDataTransfer(e.clipboardData).filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(filesFromDataTransfer(e.dataTransfer));
  };

  const placeholder = disabled
    ? disabledReason || 'Configure a provider to start chatting'
    : streaming
      ? `${assistantName || 'Assistant'} is responding… press Esc to stop`
      : `Message ${assistantName || 'your assistant'}…`;

  return (
    <div className="composer-wrap">
      <div
        className={`composer ${dragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {images.length > 0 && (
          <div className="attachments">
            {images.map((img, i) => (
              <div className="attachment" key={`${img.name}-${i}`}>
                <img src={attachmentToDataUrl(img)} alt={img.name} />
                <button className="remove" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${img.name}`}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Message"
        />
        <div className="composer-bar">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Tooltip title="Attach images">
            <span>
              <IconButton size="small" onClick={() => fileRef.current?.click()} disabled={disabled || streaming} aria-label="Attach images">
                <ImagePlus size={18} />
              </IconButton>
            </span>
          </Tooltip>
          <span className="spacer" />
          {streaming ? (
            <Tooltip title="Stop generating (Esc)">
              <button className="send-btn stop" onClick={onStop} aria-label="Stop generating">
                <Square size={16} fill="currentColor" />
              </button>
            </Tooltip>
          ) : (
            <button className="send-btn" onClick={submit} disabled={!canSend} aria-label="Send message">
              <Send size={17} />
            </button>
          )}
        </div>
      </div>
      <div className="composer-hint">
        {disabled ? (
          <>
            {disabledReason || 'No provider configured.'}{' '}
            <button onClick={onOpenSettings}>Open settings</button>
          </>
        ) : sendOnEnter ? (
          <>
            <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
          </>
        ) : (
          <>
            <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> to send
          </>
        )}
      </div>
    </div>
  );
});

export default Composer;
