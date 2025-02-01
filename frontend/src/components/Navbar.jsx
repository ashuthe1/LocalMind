import React from 'react';
import { MessageCircle, Settings, Sun, Moon } from 'lucide-react';
import '../styles/Navbar.css';

const Navbar = ({ darkMode, toggleTheme, activeView, setActiveView }) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1>LocalMind✨</h1>
      </div>
      <div className="navbar-buttons">
        <button
          onClick={() => setActiveView('chat')}
          className={`navbar-btn ${activeView === 'chat' ? 'active' : ''}`}
        >
          <MessageCircle size={20} />
          <span>Chat</span>
        </button>
        <button
          onClick={() => setActiveView('settings')}
          className={`navbar-btn ${activeView === 'settings' ? 'active' : ''}`}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <button onClick={toggleTheme} className="navbar-btn">
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
