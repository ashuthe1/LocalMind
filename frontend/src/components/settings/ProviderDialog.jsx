// src/components/settings/ProviderDialog.jsx — add / edit a provider
import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Button } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { PROVIDER_CHOICES } from '../../constants';
import { useToast } from '../../context/ToastContext';
import ProviderForm from './ProviderForm';

export function ChoiceGrid({ selected, onPick }) {
  return (
    <div className="choice-grid">
      {PROVIDER_CHOICES.map((c) => (
        <button key={c.id} type="button" className={`choice ${selected === c.id ? 'selected' : ''}`} onClick={() => onPick(c)}>
          <span className="choice-name">{c.name}</span>
          <span className="choice-sub">{c.sub}</span>
        </button>
      ))}
    </div>
  );
}

export default function ProviderDialog({ open, onClose, onSaved, existing }) {
  const toast = useToast();
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    if (open) setChoice(null);
  }, [open]);

  const showForm = Boolean(existing || choice);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper" PaperProps={{ sx: { borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1.05rem', fontWeight: 600 }}>
        {showForm && !existing && (
          <button className="icon-btn" onClick={() => setChoice(null)} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        )}
        {existing ? `Edit ${existing.name}` : choice ? `Connect ${choice.name}` : 'Where does your model run?'}
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        {showForm ? (
          <div style={{ paddingTop: 6 }}>
            <ProviderForm
              key={existing?.id || choice?.id}
              choice={choice}
              existing={existing}
              onError={(err) => toast.error(err)}
              onSubmit={async (saved, created) => {
                toast.success(created ? 'Provider added' : 'Provider updated');
                await onSaved?.(saved, created);
                onClose();
              }}
              renderActions={({ submit, saving, canSubmit }) => (
                <div className="settings-row" style={{ justifyContent: 'flex-end', paddingTop: 4 }}>
                  <Button onClick={onClose} sx={{ textTransform: 'none' }}>
                    Cancel
                  </Button>
                  <Button variant="contained" disableElevation onClick={submit} disabled={!canSubmit} sx={{ textTransform: 'none', borderRadius: 2 }}>
                    {saving ? 'Saving…' : existing ? 'Save' : 'Add provider'}
                  </Button>
                </div>
              )}
            />
          </div>
        ) : (
          <ChoiceGrid onPick={setChoice} />
        )}
      </DialogContent>
    </Dialog>
  );
}
