/**
 * Handlers HTTP pour l'API REST de FIC Engine.
 * 
 * Ce fichier contient tous les handlers HTTP qui traitent les requêtes
 * REST entrantes. Chaque handler correspond à un endpoint spécifique :
 * 
 * - health : Vérification de santé du serveur
 * - activity : Historique d'activité (bases de données et DSN)
 * 
 * Liens avec d'autres modules :
 * - Les endpoints SQL et ODBC sont gérés par src/sql/server.rs
 */

use crate::api::server::AppState;
use crate::logger::{get_logger, LogLevel};
use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Réponse de vérification de santé du serveur
#[derive(Serialize)]
pub struct HealthResponse {
    /// Statut du serveur (toujours "ok" si le serveur répond)
    pub status: String,
    /// Version de l'application
    pub version: String,
}

/// Paramètres de requête pour l'historique d'activité
#[derive(Deserialize)]
pub struct ActivityQuery {
    /// Nombre maximum d'entrées à retourner pour les bases
    #[serde(default = "default_db_limit")]
    pub db_limit: usize,
    /// Nombre maximum d'entrées à retourner pour les activités DSN
    #[serde(default = "default_dsn_limit")]
    pub dsn_limit: usize,
}

fn default_db_limit() -> usize {
    10
}

fn default_dsn_limit() -> usize {
    20
}

/// Réponse avec l'historique d'activité
#[derive(Serialize)]
pub struct ActivityResponse {
    /// Liste des dernières bases de données consultées
    pub recent_databases: Vec<DatabaseAccessResponse>,
    /// Historique des activités DSN
    pub dsn_activities: Vec<DsnActivityResponse>,
}

/// Réponse pour un accès à une base de données
#[derive(Serialize)]
pub struct DatabaseAccessResponse {
    /// Chemin du dossier de la base de données
    pub path: String,
    /// Nom de la base
    pub name: String,
    /// Timestamp Unix du dernier accès
    pub last_accessed: u64,
    /// Date lisible du dernier accès
    pub last_accessed_formatted: String,
    /// Nombre de tables détectées
    pub table_count: usize,
    /// Nombre total d'accès
    pub access_count: usize,
}

/// Réponse pour une activité DSN
#[derive(Serialize)]
pub struct DsnActivityResponse {
    /// Nom du DSN
    pub dsn_name: String,
    /// Type d'activité
    pub activity_type: String,
    /// Timestamp Unix de l'activité
    pub timestamp: u64,
    /// Date lisible de l'activité
    pub timestamp_formatted: String,
    /// Informations additionnelles
    pub details: HashMap<String, String>,
}

/**
 * Handler GET /health - Vérification de santé du serveur.
 * 
 * Retourne le statut du serveur et la version de l'application.
 * Utilisé pour vérifier que le serveur est opérationnel.
 * 
 * @returns Json<HealthResponse> - Réponse avec statut et version
 * 
 * Effets de bord : Aucun
 */
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/**
 * Handler GET /activity - Récupère l'historique d'activité.
 * 
 * Retourne les dernières bases de données consultées et l'historique
 * des activités liées aux DSN.
 * 
 * @param state - État de l'application (injecté par Axum)
 * @param query - Paramètres de requête (limites)
 * @returns Json<ActivityResponse> - Historique d'activité
 * 
 * Effets de bord : Aucun
 */
pub async fn get_activity(
    State(state): State<AppState>,
    Query(query): Query<ActivityQuery>,
) -> Json<ActivityResponse> {
    let recent_databases = state.tracker
        .get_recent_databases(query.db_limit)
        .into_iter()
        .map(|db| DatabaseAccessResponse {
            path: db.path,
            name: db.name,
            last_accessed: db.last_accessed,
            last_accessed_formatted: format_timestamp(db.last_accessed),
            table_count: db.table_count,
            access_count: db.access_count,
        })
        .collect();

    let dsn_activities = state.tracker
        .get_dsn_activities(query.dsn_limit)
        .into_iter()
        .map(|activity| DsnActivityResponse {
            dsn_name: activity.dsn_name,
            activity_type: format!("{:?}", activity.activity_type),
            timestamp: activity.timestamp,
            timestamp_formatted: format_timestamp(activity.timestamp),
            details: activity.details,
        })
        .collect();

    Json(ActivityResponse {
        recent_databases,
        dsn_activities,
    })
}

