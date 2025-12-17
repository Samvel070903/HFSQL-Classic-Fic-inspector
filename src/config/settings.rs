/**
 * Gestion de la configuration de l'application FIC Engine.
 * 
 * Ce fichier définit les structures de configuration et les méthodes pour
 * les charger depuis différents sources (fichier TOML, variables d'environnement).
 * 
 * Structure de configuration :
 * - Settings : Configuration principale contenant tous les sous-modules
 * - ApiSettings : Paramètres du serveur HTTP (host, port, CORS)
 * - StorageSettings : Paramètres du moteur de stockage (lecture seule, écriture)
 * - LoggingSettings : Paramètres de logging (niveau de log)
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/cli/mod.rs pour charger la configuration au démarrage
 * - Utilisé par src/api/server.rs pour configurer le serveur HTTP
 */

use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Configuration principale de l'application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// Chemin du dossier contenant les fichiers .fic/.mmo/.ndx
    pub data_dir: PathBuf,
    /// Paramètres du serveur API HTTP
    pub api: ApiSettings,
    /// Paramètres du moteur de stockage
    pub storage: StorageSettings,
    /// Paramètres de logging
    pub logging: LoggingSettings,
}

/// Paramètres de configuration du serveur API HTTP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiSettings {
    /// Adresse IP ou hostname du serveur
    pub host: String,
    /// Port d'écoute du serveur
    pub port: u16,
    /// Active ou désactive le CORS (Cross-Origin Resource Sharing)
    pub cors_enabled: bool,
}

/// Paramètres de configuration du moteur de stockage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageSettings {
    /// Active le mode lecture seule (désactive les modifications)
    pub read_only: bool,
    /// Active l'écriture (redondant avec read_only, à supprimer si non utilisé)
    pub enable_write: bool,
    /// Active le multi-threading pour la lecture parallèle (améliore les performances)
    #[serde(default = "default_parallel")]
    pub parallel: bool,
}

fn default_parallel() -> bool {
    true
}

/// Paramètres de configuration du système de logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingSettings {
    /// Niveau de log (ex: "info", "debug", "warn", "error")
    pub level: String,
}

impl Default for Settings {
    /**
     * Crée une configuration par défaut avec des valeurs raisonnables.
     * 
     * @returns Settings - Configuration par défaut
     */
    fn default() -> Self {
        Self {
            data_dir: PathBuf::from("./data"),
            api: ApiSettings {
                host: "127.0.0.1".to_string(),
                port: 8080,
                cors_enabled: true,
            },
            storage: StorageSettings {
                read_only: false,
                enable_write: true,
                parallel: true,
            },
            logging: LoggingSettings {
                level: "info".to_string(),
            },
        }
    }
}

impl Settings {
    /**
     * Charge la configuration depuis différentes sources.
     * 
     * Ordre de priorité :
     * 1. Variable d'environnement FIC_CONFIG (chemin vers un fichier TOML)
     * 2. Fichier config.toml dans le répertoire courant
     * 3. Valeurs par défaut
     * 
     * Les variables d'environnement peuvent ensuite surcharger les valeurs
     * chargées depuis le fichier (préfixe FIC__).
     * 
     * @returns Result<Settings> - Configuration chargée ou erreur
     * 
     * Variables d'environnement supportées :
     * - FIC_CONFIG : Chemin vers le fichier de configuration
     * - FIC__DATA_DIR : Chemin du dossier de données
     * - FIC__API__HOST : Host du serveur API
     * - FIC__API__PORT : Port du serveur API
     * - FIC__STORAGE__READ_ONLY : Mode lecture seule (true/false)
     */
    pub fn load() -> anyhow::Result<Self> {
        // Tentative de chargement depuis un fichier de configuration
        let mut settings = if let Ok(path) = std::env::var("FIC_CONFIG") {
            Self::from_path(&path)?
        } else if PathBuf::from("config.toml").exists() {
            Self::from_path("config.toml")?
        } else {
            Settings::default()
        };

        // Surcharge avec les variables d'environnement
        if let Ok(data_dir) = std::env::var("FIC__DATA_DIR") {
            settings.data_dir = PathBuf::from(data_dir);
        }
        if let Ok(host) = std::env::var("FIC__API__HOST") {
            settings.api.host = host;
        }
        if let Ok(port) = std::env::var("FIC__API__PORT") {
            settings.api.port = port.parse()?;
        }
        if let Ok(read_only) = std::env::var("FIC__STORAGE__READ_ONLY") {
            settings.storage.read_only = read_only.parse().unwrap_or(false);
        }

        Ok(settings)
    }

    /**
     * Charge la configuration depuis un fichier TOML.
     * 
     * @param path - Chemin vers le fichier TOML de configuration
     * @returns Result<Settings> - Configuration chargée ou erreur
     * 
     * Effets de bord :
     * - Lit le fichier depuis le système de fichiers
     */
    pub fn from_path(path: impl AsRef<std::path::Path>) -> anyhow::Result<Self> {
        let path = path.as_ref();
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Impossible de lire le fichier: {:?}", path))?;
        let settings: Settings = toml::from_str(&content)?;
        Ok(settings)
    }
}

