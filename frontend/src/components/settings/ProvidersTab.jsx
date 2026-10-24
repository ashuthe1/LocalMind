// src/components/settings/ProvidersTab.jsx
import { useEffect, useState } from 'react';
import { Switch, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { api } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import ProviderDialog from './ProviderDialog';

function ProviderRow({ provider, isActive, onEdit, onDelete, onToggle, onSetActive }) {
  const [status, setStatus] = useState({ state: 'checking', text: 'Checking…' });

  useEffect(() => {
    let cancelled = false;
    setStatus({ state: 'checking', text: 'Checking…' });
    api
      .testProvider(provider.id)
      .then((r) => !cancelled && setStatus(r?.ok ? { state: 'ok', text: r.message || 'Connected' } : { state: 'fail', text: r?.error || 'Unreachable' }))
      .catch((err) => !cancelled && setStatus({ state: 'fail', text: err.message }));
    return () => {
      cancelled = true;
    };
  }, [provider.id, provider.baseUrl, provider.apiKeySet, provider.enabled]);

  return (
    <div className={`provider-row ${provider.enabled === false ? 'disabled' : ''}`}>
      <Tooltip title={status.text}>
        <span className={`status-dot ${status.state}`} />
      </Tooltip>
      <div className="info">
        <div className="name-line">
          <span className="name">{provider.name}</span>
          <span className={`type-chip ${isActive ? 'active' : ''}`}>{isActive ? 'default' : provider.type}</span>
        </div>
        <div className="detail">
          {provider.baseUrl}
          {provider.defaultModel ? ` · ${provider.defaultModel}` : ''}
        </div>
      </div>
      <div className="row-actions">
        {!isActive && provider.enabled !== false && (
          <Tooltip title="Use by default">
            <button className="icon-btn" onClick={() => onSetActive(provider)} aria-label="Use by default">
              <Star size={16} />
            </button>
          </Tooltip>
        )}
        <Tooltip title="Edit">
          <button className="icon-btn" onClick={() => onEdit(provider)} aria-label="Edit provider">
            <Pencil size={16} />
          </button>
        </Tooltip>
        <Tooltip title="Remove">
          <button className="icon-btn" onClick={() => onDelete(provider)} aria-label="Remove provider">
            <Trash2 size={16} />
          </button>
        </Tooltip>
        <Tooltip title={provider.enabled === false ? 'Enable' : 'Disable'}>
          <Switch size="small" checked={provider.enabled !== false} onChange={(e) => onToggle(provider, e.target.checked)} />
        </Tooltip>
      </div>
    </div>
  );
}

export default function ProvidersTab({ onProvidersChanged }) {
  const { settings, providers, update, setProviders } = useSettings();
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const reload = async () => {
    try {
      const s = await api.getSettings();
      setProviders(s.providers || [], { activeProviderId: s.activeProviderId, activeModel: s.activeModel });
      onProvidersChanged?.();
    } catch (err) {
      toast.error(err);
    }
  };

  const handleToggle = async (provider, enabled) => {
    try {
      await api.updateProvider(provider.id, { ...provider, apiKey: '', enabled });
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  const handleSetActive = async (provider) => {
    const ok = await update({ activeProviderId: provider.id, activeModel: provider.defaultModel || '' });
    if (ok) onProvidersChanged?.();
  };

  const handleDelete = async (provider) => {
    try {
      await api.deleteProvider(provider.id);
      await reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-row">
        <div>
          <h2>Providers</h2>
          <div className="sub">Local servers or cloud APIs. Keys are only ever sent to the provider you configured.</div>
        </div>
        <button
          className="btn"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus size={15} /> Add
        </button>
      </div>
      {providers.length === 0 ? (
        <div className="field-hint">No providers yet.</div>
      ) : (
        <div className="provider-list">
          {providers.map((p) => (
            <ProviderRow
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
      <ProviderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={reload} existing={editing} />
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Remove provider?</DialogTitle>
        <DialogContent>
          <DialogContentText>&ldquo;{confirmDelete?.name}&rdquo; and its stored API key will be removed. Chats are kept.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disableElevation
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
