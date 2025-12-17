/**
 * Module d'interface en ligne de commande (CLI) pour FIC Engine.
 * 
 * Ce module définit l'interface en ligne de commande permettant d'utiliser
 * le moteur FIC Engine depuis le terminal. Il expose plusieurs commandes :
 * 
 * - scan : Scanne un dossier et détecte les tables HFSQL
 * - export : Exporte une table vers JSON ou CSV
 * - serve : Démarre le serveur API HTTP
 * - debug : Affiche des informations de debug sur un fichier
 * 
 * Liens avec d'autres modules :
 * - Utilise src/storage/engine.rs pour accéder aux données
 * - Utilise src/config/settings.rs pour charger la configuration
 * - Utilise src/api/server.rs pour démarrer le serveur HTTP
 * - Utilise src/core/ pour analyser les fichiers
 */

pub mod commands;

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

/// Structure principale de l'interface en ligne de commande
#[derive(Parser)]
#[command(name = "fic")]
#[command(about = "Moteur bas niveau pour fichiers HFSQL (.fic, .mmo, .ndx)")]
pub struct Cli {
    /// Commande à exécuter
    #[command(subcommand)]
    pub command: Commands,

    /// Chemin du dossier contenant les fichiers .fic/.mmo/.ndx
    #[arg(short, long, global = true)]
    pub data_dir: Option<PathBuf>,

    /// Fichier de configuration
    #[arg(short, long, global = true)]
    pub config: Option<PathBuf>,
}

/// Commandes disponibles dans l'interface en ligne de commande
#[derive(Subcommand)]
pub enum Commands {
    /// Scanne un dossier et détecte les tables HFSQL
    Scan {
        /// Dossier à scanner
        #[arg(default_value = "./data")]
        path: PathBuf,
    },
    /// Exporte une table vers JSON ou CSV
    Export {
        /// Nom de la table à exporter
        table: String,
        /// Format d'export (json, csv)
        #[arg(short, long, default_value = "json")]
        format: String,
        /// Fichier de sortie (stdout si non spécifié)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Démarre le serveur API HTTP
    Serve {
        /// Port d'écoute du serveur
        #[arg(short, long, default_value_t = 8080)]
        port: u16,
        /// Adresse IP ou hostname du serveur
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
    },
    /// Affiche des informations de debug sur un fichier
    Debug {
        /// Chemin du fichier à analyser
        file: PathBuf,
        /// Type de dump (header, hex, raw, records)
        #[arg(short = 't', long, default_value = "header")]
        dump: String,
    },
}

impl Cli {
    /**
     * Exécute la commande CLI sélectionnée par l'utilisateur.
     * 
     * Charge la configuration, détermine le dossier de données, puis
     * exécute la commande appropriée (scan, export, serve, debug).
     * 
     * @returns Result<()> - Succès si l'exécution s'est bien déroulée, erreur sinon
     * 
     * Effets de bord :
     * - Peut lire/écrire des fichiers selon la commande
     * - Peut démarrer un serveur HTTP pour la commande "serve"
     * - Peut afficher des informations sur stdout/stderr
     */
    pub async fn execute(self) -> Result<()> {
        // Chargement de la configuration
        let settings = if let Some(config_path) = &self.config {
            crate::config::Settings::from_path(config_path)?
        } else {
            crate::config::Settings::load().unwrap_or_default()
        };

        // Détermination du dossier de données (priorité : argument CLI > config > défaut)
        let data_dir = self.data_dir.as_ref()
            .unwrap_or(&settings.data_dir)
            .clone();

        // Exécution de la commande appropriée
        match self.command {
            Commands::Scan { path } => {
                commands::scan_tables(path).await
            }
            Commands::Export { table, format, output } => {
                let engine = crate::storage::StorageEngine::new_with_parallel(&data_dir, true, settings.storage.parallel)?;
                engine.scan_tables()?;
                commands::export_table(engine, table, format, output).await
            }
            Commands::Serve { port, host } => {
                let engine = std::sync::Arc::new(
                    crate::storage::StorageEngine::new_with_parallel(&data_dir, settings.storage.read_only, settings.storage.parallel)?
                );
                engine.scan_tables()?;
                crate::api::start_server(engine, &host, port).await
            }
            Commands::Debug { file, dump } => {
                commands::debug_file(file, dump).await
            }
        }
    }
}

