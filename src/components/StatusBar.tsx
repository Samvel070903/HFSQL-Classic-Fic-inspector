import React from 'react';
import { useApp } from '../context/AppContext';
import { WifiOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const StatusBar: React.FC = () => {
  const { connectionStatus, apiUrl } = useApp();

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />;
      case 'connected':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4 text-theme-secondary" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connexion...';
      case 'connected':
        return 'Connecté';
      case 'error':
        return 'Erreur de connexion';
      default:
        return 'Déconnecté';
    }
  };

  return (
    <div className="h-12 bg-theme-statusbar border-b border-theme-statusbar px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm text-theme-statusbar">{getStatusText()}</span>
        </div>
        <div className="h-4 w-px border-theme-statusbar bg-theme-statusbar" />
        <span className="text-xs text-theme-statusbar opacity-75">{apiUrl}</span>
      </div>
      
    </div>
  );
};

export default StatusBar;

