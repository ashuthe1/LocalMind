// src/components/settings/DataTab.jsx
import { useRef, useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress } from '@mui/material';
import { Download, Upload, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';

export default function DataTab({ onDataChanged }) {
  const toast = useToast();
  const { refresh } = useSettings();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const exportAll = async () => {
    setBusy('export');
    try {
      const name = await api.exportAll();
      toast.success(`Exported to ${name}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  const importFile = async (file) => {
    if (!file) return;
    setBusy('import');
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await api.importAll(payload);
      toast.success(`Imported ${result?.chatsImported ?? 0} chats`);
      await refresh();
      onDataChanged?.();
    } catch (err) {
      toast.error(err?.message?.includes('JSON') ? 'That file is not a valid LocalMind export' : err);
    } finally {
      setBusy('');
    }
  };

  const clearAll = async () => {
    setBusy('clear');
    try {
      await api.deleteAllChats();
      toast.success('All chats deleted');
      onDataChanged?.();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="settings-section">
        <h2>Backup &amp; restore</h2>
        <div className="desc">Exports include your chats, profile and settings. API keys are never exported.</div>
        <div className="settings-row" style={{ justifyContent: 'flex-start' }}>
          <Button variant="outlined" startIcon={busy === 'export' ? <CircularProgress size={14} /> : <Download size={16} />} onClick={exportAll} disabled={Boolean(busy)} sx={{ textTransform: 'none' }}>
            Export everything
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button variant="outlined" startIcon={busy === 'import' ? <CircularProgress size={14} /> : <Upload size={16} />} onClick={() => fileRef.current?.click()} disabled={Boolean(busy)} sx={{ textTransform: 'none' }}>
            Import from file
          </Button>
        </div>
      </div>
      <div className="settings-section">
        <h2>Danger zone</h2>
        <div className="settings-row">
          <div>
            <div className="label">Delete all chats</div>
            <div className="sub">Removes every conversation. Settings and providers are kept.</div>
          </div>
          <Button color="error" variant="outlined" startIcon={<Trash2 size={16} />} onClick={() => setConfirmClear(true)} disabled={Boolean(busy)} sx={{ textTransform: 'none' }}>
            Delete all chats
          </Button>
        </div>
      </div>
      <Dialog open={confirmClear} onClose={() => setConfirmClear(false)}>
        <DialogTitle>Delete all chats?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone. Consider exporting first.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmClear(false);
              clearAll();
            }}
          >
            Delete everything
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
