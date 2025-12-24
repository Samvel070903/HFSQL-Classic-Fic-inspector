/**
 * Handlers HTTP pour les endpoints SQL.
 * 
 * Ce fichier contient les handlers HTTP pour exécuter des requêtes SQL
 * via l'API REST. Il supporte à la fois l'exécution sur le moteur FIC
 * et via ODBC pour interroger d'autres bases de données.
 * 
 * Endpoints :
 * - POST /sql : Exécute une requête SQL
 * - POST /odbc/tables : Liste les tables d'une source ODBC
 * - POST /odbc/relations : Liste les relations d'une source ODBC
 * 
 * Liens avec d'autres modules :
 * - Utilise src/sql/parser.rs et src/sql/executor.rs pour les requêtes FIC
 * - Utilise src/sql/odbc.rs pour les requêtes ODBC
 * - Utilise src/storage/StorageEngine pour accéder aux données FIC
 */

use crate::api::server::AppState;
use crate::logger::{get_logger, LogLevel};
use crate::sql::{SqlExecutor, SqlParser};
use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};

/// Requête SQL reçue via l'API HTTP
#[derive(Deserialize)]
pub struct SqlRequest {
    /// Requête SQL à exécuter
    pub sql: String,
    /// DSN ODBC optionnel (si fourni, utilise ODBC au lieu du moteur FIC)
    #[serde(default)]
    pub dsn: Option<String>,
}

/// Réponse standardisée pour les requêtes SQL
#[derive(Serialize)]
pub struct SqlResponse {
    /// Indique si l'exécution a réussi
    pub success: bool,
    /// Données retournées (pour SELECT) ou métadonnées (pour INSERT/UPDATE/DELETE)
    pub data: Option<serde_json::Value>,
    /// Message d'erreur si l'exécution a échoué
    pub error: Option<String>,
    /// Nombre de lignes affectées (pour INSERT/UPDATE/DELETE)
    pub rows_affected: Option<usize>,
}

/**
 * Handler POST /sql - Exécute une requête SQL.
 * 
 * Parse et exécute une requête SQL. Si un DSN ODBC est fourni,
 * utilise ODBC, sinon utilise le moteur FIC.
 * 
 * @param state - État de l'application (injecté par Axum)
 * @param request - Requête SQL avec optionnellement un DSN ODBC
 * @returns Result<Json<SqlResponse>> - Résultat de l'exécution ou erreur HTTP
 * 
 * Effets de bord :
 * - Peut lire/écrire des données selon la requête SQL
 * - Peut se connecter à une base de données ODBC
 */
pub async fn execute_sql(
    State(state): State<AppState>,
    Json(request): Json<SqlRequest>,
) -> Result<Json<SqlResponse>, (StatusCode, Json<SqlResponse>)> {
    // Si un DSN est spécifié, utiliser ODBC
    if let Some(dsn) = &request.dsn {
        return execute_sql_odbc(dsn, &request.sql).await;
    }

    // Sinon, utiliser le moteur FIC
    let executor = SqlExecutor::new(state.engine.clone());
    
    match SqlParser::parse(&request.sql) {
        Ok(statement) => {
            match executor.execute(&statement) {
                Ok(result) => {
                    match result {
                        crate::sql::executor::SqlResult::Select { columns, rows } => {
                            let data: Vec<serde_json::Value> = rows
                                .into_iter()
                                .map(|record| {
                                    let mut row = serde_json::Map::new();
                                    row.insert("id".to_string(), serde_json::Value::Number(record.id.into()));
                                    for (key, value) in record.fields {
                                        row.insert(key, serde_json::to_value(value).unwrap_or(serde_json::Value::Null));
                                    }
                                    serde_json::Value::Object(row)
                                })
                                .collect();
                            
                            let mut response = serde_json::Map::new();
                            response.insert("columns".to_string(), serde_json::to_value(columns).unwrap());
                            response.insert("rows".to_string(), serde_json::Value::Array(data));
                            
                            Ok(Json(SqlResponse {
                                success: true,
                                data: Some(serde_json::Value::Object(response)),
                                error: None,
                                rows_affected: None,
                            }))
                        }
                        crate::sql::executor::SqlResult::Insert { id } => {
                            Ok(Json(SqlResponse {
                                success: true,
                                data: Some(serde_json::json!({ "id": id })),
                                error: None,
                                rows_affected: Some(1),
                            }))
                        }
                        crate::sql::executor::SqlResult::Update { count } => {
                            Ok(Json(SqlResponse {
                                success: true,
                                data: None,
                                error: None,
                                rows_affected: Some(count),
                            }))
                        }
                        crate::sql::executor::SqlResult::Delete { count } => {
                            Ok(Json(SqlResponse {
                                success: true,
                                data: None,
                                error: None,
                                rows_affected: Some(count),
                            }))
                        }
                    }
                }
                Err(e) => {
                    Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(SqlResponse {
                            success: false,
                            data: None,
                            error: Some(e.to_string()),
                            rows_affected: None,
                        }),
                    ))
                }
            }
        }
        Err(e) => {
            Err((
                StatusCode::BAD_REQUEST,
                Json(SqlResponse {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                    rows_affected: None,
                }),
            ))
        }
    }
}

