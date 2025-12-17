import React from 'react';
import { Database, FileText, Download } from 'lucide-react';

export interface Field {
  name: string;
  field_type: string;
  offset: number;
  length: number;
}

export interface Schema {
  name: string;
  record_length: number;
  field_count: number;
  fields: Field[];
}

interface SchemaViewerProps {
  schema: Schema | null;
  loading?: boolean;
  onExport?: () => void;
}

const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema, loading, onExport }) => {
  if (loading) {
    return (
      <div className="bg-theme-card rounded-lg border border-theme-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary"></div>
          <span className="ml-3 text-theme-secondary">Chargement du schéma...</span>
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="bg-theme-card rounded-lg border border-theme-card p-6">
        <div className="text-center py-8 text-theme-secondary">
          <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun schéma disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-card rounded-lg border border-theme-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-theme-primary" />
          <h2 className="text-xl font-semibold text-theme-card">Schéma de la table</h2>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-1.5 bg-theme-secondary rounded text-sm text-white transition-colors hover:bg-theme-secondary/80"
            title="Exporter le schéma"
          >
            <Download className="w-4 h-4" />
            Exporter
          </button>
        )}
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-theme-secondary">Table:</span>
          <span className="font-mono text-theme-card">{schema.name}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-theme-secondary">Taille d'enregistrement:</span>
          <span className="font-mono text-theme-card">{schema.record_length} bytes</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-theme-secondary">Nombre de colonnes:</span>
          <span className="font-mono text-theme-card">{schema.field_count}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-theme-table-header border-b border-theme-table">
              <th className="px-4 py-2 text-left font-semibold text-theme-card">Nom</th>
              <th className="px-4 py-2 text-left font-semibold text-theme-card">Type</th>
              <th className="px-4 py-2 text-left font-semibold text-theme-card">Offset</th>
              <th className="px-4 py-2 text-left font-semibold text-theme-card">Longueur</th>
            </tr>
          </thead>
          <tbody>
            {schema.fields.map((field, idx) => (
              <tr
                key={idx}
                className="border-b border-theme-table hover:bg-theme-table-row-hover transition-colors"
              >
                <td className="px-4 py-2 font-mono text-theme-statusbar">{field.name}</td>
                <td className="px-4 py-2 text-theme-statusbar">{field.field_type}</td>
                <td className="px-4 py-2 font-mono text-theme-statusbar">{field.offset}</td>
                <td className="px-4 py-2 font-mono text-theme-statusbar">{field.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {schema.fields.length === 0 && (
        <div className="text-center py-8 text-theme-secondary">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun champ défini</p>
        </div>
      )}
    </div>
  );
};

export default SchemaViewer;

