/**
 * Gestion des DSN ODBC utilisateur.
 * 
 * Ce fichier contient les fonctions pour créer, modifier, supprimer et lister
 * les sources de données ODBC (DSN) utilisateur :
 * 
 * Sur Windows :
 * - Les DSN utilisateur sont stockés dans le registre Windows
 * - HKEY_CURRENT_USER\Software\ODBC\ODBC.INI\<DSN_NAME> : Configuration du DSN
 * - HKEY_CURRENT_USER\Software\ODBC\ODBC.INI\ODBC Data Sources : Liste des DSN
 * 
 * Sur Linux :
 * - Les DSN utilisateur sont stockés dans le fichier ~/.odbc.ini
 * - Format INI standard avec section [ODBC Data Sources] et sections par DSN
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/dsn/handlers.rs pour les endpoints HTTP
 */

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::logger::{get_logger, LogLevel};

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

/// Configuration d'un DSN ODBC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DsnConfig {
    /// Nom du DSN
    pub name: String,
    /// Description du DSN
    pub description: Option<String>,
    /// Chemin vers les fichiers de base de données
    pub database_path: String,
    /// Driver ODBC à utiliser (ex: "SQL Server", "MySQL ODBC 8.0 Driver")
    #[serde(default = "default_driver")]
    pub driver: String,
    /// Paramètres additionnels du driver
    #[serde(default)]
    pub driver_params: HashMap<String, String>,
}

fn default_driver() -> String {
    // Driver par défaut pour les fichiers HFSQL
    "HFSQL".to_string()
}

/// Structure pour représenter un DSN existant
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DsnInfo {
    /// Nom du DSN
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// Driver utilisé
    pub driver: Option<String>,
    /// Chemin de la base de données
    pub database_path: Option<String>,
}

#[cfg(target_os = "windows")]
pub struct DsnManager;