/**
 * Exécute une requête SQL via ODBC.
 * 
 * Se connecte à une source de données ODBC et exécute la requête SQL.
 * Utilise spawn_blocking car ODBC nécessite un contexte synchrone.
 * 
 * @param dsn - Nom du DSN ODBC
 * @param sql - Requête SQL à exécuter
 * @returns Result<Json<SqlResponse>> - Résultat de l'exécution ou erreur HTTP
 * 
 * Effets de bord :
 * - Se connecte à la base de données ODBC
 * - Exécute la requête SQL sur la base de données distante
 */
async fn execute_sql_odbc(
    dsn: &str,
    sql: &str,
) -> Result<Json<SqlResponse>, (StatusCode, Json<SqlResponse>)> {
    // Convertir les références en String pour le move dans spawn_blocking
    let dsn = dsn.to_string();
    let sql = sql.to_string();
    
    // Note: ODBC nécessite un contexte synchrone, on utilise spawn_blocking
    // Utiliser catch_unwind pour capturer les panics potentielles
    let result = tokio::task::spawn_blocking(move || {
        std::panic::catch_unwind(|| {
            crate::sql::odbc::execute_odbc_query(&dsn, &sql)
        })
    })
    .await;
    
    match result {
        Ok(Ok(Ok(odbc_result))) => {
            let mut response = serde_json::Map::new();
            response.insert("columns".to_string(), serde_json::to_value(odbc_result.columns).unwrap());
            
            let rows: Vec<serde_json::Value> = odbc_result.rows
                .into_iter()
                .map(|row| {
                    let mut row_obj = serde_json::Map::new();
                    for (key, value) in row {
                        row_obj.insert(key, serde_json::Value::String(value));
                    }
                    serde_json::Value::Object(row_obj)
                })
                .collect();
            response.insert("rows".to_string(), serde_json::Value::Array(rows));
            
            Ok(Json(SqlResponse {
                success: true,
                data: Some(serde_json::Value::Object(response)),
                error: None,
                rows_affected: odbc_result.rows_affected,
            }))
        }
        Ok(Ok(Err(e))) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur ODBC lors de l'exécution de la requête: {}", e), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(SqlResponse {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                    rows_affected: None,
                }),
            ))
        }
        Ok(Err(_)) => {
            get_logger().log_with_source(LogLevel::Error, "Panic détectée lors de l'exécution de la requête ODBC".to_string(), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(SqlResponse {
                    success: false,
                    data: None,
                    error: Some("Erreur interne lors de l'accès ODBC. Vérifiez que les drivers ODBC sont correctement installés.".to_string()),
                    rows_affected: None,
                }),
            ))
        }
        Err(e) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur d'exécution lors de l'exécution de la requête: {}", e), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(SqlResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Erreur d'exécution: {}", e)),
                    rows_affected: None,
                }),
            ))
        }
    }
}

/// Requête pour récupérer les tables ODBC
#[derive(Deserialize)]
pub struct OdbcTablesRequest {
    pub dsn: String,
}

/// Réponse avec les tables
#[derive(Serialize)]
pub struct OdbcTablesResponse {
    pub success: bool,
    pub tables: Vec<String>,
    pub error: Option<String>,
}

/**
 * Handler POST /odbc/tables - Récupère la liste des tables depuis ODBC.
 * 
 * Se connecte à une source de données ODBC et retourne la liste
 * de toutes les tables disponibles.
 * 
 * @param request - Requête contenant le DSN ODBC
 * @returns Result<Json<OdbcTablesResponse>> - Liste des tables ou erreur HTTP
 * 
 * Effets de bord :
 * - Se connecte à la base de données ODBC
 * - Interroge les métadonnées de la base de données
 */
