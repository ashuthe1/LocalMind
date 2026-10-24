// src/components/settings/PersonaTab.jsx
import { useEffect, useState } from 'react';
import { TextField, Button } from '@mui/material';
import { api } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

const EMOJIS = ['✨', '🤖', '🧠', '🦙', '🐬', '🦊', '🐼', '🌙', '⚡', '🔮', '🛡️', '🌿', '🎓', '🧑‍🚀', '👩‍💻', '🧙'];

export default function PersonaTab() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const [assistant, setAssistant] = useState(settings.assistant);
  const [user, setUser] = useState({ username: '', aboutMe: '', preferences: '' });
  const [loadingUser, setLoadingUser] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => setAssistant(settings.assistant), [settings.assistant]);

  useEffect(() => {
    api
      .getUser()
      .then((u) => u && setUser({ username: u.username || '', aboutMe: u.aboutMe || '', preferences: u.preferences || '' }))
      .catch((err) => toast.error(`Could not load profile: ${err.message}`))
      .finally(() => setLoadingUser(false));
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      const ok = await update({ assistant: { name: assistant.name?.trim() || 'Assistant', avatar: assistant.avatar || '✨' } });
      await api.updateUser(user);
      if (ok) toast.success('Persona saved');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="settings-section">
        <h2>Assistant</h2>
        <div className="desc">How the assistant presents itself in the chat.</div>
        <TextField label="Assistant name" size="small" value={assistant.name || ''} onChange={(e) => setAssistant({ ...assistant, name: e.target.value })} fullWidth />
        <div>
          <div className="label" style={{ marginBottom: 8 }}>
            Avatar
          </div>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} className={`emoji-btn ${assistant.avatar === e ? 'selected' : ''}`} onClick={() => setAssistant({ ...assistant, avatar: e })} aria-label={`Use ${e} as avatar`}>
                {e}
              </button>
            ))}
            <TextField size="small" value={assistant.avatar || ''} onChange={(e) => setAssistant({ ...assistant, avatar: e.target.value.slice(0, 4) })} placeholder="custom" sx={{ width: 90 }} inputProps={{ 'aria-label': 'Custom avatar' }} />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>About you</h2>
        <div className="desc">Shared with the model as part of the system prompt (can be disabled under Model → Include my profile).</div>
        <TextField label="Your name" size="small" value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} disabled={loadingUser} fullWidth />
        <TextField label="About me" multiline minRows={4} value={user.aboutMe} onChange={(e) => setUser({ ...user, aboutMe: e.target.value })} disabled={loadingUser} placeholder="Who you are, what you work on, what you care about…" fullWidth />
        <TextField label="Preferences" multiline minRows={4} value={user.preferences} onChange={(e) => setUser({ ...user, preferences: e.target.value })} disabled={loadingUser} placeholder="How you like answers: tone, length, language, formatting…" fullWidth />
      </div>

      <div className="settings-row" style={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={save} disabled={saving || loadingUser} sx={{ textTransform: 'none', borderRadius: 2 }}>
          {saving ? 'Saving…' : 'Save persona'}
        </Button>
      </div>
    </>
  );
}
