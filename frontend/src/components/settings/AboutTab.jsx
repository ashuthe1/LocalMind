// src/components/settings/AboutTab.jsx
import { Button } from '@mui/material';
import { Github, Bug, ShieldCheck } from 'lucide-react';

const REPO = 'https://github.com/ashuthe1/LocalMind';

export default function AboutTab({ health }) {
  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ShieldCheck size={32} style={{ color: 'var(--primary-color)' }} />
        <div>
          <h2>LocalMind</h2>
          <div className="sub">A private chat UI for any LLM provider. Your conversations stay on your machine.</div>
        </div>
      </div>
      <div className="kv provider-card" style={{ border: 'none', padding: 0, background: 'transparent' }}>
        <div className="kv">
          <span>Server version</span>
          <span>{health?.version || '—'}</span>
          <span>Storage</span>
          <span>{health?.storage || '—'}</span>
          <span>Uptime</span>
          <span>{health?.uptimeSeconds != null ? `${Math.floor(health.uptimeSeconds / 60)} min` : '—'}</span>
          <span>Active provider</span>
          <span>{health?.activeProvider ? `${health.activeProvider.name} (${health.activeProvider.type}) · ${health.activeProvider.model || 'default model'}` : 'none'}</span>
        </div>
      </div>
      <div className="settings-row" style={{ justifyContent: 'flex-start' }}>
        <Button variant="outlined" startIcon={<Github size={16} />} href={REPO} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>
          GitHub repository
        </Button>
        <Button variant="outlined" startIcon={<Bug size={16} />} href={`${REPO}/issues`} target="_blank" rel="noreferrer" sx={{ textTransform: 'none' }}>
          Report an issue
        </Button>
      </div>
      <div className="sub">MIT licensed. Built with Go, React, Vite and MUI.</div>
    </div>
  );
}
