/**
 * Gestionnaire de suivi d'activité.
 * 
 * Ce fichier contient le système de suivi qui enregistre :
 * - Les dernières bases de données consultées (chemins de dossiers)
 * - L'historique des DSN (création, modification, utilisation)
 * 
 * Les données sont stockées dans un fichier JSON pour persistance.
 */

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// Type d'activité pour un DSN
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DsnActivityType {
    Created,
    Updated,
    Deleted,
    Used,
}

/// Entrée d'activité pour un DSN
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DsnActivity {
    /// Nom du DSN
    pub dsn_name: String,
    /// Type d'activité
    pub activity_type: DsnActivityType,
    /// Timestamp Unix de l'activité
    pub timestamp: u64,
    /// Informations additionnelles (description, chemin, etc.)
    #[serde(default)]
    pub details: HashMap<String, String>,
}

/// Entrée pour une base de données consultée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseAccess {
    /// Chemin du dossier de la base de données
    pub path: String,
    /// Nom de la base (extrait du chemin)
    pub name: String,
    /// Timestamp Unix du dernier accès
    pub last_accessed: u64,
    /// Nombre de tables détectées lors du dernier scan
    pub table_count: usize,
    /// Nombre total d'accès
    pub access_count: usize,
}

/// Structure complète des données d'activité
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ActivityData {
    /// Liste des accès aux bases de données (triée par dernier accès)
    pub database_accesses: Vec<DatabaseAccess>,
    /// Historique des activités DSN (trié par timestamp décroissant)
    pub dsn_activities: Vec<DsnActivity>,
}

/// Gestionnaire de suivi d'activité
pub struct ActivityTracker {
    /// Chemin du fichier de stockage
    storage_path: PathBuf,
    /// Données en mémoire (thread-safe)
    data: Arc<RwLock<ActivityData>>,
    /// Nombre maximum d'entrées à conserver pour les bases
    max_database_entries: usize,
    /// Nombre maximum d'entrées à conserver pour les activités DSN
    max_dsn_activities: usize,
}

impl ActivityTracker {
    /// Crée un nouveau gestionnaire d'activité
    /// 
    /// # Arguments
    /// * `storage_path` - Chemin vers le fichier JSON de stockage
    /// 
    /// # Returns
    /// * `Result<ActivityTracker>` - Gestionnaire créé ou erreur
    pub fn new(storage_path: impl AsRef<Path>) -> Result<Self> {
        let storage_path = storage_path.as_ref().to_path_buf();
        
        // Créer le dossier parent s'il n'existe pas
        if let Some(parent) = storage_path.parent() {
            std::fs::create_dir_all(parent)
                .context("Impossible de créer le dossier pour l'historique d'activité")?;
        }

        // Charger les données existantes ou créer une nouvelle structure
        let data = if storage_path.exists() {
            let content = std::fs::read_to_string(&storage_path)
                .context("Impossible de lire le fichier d'historique")?;
            serde_json::from_str::<ActivityData>(&content)
                .unwrap_or_default()
        } else {
            ActivityData::default()
        };

        Ok(Self {
            storage_path,
            data: Arc::new(RwLock::new(data)),
            max_database_entries: 50,
            max_dsn_activities: 100,
        })
    }

    /// Enregistre un accès à une base de données
    /// 
    /// # Arguments
    /// * `path` - Chemin du dossier de la base de données
    /// * `table_count` - Nombre de tables détectées
    pub fn record_database_access(&self, path: impl AsRef<Path>, table_count: usize) -> Result<()> {
        let path_str = path.as_ref().to_string_lossy().to_string();
        let name = path.as_ref()
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&path_str)
            .to_string();

        let timestamp = Self::current_timestamp();

        let mut data = self.data.write().unwrap();

        // Chercher si cette base existe déjà
        if let Some(existing) = data.database_accesses.iter_mut()
            .find(|db| db.path == path_str) {
            existing.last_accessed = timestamp;
            existing.table_count = table_count;
            existing.access_count += 1;
        } else {
            // Ajouter une nouvelle entrée
            data.database_accesses.push(DatabaseAccess {
                path: path_str,
                name,
                last_accessed: timestamp,
                table_count,
                access_count: 1,
            });
        }

        // Trier par dernier accès (plus récent en premier)
        data.database_accesses.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));

        // Limiter le nombre d'entrées
        if data.database_accesses.len() > self.max_database_entries {
            data.database_accesses.truncate(self.max_database_entries);
        }

        // Sauvegarder
        self.save()?;

        Ok(())
    }

    /// Enregistre une activité liée à un DSN
    /// 
    /// # Arguments
    /// * `dsn_name` - Nom du DSN
    /// * `activity_type` - Type d'activité
    /// * `details` - Informations additionnelles
    pub fn record_dsn_activity(
        &self,
        dsn_name: &str,
        activity_type: DsnActivityType,
        details: Option<HashMap<String, String>>,
    ) -> Result<()> {
        let activity = DsnActivity {
            dsn_name: dsn_name.to_string(),
            activity_type,
            timestamp: Self::current_timestamp(),
            details: details.unwrap_or_default(),
        };

        let mut data = self.data.write().unwrap();
        data.dsn_activities.push(activity);

        // Trier par timestamp (plus récent en premier)
        data.dsn_activities.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        // Limiter le nombre d'entrées
        if data.dsn_activities.len() > self.max_dsn_activities {
            data.dsn_activities.truncate(self.max_dsn_activities);
        }

        // Sauvegarder
        self.save()?;

        Ok(())
    }

    /// Récupère les dernières bases de données consultées
    /// 
    /// # Arguments
    /// * `limit` - Nombre maximum d'entrées à retourner
    /// 
    /// # Returns
    /// * `Vec<DatabaseAccess>` - Liste des bases triées par dernier accès
    pub fn get_recent_databases(&self, limit: usize) -> Vec<DatabaseAccess> {
        let data = self.data.read().unwrap();
        data.database_accesses
            .iter()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Récupère l'historique des activités DSN
    /// 
    /// # Arguments
    /// * `limit` - Nombre maximum d'entrées à retourner
    /// 
    /// # Returns
    /// * `Vec<DsnActivity>` - Liste des activités triées par timestamp
    pub fn get_dsn_activities(&self, limit: usize) -> Vec<DsnActivity> {
        let data = self.data.read().unwrap();
        data.dsn_activities
            .iter()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Récupère toutes les données d'activité
    pub fn get_all_activity(&self) -> ActivityData {
        self.data.read().unwrap().clone()
    }

    /// Sauvegarde les données sur disque
    fn save(&self) -> Result<()> {
        let data = self.data.read().unwrap();
        let json = serde_json::to_string_pretty(&*data)
            .context("Impossible de sérialiser les données d'activité")?;
        std::fs::write(&self.storage_path, json)
            .context("Impossible d'écrire le fichier d'historique")?;
        Ok(())
    }

    /// Retourne le timestamp Unix actuel
    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}


