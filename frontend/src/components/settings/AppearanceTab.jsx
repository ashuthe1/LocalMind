// src/components/settings/AppearanceTab.jsx
import { ToggleButtonGroup, ToggleButton, Switch } from '@mui/material';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { DEFAULT_ACCENT } from '../../constants';

const SWATCHES = [DEFAULT_ACCENT, '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#475569'];

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

const toggleSx = { textTransform: 'none', gap: 0.75, px: 1.5 };

export default function AppearanceTab() {
  const { appearance, updateAppearance } = useSettings();
  const set = (patch) => updateAppearance(patch);

  return (
    <>
      <div className="settings-section">
        <h2>Look</h2>
        <Row label="Theme">
          <ToggleButtonGroup size="small" exclusive value={appearance.theme} onChange={(_, v) => v && set({ theme: v })}>
            <ToggleButton value="system" sx={toggleSx}>
              <Monitor size={15} /> System
            </ToggleButton>
            <ToggleButton value="light" sx={toggleSx}>
              <Sun size={15} /> Light
            </ToggleButton>
            <ToggleButton value="dark" sx={toggleSx}>
              <Moon size={15} /> Dark
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="Accent">
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button key={c} className={`swatch ${appearance.accent?.toLowerCase() === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set({ accent: c })} aria-label={`Accent ${c}`} />
            ))}
            <input type="color" className="swatch-custom" value={appearance.accent || DEFAULT_ACCENT} onChange={(e) => set({ accent: e.target.value })} aria-label="Custom accent color" />
          </div>
        </Row>
        <Row label="Text size">
          <ToggleButtonGroup size="small" exclusive value={appearance.fontSize || 'medium'} onChange={(_, v) => v && set({ fontSize: v })}>
            <ToggleButton value="small" sx={toggleSx}>
              Small
            </ToggleButton>
            <ToggleButton value="medium" sx={toggleSx}>
              Medium
            </ToggleButton>
            <ToggleButton value="large" sx={toggleSx}>
              Large
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
      </div>
      <div className="settings-section">
        <h2>Chat</h2>
        <Row label="Show thinking" sub="Show the model's reasoning above its answer, when it has any.">
          <Switch checked={appearance.showReasoning !== false} onChange={(e) => set({ showReasoning: e.target.checked })} />
        </Row>
        <Row label="Show times">
          <Switch checked={appearance.showTimestamps !== false} onChange={(e) => set({ showTimestamps: e.target.checked })} />
        </Row>
        <Row label="Enter sends" sub="Off: Enter adds a new line and Ctrl/⌘+Enter sends.">
          <Switch checked={appearance.sendOnEnter !== false} onChange={(e) => set({ sendOnEnter: e.target.checked })} />
        </Row>
      </div>
    </>
  );
}