/// Formate un timestamp Unix en date lisible
/// Le frontend formatera mieux avec JavaScript, on retourne juste le timestamp pour l'instant
fn format_timestamp(timestamp: u64) -> String {
    // Le frontend formatera la date avec JavaScript
    // Pour l'instant, retournons une chaîne simple
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let diff = if now > timestamp { now - timestamp } else { 0 };
    
    if diff < 60 {
        "À l'instant".to_string()
    } else if diff < 3600 {
        format!("Il y a {} min", diff / 60)
    } else if diff < 86400 {
        format!("Il y a {} h", diff / 3600)
    } else if diff < 2592000 {
        format!("Il y a {} jours", diff / 86400)
    } else {
        // Pour les dates anciennes, on formate simplement
        format!("Timestamp: {}", timestamp)
    }
}

/// Paramètres de requête pour les logs
#[derive(Deserialize)]
pub struct LogsQuery {
    /// Niveau de log à filtrer (optionnel)
    pub level: Option<String>,
    /// Nombre maximum de logs à retourner
    #[serde(default = "default_log_limit")]
    pub limit: usize,
}

fn default_log_limit() -> usize {
    1000
}

/// Réponse avec les logs
#[derive(Serialize)]
pub struct LogsResponse {
    /// Liste des logs
    pub logs: Vec<LogEntryResponse>,
    /// Nombre total de logs
    pub total: usize,
}

/// Réponse pour une entrée de log
#[derive(Serialize)]
pub struct LogEntryResponse {
    /// ID unique du log
    pub id: String,
    /// Timestamp Unix en millisecondes
    pub timestamp: u64,
    /// Niveau de log
    pub level: String,
    /// Message du log
    pub message: String,
    /// Source du log (module)
    pub source: Option<String>,
    /// Détails additionnels
    pub details: Option<serde_json::Value>,
}

/**
 * Handler GET /logs - Récupère les logs de l'application.
 * 
 * Retourne tous les logs collectés par le système de logging,
 * avec possibilité de filtrer par niveau.
 * 
 * @param query - Paramètres de requête (niveau, limite)
 * @returns Json<LogsResponse> - Liste des logs
 * 
 * Effets de bord : Aucun
 */
pub async fn get_logs(Query(query): Query<LogsQuery>) -> Json<LogsResponse> {
    let logger = get_logger();
    
    // Convertir le niveau de log depuis la chaîne
    let level_filter = if let Some(level_str) = &query.level {
        match level_str.as_str() {
            "info" => Some(LogLevel::Info),
            "warn" => Some(LogLevel::Warn),
            "error" => Some(LogLevel::Error),
            "debug" => Some(LogLevel::Debug),
            _ => None,
        }
    } else {
        None
    };
    
    let logs = if let Some(level) = level_filter {
        logger.get_logs_by_level(Some(level))
    } else {
        logger.get_logs()
    };
    
    let total = logger.count();
    
    // Limiter le nombre de logs retournés
    let logs: Vec<LogEntryResponse> = logs
        .iter()
        .rev() // Les plus récents en premier
        .take(query.limit)
        .map(|log| {
            let timestamp_ms = log.timestamp
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
            
            LogEntryResponse {
                id: log.id.clone(),
                timestamp: timestamp_ms,
                level: log.level.as_str().to_string(),
                message: log.message.clone(),
                source: log.source.clone(),
                details: log.details.clone(),
            }
        })
        .collect();
    
    Json(LogsResponse {
        logs,
        total,
    })
}

/// Requête pour scanner un dossier et lister les fichiers .fic
#[derive(Deserialize)]
pub struct ScanDirectoryRequest {
    /// Chemin du dossier à scanner
    pub path: String,
}

/// Réponse avec la liste des tables trouvées
#[derive(Serialize)]
pub struct ScanDirectoryResponse {
    /// Succès de l'opération
    pub success: bool,
    /// Liste des noms de tables (noms de fichiers .fic sans extension)
    pub tables: Vec<String>,
    /// Message d'erreur éventuel
    pub error: Option<String>,
}

/**
 * Handler POST /scan - Scanne un dossier et liste les fichiers .fic.
 * 
 * Parcourt le dossier spécifié, détecte tous les fichiers .fic
 * (insensible à la casse) et retourne la liste des noms de tables.
 * 
 * @param request - Requête contenant le chemin du dossier
 * @returns Json<ScanDirectoryResponse> - Liste des tables trouvées
 * 
 * Effets de bord :
 * - Lit le contenu du dossier spécifié
 */
