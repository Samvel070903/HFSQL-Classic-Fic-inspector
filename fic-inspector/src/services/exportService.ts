import Papa from 'papaparse';

export interface ExportOptions {
  format: 'json' | 'csv';
  filename?: string;
  includeHeaders?: boolean;
}

/**
 * Exporte des données en JSON
 */
export function exportToJSON(data: any[], filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporte des données en CSV
 */
export function exportToCSV(
  data: any[],
  columns?: string[],
  filename?: string
): void {
  if (data.length === 0) {
    throw new Error('Aucune donnée à exporter');
  }

  // Si des colonnes sont spécifiées, utiliser seulement celles-ci
  const dataToExport = columns
    ? data.map((row) => {
        const filtered: any = {};
        columns.forEach((col) => {
          filtered[col] = row[col];
        });
        return filtered;
      })
    : data;

  const csv = Papa.unparse(dataToExport, {
    header: true,
    delimiter: ';', // Utiliser point-virgule pour Excel français
  });

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM pour Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporte les résultats d'une requête SQL
 */
export function exportSqlResults(
  columns: string[],
  rows: any[],
  options: ExportOptions
): void {
  const { format, filename } = options;

  // Transformer les lignes en objets avec les noms de colonnes
  const data = rows.map((row) => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx] !== undefined ? row[idx] : null;
    });
    return obj;
  });

  if (format === 'json') {
    exportToJSON(data, filename);
  } else {
    exportToCSV(data, columns, filename);
  }
}

/**
 * Exporte une table complète
 */
export function exportTable(
  tableName: string,
  data: any[],
  options: ExportOptions
): void {
  const { format, filename } = options;
  const finalFilename = filename || `${tableName}-${new Date().toISOString().split('T')[0]}`;

  if (format === 'json') {
    exportToJSON(data, `${finalFilename}.json`);
  } else {
    // Pour CSV, on extrait les colonnes depuis les clés du premier objet
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    exportToCSV(data, columns, `${finalFilename}.csv`);
  }
}