#[cfg(target_os = "windows")]
impl DsnManager {
    /// Obtient la clé de registre pour les DSN utilisateur
    fn get_odbc_ini_key() -> Result<RegKey> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        // Essayer d'ouvrir la clé d'abord
        match hkcu.open_subkey_with_flags(r"Software\ODBC\ODBC.INI", KEY_READ | KEY_WRITE) {
            Ok(key) => Ok(key),
            Err(_) => {
                // Si la clé n'existe pas, la créer
                let (key, _) = hkcu.create_subkey(r"Software\ODBC\ODBC.INI")
                    .context("Impossible de créer la clé de registre ODBC.INI")?;
                Ok(key)
            }
        }
    }

    /// Obtient la clé de registre pour la liste des DSN
    fn get_odbc_data_sources_key() -> Result<RegKey> {
        let odbc_ini = Self::get_odbc_ini_key()
            .context("Impossible d'accéder à la clé ODBC.INI")?;
        
        // Essayer d'ouvrir la clé d'abord
        match odbc_ini.open_subkey_with_flags("ODBC Data Sources", KEY_READ | KEY_WRITE) {
            Ok(key) => Ok(key),
            Err(_) => {
                // Si la clé n'existe pas, la créer
                let (key, _) = odbc_ini.create_subkey("ODBC Data Sources")
                    .context("Impossible de créer la clé de registre ODBC Data Sources")?;
                Ok(key)
            }
        }
    }

    /**
     * Crée un nouveau DSN utilisateur dans le registre Windows.
     * 
     * @param config - Configuration du DSN à créer
     * @returns Result<()> - Succès ou erreur
     * 
     * Effets de bord :
     * - Crée une nouvelle entrée dans le registre Windows
     * - Ajoute le DSN à la liste des DSN disponibles
     */
    pub fn create_dsn(config: &DsnConfig) -> Result<()> {
        get_logger().log_with_source(LogLevel::Info, "create_dsn appelé avec:".to_string(), Some("DSN".to_string()));
        get_logger().log_with_source(LogLevel::Info, format!("  - Nom: '{}'", config.name), Some("DSN".to_string()));
        get_logger().log_with_source(LogLevel::Info, format!("  - Chemin reçu: '{}'", config.database_path), Some("DSN".to_string()));
        get_logger().log_with_source(LogLevel::Info, format!("  - Driver: '{}'", config.driver), Some("DSN".to_string()));
        
        // Vérifier que le chemin n'est pas vide
        if config.database_path.trim().is_empty() {
            return Err(anyhow::anyhow!("Le chemin de la base de données ne peut pas être vide"));
        }
        
        // Vérifier si le DSN existe déjà
        if Self::dsn_exists(&config.name)? {
            return Err(anyhow::anyhow!("Un DSN avec le nom '{}' existe déjà", config.name));
        }

        let odbc_ini = Self::get_odbc_ini_key()
            .context("Impossible d'accéder à la clé de registre ODBC.INI")?;

        // Créer la clé pour ce DSN
        let (dsn_key, _) = odbc_ini.create_subkey(&config.name)
            .context(format!("Impossible de créer la clé de registre pour le DSN '{}'", config.name))?;
        get_logger().log_with_source(LogLevel::Info, "Clé de registre créée pour le DSN".to_string(), Some("DSN".to_string()));

        // Normaliser le chemin (s'assurer qu'il utilise des backslashes sur Windows)
        let normalized_path = if cfg!(target_os = "windows") {
            config.database_path.replace('/', "\\").trim().to_string()
        } else {
            config.database_path.trim().to_string()
        };
        
        get_logger().log_with_source(LogLevel::Info, format!("Chemin normalisé: '{}'", normalized_path), Some("DSN".to_string()));
        get_logger().log_with_source(LogLevel::Info, format!("Longueur du chemin: {} caractères", normalized_path.len()), Some("DSN".to_string()));

        // Définir les valeurs du DSN
        dsn_key.set_value("Driver", &config.driver)
            .context("Impossible de définir le driver")?;
        get_logger().log_with_source(LogLevel::Info, "Driver écrit dans le registre".to_string(), Some("DSN".to_string()));

        // Pour HFSQL, les paramètres principaux sont "REP" et "RepFic" (Répertoire des fichiers)
        // D'après le registre Windows, HFSQL utilise "REP" pour le répertoire
        // On écrit aussi "Directory" pour compatibilité avec l'interface d'administration
        if config.driver.to_uppercase().contains("HFSQL") {
            // REP est le paramètre principal pour HFSQL
            dsn_key.set_value("REP", &normalized_path)
                .context("Impossible de définir le répertoire des fichiers (REP)")?;
            get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'REP' écrit: {}", normalized_path), Some("DSN".to_string()));
            
            // RepFic est aussi utilisé par certains drivers HFSQL
            dsn_key.set_value("RepFic", &normalized_path)
                .context("Impossible de définir le répertoire des fichiers (RepFic)")?;
            get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'RepFic' écrit: {}", normalized_path), Some("DSN".to_string()));
        }
        
        // Directory pour compatibilité avec l'interface d'administration ODBC
        dsn_key.set_value("Directory", &normalized_path)
            .context("Impossible de définir le répertoire des fichiers (Directory)")?;
        get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'Directory' écrit: {}", normalized_path), Some("DSN".to_string()));
        
        // Pour les fichiers HFSQL/dBASE, on stocke aussi le chemin dans DBQ
        // Le chemin peut être un dossier contenant les fichiers .fic/.mmo/.ndx
        dsn_key.set_value("DBQ", &normalized_path)
            .context("Impossible de définir le chemin de la base de données (DBQ)")?;
        get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'DBQ' écrit: {}", normalized_path), Some("DSN".to_string()));
        
        // Ajouter également Database au cas où certains drivers l'utiliseraient
        dsn_key.set_value("Database", &normalized_path)
            .context("Impossible de définir le nom de la base de données (Database)")?;
        get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'Database' écrit: {}", normalized_path), Some("DSN".to_string()));
        
        // Certains drivers ODBC (comme dBASE Files) utilisent DefaultDir au lieu de DBQ
        dsn_key.set_value("DefaultDir", &normalized_path)
            .context("Impossible de définir le répertoire par défaut (DefaultDir)")?;
        get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'DefaultDir' écrit: {}", normalized_path), Some("DSN".to_string()));

        // Ajouter la description si fournie
        if let Some(desc) = &config.description {
            dsn_key.set_value("Description", desc)
                .context("Impossible de définir la description")?;
        }

        // Ajouter les paramètres additionnels du driver
        for (key, value) in &config.driver_params {
            dsn_key.set_value(key, value)
                .context(format!("Impossible de définir le paramètre '{}'", key))?;
        }

        // Ajouter le DSN à la liste des DSN disponibles
        let data_sources_key = Self::get_odbc_data_sources_key()
            .context("Impossible d'accéder à la liste des DSN")?;
        
        data_sources_key.set_value(&config.name, &config.driver)
            .context("Impossible d'ajouter le DSN à la liste des DSN disponibles")?;

        // Vérifier que les valeurs ont bien été écrites en les relisant
        get_logger().log_with_source(LogLevel::Info, "Vérification des valeurs écrites...".to_string(), Some("DSN".to_string()));
        // Fermer la clé actuelle pour forcer la synchronisation
        drop(dsn_key);
        
        if let Ok(verification_key) = odbc_ini.open_subkey(&config.name) {
            // Pour HFSQL, vérifier REP et RepFic en premier
            if config.driver.to_uppercase().contains("HFSQL") {
                if let Ok(rep_value) = verification_key.get_value::<String, _>("REP") {
                    get_logger().log_with_source(LogLevel::Info, format!("✓ Vérification: 'REP' = '{}'", rep_value), Some("DSN".to_string()));
                } else {
                    get_logger().log_with_source(LogLevel::Error, "✗ ERREUR: 'REP' n'a pas pu être lu après écriture!".to_string(), Some("DSN".to_string()));
                }
                if let Ok(repfic_value) = verification_key.get_value::<String, _>("RepFic") {
                    get_logger().log_with_source(LogLevel::Info, format!("✓ Vérification: 'RepFic' = '{}'", repfic_value), Some("DSN".to_string()));
                } else {
                    get_logger().log_with_source(LogLevel::Error, "✗ ERREUR: 'RepFic' n'a pas pu être lu après écriture!".to_string(), Some("DSN".to_string()));
                }
            }
            
            if let Ok(dir_value) = verification_key.get_value::<String, _>("Directory") {
                get_logger().log_with_source(LogLevel::Info, format!("✓ Vérification: 'Directory' = '{}'", dir_value), Some("DSN".to_string()));
            } else {
                get_logger().log_with_source(LogLevel::Error, "✗ ERREUR: 'Directory' n'a pas pu être lu après écriture!".to_string(), Some("DSN".to_string()));
            }
            if let Ok(dbq_value) = verification_key.get_value::<String, _>("DBQ") {
                get_logger().log_with_source(LogLevel::Info, format!("✓ Vérification: 'DBQ' = '{}'", dbq_value), Some("DSN".to_string()));
            } else {
                get_logger().log_with_source(LogLevel::Error, "✗ ERREUR: 'DBQ' n'a pas pu être lu après écriture!".to_string(), Some("DSN".to_string()));
            }
        } else {
            get_logger().log_with_source(LogLevel::Error, "✗ ERREUR: Impossible de rouvrir la clé du DSN pour vérification!".to_string(), Some("DSN".to_string()));
        }

        Ok(())
    }

    /**
     * Modifie un DSN existant.
     * 
     * @param name - Nom du DSN à modifier
     * @param config - Nouvelle configuration
     * @returns Result<()> - Succès ou erreur
     * 
     * Effets de bord :
     * - Modifie les valeurs dans le registre Windows
     */
    pub fn update_dsn(name: &str, config: &DsnConfig) -> Result<()> {
        if !Self::dsn_exists(name)? {
            return Err(anyhow::anyhow!("Le DSN '{}' n'existe pas", name));
        }

        let odbc_ini = Self::get_odbc_ini_key()
            .context("Impossible d'accéder à la clé de registre ODBC.INI")?;

        let dsn_key = odbc_ini.open_subkey_with_flags(name, KEY_WRITE)
            .context(format!("Impossible d'ouvrir la clé du DSN '{}'", name))?;

        // Mettre à jour les valeurs
        if !config.driver.is_empty() {
            dsn_key.set_value("Driver", &config.driver)
                .context("Impossible de mettre à jour le driver")?;
        }

        // Normaliser le chemin (s'assurer qu'il utilise des backslashes sur Windows)
        let normalized_path = if cfg!(target_os = "windows") {
            config.database_path.replace('/', "\\")
        } else {
            config.database_path.clone()
        };
        
        get_logger().log_with_source(LogLevel::Info, format!("Mise à jour du DSN '{}' avec le chemin: {}", name, normalized_path), Some("DSN".to_string()));
        
        // Mettre à jour le chemin/base de données
        // Pour HFSQL, les paramètres principaux sont "REP" et "RepFic"
        if config.driver.to_uppercase().contains("HFSQL") {
            dsn_key.set_value("REP", &normalized_path)
                .context("Impossible de mettre à jour le répertoire des fichiers (REP)")?;
            get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'REP' mis à jour: {}", normalized_path), Some("DSN".to_string()));
            
            dsn_key.set_value("RepFic", &normalized_path)
                .context("Impossible de mettre à jour le répertoire des fichiers (RepFic)")?;
            get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'RepFic' mis à jour: {}", normalized_path), Some("DSN".to_string()));
        }
        
        // Directory pour compatibilité
        dsn_key.set_value("Directory", &normalized_path)
            .context("Impossible de mettre à jour le répertoire des fichiers (Directory)")?;
        get_logger().log_with_source(LogLevel::Info, format!("✓ Paramètre 'Directory' mis à jour: {}", normalized_path), Some("DSN".to_string()));
        
        // Écrire dans plusieurs clés pour assurer la compatibilité avec différents drivers
        dsn_key.set_value("DBQ", &normalized_path)
            .context("Impossible de mettre à jour le chemin DBQ")?;
        
        dsn_key.set_value("Database", &normalized_path)
            .context("Impossible de mettre à jour la base de données")?;
        
        // Certains drivers ODBC (comme dBASE Files) utilisent DefaultDir
        dsn_key.set_value("DefaultDir", &normalized_path)
            .context("Impossible de mettre à jour le répertoire par défaut")?;

        if let Some(desc) = &config.description {
            dsn_key.set_value("Description", desc)?;
        } else {
            let _ = dsn_key.delete_value("Description");
        }

        // Mettre à jour les paramètres additionnels
        for (key, value) in &config.driver_params {
            dsn_key.set_value(key, value)?;
        }

        // Mettre à jour la liste des DSN si le driver a changé
        if !config.driver.is_empty() {
            let data_sources_key = Self::get_odbc_data_sources_key()?;
            data_sources_key.set_value(name, &config.driver)?;
        }

        Ok(())
    }

    /**
     * Supprime un DSN utilisateur.
     * 
     * @param name - Nom du DSN à supprimer
     * @returns Result<()> - Succès ou erreur
     * 
     * Effets de bord :
     * - Supprime l'entrée du registre Windows
     * - Retire le DSN de la liste des DSN disponibles
     */
    pub fn delete_dsn(name: &str) -> Result<()> {
        let odbc_ini = Self::get_odbc_ini_key()
            .context("Impossible d'accéder à la clé de registre ODBC.INI")?;

        // Supprimer la clé du DSN
        odbc_ini.delete_subkey(name)
            .context(format!("Impossible de supprimer le DSN '{}'", name))?;

        // Retirer de la liste des DSN
        let data_sources_key = Self::get_odbc_data_sources_key()?;
        let _ = data_sources_key.delete_value(name);

        Ok(())
    }

    /**
     * Vérifie si un DSN existe.
     * 
     * @param name - Nom du DSN
     * @returns Result<bool> - True si le DSN existe, false sinon
     */
    pub fn dsn_exists(name: &str) -> Result<bool> {
        let odbc_ini = Self::get_odbc_ini_key()
            .context("Impossible d'accéder à la clé de registre ODBC.INI")?;
        
        match odbc_ini.open_subkey(name) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /**
     * Liste tous les DSN utilisateur disponibles.
     * 
     * @returns Result<Vec<DsnInfo>> - Liste des DSN ou erreur
     */
    pub fn list_dsns() -> Result<Vec<DsnInfo>> {
        // Utiliser catch_unwind pour capturer les panics potentielles
        let result = std::panic::catch_unwind(|| {
            let data_sources_key = match Self::get_odbc_data_sources_key() {
                Ok(key) => key,
                Err(e) => {
                    get_logger().log_with_source(LogLevel::Error, format!("Impossible d'accéder à la liste des DSN: {}", e), Some("DSN".to_string()));
                    return Ok::<Vec<DsnInfo>, anyhow::Error>(Vec::new());
                }
            };

            let odbc_ini = match Self::get_odbc_ini_key() {
                Ok(key) => key,
                Err(e) => {
                    get_logger().log_with_source(LogLevel::Error, format!("Impossible d'accéder à la clé de registre ODBC.INI: {}", e), Some("DSN".to_string()));
                    return Ok::<Vec<DsnInfo>, anyhow::Error>(Vec::new());
                }
            };

            let mut dsns = Vec::new();

            // Parcourir tous les DSN dans la liste
            // Gérer les erreurs individuellement pour éviter les panics
            // Utiliser catch_unwind pour chaque itération pour être ultra-défensif
            for result in data_sources_key.enum_values() {
                let (dsn_name, _) = match result {
                    Ok(val) => val,
                    Err(e) => {
                        // Ignorer les erreurs d'énumération individuelles
                        get_logger().log_with_source(LogLevel::Warn, format!("Avertissement: Erreur lors de la lecture d'une valeur DSN: {}", e), Some("DSN".to_string()));
                        continue;
                    }
                };
                
                // Ignorer les valeurs système
                if dsn_name == "DefaultDSNDirectory" {
                    continue;
                }

                // Récupérer la valeur du driver directement comme String
                let driver_name = data_sources_key.get_value::<String, _>(&dsn_name)
                    .ok();

                let mut info = DsnInfo {
                    name: dsn_name.clone(),
                    description: None,
                    driver: driver_name,
                    database_path: None,
                };

                // Essayer d'ouvrir la clé du DSN pour obtenir plus d'informations
                if let Ok(dsn_key) = odbc_ini.open_subkey(&dsn_name) {
                    if let Ok(desc) = dsn_key.get_value::<String, _>("Description") {
                        info.description = Some(desc);
                    }
                    
                    // Essayer de récupérer le chemin/base de données
                    if let Ok(dbq) = dsn_key.get_value::<String, _>("DBQ") {
                        info.database_path = Some(dbq);
                    } else if let Ok(db) = dsn_key.get_value::<String, _>("Database") {
                        info.database_path = Some(db);
                    }
                }

                dsns.push(info);
            }

            Ok::<Vec<DsnInfo>, anyhow::Error>(dsns)
        });

        match result {
            Ok(Ok(dsns)) => Ok(dsns),
            Ok(Err(e)) => Err(e),
            Err(_) => {
                // Une panique s'est produite
                get_logger().log_with_source(LogLevel::Error, "Erreur: Panic lors de l'énumération des DSN. Le registre Windows pourrait être corrompu.".to_string(), Some("DSN".to_string()));
                // Retourner une liste vide plutôt que de paniquer
                Ok(Vec::new())
            }
        }
    }

    /**
     * Récupère les informations d'un DSN spécifique.
     * 
     * @param name - Nom du DSN
     * @returns Result<DsnInfo> - Informations du DSN ou erreur
     */
    pub fn get_dsn(name: &str) -> Result<DsnInfo> {
        let odbc_ini = Self::get_odbc_ini_key()
            .context("Impossible d'accéder à la clé de registre ODBC.INI")?;

        let dsn_key = odbc_ini.open_subkey(name)
            .context(format!("Le DSN '{}' n'existe pas", name))?;

        let data_sources_key = Self::get_odbc_data_sources_key()?;
        let driver = data_sources_key.get_value::<String, _>(name)
            .ok();

        let description = dsn_key.get_value::<String, _>("Description")
            .ok();

        // Essayer plusieurs paramètres pour trouver le chemin
        // Pour HFSQL, vérifier d'abord REP et RepFic
        let database_path = dsn_key.get_value::<String, _>("REP")
            .or_else(|_| dsn_key.get_value::<String, _>("RepFic"))
            .or_else(|_| dsn_key.get_value::<String, _>("Directory"))
            .or_else(|_| dsn_key.get_value::<String, _>("DBQ"))
            .or_else(|_| dsn_key.get_value::<String, _>("Database"))
            .or_else(|_| dsn_key.get_value::<String, _>("DefaultDir"))
            .ok();
        
        // Debug: lister tous les paramètres du DSN
        get_logger().log_with_source(LogLevel::Info, format!("Paramètres du DSN '{}':", name), Some("DSN".to_string()));
        for result in dsn_key.enum_values() {
            if let Ok((param_name, _)) = result {
                if let Ok(value) = dsn_key.get_value::<String, _>(&param_name) {
                    get_logger().log_with_source(LogLevel::Info, format!("  {} = {}", param_name, value), Some("DSN".to_string()));
                }
            }
        }

        Ok(DsnInfo {
            name: name.to_string(),
            description,
            driver,
            database_path,
        })
    }
}

