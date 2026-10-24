// src/components/settings/ModelTab.jsx — plain-language model settings
import { useEffect, useState } from 'react';
import { Slider, Switch, TextField, Select, MenuItem, FormControl, Button } from '@mui/material';
import { ChevronDown } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

function Param({ label, hint, children }) {
  return (
    <div className="param-row">
      <div>
        <div className="label">{label}</div>
        <div className="field-hint">{hint}</div>
      </div>
      <div className="control">{children}</div>
    </div>
  );
}

function SliderParam({ label, hint, value, onChange, min, max, step, fallback, integer }) {
  const custom = value !== null && value !== undefined;
  return (
    <Param label={label} hint={hint}>
      <Switch size="small" checked={custom} onChange={(e) => onChange(e.target.checked ? fallback : null)} inputProps={{ 'aria-label': `Customize ${label}` }} />
      <span className="field-hint" style={{ minWidth: 92 }}>
        {custom ? 'Custom' : 'Model default'}
      </span>
      <Slider size="small" disabled={!custom} value={custom ? value : fallback} min={min} max={max} step={step} onChange={(_, v) => onChange(v)} sx={{ flex: 1, minWidth: 120 }} />
      <TextField
        size="small"
        type="number"
        disabled={!custom}
        value={custom ? value : ''}
        placeholder="default"
        inputProps={{ min, max, step, 'aria-label': label }}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = integer ? parseInt(raw, 10) : parseFloat(raw);
          if (!isNaN(n)) onChange(n);
        }}
        sx={{ width: 104 }}
      />
    </Param>
  );
}

const REASONING = [
  { v: 'auto', label: 'Auto' },
  { v: 'off', label: 'Off' },
  { v: 'low', label: 'Low' },
  { v: 'medium', label: 'Medium' },
  { v: 'high', label: 'High' },
];

export default function ModelTab() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const [gen, setGen] = useState(settings.generation);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '');
  const [features, setFeatures] = useState(settings.features);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);

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
      toast.success('Saved');
    }
  };

  return (
    <>
      <div className="settings-section">
        <h2>How the model answers</h2>
        <div className="desc">These apply to every provider. &ldquo;Model default&rdquo; lets the model or server decide.</div>
        <SliderParam label="Creativity" hint="Lower = focused and predictable, higher = more varied. (This is the model's temperature.)" value={gen.temperature} onChange={(v) => setG({ temperature: v })} min={0} max={2} step={0.05} fallback={0.7} />
        <SliderParam label="Max reply length" hint="The longest answer allowed, in tokens (roughly ¾ of a word each). Leave default unless replies get cut off." value={gen.maxTokens} onChange={(v) => setG({ maxTokens: v })} min={64} max={32768} step={64} fallback={2048} integer />
        <Param label="Reasoning effort" hint="For thinking models like DeepSeek-R1, Qwen3, gpt-oss, Claude, Gemini. Auto lets the model decide.">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select value={gen.reasoning === 'on' ? 'high' : gen.reasoning || 'auto'} onChange={(e) => setG({ reasoning: e.target.value })} inputProps={{ 'aria-label': 'Reasoning effort' }}>
              {REASONING.map((r) => (
                <MenuItem key={r.v} value={r.v}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Param>
        <div className="field">
          <div className="label">Instructions</div>
          <div className="field-hint">Sent at the start of every conversation to shape tone and behaviour (the &ldquo;system prompt&rdquo;).</div>
          <TextField
            multiline
            minRows={3}
            value={systemPrompt}
            onChange={(e) => {
              setSystemPrompt(e.target.value);
              setDirty(true);
            }}
            placeholder="You are a helpful, concise assistant…"
            fullWidth
          />
        </div>
      </div>

      <div className="settings-section">
        <h2>Conversation</h2>
        <Param label="Memory window" hint="How many earlier messages are sent along with each new one. 0 = all of them (slower and costlier on long chats).">
          <TextField size="small" type="number" value={features.historyLimit ?? 40} inputProps={{ min: 0, max: 1000, 'aria-label': 'Memory window' }} onChange={(e) => setF({ historyLimit: Math.max(0, parseInt(e.target.value || '0', 10)) })} sx={{ width: 110 }} />
          <span className="field-hint">messages</span>
        </Param>
        <Param label="Auto-generate titles" hint="Ask the model for a short chat title after the first reply.">
          <Switch checked={features.autoTitle !== false} onChange={(e) => setF({ autoTitle: e.target.checked })} />
        </Param>
        <Param label="Include my profile" hint="Share your name, About me and Preferences (from Persona) with the model.">
          <Switch checked={features.sendUserProfile !== false} onChange={(e) => setF({ sendUserProfile: e.target.checked })} />
        </Param>
      </div>

      <div className="settings-section">
        <button type="button" className="advanced-toggle" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
          Advanced <ChevronDown size={14} className={`chev ${advanced ? 'open' : ''}`} />
        </button>
        {advanced && (
          <>
            <SliderParam label="Top P" hint="Another way to control variety: only the most likely words adding up to this probability are considered. Usually leave default." value={gen.topP} onChange={(v) => setG({ topP: v })} min={0} max={1} step={0.01} fallback={0.9} />
            <SliderParam label="Context length" hint="How much text the model can read at once, in tokens. Local servers only; bigger uses more memory." value={gen.contextLength} onChange={(v) => setG({ contextLength: v })} min={512} max={262144} step={512} fallback={8192} integer />
            <Param label="Seed" hint="A fixed number makes answers repeatable, when the model supports it. Blank = random.">
              <TextField size="small" type="number" value={gen.seed ?? ''} placeholder="random" inputProps={{ 'aria-label': 'Seed' }} onChange={(e) => setG({ seed: e.target.value === '' ? null : parseInt(e.target.value, 10) })} sx={{ width: 140 }} />
            </Param>
            <Param label="Stop sequences" hint="The model stops when it produces any of these. Comma separated.">
              <TextField
                size="small"
                value={(gen.stopSequences || []).join(', ')}
                inputProps={{ 'aria-label': 'Stop sequences' }}
                onChange={(e) =>
                  setG({
                    stopSequences: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Param>
          </>
        )}
      </div>

      <div className="save-row">
        <Button variant="contained" disableElevation onClick={save} disabled={!dirty || saving} sx={{ textTransform: 'none', borderRadius: 2 }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </>
  );
}
