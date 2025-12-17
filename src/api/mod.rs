/**
 * Module API HTTP pour FIC Engine.
 * 
 * Ce module expose une API REST permettant d'accéder aux données HFSQL
 * via HTTP. Il fournit des endpoints pour :
 * 
 * - Lister et interroger les tables
 * - Lire, créer, modifier et supprimer des enregistrements
 * - Uploader des fichiers .fic/.mmo/.ndx
 * - Exécuter des requêtes SQL
 * 
 * Structure :
 * - handlers.rs : Handlers HTTP pour chaque endpoint
 * - server.rs : Configuration et démarrage du serveur Axum
 * 
 * Exports :
 * - start_server : Fonction principale pour démarrer le serveur HTTP
 */

pub mod handlers;
pub mod server;

pub use server::{start_server, AppState};

