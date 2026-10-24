// src/components/SetupScreen.jsx — first-run: pick where the model runs, connect, start chatting
import { useState } from 'react';
import { Button } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { ChoiceGrid } from './settings/ProviderDialog';
import ProviderForm from './settings/ProviderForm';
import '../styles/settings.css';

export default function SetupScreen({ onDone }) {
  const toast = useToast();
  const { refresh } = useSettings();
  const [choice, setChoice] = useState(null);

  return (
    <div className="setup-page">
      <div className="setup-inner">
        <div className="setup-step">{choice ? 'Step 2 of 2' : 'Step 1 of 2'}</div>
        <h1>{choice ? `Connect ${choice.name}` : 'Set up LocalMind'}</h1>
        <p className="lead">{choice ? 'Check the connection, pick a model, and you are done.' : 'Where does your model run? You can add more providers later in Settings.'}</p>
        {choice ? (
          <ProviderForm
            key={choice.id}
            choice={choice}
            onError={(err) => toast.error(err)}
            onSubmit={async (saved) => {
              try {
                await api.updateSettings({ activeProviderId: saved.id, activeModel: saved.defaultModel || '' });
              } catch {
                /* the backend already activates the first provider */
              }
              await refresh();
              onDone?.();
            }}
            renderActions={({ submit, saving, canSubmit }) => (
              <div className="setup-actions">
                <button className="btn text" onClick={() => setChoice(null)}>
                  <ArrowLeft size={15} /> Back
                </button>
                <Button variant="contained" disableElevation onClick={submit} disabled={!canSubmit} sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}>
                  {saving ? 'Saving…' : 'Start chatting'}
                </Button>
              </div>
            )}
          />
        ) : (
          <ChoiceGrid onPick={setChoice} />
        )}
      </div>
    </div>
  );
}
