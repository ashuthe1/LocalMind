// src/components/settings/SettingsPage.jsx
import { useState } from 'react';
import { Tabs, Tab, IconButton } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import ProvidersTab from './ProvidersTab';
import ModelTab from './ModelTab';
import PersonaTab from './PersonaTab';
import AppearanceTab from './AppearanceTab';
import DataTab from './DataTab';
import AboutTab from './AboutTab';
import '../../styles/settings.css';

const TABS = ['Providers', 'Model', 'Persona', 'Appearance', 'Data', 'About'];

export default function SettingsPage({ onBack, health, onProvidersChanged, onDataChanged, initialTab = 0 }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="settings-page">
      <div className="settings-inner">
        <div className="settings-header">
          <IconButton onClick={onBack} aria-label="Back to chat">
            <ArrowLeft size={20} />
          </IconButton>
          <h1>Settings</h1>
        </div>
        <Tabs className="settings-tabs" value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {TABS.map((t) => (
            <Tab key={t} label={t} />
          ))}
        </Tabs>
        {tab === 0 && <ProvidersTab onProvidersChanged={onProvidersChanged} />}
        {tab === 1 && <ModelTab />}
        {tab === 2 && <PersonaTab />}
        {tab === 3 && <AppearanceTab />}
        {tab === 4 && <DataTab onDataChanged={onDataChanged} />}
        {tab === 5 && <AboutTab health={health} />}
      </div>
    </div>
  );
}
