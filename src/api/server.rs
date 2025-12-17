/**
 * Configuration et démarrage du serveur HTTP API.
 * 
 * Ce fichier configure le serveur Axum avec tous les endpoints REST
 * et les middlewares nécessaires (CORS, logging, limite de taille de requête).
 * Il démarre le serveur sur l'adresse et le port spécifiés.
 * 
 * Endpoints exposés :
 * - GET /health : Vérification de santé du serveur
 * - POST /sql : Exécution de requêtes SQL
 * - POST /odbc/tables : Liste des tables ODBC
 * - POST /odbc/relations : Relations entre tables ODBC
 * - GET /dsn : Liste des DSN utilisateur
 * - POST /dsn : Créer un DSN utilisateur
 * - GET /dsn/:name : Informations d'un DSN
 * - PUT /dsn/:name : Modifier un DSN
 * - DELETE /dsn/:name : Supprimer un DSN
 * 
 * Liens avec d'autres modules :
 * - Utilise src/api/handlers.rs pour les handlers HTTP
 * - Utilise src/sql/server.rs pour les endpoints SQL
 * - Utilise src/storage/StorageEngine pour accéder aux données
 */

use crate::activity::ActivityTracker;
use crate::api::handlers;
use crate::dsn::handlers as dsn_handlers;
use crate::sql::server as sql_server;
use crate::storage::StorageEngine;
use anyhow::Context;
use axum::{
    routing::{get, post, put, delete},
    Router,
};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

/// État global de l'application partagé entre tous les handlers
#[derive(Clone)]
pub struct AppState {
    /// Moteur de stockage
    pub engine: Arc<StorageEngine>,
    /// Gestionnaire d'activité
    pub tracker: Arc<ActivityTracker>,
}

/**
 * Démarre le serveur HTTP API sur l'adresse et le port spécifiés.
 * 
 * Configure tous les endpoints REST, les middlewares (CORS, logging,
 * limite de taille), puis démarre le serveur en mode asynchrone.
 * 
 * @param engine - Moteur de stockage partagé (Arc pour thread-safety)
 * @param host - Adresse IP ou hostname d'écoute (ex: "127.0.0.1")
 * @param port - Port d'écoute (ex: 8080)
 * @returns Result<()> - Succès si le serveur démarre, erreur sinon
 * 
 * Effets de bord :
 * - Démarre un serveur HTTP qui écoute en continu
 * - Affiche des informations sur stdout (endpoints disponibles)
 * - Log les requêtes HTTP via tracing
 */
pub async fn start_server(engine: Arc<StorageEngine>, host: &str, port: u16) -> anyhow::Result<()> {
    // Créer le gestionnaire d'activité
    // Le fichier sera stocké dans le dossier de données
    let activity_path = engine.data_dir().parent()
        .unwrap_or_else(|| engine.data_dir())
        .join("activity.json");
    
    let tracker = Arc::new(
        ActivityTracker::new(&activity_path)
            .context("Impossible de créer le gestionnaire d'activité")?
    );

    // Créer l'état global de l'application
    let app_state = AppState {
        engine: engine.clone(),
        tracker,
    };

    let app = Router::new()
        .route("/health", get(handlers::health))
        .route("/activity", get(handlers::get_activity))
        .route("/logs", get(handlers::get_logs))
        .route("/scan", post(handlers::scan_directory))
        .route("/sql", post(sql_server::execute_sql))
        .route("/odbc/tables", post(sql_server::get_odbc_tables))
        .route("/odbc/relations", post(sql_server::get_odbc_relations))
        .route("/dsn", get(dsn_handlers::list_dsns))
        .route("/dsn", post(dsn_handlers::create_dsn))
        .route("/dsn/:name", get(dsn_handlers::get_dsn))
        .route("/dsn/:name", put(dsn_handlers::update_dsn))
        .route("/dsn/:name", delete(dsn_handlers::delete_dsn))
        .route("/migration/test", post(handlers::test_migration_connection))
        .route("/migration/start", post(handlers::start_migration))
        .route("/migration/status/:id", get(handlers::get_migration_status))
        .layer(CorsLayer::permissive())
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024)) // 10 MB
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    
    use crate::logger::get_logger;
    let logger = get_logger();
    
    logger.log_with_source(
        crate::logger::LogLevel::Info,
        format!("🚀 Serveur API démarré sur http://{}", addr),
        Some("API".to_string()),
    );
    
    logger.log_with_source(
        crate::logger::LogLevel::Info,
        "📋 Endpoints disponibles:".to_string(),
        Some("API".to_string()),
    );
    
    let endpoints = vec![
        "GET  /health",
        "GET  /activity - Historique d'activité",
        "GET  /logs - Logs de l'application",
        "POST /scan - Scanner un dossier et lister les fichiers .fic",
        "POST /sql - Exécuter des requêtes SQL",
        "POST /odbc/tables - Liste des tables ODBC",
        "POST /odbc/relations - Relations entre tables ODBC",
        "GET  /dsn - Liste des DSN utilisateur",
        "POST /dsn - Créer un DSN utilisateur",
        "GET  /dsn/:name - Informations d'un DSN",
        "PUT  /dsn/:name - Modifier un DSN",
        "DELETE /dsn/:name - Supprimer un DSN",
        "POST /migration/test - Tester une connexion de base de données",
        "POST /migration/start - Démarrer une migration",
        "GET  /migration/status/:id - Statut d'une migration",
    ];
    
    for endpoint in endpoints {
        logger.log_with_source(
            crate::logger::LogLevel::Info,
            format!("   {}", endpoint),
            Some("API".to_string()),
        );
    }
    
    info!("Serveur API démarré sur http://{}", addr);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}