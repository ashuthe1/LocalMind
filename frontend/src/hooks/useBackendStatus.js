// src/hooks/useBackendStatus.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

const HEALTHY_INTERVAL = 20000;
const MIN_BACKOFF = 2000;
const MAX_BACKOFF = 30000;

/**
 * Polls /api/health. While the backend is down it retries with exponential backoff
 * and exposes a countdown; when it comes back, `onReconnect` fires so callers can refetch.
 */
export function useBackendStatus(onReconnect) {
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState(null);
  const [retryIn, setRetryIn] = useState(0);
  const [failures, setFailures] = useState(0);

  const onlineRef = useRef(true);
  const everOnlineRef = useRef(false);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const backoffRef = useRef(MIN_BACKOFF);
  const reconnectRef = useRef(onReconnect);
  reconnectRef.current = onReconnect;

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timerRef.current = null;
    countdownRef.current = null;
  };

  const scheduleRef = useRef(() => {});

  const check = useCallback(async () => {
    clearTimers();
    setChecking(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
      const wasOffline = !onlineRef.current;
      onlineRef.current = true;
      setOnline(true);
      setFailures(0);
      setRetryIn(0);
      backoffRef.current = MIN_BACKOFF;
      if (wasOffline && everOnlineRef.current) reconnectRef.current?.(data);
      everOnlineRef.current = true;
      scheduleRef.current(HEALTHY_INTERVAL, false);
    } catch {
      onlineRef.current = false;
      setOnline(false);
      setFailures((f) => f + 1);
      const delay = backoffRef.current;
      backoffRef.current = Math.min(MAX_BACKOFF, backoffRef.current * 2);
      scheduleRef.current(delay, true);
    } finally {
      setChecking(false);
    }
  }, []);

  scheduleRef.current = (delay, showCountdown) => {
    clearTimers();
    timerRef.current = setTimeout(check, delay);
    if (showCountdown) {
      const target = Date.now() + delay;
      setRetryIn(Math.ceil(delay / 1000));
      countdownRef.current = setInterval(() => {
        setRetryIn(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
      }, 500);
    }
  };

  useEffect(() => {
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
    };
  }, [check]);

  /** Report a failed API call so the banner appears immediately instead of at the next poll. */
  const reportFailure = useCallback(
    (err) => {
      if (err?.status === 0 && onlineRef.current) check();
    },
    [check]
  );

  return { online, checking, health, retryIn, failures, retry: check, reportFailure };
}
