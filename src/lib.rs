/**
 * Bibliothèque principale du moteur FIC Engine.
 * 
 * Ce module expose les fonctionnalités principales du moteur de traitement
 * des fichiers HFSQL (.fic, .mmo, .ndx). Il organise le code en modules
 * spécialisés :
 * 
 * - api : Serveur HTTP REST et handlers pour l'accès aux données
 * - cli : Interface en ligne de commande pour les opérations de maintenance
 * - config : Gestion de la configuration (fichiers, variables d'environnement)
 * - core : Traitement bas niveau des fichiers HFSQL (lecture, parsing)
 * - sql : Parser et exécuteur SQL pour requêter les données
 * - storage : Moteur de stockage haut niveau (tables, schémas, requêtes)
 * 
 * Exports publics :
 * - Settings : Configuration de l'application
 * - StorageEngine : Moteur principal de stockage et d'accès aux données
 */

pub mod activity;
pub mod api;
pub mod cli;
pub mod config;
pub mod core;
pub mod dsn;
pub mod logger;
pub mod migration;
pub mod sql;
pub mod storage;

pub use config::Settings;
pub use storage::StorageEngine;

