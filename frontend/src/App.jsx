// src/App.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, useMediaQuery, Drawer } from '@mui/material';
import { api } from './services/api';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { useBackendStatus } from './hooks/useBackendStatus';
import { useHistoryNav } from './hooks/useHistoryNav';
import { useChatStream } from './hooks/useChatStream';
import Navbar from './components/Navbar';
import ConnectionBanner from './components/ConnectionBanner';
import Sidebar from './components/Sidebar';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import Composer from './components/Composer';
import EmptyState from './components/EmptyState';
import SettingsPage from './components/settings/SettingsPage';
import SetupScreen from './components/SetupScreen';
import { DEFAULT_ACCENT } from './constants';
import './styles/App.css';
import './styles/chat.css';

const FONT_SCALE = { small: 0.92, medium: 1, large: 1.1 };

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '79, 109, 245';
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function summarize(chat) {
  const last = chat.messages?.[chat.messages.length - 1];
  return {
    id: chat.id,
    title: chat.title,
    pinned: chat.pinned,
    archived: chat.archived,
    providerId: chat.providerId,
    model: chat.model,
    messageCount: chat.messages?.length ?? chat.messageCount ?? 0,
    lastMessagePreview: last?.content?.slice(0, 80) || chat.lastMessagePreview || '',
    lastMessageAt: last?.timestamp || chat.lastMessageAt,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

function AppShell() {
  const toast = useToast();
  const { settings, appearance, loaded: settingsLoaded, refresh: refreshSettings, providers, enabledProviders, updateAppearance, update: updateSettings } = useSettings();
  const isMobile = useMediaQuery('(max-width:767px)');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const isDark = appearance.theme === 'system' ? prefersDark : appearance.theme === 'dark';

  const { nav, openSettings, closeSettings, openChatPanel, goRoot } = useHistoryNav();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [chats, setChats] = useState([]);
  const [query, setQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [connectionKey, setConnectionKey] = useState(0);

  const activeChatIdRef = useRef(null);
  activeChatIdRef.current = activeChatId;
  const composerRef = useRef(null);
  const searchRef = useRef(null);

  // ---------- data loading ----------
  const loadChats = useCallback(
    async (q = query) => {
      try {
        const list = await api.getChats(q);
        setChats(Array.isArray(list) ? list : []);
      } catch (err) {
        if (err.status !== 0) toast.error(err);
      }
    },
    [query, toast]
  );

  const loadChat = useCallback(
    async (id) => {
      if (!id) return;
      try {
        const chat = await api.getChat(id);
        setActiveChat(chat);
      } catch (err) {
        toast.error(err);
        if (err.status === 404) {
          setActiveChatId(null);
          setActiveChat(null);
          loadChats();
        }
      }
    },
    [toast, loadChats]
  );

  useEffect(() => {
    const t = setTimeout(() => loadChats(query), query ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onReconnect = useCallback(() => {
    toast.success('Reconnected to the LocalMind server');
    refreshSettings();
    loadChats();
    if (activeChatIdRef.current) loadChat(activeChatIdRef.current);
    setConnectionKey((k) => k + 1);
  }, [toast, refreshSettings, loadChats, loadChat]);

  const backend = useBackendStatus(onReconnect);

  // Re-test the provider connection whenever the provider list/active provider changes.
  const providersSignature = JSON.stringify([settings.activeProviderId, settings.activeModel, settings.providers?.map((p) => [p.id, p.baseUrl, p.enabled, p.apiKeySet])]);
  useEffect(() => setConnectionKey((k) => k + 1), [providersSignature]);

  // ---------- streaming ----------
  const updateActiveMessage = useCallback((messageId, updater) => {
    setActiveChat((chat) => {
      if (!chat) return chat;
      const idx = chat.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return chat;
      const messages = chat.messages.slice();
      messages[idx] = updater(messages[idx]);
      return { ...chat, messages };
    });
  }, []);

  const pendingIdsRef = useRef({ user: null, assistant: null });

  const stream = useChatStream({
    onMeta: (meta) => {
      const { user: tmpUser, assistant: tmpAssistant } = pendingIdsRef.current;
      setActiveChat((chat) => {
        if (!chat) return chat;
        const messages = chat.messages.map((m) => {
          if (tmpUser && m.id === tmpUser && meta.userMessageId) return { ...m, id: meta.userMessageId };
          if (tmpAssistant && m.id === tmpAssistant) return { ...m, id: meta.assistantMessageId, model: meta.model, providerId: meta.providerId, providerName: meta.providerName };
          return m;
        });
        return { ...chat, id: meta.chatId || chat.id, messages };
      });
      if (meta.chatId && meta.chatId !== activeChatIdRef.current) {
        setActiveChatId(meta.chatId);
        activeChatIdRef.current = meta.chatId;
      }
      pendingIdsRef.current = { user: null, assistant: null };
    },
    onReasoning: (text, state) => updateActiveMessage(state.assistantMessageId, (m) => ({ ...m, reasoning: (m.reasoning || '') + text })),
    onContent: (text, state) => updateActiveMessage(state.assistantMessageId, (m) => ({ ...m, content: (m.content || '') + text })),
    onError: (message, state) => {
      toast.error(message);
      if (state.assistantMessageId) updateActiveMessage(state.assistantMessageId, (m) => ({ ...m, stats: { ...(m.stats || {}), error: message } }));
    },
    onDone: (data, state) => {
      if (data?.message) updateActiveMessage(state.assistantMessageId, () => data.message);
      if (data?.chat) {
        setChats((list) => {
          const rest = list.filter((c) => c.id !== data.chat.id);
          return [data.chat, ...rest].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));
        });
        setActiveChat((chat) => (chat && chat.id === data.chat.id ? { ...chat, title: data.chat.title, updatedAt: data.chat.updatedAt } : chat));
      }
    },
    onTitle: ({ chatId, title }) => {
      setChats((list) => list.map((c) => (c.id === chatId ? { ...c, title } : c)));
      setActiveChat((chat) => (chat && chat.id === chatId ? { ...chat, title } : chat));
    },
    onFinish: (state) => {
      // Aborted or errored streams: re-sync the persisted chat (partial answers are saved server-side).
      if ((state.aborted || !state.gotDone) && state.chatId) {
        loadChat(state.chatId);
        loadChats();
      } else if (!state.chatId) {
        loadChats();
      }
    },
  });

  const hasProvider = enabledProviders.length > 0;
  const needsSetup = settingsLoaded && backend.online && providers.length === 0;

  const handleSend = useCallback(
    ({ content, images }) => {
      if (stream.isStreaming) return;
      if (!hasProvider) {
        toast.warning('Add an LLM provider in Settings first');
        return;
      }
      const now = new Date().toISOString();
      const tmpUser = tempId();
      const tmpAssistant = tempId();
      pendingIdsRef.current = { user: tmpUser, assistant: tmpAssistant };
      const userMsg = { id: tmpUser, role: 'user', content, images, timestamp: now };
      const assistantMsg = { id: tmpAssistant, role: 'assistant', content: '', reasoning: '', timestamp: now };
      setActiveChat((chat) =>
        chat && chat.id === activeChatIdRef.current && activeChatIdRef.current
          ? { ...chat, messages: [...chat.messages, userMsg, assistantMsg] }
          : { id: '', title: 'New chat', messages: [userMsg, assistantMsg], createdAt: now, updatedAt: now }
      );
      stream.send({ chatId: activeChatIdRef.current || '', content, images });
    },
    [stream, hasProvider, toast]
  );

  const handleRegenerate = useCallback(
    (message) => {
      if (stream.isStreaming || !activeChat?.id) return;
      const tmpAssistant = tempId();
      pendingIdsRef.current = { user: null, assistant: tmpAssistant };
      setActiveChat((chat) => {
        if (!chat) return chat;
        const idx = chat.messages.findIndex((m) => m.id === message.id);
        const kept = idx === -1 ? chat.messages : chat.messages.slice(0, idx);
        return { ...chat, messages: [...kept, { id: tmpAssistant, role: 'assistant', content: '', reasoning: '', timestamp: new Date().toISOString() }] };
      });
      stream.regenerate({ chatId: activeChat.id, messageId: message.id });
    },
    [stream, activeChat]
  );

  const handleEdit = useCallback(
    async (message, content) => {
      try {
        const chat = await api.editMessage(activeChat.id, message.id, content, false);
        setActiveChat(chat);
        setChats((list) => list.map((c) => (c.id === chat.id ? { ...c, ...summarize(chat) } : c)));
        toast.success('Message updated');
      } catch (err) {
        toast.error(err);
        throw err;
      }
    },
    [activeChat, toast]
  );

  const handleEditAndResend = useCallback(
    async (message, content) => {
      try {
        const chat = await api.editMessage(activeChat.id, message.id, content, true);
        const tmpAssistant = tempId();
        pendingIdsRef.current = { user: null, assistant: tmpAssistant };
        setActiveChat({ ...chat, messages: [...chat.messages, { id: tmpAssistant, role: 'assistant', content: '', reasoning: '', timestamp: new Date().toISOString() }] });
        stream.regenerate({ chatId: chat.id, messageId: '' });
      } catch (err) {
        toast.error(err);
        throw err;
      }
    },
    [activeChat, stream, toast]
  );

  const handleDeleteMessage = useCallback(
    async (message) => {
      try {
        const chat = await api.deleteMessage(activeChat.id, message.id, false);
        setActiveChat(chat);
        setChats((list) => list.map((c) => (c.id === chat.id ? { ...c, ...summarize(chat) } : c)));
      } catch (err) {
        toast.error(err);
      }
    },
    [activeChat, toast]
  );

  // ---------- chat list actions ----------
  const selectChat = useCallback(
    (chat) => {
      if (stream.isStreaming) stream.stop();
      setActiveChatId(chat.id);
      activeChatIdRef.current = chat.id;
      setActiveChat((prev) => (prev?.id === chat.id ? prev : { ...chat, messages: prev?.id === chat.id ? prev.messages : [] }));
      loadChat(chat.id);
      if (isMobile) {
        setDrawerOpen(false);
        openChatPanel();
      }
    },
    [stream, loadChat, isMobile, openChatPanel]
  );

  const newChat = useCallback(() => {
    if (stream.isStreaming) stream.stop();
    setActiveChatId(null);
    activeChatIdRef.current = null;
    setActiveChat(null);
    if (isMobile) {
      setDrawerOpen(false);
      openChatPanel();
    }
    if (nav.view !== 'chat') closeSettings();
    setTimeout(() => composerRef.current?.focus(), 50);
  }, [stream, isMobile, openChatPanel, nav.view, closeSettings]);

  const patchChat = useCallback(
    async (chat, patch, successMessage) => {
      try {
        const updated = await api.patchChat(chat.id, patch);
        setChats((list) =>
          list
            .map((c) => (c.id === chat.id ? { ...c, ...summarize(updated) } : c))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt))
        );
        setActiveChat((prev) => (prev && prev.id === chat.id ? { ...prev, ...updated, messages: updated.messages?.length ? updated.messages : prev.messages } : prev));
        if (successMessage) toast.success(successMessage);
      } catch (err) {
        toast.error(err);
      }
    },
    [toast]
  );

  const deleteChat = useCallback(
    async (chat) => {
      try {
        await api.deleteChat(chat.id);
        setChats((list) => list.filter((c) => c.id !== chat.id));
        if (activeChatIdRef.current === chat.id) {
          setActiveChatId(null);
          activeChatIdRef.current = null;
          setActiveChat(null);
        }
        toast.success('Chat deleted');
      } catch (err) {
        toast.error(err);
      }
    },
    [toast]
  );

  const deleteAllChats = useCallback(async () => {
    try {
      await api.deleteAllChats();
      setChats([]);
      setActiveChatId(null);
      activeChatIdRef.current = null;
      setActiveChat(null);
      toast.success('History cleared');
    } catch (err) {
      toast.error(err);
    }
  }, [toast]);

  const exportChat = useCallback(
    async (chat, format) => {
      try {
        const name = await api.exportChat(chat.id, format);
        toast.success(`Exported ${name}`);
      } catch (err) {
        toast.error(err);
      }
    },
    [toast]
  );

  // ---------- provider / model for the header ----------
  const headerProviderId = activeChat?.providerId || settings.activeProviderId || '';
  const headerModel = activeChat?.providerId ? activeChat.model || '' : activeChat?.model || settings.activeModel || '';

  const handleChangeModel = useCallback(
    ({ providerId, model }) => {
      if (activeChat?.id) patchChat(activeChat, { providerId, model }, 'Model updated for this chat');
      else updateSettings({ activeProviderId: providerId, activeModel: model });
    },
    [activeChat, patchChat, updateSettings]
  );

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (nav.view !== 'chat') closeSettings();
        if (isMobile) setDrawerOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        newChat();
      } else if (e.key === 'Escape' && stream.isStreaming) {
        stream.stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav.view, closeSettings, isMobile, newChat, stream]);

  // Mobile back: when history pops to the list panel, show the drawer again.
  useEffect(() => {
    if (isMobile && nav.view === 'chat' && nav.panel === 'list' && activeChatId) setDrawerOpen(true);
    if (!isMobile) setDrawerOpen(false);
  }, [nav, isMobile, activeChatId]);

  // ---------- theme ----------
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary: { main: appearance.accent || DEFAULT_ACCENT },
          secondary: { main: '#475569' },
          background: { default: isDark ? '#111113' : '#ffffff', paper: isDark ? '#19191c' : '#ffffff' },
          divider: isDark ? '#2a2a2e' : '#e5e5e7',
          text: { primary: isDark ? '#ececf1' : '#1d1d1f', secondary: isDark ? '#9a9aa3' : '#6e6e73' },
        },
        shape: { borderRadius: 10 },
        typography: { fontFamily: 'inherit', fontSize: 14 },
        components: {
          MuiButton: { defaultProps: { disableElevation: true } },
          MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
          MuiTooltip: { defaultProps: { arrow: false, enterDelay: 400 } },
        },
      }),
    [isDark, appearance.accent]
  );

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#111113' : '#ffffff');
  }, [isDark, appearance.accent]);

  // Theme tokens live on <html> so MUI portals (drawer, menus, dialogs) pick them up too.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = isDark ? 'dark' : 'light';
    root.style.setProperty('--primary-color', appearance.accent || DEFAULT_ACCENT);
    root.style.setProperty('--primary-rgb', hexToRgb(appearance.accent));
    root.style.setProperty('--font-scale', String(FONT_SCALE[appearance.fontSize] || 1));
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark, appearance.accent, appearance.fontSize]);

  const toggleTheme = () => updateAppearance({ theme: isDark ? 'light' : 'dark' });

  const sidebar = (
    <Sidebar
      ref={searchRef}
      chats={chats}
      selectedChatId={activeChatId}
      query={query}
      onQueryChange={setQuery}
      onSelectChat={selectChat}
      onNewChat={newChat}
      onRenameChat={(chat, title) => patchChat(chat, { title })}
      onTogglePin={(chat) => patchChat(chat, { pinned: !chat.pinned })}
      onExportChat={exportChat}
      onDeleteChat={deleteChat}
      onDeleteAll={deleteAllChats}
      isDrawer={isMobile}
      onClose={() => setDrawerOpen(false)}
      footer={`${chats.length} chat${chats.length === 1 ? '' : 's'}`}
    />
  );

  const messages = activeChat?.messages || [];
  const showEmpty = messages.length === 0;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className={`app ${isDark ? 'dark' : 'light'}`}>
        <ConnectionBanner online={backend.online} checking={backend.checking} retryIn={backend.retryIn} onRetry={backend.retry} />
        <Navbar
          view={nav.view}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onOpenChat={() => (nav.view === 'settings' ? closeSettings() : goRoot())}
          onOpenSettings={() => nav.view !== 'settings' && openSettings()}
          onOpenDrawer={() => setDrawerOpen(true)}
          showDrawerButton={isMobile && nav.view === 'chat'}
        />
        {needsSetup ? (
          <SetupScreen
            onDone={() => {
              setConnectionKey((k) => k + 1);
              goRoot();
            }}
          />
        ) : nav.view === 'settings' ? (
          <SettingsPage
            onBack={closeSettings}
            health={backend.health}
            onProvidersChanged={() => setConnectionKey((k) => k + 1)}
            onDataChanged={() => {
              loadChats();
              if (activeChatIdRef.current) loadChat(activeChatIdRef.current);
            }}
          />
        ) : (
          <div className="main-container">
            {isMobile ? (
              <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} ModalProps={{ keepMounted: true }}>
                {sidebar}
              </Drawer>
            ) : (
              sidebar
            )}
            <div className="chat-container">
              <ChatHeader
                chat={activeChat?.id ? activeChat : null}
                providers={enabledProviders}
                providerId={headerProviderId}
                model={headerModel}
                onChangeModel={handleChangeModel}
                onBack={() => setDrawerOpen(true)}
                showBack={isMobile}
                streaming={stream.isStreaming}
                connectionKey={connectionKey}
              />
              {showEmpty ? (
                <EmptyState assistant={settings.assistant} activeModel={headerModel || enabledProviders.find((p) => p.id === headerProviderId)?.defaultModel} onPick={(text) => composerRef.current?.setText(text)} />
              ) : (
                <MessageList
                  messages={messages}
                  streaming={stream.streaming}
                  assistant={settings.assistant}
                  appearance={appearance}
                  isDark={isDark}
                  onEdit={handleEdit}
                  onEditAndResend={handleEditAndResend}
                  onRegenerate={handleRegenerate}
                  onDelete={handleDeleteMessage}
                />
              )}
              <Composer
                ref={composerRef}
                onSend={handleSend}
                onStop={stream.stop}
                streaming={stream.isStreaming}
                disabled={!hasProvider}
                disabledReason={!hasProvider ? 'No LLM provider configured yet.' : ''}
                onOpenSettings={openSettings}
                sendOnEnter={appearance.sendOnEnter !== false}
                assistantName={settings.assistant?.name}
              />
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

function SettingsErrorBridge({ children }) {
  const toast = useToast();
  const onError = useCallback(
    (err) => {
      if (err?.status !== 0) toast.error(err);
    },
    [toast]
  );
  return <SettingsProvider onError={onError}>{children}</SettingsProvider>;
}

export default function App() {
  return (
    <ToastProvider>
      <SettingsErrorBridge>
        <AppShell />
      </SettingsErrorBridge>
    </ToastProvider>
  );
}
