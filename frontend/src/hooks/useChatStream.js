// src/hooks/useChatStream.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

/**
 * Handles POST /api/chat and POST /api/chats/{id}/regenerate streams.
 * `handlers` is a ref-stable object with optional callbacks:
 *   onMeta(meta), onStatus(text), onReasoning(text), onContent(text), onError(message),
 *   onDone({ message, chat }), onTitle({ chatId, title }), onFinish(ctx)
 */
export function useChatStream(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const abortRef = useRef(null);
  const [streaming, setStreaming] = useState(null); // { chatId, assistantMessageId, status }

  const run = useCallback(async (starter, ctx) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const state = { ...ctx, assistantMessageId: null, status: '', gotDone: false, aborted: false };
    setStreaming({ ...state });

    const h = () => handlersRef.current || {};
    const onEvent = ({ event, data }) => {
      switch (event) {
        case 'meta':
          state.chatId = data.chatId || state.chatId;
          state.assistantMessageId = data.assistantMessageId;
          setStreaming({ ...state });
          h().onMeta?.(data, state);
          break;
        case 'status':
          state.status = data?.text || '';
          setStreaming({ ...state });
          h().onStatus?.(state.status, state);
          break;
        case 'reasoning':
          if (data?.text) h().onReasoning?.(data.text, state);
          break;
        case 'content':
          if (state.status) {
            state.status = '';
            setStreaming({ ...state });
          }
          if (data?.text) h().onContent?.(data.text, state);
          break;
        case 'error':
          h().onError?.(data?.message || 'Generation failed', state);
          break;
        case 'done':
          state.gotDone = true;
          h().onDone?.(data, state);
          break;
        case 'title':
          h().onTitle?.(data, state);
          break;
        default:
          break;
      }
    };

    try {
      await starter(onEvent, controller.signal);
    } catch (err) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        state.aborted = true;
      } else {
        h().onError?.(err?.message || 'Request failed', state, err);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(null);
      h().onFinish?.(state);
    }
  }, []);

  const send = useCallback(
    ({ chatId = '', content, images = [], providerId = '', model = '' }) =>
      run((onEvent, signal) => api.sendMessage({ chatId, content, images, providerId, model }, onEvent, signal), {
        chatId,
        kind: 'send',
      }),
    [run]
  );

  const regenerate = useCallback(
    ({ chatId, messageId = '', providerId = '', model = '' }) =>
      run((onEvent, signal) => api.regenerate(chatId, { messageId, providerId, model }, onEvent, signal), {
        chatId,
        kind: 'regenerate',
      }),
    [run]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { streaming, isStreaming: Boolean(streaming), send, regenerate, stop };
}
