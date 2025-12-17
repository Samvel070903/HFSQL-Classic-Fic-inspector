import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Info, AlertTriangle, XCircle, Copy, Download, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../services/apiClient';

interface BackendLog {
  id: string;
  timestamp: number;
  level: string;
  message: string;
  source?: string;
  details?: any;
}

const Logs: React.FC = () => {
  const { logs: frontendLogs, addLog } = useApp();
  const [backendLogs, setBackendLogs] = useState<BackendLog[]>([]);
  const [filterLevel, setFilterLevel] = React.useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Charger les logs depuis le backend
  const loadBackendLogs = async () => {
    try {
      const result = await apiClient.getLogs(
        filterLevel === 'all' ? undefined : filterLevel,
        1000
      );
      if (result.success && result.logs) {
        setBackendLogs(result.logs);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des logs:', error);
    }
  };

  useEffect(() => {
    loadBackendLogs();
    if (autoRefresh) {
      const interval = setInterval(loadBackendLogs, 2000); // Rafraîchir toutes les 2 secondes
      return () => clearInterval(interval);
    }
  }, [filterLevel, autoRefresh]);

  // Combiner les logs frontend et backend
  const allLogs = useMemo(() => {
    const combined: Array<{ id: string; timestamp: Date; level: string; message: string; source?: string; details?: any }> = [];
    
    // Ajouter les logs backend
    backendLogs.forEach(log => {
      combined.push({
        id: log.id,
        timestamp: new Date(log.timestamp),
        level: log.level,
        message: log.message,
        source: log.source,
        details: log.details,
      });
    });
    
    // Ajouter les logs frontend
    frontendLogs.forEach(log => {
      combined.push({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        details: log.details,
      });
    });
    
    // Trier par timestamp (plus récents en premier)
    combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return combined;
  }, [backendLogs, frontendLogs]);

  const filteredLogs = useMemo(() => {
    if (filterLevel === 'all') return allLogs;
    return allLogs.filter((log) => log.level === filterLevel);
  }, [allLogs, filterLevel]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Info className="w-4 h-4 text-theme-primary" />;
    }
  };

  const copyLog = (log: any) => {
    const text = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(text);
    addLog({
      id: Date.now().toString(),
      timestamp: new Date(),
      level: 'info',
      message: 'Log copié dans le presse-papiers',
    });
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(allLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-theme-foreground">Logs & Diagnostics</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              autoRefresh 
                ? 'bg-theme-primary text-white' 
                : 'bg-theme-secondary text-white'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-actualisation activée' : 'Auto-actualisation désactivée'}
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-4 py-2 bg-theme-secondary rounded-lg text-sm text-white hover:bg-theme-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Filtres avec séparation visuelle */}
      <div className="bg-theme-card rounded-lg border border-theme-card p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-theme-foreground">Filtrer par niveau:</span>
          <div className="flex items-center gap-2">
            {[
              { key: 'all', label: 'Tous', color: 'bg-gray-500' },
              { key: 'info', label: 'Info', color: 'bg-blue-500' },
              { key: 'warn', label: 'Avertissement', color: 'bg-yellow-500' },
              { key: 'error', label: 'Erreur', color: 'bg-red-500' },
            ].map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilterLevel(key as any)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  filterLevel === key
                    ? `${color} text-white shadow-lg scale-105`
                    : 'bg-theme-secondary text-theme-statusbar hover:bg-theme-secondary/80'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste des logs */}
      <div className="bg-theme-card rounded-lg border border-theme-card">
        <div className="divide-y divide-theme-card">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-theme-secondary">
              Aucun log disponible
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-theme-card/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {getLevelIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-theme-secondary">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => copyLog(log)}
                        className="p-1 hover:bg-theme-secondary rounded"
                      >
                        <Copy className="w-3 h-3 text-theme-secondary" />
                      </button>
                    </div>
                    <div className="text-sm text-theme-card">
                      {log.source && (
                        <span className="text-xs text-theme-secondary mr-2">[{log.source}]</span>
                      )}
                      {log.message}
                    </div>
                    {log.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-theme-secondary cursor-pointer">
                          Détails
                        </summary>
                        <pre className="mt-2 p-2 bg-theme-background rounded text-xs overflow-auto text-theme-foreground">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;

