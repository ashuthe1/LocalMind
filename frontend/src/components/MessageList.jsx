// src/components/MessageList.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import MessageItem from './MessageItem';

export default function MessageList({ messages, streaming, assistant, appearance, isDark, onEdit, onEditAndResend, onRegenerate, onDelete }) {
  const containerRef = useRef(null);
  const endRef = useRef(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinnedToBottom(distance < 80);
  }, []);

  const last = messages.length ? messages[messages.length - 1] : null;
  const lastLen = (last?.content?.length || 0) + (last?.reasoning?.length || 0);

  useEffect(() => {
    if (pinnedToBottom) endRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
  }, [messages.length, lastLen, pinnedToBottom, streaming]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    setPinnedToBottom(true);
  };

  return (
    <>
      <div className="messages-container" ref={containerRef} onScroll={onScroll}>
        <div className="messages-inner">
          {messages.map((msg) => {
            const isStreamingMsg = Boolean(streaming && streaming.assistantMessageId === msg.id);
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                isStreaming={isStreamingMsg}
                status={isStreamingMsg ? streaming.status : ''}
                assistant={assistant}
                appearance={appearance}
                isDark={isDark}
                canAct={!streaming}
                onEdit={onEdit}
                onEditAndResend={onEditAndResend}
                onRegenerate={onRegenerate}
                onDelete={onDelete}
              />
            );
          })}
          <div ref={endRef} />
        </div>
      </div>
      {!pinnedToBottom && (
        <button className="scroll-to-bottom" onClick={scrollToBottom} aria-label="Scroll to bottom">
          <ArrowDown size={16} />
        </button>
      )}
    </>
  );
}
