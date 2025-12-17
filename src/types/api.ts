// Types pour les réponses de l'API backend

export interface HealthResponse {
  status: string;
  version: string;
}

export interface TableSchema {
  name: string;
  record_length: number;
  field_count: number;
  fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  offset: number;
  length: number;
  field_type: 'String' | 'Integer' | 'Float' | 'Date' | 'Memo' | 'Binary' | 'Unknown';
}

export interface Record {
  id: number;
  fields: Record<string, FieldValue>;
  memo_data: Record<string, string>;
}

export type FieldValue = 
  | { type: 'string'; value: string }
  | { type: 'integer'; value: number }
  | { type: 'float'; value: number }
  | { type: 'binary'; value: string } // hex string
  | { type: 'null'; value: null };

export interface QueryResult {
  records: Record[];
  total: number;
  offset: number;
  limit: number;
}

export interface QueryFilters {
  limit?: number;
  offset?: number;
  field_filters?: Record<string, string>;
}

export interface NdxEntry {
  key: string;
  record_id: number;
  offset: number;
}

export interface TableInfo {
  name: string;
  record_count: number;
  file_sizes: {
    fic?: number;
    mmo?: number;
    ndx?: number[];
  };
}

// Types pour le suivi d'activité
export interface DatabaseAccess {
  path: string;
  name: string;
  last_accessed: number;
  last_accessed_formatted: string;
  table_count: number;
  access_count: number;
}

export interface DsnActivity {
  dsn_name: string;
  activity_type: string; // "Created" | "Updated" | "Deleted" | "Used"
  timestamp: number;
  timestamp_formatted: string;
  details: Record<string, string>;
}

export interface ActivityResponse {
  recent_databases: DatabaseAccess[];
  dsn_activities: DsnActivity[];
}

