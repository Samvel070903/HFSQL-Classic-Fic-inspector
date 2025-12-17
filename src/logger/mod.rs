/**
 * Système de logging centralisé pour FIC Engine.
 * 
 * Ce module fournit un système de logging thread-safe qui collecte tous les logs
 * de l'application et les rend disponibles via l'API REST pour le frontend.
 * 
 * Tous les logs (info, warn, error) sont collectés et peuvent être récupérés
 * via l'endpoint GET /logs.
 */

pub mod logger;

pub use logger::{Logger, LogLevel, get_logger};