pub async fn get_odbc_tables(
    Json(request): Json<OdbcTablesRequest>,
) -> Result<Json<OdbcTablesResponse>, (StatusCode, Json<OdbcTablesResponse>)> {
    let dsn = request.dsn;
    
    // Utiliser catch_unwind pour capturer les panics potentielles
    let result = tokio::task::spawn_blocking(move || {
        std::panic::catch_unwind(|| {
            crate::sql::odbc::get_tables(&dsn)
        })
    })
    .await;
    
    match result {
        Ok(Ok(Ok(tables))) => {
            Ok(Json(OdbcTablesResponse {
                success: true,
                tables,
                error: None,
            }))
        }
        Ok(Ok(Err(e))) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur ODBC lors de la récupération des tables: {}", e), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OdbcTablesResponse {
                    success: false,
                    tables: Vec::new(),
                    error: Some(e.to_string()),
                }),
            ))
        }
        Ok(Err(_)) => {
            get_logger().log_with_source(LogLevel::Error, "Panic détectée lors de la récupération des tables ODBC".to_string(), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OdbcTablesResponse {
                    success: false,
                    tables: Vec::new(),
                    error: Some("Erreur interne lors de l'accès ODBC. Vérifiez que les drivers ODBC sont correctement installés.".to_string()),
                }),
            ))
        }
        Err(e) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur d'exécution lors de la récupération des tables: {}", e), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OdbcTablesResponse {
                    success: false,
                    tables: Vec::new(),
                    error: Some(format!("Erreur d'exécution: {}", e)),
                }),
            ))
        }
    }
}

/// Requête pour récupérer les relations ODBC
#[derive(Deserialize)]
pub struct OdbcRelationsRequest {
    pub dsn: String,
}

/// Réponse avec les relations
#[derive(Serialize)]
pub struct OdbcRelationsResponse {
    pub success: bool,
    pub relations: Vec<crate::sql::odbc::TableRelation>,
    pub error: Option<String>,
}

/**
 * Handler POST /odbc/relations - Récupère les relations entre les tables depuis ODBC.
 * 
 * Se connecte à une source de données ODBC et retourne la liste
 * des relations (clés étrangères) entre les tables.
 * 
 * @param request - Requête contenant le DSN ODBC
 * @returns Result<Json<OdbcRelationsResponse>> - Liste des relations ou erreur HTTP
 * 
 * Effets de bord :
 * - Se connecte à la base de données ODBC
 * - Interroge les métadonnées de relations de la base de données
 */
pub async fn get_odbc_relations(
    Json(request): Json<OdbcRelationsRequest>,
) -> Result<Json<OdbcRelationsResponse>, (StatusCode, Json<OdbcRelationsResponse>)> {
    let dsn = request.dsn;
    
    // Utiliser catch_unwind pour capturer les panics potentielles
    let result = tokio::task::spawn_blocking(move || {
        std::panic::catch_unwind(|| {
            crate::sql::odbc::get_relations(&dsn)
        })
    })
    .await;
    
    match result {
        Ok(Ok(Ok(relations))) => {
            Ok(Json(OdbcRelationsResponse {
                success: true,
                relations,
                error: None,
            }))
        }
        Ok(Ok(Err(e))) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur ODBC lors de la récupération des relations: {}", e), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OdbcRelationsResponse {
                    success: false,
                    relations: Vec::new(),
                    error: Some(e.to_string()),
                }),
            ))
        }
        Ok(Err(_)) => {
            get_logger().log_with_source(LogLevel::Error, "Panic détectée lors de la récupération des relations ODBC".to_string(), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OdbcRelationsResponse {
                    success: false,
                    relations: Vec::new(),
                    error: Some("Erreur interne lors de l'accès ODBC. Vérifiez que les drivers ODBC sont correctement installés.".to_string()),
                }),
            ))
        }
        Err(e) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur d'exécution lors de la récupération des relations: {}", e), Some("SQL Server".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(OdbcRelationsResponse {
                    success: false,
                    relations: Vec::new(),
                    error: Some(format!("Erreur d'exécution: {}", e)),
                }),
            ))
        }
    }
}

/// Structure pour le serveur SQL
pub struct SqlServer;

impl SqlServer {
    /// Crée un nouveau serveur SQL
    pub fn new() -> Self {
        Self
    }
}