pub async fn scan_directory(
    Json(request): Json<ScanDirectoryRequest>,
) -> Json<ScanDirectoryResponse> {
    use std::fs;
    use std::path::Path;
    
    let path = Path::new(&request.path);
    
    if !path.exists() {
        return Json(ScanDirectoryResponse {
            success: false,
            tables: Vec::new(),
            error: Some(format!("Le dossier n'existe pas: {}", request.path)),
        });
    }
    
    if !path.is_dir() {
        return Json(ScanDirectoryResponse {
            success: false,
            tables: Vec::new(),
            error: Some(format!("Le chemin n'est pas un dossier: {}", request.path)),
        });
    }
    
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) => {
            get_logger().log_with_source(
                LogLevel::Error,
                format!("Erreur lors de la lecture du dossier {}: {}", request.path, e),
                Some("API".to_string()),
            );
            return Json(ScanDirectoryResponse {
                success: false,
                tables: Vec::new(),
                error: Some(format!("Impossible de lire le dossier: {}", e)),
            });
        }
    };
    
    let mut tables = Vec::new();
    
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                get_logger().log_with_source(
                    LogLevel::Warn,
                    format!("Erreur lors de la lecture d'une entrée: {}", e),
                    Some("API".to_string()),
                );
                continue;
            }
        };
        
        let file_path = entry.path();
        
        // Vérifier l'extension (insensible à la casse)
        if let Some(ext) = file_path.extension() {
            let ext_lower = ext.to_string_lossy().to_lowercase();
            if ext_lower == "fic" {
                if let Some(name) = file_path.file_stem() {
                    let table_name = name.to_string_lossy().to_string();
                    tables.push(table_name);
                }
            }
        }
    }
    
    tables.sort();
    
    get_logger().log_with_source(
        LogLevel::Info,
        format!("Scanné le dossier {}: {} fichier(s) .fic trouvé(s)", request.path, tables.len()),
        Some("API".to_string()),
    );
    
    Json(ScanDirectoryResponse {
        success: true,
        tables,
        error: None,
    })
}

/// Requête pour tester une connexion de base de données
#[derive(Deserialize)]
pub struct TestConnectionRequest {
    /// Type de base de données
    pub db_type: String,
    /// Chaîne de connexion ou DSN
    pub connection_string: String,
    /// Paramètres additionnels
    pub params: Option<HashMap<String, String>>,
}

/// Réponse de test de connexion
#[derive(Serialize)]
pub struct TestConnectionResponse {
    /// Succès de la connexion
    pub success: bool,
    /// Message d'erreur éventuel
    pub error: Option<String>,
}

/**
 * Handler POST /migration/test - Teste une connexion à une base de données.
 */
pub async fn test_migration_connection(
    State(state): State<AppState>,
    Json(request): Json<TestConnectionRequest>,
) -> Json<TestConnectionResponse> {
    use crate::migration::types::{DatabaseConnection, DatabaseType};
    use crate::migration::Migrator;
    
    let db_type = match request.db_type.to_lowercase().as_str() {
        "postgresql" | "postgres" => DatabaseType::Postgresql,
        "mysql" | "mariadb" => DatabaseType::Mysql,
        "sqlite" => DatabaseType::Sqlite,
        "sqlserver" | "mssql" => DatabaseType::SqlServer,
        "oracle" => DatabaseType::Oracle,
        "odbc" => DatabaseType::Odbc,
        _ => {
            return Json(TestConnectionResponse {
                success: false,
                error: Some(format!("Type de base de données non supporté: {}", request.db_type)),
            });
        }
    };

    let connection = DatabaseConnection {
        db_type,
        connection_string: request.connection_string,
        params: request.params,
    };

    match Migrator::new(
        state.engine.clone(),
        connection,
        crate::migration::types::MigrationOptions::default(),
    ) {
        Ok(migrator) => {
            match migrator.test_connection() {
                Ok(_) => Json(TestConnectionResponse {
                    success: true,
                    error: None,
                }),
                Err(e) => Json(TestConnectionResponse {
                    success: false,
                    error: Some(format!("Erreur de connexion: {}", e)),
                }),
            }
        }
        Err(e) => Json(TestConnectionResponse {
            success: false,
            error: Some(format!("Erreur lors de la création du connecteur: {}", e)),
        }),
    }
}

