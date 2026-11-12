
import { useEffect, useState } from 'react';
import {
  UserRound,
  ShieldCheck,
  Bell,
  Map,
  Save,
  Camera,
  LockKeyhole,
  RotateCcw
} from 'lucide-react';

import './Profile.css';

// Default profile information
const defaultProfile = {
  name: 'FlareX User',
  email: 'user@flarex.com',
  organization: '',
  role: 'Researcher',
  location: 'India'
};

// Default platform preferences
const defaultPreferences = {
  notifications: true,
  criticalAlerts: true,
  defaultMap: 'Detections',
  theme: 'Dark'
};

// Safely load saved information
function loadFromStorage(key, defaults) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
}

export default function Profile ({ onLogout , user}){

  const [profile, setProfile] = useState(() =>
    loadFromStorage('flarex-profile', defaultProfile)
  );

  const [preferences, setPreferences] = useState(() =>
    loadFromStorage('flarex-preferences', defaultPreferences)
  );
  useEffect(() => {
  if (!user) return;

  setProfile(prev => ({
    ...prev,
    name: user.name || prev.name,
    email: user.email || prev.email
  }));
}, [user]);
  const [saved, setSaved] = useState(false);

  // Update personal information
  function updateProfile(field, value) {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));

    setSaved(false);
  }

  // Update platform preferences
  function updatePreference(field, value) {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));

    setSaved(false);
  }

  // Save information
  function handleSave(e) {
    if (e) e.preventDefault();

    try {
      localStorage.setItem(
        'flarex-profile',
        JSON.stringify(profile)
      );

      localStorage.setItem(
        'flarex-preferences',
        JSON.stringify(preferences)
      );

      setSaved(true);
    } catch (error) {
      console.error('Unable to save profile:', error);
      setSaved(false);
      alert('Unable to save changes in this browser.');
    }
  }

  // Reset profile information
  function resetProfile() {
    const confirmed = window.confirm(
      'Are you sure you want to reset your profile and preferences?'
    );

    if (!confirmed) return;

    setProfile({ ...defaultProfile });
    setPreferences({ ...defaultPreferences });

    localStorage.removeItem('flarex-profile');
    localStorage.removeItem('flarex-preferences');

    setSaved(false);
  }

  return (
    <main className="profile-page">

      {/* HEADER */}
      <header className="profile-header">
        <div>
          <span className="profile-eyebrow">
            FLAREX / ACCOUNT
          </span>

          <h1>My Profile</h1>

          <p>
            Manage your personal information and platform preferences.
          </p>
        </div>

        <button
          type="button"
          className="profile-save"
          onClick={handleSave}
        >
          <Save size={16} />
          Save changes
        </button>
      </header>

      {/* SAVE MESSAGE */}
      {saved && (
        <div className="profile-success">
          <ShieldCheck size={17} />
          Your changes have been saved successfully.
        </div>
      )}

      {/* PROFILE OVERVIEW */}
      <section className="profile-overview">

        <div className="profile-avatar">
          <UserRound size={36} />

          <button
            type="button"
            title="Avatar upload coming soon"
          >
            <Camera size={14} />
          </button>
        </div>

        <div className="profile-overview-info">
          <span>YOUR ACCOUNT</span>

          <h2>{profile.name || 'Your name'}</h2>

          <p>{profile.email || 'No email added'}</p>
        </div>

        <div className="profile-role">
          <ShieldCheck size={15} />
          {profile.role}
        </div>

      </section>

      <form onSubmit={handleSave}>

        {/* PERSONAL INFORMATION */}
        <section className="profile-card">

          <div className="profile-card-heading">

            <div className="profile-card-icon orange">
              <UserRound size={19} />
            </div>

            <div>
              <h3>Personal information</h3>
              <p>Update your basic account details.</p>
            </div>

          </div>

          <div className="profile-fields">

            <div className="profile-field">
              <label>Full name</label>

              <input
                type="text"
                value={profile.name}
                onChange={e =>
                  updateProfile('name', e.target.value)
                }
                placeholder="Enter your name"
              />
            </div>

            <div className="profile-field">
              <label>Email address</label>

              <input
                type="email"
                value={profile.email}
                onChange={e =>
                  updateProfile('email', e.target.value)
                }
                placeholder="Enter your email"
              />
            </div>

            <div className="profile-field">
              <label>Organisation / Institution</label>

              <input
                type="text"
                value={profile.organization}
                onChange={e =>
                  updateProfile('organization', e.target.value)
                }
                placeholder="Enter your organisation"
              />
            </div>

            <div className="profile-field">
              <label>Role</label>

              <select
                value={profile.role}
                onChange={e =>
                  updateProfile('role', e.target.value)
                }
              >
                <option>Researcher</option>
                <option>Student</option>
                <option>Analyst</option>
                <option>Administrator</option>
                <option>Other</option>
              </select>
            </div>

            <div className="profile-field">
              <label>Primary region</label>

              <input
                type="text"
                value={profile.location}
                onChange={e =>
                  updateProfile('location', e.target.value)
                }
                placeholder="Enter your region"
              />
            </div>

          </div>
        </section>

        {/* NOTIFICATIONS */}
        <section className="profile-card">

          <div className="profile-card-heading">

            <div className="profile-card-icon teal">
              <Bell size={19} />
            </div>

            <div>
              <h3>Notifications</h3>
              <p>
                Choose which platform notifications you want to receive.
              </p>
            </div>

          </div>

          <div className="profile-settings-list">

            <label className="profile-setting">
              <div>
                <strong>Platform notifications</strong>
                <p>Enable notifications within FlareX.</p>
              </div>

              <input
                type="checkbox"
                checked={preferences.notifications}
                onChange={e =>
                  updatePreference(
                    'notifications',
                    e.target.checked
                  )
                }
              />
            </label>

            <label className="profile-setting">
              <div>
                <strong>Critical fire alerts</strong>
                <p>
                  Highlight critical thermal activity alerts.
                </p>
              </div>

              <input
                type="checkbox"
                checked={preferences.criticalAlerts}
                onChange={e =>
                  updatePreference(
                    'criticalAlerts',
                    e.target.checked
                  )
                }
              />
            </label>

          </div>
        </section>

        {/* PLATFORM PREFERENCES */}
        <section className="profile-card">

          <div className="profile-card-heading">

            <div className="profile-card-icon purple">
              <Map size={19} />
            </div>

            <div>
              <h3>Platform preferences</h3>
              <p>
                Customise your default FlareX experience.
              </p>
            </div>

          </div>

          <div className="profile-fields">

            <div className="profile-field">
              <label>Default map layer</label>

              <select
                value={preferences.defaultMap}
                onChange={e =>
                  updatePreference(
                    'defaultMap',
                    e.target.value
                  )
                }
              >
                <option>Detections</option>
                <option>Risk Zones</option>
              </select>
            </div>

            <div className="profile-field">
              <label>Appearance</label>

              <select
                value={preferences.theme}
                onChange={e =>
                  updatePreference('theme', e.target.value)
                }
              >
                <option>Dark</option>
                <option>System default</option>
              </select>
            </div>

          </div>
        </section>

        {/* ACTIONS */}
        <div className="profile-bottom-actions">

          <button
            type="button"
            className="profile-reset"
            onClick={resetProfile}
          >
            <RotateCcw size={15} />
            Reset profile
          </button>

          <button
            type="submit"
            className="profile-save"
          >
            <Save size={15} />
            Save profile
          </button>

        </div>

      </form>

      {/* SECURITY NOTE */}
      <section className="profile-security-note">

        <LockKeyhole size={17} />

        <div>
          <strong>Account security</strong>

          <p>
            Your profile and preferences are currently stored
            locally in your browser. Password management and
            authentication will require a backend account system.
          </p>
        </div>

      </section>
            <button
            type="button"
            className="profile-logout"
            onClick={onLogout}
            >
            Log out
            </button>
      <footer className="profile-footer">
        FLAREX · WILDFIRE INTELLIGENCE PLATFORM
      </footer>

    </main>
  );
}
