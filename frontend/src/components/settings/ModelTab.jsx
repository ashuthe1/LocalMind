// src/components/settings/ModelTab.jsx
import { useEffect, useState } from 'react';
import { Slider, Switch, TextField, Select, MenuItem, FormControl, InputLabel, Button, FormControlLabel } from '@mui/material';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

function ParamRow({ label, sub, value, onChange, min, max, step, defaultValue, integer }) {
  const enabled = value !== null && value !== undefined;
  return (
    <div className="settings-row" style={{ alignItems: 'flex-start' }}>
      <div style={{ minWidth: 180 }}>
        <div className="label">{label}</div>
        <div className="sub">{sub}</div>
      </div>
      <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 12 }}>
        <FormControlLabel
          sx={{ mr: 0 }}
          control={<Switch size="small" checked={enabled} onChange={(e) => onChange(e.target.checked ? defaultValue : null)} />}
          label={<span className="sub">{enabled ? 'custom' : 'provider default'}</span>}
        />
        <Slider size="small" disabled={!enabled} value={enabled ? value : defaultValue} min={min} max={max} step={step} onChange={(_, v) => onChange(v)} sx={{ flex: 1, minWidth: 100 }} />
        <TextField
          size="small"
          type="number"
          disabled={!enabled}
          value={enabled ? value : ''}
          placeholder="default"
          inputProps={{ min, max, step }}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(null);
            const n = integer ? parseInt(raw, 10) : parseFloat(raw);
            if (!isNaN(n)) onChange(n);
          }}
          sx={{ width: 110 }}
        />
      </div>
    </div>
  );
}

export default function ModelTab() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const [gen, setGen] = useState(settings.generation);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');
  const [features, setFeatures] = useState(settings.features);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setGen(settings.generation);
      setSystemPrompt(settings.systemPrompt || '');
      setFeatures(settings.features);
    }
  }, [settings, dirty]);

  const setG = (patch) => {
    setGen((g) => ({ ...g, ...patch }));
    setDirty(true);
  };
  const setF = (patch) => {
    setFeatures((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const ok = await update({ generation: gen, systemPrompt, features });
    setSaving(false);
    if (ok) {
      setDirty(false);
      toast.success('Model settings saved');
    }
  };

  return (
    <>
      <div className="settings-section">
        <h2>Generation parameters</h2>
        <div className="desc">Leave a parameter on &ldquo;provider default&rdquo; to let the model/server decide. Applies to every provider.</div>
        <ParamRow label="Temperature" sub="Higher = more creative" value={gen.temperature} onChange={(v) => setG({ temperature: v })} min={0} max={2} step={0.05} defaultValue={0.7} />
        <ParamRow label="Top P" sub="Nucleus sampling" value={gen.topP} onChange={(v) => setG({ topP: v })} min={0} max={1} step={0.01} defaultValue={0.9} />
        <ParamRow label="Max tokens" sub="Longest reply allowed" value={gen.maxTokens} onChange={(v) => setG({ maxTokens: v })} min={16} max={32768} step={16} defaultValue={2048} integer />
        <ParamRow label="Context length" sub="Tokens the model may read (local servers)" value={gen.contextLength} onChange={(v) => setG({ contextLength: v })} min={512} max={262144} step={512} defaultValue={8192} integer />
        <div className="settings-row">
          <div>
            <div className="label">Reasoning effort</div>
            <div className="sub">For thinking models (DeepSeek-R1, Qwen3, gpt-oss, Claude, Gemini…)</div>
          </div>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="reasoning-label">Reasoning</InputLabel>
            <Select labelId="reasoning-label" label="Reasoning" value={gen.reasoning || 'auto'} onChange={(e) => setG({ reasoning: e.target.value })}>
              {['auto', 'off', 'low', 'medium', 'high', 'on'].map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Seed</div>
            <div className="sub">Fixed seed for reproducible output (if supported)</div>
          </div>
          <TextField
            size="small"
            type="number"
            value={gen.seed ?? ''}
            placeholder="random"
            onChange={(e) => setG({ seed: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            sx={{ width: 160 }}
          />
        </div>
        <TextField
          label="Stop sequences (comma separated)"
          size="small"
          value={(gen.stopSequences || []).join(', ')}
          onChange={(e) =>
            setG({
              stopSequences: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          fullWidth
        />
      </div>

      <div className="settings-section">
        <h2>System prompt</h2>
        <div className="desc">Sent at the start of every conversation. Individual chats can override it later.</div>
        <TextField
          multiline
          minRows={4}
          value={systemPrompt}
          onChange={(e) => {
            setSystemPrompt(e.target.value);
            setDirty(true);
          }}
          placeholder="You are a helpful, concise assistant…"
          fullWidth
        />
      </div>

      <div className="settings-section">
        <h2>Conversation</h2>
        <div className="settings-row">
          <div>
            <div className="label">Auto-generate chat titles</div>
            <div className="sub">Ask the model for a short title after the first reply</div>
          </div>
          <Switch checked={features.autoTitle !== false} onChange={(e) => setF({ autoTitle: e.target.checked })} />
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Include my profile</div>
            <div className="sub">Add &ldquo;About me&rdquo; and &ldquo;Preferences&rdquo; to the system prompt</div>
          </div>
          <Switch checked={features.sendUserProfile !== false} onChange={(e) => setF({ sendUserProfile: e.target.checked })} />
        </div>
        <div className="settings-row">
          <div>
            <div className="label">History limit</div>
            <div className="sub">Max previous messages sent to the model (0 = all)</div>
          </div>
          <TextField size="small" type="number" value={features.historyLimit ?? 40} inputProps={{ min: 0, max: 1000 }} onChange={(e) => setF({ historyLimit: Math.max(0, parseInt(e.target.value || '0', 10)) })} sx={{ width: 120 }} />
        </div>
      </div>

      <div className="settings-row" style={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={save} disabled={!dirty || saving} sx={{ textTransform: 'none', borderRadius: 2 }}>
          {saving ? 'Saving…' : 'Save model settings'}
        </Button>
      </div>
    </>
  );
}
