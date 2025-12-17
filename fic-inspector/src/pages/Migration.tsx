import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Database, 
  Play, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Settings, 
  RefreshCw,
  Info
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { 
  DatabaseType, 
  MigrationOptions, 
  TestConnectionResponse, 
  MigrationResult 
} from '../types/api';
import clsx from 'clsx';

const Migration: React.FC = () => {
  const { addLog } = useApp();
  const [dbType, setDbType] = useState<DatabaseType>('postgresql');
  const [connectionString, setConnectionString] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<TestConnectionResponse | null>(null);
  const [migrationOptions, setMigrationOptions] = useState<MigrationOptions>({
    create_tables: true,
    truncate_tables: false,
    use_transactions: true,
    batch_size: 1000,
    tables: null,
  });
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationResult | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [statusPolling, setStatusPolling] = useState(false);

  // Exemples de chaînes de connexion par type
  const connectionExamples: Record<DatabaseType, string> = {
    postgresql: 'postgresql://user:password@localhost:5432/database',
    mysql: 'mysql://user:password@localhost:3306/database',
    sqlite: 'sqlite:///path/to/database.db',
    sqlserver: 'mssql://user:password@localhost:1433/database',
    oracle: 'oracle://user:password@localhost:1521/XE',
    odbc: 'DSN=datasource',
  };

  // Mettre à jour la chaîne de connexion quand le type change
  useEffect(() => {
    if (!connectionString || connectionString === connectionExamples[dbType]) {
      setConnectionString(connectionExamples[dbType]);
    }
  }, [dbType]);

  // Tester la connexion
  const handleTestConnection = async () => {
    if (!connectionString.trim()) {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: 'Veuillez saisir une chaîne de connexion',
      });
      return;
    }

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const result = await apiClient.testMigrationConnection({
        db_type: dbType,
        connection_string: connectionString,
      });

      setConnectionTestResult(result);
      
      if (result.success) {
        addLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'info',
          message: `Connexion réussie à ${dbType}`,
        });
      } else {
        addLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'error',
          message: `Échec de la connexion: ${result.error || 'Erreur inconnue'}`,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors du test de connexion';
      setConnectionTestResult({
        success: false,
        error: errorMsg,
      });
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur lors du test de connexion: ${errorMsg}`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Démarrer la migration
  const handleStartMigration = async () => {
    if (!connectionString.trim()) {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: 'Veuillez saisir une chaîne de connexion',
      });
      return;
    }

    // Note: Le backend gère l'accès aux données via le StorageEngine

    setIsStarting(true);

    try {
      const result = await apiClient.startMigration({
        db_type: dbType,
        connection_string: connectionString,
        options: migrationOptions,
      });

      if (result.success && result.migration_id) {
        setMigrationId(result.migration_id);
        setStatusPolling(true);
        addLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'info',
          message: `Migration démarrée (ID: ${result.migration_id})`,
        });
      } else {
        addLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'error',
          message: `Échec du démarrage de la migration: ${result.error || 'Erreur inconnue'}`,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors du démarrage de la migration';
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur lors du démarrage de la migration: ${errorMsg}`,
      });
    } finally {
      setIsStarting(false);
    }
  };

  // Poller le statut de la migration
  useEffect(() => {
    if (!migrationId || !statusPolling) return;

    const pollStatus = async () => {
      try {
        const status = await apiClient.getMigrationStatus(migrationId);
        
        if (status) {
          setMigrationStatus(status);
          
          // Arrêter le polling si la migration est terminée
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            setStatusPolling(false);
            
            if (status.status === 'completed') {
              addLog({
                id: Date.now().toString(),
                timestamp: new Date(),
                level: 'info',
                message: `Migration terminée: ${status.tables_migrated} tables, ${status.records_migrated} enregistrements`,
              });
            } else if (status.status === 'failed') {
              addLog({
                id: Date.now().toString(),
                timestamp: new Date(),
                level: 'error',
                message: `Migration échouée: ${status.error || 'Erreur inconnue'}`,
              });
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du statut:', error);
      }
    };

    const interval = setInterval(pollStatus, 2000); // Poll toutes les 2 secondes
    pollStatus(); // Appel immédiat

    return () => clearInterval(interval);
  }, [migrationId, statusPolling]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Loader className="w-5 h-5 text-yellow-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-theme-foreground">Migration vers SQL</h1>
        <div className="flex items-center gap-2 text-sm text-theme-secondary">
          <Info className="w-4 h-4" />
          <span>Migrez vos données HFSQL vers différentes bases de données SQL</span>
        </div>
      </div>

      {/* Configuration de la connexion */}
      <div className="bg-theme-card rounded-lg border border-theme-card p-6 space-y-4">
        <h2 className="text-xl font-semibold text-theme-foreground flex items-center gap-2">
          <Database className="w-5 h-5" />
          Configuration de la connexion
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-foreground mb-2">
              Type de base de données
            </label>
            <select
              value={dbType}
              onChange={(e) => setDbType(e.target.value as DatabaseType)}
              className="w-full px-4 py-2 bg-theme-background border border-theme-card rounded-lg text-theme-foreground focus:outline-none focus:ring-2 focus:ring-theme-primary"
            >
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL / MariaDB</option>
              <option value="sqlite">SQLite</option>
              <option value="sqlserver">SQL Server</option>
              <option value="oracle">Oracle</option>
              <option value="odbc">ODBC (Générique)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-foreground mb-2">
              Chaîne de connexion
            </label>
            <input
              type="text"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder={connectionExamples[dbType]}
              className="w-full px-4 py-2 bg-theme-background border border-theme-card rounded-lg text-theme-foreground focus:outline-none focus:ring-2 focus:ring-theme-primary"
            />
            <p className="mt-1 text-xs text-theme-secondary">
              Exemple: {connectionExamples[dbType]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              testingConnection
                ? 'bg-theme-secondary text-white cursor-not-allowed'
                : 'bg-theme-primary text-white hover:bg-theme-primary/80'
            )}
          >
            {testingConnection ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Tester la connexion
              </>
            )}
          </button>

          {connectionTestResult && (
            <div className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
              connectionTestResult.success
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            )}>
              {connectionTestResult.success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Connexion réussie
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  {connectionTestResult.error || 'Échec de la connexion'}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Options de migration */}
      <div className="bg-theme-card rounded-lg border border-theme-card p-6 space-y-4">
        <h2 className="text-xl font-semibold text-theme-foreground flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Options de migration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={migrationOptions.create_tables}
              onChange={(e) => setMigrationOptions({ ...migrationOptions, create_tables: e.target.checked })}
              className="w-5 h-5 text-theme-primary rounded focus:ring-2 focus:ring-theme-primary"
            />
            <span className="text-sm text-theme-foreground">Créer les tables si elles n'existent pas</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={migrationOptions.truncate_tables}
              onChange={(e) => setMigrationOptions({ ...migrationOptions, truncate_tables: e.target.checked })}
              className="w-5 h-5 text-theme-primary rounded focus:ring-2 focus:ring-theme-primary"
            />
            <span className="text-sm text-theme-foreground">Vider les tables existantes avant migration</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={migrationOptions.use_transactions}
              onChange={(e) => setMigrationOptions({ ...migrationOptions, use_transactions: e.target.checked })}
              className="w-5 h-5 text-theme-primary rounded focus:ring-2 focus:ring-theme-primary"
            />
            <span className="text-sm text-theme-foreground">Utiliser des transactions (rollback en cas d'erreur)</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-theme-foreground mb-2">
              Taille du batch
            </label>
            <input
              type="number"
              value={migrationOptions.batch_size}
              onChange={(e) => setMigrationOptions({ ...migrationOptions, batch_size: parseInt(e.target.value) || 1000 })}
              min="1"
              max="10000"
              className="w-full px-4 py-2 bg-theme-background border border-theme-card rounded-lg text-theme-foreground focus:outline-none focus:ring-2 focus:ring-theme-primary"
            />
            <p className="mt-1 text-xs text-theme-secondary">
              Nombre d'enregistrements à insérer par batch
            </p>
          </div>
        </div>
      </div>

      {/* Démarrage de la migration */}
      <div className="bg-theme-card rounded-lg border border-theme-card p-6">
          <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-theme-foreground flex items-center gap-2">
            <Play className="w-5 h-5" />
            Démarrer la migration
          </h2>
        </div>

        <button
          onClick={handleStartMigration}
          disabled={isStarting || !connectionString.trim()}
          className={clsx(
            'flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-colors',
            isStarting || !connectionString.trim()
              ? 'bg-theme-secondary text-white cursor-not-allowed opacity-50'
              : 'bg-theme-primary text-white hover:bg-theme-primary/80'
          )}
        >
          {isStarting ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Démarrage en cours...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Démarrer la migration
            </>
          )}
        </button>
      </div>

      {/* Statut de la migration */}
      {migrationStatus && (
        <div className="bg-theme-card rounded-lg border border-theme-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-theme-foreground flex items-center gap-2">
              {getStatusIcon(migrationStatus.status)}
              Statut de la migration
            </h2>
            {statusPolling && (
              <div className="flex items-center gap-2 text-sm text-theme-secondary">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mise à jour en cours...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-theme-background rounded-lg p-4">
              <div className="text-sm text-theme-secondary mb-1">Statut</div>
              <div className="text-lg font-semibold text-theme-foreground capitalize">
                {migrationStatus.status}
              </div>
            </div>
            <div className="bg-theme-background rounded-lg p-4">
              <div className="text-sm text-theme-secondary mb-1">Tables migrées</div>
              <div className="text-lg font-semibold text-theme-foreground">
                {migrationStatus.tables_migrated}
              </div>
            </div>
            <div className="bg-theme-background rounded-lg p-4">
              <div className="text-sm text-theme-secondary mb-1">Enregistrements</div>
              <div className="text-lg font-semibold text-theme-foreground">
                {migrationStatus.records_migrated.toLocaleString()}
              </div>
            </div>
            <div className="bg-theme-background rounded-lg p-4">
              <div className="text-sm text-theme-secondary mb-1">Durée</div>
              <div className="text-lg font-semibold text-theme-foreground">
                {formatDuration(migrationStatus.duration_ms)}
              </div>
            </div>
          </div>

          {migrationStatus.error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <XCircle className="w-4 h-4" />
                <span className="font-semibold">Erreur</span>
              </div>
              <p className="text-sm text-red-300">{migrationStatus.error}</p>
            </div>
          )}

          {migrationStatus.table_details && migrationStatus.table_details.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-theme-foreground mb-2">Détails par table</h3>
              <div className="space-y-2">
                {migrationStatus.table_details.map((table, index) => (
                  <div
                    key={index}
                    className="bg-theme-background rounded-lg p-4 border border-theme-card"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-theme-foreground">{table.table_name}</span>
                      <span className="text-sm text-theme-secondary">
                        {table.records_migrated.toLocaleString()} enregistrements
                      </span>
                    </div>
                    {table.errors && table.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {table.errors.map((error, errIndex) => (
                          <div key={errIndex} className="text-xs text-red-400">
                            • {error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Migration;

