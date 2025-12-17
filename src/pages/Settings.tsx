import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Save, RefreshCw } from 'lucide-react';
import { themes } from '../themes';

const Settings: React.FC = () => {
  const { apiUrl, setApiUrl, refreshConnection, connectionStatus, themeId, setTheme } = useApp();
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);

  const handleSave = () => {
    setApiUrl(localApiUrl);
    refreshConnection();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-theme-foreground">Paramètres</h1>

      <div className="bg-theme-card rounded-lg border border-theme-card p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4 text-theme-card">Connexion API</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-statusbar mb-2">
                URL de l'API
              </label>
              <input
                type="text"
                value={localApiUrl}
                onChange={(e) => setLocalApiUrl(e.target.value)}
                placeholder="http://127.0.0.1:8080"
                className="w-full px-4 py-2 bg-theme-input border border-theme-input rounded-lg text-theme-input placeholder-theme-input focus:outline-none focus:ring-2 ring-theme-focus"
              />
              <p className="mt-1 text-xs text-theme-statusbar opacity-75">
                URL de base de l'API REST backend
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-theme-primary rounded-lg text-white transition-colors"
              >
                <Save className="w-4 h-4" />
                Enregistrer
              </button>
              <button
                onClick={refreshConnection}
                disabled={connectionStatus === 'connecting'}
                className="flex items-center gap-2 px-4 py-2 bg-theme-secondary disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
              >
                <RefreshCw className={connectionStatus === 'connecting' ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                Tester la connexion
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-theme-card pt-6">
          <h2 className="text-xl font-semibold mb-4 text-theme-card">Interface</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-statusbar mb-2">
                Thème
              </label>
              <select
                value={themeId}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-4 py-2 bg-theme-input border border-theme-input rounded-lg text-theme-input focus:outline-none focus:ring-2 ring-theme-focus"
              >
                {Object.values(themes).map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-theme-statusbar opacity-75">
                Choisissez un thème pour personnaliser l'apparence de l'application
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

