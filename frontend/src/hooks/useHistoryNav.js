// src/hooks/useHistoryNav.js
import { useCallback, useEffect, useRef, useState } from 'react';

const ROOT = { view: 'chat', panel: 'list' };

/**
 * Drives the single-page views with the History API so the browser / Android back
 * button walks back to the main screen instead of leaving the app (issue #4).
 *
 * state.view:  'chat' | 'settings'
 * state.panel: 'list' | 'chat'  (mobile only: whether a conversation is open over the list)
 */
export function useHistoryNav() {
  const [nav, setNav] = useState(() => ({ ...ROOT, ...(window.history.state?.lm || {}) }));
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    if (!window.history.state?.lm) {
      window.history.replaceState({ lm: ROOT }, '', window.location.href);
    }
    const onPop = (e) => {
      setNav({ ...ROOT, ...(e.state?.lm || {}) });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // pushState runs outside the state updater: React StrictMode double-invokes updaters in dev,
  // which would otherwise create duplicate history entries.
  const push = useCallback((next) => {
    const prev = navRef.current;
    const state = { ...prev, ...next };
    if (state.view === prev.view && state.panel === prev.panel) return;
    window.history.pushState({ lm: state }, '', window.location.href);
    navRef.current = state;
    setNav(state);
  }, []);

  /** Go back to the root (chat list) view without touching the history stack. */
  const goRoot = useCallback(() => {
    const prev = navRef.current;
    if (prev.view === ROOT.view && prev.panel === ROOT.panel) return;
    window.history.replaceState({ lm: ROOT }, '', window.location.href);
    navRef.current = ROOT;
    setNav(ROOT);
  }, []);

  const openSettings = useCallback(() => push({ view: 'settings' }), [push]);
  const openChatPanel = useCallback(() => push({ view: 'chat', panel: 'chat' }), [push]);
  const closeSettings = useCallback(() => {
    if (window.history.state?.lm?.view === 'settings' && window.history.length > 1) window.history.back();
    else goRoot();
  }, [goRoot]);
  const closeChatPanel = useCallback(() => {
    if (window.history.state?.lm?.panel === 'chat' && window.history.length > 1) window.history.back();
    else goRoot();
  }, [goRoot]);

  return { nav, openSettings, closeSettings, openChatPanel, closeChatPanel, goRoot };
}
