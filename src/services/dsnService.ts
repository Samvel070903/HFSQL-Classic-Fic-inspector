/**
 * Service de gestion des DSN (Data Source Name)
 * 
 * Permet de créer, lister, modifier et supprimer des configurations DSN
 * qui pointent vers des emplacements de fichiers de base de données.
 * 
 * Les DSN sont créés réellement dans le registre Windows via l'API backend.
 */

import axios from 'axios';
import { apiClient } from './apiClient';

export interface DSN {
  id?: string;
  name: string;
  path: string;
  description?: string;
  driver?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Interface pour les DSN retournés par l'API backend
interface BackendDSN {
  name: string;
  description?: string;
  driver?: string;
  database_path?: string;
}

const STORAGE_KEY = 'fic_inspector_dsns';

class DSNService {
  /**
   * Récupère tous les DSN depuis l'API backend (DSN ODBC réels Windows)
   */
  async getAllFromBackend(): Promise<DSN[]> {
    try {
      // Utiliser directement axios avec la baseURL de apiClient
      const baseURL = (apiClient as any).client.defaults.baseURL || 'http://127.0.0.1:8080';
      const response = await axios.get<{ success: boolean; dsns: BackendDSN[]; error?: string }>(`${baseURL}/dsn`);
      if (response.data.success && response.data.dsns) {
        return response.data.dsns.map(dsn => ({
          id: dsn.name, // Utiliser le nom comme ID pour les DSN Windows
          name: dsn.name,
          path: dsn.database_path || '',
          description: dsn.description,
          driver: dsn.driver,
        }));
      }
      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération des DSN depuis le backend:', error);
      return [];
    }
  }

  /**
   * Récupère tous les DSN stockés (localStorage - pour compatibilité)
   * @deprecated Utilisez getAllFromBackend() pour les DSN ODBC réels
   */
  getAll(): DSN[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Erreur lors de la lecture des DSN:', error);
      return [];
    }
  }

  /**
   * Récupère un DSN par son ID
   */
  getById(id: string): DSN | null {
    const dsns = this.getAll();
    return dsns.find(dsn => dsn.id === id) || null;
  }

  /**
   * Récupère un DSN par son nom
   */
  getByName(name: string): DSN | null {
    const dsns = this.getAll();
    return dsns.find(dsn => dsn.name === name) || null;
  }

