// src/components/Navbar.jsx — slim top bar
import { Settings, Sun, Moon, Menu as MenuIcon } from 'lucide-react';
import { Tooltip } from '@mui/material';
import '../styles/Navbar.css';

export default function Navbar({ view, isDark, onToggleTheme, onOpenChat, onOpenSettings, onOpenDrawer, showDrawerButton }) {
  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-left">
        {showDrawerButton && (
          <button className="icon-btn" onClick={onOpenDrawer} aria-label="Open chat list">
            <MenuIcon size={20} />
          </button>
        )}
        <button className="brand" onClick={onOpenChat} aria-label="LocalMind home">
          <span className="brand-mark" aria-hidden="true">
            ◆
          </span>
          <span>LocalMind</span>
        </button>
      </div>
      <div className="navbar-right">
        <Tooltip title={isDark ? 'Light theme' : 'Dark theme'}>
          <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </Tooltip>
        <Tooltip title="Settings">
          <button className="icon-btn" onClick={onOpenSettings} aria-label="Settings" aria-pressed={view === 'settings'}>
            <Settings size={18} />
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
