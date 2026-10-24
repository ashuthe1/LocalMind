// src/components/ChatHeader.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Popover, Select, MenuItem, FormControl, InputLabel, Autocomplete, TextField, Chip, Tooltip, IconButton, CircularProgress } from '@mui/material';
import { ChevronDown, Settings, Cpu, ArrowLeft, Download } from 'lucide-react';
import { api } from '../services/api';
import { useProviderModels } from '../hooks/useProviderModels';
import { useToast } from '../context/ToastContext';

function ModelPicker({ providers, providerId, model, onChange, disabled }) {
  const [anchor, setAnchor] = useState(null);
  const [draftProvider, setDraftProvider] = useState(providerId);
  const { models, loading } = useProviderModels(anchor ? draftProvider : null, providers);
  const provider = providers.find((p) => p.id === providerId);

  useEffect(() => setDraftProvider(providerId), [providerId]);

  const label = provider ? `${provider.name}${model ? ` · ${model}` : provider.defaultModel ? ` · ${provider.defaultModel}` : ''}` : 'Choose a provider';
  const draftProviderObj = providers.find((p) => p.id === draftProvider);
  const currentModel = draftProvider === providerId ? model || provider?.defaultModel || '' : draftProviderObj?.defaultModel || '';

  return (
    <>
      <button className="model-picker-btn" onClick={(e) => setAnchor(e.currentTarget)} disabled={disabled} title={label}>
        <Cpu size={15} />
        <span className="picker-text">{label}</span>
        <ChevronDown size={14} />
      </button>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <div className="model-picker-popover">
          <FormControl size="small" fullWidth>
            <InputLabel id="provider-select">Provider</InputLabel>
            <Select
              labelId="provider-select"
              label="Provider"
              value={draftProvider || ''}
              onChange={(e) => {
                const id = e.target.value;
                setDraftProvider(id);
                const p = providers.find((x) => x.id === id);
                onChange({ providerId: id, model: p?.defaultModel || '' });
              }}
            >
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} <span className="muted" style={{ marginLeft: 6, fontSize: '0.8em' }}>({p.type})</span>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Autocomplete
            size="small"
            freeSolo
            options={models}
            loading={loading}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o.id)}
            renderOption={(props, o) => {
              const { key, ...rest } = props;
              return (
                <li key={key} {...rest}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.id}</span>
                  {o.vision && <Chip label="vision" size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />}
                  {o.loaded && <Chip label="loaded" size="small" color="success" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />}
                </li>
              );
            }}
            value={currentModel}
            onChange={(_, v) => {
              const id = typeof v === 'string' ? v : v?.id || '';
              onChange({ providerId: draftProvider, model: id });
            }}
            onInputChange={(_, v, reason) => {
              if (reason === 'input' && v && !models.some((m) => m.id === v)) {
                // allow typing a custom model id; committed on blur/enter via onChange(freeSolo)
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Model"
                placeholder="Type or pick a model"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== currentModel) onChange({ providerId: draftProvider, model: v });
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress size={14} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <div className="muted" style={{ fontSize: '0.75rem' }}>
            {models.length ? `${models.length} models available` : loading ? 'Loading models…' : 'No model list — type a model id'}
          </div>
        </div>
      </Popover>
    </>
  );
}

export default function ChatHeader({
  chat,
  providers,
  providerId,
  model,
  onChangeModel,
  onOpenSettings,
  onBack,
  showBack,
  onExport,
  streaming,
  connectionKey,
}) {
  const toast = useToast();
  const [conn, setConn] = useState({ state: 'idle', message: '' });
  const abortRef = useRef(null);

  const test = useCallback(async () => {
    if (!providerId) {
      setConn({ state: 'none', message: 'No provider selected' });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setConn({ state: 'checking', message: 'Checking connection…' });
    try {
      const r = await api.testProvider(providerId, controller.signal);
      if (controller.signal.aborted) return;
      if (r?.ok) setConn({ state: 'ok', message: `${r.message || 'Connected'}${r.latencyMs != null ? ` · ${r.latencyMs} ms` : ''}${r.modelCount ? ` · ${r.modelCount} models` : ''}` });
      else setConn({ state: 'error', message: r?.error || r?.message || 'Provider unreachable' });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setConn({ state: 'error', message: err.message || 'Provider unreachable' });
    }
  }, [providerId]);

  useEffect(() => {
    test();
    return () => abortRef.current?.abort();
  }, [test, connectionKey]);

  const chipColor = conn.state === 'ok' ? 'success' : conn.state === 'error' ? 'error' : 'default';
  const chipLabel = conn.state === 'ok' ? 'Connected' : conn.state === 'error' ? 'Unreachable' : conn.state === 'none' ? 'No provider' : 'Checking…';

  return (
    <header className="chat-header">
      {showBack && (
        <IconButton size="small" onClick={onBack} aria-label="Back to chats">
          <ArrowLeft size={20} />
        </IconButton>
      )}
      <div className="title">
        {chat?.title || 'New chat'}
        {chat && <span className="subtitle">{chat.messages?.length || 0} messages</span>}
      </div>
      <ModelPicker providers={providers} providerId={providerId} model={model} onChange={onChangeModel} disabled={streaming} />
      <Tooltip title={conn.message || 'Click to re-test'}>
        <Chip
          size="small"
          color={chipColor}
          variant={conn.state === 'ok' ? 'filled' : 'outlined'}
          label={chipLabel}
          onClick={() => {
            test();
            if (conn.state === 'error') toast.info('Re-testing provider connection…');
          }}
          icon={conn.state === 'checking' ? <CircularProgress size={12} color="inherit" /> : undefined}
          sx={{ cursor: 'pointer' }}
        />
      </Tooltip>
      {chat && (
        <Tooltip title="Export as Markdown">
          <IconButton size="small" onClick={() => onExport?.(chat, 'markdown')} aria-label="Export chat">
            <Download size={18} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Settings">
        <IconButton size="small" onClick={onOpenSettings} aria-label="Open settings">
          <Settings size={18} />
        </IconButton>
      </Tooltip>
    </header>
  );
}
