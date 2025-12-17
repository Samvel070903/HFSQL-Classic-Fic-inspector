/**
 * Handlers HTTP pour la gestion des DSN ODBC.
 * 
 * Ce fichier contient les handlers HTTP pour créer, modifier, supprimer
 * et lister les sources de données ODBC (DSN) utilisateur.
 * 
 * Endpoints :
 * - GET /dsn : Liste tous les DSN utilisateur
 * - GET /dsn/:name : Récupère les informations d'un DSN
 * - POST /dsn : Crée un nouveau DSN
 * - PUT /dsn/:name : Met à jour un DSN existant
 * - DELETE /dsn/:name : Supprime un DSN
 * 
 * Liens avec d'autres modules :
 * - Utilise src/dsn/manager.rs pour les opérations sur le registre Windows
 */

use crate::dsn::manager::{DsnConfig, DsnInfo, DsnManager};
use crate::logger::{get_logger, LogLevel};
use anyhow::Result;
use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};

/// Réponse standardisée pour les opérations DSN
#[derive(Serialize)]
pub struct DsnResponse {
    pub success: bool,
    pub message: Option<String>,
    pub error: Option<String>,
}

/// Réponse avec les informations d'un DSN
#[derive(Serialize)]
pub struct DsnInfoResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dsn: Option<DsnInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Réponse avec la liste des DSN
#[derive(Serialize)]
pub struct DsnListResponse {
    pub success: bool,
    pub dsns: Vec<DsnInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Requête pour créer un DSN
#[derive(Deserialize)]
pub struct CreateDsnRequest {
    pub name: String,
    pub description: Option<String>,
    pub database_path: String,
    #[serde(default = "default_driver")]
    pub driver: String,
    #[serde(default)]
    pub driver_params: std::collections::HashMap<String, String>,
}

fn default_driver() -> String {
    // Driver par défaut pour les fichiers HFSQL
    "HFSQL".to_string()
}

/// Requête pour mettre à jour un DSN
#[derive(Deserialize)]
pub struct UpdateDsnRequest {
    pub description: Option<String>,
    pub database_path: Option<String>,
    pub driver: Option<String>,
    #[serde(default)]
    pub driver_params: std::collections::HashMap<String, String>,
}

/**
 * Handler GET /dsn - Liste tous les DSN utilisateur.
 * 
 * @returns Result<Json<DsnListResponse>> - Liste des DSN ou erreur HTTP
 */
pub async fn list_dsns() -> Result<Json<DsnListResponse>, (StatusCode, Json<DsnListResponse>)> {
    // Utiliser catch_unwind pour capturer les panics potentielles
    let result = std::panic::catch_unwind(|| {
        DsnManager::list_dsns()
    });

    match result {
        Ok(Ok(dsns)) => {
            Ok(Json(DsnListResponse {
                success: true,
                dsns,
                error: None,
            }))
        }
        Ok(Err(e)) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur lors de la récupération des DSN: {}", e), Some("DSN Handler".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DsnListResponse {
                    success: false,
                    dsns: Vec::new(),
                    error: Some(e.to_string()),
                }),
            ))
        }
        Err(_) => {
            get_logger().log_with_source(LogLevel::Error, "Panic détectée lors de la récupération des DSN".to_string(), Some("DSN Handler".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DsnListResponse {
                    success: false,
                    dsns: Vec::new(),
                    error: Some("Erreur interne lors de la récupération des DSN".to_string()),
                }),
            ))
        }
    }
}

/**
 * Handler GET /dsn/:name - Récupère les informations d'un DSN.
 * 
 * @param name - Nom du DSN
 * @returns Result<Json<DsnInfoResponse>> - Informations du DSN ou erreur HTTP
 */
pub async fn get_dsn(
    Path(name): Path<String>,
) -> Result<Json<DsnInfoResponse>, (StatusCode, Json<DsnInfoResponse>)> {
    // Utiliser catch_unwind pour capturer les panics potentielles
    let result = std::panic::catch_unwind(|| {
        DsnManager::get_dsn(&name)
    });

    match result {
        Ok(Ok(dsn)) => {
            Ok(Json(DsnInfoResponse {
                success: true,
                dsn: Some(dsn),
                error: None,
            }))
        }
        Ok(Err(e)) => {
            get_logger().log_with_source(LogLevel::Error, format!("Erreur lors de la récupération du DSN: {}", e), Some("DSN Handler".to_string()));
            Err((
                StatusCode::NOT_FOUND,
                Json(DsnInfoResponse {
                    success: false,
                    dsn: None,
                    error: Some(e.to_string()),
                }),
            ))
        }
        Err(_) => {
            get_logger().log_with_source(LogLevel::Error, "Panic détectée lors de la récupération du DSN".to_string(), Some("DSN Handler".to_string()));
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(DsnInfoResponse {
                    success: false,
                    dsn: None,
                    error: Some("Erreur interne lors de la récupération du DSN".to_string()),
                }),
            ))
        }
    }
}

