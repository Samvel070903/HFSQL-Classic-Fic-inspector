/**
 * Point d'entrée principal de l'application FIC Engine.
 * 
 * Ce fichier initialise le système de logging et lance l'exécution de la commande
 * CLI fournie par l'utilisateur. Il sert de point d'entrée unique pour toutes
 * les fonctionnalités de l'application (scan, export, serveur API, debug).
 * 
 * Dépendances principales :
 * - fic_engine::cli : Gestion de l'interface en ligne de commande
 * - tracing_subscriber : Configuration du système de logging
 */

use anyhow::Result;
use clap::Parser;
use fic_engine::cli::Cli;
use fic_engine::logger::{get_logger, LogLevel};
use tracing_subscriber;

/**
 * Point d'entrée principal de l'application.
 * 
 * Initialise le système de logging basé sur les variables d'environnement,
 * puis parse et exécute la commande CLI fournie par l'utilisateur.
 * 
 * @returns Result<()> - Succès si l'exécution s'est bien déroulée, erreur sinon.
 * 
 * Effets de bord :
 * - Initialise le système de logging global
 * - Peut démarrer un serveur HTTP si la commande "serve" est utilisée
 * - Peut lire/écrire des fichiers selon la commande exécutée
 */
#[tokio::main]
async fn main() -> Result<()> {
    // Installer un panic hook pour capturer et afficher les panics
    std::panic::set_hook(Box::new(|panic_info| {
        get_logger().log_with_source(LogLevel::Error, "❌ PANIC DÉTECTÉE:".to_string(), Some("Main".to_string()));
        if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            get_logger().log_with_source(LogLevel::Error, format!("   Message: {}", s), Some("Main".to_string()));
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            get_logger().log_with_source(LogLevel::Error, format!("   Message: {}", s), Some("Main".to_string()));
        }
        if let Some(location) = panic_info.location() {
            get_logger().log_with_source(LogLevel::Error, format!("   Localisation: {}:{}:{}", location.file(), location.line(), location.column()), Some("Main".to_string()));
        }
        get_logger().log_with_source(LogLevel::Error, "   Veuillez signaler cette erreur avec les détails ci-dessus.".to_string(), Some("Main".to_string()));
    }));

    // Initialisation du système de logging avec filtrage par variables d'environnement
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Parse et exécution de la commande CLI
    let cli = Cli::parse();
    cli.execute().await
}

