/**
 * Module de gestion des DSN ODBC utilisateur.
 * 
 * Ce module permet de créer, modifier et supprimer des sources de données ODBC
 * (DSN) utilisateur :
 * - Sur Windows : via le registre Windows
 * - Sur Linux : via le fichier ~/.odbc.ini
 * 
 * Fonctionnalités :
 * - Création de DSN utilisateur
 * - Modification de DSN existants
 * - Suppression de DSN
 * - Listing des DSN utilisateur disponibles
 * 
 * Structure :
 * - manager.rs : Gestion des DSN (Windows: registre, Linux: fichiers INI)
 * - handlers.rs : Handlers HTTP pour l'API REST
 */

pub mod manager;

pub mod handlers;

pub use manager::{DsnConfig, DsnInfo, DsnManager};