/**
 * Handler POST /dsn - Crée un nouveau DSN utilisateur.
 * 
 * @param request - Configuration du DSN à créer
 * @returns Result<Json<DsnResponse>> - Confirmation ou erreur HTTP
 */
pub async fn create_dsn(
    Json(request): Json<CreateDsnRequest>,
) -> Result<Json<DsnResponse>, (StatusCode, Json<DsnResponse>)> {
    get_logger().log_with_source(LogLevel::Info, format!("Requête reçue pour créer DSN: {}", request.name), Some("DSN Handler".to_string()));
    get_logger().log_with_source(LogLevel::Info, format!("Chemin reçu: '{}'", request.database_path), Some("DSN Handler".to_string()));
    get_logger().log_with_source(LogLevel::Info, format!("Driver: '{}'", request.driver), Some("DSN Handler".to_string()));
    
    // Vérifier que le chemin n'est pas vide
    if request.database_path.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(DsnResponse {
                success: false,
                message: None,
                error: Some("Le chemin de la base de données ne peut pas être vide".to_string()),
            }),
        ));
    }
    
    let config = DsnConfig {
        name: request.name.clone(),
        description: request.description,
        database_path: request.database_path.clone(),
        driver: request.driver.clone(),
        driver_params: request.driver_params,
    };

    match DsnManager::create_dsn(&config) {
        Ok(_) => {
            Ok(Json(DsnResponse {
                success: true,
                message: Some(format!("DSN '{}' créé avec succès", request.name)),
                error: None,
            }))
        }
        Err(e) => {
            Err((
                StatusCode::BAD_REQUEST,
                Json(DsnResponse {
                    success: false,
                    message: None,
                    error: Some(e.to_string()),
                }),
            ))
        }
    }
}

/**
 * Handler PUT /dsn/:name - Met à jour un DSN existant.
 * 
 * @param name - Nom du DSN à mettre à jour
 * @param request - Nouvelles valeurs
 * @returns Result<Json<DsnResponse>> - Confirmation ou erreur HTTP
 */
pub async fn update_dsn(
    Path(name): Path<String>,
    Json(request): Json<UpdateDsnRequest>,
) -> Result<Json<DsnResponse>, (StatusCode, Json<DsnResponse>)> {
    // Récupérer le DSN existant pour conserver les valeurs non modifiées
    let existing = match DsnManager::get_dsn(&name) {
        Ok(d) => d,
        Err(e) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(DsnResponse {
                    success: false,
                    message: None,
                    error: Some(e.to_string()),
                }),
            ));
        }
    };

    let config = DsnConfig {
        name: name.clone(),
        description: request.description.or(existing.description),
        database_path: request.database_path.unwrap_or_else(|| {
            existing.database_path.unwrap_or_else(|| "".to_string())
        }),
        driver: request.driver.unwrap_or_else(|| {
            existing.driver.unwrap_or_else(|| "HFSQL".to_string())
        }),
        driver_params: request.driver_params,
    };

    match DsnManager::update_dsn(&name, &config) {
        Ok(_) => {
            Ok(Json(DsnResponse {
                success: true,
                message: Some(format!("DSN '{}' mis à jour avec succès", name)),
                error: None,
            }))
        }
        Err(e) => {
            Err((
                StatusCode::BAD_REQUEST,
                Json(DsnResponse {
                    success: false,
                    message: None,
                    error: Some(e.to_string()),
                }),
            ))
        }
    }
}

/**
 * Handler DELETE /dsn/:name - Supprime un DSN utilisateur.
 * 
 * @param name - Nom du DSN à supprimer
 * @returns Result<Json<DsnResponse>> - Confirmation ou erreur HTTP
 */
pub async fn delete_dsn(
    Path(name): Path<String>,
) -> Result<Json<DsnResponse>, (StatusCode, Json<DsnResponse>)> {
    match DsnManager::delete_dsn(&name) {
        Ok(_) => {
            Ok(Json(DsnResponse {
                success: true,
                message: Some(format!("DSN '{}' supprimé avec succès", name)),
                error: None,
            }))
        }
        Err(e) => {
            Err((
                StatusCode::NOT_FOUND,
                Json(DsnResponse {
                    success: false,
                    message: None,
                    error: Some(e.to_string()),
                }),
            ))
        }
    }
}