  /**
   * Crée un nouveau DSN ODBC réel dans Windows via l'API backend
   */
  async createInBackend(dsn: Omit<DSN, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const baseURL = (apiClient as any).client.defaults.baseURL || 'http://127.0.0.1:8080';
      const response = await axios.post<{ success: boolean; message?: string; error?: string }>(`${baseURL}/dsn`, {
        name: dsn.name,
        description: dsn.description,
        database_path: dsn.path,
        driver: dsn.driver || 'HFSQL', // Driver par défaut pour HFSQL
        driver_params: {},
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Erreur lors de la création du DSN');
      }
    } catch (error: any) {
      console.error('Erreur lors de la création du DSN dans le backend:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la création du DSN';
      throw new Error(errorMessage);
    }
  }

  /**
   * Crée un nouveau DSN (localStorage - pour compatibilité)
   * @deprecated Utilisez createInBackend() pour créer un DSN ODBC réel
   */
  create(dsn: Omit<DSN, 'id' | 'createdAt' | 'updatedAt'>): DSN {
    const dsns = this.getAll();
    
    // Vérifier si un DSN avec le même nom existe déjà
    if (dsns.some(d => d.name === dsn.name)) {
      throw new Error(`Un DSN avec le nom "${dsn.name}" existe déjà`);
    }

    const newDSN: DSN = {
      ...dsn,
      id: `dsn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    dsns.push(newDSN);
    this.save(dsns);
    return newDSN;
  }

  /**
   * Met à jour un DSN ODBC réel dans Windows via l'API backend
   */
  async updateInBackend(name: string, updates: Partial<Omit<DSN, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      const baseURL = (apiClient as any).client.defaults.baseURL || 'http://127.0.0.1:8080';
      const response = await axios.put<{ success: boolean; message?: string; error?: string }>(`${baseURL}/dsn/${encodeURIComponent(name)}`, {
        description: updates.description,
        database_path: updates.path,
        driver: updates.driver,
        driver_params: {},
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Erreur lors de la mise à jour du DSN');
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du DSN dans le backend:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la mise à jour du DSN';
      throw new Error(errorMessage);
    }
  }

  /**
   * Met à jour un DSN existant (localStorage - pour compatibilité)
   * @deprecated Utilisez updateInBackend() pour mettre à jour un DSN ODBC réel
   */
  update(id: string, updates: Partial<Omit<DSN, 'id' | 'createdAt'>>): DSN {
    const dsns = this.getAll();
    const index = dsns.findIndex(d => d.id === id);
    
    if (index === -1) {
      throw new Error(`DSN avec l'ID "${id}" non trouvé`);
    }

    // Vérifier si le nouveau nom n'est pas déjà utilisé par un autre DSN
    if (updates.name && dsns.some((d, i) => i !== index && d.name === updates.name)) {
      throw new Error(`Un DSN avec le nom "${updates.name}" existe déjà`);
    }

    const updatedDSN: DSN = {
      ...dsns[index],
      ...updates,
      updatedAt: Date.now(),
    };

    dsns[index] = updatedDSN;
    this.save(dsns);
    return updatedDSN;
  }

  /**
   * Supprime un DSN ODBC réel dans Windows via l'API backend
   */
  async deleteFromBackend(name: string): Promise<void> {
    try {
      const baseURL = (apiClient as any).client.defaults.baseURL || 'http://127.0.0.1:8080';
      const response = await axios.delete<{ success: boolean; message?: string; error?: string }>(`${baseURL}/dsn/${encodeURIComponent(name)}`);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Erreur lors de la suppression du DSN');
      }
    } catch (error: any) {
      console.error('Erreur lors de la suppression du DSN dans le backend:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la suppression du DSN';
      throw new Error(errorMessage);
    }
  }

  /**
   * Supprime un DSN (localStorage - pour compatibilité)
   * @deprecated Utilisez deleteFromBackend() pour supprimer un DSN ODBC réel
   */
  delete(id: string): void {
    const dsns = this.getAll();
    const filtered = dsns.filter(d => d.id !== id);
    
    if (filtered.length === dsns.length) {
      throw new Error(`DSN avec l'ID "${id}" non trouvé`);
    }

    this.save(filtered);
  }

  /**
   * Sauvegarde la liste des DSN dans localStorage
   */
  private save(dsns: DSN[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dsns));
      // Émettre un événement pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('dsnUpdated'));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des DSN:', error);
      throw new Error('Impossible de sauvegarder les DSN');
    }
  }

  /**
   * Valide un chemin de dossier
   */
  validatePath(path: string): { valid: boolean; error?: string } {
    if (!path || path.trim().length === 0) {
      return { valid: false, error: 'Le chemin ne peut pas être vide' };
    }

    // Vérifier que le chemin est absolu (commence par C:\ sur Windows ou / sur Unix)
    const trimmedPath = path.trim();
    if (!trimmedPath.match(/^[A-Z]:\\.*$/i) && !trimmedPath.startsWith('/')) {
      return { valid: false, error: 'Le chemin doit être un chemin absolu (ex: C:\\data ou /data)' };
    }

    return { valid: true };
  }

  /**
   * Valide un nom de DSN
   */
  validateName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Le nom ne peut pas être vide' };
    }

    if (name.length > 64) {
      return { valid: false, error: 'Le nom ne peut pas dépasser 64 caractères' };
    }

    // Vérifier que le nom ne contient que des caractères alphanumériques, espaces, tirets et underscores
    if (!name.match(/^[a-zA-Z0-9\s\-_]+$/)) {
      return { valid: false, error: 'Le nom ne peut contenir que des lettres, chiffres, espaces, tirets et underscores' };
    }

    return { valid: true };
  }
}

export const dsnService = new DSNService();
export default dsnService;

