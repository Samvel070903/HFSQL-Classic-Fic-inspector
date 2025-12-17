import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/apiClient';
import { Theme, getTheme } from '../themes';
import { useTheme } from '../hooks/useTheme';

interface AppContextType {
  apiUrl: string;
  setApiUrl: (url: string) => void;
  isConnected: boolean;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'error';
  refreshConnection: () => Promise<void>;
  logs: LogEntry[];
  addLog: (entry: LogEntry) => void;
  theme: Theme;
  themeId: string;
  setTheme: (themeId: string) => void;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiUrl, setApiUrlState] = useState<string>(
    localStorage.getItem('apiUrl') || 'http://127.0.0.1:8080'
  );
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [themeId, setThemeIdState] = useState<string>(
    localStorage.getItem('theme') || 'dark'
  );
  const theme = getTheme(themeId);

  const setApiUrl = (url: string) => {
    setApiUrlState(url);
    localStorage.setItem('apiUrl', url);
    apiClient.setBaseURL(url);
  };

  const setTheme = (newThemeId: string) => {
    setThemeIdState(newThemeId);
    localStorage.setItem('theme', newThemeId);
  };

  // Appliquer le thème
  useTheme(theme);

  const addLog = (entry: LogEntry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 1000)); // Garder max 1000 logs
  };

  const refreshConnection = async () => {
    setConnectionStatus('connecting');
    try {
      await apiClient.getHealth();
      setIsConnected(true);
      setConnectionStatus('connected');
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'info',
        message: `Connecté à ${apiUrl}`,
      });
    } catch (error) {
      setIsConnected(false);
      setConnectionStatus('error');
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur de connexion à ${apiUrl}`,
        details: error,
      });
    }
  };


  useEffect(() => {
    apiClient.setBaseURL(apiUrl);
    refreshConnection();
  }, [apiUrl]);

  return (
    <AppContext.Provider
      value={{
        apiUrl,
        setApiUrl,
        isConnected,
        connectionStatus,
        refreshConnection,
        logs,
        addLog,
        theme,
        themeId,
        setTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

