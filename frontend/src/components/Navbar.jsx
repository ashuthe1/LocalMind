// src/components/Navbar.jsx
import React from 'react';
import { MessageCircle, Settings, Sun, Moon, ShieldCheck } from 'lucide-react';
<ShieldCheck />
import '../styles/Navbar.css';

const Navbar = ({ darkMode, toggleTheme, activeView, setActiveView }) => {
  return (
    <nav className="navbar">
      {/* Animated background gradient for the entire navbar */}
      <div className="navbar-background-animation"></div>

      <button
          onClick={() => setActiveView('chat')}
          className={`navbar-btn ${activeView === 'chat' ? 'active' : ''} navLeft`}
        >
          <ShieldCheck size={20} />
          <span>LocalMind✨</span>
      </button>

      <div className="navbar-buttons">


      {/* <button
          onClick={() => setActiveView('chat')}
          className={`navbar-btn ${activeView === 'chat' ? 'active' : ''}`}
        >
          <ShieldCheck size={40} />
          <span>LocalMind✨</span>
      </button> */}

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