/// Requête pour démarrer une migration
#[derive(Deserialize)]
pub struct StartMigrationRequest {
    /// Type de base de données
    pub db_type: String,
    /// Chaîne de connexion ou DSN
    pub connection_string: String,
    /// Paramètres additionnels
    pub params: Option<HashMap<String, String>>,
    /// Options de migration
    pub options: Option<crate::migration::types::MigrationOptions>,
}

/// Réponse de démarrage de migration
#[derive(Serialize)]
pub struct StartMigrationResponse {
    /// Succès de l'opération
    pub success: bool,
    /// ID de la migration (pour suivre la progression)
    pub migration_id: Option<String>,
    /// Message d'erreur éventuel
    pub error: Option<String>,
}

/**
 * Handler POST /migration/start - Démarre une migration.
 */
pub async fn start_migration(
    State(state): State<AppState>,
    Json(request): Json<StartMigrationRequest>,
) -> Json<StartMigrationResponse> {
    use crate::migration::types::{DatabaseConnection, DatabaseType};
    use crate::migration::Migrator;
    use std::sync::Mutex;
    use once_cell::sync::Lazy;
    
    // Stocker les migrations en cours (en production, utiliser une vraie base de données)
    static MIGRATIONS: Lazy<Mutex<HashMap<String, std::sync::Arc<Mutex<Option<crate::migration::types::MigrationResult>>>>>> = 
        Lazy::new(|| Mutex::new(HashMap::new()));

    let db_type = match request.db_type.to_lowercase().as_str() {
        "postgresql" | "postgres" => DatabaseType::Postgresql,
        "mysql" | "mariadb" => DatabaseType::Mysql,
        "sqlite" => DatabaseType::Sqlite,
        "sqlserver" | "mssql" => DatabaseType::SqlServer,
        "oracle" => DatabaseType::Oracle,
        "odbc" => DatabaseType::Odbc,
        _ => {
            return Json(StartMigrationResponse {
                success: false,
                migration_id: None,
                error: Some(format!("Type de base de données non supporté: {}", request.db_type)),
            });
        }
    };

    let connection = DatabaseConnection {
        db_type,
        connection_string: request.connection_string,
        params: request.params,
    };

    let options = request.options.unwrap_or_default();

    let migration_id = format!("migration_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis());

    // Démarrer la migration dans un thread séparé
    let engine_clone = state.engine.clone();
    let migration_id_clone = migration_id.clone();
    
    tokio::spawn(async move {
        let connection_clone = connection.clone();
        match Migrator::new(engine_clone, connection_clone, options) {
            Ok(mut migrator) => {
                let result = migrator.migrate();
                let mut migrations = MIGRATIONS.lock().unwrap();
                if let Some(migration_result) = migrations.get_mut(&migration_id_clone) {
                    *migration_result.lock().unwrap() = result.ok();
                }
            }
            Err(e) => {
                let mut migrations = MIGRATIONS.lock().unwrap();
                if let Some(migration_result) = migrations.get_mut(&migration_id_clone) {
                    *migration_result.lock().unwrap() = Some(crate::migration::types::MigrationResult {
                        status: crate::migration::types::MigrationStatus::Failed,
                        tables_migrated: 0,
                        records_migrated: 0,
                        duration_ms: 0,
                        error: Some(format!("Erreur: {}", e)),
                        table_details: Vec::new(),
                    });
                }
            }
        }
    });

    // Enregistrer la migration
    {
        let mut migrations = MIGRATIONS.lock().unwrap();
        migrations.insert(migration_id.clone(), std::sync::Arc::new(Mutex::new(None)));
    }

    Json(StartMigrationResponse {
        success: true,
        migration_id: Some(migration_id),
        error: None,
    })
}

/**
 * Handler GET /migration/status/:id - Récupère le statut d'une migration.
 */
pub async fn get_migration_status(
    Path(migration_id): Path<String>,
) -> Json<Option<crate::migration::types::MigrationResult>> {
    use std::sync::Mutex;
    use once_cell::sync::Lazy;
    
    static MIGRATIONS: Lazy<Mutex<HashMap<String, std::sync::Arc<Mutex<Option<crate::migration::types::MigrationResult>>>>>> = 
        Lazy::new(|| Mutex::new(HashMap::new()));

    let migrations = MIGRATIONS.lock().unwrap();
    if let Some(migration) = migrations.get(&migration_id) {
        let result = migration.lock().unwrap();
        Json(result.clone())
    } else {
        Json(None)
    }
}
