import React, { useState, useEffect, useCallback } from 'react';
import { Database, Search, Download, RefreshCw, FileText, Loader2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import apiClient from '../services/apiClient';
import { exportTable, exportSqlResults } from '../services/exportService';
import SchemaViewer, { Schema } from '../components/SchemaViewer';
import FolderPicker from '../components/FolderPicker';
import toast, { Toaster } from 'react-hot-toast';

interface TableInfo {
  name: string;
  recordCount?: number;
  fileSize?: number;
  lastModified?: Date;
}

const Tables: React.FC = () => {
  const { isConnected, addLog } = useApp();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Charger les tables depuis un dossier scanné ou via ODBC
  const loadTables = useCallback(async (folderPath?: string) => {
    if (!isConnected) return;

    setLoading(true);
    try {
      const path = folderPath || selectedFolder;
      if (path) {
        // Scanner un dossier local
        const response = await apiClient.scanDirectory(path);
        if (response.success) {
          const tableInfos: TableInfo[] = response.tables.map((name) => ({ name }));
          setTables(tableInfos);
          addLog({
            id: Date.now().toString(),
            timestamp: new Date(),
            level: 'info',
            message: `${tableInfos.length} table(s) trouvée(s) dans ${path}`,
          });
        } else {
          toast.error(response.error || 'Erreur lors du scan');
        }
      } else {
        // Essayer de récupérer via SQL (si un DSN est configuré)
        // Pour l'instant, on affiche un message
        toast.error('Veuillez sélectionner un dossier ou configurer un DSN');
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des tables:', error);
      toast.error('Erreur lors du chargement des tables');
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur lors du chargement des tables: ${error.message}`,
        details: error,
      });
    } finally {
      setLoading(false);
    }
  }, [isConnected, selectedFolder, addLog]);

  // Charger le schéma d'une table
  const loadSchema = useCallback(async (tableName: string) => {
    if (!isConnected) return;

    setLoadingSchema(true);
    try {
      // Essayer de récupérer le schéma via SQL
      // Note: Le backend devrait avoir un endpoint GET /tables/{table}/schema
      // Pour l'instant, on utilise SQL pour obtenir les colonnes
      const response = await apiClient.executeSql(`SELECT * FROM ${tableName} LIMIT 0`);
      if (response.success && response.data) {
        // Construire un schéma basique depuis les colonnes
        const columns = response.data.columns || [];
        const schema: Schema = {
          name: tableName,
          record_length: 0, // Inconnu sans endpoint dédié
          field_count: columns.length,
          fields: columns.map((col: string, idx: number) => ({
            name: col,
            field_type: 'Unknown', // Type inconnu sans endpoint dédié
            offset: idx * 4, // Estimation
            length: 0, // Inconnu
          })),
        };
        setSchema(schema);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement du schéma:', error);
      toast.error('Erreur lors du chargement du schéma');
    } finally {
      setLoadingSchema(false);
    }
  }, [isConnected]);

  // Charger les données d'une table
  const loadTableData = useCallback(async (tableName: string, page: number = 1) => {
    if (!isConnected) return;

    setLoadingData(true);
    try {
      const offset = (page - 1) * pageSize;
      const query = `SELECT * FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`;
      const response = await apiClient.executeSql(query);

      if (response.success && response.data) {
        setTableColumns(response.data.columns || []);
        setTableData(response.data.rows || []);
        setCurrentPage(page);
        toast.success(`${response.data.rows?.length || 0} enregistrement(s) chargé(s)`);
      } else {
        toast.error(response.error || 'Erreur lors du chargement des données');
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoadingData(false);
    }
  }, [isConnected, pageSize]);

  // Gérer la sélection d'une table
  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    loadSchema(tableName);
    loadTableData(tableName, 1);
  };

  // Exporter les données de la table
  const handleExport = (format: 'json' | 'csv') => {
    if (!selectedTable || tableData.length === 0) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    try {
      if (format === 'json') {
        exportTable(selectedTable, tableData, { format: 'json' });
      } else {
        exportSqlResults(tableColumns, tableData, { format: 'csv' });
      }
      toast.success(`Export ${format.toUpperCase()} réussi`);
    } catch (error: any) {
      toast.error(`Erreur lors de l'export: ${error.message}`);
    }
  };

  // Exporter le schéma
  const handleExportSchema = () => {
    if (!schema) return;
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-${schema.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Schéma exporté');
  };

  // Filtrer les tables
  const filteredTables = tables.filter((table) =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (isConnected) {
      loadTables();
    }
  }, [isConnected]);

  const handleFolderSelected = async (path: string) => {
    setSelectedFolder(path);
    setShowFolderPicker(false);
    await loadTables(path);
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-theme-foreground">Tables</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFolderPicker(true)}
            className="flex items-center gap-2 px-4 py-2 bg-theme-primary rounded-lg text-white transition-colors"
          >
            <FileText className="w-4 h-4" />
            Sélectionner un dossier
          </button>
          <button
            onClick={() => loadTables()}
            disabled={loading || !isConnected}
            className="flex items-center gap-2 px-4 py-2 bg-theme-secondary rounded-lg text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="bg-theme-card rounded-lg border border-theme-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-theme-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une table..."
            className="w-full pl-10 pr-4 py-2 bg-theme-input border border-theme-input rounded-lg text-theme-input placeholder-theme-input focus:outline-none focus:ring-2 ring-theme-focus"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des tables */}
        <div className="lg:col-span-1">
          <div className="bg-theme-card rounded-lg border border-theme-card p-4">
            <h2 className="text-lg font-semibold mb-4 text-theme-card">
              Tables ({filteredTables.length})
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-theme-primary" />
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="text-center py-8 text-theme-secondary">
                <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucune table trouvée</p>
                {!selectedFolder && (
                  <p className="text-sm mt-2">Sélectionnez un dossier pour commencer</p>
                )}
              </div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {filteredTables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => handleTableSelect(table.name)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedTable === table.name
                        ? 'bg-theme-primary text-white'
                        : 'bg-theme-secondary text-theme-statusbar hover:bg-theme-secondary/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      <span className="font-mono text-sm">{table.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Détails de la table sélectionnée */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTable ? (
            <>
              {/* Schéma */}
              <SchemaViewer
                schema={schema}
                loading={loadingSchema}
                onExport={handleExportSchema}
              />

              {/* Données */}
              <div className="bg-theme-card rounded-lg border border-theme-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-theme-card">
                    Données de {selectedTable}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport('json')}
                      disabled={tableData.length === 0}
                      className="flex items-center gap-2 px-3 py-1.5 bg-theme-secondary rounded text-sm text-white transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={tableData.length === 0}
                      className="flex items-center gap-2 px-3 py-1.5 bg-theme-secondary rounded text-sm text-white transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                  </div>
                </div>

                {loadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-theme-primary" />
                  </div>
                ) : tableData.length === 0 ? (
                  <div className="text-center py-8 text-theme-secondary">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune donnée disponible</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-theme-table-header border-b border-theme-table">
                            {tableColumns.map((col, idx) => (
                              <th
                                key={idx}
                                className="px-4 py-2 text-left font-semibold text-theme-card whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className="border-b border-theme-table hover:bg-theme-table-row-hover transition-colors"
                            >
                              {tableColumns.map((col, colIdx) => (
                                <td
                                  key={colIdx}
                                  className="px-4 py-2 text-theme-statusbar whitespace-nowrap"
                                >
                                  {row[colIdx] !== null && row[colIdx] !== undefined
                                    ? String(row[colIdx])
                                    : 'NULL'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-theme-secondary">
                        Page {currentPage} • {tableData.length} enregistrement(s)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadTableData(selectedTable, currentPage - 1)}
                          disabled={currentPage === 1 || loadingData}
                          className="p-2 bg-theme-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => loadTableData(selectedTable, currentPage + 1)}
                          disabled={tableData.length < pageSize || loadingData}
                          className="p-2 bg-theme-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="bg-theme-card rounded-lg border border-theme-card p-12 text-center">
              <Database className="w-16 h-16 mx-auto mb-4 text-theme-secondary opacity-50" />
              <p className="text-theme-secondary">Sélectionnez une table pour voir ses détails</p>
            </div>
          )}
        </div>
      </div>

      {/* Sélecteur de dossier */}
      <FolderPicker
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleFolderSelected}
        initialPath={selectedFolder || undefined}
        title="Sélectionner le dossier contenant les fichiers .FIC"
      />
    </div>
  );
};

export default Tables;

