// src/components/settings/ProviderForm.jsx — the one provider form used by setup and settings
import { useEffect, useMemo, useState } from 'react';
import { TextField, Autocomplete, CircularProgress, InputAdornment, FormControlLabel, Checkbox, Chip } from '@mui/material';
import { Eye, EyeOff, CheckCircle2, XCircle, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

const emptyForm = { type: 'openai', name: '', baseUrl: '', apiKey: '', clearApiKey: false, defaultModel: '', models: [], enabled: true, headers: {}, options: {} };

/**
 * Props:
 *  choice   – { type, name, baseUrl, needsApiKey } from PROVIDER_CHOICES (new provider)
 *  existing – saved ProviderConfig (edit mode)
 *  renderActions({ submit, saving, canSubmit, tested }) – footer buttons
 *  onSubmit(savedProvider, created) – called after the API call succeeds
 *  onError(err)
 */
export default function ProviderForm({ choice, existing, renderActions, onSubmit, onError }) {
  const isCustom = choice?.id === 'custom';
  const [form, setForm] = useState(() => (existing ? { ...emptyForm, ...existing, apiKey: '', clearApiKey: false } : { ...emptyForm, type: choice?.type || 'openai', name: isCustom ? '' : choice?.name || '', baseUrl: choice?.baseUrl || '' }));
  const [showKey, setShowKey] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [headerRows, setHeaderRows] = useState(() => Object.entries(existing?.headers || {}).map(([k, v]) => ({ k, v })));
  const [modelsText, setModelsText] = useState(() => (existing?.models || []).join('\n'));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [fetchedModels, setFetchedModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing?.id) return;
    setLoadingModels(true);
    api
      .getProviderModels(existing.id)
      .then((list) => setFetchedModels(Array.isArray(list) ? list : []))
      .catch(() => setFetchedModels([]))
      .finally(() => setLoadingModels(false));
  }, [existing?.id]);

  const needsKey = existing ? existing.type === 'anthropic' || existing.type === 'gemini' : Boolean(choice?.needsApiKey);
  const showKeyField = needsKey || advanced || existing?.apiKeySet;

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
      name: form.name.trim() || choice?.name || form.type,
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

  const canSubmit = Boolean(form.baseUrl.trim()) && (!needsKey || form.apiKey.trim() || existing?.apiKeySet) && !saving;

  const submit = async () => {
    const cfg = buildConfig();
    setSaving(true);
    try {
      const saved = existing?.id ? await api.updateProvider(existing.id, cfg) : await api.createProvider(cfg);
      await onSubmit?.(saved, !existing);
    } catch (err) {
      onError?.(err);
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

  const urlHint =
    form.type === 'openai'
      ? 'Include the /v1 suffix for OpenAI-compatible servers.'
      : form.type === 'lmstudio'
        ? 'LM Studio native API (no /v1).'
        : form.type === 'ollama'
          ? 'Default Ollama address. Change it if Ollama runs on another machine.'
          : ' ';

  return (
    <div className="form-stack">
      {(existing || isCustom || advanced) && (
        <TextField label="Name" size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={choice?.name || form.type} fullWidth />
      )}
      <TextField
        label={form.type === 'ollama' || form.type === 'lmstudio' ? 'Server address' : 'API URL'}
        size="small"
        value={form.baseUrl}
        onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
        placeholder={form.type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
        helperText={urlHint}
        fullWidth
      />
      {showKeyField && (
        <TextField
          label={needsKey ? 'API key' : 'API key (optional)'}
          size="small"
          type={showKey ? 'text' : 'password'}
          value={form.apiKey}
          onChange={(e) => setForm({ ...form, apiKey: e.target.value, clearApiKey: false })}
          placeholder={existing?.apiKeySet ? 'Key stored — leave blank to keep it' : needsKey ? 'Paste your key' : 'Only if your server requires one'}
          fullWidth
          autoComplete="off"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {existing?.apiKeySet && !form.apiKey && <Chip label="stored" size="small" sx={{ mr: 1 }} />}
                <button type="button" className="icon-btn" onClick={() => setShowKey((s) => !s)} aria-label={showKey ? 'Hide key' : 'Show key'}>
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </InputAdornment>
            ),
          }}
        />
      )}
      {existing?.apiKeySet && (
        <FormControlLabel control={<Checkbox size="small" checked={form.clearApiKey} onChange={(e) => setForm({ ...form, clearApiKey: e.target.checked, apiKey: '' })} />} label="Remove the stored API key" />
      )}

      <div className="settings-row" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn" onClick={runTest} disabled={testing || !form.baseUrl.trim()}>
          {testing ? <CircularProgress size={14} /> : null} Test connection
        </button>
        {testResult && (
          <span className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>
            {testResult.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {testResult.ok ? testResult.message || 'Connected' : testResult.error || testResult.message || 'Could not connect'}
          </span>
        )}
      </div>
      {testResult && !testResult.ok && form.type === 'ollama' && (
        <div className="field-hint">
          Is Ollama running? Start it with <code>ollama serve</code>. If LocalMind runs on another machine, set <code>OLLAMA_HOST=0.0.0.0</code> there.
        </div>
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
              {o.loaded && <Chip label="loaded" size="small" sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }} />}
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Model"
            placeholder="e.g. llama3.2, gpt-4o-mini"
            helperText={fetchedModels.length ? `${fetchedModels.length} models found — pick one or type a model id` : 'Test the connection to list models, or type a model id'}
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

      <button type="button" className="advanced-toggle" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
        Advanced <ChevronDown size={14} className={`chev ${advanced ? 'open' : ''}`} />
      </button>
      {advanced && (
        <div className="form-stack">
          <TextField label="Manual model list" size="small" multiline minRows={2} value={modelsText} onChange={(e) => setModelsText(e.target.value)} helperText="One model id per line. Used when the server cannot list its models." fullWidth />
          <div className="field">
            <div className="settings-row">
              <span className="label">Extra HTTP headers</span>
              <button type="button" className="btn text" onClick={() => setHeaderRows([...headerRows, { k: '', v: '' }])}>
                <Plus size={14} /> Add header
              </button>
            </div>
            <div className="header-rows">
              {headerRows.map((row, i) => (
                <div className="header-row" key={i}>
                  <TextField size="small" placeholder="Header" value={row.k} onChange={(e) => setHeaderRows(headerRows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))} sx={{ flex: 1 }} />
                  <TextField size="small" placeholder="Value" value={row.v} onChange={(e) => setHeaderRows(headerRows.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))} sx={{ flex: 2 }} />
                  <button type="button" className="icon-btn" onClick={() => setHeaderRows(headerRows.filter((_, j) => j !== i))} aria-label="Remove header">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {headerRows.length === 0 && <div className="field-hint">Sent with every request. Useful for Azure (api-key) or OpenRouter attribution.</div>}
            </div>
          </div>
        </div>
      )}

      {renderActions?.({ submit, saving, canSubmit, tested: Boolean(testResult?.ok) })}
    </div>
  );
}
