// src/context/SettingsContext.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { DEFAULT_APPEARANCE, DEFAULT_SETTINGS } from '../constants';

const APPEARANCE_KEY = 'localmind.appearance';

function readCachedAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (raw) return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
    // migrate the old boolean theme flag
    const legacy = localStorage.getItem('theme');
    if (legacy !== null) return { ...DEFAULT_APPEARANCE, theme: JSON.parse(legacy) ? 'dark' : 'light' };
  } catch {
    /* ignore */
  }
  return DEFAULT_APPEARANCE;
}

function cacheAppearance(appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  } catch {
    /* ignore */
  }
}

function mergeSettings(base, incoming) {
  if (!incoming) return base;
  return {
    ...base,
    ...incoming,
    assistant: { ...base.assistant, ...(incoming.assistant || {}) },
    generation: { ...base.generation, ...(incoming.generation || {}) },
    features: { ...base.features, ...(incoming.features || {}) },
    appearance: { ...base.appearance, ...(incoming.appearance || {}) },
    providers: incoming.providers ?? base.providers,
  };
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children, onError }) {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, appearance: readCachedAppearance() }));
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const refresh = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setSettings((prev) => mergeSettings(prev, data));
      if (data?.appearance) cacheAppearance({ ...DEFAULT_APPEARANCE, ...data.appearance });
      setLoadError(null);
      setLoaded(true);
      return data;
    } catch (err) {
      setLoadError(err);
      onError?.(err);
      return null;
    }
  }, [onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Optimistically merges a partial settings object, then persists it. */
  const update = useCallback(
    async (partial) => {
      const previous = settingsRef.current;
      const optimistic = mergeSettings(previous, partial);
      setSettings(optimistic);
      if (partial.appearance) cacheAppearance(optimistic.appearance);
      try {
        // Send full nested objects so the backend's top-level merge keeps sibling keys.
        const body = {};
        for (const key of Object.keys(partial)) body[key] = optimistic[key];
        const saved = await api.updateSettings(body);
        if (saved) setSettings((prev) => mergeSettings(prev, saved));
        return true;
      } catch (err) {
        setSettings(previous);
        if (partial.appearance) cacheAppearance(previous.appearance);
        onError?.(err);
        return false;
      }
    },
    [onError]
  );

  const updateAppearance = useCallback((patch) => update({ appearance: patch }), [update]);

  /** Replaces the local provider list (after provider CRUD) without a round trip. */
  const setProviders = useCallback((providers, extra = {}) => {
    setSettings((prev) => ({ ...prev, providers, ...extra }));
  }, []);

  const value = useMemo(() => {
    const providers = settings.providers || [];
    const enabledProviders = providers.filter((p) => p.enabled !== false);
    const activeProvider = providers.find((p) => p.id === settings.activeProviderId) || null;
    return {
      settings,
      loaded,
      loadError,
      refresh,
      update,
      updateAppearance,
      setProviders,
      providers,
      enabledProviders,
      activeProvider,
      appearance: settings.appearance,
    };
  }, [settings, loaded, loadError, refresh, update, updateAppearance, setProviders]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
