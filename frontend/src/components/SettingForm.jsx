import React, { useState } from 'react';
import '../styles/SettingForm.css';

const DEFAULT_ABOUT_ME = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, 
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor 
in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat 
cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

const DEFAULT_PREFERENCES = `Curabitur non nulla sit amet nisl tempus convallis quis ac lectus. 
Vestibulum ac diam sit amet quam vehicula elementum sed sit amet dui. Donec rutrum congue leo eget malesuada. 
Proin eget tortor risus. Vivamus magna justo, lacinia eget consectetur sed, convallis at tellus. 
Donec sollicitudin molestie malesuada. Nulla porttitor accumsan tincidunt. Pellentesque in ipsum id orci porta dapibus.`;

const SettingForm = () => {
  const [aboutMe, setAboutMe] = useState(
    () => localStorage.getItem('settingsAboutMe') || DEFAULT_ABOUT_ME
  );
  const [preferences, setPreferences] = useState(
    () => localStorage.getItem('settingsPreferences') || DEFAULT_PREFERENCES
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('settingsAboutMe', aboutMe);
    localStorage.setItem('settingsPreferences', preferences);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="setting-form">
      <h2 className="form-title">Settings</h2>
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="aboutMe" className="form-label">About Me</label>
          <textarea
            id="aboutMe"
            className="form-textarea"
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            placeholder="Write about yourself..."
          />
        </div>
        <div className="form-group">
          <label htmlFor="preferences" className="form-label">Preferences</label>
          <textarea
            id="preferences"
            className="form-textarea"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="Set your preferences..."
          />
        </div>
      </div>
      <div className="form-action">
        <button onClick={handleSave} className="save-button">Save Settings</button>
      </div>
      {saved && <div className="save-message">Settings saved!</div>}
    </div>
  );
};

export default SettingForm;
