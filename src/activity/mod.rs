/**
 * Module de suivi d'activité de l'application.
 * 
 * Ce module enregistre l'historique des accès aux bases de données
 * et l'activité liée aux DSN pour permettre un suivi dans le tableau de bord.
 * 
 * Liens avec d'autres modules :
 * - Utilisé par src/storage/engine.rs pour enregistrer les accès aux bases
 * - Utilisé par src/dsn/handlers.rs pour enregistrer l'activité DSN
 * - Utilisé par src/api/handlers.rs pour exposer l'historique
 */

pub mod tracker;

pub use tracker::{ActivityTracker, DsnActivityType};

