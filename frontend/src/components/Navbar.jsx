// src/components/Navbar.jsx
import { MessageCircle, Settings, Sun, Moon, ShieldCheck, Menu as MenuIcon } from 'lucide-react';
import { Tooltip } from '@mui/material';
import '../styles/Navbar.css';

export default function Navbar({ view, isDark, onToggleTheme, onOpenChat, onOpenSettings, onOpenDrawer, showDrawerButton }) {
  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-background-animation" />
      <div className="navbar-left">
        {showDrawerButton && (
          <button className="navbar-btn icon-only" onClick={onOpenDrawer} aria-label="Open chat list">
            <MenuIcon size={20} />
          </button>
        )}
        <button className="navbar-btn brand" onClick={onOpenChat} aria-label="LocalMind home">
          <ShieldCheck size={22} className="brand-icon" />
          <span>LocalMind</span>
        </button>
      </div>
      <div className="navbar-buttons">
        <button className={`navbar-btn ${view === 'chat' ? 'active' : ''}`} onClick={onOpenChat}>
          <MessageCircle size={18} />
          <span className="label">Chat</span>
        </button>
        <button className={`navbar-btn ${view === 'settings' ? 'active' : ''}`} onClick={onOpenSettings}>
          <Settings size={18} />
          <span className="label">Settings</span>
        </button>
        <Tooltip title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
          <button className="navbar-btn icon-only" onClick={onToggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
