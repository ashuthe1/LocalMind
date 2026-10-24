// src/components/settings/ProviderDialog.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  CircularProgress,
  InputAdornment,
  Chip,
  Alert,
} from '@mui/material';
import { Plus, Trash2, Eye, EyeOff, ArrowLeft, CheckCircle2, XCircle, Plug } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const emptyForm = {
  type: 'openai',
  name: '',
  baseUrl: '',
  apiKey: '',
  clearApiKey: false,
  defaultModel: '',
  models: [],
  enabled: true,
  headers: {},
  options: {},
};

function PresetPicker({ catalog, onPick }) {
  const presets = catalog?.presets || [];
  const local = presets.filter((p) => p.local);
  const cloud = presets.filter((p) => !p.local);
  const Group = ({ title, items }) =>
    items.length ? (
      <div className="preset-group">
        <h3>{title}</h3>
        <div className="preset-grid">
          {items.map((p) => (
            <button key={p.id} className="preset-card" onClick={() => onPick(p)}>
              <span className="preset-name">{p.name}</span>
              <span className="preset-type">
                {p.type}
                {p.needsApiKey ? ' · API key' : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    ) : null;
  return (
    <>
      <Group title="Local (runs on your machine)" items={local} />
      <Group title="Cloud" items={cloud} />
      {presets.length === 0 && <div className="muted">Could not load presets. You can still add a custom provider.</div>}
      <div className="preset-group">
        <h3>Custom</h3>
        <div className="preset-grid">
          {(catalog?.types || [{ type: 'openai', label: 'OpenAI-compatible' }]).map((t) => (
            <button key={t.type} className="preset-card" onClick={() => onPick({ id: `custom-${t.type}`, name: t.label, type: t.type, baseUrl: '', needsApiKey: t.needsApiKey })}>
              <span className="preset-name">{t.label}</span>
              <span className="preset-type">custom {t.type}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function ProviderDialog({ open, onClose, onSaved, catalog, existing }) {
  const toast = useToast();
  const [step, setStep] = useState(existing ? 'form' : 'preset');
  const [form, setForm] = useState(emptyForm);
  const [preset, setPreset] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [headerRows, setHeaderRows] = useState([]);
  const [modelsText, setModelsText] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [fetchedModels, setFetchedModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTestResult(null);
    setFetchedModels([]);
    setShowKey(false);
    if (existing) {
      setStep('form');
      setForm({ ...emptyForm, ...existing, apiKey: '', clearApiKey: false });
      setHeaderRows(Object.entries(existing.headers || {}).map(([k, v]) => ({ k, v })));
      setModelsText((existing.models || []).join('\n'));
      setPreset(null);
      setLoadingModels(true);
      api
        .getProviderModels(existing.id)
        .then((list) => setFetchedModels(Array.isArray(list) ? list : []))
        .catch(() => setFetchedModels([]))
        .finally(() => setLoadingModels(false));
    } else {
      setStep('preset');
      setForm(emptyForm);
      setHeaderRows([]);
      setModelsText('');
      setPreset(null);
    }
  }, [open, existing]);

  const typeInfo = useMemo(() => (catalog?.types || []).find((t) => t.type === form.type), [catalog, form.type]);

  const pickPreset = (p) => {
    setPreset(p);
    setForm({ ...emptyForm, type: p.type, name: p.name === 'Custom OpenAI-compatible' ? '' : p.name, baseUrl: p.baseUrl || '' });
    setStep('form');
  };

  const buildConfig = () => {
    const headers = {};
    headerRows.forEach(({ k, v }) => {
      if (k.trim()) headers[k.trim()] = v;
    });
    const models = modelsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const cfg = {
      type: form.type,
      name: form.name.trim() || typeInfo?.label || form.type,
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey,
      defaultModel: (form.defaultModel || '').trim(),
      models,
      enabled: form.enabled !== false,
      headers,
      options: form.options || {},
    };
    if (existing?.id) {
      cfg.id = existing.id;
      if (form.clearApiKey) cfg.clearApiKey = true;
    }
    return cfg;
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testProviderConfig(buildConfig());
      setTestResult(r);
      if (Array.isArray(r?.models) && r.models.length) setFetchedModels(r.models);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const cfg = buildConfig();
    if (!cfg.baseUrl && form.type !== 'ollama') {
      toast.error('Base URL is required');
      return;
    }
    setSaving(true);
    try {
      const saved = existing?.id ? await api.updateProvider(existing.id, cfg) : await api.createProvider(cfg);
      toast.success(existing ? 'Provider updated' : 'Provider added');
      onSaved?.(saved, !existing);
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = useMemo(() => {
    const ids = new Set();
    const out = [];
    for (const m of fetchedModels) {
      if (!ids.has(m.id)) {
        ids.add(m.id);
        out.push(m);
      }
    }
    modelsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => {
        if (!ids.has(id)) {
          ids.add(id);
          out.push({ id, name: id });
        }
      });
    return out;
  }, [fetchedModels, modelsText]);

  const needsKey = preset?.needsApiKey ?? typeInfo?.needsApiKey ?? false;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {step === 'form' && !existing && (
          <IconButton size="small" onClick={() => setStep('preset')} aria-label="Back to presets">
            <ArrowLeft size={18} />
          </IconButton>
        )}
        {existing ? 'Edit provider' : step === 'preset' ? 'Add a provider' : `Add ${preset?.name || 'provider'}`}
      </DialogTitle>
      <DialogContent dividers>
        {step === 'preset' ? (
          <PresetPicker catalog={catalog} onPick={pickPreset} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
            <TextField label="Name" size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={typeInfo?.label || form.type} fullWidth />
            <TextField
              label="Base URL"
              size="small"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder={form.type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
              fullWidth
              helperText={form.type === 'openai' ? 'Include the /v1 suffix for OpenAI-compatible servers' : form.type === 'lmstudio' ? 'LM Studio native API (no /v1)' : ' '}
            />
            <TextField
              label={needsKey ? 'API key' : 'API key (optional)'}
              size="small"
              type={showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value, clearApiKey: false })}
              placeholder={existing?.apiKeySet ? '•••••••• (key stored — leave blank to keep)' : needsKey ? 'Required' : 'Leave blank for local servers'}
              fullWidth
              autoComplete="off"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {existing?.apiKeySet && !form.apiKey && <Chip label="key stored" size="small" sx={{ mr: 1 }} />}
                    <IconButton size="small" onClick={() => setShowKey((s) => !s)} aria-label={showKey ? 'Hide key' : 'Show key'}>
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {existing?.apiKeySet && (
              <FormControlLabel
                control={<Checkbox size="small" checked={form.clearApiKey} onChange={(e) => setForm({ ...form, clearApiKey: e.target.checked, apiKey: '' })} />}
                label="Remove the stored API key"
              />
            )}
            <Autocomplete
              freeSolo
              size="small"
              options={modelOptions}
              loading={loadingModels}
              getOptionLabel={(o) => (typeof o === 'string' ? o : o.id)}
              value={form.defaultModel}
              onChange={(_, v) => setForm({ ...form, defaultModel: typeof v === 'string' ? v : v?.id || '' })}
              onInputChange={(_, v, reason) => reason === 'input' && setForm({ ...form, defaultModel: v })}
              renderOption={(props, o) => {
                const { key, ...rest } = props;
                return (
                  <li key={key} {...rest}>
                    <span style={{ flex: 1 }}>{o.id}</span>
                    {o.vision && <Chip label="vision" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Default model"
                  placeholder="e.g. llama3.2, gpt-4o-mini"
                  helperText={
                    fetchedModels.length
                      ? `${fetchedModels.length} models loaded from the server`
                      : existing
                        ? 'No model list from the server — type a model id'
                        : 'Test the connection or save to load the model list'
                  }
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingModels ? <CircularProgress size={14} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <TextField
              label="Manual model list (optional)"
              size="small"
              multiline
              minRows={2}
              value={modelsText}
              onChange={(e) => setModelsText(e.target.value)}
              placeholder={'One model id per line, used when the server cannot list models'}
              fullWidth
            />
            <div>
              <div className="settings-row" style={{ marginBottom: 6 }}>
                <span className="label" style={{ fontSize: '0.9rem' }}>
                  Extra HTTP headers
                </span>
                <Button size="small" startIcon={<Plus size={14} />} onClick={() => setHeaderRows([...headerRows, { k: '', v: '' }])} sx={{ textTransform: 'none' }}>
                  Add header
                </Button>
              </div>
              <div className="header-rows">
                {headerRows.map((row, i) => (
                  <div className="header-row" key={i}>
                    <TextField size="small" placeholder="Header" value={row.k} onChange={(e) => setHeaderRows(headerRows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))} sx={{ flex: 1 }} />
                    <TextField size="small" placeholder="Value" value={row.v} onChange={(e) => setHeaderRows(headerRows.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))} sx={{ flex: 2 }} />
                    <IconButton size="small" onClick={() => setHeaderRows(headerRows.filter((_, j) => j !== i))} aria-label="Remove header">
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                ))}
                {headerRows.length === 0 && <div className="muted" style={{ fontSize: '0.8rem' }}>None. Useful for OpenRouter attribution headers, Azure api-key, etc.</div>}
              </div>
            </div>
            <FormControlLabel control={<Checkbox size="small" checked={form.enabled !== false} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />} label="Enabled" />
            <div className="settings-row">
              <Button variant="outlined" startIcon={testing ? <CircularProgress size={14} /> : <Plug size={16} />} onClick={runTest} disabled={testing} sx={{ textTransform: 'none' }}>
                Test connection
              </Button>
              {testResult && (
                <span className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>
                  {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {testResult.ok
                    ? `${testResult.message || 'Connected'}${testResult.latencyMs != null ? ` · ${testResult.latencyMs} ms` : ''}${testResult.modelCount ? ` · ${testResult.modelCount} models` : ''}`
                    : testResult.error || testResult.message || 'Failed'}
                </span>
              )}
            </div>
            {testResult && !testResult.ok && form.type === 'ollama' && (
              <Alert severity="info" sx={{ fontSize: '0.85rem' }}>
                Is Ollama running? Start it with <code>ollama serve</code>. If LocalMind runs on another machine, set <code>OLLAMA_HOST=0.0.0.0</code>.
              </Alert>
            )}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {step === 'form' && (
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add provider'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
