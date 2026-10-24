// src/components/settings/AppearanceTab.jsx
import { ToggleButtonGroup, ToggleButton, Switch, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { CODE_THEMES } from '../../constants';

const SWATCHES = ['#3f51b5', '#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#805ad5', '#475569'];

function Row({ label, sub, children }) {
  return (
    <div className="settings-row">
      <div>
        <div className="label">{label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function AppearanceTab() {
  const { appearance, updateAppearance } = useSettings();
  const set = (patch) => updateAppearance(patch);

  return (
    <>
      <div className="settings-section">
        <h2>Theme</h2>
        <Row label="Mode">
          <ToggleButtonGroup size="small" exclusive value={appearance.theme} onChange={(_, v) => v && set({ theme: v })}>
            <ToggleButton value="system" sx={{ textTransform: 'none', gap: 1 }}>
              <Monitor size={16} /> System
            </ToggleButton>
            <ToggleButton value="light" sx={{ textTransform: 'none', gap: 1 }}>
              <Sun size={16} /> Light
            </ToggleButton>
            <ToggleButton value="dark" sx={{ textTransform: 'none', gap: 1 }}>
              <Moon size={16} /> Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="Accent color">
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button key={c} className={`swatch ${appearance.accent?.toLowerCase() === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set({ accent: c })} aria-label={`Accent ${c}`} />
            ))}
            <input type="color" className="swatch-custom" value={appearance.accent || '#3f51b5'} onChange={(e) => set({ accent: e.target.value })} aria-label="Custom accent color" />
          </div>
        </Row>
        <Row label="Font size">
          <ToggleButtonGroup size="small" exclusive value={appearance.fontSize || 'medium'} onChange={(_, v) => v && set({ fontSize: v })}>
            <ToggleButton value="small" sx={{ textTransform: 'none' }}>
              Small
            </ToggleButton>
            <ToggleButton value="medium" sx={{ textTransform: 'none' }}>
              Medium
            </ToggleButton>
            <ToggleButton value="large" sx={{ textTransform: 'none' }}>
              Large
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="Code theme">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="code-theme">Code theme</InputLabel>
            <Select labelId="code-theme" label="Code theme" value={appearance.codeTheme || 'material'} onChange={(e) => set({ codeTheme: e.target.value })}>
              {CODE_THEMES.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Row>
        <Row label="Compact layout" sub="Tighter spacing and smaller bubbles">
          <Switch checked={Boolean(appearance.compact)} onChange={(e) => set({ compact: e.target.checked })} />
        </Row>
      </div>

      <div className="settings-section">
        <h2>Chat</h2>
        <Row label="Show reasoning" sub="Display the model's thinking in a collapsible block">
          <Switch checked={appearance.showReasoning !== false} onChange={(e) => set({ showReasoning: e.target.checked })} />
        </Row>
        <Row label="Show timestamps">
          <Switch checked={appearance.showTimestamps !== false} onChange={(e) => set({ showTimestamps: e.target.checked })} />
        </Row>
        <Row label="Enter sends message" sub="Off: Enter adds a new line, Ctrl/⌘+Enter sends">
          <Switch checked={appearance.sendOnEnter !== false} onChange={(e) => set({ sendOnEnter: e.target.checked })} />
        </Row>
      </div>
    </>
  );
}