#[cfg(not(target_os = "windows"))]
use ini::Ini;
#[cfg(not(target_os = "windows"))]
use std::path::PathBuf;

#[cfg(not(target_os = "windows"))]
pub struct DsnManager;

#[cfg(not(target_os = "windows"))]
impl DsnManager {
    /// Obtient le chemin vers le fichier .odbc.ini de l'utilisateur
    fn get_odbc_ini_path() -> Result<PathBuf> {
        let home = std::env::var("HOME")
            .context("La variable d'environnement HOME n'est pas définie")?;
        Ok(PathBuf::from(home).join(".odbc.ini"))
    }

    /// Charge le fichier .odbc.ini, le crée s'il n'existe pas
    fn load_odbc_ini() -> Result<Ini> {
        let path = Self::get_odbc_ini_path()?;
        if path.exists() {
            Ini::load_from_file(&path)
                .context(format!("Impossible de charger le fichier .odbc.ini: {:?}", path))
        } else {
            // Créer un fichier INI vide avec la section [ODBC Data Sources]
            let mut ini = Ini::new();
            ini.with_section(Some("ODBC Data Sources".to_string()));
            Ok(ini)
        }
    }

    /// Sauvegarde le fichier .odbc.ini
    fn save_odbc_ini(ini: &Ini) -> Result<()> {
        let path = Self::get_odbc_ini_path()?;
        // Créer le répertoire parent s'il n'existe pas
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .context(format!("Impossible de créer le répertoire: {:?}", parent))?;
        }
        ini.write_to_file(&path)
            .context(format!("Impossible d'écrire le fichier .odbc.ini: {:?}", path))?;
        Ok(())
    }

    /**
     * Crée un nouveau DSN utilisateur dans le fichier .odbc.ini.
     * 
     * @param config - Configuration du DSN à créer
     * @returns Result<()> - Succès ou erreur
     */
    pub fn create_dsn(config: &DsnConfig) -> Result<()> {
        // Vérifier si le DSN existe déjà
        if Self::dsn_exists(&config.name)? {
            return Err(anyhow::anyhow!("Un DSN avec le nom '{}' existe déjà", config.name));
        }

        let mut ini = Self::load_odbc_ini()?;

        // Ajouter le DSN à la section [ODBC Data Sources]
        ini.with_section(Some("ODBC Data Sources".to_string()))
            .set(&config.name, &config.driver);

        // Créer la section pour ce DSN
        let section = ini.with_section(Some(config.name.clone()));
        section.set("Driver", &config.driver);
        section.set("Database", &config.database_path);
        
        // Ajouter DBQ pour compatibilité
        section.set("DBQ", &config.database_path);

        // Ajouter la description si fournie
        if let Some(desc) = &config.description {
            section.set("Description", desc);
        }

        // Ajouter les paramètres additionnels du driver
        for (key, value) in &config.driver_params {
            section.set(key, value);
        }

        Self::save_odbc_ini(&ini)?;
        Ok(())
    }

    /**
     * Modifie un DSN existant.
     * 
     * @param name - Nom du DSN à modifier
     * @param config - Nouvelle configuration
     * @returns Result<()> - Succès ou erreur
     */
    pub fn update_dsn(name: &str, config: &DsnConfig) -> Result<()> {
        if !Self::dsn_exists(name)? {
            return Err(anyhow::anyhow!("Le DSN '{}' n'existe pas", name));
        }

        let mut ini = Self::load_odbc_ini()?;

        // Mettre à jour la section [ODBC Data Sources] si le driver a changé
        if !config.driver.is_empty() {
            ini.with_section(Some("ODBC Data Sources".to_string()))
                .set(name, &config.driver);
        }

        // Mettre à jour la section du DSN
        let section = ini.with_section(Some(name.to_string()));
        
        if !config.driver.is_empty() {
            section.set("Driver", &config.driver);
        }

        if !config.database_path.is_empty() {
            section.set("Database", &config.database_path);
            section.set("DBQ", &config.database_path);
        }

        if let Some(desc) = &config.description {
            section.set("Description", desc);
        } else {
            section.delete("Description");
        }

        // Mettre à jour les paramètres additionnels
        for (key, value) in &config.driver_params {
            section.set(key, value);
        }

        Self::save_odbc_ini(&ini)?;
        Ok(())
    }

    /**
     * Supprime un DSN utilisateur.
     * 
     * @param name - Nom du DSN à supprimer
     * @returns Result<()> - Succès ou erreur
     */
    pub fn delete_dsn(name: &str) -> Result<()> {
        let mut ini = Self::load_odbc_ini()?;

        // Retirer de la section [ODBC Data Sources]
        ini.with_section(Some("ODBC Data Sources".to_string()))
            .delete(name);

        // Supprimer la section du DSN
        ini.delete(Some(name.to_string()));

        Self::save_odbc_ini(&ini)?;
        Ok(())
    }

    /**
     * Vérifie si un DSN existe.
     * 
     * @param name - Nom du DSN
     * @returns Result<bool> - True si le DSN existe, false sinon
     */
    pub fn dsn_exists(name: &str) -> Result<bool> {
        let ini = Self::load_odbc_ini()?;
        Ok(ini.section(Some(name.to_string())).is_some())
    }

    /**
     * Liste tous les DSN utilisateur disponibles.
     * 
     * @returns Result<Vec<DsnInfo>> - Liste des DSN ou erreur
     */
    pub fn list_dsns() -> Result<Vec<DsnInfo>> {
        let ini = Self::load_odbc_ini()?;
        let mut dsns = Vec::new();

        // Parcourir la section [ODBC Data Sources]
        if let Some(data_sources) = ini.section(Some("ODBC Data Sources".to_string())) {
            for (dsn_name, driver_name) in data_sources.iter() {
                // Ignorer les valeurs système
                if dsn_name == "DefaultDSNDirectory" {
                    continue;
                }

                let mut info = DsnInfo {
                    name: dsn_name.clone(),
                    description: None,
                    driver: Some(driver_name.clone()),
                    database_path: None,
                };

                // Récupérer les informations détaillées du DSN
                if let Some(dsn_section) = ini.section(Some(dsn_name.clone())) {
                    if let Some(desc) = dsn_section.get("Description") {
                        info.description = Some(desc.clone());
                    }
                    
                    // Récupérer le chemin/base de données
                    if let Some(dbq) = dsn_section.get("DBQ") {
                        info.database_path = Some(dbq.clone());
                    } else if let Some(db) = dsn_section.get("Database") {
                        info.database_path = Some(db.clone());
                    }
                }

                dsns.push(info);
            }
        }

        Ok(dsns)
    }

    /**
     * Récupère les informations d'un DSN spécifique.
     * 
     * @param name - Nom du DSN
     * @returns Result<DsnInfo> - Informations du DSN ou erreur
     */
    pub fn get_dsn(name: &str) -> Result<DsnInfo> {
        let ini = Self::load_odbc_ini()?;

        // Récupérer le driver depuis [ODBC Data Sources]
        let driver = ini.section(Some("ODBC Data Sources".to_string()))
            .and_then(|s| s.get(name))
            .map(|s| s.clone());

        // Récupérer les informations détaillées
        let dsn_section = ini.section(Some(name.to_string()))
            .ok_or_else(|| anyhow::anyhow!("Le DSN '{}' n'existe pas", name))?;

        let description = dsn_section.get("Description").map(|s| s.clone());
        
        let database_path = dsn_section.get("DBQ")
            .or_else(|| dsn_section.get("Database"))
            .map(|s| s.clone());

        Ok(DsnInfo {
            name: name.to_string(),
            description,
            driver,
            database_path,
        })
    }
}

