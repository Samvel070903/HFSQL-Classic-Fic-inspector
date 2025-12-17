import axios, { AxiosInstance } from 'axios';
import type {
  HealthResponse,
  ActivityResponse,
} from '../types/api';

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = 'http://127.0.0.1:8080') {
    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 secondes
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercepteur pour les erreurs
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  setBaseURL(url: string) {
    this.client.defaults.baseURL = url;
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health');
    return response.data;
  }


  async executeSql(sql: string, dsn?: string): Promise<{ success: boolean; data?: any; error?: string; rows_affected?: number }> {
    const payload: any = { sql };
    if (dsn) {
      payload.dsn = dsn;
    }
    
    // Log pour diagnostic (détecter les différences entre Electron et web)
    const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
    console.log(`[${isElectron ? 'Electron' : 'Web'}] Exécution SQL:`, {
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      dsn,
      userAgent: navigator.userAgent,
      platform: isElectron ? (window as any).electronAPI?.platform : 'web'
    });
    
    try {
      const response = await this.client.post<{ success: boolean; data?: any; error?: string; rows_affected?: number }>(
        '/sql',
        payload
      );
      
      console.log(`[${isElectron ? 'Electron' : 'Web'}] Réponse SQL:`, {
        success: response.data.success,
        hasData: !!response.data.data,
        error: response.data.error,
        rowsAffected: response.data.rows_affected
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`[${isElectron ? 'Electron' : 'Web'}] Erreur SQL:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        sql: sql.substring(0, 100),
        dsn
      });
      throw error;
    }
  }

  async getOdbcTables(dsn: string): Promise<{ success: boolean; tables: string[]; error?: string }> {
    const response = await this.client.post<{ success: boolean; tables: string[]; error?: string }>(
      '/odbc/tables',
      { dsn }
    );
    return response.data;
  }

  async getOdbcRelations(dsn: string): Promise<{ success: boolean; relations: Array<{ from_table: string; from_column: string; to_table: string; to_column: string }>; error?: string }> {
    const response = await this.client.post<{ success: boolean; relations: Array<{ from_table: string; from_column: string; to_table: string; to_column: string }>; error?: string }>(
      '/odbc/relations',
      { dsn }
    );
    return response.data;
  }

  async getLogs(level?: 'info' | 'warn' | 'error' | 'debug', limit?: number): Promise<{ success: boolean; logs?: any[]; total?: number; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (level) params.append('level', level);
      if (limit) params.append('limit', limit.toString());
      
      const response = await this.client.get<{ logs: any[]; total: number }>(
        `/logs?${params.toString()}`
      );
      return { success: true, logs: response.data.logs, total: response.data.total };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur lors de la récupération des logs' };
    }
  }

  async getActivity(dbLimit?: number, dsnLimit?: number): Promise<ActivityResponse> {
    const params: Record<string, string> = {};
    if (dbLimit !== undefined) {
      params.db_limit = dbLimit.toString();
    }
    if (dsnLimit !== undefined) {
      params.dsn_limit = dsnLimit.toString();
    }
    const response = await this.client.get<ActivityResponse>('/activity', { params });
    return response.data;
  }

  async scanDirectory(path: string): Promise<{ success: boolean; tables: string[]; error?: string }> {
    try {
      const response = await this.client.post<{ success: boolean; tables: string[]; error?: string }>(
        '/scan',
        { path }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        tables: [],
        error: error.response?.data?.error || error.message || 'Erreur lors du scan du dossier',
      };
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;

