import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { FileText, AlertTriangle, Database, Clock, Activity, RefreshCw, Plus, Edit, Trash2, Zap } from 'lucide-react';
import apiClient from '../services/apiClient';
import type { ActivityResponse, DatabaseAccess, DsnActivity } from '../types/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard: React.FC = () => {
  const { logs, isConnected } = useApp();
  const [stats, setStats] = useState({
    errorCount: 0,
    infoCount: 0,
    warnCount: 0,
  });
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadActivity = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      const data = await apiClient.getActivity(10, 20);
      setActivity(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Erreur lors du chargement de l\'activité:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      const errorCount = logs.filter((log) => log.level === 'error').length;
      const infoCount = logs.filter((log) => log.level === 'info').length;
      const warnCount = logs.filter((log) => log.level === 'warn').length;
      
      setStats({
        errorCount,
        infoCount,
        warnCount,
      });
    }
  }, [logs, isConnected]);

  useEffect(() => {
    loadActivity();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadActivity, 30000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatTimeAgo = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    if (diff < 2592000) return `Il y a ${Math.floor(diff / 86400)} jours`;
    
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'Created':
        return <Plus className="w-4 h-4" />;
      case 'Updated':
        return <Edit className="w-4 h-4" />;
      case 'Deleted':
        return <Trash2 className="w-4 h-4" />;
      case 'Used':
        return <Zap className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'Created':
        return 'text-green-400 bg-green-500/20';
      case 'Updated':
        return 'text-theme-primary bg-theme-primary/20';
      case 'Deleted':
        return 'text-red-400 bg-red-500/20';
      case 'Used':
        return 'text-theme-accent bg-theme-accent/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-theme-foreground">Tableau de bord</h1>
        <button
          onClick={loadActivity}
          disabled={loading || !isConnected}
          className="flex items-center gap-2 px-4 py-2 bg-theme-secondary rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={FileText}
          title="Messages Info"
          value={stats.infoCount.toString()}
          subtitle="dans les logs"
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          title="Avertissements"
          value={stats.warnCount.toString()}
          subtitle="dans les logs"
          color="yellow"
        />
        <StatCard
          icon={AlertTriangle}
          title="Erreurs"
          value={stats.errorCount.toString()}
          subtitle="dans les logs"
          color="red"
        />
      </div>

      {/* Graphiques */}
      {activity && activity.recent_databases.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique en barres - Nombre de tables par base */}
          <div className="bg-theme-card rounded-lg border border-theme-card p-6">
            <h2 className="text-xl font-semibold mb-4 text-theme-card">Tables par base de données</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activity.recent_databases.map(db => ({ name: db.name, tables: db.table_count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Legend />
                <Bar dataKey="tables" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Graphique en camembert - Distribution des accès */}
          <div className="bg-theme-card rounded-lg border border-theme-card p-6">
            <h2 className="text-xl font-semibold mb-4 text-theme-card">Distribution des accès</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={activity.recent_databases.map(db => ({ name: db.name, value: db.access_count }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {activity.recent_databases.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Suivi d'activité */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bases de données récentes */}
        <div className="bg-theme-card rounded-lg border border-theme-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-theme-primary" />
              <h2 className="text-xl font-semibold text-theme-card">Bases de données récentes</h2>
            </div>
            {activity && (
              <span className="text-xs text-theme-secondary">
                {activity.recent_databases.length} base{activity.recent_databases.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {loading && !activity ? (
            <div className="text-center py-8 text-theme-secondary">Chargement...</div>
          ) : !activity || activity.recent_databases.length === 0 ? (
            <div className="text-center py-8 text-theme-secondary">
              <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune base de données consultée récemment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.recent_databases.map((db, index) => (
                <DatabaseCard key={index} database={db} formatTimeAgo={formatTimeAgo} />
              ))}
            </div>
          )}
        </div>

        {/* Historique des activités DSN */}
        <div className="bg-theme-card rounded-lg border border-theme-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-theme-accent" />
              <h2 className="text-xl font-semibold text-theme-card">Activités DSN</h2>
            </div>
            {activity && (
              <span className="text-xs text-theme-secondary">
                {activity.dsn_activities.length} activité{activity.dsn_activities.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {loading && !activity ? (
            <div className="text-center py-8 text-theme-secondary">Chargement...</div>
          ) : !activity || activity.dsn_activities.length === 0 ? (
            <div className="text-center py-8 text-theme-secondary">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune activité DSN récente</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {activity.dsn_activities.map((dsnActivity, index) => (
                <DsnActivityCard
                  key={index}
                  activity={dsnActivity}
                  formatTimeAgo={formatTimeAgo}
                  getActivityIcon={getActivityIcon}
                  getActivityColor={getActivityColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Information de dernière mise à jour */}
      {lastRefresh && (
        <div className="text-xs text-theme-muted text-center flex items-center justify-center gap-2">
          <Clock className="w-3 h-3" />
          Dernière mise à jour: {lastRefresh.toLocaleTimeString('fr-FR')}
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'green' | 'red' | 'yellow';
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, subtitle, color }) => {
  const colorClasses = {
    blue: 'bg-theme-primary/20 text-theme-primary border-theme-primary/50',
    green: 'bg-green-500/20 text-green-400 border-green-500/50',
    red: 'bg-red-500/20 text-red-400 border-red-500/50',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  };

  return (
    <div className={`bg-theme-card rounded-lg border ${colorClasses[color]} p-6`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-8 h-8" />
      </div>
      <div className="text-3xl font-bold mb-1 text-theme-card">{value}</div>
      <div className="text-sm opacity-75 text-theme-card">{title}</div>
      <div className="text-xs opacity-50 mt-1 text-theme-card">{subtitle}</div>
    </div>
  );
};

interface DatabaseCardProps {
  database: DatabaseAccess;
  formatTimeAgo: (timestamp: number) => string;
}

const DatabaseCard: React.FC<DatabaseCardProps> = ({ database, formatTimeAgo }) => {
  return (
    <div className="bg-theme-card/50 rounded-lg border border-theme-card p-4 hover:bg-theme-card transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-theme-card truncate" title={database.name}>
            {database.name}
          </h3>
          <p className="text-xs text-theme-secondary truncate mt-1" title={database.path}>
            {database.path}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-theme-secondary ml-2">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(database.last_accessed)}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-theme-secondary">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          {database.table_count} table{database.table_count > 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {database.access_count} accès{database.access_count > 1 ? '' : ''}
        </span>
      </div>
    </div>
  );
};

interface DsnActivityCardProps {
  activity: DsnActivity;
  formatTimeAgo: (timestamp: number) => string;
  getActivityIcon: (type: string) => React.ReactNode;
  getActivityColor: (type: string) => string;
}

const DsnActivityCard: React.FC<DsnActivityCardProps> = ({
  activity,
  formatTimeAgo,
  getActivityIcon,
  getActivityColor,
}) => {
  return (
    <div className="bg-theme-card/50 rounded-lg border border-theme-card p-4 hover:bg-theme-card transition-colors">
      <div className="flex items-start gap-3">
        <div className={`${getActivityColor(activity.activity_type)} rounded-lg p-2 flex-shrink-0`}>
          {getActivityIcon(activity.activity_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-semibold text-theme-card">
              {activity.dsn_name}
            </h3>
            <span className="text-xs text-theme-secondary ml-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(activity.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded ${getActivityColor(activity.activity_type)}`}>
              {activity.activity_type}
            </span>
          </div>
          {Object.keys(activity.details).length > 0 && (
            <div className="text-xs text-theme-secondary mt-2 space-y-1">
              {Object.entries(activity.details).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-medium">{key}:</span>
                  <span className="text-theme-card opacity-90">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;