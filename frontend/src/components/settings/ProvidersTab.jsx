// src/components/settings/ProvidersTab.jsx
import { useEffect, useState } from 'react';
import { Button, IconButton, Switch, Tooltip, Chip, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { Plus, Pencil, Trash2, Plug, Star, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import ProviderDialog from './ProviderDialog';

function ProviderCard({ provider, isActive, onEdit, onDelete, onToggle, onSetActive }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await api.testProvider(provider.id);
      setResult(r);
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`provider-card ${isActive ? 'active' : ''} ${provider.enabled === false ? 'disabled' : ''}`}>
      <div className="card-head">
        <span className="name" title={provider.name}>
          {provider.name}
        </span>
        {isActive && <Chip label="Active" size="small" color="primary" />}
        <Chip label={provider.type} size="small" variant="outlined" />
      </div>
      <div className="kv">
        <span>URL</span>
        <span>{provider.baseUrl || '(default)'}</span>
        <span>Model</span>
        <span>{provider.defaultModel || '—'}</span>
        <span>Key</span>
        <span>{provider.apiKeySet ? 'stored' : 'none'}</span>
      </div>
      {result && (
        <span className={`test-result ${result.ok ? 'ok' : 'fail'}`}>
          {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {result.ok ? `${result.message || 'Connected'}${result.latencyMs != null ? ` · ${result.latencyMs} ms` : ''}${result.modelCount ? ` · ${result.modelCount} models` : ''}` : result.error || result.message || 'Failed'}
        </span>
      )}
      <div className="card-actions">
        <Tooltip title={provider.enabled === false ? 'Enable' : 'Disable'}>
          <Switch size="small" checked={provider.enabled !== false} onChange={(e) => onToggle(provider, e.target.checked)} />
        </Tooltip>
        <Tooltip title="Test connection">
          <IconButton size="small" onClick={test} disabled={testing} aria-label="Test connection">
            {testing ? <CircularProgress size={16} /> : <Plug size={16} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(provider)} aria-label="Edit provider">
            <Pencil size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(provider)} aria-label="Delete provider">
            <Trash2 size={16} />
          </IconButton>
        </Tooltip>
        {!isActive && (
          <Button size="small" startIcon={<Star size={14} />} onClick={() => onSetActive(provider)} disabled={provider.enabled === false} sx={{ textTransform: 'none', ml: 'auto' }}>
            Set active
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProvidersTab({ onProvidersChanged }) {
  const { settings, providers, update, setProviders } = useSettings();
  const toast = useToast();
  const [catalog, setCatalog] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    api
      .getProviderCatalog()
      .then(setCatalog)
      .catch((err) => toast.error(`Could not load provider catalog: ${err.message}`));
  }, [toast]);

  const refreshProviders = async (extra) => {
    try {
      const list = await api.getProviders();
      setProviders(list, extra);
      onProvidersChanged?.();
    } catch (err) {
      toast.error(err);
    }
  };

  const handleSaved = async (saved, created) => {
    const extra = {};
    if (created && !settings.activeProviderId) {
      extra.activeProviderId = saved.id;
      extra.activeModel = saved.defaultModel || '';
    }
    await refreshProviders(extra);
    // The backend already activates the first provider; re-read settings so activeModel is accurate.
    try {
      const s = await api.getSettings();
      setProviders(s.providers || [], { activeProviderId: s.activeProviderId, activeModel: s.activeModel });
    } catch {
      /* non-fatal */
    }
  };

  const handleToggle = async (provider, enabled) => {
    try {
      await api.updateProvider(provider.id, { ...provider, apiKey: '', enabled });
      await refreshProviders();
    } catch (err) {
      toast.error(err);
    }
  };

  const handleSetActive = async (provider) => {
    const ok = await update({ activeProviderId: provider.id, activeModel: provider.defaultModel || '' });
    if (ok) {
      toast.success(`${provider.name} is now the active provider`);
      onProvidersChanged?.();
    }
  };

  const handleDelete = async (provider) => {
    try {
      await api.deleteProvider(provider.id);
      toast.success('Provider removed');
      const s = await api.getSettings();
      setProviders(s.providers || [], { activeProviderId: s.activeProviderId, activeModel: s.activeModel });
      onProvidersChanged?.();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-row">
        <div>
          <h2>LLM providers</h2>
          <div className="sub">Connect local servers (Ollama, LM Studio, llama.cpp, vLLM…) or cloud APIs. API keys never leave your machine except to the provider you configure.</div>
        </div>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Add provider
        </Button>
      </div>
      {providers.length === 0 ? (
        <div className="muted">No providers yet. Add one to start chatting.</div>
      ) : (
        <div className="settings-grid">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isActive={p.id === settings.activeProviderId}
              onEdit={(prov) => {
                setEditing(prov);
                setDialogOpen(true);
              }}
              onDelete={(prov) => setConfirmDelete(prov)}
              onToggle={handleToggle}
              onSetActive={handleSetActive}
            />
          ))}
        </div>
      )}
      <ProviderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={handleSaved} catalog={catalog} existing={editing} />
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Remove provider?</DialogTitle>
        <DialogContent>
          <DialogContentText>&ldquo;{confirmDelete?.name}&rdquo; and its stored API key will be removed. Existing chats are kept.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const p = confirmDelete;
              setConfirmDelete(null);
              handleDelete(p);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
